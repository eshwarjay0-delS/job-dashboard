import { ignoreReason, validIgnoreRule } from "@/lib/gmail-ignore"
import { emailAddress } from "@/lib/application-evidence"
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/followup-radar — "I mailed them, they went quiet."
// Threads where the LATEST message is outbound (from the user's own account)
// and no reply has come back. Sorted by days waiting, longest first.
// Query: ?days=30 (lookback), ?minWait=3 (minimum quiet days to include)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }
    const rl = checkRateLimit(`gmail-radar:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90)
    const minWait = Math.min(Math.max(Number(url.searchParams.get("minWait")) || 3, 1), 30)

    const { threads } = await fetchClassifiedThreads(ctx.userId, { days, max: 100 })
    const radar: Array<{
      threadId: string; account: string
      to: string; subject: string; snippet: string
      daysWaiting: number; jobTitle: string; vendor: string
    }> = []

    const { data: { user: preferenceUser } } = await ctx.supabase.auth.getUser()
    const storedRules = preferenceUser?.user_metadata?.gmail_ignore_rules
    const ignoreRules = Array.isArray(storedRules) ? storedRules.filter(validIgnoreRule) : []
    for (const t of threads) {
      const contact = [...t.messages].reverse().find(m => emailAddress(m.from) !== t.accountEmail.toLowerCase())
      if (contact && ignoreReason({ account: t.accountEmail, id: t.threadId, fromEmail: emailAddress(contact.from) }, ignoreRules)) continue
      if (!t.messages.length) continue
      const latest = t.messages[t.messages.length - 1]
      const own = t.accountEmail.toLowerCase()
      const outbound = latest.from.toLowerCase().includes(own)
      if (!outbound) continue

      const ms = Date.now() - Number(latest.internalDate || 0)
      const daysWaiting = Math.floor(ms / 86_400_000)
      if (!Number.isFinite(daysWaiting) || daysWaiting < minWait) continue

      // Who did he write to? The most recent inbound message's sender.
      let to = ""
      for (let i = t.messages.length - 2; i >= 0; i--) {
        if (!t.messages[i].from.toLowerCase().includes(own)) {
          to = t.messages[i].from
          break
        }
      }
      radar.push({
        threadId: t.threadId,
        account: t.accountEmail,
        to,
        subject: latest.subject,
        snippet: latest.snippet.slice(0, 140),
        daysWaiting,
        jobTitle: latest.jobTitle || t.messages.find(m => m.jobTitle)?.jobTitle || "",
        vendor: latest.vendor || t.messages.find(m => m.vendor)?.vendor || "",
      })
    }

    radar.sort((a, b) => b.daysWaiting - a.daysWaiting)
    return NextResponse.json({ ok: true, count: radar.length, radar })
  } catch (err) {
    console.error("gmail/followup-radar error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
