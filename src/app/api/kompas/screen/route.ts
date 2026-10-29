import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { keysFor, resolveKeys } from "@/lib/llm"
import { scheduleLlmRecord } from "@/lib/llmLedger"
import { SCREEN_BODY_LIMIT, SCREEN_EXTRACTION_POLICY, formatScreenTasks, screenImage, screenTasks } from "@/lib/kompasScreen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const NO_STORE = { "Cache-Control": "no-store" }
const failure = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE })

// Extract the question only. The client then uses the existing grounded answer
// pipeline with the active resume, JD, audience and history, not a second persona.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return failure("Sign in again to use this.", 401)
  if (!checkRateLimit(`kompas-screen:${user.id}`, { max: 20, windowMs: 60_000 }).ok)
    return failure("Too much at once. Wait a moment.", 429)
  const reader = request.body?.getReader()
  if (!reader) return failure("No screen frame arrived.", 400)
  const chunks: Uint8Array[] = []; let size = 0
  let body: unknown
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > SCREEN_BODY_LIMIT) { await reader.cancel(); return failure("Screen image is too large. Share a smaller window.", 413) }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return failure("Could not read the screen request. Please retry.", 400) }
  finally { reader.releaseLock() }
  const image = screenImage(body && typeof body === 'object' ? (body as Record<string, unknown>).image : null)
  if (!image) return failure("Share a readable PNG, JPEG or WebP screen frame.", 400)
  const key = (await keysFor("kompas:screen", () => resolveKeys({}))).openrouter
  if (!key) return failure("Screen analysis is unavailable. Type the question while the connection is restored.", 503)
  const model = process.env.OPENROUTER_MODEL_SCREEN || "google/gemini-2.5-flash"
  const at = Date.now(); let ok = false, status: number | undefined, input = 0, output = 0
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
      body: JSON.stringify({ model, temperature: 0, max_tokens: 4096, response_format: { type: "json_object" },
        messages: [{ role: "system", content: SCREEN_EXTRACTION_POLICY }, { role: "user", content: [
          { type: "text", text: "Extract the visible question and its necessary context." },
          { type: "image_url", image_url: { url: image } },
        ] }],
      }),
    })
    status = response.status
    if (!response.ok) return failure("Screen analysis could not finish. Please retry or type the question.", response.status === 429 ? 429 : 502)
    const data = await response.json()
    input = Number(data.usage?.prompt_tokens) || 0; output = Number(data.usage?.completion_tokens) || 0
    if (data.choices?.[0]?.finish_reason !== 'stop') return failure("The screen question could not be read completely. Share a smaller area.", 422)
    const tasks = screenTasks(data.choices?.[0]?.message?.content)
    if (!tasks?.length) return failure("No clear question was readable. Share the question window or type it.", 422)
    // Capture never interrupts with a dialog: every extraction answers
    // directly, exactly like AI Answer — one press, one card, no modal.
    // Multiple questions arrive as one formatted question, answered once.
    ok = true
    return NextResponse.json({ needsAnswer: true, question: formatScreenTasks(tasks) }, { headers: NO_STORE })
  } catch { return failure("Screen analysis was interrupted. Please retry or type the question.", 502) }
  finally { scheduleLlmRecord({ at, app: "kompas", purpose: "screen", provider: "openrouter", model, ok, status, input, output, cacheRead: 0, cacheWrite: 0, ms: Date.now() - at }) }
}
