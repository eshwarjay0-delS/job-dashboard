import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const maxDuration = 30

// 60 writing-assist calls per user per hour — completions + proofreads are
// debounced client-side, this is the backstop.
const HOURLY_LIMIT = 60

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail/writing-assist
// { mode: "complete", text, context?: { to, subject, role } }
//   → { completion: string } — ghost-text finish for the current sentence.
// { mode: "proofread", text }
//   → { issues: [{ quote, suggestion, reason }] } — grammar/clarity fixes.
// ─────────────────────────────────────────────────────────────────────────────

const VOICE = `You write like Eshwar: plain professional recruiter emails. Short sentences. Warm but never flowery. Never use em-dashes. Sign-offs are "Regards, Eshwar" or "Best, Eshwar". Phone 646-820-3671 only when relevant.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const rl = checkRateLimit(`writing-assist:${user.id}`, { max: HOURLY_LIMIT, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || "")
    const text = String(body.text || "")
    if (!text.trim() || text.length > 4000) {
      return NextResponse.json({ error: "Text is required (max 4000 chars)." }, { status: 400 })
    }

    const keys = resolveKeys({})
    if (!hasAnyKey(keys)) return NextResponse.json({ error: "No AI key configured." }, { status: 503 })

    if (mode === "complete") {
      const ctx = body.context || {}
      const tail = text.slice(-400) // only complete from recent context
      const res = await callLLM({
        keys,
        tier: "light",
        purpose: "writing-assist",
        maxTokens: 60,
        system: `${VOICE}\n\nYou finish the sentence the user is currently typing in a recruiter email. Return ONLY the completion — the next few words that naturally finish their thought, max 20 words. No quotes, no preamble, no full sentence rewrite. If the thought already looks complete, return an empty string.`,
        user: `Email to: ${ctx.to || "a recruiter"}${ctx.subject ? `\nSubject: ${ctx.subject}` : ""}${ctx.role ? `\nRole: ${ctx.role}` : ""}\n\nDraft so far:\n${tail}\n\nCompletion:`,
      })
      const completion = (res.text || "").trim().replace(/^["']|["']$/g, "")
      return NextResponse.json({ ok: true, completion: completion.slice(0, 140) })
    }

    if (mode === "proofread") {
      const res = await callLLM({
        keys,
        tier: "light",
        purpose: "writing-assist",
        maxTokens: 400,
        system: `${VOICE}\n\nYou are a proofreader for recruiter emails. Find ONLY real problems: grammar errors, wrong word choice, awkward phrasing, inconsistent tone. Ignore style preferences. Return a JSON array, max 5 items, each exactly: {"quote": "the exact problematic phrase from the text", "suggestion": "the corrected phrase", "reason": "short reason, max 8 words"}. If the text is clean, return []. Return ONLY the JSON array, no other text.`,
        user: `Proofread this draft:\n\n${text.slice(0, 2000)}`,
      })
      let issues: Array<{ quote: string; suggestion: string; reason: string }> = []
      try {
        const m = (res.text || "").match(/\[[\s\S]*\]/)
        const parsed = JSON.parse(m ? m[0] : "[]")
        if (Array.isArray(parsed)) {
          issues = parsed
            .filter(i => i && typeof i.quote === "string" && typeof i.suggestion === "string")
            .slice(0, 5)
            .map(i => ({ quote: String(i.quote), suggestion: String(i.suggestion), reason: String(i.reason || "grammar") }))
        }
      } catch { /* malformed → no issues */ }
      return NextResponse.json({ ok: true, issues })
    }

    return NextResponse.json({ error: "mode must be 'complete' or 'proofread'." }, { status: 400 })
  } catch (err) {
    console.error("writing-assist error:", err)
    return NextResponse.json({ error: "Writing assist failed." }, { status: 500 })
  }
}
