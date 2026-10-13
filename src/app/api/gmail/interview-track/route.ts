// The interview tracker (src/lib/interview-track.ts): every interview the mail proves, kept in view until the person
// says how it ended.
//
//   GET  -> { ok, active: [...], past: [...], due, canSendForYou, words: { [id]: { subject, body } } }
//           active: coming up, today, or waiting for news, each with one sentence, who to write to and how to reach
//           them, and when the next follow-up is a good idea. past: marked rejected or completed, no longer followed.
//   POST { id, action }  action: "rejected" | "completed" | "reopen" | "send_for_me" | "stop_sending"
//           -> the same answer as GET, after the choice.
// "send_for_me" is the person's standing word that a short follow-up may be sent for them once a week until there is
// news (the daily job sends it: src/lib/interview-followups.ts). The exact words are in `words`, shown before they say yes.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, threadsToInterviews, enrichInterviewEvidence, TRACKING_DAYS, type AuthContext } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { decide, followUpWords, trackInterviews } from "@/lib/interview-track"
import { readTrackState, writeTrackState } from "@/lib/interview-followups"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const ACTIONS = new Set(["rejected", "completed", "reopen", "send_for_me", "stop_sending"])

async function answer(ctx: AuthContext) {
  const { data: { user } } = await ctx.supabase.auth.getUser()
  const [kept, recruiters, state] = await Promise.all([keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true }), readRecruiters(ctx.userId), readTrackState(ctx.userId)])
  const threads = await enrichInterviewEvidence(ctx.userId, kept.threads).catch(() => kept.threads)
  const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
  const out = trackInterviews(threadsToInterviews(threads), threads, mine, Date.now(), { state, recruiter: email => isMyRecruiter(recruiters, email) })
  const meta = (user?.user_metadata || {}) as { full_name?: string; name?: string }
  const myName = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0] || ""
  const words: Record<string, { subject: string; body: string }> = {}
  for (const t of out.active) if (t.phase === "waiting" && t.contact) words[t.id] = followUpWords(t, myName)
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
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown }
    const id = String(body.id || "").slice(0, 300), action = String(body.action || "")
    if (!id || !ACTIONS.has(action)) return NextResponse.json({ ok: false, error: "Choose an interview and what to do with it." }, { status: 400 })
    const state = await readTrackState(ctx.userId)
    await writeTrackState(ctx.userId, decide(state, id, action as Parameters<typeof decide>[2], Date.now()))
    return NextResponse.json(await answer(ctx), PRIVATE)
  } catch (err) {
    console.error("gmail/interview-track error:", err)
    return NextResponse.json({ ok: false, error: "That could not be saved just now." }, { status: 500 })
  }
}
