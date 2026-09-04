import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { runTailor } from "@/lib/tailor"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"
// Tailoring runs the full model ladder in one request; give it the max window a
// Vercel Hobby function allows (default is far shorter and would cut long runs off).
export const maxDuration = 60

// ACCEPTED RISK, decided 2026-09-02. resolveUserId() below falls back to "demo"
// for an unauthenticated caller, so this route is reachable anonymously and will
// tailor against the "demo" resume library — which on this deployment holds real
// resumes, not placeholders. It is also an open LLM endpoint: the only brake is
// TAILOR_IP_HOURLY, enforced by src/lib/rateLimit.ts, an in-memory Map that is
// per-instance and resets on redeploy, so it is advisory on serverless.
//
// Left open deliberately so the gmail-jd-reply-board extension keeps working.
// If that changes, require a session here and add a Bearer token to that
// extension's tailor.js.

// Unlimited by default (personal use). Set TAILOR_WEEKLY_LIMIT>0 in .env to cap.
const TAILOR_WEEKLY_LIMIT = Number(process.env.TAILOR_WEEKLY_LIMIT ?? 0)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
// Per-IP hourly abuse cap for the open (no-login) endpoint on a public tunnel. 0 = off.
const TAILOR_IP_HOURLY = Number(process.env.TAILOR_IP_HOURLY_LIMIT ?? 20)
const HOUR_MS = 60 * 60 * 1000

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

    // Per-IP abuse cap (protects the open endpoint on a public tunnel).
    if (TAILOR_IP_HOURLY > 0) {
      const rl = checkRateLimit(`tailor-ip:${clientIp(request)}`, { max: TAILOR_IP_HOURLY, windowMs: HOUR_MS })
      if (!rl.ok) {
        const mins = Math.ceil((rl.retryAfterSec ?? 3600) / 60)
        return NextResponse.json(
          { error: `Too many tailoring requests. Try again in ~${mins} min.` },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 3600) } },
        )
      }
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
