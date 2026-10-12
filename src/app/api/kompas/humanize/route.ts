import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/kompas/humanize — the copilot's answer, re-delivered for a human listener.
//
// Why (2026-10-11): the owner said the session answers are "super in detail"
// and technically fabulous — real scenarios, precise terms — but they talk
// like a textbook, not a person. The listener can't step into the speaker's
// shoes. This pass keeps EVERY technical fact, term, and scenario exactly as
// stated and rewrites only the delivery: warm, grammatical, well-paced,
// balanced so a human can follow, acknowledge, and feel satisfied.
//
// It never adds facts, never dumbs the substance down, and never shortens to
// the point of losing meaning. Metered as kompas:humanize, so the admin
// dashboard shows exactly what the polish costs.

const NO_STORE = { "Cache-Control": "no-store" }

const SYSTEM = `You are polishing an interview answer for a live copilot. The answer's technical substance is excellent — keep its technical LEVEL exactly where it is. Do not dumb it down. Do not remove details. Do not add new facts.

The problem you are fixing: it reads like a robot reciting a spec sheet. No human speaks like that, and the listener gets lost.

Rewrite it the way Josh Madakor answers interview questions — a sharp practitioner thinking out loud with the listener:

- THINK OUT LOUD. Reason in front of the listener instead of reciting conclusions. "It depends on the system you're working with — I'm going to assume it's sitting on a Windows server, just to make the example easy."
- CONCRETE OVER ABSTRACT. Never explain with abstractions alone — give a toy example with names. "Say we expect Jim and Bob to look at these files, and only those two — so the alert fires when the user ISN'T Jim or Bob."
- ADMIT NUANCE. "There's a lot of nuance depending on the system" — scope the answer honestly instead of pretending one size fits all.
- UNFOLD STEP BY STEP. One clear move at a time — "so first turn on file auditing... then define what you're protecting... then define what counts as unauthorized" — with natural pause points between steps, so the speaker can pace it and the listener stays alongside.
- BRIEF ON TECHNICAL, BALANCED OVERALL. About 60% human narration, 40% crisp technical. Each technical point said once, said well, inside the story — never a wall of jargon.
- TALK WITH, NOT AT. Conversational scaffolding — "right?", "you know", "basically" — so the listener feels included in the reasoning, not lectured.
- Intelligent word choice throughout: the words a smart human would actually say out loud.

The answer's depth level is set by who is asking (given below when known) — a tech-HR answer stays accessible, a director answer stays strategic, an architect/developer answer keeps its technical teeth. Whatever the level, it must sound like a person reasoning, not a manual.

Return only the polished answer, no preamble, no commentary about the rewrite.`

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-humanize:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: { text?: unknown; question?: unknown; role?: unknown; field?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to polish." }, { status: 400, headers: NO_STORE })
  }
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text) return NextResponse.json({ error: "Nothing to polish." }, { status: 400, headers: NO_STORE })
  if (text.length > 8000) return NextResponse.json({ error: "That answer is too long to polish in one pass." }, { status: 413, headers: NO_STORE })
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : ""
  const role = typeof body.role === "string" ? body.role.trim().slice(0, 40) : ""

  try {
    const keys = resolveKeys({})
    // Dossier grounding (2026-10-12): the user's real projects, prior answers,
    // and field realism bank ride along so the polish speaks from their actual
    // experience — peer-to-peer, not textbook. Best-effort; never blocks.
    let grounding = ""
    try {
      grounding = await dossierContext(hashUserId(user.id), String(body.field || "general").slice(0, 40))
    } catch { /* ungrounded polish is still a polish */ }
    const { text: polished } = await callLLM({
      keys,
      purpose: "kompas:humanize",
      tier: "light",
      system: SYSTEM + (grounding ? `\n\nGROUNDING — the speaker's real background. Prefer their actual projects and prior answers over generic examples:\n${grounding.slice(0, 3000)}` : ""),
      user: `${role ? `The person asking is a ${role} — pitch the technical depth to them, but sound human.\n` : ""}${question ? `The interviewer asked: "${question}"\n\n` : ""}The answer to polish:\n${text}`,
      maxTokens: 1200,
    })
    const out = polished.trim()
    if (!out) return NextResponse.json({ text }, { headers: NO_STORE })
    return NextResponse.json({ text: out }, { headers: NO_STORE })
  } catch {
    // The polish is an enhancement, never a gate: on failure the original
    // answer goes through untouched.
    return NextResponse.json({ text }, { headers: NO_STORE })
  }
}
