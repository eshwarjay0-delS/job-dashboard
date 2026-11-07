// What the submission tracker keeps on the server, and the one place a
// submission follow-up is sent for a person.
//
// The rules are in submission-track.ts (which reuses the interview gate in
// interview-track.ts). Here: which submissions the person handed over ("Yes,
// send it for me every week"), kept in one small file per person
// (mail/submissions/<userId>.json); and `sendSubmissionFollowUps`, which the
// daily job calls. It sends only what `toSendForYou` allows: a submission the
// person switched this on for, still waiting for news, a week since the last
// word, at most four times, never to one of their own recruiters. Each send
// is written down before the next is considered, so a job that runs twice
// cannot send twice.
import { blob } from "@/lib/storage"
import { fetchClassifiedThreads, buildApplicationChains, TRACKING_DAYS, type ClassifiedThread, type ApplicationChain } from "@/app/api/gmail/_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { emptyState, noteSent, toSendForYou, dueButUnsent, effectiveHand, withHand, validState, type TrackState } from "@/lib/interview-track"
import { trackSubmissions, submissionWords, submissionId } from "@/lib/submission-track"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

// Board sends go from jayeshwar44 (28 Oct 2026): follow-ups send from
// jayeshwar44, not eshwarjay05. If that inbox is not connected at send time,
// the submission's own inbox is the fallback — a send that goes out from the
// thread's home beats a send that never goes out.
const BOARD_SENDER = "jayeshwar44@gmail.com"

const keyOf = (userId: string): string => `mail/submissions/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function readSubmissionTrackState(userId: string): Promise<TrackState> {
  try { const raw = await blob.getText(keyOf(userId)); return raw ? validState(JSON.parse(raw)) : emptyState() } catch { return emptyState() }
}
export async function writeSubmissionTrackState(userId: string, state: TrackState): Promise<void> {
  await blob.put(keyOf(userId), JSON.stringify(validState(state)))
}

function encode(to: string, subject: string, body: string): string {
  // The same message the Interviews tab sends: its subject says what it follows up on.
  const mime = [`To: ${to}`, `Subject: ${subject.replace(/[\r\n]+/g, " ")}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

/** The account a submission follow-up goes out from: jayeshwar44 when it is connected, else the submission's own inbox. */
async function senderToken(userId: string, accounts: Awaited<ReturnType<typeof listGoogleWorkspaceAccounts>>, chainAccount: string): Promise<string | null> {
  const account = accounts.find(a => a.google_email.toLowerCase() === BOARD_SENDER && a.gmail_enabled)
    || accounts.find(a => a.google_email.toLowerCase() === chainAccount.toLowerCase() && a.gmail_enabled)
  return account ? getGoogleWorkspaceAccessToken(userId, account.id) : null
}

/**
 * Send the submission follow-ups that are due for one person, on their standing word. Returns how many went out, and
 * the armed cards looked at but not sent — so a day with no sends still leaves a trace of what was due and why it stayed.
 * A person who handed nothing over costs one small read and nothing else: no mail is fetched.
 */
export async function sendSubmissionFollowUps(userId: string, myName: string, now = Date.now()): Promise<{ sent: number; failed: number; dueButUnsent: { id: string; reason: string }[] }> {
  let state = await readSubmissionTrackState(userId)
  if (!state.handed.some(h => h.on)) return { sent: 0, failed: 0, dueButUnsent: [] }
  const [{ threads }, accounts, recruiters] = await Promise.all([fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 }), listGoogleWorkspaceAccounts(userId), readRecruiters(userId)])
  const chains = buildApplicationChains(threads)
  const { active } = trackSubmissions(chains, state, now, { recruiter: email => isMyRecruiter(recruiters, email) })
  const chainById = new Map(chains.map(c => [submissionId(c), c]))
  const threadOf = new Map(active.map(t => [t.id, t.threadId]))
  const unsent = dueButUnsent(active, state, now, "submission")
  let sent = 0, failed = 0
  for (const t of toSendForYou(active, state, now)) {
    const chain = chainById.get(t.id)
    const token = await senderToken(userId, accounts, t.account)
    if (!token || !t.contact || !chain) { failed++; continue }
    // Prefer user-edited words when present — an earlier round's edited words carry to a new round; fall back to the generated draft.
    const hand = effectiveHand(state, t.id, t.threadId, threadOf)
    const words = hand?.subject && hand?.body ? { subject: hand.subject, body: hand.body } : submissionWords(chain, t.contact, myName)
    if (!words) { failed++; continue }
    // Written down first so a job that runs twice cannot send twice — but a definite Gmail
    // refusal rolls it straight back, exactly as the tap path does. A refused automatic send
    // must never show as Last sent, and must never consume one of the four; the next run
    // tries it again instead. Only the ambiguous timeout below keeps its count, because the
    // mail may still have gone out during it. A card that only inherited its switch gets its hand
    // recorded first, or the send would have nowhere to count against.
    state = noteSent(withHand(state, t.id, t.threadId, threadOf, now), t.id, now, true)
    await writeSubmissionTrackState(userId, state)
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Sent as a message of its own, as the reply box on the site sends: its subject says what it follows up on.
        body: JSON.stringify({ raw: encode(t.contact.email, words.subject, words.body) }), signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) sent++
      else {
        failed++
        console.error("[submissions] a follow-up was refused", res.status)
        try {
          state = { ...state, handed: state.handed.map(x => (x.id === t.id ? { ...x, sent: x.sent.slice(0, -1), ...(x.sentAuto ? { sentAuto: x.sentAuto.slice(0, -1) } : {}) } : x)) }
          await writeSubmissionTrackState(userId, state)
        } catch {}
      }
    } catch (error) { failed++; console.error("[submissions] a follow-up could not be sent", String(error).slice(0, 200)) }
  }
  return { sent, failed, dueButUnsent: unsent }
}

/**
 * Send one submission follow-up right now, on the person's tap — not on the daily check's schedule. It still counts: it
 * goes only to a submission still waiting, with a contact who is not one of their own recruiters. The four-count binds
 * only the automatic weekly send — a tap is his word to carry on past four, so no count check here. Ticked days
 * do not bind it; the tap is the schedule. It is send-once-only: it works
 * whether or not sending was switched on for the submission, and it never switches the weekly on — that stays the
 * "Yes, send it for me every week" tap alone. A card that only inherited its switch keeps it, so the weekly
 * carries on after a tap; a card never switched on gets a switched-off record that only counts the send.
 * The send is written down before the mail goes out, exactly as the daily job does, so it can never go twice.
 * A plain re-tap within the hour of a recorded send is a double-tap, not a new send: it is skipped outright,
 * so a slow button plus a reload can never mail the same follow-up three times. The skip is reported back
 * (skipped: true) so the board never claims a fresh send for it. A reworded send still goes out,
 * because new words are a new intent.
 * Verified against the board's kept copy, so the tap answers at once; the live scan is only the fallback for a
 * submission the kept copy missed.
 */
export async function sendSubmissionFollowUpNow(userId: string, myName: string, id: string, wordsIn?: { subject: string; body: string }, now = Date.now(), threadsIn?: ClassifiedThread[]): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const state0 = await readSubmissionTrackState(userId)
  const hand = state0.handed.find(h => h.id === id)
  // Send-once-only: no switch is needed, and none is switched on by this tap. The four-count binds only the automatic weekly send — a tap carries on past four. Only the hour's double-tap guard still binds it.
  // A plain re-tap within the hour of a recorded send is a double-tap, not a new send: skip it.
  if (!wordsIn?.subject && !wordsIn?.body && hand?.sent.some(at => now - at < 60 * 60 * 1000)) return { ok: true, skipped: true }
  const [accounts, recruiters] = await Promise.all([listGoogleWorkspaceAccounts(userId), readRecruiters(userId)])
  const verify = (threads: ClassifiedThread[]) => {
    const chains = buildApplicationChains(threads)
    const t = trackSubmissions(chains, state0, now, { recruiter: email => isMyRecruiter(recruiters, email) }).active.find(x => x.id === id)
    if (!t) return undefined
    return { t, chain: chains.find(c => submissionId(c) === id) as ApplicationChain }
  }
  // The board's kept copy verifies the tap at once; the live scan is only the fallback for a submission the kept copy missed.
  let found = threadsIn ? verify(threadsIn) : undefined
  let threadsUsed = threadsIn
  if (!found) {
    const { threads } = await fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 })
    threadsUsed = threads
    found = verify(threads)
  }
  if (!found || found.t.phase !== "waiting" || found.t.theyWrote || !found.t.contact || found.t.contact.recruiter) return { ok: false, error: "This submission cannot be followed up right now." }
  const { t, chain } = found
  const contact = found.t.contact
  const token = await senderToken(userId, accounts, t.account)
  if (!token) return { ok: false, error: "That inbox is not connected right now." }
  const threadOf = new Map(buildApplicationChains(threadsUsed || []).map(c => [submissionId(c), c.threadId]))
  // Prefer user-edited words when present — an earlier round's edited words carry to a new round; fall back to the generated draft.
  const eff = effectiveHand(state0, id, t.threadId, threadOf)
  const words = wordsIn?.subject && wordsIn?.body
    ? { subject: wordsIn.subject.slice(0, 200), body: wordsIn.body.slice(0, 2000) }
    : eff?.subject && eff?.body ? { subject: eff.subject, body: eff.body } : submissionWords(chain, t.contact, myName)
  if (!words) return { ok: false, error: "This submission cannot be followed up right now." }
  // Written down first, and edited words saved with it when the person reworded it on the way to this tap. A card with no hand of its own gets one recorded first — switched off unless it inherited the switch — or the send would have nowhere to count against.
  let state = noteSent(withHand(state0, id, t.threadId, threadOf, now), id, now)
  if (wordsIn?.subject && wordsIn?.body) state = { ...state, handed: state.handed.map(x => (x.id === id ? { ...x, subject: words.subject, body: words.body } : x)) }
  await writeSubmissionTrackState(userId, state)
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encode(contact.email, words.subject, words.body) }), signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) return { ok: true }
    console.error("[submissions] a send-now follow-up was refused", res.status)
    // A definite refusal means Gmail answered and no mail went out, so the recorded send is
    // rolled back: a refused tap must never show as sent, and must never block the retry with
    // the hour's double-tap guard. Only the ambiguous case below (timeout, where the mail may
    // still have gone out) keeps the count.
    let rolledBack = false
    try {
      await writeSubmissionTrackState(userId, { ...state, handed: state.handed.map(x => (x.id === id ? { ...x, sent: x.sent.slice(0, -1) } : x)) })
      rolledBack = true
    } catch {}
    return { ok: false, error: rolledBack
      ? "Gmail refused that send just now. Nothing was counted, so you can try again."
      : "Gmail refused that send just now. It is still counted, so it will not go twice." }
  } catch (error) {
    console.error("[submissions] a send-now follow-up could not be sent", String(error).slice(0, 200))
    return { ok: false, error: "That send could not go out just now. It is still counted, so it will not go twice." }
  }
}
