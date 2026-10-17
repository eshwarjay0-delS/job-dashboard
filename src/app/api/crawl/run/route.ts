import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/crawl/run — daily portal crawl. Vercel cron (see vercel.json),
// same secret pattern as the other crons.

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function GET(req: NextRequest) {
  const vercelCronSecret = process.env.CRON_SECRET || ""
  const authHeader = req.headers.get("authorization") || ""
  const vercelCron = authHeader === `Bearer ${vercelCronSecret}` && vercelCronSecret.length >= 16
  const provided = req.headers.get("x-watchdog-secret") || ""
  const watchdogSecret = process.env.WATCHDOG_CRON_SECRET || ""
  const okSecret = vercelCron || (watchdogSecret.length >= 32 && timingSafeEqual(provided, watchdogSecret))
  if (!okSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }
  const { runCrawl } = await import("@/lib/crawl/runner")
  const results = await runCrawl()
  return NextResponse.json({ ok: true, results })
}
