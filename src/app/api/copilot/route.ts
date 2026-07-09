import { NextRequest, NextResponse } from "next/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

// 150 Copilot messages per day per authenticated user.
const COPILOT_DAILY_LIMIT = Number(process.env.COPILOT_DAILY_LIMIT ?? 150)
const DAY_MS = 24 * 60 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/copilot — AI Copilot chat
// Body: { messages: [{role, content}], context?: string, claudeKey?: string }
// Returns: { reply: string }
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

    // Per-user daily rate limit
    if (COPILOT_DAILY_LIMIT > 0) {
      let userId = "anon"
      try {
        const supabase = await createClient()
        const { data } = await supabase.auth.getUser()
        if (data.user?.id) userId = data.user.id
      } catch { /* unauthenticated → anon bucket */ }
      const rl = checkRateLimit(`copilot:${userId}`, { max: COPILOT_DAILY_LIMIT, windowMs: DAY_MS })
      if (!rl.ok) {
        return NextResponse.json(
          { ok: false, error: `Daily Copilot limit reached (${COPILOT_DAILY_LIMIT} messages/day). Try again tomorrow.` },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 86400) } },
        )
      }
    }

    const systemCtx = (body.context || "").trim()

    const system = `You are MarketFit Copilot — a concise, expert career AI built into the MarketFit job-search + résumé-tailoring app. You also guide users through the app itself.

ABOUT THIS APP (use this to give tours and answer "how do I…" questions — never invent features not listed here):
- Core: the user pastes a job description; the app auto-picks their best-matching résumé and tailors it to that job in under 20 seconds. It edits the TEXT of their existing résumé in place — fonts, layout, name, and contact are never changed — taking a résumé that's already a ~70-80% match up to a realistic 90-98% fit, never inventing experience.
- My Résumé (tailoring screen): paste a JD, choose "Sections to enhance" (Summary / Skills / Experience — unchecked sections stay exactly as the original), "Tailoring depth" (Quick = fastest, Full = most thorough), and an optional One-page toggle, then Generate.
- Result page: a match score split into drivers (Skills / Identity / Experience); a keyword panel (already-proved / added by tailoring / still-missing — tap missing keywords to add them and regenerate); "See your difference" (before→after of every changed line); downloads — Word (.docx) keeps the exact format and is recommended, PDF is a simplified copy (open the .docx and Save as PDF in Word for a pixel-perfect PDF).
- Library: upload a .docx, or a .zip of many résumés; the app auto-matches the right one to a JD by role title + keywords.
- Find Jobs: live listings with work-authorization filters (H-1B, OPT/CPT, W2, C2C, Green Card, No-sponsorship); save jobs.
- Job Alerts: save searches and see new matching jobs since the last check. Job Tracker: track applications through stages. Analytics: funnel & win-rate.
- Browser extension: autofills job applications and lets you tailor from any job posting.
- Plans: Free = store up to 2 résumés + 7 tailors/week (soft cap, displayed in Settings); connect Google Drive in Settings to store up to 78 résumés; data is private per user (Google sign-in); paid raises the limits.
- TOUR (if the user asks for one): paste a JD on My Résumé → pick depth & sections → Generate → review the score, keyword gaps, and before→after diff → download the Word file → track it in Job Tracker.

You also help with general career topics:
- Resume strategy: which skills to highlight, bullet structure, ATS optimization, defect fixes
- Job search: H1B/OPT/GC/C2C sponsorship, visa categories, salary negotiation, offer evaluation
- Application tracking: interpreting recruiter emails, timeline guidance, ghosting recovery
- Interview prep: technical screens, behavioral (STAR method), company research
- Cover letters, LinkedIn optimization, networking outreach

Rules:
- Be direct and practical. Skip filler ("Great question!", "Certainly!").
- Keep replies tight: 2–4 short paragraphs OR a short bullet list. No walls of text.
- Use markdown only when it genuinely helps (headers, bullets, code). Not for every response.
- If you don't know a company-specific fact, say so rather than guessing.
- Never refuse reasonable career/job questions.

${systemCtx ? `\nUSER CONTEXT (from their profile/current page):\n${systemCtx}` : ""}`

    // Last 8 turns as a proper messages array (all 3 providers now support this).
    const history = messages.slice(-8)

    const { text } = await callLLM({
      keys,
      tier: "light",
      system,
      messages: history,
      maxTokens: 700,
    })

    return NextResponse.json({ ok: true, reply: (text || "").trim() })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
