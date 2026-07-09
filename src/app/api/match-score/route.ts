import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { computeSkillsScore, computeLocationScore } from "@/lib/matching/computeMatchScore"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/match-score
// Body: { jd: string, profile: { skills, yearsExp, location, education }, claudeKey? }
// Returns: {
//   total: number,
//   breakdown: { skills, experience, education, location },
//   matchedSkills: string[],
//   missingSkills: string[],
//   aliasesUsed: string[],
//   requiredSkills: string[],
// }
//
// Weights: skills 45% + experience 30% + education 15% + location 10%
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 15 match-score requests per hour per IP — calls LLM to parse JD skills
    const rl = checkRateLimit(`match-score:${clientIp(req)}`, { max: 15, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const jd = (body.jd || "").slice(0, 3000).trim()
    const profile = body.profile || {}
    if (!jd || jd.length < 50) {
      return NextResponse.json({ error: "Job description too short." }, { status: 400 })
    }

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key configured." },
        { status: 400 }
      )
    }

    const profileSkills: string[] = Array.isArray(profile.skills)
      ? profile.skills
      : typeof profile.skills === "string"
      ? profile.skills.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean)
      : []

    const yearsExp = Number(profile.yearsExp) || 0
    const userLocation = (profile.location || "").toLowerCase()
    const education = (profile.education || "").toLowerCase()

    const system = `You are a technical recruiter analyzing job fit. Extract required skills from a JD and score a candidate.

Respond with ONLY valid JSON (no markdown):
{
  "requiredSkills": ["skill1", "skill2", ...],  // all technical skills/tools/certs required
  "yearsRequired": <number or 0 if not specified>,
  "educationRequired": "bachelor|master|phd|none",
  "locationRequired": "remote|onsite|hybrid|flexible",
  "seniority": "entry|mid|senior|staff|principal"
}`

    const user = `JD:\n${jd}`
    const { text } = await callLLM({ keys, tier: "light", system, user, maxTokens: 400 })

    let jdData: {
      requiredSkills: string[]
      yearsRequired: number
      educationRequired: string
      locationRequired: string
      seniority: string
    }

    try {
      const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
      const match = clean.match(/\{[\s\S]+\}/)
      jdData = JSON.parse(match ? match[0] : clean)
    } catch {
      jdData = { requiredSkills: [], yearsRequired: 0, educationRequired: "none", locationRequired: "flexible", seniority: "mid" }
    }

    const requiredSkills = (jdData.requiredSkills || []).map((s: string) => s.toLowerCase().trim())

    // Skill matching — use the shared lib (70+ aliases, security/staffing domain included).
    // Previously this route had an inline 18-entry ALIASES table that was a diverged subset
    // and still contained the ambiguous terraform/"tf" collision that was fixed in the lib.
    const skillResult = computeSkillsScore(profileSkills, requiredSkills)
    const matched    = skillResult.matchedSkills
    const missing    = skillResult.missingSkills
    const aliasesUsed = skillResult.aliasesUsed.map(a => `${a.alias} → ${a.canonical}`)

    // Scores
    const skillsScore = requiredSkills.length === 0 ? 75 : skillResult.score

    // Experience score
    let expScore = 100
    const reqYears = Number(jdData.yearsRequired) || 0
    if (reqYears > 0 && yearsExp > 0) {
      const gap = reqYears - yearsExp
      if (gap <= 0) expScore = 100
      else if (gap <= 1) expScore = 90
      else if (gap <= 2) expScore = 70
      else if (gap <= 3) expScore = 50
      else expScore = 30
    }

    // Education score
    let eduScore = 80
    const eduReq = (jdData.educationRequired || "none").toLowerCase()
    if (eduReq === "phd") {
      eduScore = education.includes("phd") || education.includes("doctor") ? 100 : 40
    } else if (eduReq === "master") {
      eduScore = education.includes("master") || education.includes("phd") || education.includes("doctor") ? 100
        : education.includes("bachelor") || education.includes("bs") || education.includes("ba") ? 70 : 50
    } else if (eduReq === "bachelor") {
      eduScore = education.includes("bachelor") || education.includes("bs") || education.includes("ba") ||
        education.includes("master") || education.includes("phd") ? 100 : 65
    } else {
      eduScore = 85
    }

    // Location score — use lib for city/state matching when a job city is available.
    // The LLM above extracts locationRequired (remote/onsite/hybrid/flexible) but not a
    // specific city. Fall back to work-model-only scoring for the common case; if the
    // caller also sends profile.jobLocation, do real city matching.
    const locReq = (jdData.locationRequired || "flexible").toLowerCase()
    const jobCity = (profile.jobLocation || "").toLowerCase().trim()
    let locScore: number
    if (locReq === "remote") {
      locScore = 100
    } else if (jobCity) {
      // Caller provided a specific job city — do proper city/state comparison.
      const workModel = locReq === "hybrid" ? "hybrid" : undefined
      locScore = computeLocationScore(userLocation, jobCity, workModel)
    } else if (locReq === "flexible" || locReq === "hybrid") {
      locScore = 90
    } else {
      // Onsite but no city — fall back to lib's general location heuristic.
      locScore = computeLocationScore(userLocation, "", undefined) // returns 80 if userLocation provided
    }

    // Weighted total: Skills 45% + Experience 30% + Education 15% + Location 10%
    const total = Math.round(
      skillsScore * 0.45 +
      expScore * 0.30 +
      eduScore * 0.15 +
      locScore * 0.10
    )

    return NextResponse.json({
      ok: true,
      total: Math.max(0, Math.min(100, total)),
      breakdown: {
        skills: skillsScore,
        experience: expScore,
        education: eduScore,
        location: locScore,
      },
      matchedSkills: matched,
      missingSkills: missing,
      aliasesUsed,
      requiredSkills,
      meta: {
        yearsRequired: reqYears,
        educationRequired: jdData.educationRequired,
        locationRequired: jdData.locationRequired,
        seniority: jdData.seniority,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
