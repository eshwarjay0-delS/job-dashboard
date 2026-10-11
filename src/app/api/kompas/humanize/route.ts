import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"

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

The problem you are fixing is that it reads like a robot reciting — technically right, but no human speaks like that. The listener gets lost.

Rewrite it the way a sharp mentor explains it — think Josh Madakor walking through a cybersecurity concept: conversational, intelligent word choice, narrating like a human talking to another human.

The mix, exactly:
- About 60% balanced narrative flow, 40% technical precision. The technical points land crisply and briefly — said once, said well — inside a human narration, not as a spec sheet.
- PACING: unfold step by step with natural pause points. One clear idea at a time, so the speaker can deliver it at a pace the listener follows. Never a wall of detail.
- Intelligent forming of words: choose phrasing a smart human would actually say out loud. Grammatically clean, warm, no jargon-dumping.
- Guide the listener: set up each point so they can see where it's going, then land it. The listener should feel thought WITH, not talked AT.

The answer's depth level is set by who is asking (given below when known) — a tech-HR answer stays accessible, a director answer stays strategic, an architect/developer answer keeps its technical teeth. Whatever the level, it must sound like a person.

Return only the polished answer, no preamble, no commentary about the rewrite.`

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-humanize:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: { text?: unknown; question?: unknown; role?: unknown }
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
    const { text: polished } = await callLLM({
      keys,
      purpose: "kompas:humanize",
      tier: "light",
      system: SYSTEM,
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
