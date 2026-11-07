import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { fetchClassifiedThreads } from "../_tools"
import { sendInterviewFollowUps, writeWatchdogRun, type WatchdogRunUser } from "@/lib/interview-followups"
import { sendSubmissionFollowUps } from "@/lib/submission-followups"
import { runChecks } from "@/lib/agent/watchdog-checks"

export const runtime = "nodejs"
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// MFit Agent watchdog — the background "is something going wrong?" monitors.
// Deterministic tripwires over the user's classified threads:
//
//  - duplicate-chains:  2+ vendors on the same posting/role  → DQ risk
//  - rtr-conflict:      RTRs signed/requested with 2+ vendors for one role
//  - rate-drift:        same role at 2+ different rates
//  - vendor-quiet:      actionable thread silent 7+ days (10+ → call list)
//  - interview-stale:   interview thread, no follow-up within 7 days
//
// GET  → Vercel cron fan-out (x-watchdog-secret header), all Gmail users
// POST → on-demand run for the signed-in user ("Check now" button)
// Findings land in mfit_notifications; repeats are deduped per role+vendor set.
// ─────────────────────────────────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

async function runForUser(userId: string): Promise<{ checked: number; notified: number }> {
  const service = createServiceClient()
  const { threads } = await fetchClassifiedThreads(userId, { days: 21, max: 100 })
  if (!threads.length) return { checked: 0, notified: 0 }

  const findings = runChecks(threads)
  let notified = 0

  for (const f of findings) {
    const vendorHash = crypto.createHash("sha1").update(f.body).digest("hex").slice(0, 16)
    // Dedup: same check + role + content already notified → skip.
    const { data: seen } = await service
      .from("mfit_watchdog_state")
      .select("id")
      .eq("user_id", userId)
      .eq("check_type", f.check)
      .eq("role_key", f.roleKey)
      .eq("vendor_hash", vendorHash)
      .limit(1)
    if (seen && seen.length > 0) continue

    const { error: nerr } = await service.from("mfit_notifications").insert({
      user_id: userId,
      type: `watchdog:${f.check}`,
      title: f.title.slice(0, 200),
      body: f.body.slice(0, 2000),
      link: "/dashboard/agent",
      read: false,
    })
    if (nerr) continue

    await service.from("mfit_watchdog_state").insert({
      user_id: userId,
      check_type: f.check,
      role_key: f.roleKey,
      vendor_hash: vendorHash,
    })
    notified++
  }

  return { checked: threads.length, notified }
}

// ── GET: cron fan-out ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const watchdogSecret = process.env.WATCHDOG_CRON_SECRET || ""
  const vercelCronSecret = process.env.CRON_SECRET || ""
  const providedHeader = req.headers.get("x-watchdog-secret") || ""
  const authHeader = req.headers.get("authorization") || ""
  const vercelCron = authHeader === `Bearer ${vercelCronSecret}` && vercelCronSecret.length >= 16
  const okSecret =
    (watchdogSecret.length >= 32 && timingSafeEqual(providedHeader, watchdogSecret)) || vercelCron
  if (!okSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }

  const service = createServiceClient()
  const { data: accounts, error } = await service
    .schema("private")
    .from("google_workspace_accounts")
    .select("user_id")
    .eq("gmail_enabled", true)
  if (error) {
    return NextResponse.json({ error: `Could not list accounts: ${error.message}` }, { status: 500 })
  }
  const userIds = [...new Set(((accounts || []) as Array<{ user_id: string }>).map(a => a.user_id))]

  const results: Record<string, { checked: number; notified: number } | { error: string }> = {}
  const followUps: Record<string, { sent: number; failed: number; dueButUnsent: { id: string; reason: string }[] } | { error: string }> = {}
  const submissionFollowUps: Record<string, { sent: number; failed: number; dueButUnsent: { id: string; reason: string }[] } | { error: string }> = {}
  for (const uid of userIds) {
    try {
      results[uid] = await runForUser(uid)
    } catch (err) {
      results[uid] = { error: String(err).slice(0, 200) }
    }
    // The weekly interview follow-ups a person asked to have sent for them (13 Oct 2026, src/lib/interview-followups.ts).
    // Only in this scheduled run, never from a page. Someone who handed nothing over costs one small read.
    // Every user is recorded, sent or not: a day with no sends is a record with zeros, never silence.
    try {
      const { data } = await service.from("profiles").select("full_name").eq("id", uid).maybeSingle()
      const first = String((data as { full_name?: string } | null)?.full_name || "").trim().split(/\s+/)[0] || ""
      followUps[uid] = await sendInterviewFollowUps(uid, first)
    } catch (err) {
      followUps[uid] = { error: String(err).slice(0, 200) }
    }
    // The weekly submission follow-ups a person asked to have sent for them (7 Nov 2026, src/lib/submission-followups.ts):
    // the same daily job, the same standing word, recorded apart from the interviews so the two traces never mix.
    try {
      const { data } = await service.from("profiles").select("full_name").eq("id", uid).maybeSingle()
      const first = String((data as { full_name?: string } | null)?.full_name || "").trim().split(/\s+/)[0] || ""
      submissionFollowUps[uid] = await sendSubmissionFollowUps(uid, first)
    } catch (err) {
      submissionFollowUps[uid] = { error: String(err).slice(0, 200) }
    }
  }
  // The run record: what the day's check did for every person, kept in Blob so a silent miss can be seen afterwards.
  const users: Record<string, WatchdogRunUser> = {}
  for (const uid of userIds) {
    const f = followUps[uid]
    const s = submissionFollowUps[uid]
    users[uid] = f && "sent" in f
      ? { sent: f.sent, failed: f.failed, dueButUnsent: f.dueButUnsent, ...(s && "sent" in s ? { submissions: { sent: s.sent, failed: s.failed, dueButUnsent: s.dueButUnsent } } : s && "error" in s ? { submissions: { sent: 0, failed: 0, dueButUnsent: [], error: s.error } } : {}) }
      : { sent: 0, failed: 0, dueButUnsent: [], error: f && "error" in f ? f.error : "The run did not report." }
  }
  await writeWatchdogRun({ at: Date.now(), usersChecked: userIds.length, users })
  return NextResponse.json({ ok: true, users: userIds.length, results, followUps, submissionFollowUps })
}

// ── POST: on-demand run for the signed-in user ────────────────────────────
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }
  try {
    const r = await runForUser(user.id)
    return NextResponse.json({ ok: true, ...r })
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 })
  }
}
