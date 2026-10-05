import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { runTailor } from "@/lib/tailor"
import { resolveKeys, hasAnyKey, tailorKeys } from "@/lib/llm"
import { authenticatedUser, signInRequired, ownedResumePath } from "@/lib/authBoundary"
import { isAdminEmail } from "@/lib/owner"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"
// Tailoring runs the full model ladder in one request; give it the max window a
// Vercel Hobby function allows (default is far shorter and would cut long runs off).
export const maxDuration = 60

// Authenticated cookie and extension Bearer sessions only.
// Unlimited by default (personal use). Set TAILOR_WEEKLY_LIMIT>0 in .env to cap.
const TAILOR_WEEKLY_LIMIT = Number(process.env.TAILOR_WEEKLY_LIMIT ?? 0)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
// Supplemental per-IP hourly cap. 0 = off; authentication is always required.
const TAILOR_IP_HOURLY = Number(process.env.TAILOR_IP_HOURLY_LIMIT ?? 20)
const HOUR_MS = 60 * 60 * 1000



// Synchronous tailor — generates (or returns the cached result for an identical
// JD + resume + feedback) and responds with the full result. The background flow
// (/api/tailor/start + /api/tailor/status) shares the same runTailor core.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return signInRequired()
  const userId = user.id
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    if (['jd', 'filepath'].some(key => body[key] !== undefined && typeof body[key] !== "string")) return NextResponse.json({ error: "Invalid text fields." }, { status: 400 })
    const jd = (body.jd || "").trim()
    if (!jd) return NextResponse.json({ error: "Paste a job description first." }, { status: 400 })

    if (body.filepath && !ownedResumePath(USER_RESUMES_BASE, userId, body.filepath)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    // The OpenAI key (GPT Luna) is handed over for an admin's tailoring only: see tailorKeys.
    const keys = tailorKeys(resolveKeys(body), { owner: isAdminEmail(user.email) })
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key found. Add a Claude, OpenRouter, or Gemini key in Settings or .env.local." },
        { status: 400 },
      )
    }

    // Supplemental per-IP abuse cap.
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
