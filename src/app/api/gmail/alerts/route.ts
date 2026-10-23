import { NextResponse } from "next/server"
import {
  requireAuth,
  isAuthContext,
  fetchClassifiedThreads,
  enrichInterviewEvidence,
  inviteEvidence,
  buildApplicationChains,
  companyFromDomain,
  TRACKING_DAYS,
} from "../_lib"
import { emailAddress } from "@/lib/application-evidence"
import { shapeInboxAlerts, type AlertThreadInput, type ChainSummary } from "@/lib/inbox-alerts"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/alerts?since=<ms epoch> — urgent inbox items newer than
// the caller's watermark, each connected to the application chain it
// belongs to. The dashboard watcher polls this and taps the user
// (haptics + notification + card) when something lands. Confirmed
// invites only: the inviteEvidence standard decides what counts.
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-alerts:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const since = Number(url.searchParams.get("since")) || 0

    const { threads } = await fetchClassifiedThreads(ctx.userId, { days: TRACKING_DAYS, max: 100 })
    // Same one-time .ics catch-up the interviews route runs, so confirmed
    // invites cached before the signal existed still alert correctly.
    const enriched = await enrichInterviewEvidence(ctx.userId, threads)
    const chains = buildApplicationChains(enriched)

    const chainSummaries: ChainSummary[] = chains.map(c => ({
      accountEmail: c.accountEmail,
      threadIds: [c.threadId, ...(c.sourceThreadIds || [])],
      company: c.company,
      role: c.role,
      holder: c.holder,
      people: c.contacts.map(p => p.name).filter(Boolean),
    }))

    const inputs: AlertThreadInput[] = enriched.map(t => ({
      threadId: t.threadId,
      accountEmail: t.accountEmail,
      messages: t.messages.map(m => {
        const fromEmail = emailAddress(m.from)
        const ev = m.category === "Interview Request" ? inviteEvidence({ ...t, messages: [m] }) : null
        return {
          id: m.id,
          fromName: m.from.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || m.vendor || fromEmail,
          fromEmail,
          isMe: fromEmail !== "" && fromEmail === t.accountEmail.toLowerCase(),
          subject: m.subject,
          category: m.category,
          at: Number(m.internalDate || 0),
          confirmedInvite: ev?.confirmed || undefined,
          meetingStart: m.calendar?.find(c => !c.cancelled)?.start,
          jobTitle: m.jobTitle || undefined,
          company: companyFromDomain(m.vendorDomain || "", m.from),
        }
      }),
    }))

    const alerts = shapeInboxAlerts(inputs, chainSummaries, since)
    return NextResponse.json({ ok: true, alerts, now: Date.now() })
  } catch (err) {
    console.error("gmail/alerts error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
