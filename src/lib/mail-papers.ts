// Two things read from the kept mail, with no model: the conversations that carry an RTR or a rate confirmation, and
// the whole history with one person.
//
// Asked on 13 Oct 2026, looking at the inbox's By role view: "give me a filter where we did the RTRs, rate confirmation,
// acknowledgement mails ... it says that RTR everywhere, and they would send forms ... rate confirmation and right to
// represent form ... they might also give like RTR.docx ... Mention that and if I have responded back ... remember ... my
// recruiter list shouldn't be one of them ... whoever was in there and those numbers and contact details as well ... if
// I search his name, what would I see? The previous history of at least the subject lines and a bit of interaction of
// how it went ... so you also have a good idea of what is the history of connection with this guy."
//
// Every line said here is a date, a kind the mail was already sorted into, or words that stand in the other person's
// own message. Mail they only quoted is not read as theirs.

import { senderEmail, senderName, ownPart, dropFooter, tidy, aboutOf, readThread, contactsOf, isMachine } from "./mail-reading.ts"
import { companyOf, type OverviewThread } from "./mail-overview.ts"
import { addressesIn } from "./my-recruiters.ts"

const DAY = 86_400_000
const RTR = /\bRTR\b|right[- ]to[- ]represent|authori[sz]ation to (?:represent|submit)|consent to (?:represent|submit)|representation (?:form|letter|agreement)/i
const RATE = /rate confirmation|confirm(?:ing|ation of)? (?:the |your |on the )?(?:pay |bill |hourly )?rate\b|rate (?:approval|agreement|sheet)\b/i
const ACK = /\backnowledg\w*|\breply (?:back )?(?:with|to this (?:e-?mail|mail)).{0,40}\b(?:confirm|agree|accept)|\bplease (?:confirm|approve)\b|\bsign and (?:return|send)\b/i
// A file named for it: "RTR_Sam_Carter.docx", "Rate Confirmation - IAM.pdf". The name may begin with the word itself.
const FORM = /[\w()-]{0,40}(?:rtr|right[ _-]?to[ _-]?represent|rate[ _-]?confirmation)[\w()\- .]{0,40}\.(?:docx?|pdf)\b/i

export type PaperKind = "rtr" | "rate"
export interface InThread { name: string; email: string; company: string; phones: string[]; recruiter: boolean; wrote: boolean }
export interface Paper {
  threadId: string
  account: string
  about: string
  kinds: PaperKind[]
  said: string             // the sentence of theirs that says it
  form: string             // a form named in their mail ("RTR_Sam.docx"), or ""
  wantsAck: boolean        // they asked for it to be acknowledged, confirmed or signed
  from: InThread           // who sent it
  at: number
  answered: boolean        // he has written in the conversation since
  answeredAt: number
  people: InThread[]       // everyone else in the conversation, the ones who wrote first
}

const typedBy = (m: { bodyText?: string; snippet?: string }): string => (m.bodyText ? dropFooter(tidy(ownPart(m.bodyText))).text : tidy(String(m.snippet || "")))
const sentences = (text: string): string[] => String(text || "").split(/\n+/).flatMap(line => line.match(/[^.?!]+[.?!]*/g) || []).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean)
type Opts = { recruiter?: (email: string) => boolean; hidden?: (account: string, email: string, threadId: string) => boolean; account?: string }

/** Everyone in a conversation but the person themselves: whoever wrote, and whoever a message was sent or copied to. */
function everyoneIn(thread: OverviewThread, me: Set<string>, isRec: (email: string) => boolean): InThread[] {
  const reading = readThread(thread, [...me])
  const emailByName = new Map(reading.messages.filter(m => !m.mine).map(m => [m.who, m.email] as const))
  const phones = new Map<string, string[]>()
  for (const p of contactsOf(reading).phones) { const e = emailByName.get(p.who); if (e) phones.set(e, [...(phones.get(e) || []), p.number].slice(0, 2)) }
  const out = new Map<string, InThread>()
  const put = (name: string, email: string, wrote: boolean) => {
    if (!email || me.has(email)) return
    const had = out.get(email)
    if (had) { had.wrote = had.wrote || wrote; if (!had.name && name) had.name = name; return }
    out.set(email, { name, email, company: companyOf(email), phones: phones.get(email) || [], recruiter: isRec(email), wrote })
  }
  for (const m of thread.messages || []) {
    const from = senderEmail(m.from)
    put(senderName(m.from), from, !me.has(from))
    for (const a of addressesIn(`${m.to || ""}, ${m.cc || ""}`)) if (!isMachine(a.email)) put(a.name, a.email, false)
  }
  return [...out.values()].sort((a, b) => Number(b.wrote) - Number(a.wrote))
}

/** The conversations that carry an RTR or a rate confirmation: the ones he has not answered first, newest first. */
export function papersOf(threads: OverviewThread[], myEmails: string[], opts: Opts = {}): { papers: Paper[]; waiting: number; answered: number } {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const isRec = (email: string): boolean => !!email && !!opts.recruiter?.(email)
  const only = String(opts.account || "").toLowerCase()
  const papers: Paper[] = []
  for (const thread of threads || []) {
    const account = String(thread.accountEmail || "").toLowerCase()
    if (only && account !== only) continue
    const ordered = [...(thread.messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
    const kinds = new Set<PaperKind>()
    let anchor: (typeof ordered)[number] | null = null, firstAt = 0, said = "", form = "", wantsAck = false
    for (const m of ordered) {
      if (me.has(senderEmail(m.from))) continue
      const own = typedBy(m), cat = String(m.category || ""), where = `${m.subject || ""}\n${own}`
      const rtr = cat === "RTR Request" || RTR.test(where), rate = cat === "Rate Confirmation" || RATE.test(where)
      if (!rtr && !rate) continue
      if (rtr) kinds.add("rtr")
      if (rate) kinds.add("rate")
      if (!firstAt) firstAt = Number(m.internalDate || 0)
      anchor = m
      const line = sentences(own).find(s => RTR.test(s) || RATE.test(s))
      if (line) said = line.slice(0, 240)
      const named = FORM.exec(own)
      if (named) form = named[0].trim().slice(0, 90)
      wantsAck = wantsAck || ACK.test(own)
    }
    if (!anchor) continue
    const email = senderEmail(anchor.from)
    if (opts.hidden?.(account, email, thread.threadId)) continue
    const everyone = everyoneIn(thread, me, isRec)
    const reply = ordered.find(m => me.has(senderEmail(m.from)) && Number(m.internalDate || 0) > firstAt)
    const titled = [...ordered].reverse().find(m => m.jobTitle)?.jobTitle
    papers.push({
      threadId: thread.threadId, account, about: aboutOf(titled || anchor.subject) || tidy(anchor.subject), kinds: [...kinds], said: said || tidy(anchor.subject), form, wantsAck,
      from: everyone.find(p => p.email === email) || { name: senderName(anchor.from), email, company: companyOf(email), phones: [], recruiter: isRec(email), wrote: true },
      at: Number(anchor.internalDate || 0), answered: !!reply, answeredAt: reply ? Number(reply.internalDate || 0) : 0,
      people: everyone.filter(p => p.email !== email).slice(0, 8),
    })
  }
  papers.sort((a, b) => Number(a.answered) - Number(b.answered) || b.at - a.at)
  return { papers: papers.slice(0, 200), waiting: papers.filter(p => !p.answered).length, answered: papers.filter(p => p.answered).length }
}

// ── The history with one person ──────────────────────────────────────────────────────────────────────────────────────

const THEY: Record<string, string> = {
  "Job Description": "sent a requirement", "RTR Request": "asked for your go-ahead (RTR)", "Rate Confirmation": "asked you to confirm the rate", "Interview Request": "asked for interview times",
  "Submission Confirmation": "put you forward", "Rejection": "said it is not going ahead", "Offer": "made an offer", "Follow-up": "followed up", "Document Request": "asked for documents",
}
export interface Chapter { threadId: string; account: string; subject: string; startedAt: number; lastAt: number; theirs: number; mine: number; lastMine: boolean; how: string }
export interface History {
  person: InThread | null
  matches: Array<{ name: string; email: string; conversations: number }>   // other people the words fit
  conversations: Chapter[]
  firstAt: number
  lastAt: number
  theirs: number
  mine: number
  summary: string
}
const dayOf = (at: number): string => (at ? new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "")
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * Everything exchanged with one person: who they are, each conversation by its subject, and one line on how it went.
 * `who` is an address, or words to find them by ("mullins"): then the person those words fit best is taken, and the
 * others they fit are listed so the right one can be picked.
 */
export function historyWith(threads: OverviewThread[], myEmails: string[], who: { email?: string; q?: string }, now: number, opts: Opts = {}): History {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const isRec = (email: string): boolean => !!email && !!opts.recruiter?.(email)
  const nothing: History = { person: null, matches: [], conversations: [], firstAt: 0, lastAt: 0, theirs: 0, mine: 0, summary: "" }
  let target = String(who.email || "").trim().toLowerCase()
  let matches: History["matches"] = []
  if (!target) {
    const words = String(who.q || "").toLowerCase().replace(/[^\p{L}\p{N}@._' -]+/gu, " ").split(/\s+/).filter(w => w.length >= 2).slice(0, 5)
    if (!words.length) return nothing
    const seen = new Map<string, { name: string; email: string; threads: Set<string> }>()
    for (const t of threads || []) for (const m of t.messages || []) {
      const email = senderEmail(m.from)
      if (!email || me.has(email) || isMachine(email)) continue
      const name = senderName(m.from), hay = `${name} ${email}`.toLowerCase()
      if (!words.every(w => hay.includes(w))) continue
      const p = seen.get(email) || { name, email, threads: new Set<string>() }
      p.threads.add(t.threadId); seen.set(email, p)
    }
    matches = [...seen.values()].map(p => ({ name: p.name, email: p.email, conversations: p.threads.size })).sort((a, b) => b.conversations - a.conversations || a.name.localeCompare(b.name))
    if (!matches.length) return nothing
    target = matches[0].email
  }

  const chapters: Chapter[] = []
  let person: InThread | null = null, theirs = 0, mine = 0
  for (const thread of threads || []) {
    const ordered = [...(thread.messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
    const wrote = ordered.some(m => senderEmail(m.from) === target)
    const addressed = ordered.some(m => me.has(senderEmail(m.from)) && addressesIn(`${m.to || ""}, ${m.cc || ""}`).some(a => a.email === target))
    if (!wrote && !addressed) continue
    const here = everyoneIn(thread, me, isRec).find(p => p.email === target)
    const known = person as InThread | null
    if (here) person = known ? { ...known, name: known.name || here.name, phones: [...new Set([...known.phones, ...here.phones])].slice(0, 3), wrote: known.wrote || here.wrote } : here
    // How it went: each turn in a few words, the same thing said twice running said once.
    const steps: string[] = []
    let t = 0, m = 0
    for (const msg of ordered) {
      const from = senderEmail(msg.from), isMine = me.has(from)
      if (isMine) m++; else if (from === target) t++
      const first = (senderName(msg.from) || from).split(/\s+/)[0]
      const step = isMine ? (steps.length ? "you answered" : "you wrote first") : `${from === target ? "they" : first} ${THEY[String(msg.category || "")] || "wrote"}`
      if (steps[steps.length - 1] !== step) steps.push(step)
    }
    const lastAt = Number(ordered[ordered.length - 1]?.internalDate || 0), lastMine = me.has(senderEmail(ordered[ordered.length - 1]?.from || ""))
    const quiet = Math.max(0, Math.floor((now - lastAt) / DAY))
    const shown = steps.length > 6 ? [...steps.slice(0, 3), "…", ...steps.slice(-2)] : steps
    const how = `${shown.join(", ")}. ${lastMine ? "You wrote last" : "They wrote last"}${quiet >= 1 ? `, ${plural(quiet, "day", "days")} ago` : ", today"}.`
    theirs += t; mine += m
    const titled = [...ordered].reverse().find(x => x.jobTitle)?.jobTitle
    chapters.push({ threadId: thread.threadId, account: String(thread.accountEmail || "").toLowerCase(), subject: aboutOf(titled || ordered[0].subject) || tidy(ordered[0].subject), startedAt: Number(ordered[0]?.internalDate || 0), lastAt, theirs: t, mine: m, lastMine, how: how.charAt(0).toUpperCase() + how.slice(1) })
  }
  if (!chapters.length) return { ...nothing, matches }
  chapters.sort((a, b) => b.lastAt - a.lastAt)
  const firstAt = Math.min(...chapters.map(c => c.startedAt)), lastAt = chapters[0].lastAt
  const name = (person?.name || target).split(/\s+/)[0]
  const summary = `${plural(chapters.length, "conversation", "conversations")} with ${name} since ${dayOf(firstAt)}. They wrote ${plural(theirs, "time", "times")}, you wrote ${plural(mine, "time", "times")}. ${chapters[0].lastMine ? "You" : name} wrote last, on ${dayOf(lastAt)}.${person?.recruiter ? ` ${name} is on your recruiter list.` : mine === 0 ? ` You have never answered ${name}.` : ""}`
  return { person: person || { name: "", email: target, company: companyOf(target), phones: [], recruiter: isRec(target), wrote: false }, matches: matches.filter(x => x.email !== target).slice(0, 5), conversations: chapters.slice(0, 40), firstAt, lastAt, theirs, mine, summary }
}
