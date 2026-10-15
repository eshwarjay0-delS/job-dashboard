// GET /api/gmail/phrases
// The sentences the person has themselves written in more than one message, the most used first: what the reply box
// offers under the message as they type (src/lib/my-phrases.ts). Read once when a reply is opened; the box then finds
// what fits by itself, so nothing is asked of the server, or of a model, while they type.
// -> { ok, phrases: [{ text, count }] }
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { phrasesOf } from "@/lib/my-phrases"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`gmail-phrases:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: false })
    const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
    return NextResponse.json({ ok: true, phrases: phrasesOf(kept.threads, mine) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (err) {
    console.error("gmail/phrases error:", err)
    return NextResponse.json({ ok: true, phrases: [] })
  }
}
