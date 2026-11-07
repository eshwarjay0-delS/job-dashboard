// What the interview tracker keeps on the server, and the one place a follow-up is sent for a person.
//
// The rules are in interview-track.ts. Here: the person's own marks (rejected, completed) and which interviews they
// handed over ("send one for me every week"), kept in one small file per person; and `sendInterviewFollowUps`, which
// the daily job calls. It sends only what `toSendForYou` allows: an interview the person switched this on for, still
// waiting for news, a week since the last word, at most four times, never to one of their own recruiters. Each send is
// written down before the next is considered, so a job that runs twice cannot send twice.
import { blob } from "@/lib/storage"
import { fetchClassifiedThreads, threadsToInterviews, TRACKING_DAYS, type ClassifiedThread } from "@/app/api/gmail/_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { emptyState, followUpWords, noteSent, toSendForYou, trackInterviews, validState, dueButUnsent, effectiveHand, withHand, type TrackState } from "@/lib/interview-track"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

const keyOf = (userId: string): string => `mail/interviews/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function readTrackState(userId: string): Promise<TrackState> {
  try { const raw = await blob.getText(keyOf(userId)); return raw ? validState(JSON.parse(raw)) : emptyState() } catch { return emptyState() }
}
export async function writeTrackState(userId: string, state: TrackState): Promise<void> {
  await blob.put(keyOf(userId), JSON.stringify(validState(state)))
}

/** One daily watchdog run, as the board and the owner can read it: when it ran, how many people it checked, what went out, what was due and stayed, and what failed. A day with no sends is a record with zeros, never silence. */
export type WatchdogRunUser = { sent: number; failed: number; dueButUnsent: { id: string; reason: string }[]; error?: string; submissions?: { sent: number; failed: number; dueButUnsent: { id: string; reason: string }[]; error?: string } }
export type WatchdogRun = { at: number; usersChecked: number; users: Record<string, WatchdogRunUser> }
/** The latest run for one person, as the interview-track answer carries it. */
export type WatchdogRunSummary = { at: number; usersChecked: number; sent: number; failed: number; dueButUnsent: { id: string; reason: string }[]; error?: string; submissions?: { sent: number; failed: number; dueButUnsent: { id: string; reason: string }[]; error?: string } }
const watchdogKey = "mail/interviews/watchdog-latest.json"
export async function writeWatchdogRun(run: WatchdogRun): Promise<void> {
  try { await blob.put(watchdogKey, JSON.stringify(run)) } catch { /* the run still went out; the record is only the trace */ }
}
export async function readWatchdogRun(userId: string): Promise<WatchdogRunSummary | null> {
  try {
    const raw = await blob.getText(watchdogKey)
    if (!raw) return null
    const run = JSON.parse(raw) as WatchdogRun
    const u = run.users?.[userId]
    if (!u) return null
    return { at: run.at, usersChecked: run.usersChecked, sent: u.sent, failed: u.failed, dueButUnsent: Array.isArray(u.dueButUnsent) ? u.dueButUnsent : [], ...(u.error ? { error: u.error } : {}), ...(u.submissions ? { submissions: u.submissions } : {}) }
  } catch { return null }
}

function encode(to: string, subject: string, body: string): string {
  const mime = [`To: ${to}`, `Subject: ${subject.replace(/[\r\n]+/g, " ")}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

/**
 * Send the follow-ups that are due for one person, on their standing word. Returns how many went out, and the armed
 * cards looked at but not sent — so a day with no sends still leaves a trace of what was due and why it stayed.
 * A person who handed nothing over costs one small read and nothing else: no mail is fetched.
 */
export async function sendInterviewFollowUps(userId: string, myName: string, now = Date.now()): Promise<{ sent: number; failed: number; dueButUnsent: { id: string; reason: string }[] }> {
  let state = await readTrackState(userId)
  if (!state.handed.some(h => h.on)) return { sent: 0, failed: 0, dueButUnsent: [] }
  const [{ threads }, accounts, recruiters] = await Promise.all([fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 }), listGoogleWorkspaceAccounts(userId), readRecruiters(userId)])
  const mine = accounts.map(a => a.google_email)
  const { active } = trackInterviews(threadsToInterviews(threads), threads, mine, now, { state, recruiter: email => isMyRecruiter(recruiters, email) })
  const threadOf = new Map(active.map(t => [t.id, t.threadId]))
  const unsent = dueButUnsent(active, state, now)
  let sent = 0, failed = 0
  for (const t of toSendForYou(active, state, now)) {
    const account = accounts.find(a => a.google_email.toLowerCase() === t.account && a.gmail_enabled)
    const token = account ? await getGoogleWorkspaceAccessToken(userId, account.id) : null
    if (!token || !t.contact) { failed++; continue }
    // Prefer user-edited words when present — an earlier round's edited words carry to a new round; fall back to the generated draft.
    const hand = effectiveHand(state, t.id, t.threadId, threadOf)
    const words = hand?.subject && hand?.body ? { subject: hand.subject, body: hand.body } : followUpWords(t, myName)
    // Written down first so a job that runs twice cannot send twice — but a definite Gmail
    // refusal rolls it straight back, exactly as the tap path does. A refused automatic send
    // must never show as Last sent, and must never consume one of the four; the next run
    // tries it again instead. Only the ambiguous timeout below keeps its count, because the
    // mail may still have gone out during it. A card that only inherited its switch gets its hand
    // recorded first, or the send would have nowhere to count against.
    state = noteSent(withHand(state, t.id, t.threadId, threadOf, now), t.id, now)
    await writeTrackState(userId, state)
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Sent as a message of its own, as the reply box on the site sends: its subject says what it follows up on.
        body: JSON.stringify({ raw: encode(t.contact.email, words.subject, words.body) }), signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) sent++
      else {
        failed++
        console.error("[interviews] a follow-up was refused", res.status)
        try {
          state = { ...state, handed: state.handed.map(x => (x.id === t.id ? { ...x, sent: x.sent.slice(0, -1) } : x)) }
          await writeTrackState(userId, state)
        } catch {}
      }
    } catch (error) { failed++; console.error("[interviews] a follow-up could not be sent", String(error).slice(0, 200)) }
  }
  return { sent, failed, dueButUnsent: unsent }
}

/**
 * Send one follow-up right now, on the person's tap — not on the daily check's schedule. It still counts: it goes
 * only to an interview still waiting, with a contact who is not one of their own recruiters. The four-count binds
 * only the automatic weekly send — a tap is his word to carry on past four, so no count check here. Ticked days
 * do not bind it; the tap is the schedule. It is send-once-only: it works
 * whether or not sending was switched on for the interview, and it never switches the weekly on — that stays the
 * "Yes, send it for me every week" tap alone. A card that only inherited its switch keeps it, so the weekly
 * carries on after a tap; a card never switched on gets a switched-off record that only counts the send.
 * The send is written down before the mail goes out, exactly as the daily job does, so it can never go twice.
 * A plain re-tap within the hour of a recorded send is a double-tap, not a new send: it is skipped outright,
 * so a slow button plus a reload can never mail the same follow-up three times. The skip is reported back
 * (skipped: true) so the board never claims a fresh send for it. A reworded send still goes out,
 * because new words are a new intent.
 * Verified against the board's kept copy, so the tap answers at once; the live scan is only the fallback for an
 * interview the kept copy missed.
 */
export async function sendInterviewFollowUpNow(userId: string, myName: string, id: string, wordsIn?: { subject: string; body: string }, now = Date.now(), threadsIn?: ClassifiedThread[]): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const state0 = await readTrackState(userId)
  const hand = state0.handed.find(h => h.id === id)
  // Send-once-only: no switch is needed, and none is switched on by this tap. The four-count binds only the automatic weekly send — a tap carries on past four. Only the hour's double-tap guard still binds it.
  // A plain re-tap within the hour of a recorded send is a double-tap, not a new send: skip it.
  if (!wordsIn?.subject && !wordsIn?.body && hand?.sent.some(at => now - at < 60 * 60 * 1000)) return { ok: true, skipped: true }
  const [accounts, recruiters] = await Promise.all([listGoogleWorkspaceAccounts(userId), readRecruiters(userId)])
  const mine = accounts.map(a => a.google_email)
  const verify = (threads: ClassifiedThread[]) => trackInterviews(threadsToInterviews(threads), threads, mine, now, { state: state0, recruiter: email => isMyRecruiter(recruiters, email) }).active.find(x => x.id === id)
  // The board's kept copy verifies the tap at once; the live scan is only the fallback for an interview the kept copy missed.
  let t = threadsIn ? verify(threadsIn) : undefined
  let threadsUsed = threadsIn
  if (!t) {
    const { threads } = await fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 })
    threadsUsed = threads
    t = verify(threads)
  }
  if (!t || t.phase !== "waiting" || t.theyWrote || !t.contact || t.contact.recruiter) return { ok: false, error: "This interview cannot be followed up right now." }
  const account = accounts.find(a => a.google_email.toLowerCase() === t.account && a.gmail_enabled)
  const token = account ? await getGoogleWorkspaceAccessToken(userId, account.id) : null
  if (!token) return { ok: false, error: "That inbox is not connected right now." }
  const threadOf = new Map(threadsToInterviews(threadsUsed || []).map(f => [f.id, String(f.threadId || "")]))
  // Prefer user-edited words when present — an earlier round's edited words carry to a new round; fall back to the generated draft.
  const eff = effectiveHand(state0, id, t.threadId, threadOf)
  const words = wordsIn?.subject && wordsIn?.body
    ? { subject: wordsIn.subject.slice(0, 200), body: wordsIn.body.slice(0, 2000) }
    : eff?.subject && eff?.body ? { subject: eff.subject, body: eff.body } : followUpWords(t, myName)
  // Written down first, and edited words saved with it when the person reworded it on the way to this tap. A card with no hand of its own gets one recorded first — switched off unless it inherited the switch — or the send would have nowhere to count against.
  let state = noteSent(withHand(state0, id, t.threadId, threadOf, now), id, now)
  if (wordsIn?.subject && wordsIn?.body) state = { ...state, handed: state.handed.map(x => (x.id === id ? { ...x, subject: words.subject, body: words.body } : x)) }
  await writeTrackState(userId, state)
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encode(t.contact.email, words.subject, words.body) }), signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) return { ok: true }
    console.error("[interviews] a send-now follow-up was refused", res.status)
    // A definite refusal means Gmail answered and no mail went out, so the recorded send is
    // rolled back: a refused tap must never consume one of the four sends. Only the ambiguous
    // case below (timeout, where the mail may still have gone out) keeps the count.
    let rolledBack = false
    try {
      await writeTrackState(userId, { ...state, handed: state.handed.map(x => (x.id === id ? { ...x, sent: x.sent.slice(0, -1) } : x)) })
      rolledBack = true
    } catch {}
    return { ok: false, error: rolledBack
      ? "Gmail refused that send just now. Nothing was counted, so you can try again."
      : "Gmail refused that send just now. It is still counted, so it will not go twice." }
  } catch (error) {
    console.error("[interviews] a send-now follow-up could not be sent", String(error).slice(0, 200))
    return { ok: false, error: "That send could not go out just now. It is still counted, so it will not go twice." }
  }
}
