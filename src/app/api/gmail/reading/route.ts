import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"
import { readThread, type ThreadLike } from "@/lib/mail-reading"

// GET /api/gmail/reading?id=<thread id>&account=<the inbox it is in>
// One conversation as it is read: each message in order, who wrote it, when, and what they themselves wrote. The quoted
// history and the legal notice under each message are set aside (src/lib/mail-reading.ts). Nothing is reworded.
// It reads the copy this app already keeps of the thread: one row, no call to Gmail. Only when that copy is not there
// does it fall back to the same fetch the inbox list uses.
// Output { ok, id, subject, messages: [{ id, who, email, mine, at, text, earlier, footer }] }
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })

    const rl = checkRateLimit(`gmail-reading:${ctx.userId}`, { max: 90, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const url = new URL(req.url)
    const id = (url.searchParams.get("id") || "").trim().slice(0, 200)
    const account = (url.searchParams.get("account") || "").trim().toLowerCase().slice(0, 200)
    if (!id) return NextResponse.json({ ok: false, error: "Say which conversation: ?id=" }, { status: 400 })

    let thread: ThreadLike | null = null
    try {
      const rows = await ctx.supabase.from("mfit_gmail_threads").select("data, account_email").eq("user_id", ctx.userId).eq("thread_id", id).limit(8)
      const found = (rows.data || []) as Array<{ data: ThreadLike; account_email: string }>
      const row = found.find(r => !account || String(r.account_email || "").toLowerCase() === account) || found[0]
      if (row?.data?.messages?.length) thread = row.data
    } catch { /* no kept copy to read: the fetch below is the same one the inbox list uses */ }

    if (!thread) {
      const { threads } = await fetchClassifiedThreads(ctx.userId, { days: 30, max: 50, ...(account ? { account } : {}) }, { force: false })
      thread = threads.find(t => t.threadId === id && (!account || t.accountEmail.toLowerCase() === account)) || null
    }
    if (!thread) return NextResponse.json({ ok: false, error: "This conversation is not in the last 30 days of mail." }, { status: 404 })

    const mine = ctx.accounts.map(a => a.google_email)
    return NextResponse.json({ ok: true, id, ...readThread(thread, mine) })
  } catch (err) {
    console.error("gmail/reading error:", err)
    return NextResponse.json({ ok: false, error: "The conversation could not be read." }, { status: 500 })
  }
}
