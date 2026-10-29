import { ignoreReason, validIgnoreRule } from "@/lib/gmail-ignore"
import { emailAddress } from "@/lib/application-evidence"
import { radarReviewObservation } from "@/lib/followup-eligibility"
import { getFollowupClaim } from "@/lib/followup-claims"
import { blob } from "@/lib/storage"
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
      eligibility: string; dueAt: number; lastSentAt: number; lastInboundAt: number | null
      claim: { claimed: boolean; claimedAt: number | null } | 'unknown'
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
      const outbound = emailAddress(latest.from) === own
      if (!outbound) continue

      const now = Date.now()
      const sentAt = Number(latest.internalDate)
      // Missing, invalid or future evidence cannot establish a quiet interval.
      if (!latest.internalDate || !Number.isFinite(sentAt) || sentAt <= 0 || sentAt > now) continue
      const daysWaiting = Math.floor((now - sentAt) / 86_400_000)
      if (!Number.isFinite(daysWaiting) || daysWaiting < minWait) continue

      // Who did he write to? The most recent inbound message's sender.
      let to = ""
      let lastInboundAt: number | undefined
      for (let i = t.messages.length - 2; i >= 0; i--) {
        if (emailAddress(t.messages[i].from) !== own) {
          to = t.messages[i].from
          // Only a verified inbound timestamp is passed on. An unverifiable
          // inbound time is treated as no timestamp evidence, never fabricated.
          // Order already establishes no reply after the outbound: the latest
          // message is outbound, so every inbound precedes it.
          const inboundAt = Number(t.messages[i].internalDate)
          if (Number.isFinite(inboundAt)) lastInboundAt = inboundAt
          break
        }
      }
      // Review-only verified observation. A 'due' verdict here never grants
      // permission to send, schedule, or claim; it only stamps this radar item
      // as passing the shared eligibility rule on verified evidence.
      const observation = radarReviewObservation({
        account: t.accountEmail,
        threadId: t.threadId,
        sentAt,
        lastInboundAt,
        minWaitDays: minWait,
        now,
      })
      // Review read only: whether this exact occurrence is already claimed.
      // A failed claim read never fails the radar response; it reports unknown.
      let claim: { claimed: boolean; claimedAt: number | null } | 'unknown' = 'unknown'
      try {
        const existing = await getFollowupClaim(blob, {
          userId: ctx.userId,
          account: t.accountEmail,
          thread: t.threadId,
          occurrence: observation.occurrence,
        })
        claim = existing
          ? { claimed: true, claimedAt: existing.claimedAt }
          : { claimed: false, claimedAt: null }
      } catch {
        claim = 'unknown'
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
        eligibility: observation.eligibility,
        dueAt: observation.dueAt,
        lastSentAt: observation.lastSentAt,
        lastInboundAt: observation.lastInboundAt,
        claim,
      })
    }

    radar.sort((a, b) => b.daysWaiting - a.daysWaiting)
    return NextResponse.json({ ok: true, count: radar.length, radar })
  } catch (err) {
    console.error("gmail/followup-radar error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
