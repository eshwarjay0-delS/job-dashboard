// POST /api/gmail/polish { text }
// "G" in the reply box: put the grammar right, and nothing else.
// First the fixes that need no model (src/lib/my-phrases.ts: tidyWriting). Then one model call that may only correct
// grammar, spelling and punctuation; its text is used only if it is still the person's own message (the same numbers,
// the same lines, about the same length: keepsMeaning). When no model answers, the first fixes are what comes back.
// -> { ok, text, changes, by: "ai" | "rules", note? }. Called only when G is pressed, never while typing.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { tidyWriting, keepsMeaning } from "@/lib/my-phrases"
import { plainFailure } from "@/lib/plain-failure"

export const dynamic = "force-dynamic"
export const maxDuration = 30
const MOST = 6000

const SYSTEM = `You correct the grammar of one email reply. Fix grammar, spelling, punctuation and capital letters only.
Keep every sentence, every fact, every name, every number and every line break exactly where it is. Do not add a
greeting, a sign-off or any new sentence. Do not remove anything. Do not make it more formal or change its tone.
Return only the corrected text, with nothing before or after it.`

export async function POST(req: Request) {
  const ctx = await requireAuth()
  if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
  if (!checkRateLimit(`gmail-polish:${ctx.userId}`, { max: 20, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "That is a lot of corrections in a minute. Try again shortly." }, { status: 429 })
  const body = (await req.json().catch(() => ({}))) as { text?: unknown }
  const text = typeof body.text === "string" ? body.text.slice(0, MOST) : ""
  if (!text.trim()) return NextResponse.json({ ok: false, error: "There is nothing to correct yet." }, { status: 400 })

  const first = tidyWriting(text)
  const keys = resolveKeys({})
  if (!hasAnyKey(keys)) return NextResponse.json({ ok: true, text: first.text, changes: first.changes, by: "rules" })
  try {
    const res = await callLLM({ keys, tier: "light", purpose: "writing-assist", system: SYSTEM, messages: [{ role: "user", content: first.text }], maxTokens: Math.min(1500, Math.ceil(first.text.length / 2.5) + 80) })
    const corrected = String(res.text || "").replace(/^```[a-z]*\n?|\n?```$/g, "").trim()
    if (!keepsMeaning(first.text, corrected)) return NextResponse.json({ ok: true, text: first.text, changes: first.changes, by: "rules" })
    const lead = first.text.match(/^\s*/)?.[0] || "", tail = first.text.match(/\s*$/)?.[0] || ""
    const out = `${lead}${corrected}${tail}`
    return NextResponse.json({ ok: true, text: out, changes: out === text ? 0 : Math.max(1, first.changes), by: "ai" })
  } catch (err) {
    console.error("gmail/polish error:", err)
    // The fixes that needed no model still stand, and the person is told the rest could not be checked.
    return NextResponse.json({ ok: true, text: first.text, changes: first.changes, by: "rules", note: plainFailure(err, "check the rest of the grammar", true) })
  }
}
