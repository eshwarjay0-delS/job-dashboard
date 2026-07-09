import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

// ── /api/salary ───────────────────────────────────────────────────────────────
// GET ?role=<title>&company=<company>&location=<location>&level=<level>
// Returns market salary ranges, TC breakdown, and negotiation intelligence.
// Uses LLM knowledge of public compensation data (Levels.fyi, Glassdoor, Blind, LinkedIn).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // This endpoint has no auth and, absent a user-supplied key, falls back to the
  // SERVER's own paid LLM key (see resolveKeys) — bound anonymous abuse of that.
  const rl = checkRateLimit(`salary:${clientIp(request)}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const { searchParams } = new URL(request.url)
  const role     = searchParams.get("role") || "Software Engineer"
  const company  = searchParams.get("company") || ""
  const location = searchParams.get("location") || "US"
  const level    = searchParams.get("level") || ""
  const claudeKey = request.headers.get("x-claude-key") || ""

  const companyContext = company ? ` at ${company}` : ""
  const levelContext   = level ? ` (${level})` : ""
  const locContext     = location ? ` in ${location}` : " in the US"

  const prompt = `You are a compensation intelligence engine with access to aggregated salary data from Levels.fyi, Glassdoor, LinkedIn Salary, Blind, and Payscale as of 2024-2025.

Role: ${role}${levelContext}${companyContext}${locContext}

Return ONLY valid JSON (no markdown, no explanation):
{
  "base": { "low": <number>, "mid": <number>, "high": <number> },
  "bonus": { "low": <number>, "mid": <number>, "high": <number> },
  "equity_annual": { "low": <number>, "mid": <number>, "high": <number> },
  "tc": { "low": <number>, "mid": <number>, "high": <number> },
  "currency": "USD",
  "per": "year",
  "level_note": "<seniority context, e.g. 'Senior IC to Staff'>",
  "data_sources": ["Levels.fyi","Glassdoor","LinkedIn"],
  "negotiation_tips": [
    "<specific tip 1>",
    "<specific tip 2>",
    "<specific tip 3>"
  ],
  "market_note": "<one sentence on supply/demand for this role right now>",
  "h1b_note": "<one sentence on how H-1B status affects negotiation for this company/role>"
}`

  try {
    const keys = resolveKeys({ claudeKey })
    const { text } = await callLLM({
      keys,
      tier: "light",
      system: "You are a compensation data API. Return only valid JSON with no extra text.",
      user: prompt,
      maxTokens: 600,
    })

    // Strip any markdown fences
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const data = JSON.parse(clean)

    return NextResponse.json({ ok: true, ...data, role, company, location })
  } catch (e) {
    // Fallback: return estimated ranges based on role keywords
    const isStaff  = /staff|principal|distinguished|fellow/i.test(role + level)
    const isSenior = /senior|sr\.|lead/i.test(role + level) || isStaff
    const isJunior = /junior|jr\.|entry|associate|intern/i.test(role + level)

    const multiplier = isStaff ? 1.5 : isSenior ? 1.2 : isJunior ? 0.7 : 1.0
    const baseMid = Math.round(145000 * multiplier / 5000) * 5000
    const baseLow = Math.round(baseMid * 0.82)
    const baseHigh = Math.round(baseMid * 1.25)

    return NextResponse.json({
      ok: true,
      base: { low: baseLow, mid: baseMid, high: baseHigh },
      bonus: { low: Math.round(baseLow * 0.08), mid: Math.round(baseMid * 0.12), high: Math.round(baseHigh * 0.18) },
      equity_annual: { low: Math.round(baseLow * 0.1), mid: Math.round(baseMid * 0.2), high: Math.round(baseHigh * 0.35) },
      tc: { low: Math.round(baseLow * 1.18), mid: Math.round(baseMid * 1.32), high: Math.round(baseHigh * 1.53) },
      currency: "USD",
      per: "year",
      level_note: isSenior ? "Senior IC level" : isJunior ? "Entry-level / associate" : "Mid-level IC",
      data_sources: ["Estimated"],
      negotiation_tips: [
        "Ask for 10-15% above the midpoint — most companies have room to negotiate.",
        "Equity vesting schedule matters as much as the dollar amount. Ask for cliff and acceleration terms.",
        "Request a sign-on bonus if base is fixed to bridge to first bonus.",
      ],
      market_note: "Demand for this role remains strong in 2025 with average 4-6 weeks time-to-offer.",
      h1b_note: "H-1B candidates have the same negotiating power — do not accept lower offers due to visa dependency.",
      role,
      company,
      location,
      fallback: true,
      error: String(e),
    })
  }
}
