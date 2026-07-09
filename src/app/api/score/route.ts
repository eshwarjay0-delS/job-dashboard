import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/score
// Body: { resumeText: string, jd?: string }
// Returns: { score: number, grade: string, issues: Issue[], strengths: string[] }
//
// score 0–100 — weighted ATS compatibility + content quality
// grade A/B/C/D/F
// issues — ordered by severity, each with a fix suggestion
// strengths — 2–3 things the resume does well
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 10 score requests per hour per IP — this calls a paid LLM on the server key
    const rl = checkRateLimit(`score:${clientIp(req)}`, { max: 10, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const resumeText = (body.resumeText || "").trim()
    if (!resumeText || resumeText.length < 100) {
      return NextResponse.json({ error: "Resume text is too short." }, { status: 400 })
    }

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key found. Add one in Settings." },
        { status: 400 }
      )
    }

    const hasJD = (body.jd || "").trim().length > 50
    const jdSection = hasJD
      ? `\n\nJOB DESCRIPTION:\n${(body.jd as string).slice(0, 2000)}`
      : ""

    const system = `You are an expert ATS (Applicant Tracking System) and resume quality evaluator.
You score resumes on a 0–100 scale and identify concrete, actionable issues.

SCORING RUBRIC (100 points total):
- ATS Compatibility (25pts): no tables/columns/headers-footers, clean plain text structure, standard section headings
- Keyword Density (20pts): role-specific technical terms, tools, frameworks, certifications match the JD
- Metrics & Impact (20pts): quantified achievements (%, $, counts, time), not just responsibilities
- Summary Quality (15pts): specific, no "Having X years" opener, 60–80 words, single paragraph
- Structure & Completeness (10pts): correct section order, all key sections present, no orphaned content
- Bullet Quality (10pts): action-verb led, 4–6 per job, not too short or too long

ISSUES: rank by severity (critical > high > medium). Each must have:
- a severity level
- the specific problem found (quote text if possible)
- a concrete 1-sentence fix

STRENGTHS: 2–3 specific things done well.

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "score": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "summary": <1-sentence overall verdict>,
  "issues": [
    { "severity": <"critical"|"high"|"medium">, "problem": <string>, "fix": <string> }
  ],
  "strengths": [<string>, <string>]
}`

    const user = `RESUME:\n${resumeText.slice(0, 4000)}${jdSection}`

    const { text } = await callLLM({
      keys, tier: "light",
      system, user,
      maxTokens: 800,
    })

    // Parse JSON — strip any accidental markdown wrapper
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      // Attempt to extract JSON object from the text
      const match = clean.match(/\{[\s\S]+\}/)
      if (!match) throw new Error("LLM returned non-JSON response")
      result = JSON.parse(match[0])
    }

    // Validate + clamp
    result.score = Math.max(0, Math.min(100, Number(result.score) || 0))
    result.grade = result.grade || scoreToGrade(result.score)
    result.issues = Array.isArray(result.issues) ? result.issues.slice(0, 5) : []
    result.strengths = Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : []

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("Score API error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  return "F"
}
