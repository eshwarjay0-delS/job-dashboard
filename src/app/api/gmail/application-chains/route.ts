import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, buildApplicationChains, TRACKING_DAYS } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/application-chains — every application as a chain:
// stages reached with dates + evidence, the people in the chain, who
// currently holds the profile, stall detection, and the next action.
export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-chains:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || TRACKING_DAYS, 1), TRACKING_DAYS)

    const account = url.searchParams.get("account") || undefined
    if (account && !ctx.accounts.some(a => a.gmail_enabled && a.google_email.toLowerCase() === account.toLowerCase())) return NextResponse.json({ ok: false, error: "Gmail account not connected" }, { status: 400 })
    const { threads, issues } = await fetchClassifiedThreads(ctx.userId, { days, max: 100, account }, { force: url.searchParams.get("refresh") === "1" })
    const chains = buildApplicationChains(threads)

    return NextResponse.json({ ok: true, count: chains.length, chains, issues, days, accounts: ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email), coverage: "Counts reflect scanned matching emails, not a complete inbox inventory." })
  } catch (err) {
    console.error("gmail/application-chains error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
