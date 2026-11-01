import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import path from "path"
import { runTailor } from "@/lib/tailor"
import { recordTailor } from "@/lib/tailorLedger"
import { deductPoints, POINTS_PER_RESUME } from "@/lib/creditsLedger"
import { hasUnlimitedResumeTestAccess } from "@/lib/resumeTestAccess"
import { hashUserId } from "@/lib/sttLedger"
import { resolveKeys, hasAnyKey, keysFor, tailorKeys } from "@/lib/llm"
import { authenticatedUser, signInRequired, ownedResumePath } from "@/lib/authBoundary"
import { isAdminEmail } from "@/lib/owner"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"
import { fileTailored } from "@/lib/tailor-file"
import { randomBytes } from "crypto"
import { blob, keyOf } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { sameResumeIdentity } from "@/lib/resume-identity"
import { webRoundTripOn, webSharedClaimOn, webClaimKey, takeClaim, waitForClaim, releaseClaim } from "@/lib/tailor-guards"
import type { TailorResult } from "@/lib/tailor"

// A double-click that lands on another instance waits this long for the first run before answering "already making it".
const CLAIM_WAIT_MS = 240_000

// The WhatsApp send check on the website too (blueprint 2026-10-30, item 1): name, every email, phone, link and date of
// the source must be in the exported file unchanged. A file that cannot be read is not judged here (logged, not blocked).
async function sameFactsAsSource(result: TailorResult): Promise<boolean> {
  try {
    const [source, file] = await Promise.all([blob.get(keyOf(result.matched.filepath)), blob.get(`tailored/${result.token}.docx`)])
    if (!source || !file) { console.error("[tailor] round-trip check skipped: file unreadable"); return true }
    const [a, b] = await Promise.all([extractText(source), extractText(file)])
    return sameResumeIdentity(a, b)
  } catch (e) {
    console.error("[tailor] round-trip check skipped", String(e).slice(0, 120))
    return true
  }
}

export const runtime = "nodejs"
// Tailoring runs the full model ladder in one request; give it the max window a
// generation and repair window, reserving time for export and persistence.
export const maxDuration = 300

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
//
// `save: { role, company }` (with `filepath`, the resume it starts from) also files the result in the person's Files,
// in the folder of its email and kind of job, one job one file, and answers `saved: { rel, filepath, email, category, name }`
// (src/lib/tailor-file.ts). Apply on the website uses it; without `save` nothing is filed here.
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
    // Then the admin's checklist of which features may use which provider's key (src/lib/keyVault.ts).
    const keys = await keysFor("resume-tailor", () => tailorKeys(resolveKeys(body), { owner: isAdminEmail(user.email) }))
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
    if (TAILOR_WEEKLY_LIMIT > 0 && !hasUnlimitedResumeTestAccess(user.email)) {
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
    // One run per identical request across server instances, like WhatsApp's claim (blueprint 2026-10-30, item 4): a
    // double-click on another instance waits for the first run and is served its stored result, not a second paid run.
    // TAILOR_WEB_SHARED_CLAIM=0 leaves only runTailor's per-instance guard.
    const claimKey = webSharedClaimOn() ? webClaimKey(userId, jd, body as Record<string, unknown>) : ""
    const claimToken = randomBytes(6).toString("hex")
    let claimed = false
    let noCache = !!body.noCache
    let waitedMs = 0
    if (claimKey) {
      const got = await takeClaim(blob, claimKey, claimToken)
      if (got === "held") {
        const waitStart = Date.now()
        const freed = await waitForClaim(blob, claimKey, CLAIM_WAIT_MS)
        waitedMs = Date.now() - waitStart
        if (!freed) return NextResponse.json({ error: "This resume is already being made for this job. It will be ready in a minute; try again then." }, { status: 409 })
        noCache = false // the first run stored its result: serve that one
      } else claimed = got === "ok"
    }
    try {
    // Every generation is written down as it ends, failed ones included: the admin page counts them (src/lib/tailorLedger.ts).
    const began = Date.now()
    const run = async (fresh: boolean) => {
      const out = await runTailor({
        jd, keys, pref: body.llmHeavy, userResumeDir, ownerId: userId, maxMs: Math.max(30_000, 280_000 - waitedMs - (Date.now() - began)),
        givenPath: body.filepath || undefined,
        immediatePrefs: Array.isArray(body.immediatePrefs) ? body.immediatePrefs : [],
        noCache: fresh,
        onePage: !!body.onePage,
        sections: body.sections,
        mode: body.mode === "quick" ? "quick" : "full",
      }).catch(async (e: unknown) => {
        await recordTailor({ channel: "web", kind: "tailor", personId: userId, startedAt: began, error: e })
        throw e
      })
      await recordTailor({ channel: "web", kind: "tailor", personId: userId, startedAt: began, result: out })
      return out
    }
    let result = await run(noCache)
    // Round-trip check (TAILOR_WEB_ROUND_TRIP, default on). A file that changed the name, contact details or dates is
    // redrawn once while there is time, and otherwise not handed over or charged.
    if (webRoundTripOn() && !result.unchanged && !(await sameFactsAsSource(result))) {
      console.error("[tailor] round-trip guard stopped web delivery")
      if (Date.now() - began < 120_000) result = await run(true)
      if (!result.unchanged && !(await sameFactsAsSource(result))) {
        return NextResponse.json({ error: "The draft changed your name, contact details or dates, so it was not delivered. Your original resume is unchanged. Please try again.", quality_blockers: ["identity_mismatch"] }, { status: 422 })
      }
    }
    // Gel points: one resume preparation costs 0.25 points (four resumes = one
    // interview session). Idempotent per generation — retries cost nothing extra.
    const resumeId = (result as { id?: unknown }).id
    if (typeof resumeId === "string" && resumeId) {
      if (!hasUnlimitedResumeTestAccess(user.email)) {
        after(() => deductPoints(hashUserId(userId), POINTS_PER_RESUME, `resume:${resumeId}`, "resume"))
      }
    }
    const save = body.save && typeof body.save === "object" && !Array.isArray(body.save) ? body.save as { role?: unknown; company?: unknown } : null
    const saved = save && body.filepath
      ? await fileTailored({ userDir: userResumeDir, base: body.filepath, jd, result, role: typeof save.role === "string" ? save.role : "", company: typeof save.company === "string" ? save.company : "" })
      : null
    return NextResponse.json(saved ? { ...result, saved } : result)
    } finally {
      if (claimed) await releaseClaim(blob, claimKey, claimToken)
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: `Tailoring failed: ${String(e)}` }, { status: 500 })
  }
}
