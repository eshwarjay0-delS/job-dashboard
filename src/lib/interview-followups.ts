// What the interview tracker keeps on the server, and the one place a follow-up is sent for a person.
//
// The rules are in interview-track.ts. Here: the person's own marks (rejected, completed) and which interviews they
// handed over ("send one for me every week"), kept in one small file per person; and `sendInterviewFollowUps`, which
// the daily job calls. It sends only what `toSendForYou` allows: an interview the person switched this on for, still
// waiting for news, a week since the last word, at most four times, never to one of their own recruiters. Each send is
// written down before the next is considered, so a job that runs twice cannot send twice.
import { blob } from "@/lib/storage"
import { fetchClassifiedThreads, threadsToInterviews, TRACKING_DAYS } from "@/app/api/gmail/_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { emptyState, followUpWords, noteSent, toSendForYou, trackInterviews, validState, type TrackState } from "@/lib/interview-track"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

const keyOf = (userId: string): string => `mail/interviews/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function readTrackState(userId: string): Promise<TrackState> {
  try { const raw = await blob.getText(keyOf(userId)); return raw ? validState(JSON.parse(raw)) : emptyState() } catch { return emptyState() }
}
export async function writeTrackState(userId: string, state: TrackState): Promise<void> {
  await blob.put(keyOf(userId), JSON.stringify(validState(state)))
}

function encode(to: string, subject: string, body: string): string {
  const mime = [`To: ${to}`, `Subject: ${subject.replace(/[\r\n]+/g, " ")}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

/**
 * Send the follow-ups that are due for one person, on their standing word. Returns how many went out.
 * A person who handed nothing over costs one small read and nothing else: no mail is fetched.
 */
export async function sendInterviewFollowUps(userId: string, myName: string, now = Date.now()): Promise<{ sent: number; failed: number }> {
  let state = await readTrackState(userId)
  if (!state.handed.some(h => h.on)) return { sent: 0, failed: 0 }
  const [{ threads }, accounts, recruiters] = await Promise.all([fetchClassifiedThreads(userId, { days: TRACKING_DAYS, max: 100 }), listGoogleWorkspaceAccounts(userId), readRecruiters(userId)])
  const mine = accounts.map(a => a.google_email)
  const { active } = trackInterviews(threadsToInterviews(threads), threads, mine, now, { state, recruiter: email => isMyRecruiter(recruiters, email) })
  let sent = 0, failed = 0
  for (const t of toSendForYou(active, state, now)) {
    const account = accounts.find(a => a.google_email.toLowerCase() === t.account && a.gmail_enabled)
    const token = account ? await getGoogleWorkspaceAccessToken(userId, account.id) : null
    if (!token || !t.contact) { failed++; continue }
    // Prefer user-edited words when present; fall back to the generated draft.
    const hand = state.handed.find(h => h.id === t.id)
    const words = hand?.subject && hand?.body ? { subject: hand.subject, body: hand.body } : followUpWords(t, myName)
    // Written down first: if the send then fails it is not tried again today, and it can never go twice.
    state = noteSent(state, t.id, now)
    await writeTrackState(userId, state)
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Sent as a message of its own, as the reply box on the site sends: its subject says what it follows up on.
        body: JSON.stringify({ raw: encode(t.contact.email, words.subject, words.body) }), signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) sent++; else { failed++; console.error("[interviews] a follow-up was refused", res.status) }
    } catch (error) { failed++; console.error("[interviews] a follow-up could not be sent", String(error).slice(0, 200)) }
  }
  return { sent, failed }
}
