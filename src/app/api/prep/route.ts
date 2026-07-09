import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prep
// Body: { company, role, interviewType, notes?, claudeKey? }
// Returns: { questions: string[], tips: string[], starPrompts: string[], whatToResearch: string[] }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 8 prep requests per hour per IP — calls LLM on the server key
    const rl = checkRateLimit(`prep:${clientIp(req)}`, { max: 8, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const company       = (body.company || "the company").trim()
    const role          = (body.role || "the role").trim()
    const interviewType = (body.interviewType || "video").trim()
    const notes         = (body.notes || "").trim()

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key configured. Add a Claude, OpenRouter, or Gemini key in Settings." },
        { status: 400 }
      )
    }

    const typeLabel: Record<string, string> = {
      phone:     "Phone Screen",
      video:     "Video Call",
      technical: "Technical Interview",
      onsite:    "On-site Interview",
      final:     "Final Round",
    }

    const system = `You are an expert career coach and technical interviewer. Generate highly specific, actionable interview prep material.

Rules:
- Be role and company specific — not generic
- For technical rounds: include actual coding/system design topics likely for that company
- For behavioral rounds: reference real STAR opportunities based on common work experiences
- Keep all items concise (1-2 lines each)
- Never start items with "How", always vary question starters
- Tips must be tactical, not platitudes ("Research X" → specify what specifically to research)

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "questions": [<6-8 likely questions for this specific interview type and company>],
  "tips": [<4-5 tactical prep tips specific to this company/role>],
  "starPrompts": [<3-4 STAR story prompts: "Think of a time when you... [specific to this role]">],
  "whatToResearch": [<3-4 specific things to look up before this interview>]
}`

    const user = `Interview details:
- Company: ${company}
- Role: ${role}
- Interview type: ${typeLabel[interviewType] || interviewType}${notes ? `\n- My notes: ${notes}` : ""}`

    const { text } = await callLLM({
      keys, tier: "light",
      system, user,
      maxTokens: 900,
    })

    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]+\}/)
      if (!match) throw new Error("LLM returned non-JSON")
      result = JSON.parse(match[0])
    }

    return NextResponse.json({
      ok: true,
      questions:      Array.isArray(result.questions)      ? result.questions.slice(0, 8)      : [],
      tips:           Array.isArray(result.tips)           ? result.tips.slice(0, 5)           : [],
      starPrompts:    Array.isArray(result.starPrompts)    ? result.starPrompts.slice(0, 4)    : [],
      whatToResearch: Array.isArray(result.whatToResearch) ? result.whatToResearch.slice(0, 4) : [],
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
