// Every interview, kept in view until the person says how it ended.
//
// Asked on 13 Oct 2026: "the interview session, it needs a lot of organizing and more history ... it was just showcasing
// like one at each time ... if we [had] an interview, we have to keep on following up with them about the next rounds and
// next updates. So interviews are really important. Unless a user have selected it was rejected or completed. And once
// they have selected that, it would go under the past interviews and no longer be tracked ... after the interview was
// happened about these many days, you basically suggest the user ... to send a follow up since it's been a decent amount
// of days ... give the contact information of the recruiter who had given you the interview ... a five-year-old [can]
// follow up and not in a way that they feel so obnoxious and super anxious ... like AI got you ... it can be delegated if
// they want ... weekly ones ... automatic follow up on behalf of the user ... Just by asking the user what they wanted
// to do and it would be done."
//
// This file is the rules only (no storage, no network, no model). An interview is one the mail proves (a calendar
// invite, a meeting link, a confirmation: decided elsewhere, in threadsToInterviews). Here it is given its place:
// coming up, waiting for news, or past; one calm sentence saying what to do, if anything; who to write to and how to
// reach them; and when the next follow-up is due. Nothing is ever said to be late: a follow-up is "a good idea".

import { senderEmail, senderName, readThread, contactsOf, isMachine } from "./mail-reading.ts"
import { companyOf, type OverviewThread } from "./mail-overview.ts"

const DAY = 86_400_000
/** Days of silence after an interview before a first follow-up is suggested, and between follow-ups after that. */
export const FIRST_AFTER_DAYS = 5
export const EVERY_DAYS = 7
/** A follow-up sent for the person, at most this many times for one interview. Then they are asked again. */
export const MOST_SENT_FOR_YOU = 4

export type Outcome = "rejected" | "completed"
export type Mark = { id: string; outcome: Outcome; at: number }
export type Handed = { id: string; on: boolean; at: number; sent: number[] }
export type TrackState = { marks: Mark[]; handed: Handed[] }
export const emptyState = (): TrackState => ({ marks: [], handed: [] })

/** What is needed of an interview the mail proved (the shape threadsToInterviews gives). */
export type Found = { id: string; threadId?: string; account?: string; role: string; company: string; kind?: string; ts?: number; requestTs?: number; with?: string }
export type Reach = { name: string; email: string; company: string; phones: string[]; recruiter: boolean }
export type Phase = "coming" | "today" | "waiting" | "past"
export interface Tracked {
  id: string; threadId: string; account: string; role: string; company: string; kind: string
  at: number               // when the interview is or was; when it was confirmed, if the mail gave no time
  timeKnown: boolean
  phase: Phase
  days: number             // days until it (coming), or days since it (waiting, past)
  contact: Reach | null    // who to write to about it: whoever arranged it
  lastMine: boolean        // the last word in the conversation is the person's own
  theyWrote: boolean       // they have written since the interview and since the person last wrote
  followUps: number        // times the person has written since the interview
  due: boolean             // a follow-up is a good idea now
  nextAt: number           // when the next follow-up becomes a good idea (0 when none is planned)
  say: string              // one calm sentence
  action: "none" | "reply" | "follow_up"
  outcome?: Outcome
  decidedAt?: number
  forYou?: { on: boolean; sent: number; nextAt: number; ended?: "answered" | "limit" }
}

const first = (name: string): string => String(name || "").trim().split(/\s+/)[0] || "them"
const dayWord = (at: number): string => new Date(at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
const days = (n: number): string => (n === 1 ? "1 day" : `${n} days`)

export function validState(raw: unknown): TrackState {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<TrackState>
  const id = (v: unknown) => (typeof v === "string" && v.length <= 300 ? v : "")
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0)
  const marks = (Array.isArray(src.marks) ? src.marks : []).filter(m => m && id(m.id) && (m.outcome === "rejected" || m.outcome === "completed")).map(m => ({ id: m.id, outcome: m.outcome, at: num(m.at) })).slice(-400)
  const handed = (Array.isArray(src.handed) ? src.handed : []).filter(h => h && id(h.id)).map(h => ({ id: h.id, on: h.on === true, at: num(h.at), sent: (Array.isArray(h.sent) ? h.sent : []).map(num).filter(Boolean).slice(-MOST_SENT_FOR_YOU * 2) })).slice(-400)
  return { marks, handed }
}

/** The state after one choice of the person's. Marking an outcome also ends anything being sent for them. */
export function decide(state: TrackState, id: string, action: "rejected" | "completed" | "reopen" | "send_for_me" | "stop_sending", now: number): TrackState {
  const marks = state.marks.filter(m => m.id !== id), handed = state.handed.filter(h => h.id !== id)
  const had = state.handed.find(h => h.id === id)
  if (action === "rejected" || action === "completed") return { marks: [...marks, { id, outcome: action, at: now }], handed: had ? [...handed, { ...had, on: false }] : handed }
  if (action === "reopen") return { marks, handed: state.handed }
  if (action === "send_for_me") return { marks: state.marks, handed: [...handed, { id, on: true, at: now, sent: had?.sent || [] }] }
  return { marks: state.marks, handed: had ? [...handed, { ...had, on: false }] : handed }
}
export const noteSent = (state: TrackState, id: string, now: number): TrackState => ({ marks: state.marks, handed: state.handed.map(h => (h.id === id ? { ...h, sent: [...h.sent, now] } : h)) })

type Opts = { state?: TrackState; recruiter?: (email: string) => boolean }

/** Every proven interview in its place: the ones still open (what needs him first, then the soonest), and the past. */
export function trackInterviews(found: Found[], threads: OverviewThread[], myEmails: string[], now: number, opts: Opts = {}): { active: Tracked[]; past: Tracked[]; due: number } {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const state = opts.state || emptyState()
  const byThread = new Map((threads || []).map(t => [`${String(t.accountEmail || "").toLowerCase()}:${t.threadId}`, t] as const))
  const out: Tracked[] = []
  for (const f of found || []) {
    const account = String(f.account || "").toLowerCase(), threadId = String(f.threadId || "")
    const thread = byThread.get(`${account}:${threadId}`)
    const at = Number(f.ts || f.requestTs || 0)
    if (!at) continue
    const timeKnown = !!f.ts
    const ordered = thread ? [...thread.messages].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0)) : []
    const people = ordered.filter(m => { const e = senderEmail(m.from); return e && !me.has(e) && !isMachine(e) })
    // Who to write to: the last person who wrote about it, a person and not a calendar robot. One of his own recruiters
    // is not chased when someone else is in the conversation.
    const isRec = (email: string) => !!opts.recruiter?.(email)
    const lastPerson = [...people].reverse().find(m => !isRec(senderEmail(m.from))) || people[people.length - 1]
    let contact: Reach | null = null
    if (lastPerson && thread) {
      const email = senderEmail(lastPerson.from), reading = readThread(thread, [...me])
      const who = reading.messages.find(m => m.email === email)?.who
      contact = { name: senderName(lastPerson.from), email, company: companyOf(email), phones: contactsOf(reading).phones.filter(p => p.who === who).map(p => p.number).slice(0, 2), recruiter: isRec(email) }
    }
    const after = ordered.filter(m => Number(m.internalDate || 0) > at)
    const mineAfter = after.filter(m => me.has(senderEmail(m.from)))
    const myLastAt = Math.max(0, ...ordered.filter(m => me.has(senderEmail(m.from))).map(m => Number(m.internalDate || 0)))
    const theirLast = [...people].reverse()[0]
    const theirLastAt = Number(theirLast?.internalDate || 0)
    const theyWrote = theirLastAt > at && theirLastAt > myLastAt
    const lastMine = ordered.length ? me.has(senderEmail(ordered[ordered.length - 1].from)) : false
    const mark = state.marks.find(m => m.id === f.id), hand = state.handed.find(h => h.id === f.id)
    const sentForYou = hand?.sent.length || 0

    const startOfToday = Math.floor(now / DAY) * DAY
    const phase: Phase = mark ? "past" : at >= startOfToday + DAY ? "coming" : at >= startOfToday && at > now - 3 * 3_600_000 ? "today" : "waiting"
    const since = Math.max(0, Math.floor((now - at) / DAY)), until = Math.max(0, Math.ceil((at - now) / DAY))
    // The next follow-up: a few days after the interview, then a week after each time he (or the app, for him) wrote.
    const lastWord = Math.max(myLastAt > at ? myLastAt : 0, ...(hand?.sent || []))
    const nextAt = phase !== "waiting" || theyWrote ? 0 : lastWord ? lastWord + EVERY_DAYS * DAY : at + FIRST_AFTER_DAYS * DAY
    const due = phase === "waiting" && !theyWrote && nextAt > 0 && now >= nextAt
    const name = first(contact?.name || f.with || "")
    const when = timeKnown ? `${dayWord(at)}` : `around ${dayWord(at)}`

    let say: string, action: Tracked["action"] = "none"
    const sending = !!hand?.on && phase === "waiting" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter
    if (phase === "past") say = mark!.outcome === "rejected" ? `Not going ahead. Marked on ${dayWord(mark!.at)}, and no longer followed.` : `Finished. Marked on ${dayWord(mark!.at)}, and no longer followed.`
    else if (phase === "coming") say = `Your interview is on ${when}, in ${days(until)}. Nothing to do but be ready.`
    else if (phase === "today") say = "Your interview is today. Good luck. I will keep an eye on what comes after."
    else if (theyWrote) { say = `${name === "them" ? "They" : name} wrote to you after the interview. Read it and answer.`; action = "reply" }
    else if (sending) say = due ? `I am sending ${name} a short follow-up for you. It goes out with the next daily check.` : `I send ${name} a short follow-up for you every week until there is news. The next one is on ${dayWord(nextAt)}.`
    else if (due) { say = mineAfter.length || sentForYou ? `It has been ${days(Math.floor((now - lastWord) / DAY))} since the last follow-up and there is no news yet. Another short, friendly one to ${name} is a good idea.` : `Your interview was ${days(since)} ago and there is no news yet. A short, friendly follow-up to ${name} is a good idea.`; action = "follow_up" }
    else say = mineAfter.length || sentForYou ? `You followed up ${days(Math.max(0, Math.floor((now - lastWord) / DAY)))} ago. Nothing to do now; I will bring it back on ${dayWord(nextAt)}.` : `Your interview was ${since === 0 ? "today" : `${days(since)} ago`}. It is normal to hear nothing yet. I will bring it back on ${dayWord(nextAt)}.`

    out.push({
      id: f.id, threadId, account, role: f.role, company: f.company, kind: f.kind || "", at, timeKnown, phase, days: phase === "coming" ? until : since, contact, lastMine, theyWrote,
      followUps: mineAfter.length + sentForYou, due: due && !sending, nextAt, say, action,
      ...(mark ? { outcome: mark.outcome, decidedAt: mark.at } : {}),
      ...(hand ? { forYou: { on: sending || (hand.on && phase !== "past" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter), sent: sentForYou, nextAt: sending ? nextAt : 0, ...(hand.on && theyWrote ? { ended: "answered" as const } : hand.on && sentForYou >= MOST_SENT_FOR_YOU ? { ended: "limit" as const } : {}) } } : {}),
    })
  }
  const rank = (t: Tracked) => (t.action === "reply" ? 0 : t.action === "follow_up" ? 1 : t.phase === "today" ? 2 : t.phase === "coming" ? 3 : 4)
  const active = out.filter(t => t.phase !== "past").sort((a, b) => rank(a) - rank(b) || (a.phase === "coming" ? a.at - b.at : b.at - a.at))
  const past = out.filter(t => t.phase === "past").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))
  return { active, past, due: active.filter(t => t.action !== "none").length }
}

/** The interviews a follow-up is to be sent for now, on the person's standing word. Never to one of their own recruiters. */
export function toSendForYou(active: Tracked[], state: TrackState, now: number): Tracked[] {
  return active.filter(t => {
    const hand = state.handed.find(h => h.id === t.id)
    if (!hand?.on || t.phase !== "waiting" || t.theyWrote || !t.contact || t.contact.recruiter) return false
    if (hand.sent.length >= MOST_SENT_FOR_YOU || !t.nextAt || now < t.nextAt) return false
    // Never two within six days, whatever else is true.
    return !hand.sent.some(at => now - at < 6 * DAY)
  })
}

/** The few words of a follow-up: short, friendly, nothing invented. Shown to the person before anything is sent for them. */
export function followUpWords(t: Pick<Tracked, "role" | "company" | "contact" | "at" | "timeKnown">, myFirstName: string): { subject: string; body: string } {
  const hello = t.contact?.name ? `Hi ${first(t.contact.name)},` : "Hi,"
  const about = `${t.role ? `the ${t.role} role` : "the role"}${t.company ? ` at ${t.company}` : ""}`
  const when = t.timeKnown ? ` on ${dayWord(t.at)}` : ""
  return {
    subject: `Following up: ${t.role || "interview"}${t.company ? `, ${t.company}` : ""}`.slice(0, 150),
    body: `${hello}\n\nI wanted to follow up on my interview${when} for ${about}. I enjoyed the conversation and I am still very interested.\n\nIs there any update on the next steps? I am happy to share anything else that would help.\n\nThank you,\n${myFirstName || ""}`.trim(),
  }
}
