import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, buildApplicationChains } from "../_lib"
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
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 90, 1), 90)

    const { threads } = await fetchClassifiedThreads(ctx.userId, { days, max: 100 })
    const chains = buildApplicationChains(threads)

    return NextResponse.json({ ok: true, count: chains.length, chains })
  } catch (err) {
    console.error("gmail/application-chains error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
