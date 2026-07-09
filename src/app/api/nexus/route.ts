import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

// 100 Nexus messages per day per authenticated user.
// Prevents runaway usage of the server's own LLM key while still giving real users
// plenty of headroom (a 10-turn conversation = 5 round-trips; 100/day ≈ 20 sessions).
const NEXUS_DAILY_LIMIT = Number(process.env.NEXUS_DAILY_LIMIT ?? 100)
const DAY_MS = 24 * 60 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/nexus — Nexus AI job assistant with full context injection
// Body:
//   job: { title, company, location, description, workAuth, salary, posted }
//   profile: { name, skills, yearsExp, workAuth, targetRoles, education }
//   matchScore: number
//   h1bStatus: 'likely' | 'possible' | 'unknown'
//   messages: [{role: 'user'|'assistant', content: string}]
//   claudeKey?: string
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const messages: Array<{ role: "user" | "assistant"; content: string }> = body.messages || []
    if (!messages.length || !messages[messages.length - 1]?.content?.trim()) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 })
    }

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key configured. Add a Claude, OpenRouter, or Gemini key in Settings." },
        { status: 400 }
      )
    }

    // Per-user daily rate limit (only enforced when server-side LLM keys are in play)
    if (NEXUS_DAILY_LIMIT > 0) {
      let userId = "anon"
      try {
        const supabase = await createClient()
        const { data } = await supabase.auth.getUser()
        if (data.user?.id) userId = data.user.id
      } catch { /* unauthenticated → anon bucket */ }
      const rl = checkRateLimit(`nexus:${userId}`, { max: NEXUS_DAILY_LIMIT, windowMs: DAY_MS })
      if (!rl.ok) {
        return NextResponse.json(
          { ok: false, error: `Daily Nexus limit reached (${NEXUS_DAILY_LIMIT} messages/day). Try again tomorrow.` },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 86400) } },
        )
      }
    }

    const job = body.job || {}
    const profile = body.profile || {}
    const matchScore = Number(body.matchScore) || 0
    const h1bStatus = (body.h1bStatus as string) || "unknown"

    const h1bLabel = h1bStatus === "likely" ? "Likely 🟢" : h1bStatus === "possible" ? "Possible 🟡" : "Unknown ⚪"

    const system = `You are Nexus, MarketFit's AI job assistant. You help candidates find and land jobs with precision and transparency.

CURRENT JOB CONTEXT:
- Title: ${job.title || "Unknown"}
- Company: ${job.company || "Unknown"}
- Location: ${job.location || "Unknown"}
- Salary: ${job.salary || "Not listed"}
- Posted: ${job.posted || "Recently"}
- H1B Sponsor: ${h1bLabel}
- Work Auth Accepted: ${(job.workAuth || []).join(", ") || "Not specified"}
- Full JD:
${(job.description || "").slice(0, 2000) || "No description available."}

CANDIDATE PROFILE:
- Name: ${profile.name || "Candidate"}
- Target Roles: ${(profile.targetRoles || []).join(", ") || profile.title || "Not specified"}
- Skills: ${Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "Not listed")}
- Experience: ${profile.yearsExp || "Unknown"} years
- Education: ${profile.education || "Not specified"}
- Work Auth: ${profile.workAuth || "Not specified"}
- Current Match Score: ${matchScore}%

WHAT NEXUS CAN DO:
1. Explain match score breakdown (Skills 45% + Experience 30% + Education 15% + Location 10%)
2. List exactly which skills are missing from this JD vs the candidate's profile
3. Suggest specific resume bullets to add for this job
4. Draft a tailored cover letter (2-3 paragraphs, professional tone)
5. Generate 10 likely interview questions for this specific role + company
6. Explain H1B sponsorship likelihood with reasoning
7. Answer general career/job-search questions

RULES:
- Be direct and specific. No filler ("Great question!").
- When writing cover letters or interview questions, make them specific to this job and company.
- For missing skills, list them clearly with a note on how the candidate can address each.
- For match score breakdowns, calculate based on the JD and profile data above.
- Keep replies concise: 2-4 paragraphs or a focused bullet list. No walls of text.
- Use the actual job and profile data above — don't make up information.`

    // Pass the last 10 turns as a proper messages array (not a serialised string).
    // Each turn keeps its role so the model knows who said what.
    // Cap individual message content to 1 200 chars so a user pasting a wall of
    // text can't explode the context window.
    const MAX_MSG_CHARS = 1200
    const history = messages.slice(-10).map(m => ({
      ...m,
      content: typeof m.content === "string" && m.content.length > MAX_MSG_CHARS
        ? m.content.slice(0, MAX_MSG_CHARS) + "… [truncated]"
        : m.content,
    }))

    const { text } = await callLLM({
      keys,
      tier: "light",
      system,
      messages: history,
      maxTokens: 900,
    })

    return NextResponse.json({ ok: true, reply: (text || "").trim() })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
