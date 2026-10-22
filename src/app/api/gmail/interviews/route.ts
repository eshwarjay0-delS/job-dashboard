import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, threadsToInterviews, enrichInterviewEvidence, scheduleInterviewDiscovery, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/interviews — interviews parsed from Interview Request emails, shaped as Interview[]
//
// Reads the same kept copy the interview board reads (owner, 22 Oct 2026: the
// counts on this page disagreed with the board and every visit loaded from
// scratch). The kept copy answers at once; the .ics evidence catch-up only
// touches old rows that predate the signal, and live discovery for threads
// the copy missed runs in the background — a newly found interview appears
// on the next quiet refresh instead of blocking this one.
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-interviews:${ctx.userId}`, { max: 30, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || TRACKING_DAYS, 1), TRACKING_DAYS)

    const kept = await keptThreads(ctx, days, { fetchWhenEmpty: true })
    const enriched = await enrichInterviewEvidence(ctx.userId, kept.threads).catch(() => kept.threads)
    scheduleInterviewDiscovery(ctx.userId, enriched)
    const interviews = threadsToInterviews(enriched)

    return NextResponse.json({ ok: true, count: interviews.length, interviews })
  } catch (err) {
    console.error("gmail/interviews error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
