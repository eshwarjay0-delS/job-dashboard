// What a person keeps doing by hand in their job mail, found from the mail itself. Pure functions: no network, no model.
//
// The owner, 12 Oct 2026: "in the follow-up pages, you basically show suggestions on what are the things that you are
// basically repeating yourself over and over again, and how we can help you with automating it, without you even
// defining what you might be needed to automate ... wherever that feels like a repeated task, taking that task off the
// user's hand and taking it as an agent's job."
//
// Nobody is asked to describe a rule. Three things are looked for, each only when it happened three times or more
// (four, before hiding someone is suggested):
//   same_reply      the same answer, written again and again, in nearly the same words
//   chase           writing a second time to someone who went quiet, and how long was waited before doing it
//   never_answered  a person who keeps writing and was never answered
// What is shown back is the person's OWN words (the most typical of the repeats), never a rewrite, and the count of times
// it happened with the conversations it happened in, so every suggestion can be checked against the mail.
//
// WHAT COUNTS AS "YOUR WORDS". Only what was typed above the quoted history of a message whose full text is kept. A
// reply with nothing typed (an attachment on its own, a bare forward) and a message of which only Gmail's first line is
// kept have no words of the person's that can be told apart from the other side's: they are counted as written and
// compared with nothing. The greeting (with the name of whoever it went to) and the signature are parted off, so the
// words kept for the next person never carry the last person's name.

import { senderEmail, senderName, ownPart, dropFooter, tidy, aboutOf, isMachine, saidNo } from "./mail-reading.ts"

export interface HabitThread {
  threadId: string
  accountEmail: string
  messages: Array<{ id: string; from: string; to?: string; cc?: string; subject: string; snippet: string; internalDate?: string; bodyText?: string; category?: string }>
}
export type HabitKind = "same_reply" | "chase" | "never_answered"
export type AskKind = "rate" | "availability" | "rtr" | "documents" | "requirement" | "outreach" | ""
export interface HabitExample { threadId: string; account: string; who: string; at: number; text: string }
export interface Habit {
  id: string               // stays the same while the habit does: a decision about it is kept under this
  kind: HabitKind
  count: number            // how many times
  people: number           // to, or from, how many different people
  lastAt: number
  title: string            // one plain sentence: what you keep doing
  offer: string            // one plain sentence: what would be taken over
  action: string           // the words on the button
  typical?: string         // your own words, as you most often wrote them
  greeting?: string        // "Hi", "Hello": how you open, kept so a prepared reply opens your way
  closing?: string         // your own sign-off lines
  when?: AskKind           // same_reply: what it answers
  days?: number            // chase: how long you usually wait
  worked?: number          // chase: how many of those times they answered afterwards
  quiet?: HabitExample[]   // chase: conversations that are past that wait right now
  sender?: { name: string; email: string; account: string }   // never_answered
  examples: HabitExample[] // the newest five times it happened
  anchor?: { account: string; thread: string; message: string }   // the message of yours the words were taken from
  state?: "on" | "off"     // a decision already made about it
  moved?: boolean          // the decision's message is no longer among the repeats: its pointer should move to `anchor`
}
/**
 * A decision the person made about a habit. It is kept with their account, and everything kept with an account rides in
 * the sign-in cookie on every request, so it holds NO words: only which message of theirs the words are (thread and
 * message), read again from the kept mail when they are needed. A decision is a few dozen bytes.
 */
export interface Decision {
  id: string; kind: HabitKind; state: "on" | "off"; at?: string
  when?: AskKind; days?: number; account?: string; thread?: string; message?: string
}
/** A decision with the words it points at, read back from the mail. */
export interface Kept extends Decision { text?: string; greeting?: string; closing?: string }
export interface Habits { looked: { conversations: number; written: number; days: number }; habits: Habit[] }

const DAY = 86_400_000
const HOUR = 3_600_000
export const TIMES = 3             // a thing is a habit from the third time, in three different conversations
const MOST_WRITTEN = 400           // the newest messages of the person's own that are compared with each other

const HELLO = /^(?:hi|hello|hey|dear|greetings|good (?:morning|afternoon|evening|day))(?![\p{L}\p{N}])/iu
// One word of who a greeting is to: a name, a title, or "and" between two names.
const WHO = /^\s+((?:mr|mrs|ms|dr)\.|[\p{L}][\p{L}'’-]*|&)/iu
const GROUP = new Set(["there", "all", "team", "everyone", "folks", "guys", "sir", "madam", "and", "&", "both"])
/**
 * How a line greets, if it does: "Hi Dana,", "hi priya", "Hi Dana and Omar,", "Dear Dr. Lind:".
 * "Hi Dana, my rate is ..." is a greeting and then an answer. It is parted after the mark, so the answer is not thrown
 * away with the greeting and the name of the person it once went to never ends up inside the words kept for the next
 * one. A line that only begins like a greeting ("Hello from the airport: I can talk after four", "Hi I am interested")
 * is an answer and is left whole.
 */
function greetingOf(line: string): { greeting: string; rest: string } | null {
  const hello = line.match(HELLO)
  if (!hello) return null
  let at = hello[0].length
  const who: string[] = []
  while (who.length < 5) { const m = line.slice(at).match(WHO); if (!m) break; who.push(m[1]!); at += m[0].length }
  // Names begin with a capital; with one or two words after the hello it is a name however it was typed ("hi priya").
  const named = who.length <= 2 || (who.length <= 4 && who.every(w => /^\p{Lu}/u.test(w) || GROUP.has(w.toLowerCase())))
  const tail = line.slice(at)
  if (!tail.trim()) return named ? { greeting: line.trim(), rest: "" } : null
  const mark = tail.match(/^\s*([,!.:–—-])\s*(.*)$/)
  if (!mark || !named) return null
  const rest = mark[2]!.trim()
  if (!rest) return { greeting: line.trim(), rest: "" }
  // After a colon or a full stop the line goes on as an answer only when what stood before was plainly a name.
  if ((mark[1] === ":" || mark[1] === ".") && who.length > 1 && !who.every(w => /^\p{Lu}/u.test(w) || GROUP.has(w.toLowerCase()))) return null
  return { greeting: line.slice(0, line.length - mark[2]!.length).trim(), rest }
}
const SIGNOFF = /^(?:thanks(?: (?:and|&) regards| a lot| so much| again)?|thank you(?: (?:so|very) much)?|many thanks|regards|best regards|best wishes|best|kind regards|warm regards|sincerely|cheers|respectfully|yours (?:truly|sincerely))[,.!]*$/i
const PHONE = /^(?:(?:phone|mobile|cell|ph|tel|direct|m|c|o)\s*[:#.-]?\s*)?\+?\(?\d[\d\s().-]{7,}\d(?:\s*(?:x|ext\.?)\s*\d+)?$/i
const CONTACT_LINE = /^(?:(?:email|e-mail|linkedin|web|website)\s*[:#-].*|https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+|sent from my .*|get outlook for .*)$/i
const isContact = (line: string) => PHONE.test(line) || CONTACT_LINE.test(line)
// A line of a signature is short and is not a sentence: a job title, a company, a phone written some other way.
const footLike = (line: string) => isContact(line) || (line.length <= 60 && !/[.?!]$/.test(line))
// Senders nobody answers by nature: a machine (isMachine), and a shared box such as jobs@ or careers@, whose receipt
// is not a recruiter being ignored. The word must be the whole name before the @ or a part set off by a dot or a dash:
// "jobrien@" and "teamlead.dana@" are people.
const SHARED_BOX = /^(?:jobs?|careers?|talent|recruiting|support|info|team|hello|admin)(?:[-_.+][^@]*)?@/i
// Mail that must never be suggested for hiding, whoever sent it.
const KEEP = new Set(["Interview Request", "Offer", "RTR Request", "Rate Confirmation", "Submission Confirmation", "Document Request", "Rejection"])
const ASK: Record<string, AskKind> = { "Rate Confirmation": "rate", "Interview Request": "availability", "RTR Request": "rtr", "Document Request": "documents", "Job Description": "requirement" }
const ADDRESS = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

const fold = (text: string): string => String(text || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
/** What a message of the person's own says, as they typed it: above the quoted history, without the legal notice. */
const typedIn = (m: { bodyText?: string }): string => (m.bodyText ? dropFooter(tidy(ownPart(m.bodyText))).text : "")

/** A message of the person's own, parted into how it opens, what it says, and how it is signed. Nothing is reworded. */
export function ownWords(said: string, myName = ""): { greeting: string; core: string; closing: string } {
  const lines = String(said || "").replace(/\r/g, "").split("\n").map(l => l.trim())
  let start = 0
  while (start < lines.length && !lines[start]) start++
  let greeting = ""
  const hello = start < lines.length ? greetingOf(lines[start]!) : null
  if (hello) {
    greeting = hello.greeting
    if (hello.rest) lines[start] = hello.rest
    else start++
  }
  // The name as it is signed: "Sam J. Carter" is the words sam and carter; an initial is not asked of either side.
  const mine = fold(myName).split(/[^a-z]+/).filter(w => w.length > 1)
  const isName = (line: string) => {
    const words = fold(line).split(/[^a-z]+/).filter(w => w.length > 1)
    return mine.length > 0 && words.length > 0 && words.length <= 4 && words.every(w => mine.includes(w))
  }
  // From the foot upwards: the phone number, the links and the name are the signature.
  let end = lines.length
  while (end > start && (!lines[end - 1] || isContact(lines[end - 1]!) || isName(lines[end - 1]!))) end--
  // A sign-off or the name a few lines further up, with only signature-like lines under it (a job title, a company): the
  // signature begins there. It is never taken as the signature when nothing at all was written above it.
  let under = true
  for (let i = end - 1, seen = 0; i >= start && seen < 8 && under; i--) {
    const line = lines[i]!
    if (!line) continue
    seen++
    if (SIGNOFF.test(line) || isName(line)) { if (lines.slice(start, i).some(Boolean)) end = i }
    else under = footLike(line)
  }
  while (end > start && !lines[end - 1]) end--
  // A message that is only a thank-you says nothing that could be repeated.
  if (end - start === 1 && SIGNOFF.test(lines[start]!)) end = start
  return {
    greeting,
    core: lines.slice(start, end).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    closing: lines.slice(end).filter(Boolean).slice(0, 6).join("\n"),
  }
}

interface Shape { words: string[]; set: Set<string>; pairs: Set<string>; head: Set<string> }
/** A text as something that can be compared: an amount is an amount whatever the figure, an address is an address. */
export function shapeOf(text: string): Shape {
  const words = fold(text)
    .replace(/https?:\/\/\S+|www\.\S+/g, " link ")
    .replace(/\S+@\S+\.\S+/g, " address ")
    .replace(/[$€£₹]?\s?\d[\d,.:/-]*\s?(?:k|%|\/\s?(?:hr|hour|h|yr|year))?/g, " number ")
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const pairs = new Set<string>()
  for (let i = 0; i + 1 < words.length; i++) pairs.add(words[i] + " " + words[i + 1])
  return { words, set: new Set(words), pairs, head: new Set(words.slice(0, 8)) }
}
const shared = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0
  let both = 0
  for (const x of a) if (b.has(x)) both++
  return both / (a.size + b.size - both)
}
/**
 * 1 or more means "nearly the same words". A short line must match almost word for word. A long one must match by its
 * phrases AND begin alike: two different answers that happen to end in the same long signature are not the same reply.
 */
export function alike(a: Shape, b: Shape): number {
  const short = Math.min(a.words.length, b.words.length) < 8
  return short ? shared(a.set, b.set) / 0.7 : Math.min(shared(a.pairs, b.pairs) / 0.5, shared(a.head, b.head) / 0.5)
}

interface Wrote {
  thread: HabitThread; messageId: string; at: number; to: { name: string; email: string }
  greeting: string; core: string; closing: string; shape: Shape
  answers: AskKind; chase: boolean
}

// "Hi Dana," opens with "Hi"; "Good morning Dana," with "Good morning". The name is the next person's, never the last one's.
const openerOf = (greeting: string): string => {
  const words = String(greeting || "").replace(/[,!.:–—-]+$/, "").trim().split(/ +/).filter(Boolean)
  if (!words.length) return "Hi"
  const two = words.slice(0, 2).join(" ")
  return /^good (?:morning|afternoon|evening|day)$/i.test(two) ? two : words[0]!
}
const firstLine = (text: string, most = 160): string => {
  const line = String(text || "").split("\n").map(l => l.trim()).find(Boolean) || ""
  return line.length > most ? line.slice(0, most - 1).trimEnd() + "…" : line
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0 }
const hash = (text: string): string => { let h = 5381; for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36) }
// A short, stable name for a wording, so a decision about it can be found again. Figures are left out on purpose: the
// same answer with another rate is the same answer.
const tag = (text: string): string => hash(fold(text).replace(/[^a-z]+/g, " ").trim())
/** The name a "never answered" habit goes by: this inbox and this sender, digits and all, so no two share one. */
export const neverId = (account: string, email: string): string => `never:${hash(`${String(account || "").toLowerCase()} ${String(email || "").toLowerCase()}`)}`

const REPLY_TITLE: Record<AskKind, (n: number) => string> = {
  rate: n => `You answered a question about your rate ${plural(n, "time", "times")}, in nearly the same words.`,
  availability: n => `You sent the times you are free ${plural(n, "time", "times")}, in nearly the same words.`,
  rtr: n => `You gave the go-ahead to represent you ${plural(n, "time", "times")}, in nearly the same words.`,
  documents: n => `You sent what they asked for ${plural(n, "time", "times")}, in nearly the same words.`,
  requirement: n => `You answered a new job requirement ${plural(n, "time", "times")}, in nearly the same words.`,
  outreach: n => `You started ${plural(n, "conversation", "conversations")} with nearly the same message.`,
  "": n => `You wrote nearly the same reply ${plural(n, "time", "times")}.`,
}

/**
 * What the person keeps doing. `decided` are the decisions already made: a habit that matches one carries its id and
 * its state, so it is not offered again as if it were new.
 */
export function findHabits(threads: HabitThread[], myEmails: string[], now: number, decided: Decision[] = [], days = 90): Habits {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const wrote: Wrote[] = []
  const chases: Array<{ w: Wrote; gap: number; answered: boolean }> = []
  const quiet: Array<HabitExample & { silence: number }> = []
  const unanswered = new Map<string, { name: string; email: string; account: string; threads: HabitThread[]; last: number; keep: boolean }>()
  // Everyone the person ever wrote to, from any inbox: whoever is in here was answered.
  const answered = new Set<string>()

  for (const thread of threads || []) {
    const ordered = [...(thread.messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
    if (!ordered.length) continue
    const from = ordered.map(m => senderEmail(m.from))
    const mine = from.map(e => me.has(e))
    const at = ordered.map(m => Number(m.internalDate || 0))
    const others = ordered.filter((_, i) => !mine[i])
    const lastOther = others[others.length - 1]
    // Who a message of the person's own went to: the other side of this conversation, else the To: line.
    const toOf = (i: number) => {
      const before = [...ordered.slice(0, i)].reverse().find((_, k) => !mine[i - 1 - k])
      const source = before?.from || lastOther?.from || ordered[i]!.to || ""
      return { name: senderName(source), email: senderEmail(source) }
    }

    ordered.forEach((m, i) => {
      if (!mine[i]) return
      for (const a of `${m.to || ""} ${m.cc || ""}`.match(ADDRESS) || []) answered.add(a.toLowerCase())
      const parts = ownWords(typedIn(m), senderName(m.from))
      let answers: AskKind = "outreach"
      for (let k = i - 1; k >= 0; k--) if (!mine[k]) { answers = ASK[String(ordered[k]!.category || "")] ?? ""; break }
      const w: Wrote = { thread, messageId: m.id, at: at[i]!, to: toOf(i), ...parts, shape: shapeOf(parts.core), answers, chase: false }
      // Writing again when nobody answered the last one: a day or more later, and not so long after that it is a new matter.
      if (i > 0 && mine[i - 1]) {
        const gap = at[i]! - at[i - 1]!
        if (gap >= 20 * HOUR && gap <= 45 * DAY) {
          w.chase = true
          const next = ordered[i + 1]
          chases.push({ w, gap, answered: !!next && !mine[i + 1] && at[i + 1]! - at[i]! <= 14 * DAY })
        }
      }
      wrote.push(w)
    })

    if (mine.some(Boolean)) others.forEach(m => answered.add(senderEmail(m.from)))
    else if (lastOther) {
      const email = senderEmail(lastOther.from)
      const key = `${thread.accountEmail.toLowerCase()}|${email}`
      const entry = unanswered.get(key) || { name: senderName(lastOther.from), email, account: thread.accountEmail, threads: [], last: 0, keep: false }
      entry.threads.push(thread)
      entry.last = Math.max(entry.last, at[at.length - 1]!)
      if (ordered.some(m => KEEP.has(String(m.category || "")))) entry.keep = true
      unanswered.set(key, entry)
    }

    // Quiet now: the last word is the person's, it did not turn the role down, and the last thing the other side said,
    // if anything, was not a no.
    const last = ordered.length - 1
    if (mine[last] && String(lastOther?.category || "") !== "Rejection" && !saidNo(ordered[last]!.bodyText || "")) {
      let mineInARow = 0
      for (let k = last; k >= 0 && mine[k]; k--) mineInARow++
      // Written three times running with no answer: a fourth is not "soft".
      if (mineInARow < 3) quiet.push({ threadId: thread.threadId, account: thread.accountEmail, who: senderName(lastOther?.from || ordered[last]!.to || "") || "them", at: at[last]!, text: aboutOf(ordered[last]!.subject) || tidy(ordered[last]!.subject), silence: now - at[last]! })
    }
  }

  const habits: Habit[] = []
  const anchorOf = (w: Wrote) => ({ account: w.thread.accountEmail.toLowerCase(), thread: w.thread.threadId, message: w.messageId })
  const holdsTo = (w: Wrote, d: Decision) => w.messageId === d.message && w.thread.threadId === d.thread && (!d.account || w.thread.accountEmail.toLowerCase() === d.account)
  const example = (w: Wrote): HabitExample => ({ threadId: w.thread.threadId, account: w.thread.accountEmail, who: w.to.name || w.to.email, at: w.at, text: firstLine(w.core) })
  const newest = <T extends { at: number }>(xs: T[]): T[] => [...xs].sort((a, b) => b.at - a.at)
  const conversations = (ws: Wrote[]) => new Set(ws.map(w => `${w.thread.accountEmail}|${w.thread.threadId}`)).size
  const typicalOf = (ws: Wrote[]): Wrote => {
    const pool = newest(ws).slice(0, 40)
    let best = pool[0]!, most = -1
    for (const a of pool) { let sum = 0; for (const b of pool) if (a !== b) sum += Math.min(alike(a.shape, b.shape), 2); if (sum > most) { most = sum; best = a } }
    return best
  }
  // Messages put together when they are nearly the same words. Only what has four words or more can be compared.
  const together = (ws: Wrote[]): Wrote[][] => {
    const groups: Wrote[][] = []
    for (const w of [...ws].sort((a, b) => a.at - b.at)) {
      if (w.shape.words.length < 4) continue
      let best = -1, score = 0
      groups.forEach((g, i) => { const s = Math.max(...g.slice(0, 3).map(x => alike(x.shape, w.shape))); if (s > score) { score = s; best = i } })
      if (best >= 0 && score >= 1) groups[best]!.push(w)
      else groups.push([w])
    }
    return groups
  }

  // ── The same reply, again and again ──────────────────────────────────────────────────────────────────────────────
  for (const g of together(newest(wrote).slice(0, MOST_WRITTEN))) {
    if (g.length < TIMES || conversations(g) < TIMES) continue
    if (g.filter(w => w.chase).length / g.length >= 0.6) continue   // that is the chase below, not an answer
    const t = typicalOf(g)
    const kinds = new Map<AskKind, number>()
    for (const w of g) kinds.set(w.answers, (kinds.get(w.answers) || 0) + 1)
    const [top, share] = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0]!
    const when: AskKind = share / g.length >= 0.5 ? top : ""
    // Decided before? A decision points at one message: the group that message is in is the habit it was about. Once
    // that message is too old to be among what is read, the habit is still known by the name its words give it.
    const own = `reply:${tag(t.core)}`
    const pointed = decided.find(d => d.kind === "same_reply" && !!d.message && g.some(w => holdsTo(w, d)))
    const known = pointed || decided.find(d => d.kind === "same_reply" && d.id === own)
    habits.push({
      id: known?.id || own, kind: "same_reply", anchor: anchorOf(t), count: g.length, people: new Set(g.map(w => w.to.email)).size, lastAt: Math.max(...g.map(w => w.at)),
      title: REPLY_TITLE[when](g.length),
      offer: when === "outreach"
        ? "Keep it as your usual opening. It is then ready whenever you start a conversation, and you only look and send."
        : "Keep it as your usual reply. The next time someone asks, it is already written and waits for your OK.",
      action: "Keep as my usual reply",
      typical: t.core, greeting: openerOf(t.greeting), closing: t.closing, when,
      examples: newest(g).slice(0, 5).map(example), ...(known ? { state: known.state } : {}), ...(known && !pointed ? { moved: true } : {}),
    })
  }

  // ── Chasing by hand ──────────────────────────────────────────────────────────────────────────────────────────────
  if (chases.length >= TIMES && conversations(chases.map(c => c.w)) >= TIMES) {
    const days = Math.min(Math.max(Math.round(median(chases.map(c => c.gap)) / DAY), 1), 14)
    const worked = chases.filter(c => c.answered).length
    const people = new Set(chases.map(c => c.w.to.email)).size
    // "Your usual nudge" exists only if the second messages are themselves nearly the same words, three times or more.
    // A second message can be anything (a corrected file, a visa note): the newest of them is not a nudge.
    const nudges = together(chases.map(c => c.w)).filter(g => g.length >= TIMES).sort((a, b) => b.length - a.length)[0]
    const t = nudges ? typicalOf(nudges) : null
    const ready = quiet.filter(q => q.silence >= days * DAY && q.silence <= 30 * DAY).sort((a, b) => b.at - a.at)
    const known = decided.find(d => d.kind === "chase")
    const nowQuiet = ready.length === 0 ? "Nobody is quiet that long right now." : `${plural(ready.length, "conversation is", "conversations are")} quiet that long right now.`
    habits.push({
      id: "chase", kind: "chase", count: chases.length, people, lastAt: Math.max(...chases.map(c => c.w.at)),
      title: people === chases.length
        ? `You wrote a second time to ${plural(people, "person", "people")} who had gone quiet, usually after ${plural(days, "day", "days")}. ${worked} of them answered.`
        : `You wrote again ${plural(chases.length, "time", "times")} to ${plural(people, "person", "people")} who had gone quiet, usually after ${plural(days, "day", "days")}. ${worked} of those ${chases.length} got an answer.`,
      offer: t
        ? `Let MarketFit get the nudge ready after ${plural(days, "day", "days")} of silence, in your words. ${nowQuiet}`
        : `Let MarketFit tell you who has been quiet for ${plural(days, "day", "days")}. Your second messages were each different, so the words stay yours to write. ${nowQuiet}`,
      action: t ? `Get nudges ready after ${plural(days, "day", "days")}` : `Show me who is quiet after ${plural(days, "day", "days")}`,
      ...(t ? { typical: t.core, greeting: openerOf(t.greeting), closing: t.closing, anchor: anchorOf(t) } : {}),
      days, worked, quiet: ready.slice(0, 20).map(q => ({ threadId: q.threadId, account: q.account, who: q.who, at: q.at, text: q.text })),
      examples: newest(chases.map(c => c.w)).slice(0, 5).map(example), ...(known ? { state: known.state } : {}),
      ...(known && t && known.message && !nudges!.some(w => holdsTo(w, known)) ? { moved: true } : {}),
    })
  }

  // ── People who keep writing and were never answered ──────────────────────────────────────────────────────────────
  for (const p of unanswered.values()) {
    if (p.threads.length < TIMES + 1 || p.keep || !p.email || isMachine(p.email) || SHARED_BOX.test(p.email) || answered.has(p.email)) continue
    const id = neverId(p.account, p.email)
    const known = decided.find(d => d.id === id)
    const latest = (t: HabitThread) => Math.max(0, ...t.messages.map(m => Number(m.internalDate || 0)))
    habits.push({
      id, kind: "never_answered", count: p.threads.length, people: 1, lastAt: p.last,
      title: `${p.name || p.email} wrote to you ${plural(p.threads.length, "time", "times")} and you never answered.`,
      offer: `Stop showing mail from ${p.name || p.email}. Nothing is deleted: it all stays in Gmail, and you can bring it back.`,
      action: "Stop showing these",
      sender: { name: p.name, email: p.email, account: p.account.toLowerCase() },
      examples: [...p.threads].sort((a, b) => latest(b) - latest(a)).slice(0, 5).map(t => {
        const lastMsg = [...t.messages].sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0))[0]!
        return { threadId: t.threadId, account: t.accountEmail, who: p.name || p.email, at: latest(t), text: aboutOf(lastMsg.subject) || tidy(lastMsg.subject) }
      }),
      ...(known ? { state: known.state } : {}),
    })
  }

  // What takes writing off the person's hands comes first (the nudge, the usual replies), most often done first. People
  // to stop showing come after. On the owner's own mail, 12 Oct 2026, sorting by count alone put two never-answered
  // senders (45 and 17 mails) on top and pushed the reply he had written eleven times behind "Show more".
  const later = (h: Habit) => (h.kind === "never_answered" ? 1 : 0)
  habits.sort((a, b) => later(a) - later(b) || b.count - a.count || b.lastAt - a.lastAt)
  return {
    looked: { conversations: (threads || []).length, written: wrote.length, days },
    habits,
  }
}

/**
 * The words a decision points at, read back from the conversation it names: what that message of the person's says, how
 * it opens and how it is signed. Null when the message is no longer in the conversation given, or nothing was typed in it.
 */
export function wordsOfMessage(thread: HabitThread, messageId: string): { text: string; greeting: string; closing: string } | null {
  const m = (thread?.messages || []).find(x => x.id === messageId)
  if (!m) return null
  const parts = ownWords(typedIn(m), senderName(m.from))
  return parts.core ? { text: parts.core, greeting: openerOf(parts.greeting), closing: parts.closing } : null
}

/** A prepared message in the person's own words, opened for the one it goes to. */
export function inYourWords(d: { text?: string; greeting?: string; closing?: string }, toName: string): string {
  const first = String(toName || "").trim().split(/\s+/)[0] || ""
  const open = `${d.greeting || "Hi"}${first ? " " + first : ""},`
  return [open, String(d.text || "").trim(), String(d.closing || "").trim()].filter(Boolean).join("\n\n")
}

/**
 * What the kept habits have ready for one conversation: at most one usual reply and one nudge.
 * `ask` is what is being asked of the person in it (the inbox's own word for it), `lastMine` and `quietDays` say whether
 * the last word was theirs and for how long.
 */
export function readyFor(decisions: Kept[], mail: { ask?: string; yourTurn?: boolean; lastMine?: boolean; quietDays?: number; toName: string }): Array<{ label: string; body: string; why: string }> {
  const out: Array<{ label: string; body: string; why: string }> = []
  const on = (decisions || []).filter(d => d.state === "on" && d.text)
  const asked = mail.yourTurn && mail.ask ? mail.ask : ""
  if (asked) {
    // Something particular is being asked: only the answer to that is offered, never the answer to another question.
    const d = on.find(x => x.kind === "same_reply" && x.when === asked)
    if (d) out.push({ label: "Your usual reply", body: inYourWords(d, mail.toName), why: "The words you have used for this before." })
  } else if (!mail.lastMine) {
    // They wrote last and asked for nothing the inbox has a name for: the usual answer to a requirement is offered.
    const d = on.find(x => x.kind === "same_reply" && (x.when === "requirement" || x.when === "documents" || x.when === ""))
    if (d) out.push({ label: "Your usual reply", body: inYourWords(d, mail.toName), why: "The words you have used for mail like this before." })
  }
  if (mail.lastMine) {
    const d = on.find(x => x.kind === "chase")
    if (d && (mail.quietDays ?? 0) >= (d.days || 1)) out.push({ label: "Your usual nudge", body: inYourWords(d, mail.toName), why: `Quiet for ${plural(Math.floor(mail.quietDays ?? 0), "day", "days")}. You usually write again after ${plural(d.days || 1, "day", "days")}.` })
  }
  return out
}

const KINDS = new Set<string>(["same_reply", "chase", "never_answered"])
const FIELDS = new Set(["id", "kind", "state", "at", "when", "days", "account", "thread", "message"])
/**
 * Is this a decision that may be kept? Checked before anything is stored with the account. It names every field it
 * allows and how long each may be, so that words, or anything else large, can never be put in the sign-in cookie this way.
 */
export function validDecision(value: unknown): value is Decision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const d = value as Decision
  if (!Object.keys(d).every(k => FIELDS.has(k))) return false
  const short = (s: unknown, most: number, shape?: RegExp) => s === undefined || (typeof s === "string" && s.length <= most && (!shape || shape.test(s)))
  return typeof d.id === "string" && /^[a-z]+(?::[a-z0-9-]+)?$/.test(d.id) && d.id.length <= 40 && KINDS.has(d.kind) && (d.state === "on" || d.state === "off")
    && short(d.at, 10, /^\d{4}-\d{2}-\d{2}$/) && short(d.when, 20, /^[a-z]*$/)
    && short(d.account, 120, /^[^\s@]+@[^\s@]+$/)
    && short(d.thread, 100, /^[A-Za-z0-9_-]+$/) && short(d.message, 100, /^[A-Za-z0-9_-]+$/)
    && (d.days === undefined || (typeof d.days === "number" && Number.isInteger(d.days) && d.days >= 1 && d.days <= 30))
}
