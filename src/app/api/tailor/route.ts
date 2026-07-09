import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { runTailor } from "@/lib/tailor"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

// Free-tier weekly tailor limit. Set TAILOR_WEEKLY_LIMIT=0 in .env to disable.
const TAILOR_WEEKLY_LIMIT = Number(process.env.TAILOR_WEEKLY_LIMIT ?? 7)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function resolveUserId(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? "demo"
  } catch { return "demo" }
}

// Synchronous tailor — generates (or returns the cached result for an identical
// JD + resume + feedback) and responds with the full result. The background flow
// (/api/tailor/start + /api/tailor/status) shares the same runTailor core.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const jd = (body.jd || "").trim()
    if (!jd) return NextResponse.json({ error: "Paste a job description first." }, { status: 400 })

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key found. Add a Claude, OpenRouter, or Gemini key in Settings or .env.local." },
        { status: 400 },
      )
    }

    // Server-side weekly usage cap (prevents unlimited calls by localStorage clearing or different browsers)
    const userId = await resolveUserId()
    if (TAILOR_WEEKLY_LIMIT > 0) {
      const rl = checkRateLimit(`tailor:${userId}`, { max: TAILOR_WEEKLY_LIMIT, windowMs: WEEK_MS })
      if (!rl.ok) {
        const daysLeft = rl.retryAfterSec ? Math.ceil(rl.retryAfterSec / 86400) : 7
        return NextResponse.json(
          { error: `Weekly tailor limit reached (${TAILOR_WEEKLY_LIMIT}/week). Resets in ~${daysLeft} day${daysLeft !== 1 ? "s" : ""}.` },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 86400) } },
        )
      }
    }

    const userResumeDir = path.join(USER_RESUMES_BASE, userId)
    const result = await runTailor({
      jd, keys, pref: body.llmHeavy, userResumeDir,
      givenPath: body.filepath || undefined,
      immediatePrefs: Array.isArray(body.immediatePrefs) ? body.immediatePrefs : [],
      noCache: !!body.noCache,
      onePage: !!body.onePage,
      sections: body.sections,
      mode: body.mode === "quick" ? "quick" : "full",
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: `Tailoring failed: ${String(e)}` }, { status: 500 })
  }
}
