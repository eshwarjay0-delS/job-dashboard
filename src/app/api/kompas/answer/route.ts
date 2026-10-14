import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/answer — MarketFit's native session answer engine (2026-10-14).
//
// The owner's directive: sessions run on OpenRouter, max priority. perfACT's
// Groq backend rate-limits mid-session AND answers the wrong question (a typed
// "intro" came back as a CodeQL dissertation instead of a self-introduction).
// This endpoint replaces that backend for MarketFit's Kompas page: one
// OpenRouter call generates the answer already balanced for a human listener,
// grounded in the speaker's real background. Nothing here touches Groq.

const NO_STORE = { "Cache-Control": "no-store" }

const SYSTEM = `You are answering a live interview question as the candidate's copilot. The candidate will speak your answer out loud, so write it the way a sharp practitioner talks — thinking out loud with the listener, never reciting a spec sheet.

DELIVERY (this is the balance — hold it on every answer):
- THINK OUT LOUD. Reason in front of the listener: "It depends on the system — I'm going to assume it's on a Windows server, just to make the example easy."
- CONCRETE OVER ABSTRACT. Toy examples with names, never abstractions alone.
- UNFOLD STEP BY STEP, one clear move at a time, with natural pause points.
- 60% human narration, 40% crisp technical. Each technical point said once, said well, inside the story.
- TALK WITH, NOT AT: "right?", "you know", "basically".
- STRUCTURAL PAUSES — write these markers into the text: [beat] (once or twice per answer, BEFORE the key insight the listener must remember), [breath] (between ideas/steps so the listener catches up). Never stack them, never open with one.

SUBSTANCE:
- Ground EVERYTHING in the speaker's real background given below (identity, projects, prior answers). Prefer their actual projects and real outcomes over generic examples. Never invent employers, tools, or metrics that aren't in the background.
- The depth level is set by who is asking (given below): tech-HR stays accessible, engineer is practitioner-deep, architect keeps system-design teeth, director stays strategic. Whatever the level, sound like a person reasoning, not a manual.

SELF-INTRODUCTION — critical: when the interviewer asks for an introduction ("tell me about yourself", "introduce yourself", "walk me through your background", or just "intro" / "about me"), give a SPOKEN SELF-INTRODUCTION: who they are, years of experience, current role, 2-3 key strengths with real proof from their background, and why they're excited about THIS role and company. 60-90 seconds spoken. NEVER answer an intro request with a technical deep-dive.

LENGTH: a normal answer is 150-250 words spoken. Shorter when the moment is small.

Return only the answer, no preamble, no commentary.`

const DERIVE_SYSTEM = `You read a live interview transcript and pull out the interviewer's most recent question. Return ONLY the question text, nothing else. If the transcript contains no question for the candidate (small talk, thank-yous, silence, the candidate talking to themselves), return exactly: NO_QUESTION`

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-answer:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })
  }

  const keys = resolveKeys({})
  const uHash = hashUserId(user.id)
  let grounding = ""
  try { grounding = await dossierContext(uHash, "general") } catch { /* ungrounded answer is still an answer */ }

  // deriveOnly: the frontend asking "was that a question?" — answer cheaply.
  if (body.deriveOnly) {
    const transcript = str(body.transcript, 3000) || str(body.question, 500)
    if (!transcript) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    try {
      const { text } = await callLLM({
        keys, purpose: "kompas:answer-derive", tier: "light",
        system: DERIVE_SYSTEM,
        user: `Transcript:\n${transcript}`,
        maxTokens: 120,
      })
      const derived = text.trim()
      if (!derived || /^NO_QUESTION/i.test(derived)) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
      return NextResponse.json({ derived }, { headers: NO_STORE })
    } catch {
      return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    }
  }

  const question = str(body.question, 500)
  if (!question) return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })

  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>
  const interviewer = str(config.interviewer, 40) || "engineer"
  const prep = (body.prep && typeof body.prep === "object" ? body.prep : {}) as Record<string, unknown>
  const transcript = str(body.transcript, 4000)
  const history = Array.isArray(body.history) ? body.history.slice(-4).map((h) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>
    return `Q: ${str(o.q ?? o.question, 200)}\nA: ${str(o.a ?? o.answer ?? o.text, 400)}`
  }).filter(Boolean).join("\n\n") : ""
  const retrieved = Array.isArray(body.retrieved) ? body.retrieved.slice(0, 4).map((r) => str(r, 300)).filter(Boolean).join("\n") : ""

  const context = [
    `The interviewer is a ${interviewer} — pitch the technical depth to them.`,
    prep.identity ? `Candidate identity: ${str(prep.identity, 800)}` : "",
    prep.persona ? `Persona: ${str(prep.persona, 800)}` : "",
    prep.projects ? `Candidate's real projects: ${str(prep.projects, 2000)}` : "",
    grounding ? `Real background (prefer over generic examples):\n${grounding.slice(0, 3000)}` : "",
    transcript ? `Conversation so far:\n${transcript}` : "",
    history ? `Earlier in this interview:\n${history}` : "",
    retrieved ? `Retrieved notes:\n${retrieved}` : "",
  ].filter(Boolean).join("\n\n")

  try {
    const { text, provider, model } = await callLLM({
      keys, purpose: "kompas:answer", tier: "heavy",
      system: SYSTEM,
      user: `${context}\n\nThe interviewer asked: "${question}"\n\nAnswer it as the candidate's spoken reply:`,
      maxTokens: 900,
    })
    const out = text.trim()
    if (!out) throw new Error("empty answer")
    return NextResponse.json({
      text: out,
      polished: true,
      meta: { engine: "marketfit", provider, model, interviewer },
    }, { headers: NO_STORE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "answer failed"
    return NextResponse.json({ error: "The answer engine is unavailable right now. Try again in a moment.", detail: msg, meta: { engine: "marketfit", failed: true } }, { status: 503, headers: NO_STORE })
  }
}
