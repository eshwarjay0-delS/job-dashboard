// Submission follow-ups: the Interviews tab's follow-up machinery, pointed at
// Overview submission chains instead of interviews (7 Nov 2026, owner ask).
//
// A submission chain is one application thread, keyed the same way interviews
// are: `${accountEmail}:${threadId}`. Its follow-up state lives in its own
// small file per person (mail/submissions/<userId>.json) so it never collides
// with interview state — but the state shape (TrackState), the decisions
// (decide), the send counting (noteSent), the inherited switch (effectiveHand /
// withHand) and the daily-job gate (toSendForYou / dueButUnsent) are the
// interview ones, reused as-is. The adapted chain is a Tracked with phase
// "waiting" while the submission is open and "past" once the mail says offer
// or rejected, so the gate never learns a second copy of its rules.
//
// The cadence is the Interviews tab's: the first follow-up five days after the
// last word on the chain, then a week after each word, at most four automatic
// sends, never two within six days, only on ticked ring days. A manual Send
// now is never blocked by the four-count — a tap is his word to carry on
// past four — and never switches the weekly on by itself.

import {
  decide,
  noteSent,
  toSendForYou,
  dueButUnsent,
  followUpWords,
  effectiveHand,
  withHand,
  FIRST_AFTER_DAYS,
  EVERY_DAYS,
  MOST_SENT_FOR_YOU,
  OLD_AFTER_DAYS,
  dayList,
  ringDays,
  cleanDays,
  DEFAULT_DAYS,
  type Tracked,
  type TrackState,
  type Reach,
} from "./interview-track.ts"
import type { ApplicationChain, ChainStageKey } from "../app/api/gmail/_lib"

export { decide, noteSent, toSendForYou, dueButUnsent, effectiveHand, withHand, cleanDays, DEFAULT_DAYS, MOST_SENT_FOR_YOU }
export type { Tracked, TrackState, Reach }

const DAY = 86_400_000
const firstName = (name: string): string => String(name || "").trim().split(/\s+/)[0] || "them"
const dayWord = (at: number): string => new Date(at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
const days = (n: number): string => (n === 1 ? "1 day" : `${n} days`)
const looksLikeEmail = (v?: string): boolean => !!v && v.includes("@")

/** The id a submission is tracked under: the chain's inbox and thread. */
export const submissionId = (chain: ApplicationChain): string => `${chain.accountEmail}:${chain.threadId}`

/** The stage filter on the Overview list: every stage, or one stage. */
export function filterChainsByStage(chains: ApplicationChain[], stage: ChainStageKey | "all"): ApplicationChain[] {
  if (stage === "all") return chains
  return chains.filter(c => c.current === stage)
}

/**
 * Owner priority order for the Overview "All" list (7 Nov 2026): Interview
 * first, then With client, then Submitted, then RTR, then everything else
 * (Decision, or a chain with no known stage). Within one stage, most recent
 * activity first. The page keeps its two sections, so this orders the rows
 * inside each section; closed Decision rows sit at the bottom of the
 * Submission progress list, above the RTRs in Waiting to board.
 */
export const STAGE_PRIORITY: Record<ChainStageKey, number> = {
  interview: 0,
  client: 1,
  submitted: 2,
  rtr: 3,
  decision: 4,
}
/** The Stage dropdown lists its options in the same priority order. */
export const STAGE_OPTIONS_PRIORITY: ChainStageKey[] = ["interview", "client", "submitted", "rtr", "decision"]
export function compareChainsByStagePriority(a: ApplicationChain, b: ApplicationChain): number {
  const pa = STAGE_PRIORITY[a.current] ?? 4
  const pb = STAGE_PRIORITY[b.current] ?? 4
  if (pa !== pb) return pa - pb
  return (b.lastActivity || 0) - (a.lastActivity || 0)
}

/**
 * Who the follow-up goes to: the person who last wrote about this submission,
 * matched to a contact with a real email address. Falls back to the contact
 * with the most mail on the chain. No emailable contact, no follow-up.
 */
export function submissionContact(chain: ApplicationChain, isRecruiter?: (email: string) => boolean): Reach | null {
  const events = chain.events || []
  const lastFromThem = [...events].reverse().find(e => !e.isMe && e.fromEmail)
  const byEmail = new Map((chain.contacts || []).filter(c => looksLikeEmail(c.email)).map(c => [String(c.email).toLowerCase(), c]))
  const match = lastFromThem?.fromEmail ? byEmail.get(lastFromThem.fromEmail.toLowerCase()) : undefined
  const picked = match || [...byEmail.values()].sort((a, b) => b.emails - a.emails)[0]
  if (!picked?.email) return null
  const email = picked.email
  return {
    name: picked.name || lastFromThem?.from || "",
    email,
    company: chain.company || "",
    phones: picked.phone ? [picked.phone] : [],
    recruiter: isRecruiter ? isRecruiter(email) : false,
  }
}

/**
 * The words for a stage, in his words. RTR, Submitted and With client each
 * carry his own question; Interview and Decision reuse the Interviews tab
 * follow-up verbatim. A closed submission (offer or rejected) has no words:
 * there is nothing to follow up.
 */
export function submissionWords(chain: ApplicationChain, contact: Reach | null, myFirstName: string): { subject: string; body: string } | null {
  if (chain.terminal) return null
  const hello = contact?.name ? `Hi ${firstName(contact.name)},` : "Hi,"
  const about = `${chain.role ? `the ${chain.role} role` : "the role"}${chain.company ? ` at ${chain.company}` : ""}`
  const subject = `Following up: ${chain.role || "submission"}${chain.company ? `, ${chain.company}` : ""}`.slice(0, 150)
  const sign = `Thank you,\n${myFirstName || ""}`.trim()
  if (chain.current === "rtr") {
    return { subject, body: `${hello}\n\nI wanted to check in on ${about} — for this position, any updates from the client?\n\n${sign}` }
  }
  if (chain.current === "submitted") {
    return { subject, body: `${hello}\n\nI wanted to check in on ${about} — did the client like my profile? Any updates yet so far?\n\n${sign}` }
  }
  if (chain.current === "client") {
    return { subject, body: `${hello}\n\nI wanted to check in on ${about}. Please share my availability with the client, and let me know if there is any update on the interview. I am available for interviews Monday to Thursday, 9 AM to 3 PM CST.\n\n${sign}` }
  }
  // Interview and Decision are the same phase: the Interviews tab words, verbatim.
  const interviewAt = chain.stops.find(s => s.key === "interview")?.at || chain.lastActivity || 0
  return followUpWords({ role: chain.role, company: chain.company, contact, at: interviewAt, timeKnown: !!chain.stops.find(s => s.key === "interview")?.at }, myFirstName)
}

/**
 * Why Send now cannot go out for this submission, in plain words — or "" when
 * it can. The four-count is deliberately not here: it binds only the
 * automatic weekly send, never a manual tap.
 */
export function submissionSendNowBlockReason(t: { terminal: ApplicationChain["terminal"]; contact: Reach | null; theyWrote: boolean }): string {
  if (t.theyWrote) return "The recruiter wrote last, so there is nothing to follow up right now."
  if (t.contact?.recruiter) return "This contact is one of your own recruiters, so nothing is sent to them."
  if (!t.contact) return "There is no outside contact to follow up with on this submission."
  if (t.terminal) return "This submission is closed, so Send now can't go out."
  return ""
}

/**
 * Each chain as a Tracked the interview gate already understands: waiting
 * while open, past once the mail says offer or rejected. The one calm
 * sentence, who to write to, and what he can choose — the same shape the
 * Interviews tab shows, with submission wording.
 */
export function trackSubmissions(chains: ApplicationChain[], state: TrackState, now: number, opts?: { recruiter?: (email: string) => boolean }): { active: Tracked[]; past: Tracked[]; due: number } {
  const threadOf = new Map(chains.map(c => [submissionId(c), c.threadId]))
  const out: Tracked[] = []
  for (const chain of chains) {
    const id = submissionId(chain)
    const threadId = chain.threadId
    const account = chain.accountEmail
    const contact = submissionContact(chain, opts?.recruiter)
    const events = chain.events || []
    const last = events[events.length - 1]
    const theyWrote = !!last && !last.isMe
    const lastNonMeAt = Math.max(0, ...events.filter(e => !e.isMe).map(e => e.at))
    const mineAfter = events.filter(e => e.isMe && e.at > lastNonMeAt)
    const myLastAt = Math.max(0, ...events.filter(e => e.isMe).map(e => e.at))
    const anchor = chain.lastActivity || (events.length ? events[events.length - 1].at : 0)
    const terminal = chain.terminal
    const phase = terminal ? "past" : "waiting"
    const hand = effectiveHand(state, id, threadId, threadOf)
    const sentForYou = hand?.sent?.length || 0
    // The next follow-up: five days after the last word on the chain, then a
    // week after each time he (or the app, for him) wrote.
    const lastWord = Math.max(myLastAt, ...(hand?.sent || []))
    const nextAt = phase !== "waiting" || theyWrote || !anchor ? 0 : lastWord ? lastWord + EVERY_DAYS * DAY : anchor + FIRST_AFTER_DAYS * DAY
    const since = anchor ? Math.floor((now - anchor) / DAY) : 0
    const old = phase === "waiting" && !theyWrote && since > OLD_AFTER_DAYS
    const carried = phase === "waiting" && !theyWrote && !!contact?.recruiter
    const due = phase === "waiting" && !theyWrote && !old && !carried && nextAt > 0 && now >= nextAt
    const name = firstName(contact?.name || chain.holder || "")
    const sending = !!hand?.on && phase === "waiting" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter && !!nextAt

    let say: string, action: Tracked["action"] = "none"
    if (phase === "past") say = terminal === "rejected" ? `Not going ahead. Marked on ${dayWord(anchor)}, and no longer followed.` : `Offer received. Marked on ${dayWord(anchor)}, and no longer followed.`
    else if (theyWrote) { say = `${name === "them" ? "They" : name} wrote to you about this submission. Read it and answer.`; action = "reply" }
    else if (carried) say = `Your recruiter ${name} is carrying this one. There is nothing for you to chase.`
    else if (sending) say = `I send ${name} a short follow-up for you on ${dayList(ringDays(hand?.days))} until there is news.`
    else if (old) say = `This submission has had no news for ${days(since)}. I am not asking you to chase it.`
    else if (due) { say = mineAfter.length || sentForYou ? `It has been ${days(Math.floor((now - lastWord) / DAY))} since the last follow-up and there is no news yet. Another short, friendly one to ${name} is a good idea.` : `No news on this submission for ${days(since)} yet. A short, friendly follow-up to ${name} is a good idea.`; action = "follow_up" }
    else say = mineAfter.length || sentForYou ? `You followed up ${days(Math.max(0, Math.floor((now - lastWord) / DAY)))} ago. Nothing to do now; I will bring it back on ${dayWord(nextAt)}.` : `No news since ${dayWord(anchor)}. It is normal to hear nothing yet. I will bring it back on ${dayWord(nextAt)}.`

    out.push({
      id, threadId, account, role: chain.role, company: chain.company, kind: "", at: anchor, timeKnown: !!anchor, phase, days: since, contact, lastMine: !theyWrote, theyWrote,
      followUps: mineAfter.length + sentForYou, due: due && !sending, nextAt: old || carried ? 0 : nextAt, say, old, action,
      ...(terminal ? { outcome: terminal === "rejected" ? "rejected" : "completed", decidedAt: anchor } : {}),
      ...(hand ? { forYou: { on: sending || (hand.on && phase !== "past" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter), sent: sentForYou, sentAt: [...(hand.sent || [])], nextAt: sending ? nextAt : 0, days: ringDays(hand.days), ...(hand.on && theyWrote ? { ended: "answered" as const } : hand.on && sentForYou >= MOST_SENT_FOR_YOU ? { ended: "limit" as const } : {}) } } : {}),
    })
  }
  const rank = (t: Tracked) => (t.action === "reply" ? 0 : t.action === "follow_up" ? 1 : t.old ? 3 : 2)
  const active = out.filter(t => t.phase !== "past").sort((a, b) => rank(a) - rank(b) || (b.at - a.at))
  const past = out.filter(t => t.phase === "past").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))
  return { active, past, due: active.filter(t => t.action !== "none").length }
}
