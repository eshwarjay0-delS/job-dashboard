import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, threadsToInterviews, enrichInterviewEvidence } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/interviews — interviews parsed from Interview Request emails, shaped as Interview[]
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-interviews:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 60, 1), 90)

    const { threads } = await fetchClassifiedThreads(ctx.userId, { days: Math.max(days, 90), max: 100 })
    // One-time catch-up: re-verify .ics evidence on interview threads cached before the signal existed.
    const enriched = await enrichInterviewEvidence(ctx.userId, threads)
    const interviews = threadsToInterviews(enriched)

    return NextResponse.json({ ok: true, count: interviews.length, interviews })
  } catch (err) {
    console.error("gmail/interviews error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
