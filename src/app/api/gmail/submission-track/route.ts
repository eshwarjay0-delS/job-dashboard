// Submission follow-ups on the Overview page (GET/POST /api/gmail/submission-track).
//
// The Interviews tab's track route, pointed at Overview submission chains
// instead of interviews (7 Nov 2026, owner ask). GET answers with every open
// submission as a Tracked — the same shape the Interviews tab shows — plus
// the words for each one (user-edited words first, then the stage template)
// and whether the daily job is running. POST takes the follow-up actions:
// send_for_me (the "Yes, send it for me every week" tap), stop_sending,
// save_words, set_days, send_now. There is no rejected/completed/reopen
// here: a submission ends when the mail says offer or rejected, never by a
// tap. The four-count binds only the automatic weekly send, never a manual
// Send now tap.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, buildApplicationChains, TRACKING_DAYS, type AuthContext } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { decide, cleanDays, effectiveHand } from "@/lib/interview-track"
import { trackSubmissions, submissionWords } from "@/lib/submission-track"
import { readSubmissionTrackState, writeSubmissionTrackState, sendSubmissionFollowUpNow } from "@/lib/submission-followups"
import { readWatchdogRun } from "@/lib/interview-followups"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const ACTIONS = new Set(["send_for_me", "stop_sending", "save_words", "set_days", "send_now"])

async function answer(ctx: AuthContext) {
  const { data: { user } } = await ctx.supabase.auth.getUser()
  const [kept, recruiters, state, lastWatchdogRun] = await Promise.all([keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true }), readRecruiters(ctx.userId), readSubmissionTrackState(ctx.userId), readWatchdogRun(ctx.userId)])
  const chains = buildApplicationChains(kept.threads)
  const out = trackSubmissions(chains, state, Date.now(), { recruiter: email => isMyRecruiter(recruiters, email) })
  const meta = (user?.user_metadata || {}) as { full_name?: string; name?: string }
  const myName = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0] || ""
  const words: Record<string, { subject: string; body: string }> = {}
  const threadOf = new Map(out.active.map(t => [t.id, t.threadId]))
  const chainById = new Map(chains.map(c => [`${c.accountEmail}:${c.threadId}`, c]))
  for (const t of out.active) {
    if (t.phase !== "waiting" || !t.contact) continue
    // Prefer user-edited words when present — an earlier round's edited words carry to a new round; fall back to the stage template.
    const hand = effectiveHand(state, t.id, t.threadId, threadOf)
    const chain = chainById.get(t.id)
    words[t.id] = hand?.subject && hand?.body ? { subject: hand.subject, body: hand.body } : chain ? submissionWords(chain, t.contact, myName) || { subject: "", body: "" } : { subject: "", body: "" }
  }
  // Sending for the person needs the site's daily job to be running. Said, so the switch never promises what will not happen.
  const canSendForYou = (process.env.CRON_SECRET || "").length >= 16 || (process.env.WATCHDOG_CRON_SECRET || "").length >= 32
  return { ok: true, kept: kept.kept, ...out, words, canSendForYou, lastWatchdogRun }
}

export async function GET() {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`submission-track:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    return NextResponse.json(await answer(ctx), PRIVATE)
  } catch (err) {
    console.error("gmail/submission-track error:", err)
    return NextResponse.json({ ok: false, error: "Your submissions could not be read just now." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`submission-track:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; ids?: unknown; action?: unknown; subject?: unknown; body?: unknown; days?: unknown }
    const action = String(body.action || "")
    // One submission at a time: there is no bulk "they are all over" for submissions.
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(v => String(v || "").slice(0, 300)).filter(Boolean).slice(0, 60)
    if (!ids.length || !ACTIONS.has(action) || ids.length > 1) return NextResponse.json({ ok: false, error: "Choose a submission and what to do with it." }, { status: 400 })
    // Ticked weekdays for the automatic send. Missing means leave them alone, except set_days, where it clears them.
    const days = Array.isArray(body.days) ? cleanDays(body.days) : action === "set_days" ? [] : undefined
    // Custom words for send_for_me, save_words and send_now (user-edited draft)
    const customWords = (action === "send_for_me" || action === "save_words" || action === "send_now") && typeof body.subject === "string" && typeof body.body === "string"
      ? { subject: body.subject.slice(0, 200), body: body.body.slice(0, 2000) }
      : undefined
    if (action === "send_now") {
      const { data: { user } } = await ctx.supabase.auth.getUser()
      const meta = (user?.user_metadata || {}) as { full_name?: string; name?: string }
      const myName = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0] || ""
      // The board's kept copy verifies the tap; only a submission it missed falls back to the live scan.
      const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true }).catch(() => null)
      const sent = await sendSubmissionFollowUpNow(ctx.userId, myName, ids[0], customWords, undefined, kept?.threads.length ? kept.threads : undefined)
      if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error || "That send could not go out just now." }, { status: 400 })
      const out = await answer(ctx)
      return NextResponse.json(sent.skipped ? { ...out, skipped: true } : out, PRIVATE)
    }
    let state = await readSubmissionTrackState(ctx.userId)
    const now = Date.now()
    for (const id of ids) state = decide(state, id, action as Parameters<typeof decide>[2], now, customWords, days)
    await writeSubmissionTrackState(ctx.userId, state)
    return NextResponse.json(await answer(ctx), PRIVATE)
  } catch (err) {
    console.error("gmail/submission-track error:", err)
    return NextResponse.json({ ok: false, error: "That could not be saved just now." }, { status: 500 })
  }
}
