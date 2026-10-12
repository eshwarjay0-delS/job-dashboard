import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, buildApplicationChains, scanApplicationHistory, TRACKING_DAYS } from "../_lib"
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

    const rl = checkRateLimit(`gmail-chains:${ctx.userId}`, { max: 60, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || TRACKING_DAYS, 1), TRACKING_DAYS)

    const account = url.searchParams.get("account") || undefined
    if (account && !ctx.accounts.some(a => a.gmail_enabled && a.google_email.toLowerCase() === account.toLowerCase())) return NextResponse.json({ ok: false, error: "Gmail account not connected" }, { status: 400 })
    const accounts = ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email)
    if (url.searchParams.get("accountsOnly") === "1") return NextResponse.json({ ok: true, accounts })
    if (url.searchParams.get("scan") === "1") {
      const selected = account || accounts[0]
      if (!selected) return NextResponse.json({ ok: true, chains: [], accounts, nextPageToken: null, scanned: 0 })
      const token = url.searchParams.get("pageToken") || undefined
      if (token && token.length > 2048) return NextResponse.json({ ok: false, error: "Invalid history cursor" }, { status: 400 })
      const phase = url.searchParams.get("phase") === "progress" ? "progress" : "history"
      const page = await scanApplicationHistory(ctx, selected, days, token, phase)
      const chains = buildApplicationChains(page.threads)
      return NextResponse.json({ ok: true, chains, count: chains.length, accounts, account: selected, scanned: page.scanned, nextPageToken: page.nextPageToken, issues: [], days })
    }
    const { threads, issues } = await fetchClassifiedThreads(ctx.userId, { days, max: 100, account }, { force: url.searchParams.get("refresh") === "1" })
    const chains = buildApplicationChains(threads)

    return NextResponse.json({ ok: true, count: chains.length, chains, issues, days, accounts: ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email), coverage: "Counts reflect scanned matching emails, not a complete inbox inventory." })
  } catch (err) {
    console.error("gmail/application-chains error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
