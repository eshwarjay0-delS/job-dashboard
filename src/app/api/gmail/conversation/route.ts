import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, threadsToMails, type ClassifiedThread } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/conversation?id=<thread id>&account=<the inbox it is in, when known>
// One conversation as a row of the inbox, from the kept copy. The inbox page holds the last 30 days; Overview and
// Follow-ups point at conversations up to 90 days old ("Open and nudge" on one that has been quiet for six weeks). When
// the page is asked to open one it does not hold, it asks here, so that the conversation asked for is the one shown
// and never the first one in the list in its place.
// It reads one kept row and never calls Gmail. Output { ok, mail } or 404 { ok: false, error }.
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const rl = checkRateLimit(`gmail-conversation:${ctx.userId}`, { max: 60, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const url = new URL(req.url)
    const id = (url.searchParams.get("id") || "").trim().slice(0, 200)
    const account = (url.searchParams.get("account") || "").trim().toLowerCase().slice(0, 200)
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return NextResponse.json({ ok: false, error: "Say which conversation: ?id=" }, { status: 400 })

    const enabled = new Set(ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email.toLowerCase()))
    const rows = await ctx.supabase.from("mfit_gmail_threads").select("data, account_email").eq("user_id", ctx.userId).eq("thread_id", id).limit(8)
    const found = ((rows.data || []) as Array<{ data: ClassifiedThread; account_email: string }>)
      .filter(r => Array.isArray(r.data?.messages) && r.data.messages.length > 0 && enabled.has(String(r.account_email || "").toLowerCase()))
    const row = found.find(r => !account || String(r.account_email || "").toLowerCase() === account)
    if (!row) return NextResponse.json({ ok: false, error: "That conversation is not among the mail MarketFit keeps." }, { status: 404 })
    const mail = threadsToMails([row.data])[0]
    return NextResponse.json({ ok: true, mail })
  } catch (err) {
    console.error("gmail/conversation error:", err)
    return NextResponse.json({ ok: false, error: "The conversation could not be read." }, { status: 500 })
  }
}
