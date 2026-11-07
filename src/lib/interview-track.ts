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
// MEASURED ON THE OWNER'S OWN MAIL, 13 Oct 2026, the hour this shipped. The first version said a follow-up was "a good
// idea" for 12 of his 15 open interviews. Eight of them were 63 to 83 days old with not a word since, and one was to a
// person on his own recruiter list. Twelve cards asking for something is the wall he asked not to see. So: after this
// many days of silence an interview is set apart as old, and he is only asked whether it is over; and nobody is ever
// told to follow up with their own recruiter.
export const OLD_AFTER_DAYS = 35

export type Outcome = "rejected" | "completed"
export type Mark = { id: string; outcome: Outcome; at: number }
export type Handed = { id: string; on: boolean; at: number; sent: number[]; sentAuto?: number[]; subject?: string; body?: string; days?: number[] }
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
  old: boolean             // long past with nothing since: set apart, and only asked whether it is over
  action: "none" | "reply" | "follow_up"
  outcome?: Outcome
  decidedAt?: number
  forYou?: { on: boolean; sent: number; sentAt: number[]; nextAt: number; ended?: "answered" | "limit"; days?: number[] }
}

const first = (name: string): string => String(name || "").trim().split(/\s+/)[0] || "them"
const dayWord = (at: number): string => new Date(at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
/** Short weekday names indexed like getUTCDay (0 = Sunday). Shared by the day ticks and the copy that names them. */
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
/** The Chicago calendar day of a moment, as YYYY-MM-DD — the day the person lives in. The daily job runs at 07:00 his time, so a follow-up due later that same day is due that day, not the next morning. */
export const chicagoDay = (at: number): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at))
/** The days an automatic send rings on when none were ticked: Monday and Thursday, his standing default (28 Oct 2026). */
export const DEFAULT_DAYS = [1, 4]
/** The days a send may ring on: the ticked ones, or Monday and Thursday when none were ticked. */
export const ringDays = (days?: number[]): number[] => (days?.length ? days : [...DEFAULT_DAYS])
export const dayList = (days: number[]): string => [...days].sort((a, b) => a - b).map(d => DAY_SHORT[d] || "").filter(Boolean).join(", ")
/** The weekday the person lives in: the daily check runs once a day, and a ticked day means that weekday for him. */
export const weekdayForHim = (now: number): number => {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(new Date(now))
  return Math.max(0, DAY_SHORT.indexOf(short))
}
/** Only real weekdays survive, each once, at most seven. Anything else in a stored record is ignored. */
export const cleanDays = (v: unknown): number[] => (Array.isArray(v) ? v : [])
  .filter(n => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6)
  .filter((n, i, a) => a.indexOf(n) === i).slice(0, 7) as number[]
const days = (n: number): string => (n === 1 ? "1 day" : `${n} days`)

export function validState(raw: unknown): TrackState {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<TrackState>
  const id = (v: unknown) => (typeof v === "string" && v.length <= 300 ? v : "")
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0)
  const marks = (Array.isArray(src.marks) ? src.marks : []).filter(m => m && id(m.id) && (m.outcome === "rejected" || m.outcome === "completed")).map(m => ({ id: m.id, outcome: m.outcome, at: num(m.at) })).slice(-400)
  const handed = (Array.isArray(src.handed) ? src.handed : []).filter(h => h && id(h.id)).map(h => {
    const days = cleanDays(h.days)
    // The edited words are part of the hand: without them, a saved rewording would not survive a write and read, and the daily job would always send the generated draft.
    const subject = typeof h.subject === "string" ? h.subject.slice(0, 200) : ""
    const body = typeof h.body === "string" ? h.body.slice(0, 2000) : ""
    // sentAuto counts only the automatic weekly sends: the four-count binds the automatic send, never a manual tap.
    // A hand written before sentAuto existed has no list, so it falls back to all sends (autoSent) — the old count.
    // An empty list is kept when it is there: it means the hand has been through the split with zero automatic
    // sends, which is not the same as a hand written before the split.
    const hasSentAuto = Array.isArray(h.sentAuto)
    const sentAuto = (Array.isArray(h.sentAuto) ? h.sentAuto : []).map(num).filter(Boolean).slice(-MOST_SENT_FOR_YOU * 2)
    return { id: h.id, on: h.on === true, at: num(h.at), sent: (Array.isArray(h.sent) ? h.sent : []).map(num).filter(Boolean).slice(-MOST_SENT_FOR_YOU * 2), ...(hasSentAuto ? { sentAuto } : {}), ...(days.length ? { days } : {}), ...(subject ? { subject } : {}), ...(body ? { body } : {}) }
  }).slice(-400)
  return { marks, handed }
}

/** The state after one choice of the person's. Marking an outcome also ends anything being sent for them. */
export function decide(state: TrackState, id: string, action: "rejected" | "completed" | "reopen" | "send_for_me" | "stop_sending" | "save_words" | "set_days", now: number, words?: { subject: string; body: string }, days?: number[]): TrackState {
  const marks = state.marks.filter(m => m.id !== id), handed = state.handed.filter(h => h.id !== id)
  const had = state.handed.find(h => h.id === id)
  if (action === "rejected" || action === "completed") return { marks: [...marks, { id, outcome: action, at: now }], handed: had ? [...handed, { ...had, on: false }] : handed }
  if (action === "reopen") return { marks, handed: state.handed }
  if (action === "send_for_me") return { marks: state.marks, handed: [...handed, { id, on: true, at: now, sent: had?.sent || [], ...(had?.sentAuto ? { sentAuto: had.sentAuto } : {}), ...(words ? { subject: words.subject.slice(0, 200), body: words.body.slice(0, 2000) } : {}), ...(days !== undefined ? { days: cleanDays(days) } : had?.days?.length ? { days: had.days } : {}) }] }
  // Rewording what is sent, or re-ticking its days, never switches it on or off and never forgets what went out.
  if (action === "save_words") return { marks: state.marks, handed: [...handed, { ...had, id, on: had?.on ?? false, at: had?.at ?? now, sent: had?.sent || [], ...(words ? { subject: words.subject.slice(0, 200), body: words.body.slice(0, 2000) } : {}), ...(days !== undefined ? { days: cleanDays(days) } : {}) }] }
  if (action === "set_days") return { marks: state.marks, handed: [...handed, { ...had, id, on: had?.on ?? false, at: had?.at ?? now, sent: had?.sent || [], days: cleanDays(days) }] }
  // Stopping is always recorded, even for a card that only inherited its switch: without a switched-off record of its own, the inherited switch would carry on and the stop would do nothing.
  return { marks: state.marks, handed: [...handed, { ...(had || { id, at: now, sent: [] }), on: false }] }
}
/** How many automatic weekly sends went out for this hand. A hand with no sentAuto list yet was written before the
 * split, so every send it recorded counts — the old, stricter count, never a free extra send. */
export const autoSent = (hand?: Handed | null): number => hand?.sentAuto ? hand.sentAuto.length : (hand?.sent.length || 0)

/** Record one send. A manual Send now goes only on `sent`: it never consumes one of the four automatic sends. An
 * automatic send goes on both lists, so the four-count sees it. A hand written before the split has no sentAuto
 * list: the first send on it freezes the count — a manual tap freezes sentAuto to the sends already recorded (those
 * were all automatic under the old counting), an automatic send seeds sentAuto from them and appends. Either way the
 * old count is kept, not forgotten, and no manual tap after the split ever lands in it. */
export const noteSent = (state: TrackState, id: string, now: number, auto = false): TrackState => ({ marks: state.marks, handed: state.handed.map(h => (h.id === id ? { ...h, sent: [...h.sent, now], ...(auto ? { sentAuto: [...(h.sentAuto ?? h.sent), now] } : h.sentAuto ? {} : { sentAuto: [...h.sent] }) } : h)) })

/** The hand that governs one interview: its own, or the one an earlier round in the same thread left armed. A new round inherits the switch, the ring days and the edited words — never the sends already made, which stay with the old round and its own count of four. `threadOf` maps interview id to thread id, from the interviews in view. */
export function effectiveHand(state: TrackState, id: string, threadId: string, threadOf: Map<string, string>): Handed | undefined {
  const own = state.handed.find(h => h.id === id)
  if (own) return own
  if (!threadId) return undefined
  const donor = state.handed.find(h => h.id !== id && h.on && threadOf.get(h.id) === threadId)
  if (!donor) return undefined
  return { id, on: true, at: donor.at, sent: [], ...(donor.subject ? { subject: donor.subject } : {}), ...(donor.body ? { body: donor.body } : {}), ...(donor.days?.length ? { days: [...donor.days] } : {}) }
}
/** The state with a hand recorded for one interview: the effective hand when there is one, otherwise a switched-off record that only counts sends. A send is never recorded against an interview with no hand at all, or the count would be lost and the next run would send again. */
export function withHand(state: TrackState, id: string, threadId: string, threadOf: Map<string, string>, now: number): TrackState {
  if (state.handed.some(h => h.id === id)) return state
  const eff = effectiveHand(state, id, threadId, threadOf)
  return { ...state, handed: [...state.handed, eff ? { ...eff, sent: [] } : { id, on: false, at: now, sent: [] }] }
}

/** Why Send now cannot go out for this card, in the server's own gate order — or "" when it can.
 * The four-count is not a reason here: the automatic weekly stops at four, but a tap is his word
 * to carry on, so a manual Send now always goes past four. What still blocks a tap is a card the
 * server must refuse (interview not waiting yet, recruiter wrote last, no outside contact). The
 * board keeps the button visible and names the reason beside it when one of those applies. The
 * hour's double-tap guard is not a reason here: it is a skip, and the board names it as one when
 * it happens. */
export function sendNowBlockReason(t: { phase: Phase; contact: Reach | null; theyWrote: boolean }): string {
  if (t.theyWrote) return "The recruiter wrote last, so there is nothing to follow up right now."
  if (t.contact?.recruiter) return "This contact is one of your own recruiters, so nothing is sent to them."
  if (!t.contact) return "There is no outside contact to follow up with on this card."
  if (t.phase === "coming") return "This interview hasn't happened yet, so Send now can't go out."
  if (t.phase === "today") return "This interview is today, so Send now can't go out yet."
  if (t.phase !== "waiting") return "This interview isn't waiting for news right now, so Send now can't go out."
  return ""
}

type Opts = { state?: TrackState; recruiter?: (email: string) => boolean }

/** Every proven interview in its place: the ones still open (what needs him first, then the soonest), and the past. */
export function trackInterviews(found: Found[], threads: OverviewThread[], myEmails: string[], now: number, opts: Opts = {}): { active: Tracked[]; past: Tracked[]; due: number } {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const state = opts.state || emptyState()
  const byThread = new Map((threads || []).map(t => [`${String(t.accountEmail || "").toLowerCase()}:${t.threadId}`, t] as const))
  // Interview id to thread id, so a new round can inherit the armed hand an earlier round in the same thread left behind.
  const threadOf = new Map((found || []).map(f => [f.id, String(f.threadId || "")] as const))
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
    const mark = state.marks.find(m => m.id === f.id), hand = effectiveHand(state, f.id, threadId, threadOf)
    // The four-count sees only the automatic sends; the sentence and the count of follow-ups see every send.
    const sentForYou = autoSent(hand)
    const sentAll = hand?.sent.length || 0

    const startOfToday = Math.floor(now / DAY) * DAY
    const phase: Phase = mark ? "past" : at >= startOfToday + DAY ? "coming" : at >= startOfToday && at > now - 3 * 3_600_000 ? "today" : "waiting"
    const since = Math.max(0, Math.floor((now - at) / DAY)), until = Math.max(0, Math.ceil((at - now) / DAY))
    // The next follow-up: a few days after the interview, then a week after each time he (or the app, for him) wrote.
    const lastWord = Math.max(myLastAt > at ? myLastAt : 0, ...(hand?.sent || []))
    const nextAt = phase !== "waiting" || theyWrote ? 0 : lastWord ? lastWord + EVERY_DAYS * DAY : at + FIRST_AFTER_DAYS * DAY
    // Long past with nothing from them since: no more follow-ups are suggested. And his own recruiter is never chased.
    const old = phase === "waiting" && !theyWrote && since > OLD_AFTER_DAYS
    const carried = phase === "waiting" && !theyWrote && !!contact?.recruiter
    const due = phase === "waiting" && !theyWrote && !old && !carried && nextAt > 0 && now >= nextAt
    const name = first(contact?.name || f.with || "")
    const when = timeKnown ? `${dayWord(at)}` : `around ${dayWord(at)}`

    let say: string, action: Tracked["action"] = "none"
    const sending = !!hand?.on && phase === "waiting" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter && !!nextAt
    if (phase === "past") say = mark!.outcome === "rejected" ? `Not going ahead. Marked on ${dayWord(mark!.at)}, and no longer followed.` : `Finished. Marked on ${dayWord(mark!.at)}, and no longer followed.`
    else if (phase === "coming") say = `Your interview is on ${when}, in ${days(until)}. Nothing to do but be ready.`
    else if (phase === "today") say = "Your interview is today. Good luck. I will keep an eye on what comes after."
    else if (theyWrote) { say = `${name === "them" ? "They" : name} wrote to you after the interview. Read it and answer.`; action = "reply" }
    else if (carried) say = `Your recruiter ${name} is carrying this one. There is nothing for you to chase.`
    else if (sending) say = `I send ${name} a short follow-up for you on ${dayList(ringDays(hand?.days))} until there is news.`
    else if (old) say = `Your interview was ${days(since)} ago and nothing has come since. If it is over, tell me and I will stop following it.`
    else if (due) { say = mineAfter.length || sentAll ? `It has been ${days(Math.floor((now - lastWord) / DAY))} since the last follow-up and there is no news yet. Another short, friendly one to ${name} is a good idea.` : `Your interview was ${days(since)} ago and there is no news yet. A short, friendly follow-up to ${name} is a good idea.`; action = "follow_up" }
    else say = mineAfter.length || sentAll ? `You followed up ${days(Math.max(0, Math.floor((now - lastWord) / DAY)))} ago. Nothing to do now; I will bring it back on ${dayWord(nextAt)}.` : `Your interview was ${since === 0 ? "today" : `${days(since)} ago`}. It is normal to hear nothing yet. I will bring it back on ${dayWord(nextAt)}.`

    out.push({
      id: f.id, threadId, account, role: f.role, company: f.company, kind: f.kind || "", at, timeKnown, phase, days: phase === "coming" ? until : since, contact, lastMine, theyWrote,
      followUps: mineAfter.length + sentAll, due: due && !sending, nextAt: old || carried ? 0 : nextAt, say, old, action,
      ...(mark ? { outcome: mark.outcome, decidedAt: mark.at } : {}),
      ...(hand ? { forYou: { on: sending || (hand.on && phase !== "past" && !theyWrote && sentForYou < MOST_SENT_FOR_YOU && !contact?.recruiter), sent: sentForYou, sentAt: [...(hand.sent || [])], nextAt: sending ? nextAt : 0, days: ringDays(hand.days), ...(hand.on && theyWrote ? { ended: "answered" as const } : hand.on && sentForYou >= MOST_SENT_FOR_YOU ? { ended: "limit" as const } : {}) } } : {}),
    })
  }
  const rank = (t: Tracked) => (t.action === "reply" ? 0 : t.action === "follow_up" ? 1 : t.phase === "today" ? 2 : t.phase === "coming" ? 3 : t.old ? 5 : 4)
  const active = out.filter(t => t.phase !== "past").sort((a, b) => rank(a) - rank(b) || (a.phase === "coming" ? a.at - b.at : b.at - a.at))
  const past = out.filter(t => t.phase === "past").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))
  return { active, past, due: active.filter(t => t.action !== "none").length }
}

/** The interviews a follow-up is to be sent for now, on the person's standing word. Never to one of their own recruiters. Due means due on his calendar day: the daily job runs at 07:00 his time, so a follow-up due at noon is due that morning, not the next day the ring days allow. */
export function toSendForYou(active: Tracked[], state: TrackState, now: number): Tracked[] {
  const threadOf = new Map(active.map(t => [t.id, t.threadId]))
  return active.filter(t => {
    const hand = effectiveHand(state, t.id, t.threadId, threadOf)
    if (!hand?.on || t.phase !== "waiting" || t.theyWrote || !t.contact || t.contact.recruiter) return false
    if (autoSent(hand) >= MOST_SENT_FOR_YOU || !t.nextAt || chicagoDay(t.nextAt) > chicagoDay(now)) return false
    // Ticked days are the only days the automatic send may ring on; with none ticked it is Monday and Thursday. A manual Send now is not bound by them.
    if (!ringDays(hand.days).includes(weekdayForHim(now))) return false
    // Never two within six days, whatever else is true.
    return !hand.sent.some(at => now - at < 6 * DAY)
  })
}

/** Armed cards the daily job looked at but did not send, with the reason in plain words — so a day with no sends can be told apart from a day with nothing due. A card the job sends is never in this list. */
export function dueButUnsent(active: Tracked[], state: TrackState, now: number, what = "interview"): { id: string; reason: string }[] {
  const threadOf = new Map(active.map(t => [t.id, t.threadId]))
  const out: { id: string; reason: string }[] = []
  for (const t of active) {
    const hand = effectiveHand(state, t.id, t.threadId, threadOf)
    if (!hand?.on || t.phase !== "waiting" || t.theyWrote || !t.contact || t.contact.recruiter) continue
    if (autoSent(hand) >= MOST_SENT_FOR_YOU) { out.push({ id: t.id, reason: `Four automatic follow-ups already sent for this ${what}.` }); continue }
    if (!t.nextAt || chicagoDay(t.nextAt) > chicagoDay(now)) continue
    if (!ringDays(hand.days).includes(weekdayForHim(now))) { out.push({ id: t.id, reason: `Today is not one of its ring days (${dayList(ringDays(hand.days))}).` }); continue }
    if (hand.sent.some(at => now - at < 6 * DAY)) { out.push({ id: t.id, reason: "A follow-up went out less than six days ago." }); continue }
  }
  return out
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
