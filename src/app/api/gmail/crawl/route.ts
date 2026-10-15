import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { fetchClassifiedThreads, enrichInterviewEvidence, threadsToInterviews, TRACKING_DAYS } from "../_lib"

export const runtime = "nodejs"
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// Idle crawler — the app works while he isn't looking.
// Every few hours (Vercel cron), for each user with connected Gmail:
//   1. Warm the thread cache incrementally (only what's new — cheap).
//   2. Live-discover interview-subject threads the cache fill missed and
//      cache them, so the Interviews tab is already complete when opened.
//   3. Count confirmed interviews (evidence gate) — the discovery loop learns.
// GET → Vercel cron fan-out. Same secrets as the watchdog cron.
// ─────────────────────────────────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

async function crawlForUser(userId: string): Promise<{ threads: number; discovered: number; interviews: number }> {
  const { threads } = await fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 })
  const before = threads.length
  const enriched = await enrichInterviewEvidence(userId, threads)
  const discovered = enriched.length - before
  const interviews = threadsToInterviews(enriched)
  return { threads: enriched.length, discovered, interviews: interviews.length }
}

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

  const results: Record<string, { threads: number; discovered: number; interviews: number } | { error: string }> = {}
  for (const uid of userIds) {
    try {
      results[uid] = await crawlForUser(uid)
    } catch (err) {
      results[uid] = { error: String(err).slice(0, 200) }
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, results })
}
