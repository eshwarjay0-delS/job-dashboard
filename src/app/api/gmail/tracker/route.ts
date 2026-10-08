import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, threadsToApps } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/tracker — applications derived from classified threads, shaped as App[]
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-tracker:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 60, 1), 90)

    const threads = await fetchClassifiedThreads(ctx.userId, { days, max: 100 })
    const applications = threadsToApps(threads)

    return NextResponse.json({ ok: true, count: applications.length, applications })
  } catch (err) {
    console.error("gmail/tracker error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
