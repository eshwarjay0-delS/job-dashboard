// The interview tracker (src/lib/interview-track.ts): every interview the mail proves, kept in view until the person
// says how it ended.
//
//   GET  -> { ok, active: [...], past: [...], due, canSendForYou, words: { [id]: { subject, body } } }
//           active: coming up, today, or waiting for news, each with one sentence, who to write to and how to reach
//           them, and when the next follow-up is a good idea. past: marked rejected or completed, no longer followed.
//   POST { id, action }  action: "rejected" | "completed" | "reopen" | "send_for_me" | "stop_sending"
//           | "save_words" | "set_days" | "send_now"  -> the same answer as GET, after the choice.
// "send_for_me" is the person's standing word that a short follow-up may be sent for them once a week until there is
// news (the daily job sends it: src/lib/interview-followups.ts). The exact words are in `words`, shown before they say yes.
// "save_words" rewords what is sent without switching it on or off; "set_days" ticks the weekdays the automatic send
// may ring on (empty clears back to any day); "send_now" sends one follow-up at once, on the person's tap, and counts
// toward the four. The automatic send obeys the ticks; a manual send does not.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, threadsToInterviews, enrichInterviewEvidence, scheduleInterviewDiscovery, TRACKING_DAYS, type AuthContext } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { decide, followUpWords, trackInterviews, cleanDays } from "@/lib/interview-track"
import { readTrackState, writeTrackState, sendInterviewFollowUpNow } from "@/lib/interview-followups"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const ACTIONS = new Set(["rejected", "completed", "reopen", "send_for_me", "stop_sending", "save_words", "set_days", "send_now"])

async function answer(ctx: AuthContext) {
  const { data: { user } } = await ctx.supabase.auth.getUser()
  const [kept, recruiters, state] = await Promise.all([keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true }), readRecruiters(ctx.userId), readTrackState(ctx.userId)])
  const threads = await enrichInterviewEvidence(ctx.userId, kept.threads).catch(() => kept.threads)
  // Discovery for interviews the kept copy missed runs behind this answer, never inside it.
  scheduleInterviewDiscovery(ctx.userId, threads)
  const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
  const out = trackInterviews(threadsToInterviews(threads), threads, mine, Date.now(), { state, recruiter: email => isMyRecruiter(recruiters, email) })
  const meta = (user?.user_metadata || {}) as { full_name?: string; name?: string }
  const myName = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0] || ""
  const words: Record<string, { subject: string; body: string }> = {}
  for (const t of out.active) {
    if (t.phase !== "waiting" || !t.contact) continue
    // Prefer user-edited words when present; fall back to the generated draft.
    const hand = state.handed.find(h => h.id === t.id)
    words[t.id] = hand?.subject && hand?.body ? { subject: hand.subject, body: hand.body } : followUpWords(t, myName)
  }
  // Sending for the person needs the site's daily job to be running. Said, so the switch never promises what will not happen.
  const canSendForYou = (process.env.CRON_SECRET || "").length >= 16 || (process.env.WATCHDOG_CRON_SECRET || "").length >= 32
  return { ok: true, kept: kept.kept, ...out, words, canSendForYou }
}

export async function GET() {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`interview-track:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    return NextResponse.json(await answer(ctx), PRIVATE)
  } catch (err) {
    console.error("gmail/interview-track error:", err)
    return NextResponse.json({ ok: false, error: "Your interviews could not be read just now." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`interview-track:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; ids?: unknown; action?: unknown; subject?: unknown; body?: unknown; days?: unknown }
    const action = String(body.action || "")
    // One interview, or several at once ("they are all over") for marking only.
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(v => String(v || "").slice(0, 300)).filter(Boolean).slice(0, 60)
    if (!ids.length || !ACTIONS.has(action) || (ids.length > 1 && action !== "completed" && action !== "rejected")) return NextResponse.json({ ok: false, error: "Choose an interview and what to do with it." }, { status: 400 })
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
      const sent = await sendInterviewFollowUpNow(ctx.userId, myName, ids[0], customWords)
      if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error || "That send could not go out just now." }, { status: 400 })
      return NextResponse.json(await answer(ctx), PRIVATE)
    }
    let state = await readTrackState(ctx.userId)
    const now = Date.now()
    for (const id of ids) state = decide(state, id, action as Parameters<typeof decide>[2], now, customWords, days)
    await writeTrackState(ctx.userId, state)
    return NextResponse.json(await answer(ctx), PRIVATE)
  } catch (err) {
    console.error("gmail/interview-track error:", err)
    return NextResponse.json({ ok: false, error: "That could not be saved just now." }, { status: 500 })
  }
}
