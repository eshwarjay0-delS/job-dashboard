import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { runTailor } from "@/lib/tailor"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { createJob, updateJob } from "@/lib/jobs"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

const TAILOR_WEEKLY_LIMIT = Number(process.env.TAILOR_WEEKLY_LIMIT ?? 7)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Start a tailoring job in the BACKGROUND. Returns a job id immediately; the
// generation continues server-side and the result is recovered via /api/tailor/status.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const jd = (body.jd || "").trim()
    if (!jd) return NextResponse.json({ error: "Paste a job description first." }, { status: 400 })

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) return NextResponse.json({ error: "No API key found. Add a Claude, OpenRouter, or Gemini key in Settings or .env.local." }, { status: 400 })

    // Resolve auth-scoped context NOW (the request's cookies are alive here, not in
    // the detached background task below).
    let userId = "demo"
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user?.id) userId = data.user.id
    } catch { /* unauthenticated → demo */ }

    // Server-side weekly cap — same bucket as the sync /api/tailor route
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

    const job = await createJob({ jd, filepath: body.filepath || "", userId })

    // Fire-and-forget: keep generating after the response is sent. On a long-running
    // node server this completes; the result lands in the job file.
    void (async () => {
      try {
        const result = await runTailor({
          jd, keys, pref: body.llmHeavy, userResumeDir,
          givenPath: body.filepath || undefined,
          immediatePrefs: Array.isArray(body.immediatePrefs) ? body.immediatePrefs : [],
          noCache: !!body.noCache,
          onePage: !!body.onePage,
          sections: body.sections,
          mode: body.mode === "quick" ? "quick" : "full",
        })
        await updateJob(job.id, { status: "done", resumeName: result.matched.filename, result })
      } catch (e) {
        await updateJob(job.id, { status: "error", error: String(e) })
      }
    })()

    return NextResponse.json({ id: job.id, status: "running" })
  } catch (e) {
    return NextResponse.json({ error: `Could not start tailoring: ${String(e)}` }, { status: 500 })
  }
}
