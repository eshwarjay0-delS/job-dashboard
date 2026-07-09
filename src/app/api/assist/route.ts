import { NextRequest, NextResponse } from "next/server"
import { assistField } from "@/lib/claude"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// POST { section, current, instruction, jd?, claudeKey? } → { text }
export async function POST(request: NextRequest) {
  try {
    // 20 assist calls per hour per IP (short LLM calls, used inline in the builder)
    const rl = checkRateLimit(`assist:${clientIp(request)}`, { max: 20, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await request.json().catch(() => ({}))
    const instruction = (body.instruction || "").trim()
    const section = (body.section || "field").trim()
    const current = (body.current || "").toString()
    if (!instruction) return NextResponse.json({ error: "Type an instruction first." }, { status: 400 })

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) return NextResponse.json({ error: "No API key found. Add a Claude, OpenRouter, or Gemini key in Settings or .env.local." }, { status: 400 })

    const text = await assistField({ keys, pref: body.llmLight, section, current, instruction, jd: (body.jd || "").trim() })
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: `AI assist failed: ${String(e)}` }, { status: 500 })
  }
}
