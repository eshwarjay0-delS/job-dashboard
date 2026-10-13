// Where every started application stands, what to do next about each, and how to reach everyone who wrote. Pure
// functions: no network, no model.
//
// The owner, 12 Oct 2026: "if someone ... was saying some requirement they were sending me and someone took their lead
// and addressed those requirements and followed up, sent my details and they have shooted back ... that actually goes to
// the overview since something was started and it was at some point on the pathway to the interview and if no one is
// following up it anymore then it is gonna be a major hassle for me ... they want the best guidance. Like, hey, you have
// received this email and you have to send an updated resume. Here's this recruiter's contact ... I need a contact box
// for everyone, whoever that was emailing me."
// And on 13 Oct: "I don't think the dots are connected well in the overview even now, the contact info about everyone
// and ignore list ... use intelligence to throw for user what's important and not ... more ease and highlights suggestions."
//
// THE MISTAKE THIS FILE PREVENTS. Overview listed a conversation only when it held a go-ahead request, a rate, a
// submission, an interview, an offer or a rejection. A requirement that was answered, and that the recruiter wrote back
// on, was not there at all; a conversation that went quiet could not be acted on from there; and a person was a name on
// a chip. So this reads every kept conversation and says, for each one that has started:
//   - where it stands (they asked, answered, they came back, go-ahead asked, rate asked, put forward, interview, offer);
//   - whose turn it is and, in one plain sentence, what to do next (what they asked for is taken from their own words);
//   - how long it has been quiet, and whether a nudge or a call is due;
//   - who the person is and how to reach them (the numbers and addresses THEY wrote);
//   - how much it matters next to the others, with the reasons said, so the few that matter can be put on top.
// Nothing here is a guess dressed as a fact: every sentence is built from a category the mail was already given, from a
// date, or from words that stand in the other person's own message. "Asked for" means a sentence of theirs that asks:
// a question, or words spoken to him ("please send", "could you"). "I will share your resume with the manager" asks
// nothing, and neither does a word in mail they only quoted.

import { senderEmail, senderName, ownPart, dropFooter, tidy, aboutOf, readThread, contactsOf, saysWaitForUs, turnOf, isMachine, saidNo } from "./mail-reading.ts"

export interface OverviewThread {
  threadId: string
  accountEmail: string
  messages: Array<{ id: string; from: string; to?: string; cc?: string; subject: string; snippet: string; internalDate?: string; bodyText?: string; category?: string; rate?: string; jobTitle?: string }>
}
export type Stage = "asked" | "answered" | "came_back" | "rtr" | "rate" | "submitted" | "interview" | "offer"
export type Group = "needs_you" | "gone_quiet" | "moving"
export interface Contact { name: string; email: string; company: string; phones: string[] }
export interface Standing {
  threadId: string
  account: string
  about: string            // the job, in the few words a person would use
  stage: Stage
  group: Group
  contact: Contact         // the person to answer: whoever asked last, else whoever wrote last
  others: number           // how many more people are in the conversation
  lastAt: number
  quietDays: number
  yourTurn: boolean
  lastMine: boolean        // the last word in the conversation is the person's own
  nudges: number           // messages of theirs in a row at the end with no answer, less the first
  asked: string[]          // what they asked for, in plain words, from their own message
  doNext: string           // one sentence
  action: "reply" | "nudge" | "call" | "none"
  weight: number           // how much it matters next to the others
  why: string[]            // the reasons for that weight, in words
}
export interface Person {
  name: string; email: string; account: string; company: string; phones: string[]
  conversations: number; lastAt: number; lastThreadId: string
  working: boolean         // one of their conversations has started and is still open
  stage?: Stage; about?: string; yourTurn: boolean
  answered: boolean        // you have written to them at least once, from any inbox
}
export interface Overview {
  looked: { conversations: number; people: number; machines: number }
  nudgeAfterDays: number
  highlights: Standing[]   // the few that matter most right now
  needsYou: Standing[]
  goneQuiet: Standing[]
  moving: Standing[]
  counts: { closed: number; cold: number; lapsed: number }   // not shown: ended with a no; silent too long; asks left unanswered too long
  people: Person[]
}

const DAY = 86_400_000
export const STAGE_WORDS: Record<Stage, string> = { asked: "They asked", answered: "You answered", came_back: "They came back", rtr: "Go-ahead asked", rate: "Rate asked", submitted: "Put forward", interview: "Interview", offer: "Offer" }
const STAGE_WEIGHT: Record<Stage, number> = { asked: 35, answered: 15, came_back: 30, rtr: 45, rate: 50, submitted: 60, interview: 80, offer: 100 }
// Mail that asks something of the person.
const ASKING = new Set(["Interview Request", "RTR Request", "Rate Confirmation", "Document Request", "Offer"])
// And the kinds that count even before he has written a word: a step in an application. "Send your resume" from someone
// he never wrote to is a requirement like any other, not an application that has started.
const STEP = new Set(["Interview Request", "RTR Request", "Rate Confirmation", "Offer"])
// MEASURED ON THE OWNER'S OWN MAIL, 13 Oct 2026, the morning this shipped. The first version said 36 conversations
// "need you". 21 were cold "send your resume" mails he had never answered, and the three put on top were interview
// requests 2, 13 and 20 days old. So: an unanswered step from someone he never wrote to counts for a week; any ask he
// has left unanswered for more than two weeks has lapsed; and silence is nudged for a month, not for ever.
const FRESH_DAYS = 7       // a step from someone he never wrote to still counts
const LAPSE_DAYS = 14      // an ask he left unanswered is no longer "waiting on you"
const COLD_DAYS = 30       // silence is no longer worth a nudge
const MOST_IN_A_ROW = 4    // he has written this many times running with no answer: let it rest
const FREE_MAIL = /^(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|pm|zoho|gmx)\./i
// The second-last part of an address is a suffix, not a name, only when it is one of these: "apex.co.uk", "uni.ac.in".
const SUFFIX = new Set(["co", "com", "org", "net", "ac", "gov", "edu"])
const ADDRESS = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9.-]{1,255}\.[A-Z]{2,}/gi
// A sentence asks when it is a question or is spoken to him.
const TO_HIM = /\b(?:please|kindly|could you|can you|would you|will you|let me know|send (?:me|us|over|your|the|a|an)|share (?:your|the|a|an|me)|provide|forward (?:me|us|your)|what is your|what's your|what are your|do you have|are you|may i (?:have|know)|need your|require your)\b/i
// And does not ask when it is about what THEY will do, or tells him there is nothing to do.
const NOT_AN_ASK = /^\s*(?:i|we)\b(?:['’]ll| will| shall| need to| have to| am going to| are going to| can| would| just)\b|^\s*if you are not\b|\bplease (?:ignore|disregard|note|find|see|be advised|do not|don['’]?t)\b/i
// What recruiters ask for, and the plain words for it. In the order a person would say them.
const THINGS: Array<[string, RegExp]> = [
  ["your updated resume", /\b(?:resume|cv)\b/i],
  ["your go-ahead to put you forward", /\b(?:right to represent|rtr|authori[sz]ation to (?:submit|represent)|consent to (?:submit|represent)|ok(?:ay)? to submit)\b/i],
  ["your rate", /\b(?:rate|hourly|salary|compensation|pay expectations?)\b/i],
  ["the times you are free", /\b(?:availability|available|time ?slots?|good time|convenient time|best time)\b/i],
  ["your visa status", /\b(?:visa|work authori[sz]ation|work permit|h-?1b|ead|green card|citizenship)\b/i],
  ["your location", /\b(?:current location|your location|relocat\w*|where are you (?:based|located))\b/i],
  ["your phone number", /\b(?:contact number|phone number|mobile number|best number|number to reach)\b/i],
  ["your LinkedIn", /\blinked ?in\b/i],
  ["references", /\breferences\b|\b(?:a|two|three|professional|your|any) reference\b/i],
  ["identity details", /\b(?:passport|driver'?s? licen[sc]e|photo id|date of birth|dob|ssn)\b/i],
  ["your education details", /\b(?:degree|education|graduation year|year of (?:graduation|passing)|university)\b/i],
  ["your years of experience", /\b(?:years? of experience|total experience|relevant experience)\b/i],
]
const noLinks = (text: string): string => String(text || "").replace(/https?:\/\/\S+|\(link: [^)]*\)/gi, " ")
const sentencesOf = (text: string): string[] => noLinks(text).split(/\n+/).flatMap(line => line.match(/[^.?!]+[.?!]*/g) || [])
const asks = (sentence: string): boolean => (/\?\s*$/.test(sentence.trim()) || TO_HIM.test(sentence)) && !NOT_AN_ASK.test(sentence)

/** What a message of theirs asks for, in plain words. Only what stands in a sentence that asks; at most four things. */
export function askedFor(text: string): string[] {
  const out: string[] = []
  for (const sentence of sentencesOf(text)) {
    if (!asks(sentence)) continue
    for (const [label, re] of THINGS) if (!out.includes(label) && re.test(sentence)) out.push(label)
  }
  return out.slice(0, 4)
}
/** Does a message put a question to him? A question mark in a link is not one. */
export const hasQuestion = (text: string): boolean => sentencesOf(text).some(s => /\?\s*$/.test(s.trim()) && !NOT_AN_ASK.test(s))

// Gmail's first line of a message runs on into the mail it quotes. It is cut where the quote begins, so his own earlier
// question, quoted under their "Sure, will check", is not read as theirs.
const snippetOwn = (snippet: string): string => tidy(String(snippet || "").split(/\s(?:On\s.{4,120}?\swrote:|From:\s.{1,120}?\s(?:Sent|Date|To):|-{2,}\s*(?:Original|Forwarded) Message)/i)[0] || "")
const typed = (m: { bodyText?: string; snippet?: string }): string => (m.bodyText ? dropFooter(tidy(ownPart(m.bodyText))).text : snippetOwn(m.snippet || ""))
const first = (name: string): string => String(name || "").trim().split(/\s+/)[0] || "They"
const days = (n: number): string => (n <= 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`)
const andList = (xs: string[]): string => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)
/** "dana@us.apex.com" as "Apex"; a free mail address says nothing about where someone works. */
export function companyOf(email: string): string {
  const domain = String(email || "").split("@")[1] || ""
  if (!domain || FREE_MAIL.test(domain)) return ""
  const parts = domain.toLowerCase().split(".").filter(Boolean)
  if (parts.length < 2) return ""
  const name = parts.length >= 3 && SUFFIX.has(parts[parts.length - 2]!) ? parts[parts.length - 3]! : parts[parts.length - 2]!
  return name.split("-").filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

/** The few that matter most: the weightiest three of what waits on him and what has gone quiet, taken together. */
export function topOf(needsYou: Standing[], goneQuiet: Standing[]): Standing[] {
  return [...needsYou, ...goneQuiet].sort((a, b) => b.weight - a.weight || b.lastAt - a.lastAt).slice(0, 3)
}

/**
 * Everything Overview says about the mail.
 * `nudgeAfterDays` is how long the person themselves usually waits before writing again (from their own mail, when it
 * is known). `fit` gives how well a conversation matches the work they look for (0 to 100), when that is known.
 * `hidden` says whether a conversation or a sender is hidden by a rule of the person's own. `account` keeps what is
 * shown to one inbox; all the mail is still read, so that someone answered from another inbox is known to be answered.
 */
export function overviewOf(threads: OverviewThread[], myEmails: string[], now: number, opts: { nudgeAfterDays?: number; fit?: (threadId: string) => number | undefined; hidden?: (account: string, email: string, threadId: string) => boolean; account?: string } = {}): Overview {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const wait = Math.min(Math.max(Math.round(opts.nudgeAfterDays || 4), 1), 14)
  const only = String(opts.account || "").toLowerCase()
  const standings: Standing[] = []
  const people = new Map<string, Person>()
  const machines = new Set<string>()
  const writtenTo = new Set<string>()
  let closed = 0, cold = 0, lapsed = 0, conversations = 0

  for (const thread of threads || []) {
    const ordered = [...(thread.messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
    if (!ordered.length) continue
    const account = String(thread.accountEmail || "").toLowerCase()
    const from = ordered.map(m => senderEmail(m.from))
    const mine = from.map(e => me.has(e))
    const at = ordered.map(m => Number(m.internalDate || 0))
    const others = ordered.filter((_, i) => !mine[i])
    const lastAt = at[at.length - 1] || 0

    // Who he has ever written to, from any inbox: read from all the mail, whichever inbox is being shown.
    ordered.forEach((m, i) => { if (mine[i]) for (const a of `${m.to || ""} ${m.cc || ""}`.match(ADDRESS) || []) writtenTo.add(a.toLowerCase()) })
    if (mine.some(Boolean)) others.forEach(m => writtenTo.add(senderEmail(m.from)))
    if (only && account !== only) continue
    conversations++

    // ── Everyone who wrote: one contact box each, with the numbers they themselves gave ────────────────────────────
    const reading = others.length ? readThread(thread, [...me]) : null
    const numbers = reading ? contactsOf(reading).phones : []
    const emailByName = new Map((reading?.messages || []).filter(m => !m.mine).map(m => [m.who, m.email] as const))
    const phonesBy = new Map<string, string[]>()
    for (const p of numbers) { const e = emailByName.get(p.who); if (e) phonesBy.set(e, [...(phonesBy.get(e) || []), p.number]) }
    others.forEach(m => {
      const email = senderEmail(m.from)
      if (!email) return
      if (isMachine(email)) { machines.add(email); return }
      const key = `${account}|${email}`
      const when = Number(m.internalDate || 0)
      const p = people.get(key) || { name: senderName(m.from), email, account, company: companyOf(email), phones: [], conversations: 0, lastAt: 0, lastThreadId: thread.threadId, working: false, yourTurn: false, answered: false }
      for (const n of phonesBy.get(email) || []) if (!p.phones.includes(n) && p.phones.length < 3) p.phones.push(n)
      if (when >= p.lastAt) { p.lastAt = when; p.lastThreadId = thread.threadId; p.name = senderName(m.from) || p.name }
      people.set(key, p)
    })
    for (const email of new Set(others.map(m => senderEmail(m.from)))) { const p = people.get(`${account}|${email}`); if (p) p.conversations += 1 }

    // ── Has it started? Both sides have written, or they have asked for something particular ───────────────────────
    const lastOther = others[others.length - 1]
    if (!lastOther || isMachine(senderEmail(lastOther.from))) continue
    const cats = others.map(m => String(m.category || ""))
    const iWrote = mine.some(Boolean)
    const quietDays = Math.max(0, Math.floor((now - lastAt) / DAY))
    if (!iWrote && !(cats.some(c => STEP.has(c)) && quietDays <= FRESH_DAYS)) continue
    if (opts.hidden?.(account, senderEmail(lastOther.from), thread.threadId)) continue
    // Over: their last word is a no, or he said no and they have not come back with anything to answer since.
    let noAt = -1
    ordered.forEach((m, i) => { if (mine[i] && saidNo(m.bodyText || "")) noAt = i })
    const reopened = noAt >= 0 && ordered.some((m, i) => i > noAt && !mine[i] && ASKING.has(String(m.category || "")))
    if (String(lastOther.category || "") === "Rejection" || (noAt >= 0 && !reopened)) { closed++; continue }

    const firstMineAt = at[mine.indexOf(true)] || 0
    const stage: Stage = cats.includes("Offer") ? "offer" : cats.includes("Interview Request") ? "interview" : cats.includes("Submission Confirmation") ? "submitted"
      : cats.includes("Rate Confirmation") ? "rate" : cats.includes("RTR Request") ? "rtr" : !iWrote ? "asked" : others.some(m => Number(m.internalDate || 0) > firstMineAt) ? "came_back" : "answered"

    // What was asked since he last wrote, message by message: from the kind of mail each is, and from its own sentences.
    const turn = turnOf(ordered, [...me])
    const since = turn.since.map(m => {
      const own = typed(m), cat = String(m.category || "")
      const wants: string[] = []
      if (cat === "Interview Request") wants.push("the times you are free")
      if (cat === "RTR Request") wants.push("your go-ahead to put you forward")
      if (cat === "Rate Confirmation") wants.push("your rate")
      for (const label of askedFor(own)) if (!wants.includes(label)) wants.push(label)
      return { m, cat, wants, asks: wants.length > 0 || ASKING.has(cat) || hasQuestion(own) }
    })
    // The one to answer is whoever asked last. A later "I will keep you posted" from anyone does not close a request
    // that is still open; it only means "nothing to do" when nobody has asked for anything.
    const asker = [...since].reverse().find(x => x.asks)
    const lastSince = since[since.length - 1]
    const waits = !asker && !!lastSince && saysWaitForUs(lastSince.m.bodyText || snippetOwn(lastSince.m.snippet || ""))
    const yourTurn = !!asker
    const asked: string[] = []
    for (const x of since) for (const label of x.wants) if (!asked.includes(label)) asked.push(label)
    let nudges = 0
    for (let k = ordered.length - 1; k >= 0 && mine[k]; k--) nudges++
    // Not put in front of him: an ask he has left for more than two weeks, a silence of more than a month, and one
    // he has already written to four times running.
    if (yourTurn && quietDays > LAPSE_DAYS) { lapsed++; continue }
    if (!yourTurn && (quietDays > COLD_DAYS || nudges >= MOST_IN_A_ROW)) { cold++; continue }
    nudges = Math.max(0, nudges - 1)

    const person = asker?.m || lastOther
    const email = senderEmail(person.from)
    const name = senderName(person.from)
    const contact: Contact = { name, email, company: companyOf(email), phones: (phonesBy.get(email) || []).slice(0, 2) }
    const who = first(name)
    const group: Group = yourTurn ? "needs_you" : quietDays >= wait ? "gone_quiet" : "moving"
    let doNext: string, action: Standing["action"]
    if (yourTurn) {
      action = "reply"
      doNext = since.some(x => x.cat === "Offer") ? `${who} sent an offer. Read the terms and answer.`
        : asked.length ? `${who} asked for ${andList(asked.slice(0, 4))}.`
        : `${who} wrote back with a question and is waiting for your answer.`
    } else if (group === "gone_quiet") {
      if (turn.lastMine && nudges >= 2) {
        action = contact.phones.length ? "call" : "nudge"
        doNext = `You have written ${nudges + 1} times in a row and ${who} has not answered.${contact.phones.length ? ` Calling may do more: ${contact.phones[0]}.` : " One more short note, then let it rest."}`
      } else {
        action = "nudge"
        doNext = turn.lastMine ? `You wrote ${days(quietDays)} and ${who} has not answered. A short, friendly nudge is due.`
          : `${who} last wrote ${days(quietDays)} and nothing has moved since. Ask where it stands.`
      }
    } else {
      action = "none"
      doNext = waits ? `${who} said they will come back to you. Nothing to do yet.`
        : turn.lastMine ? `You answered ${days(quietDays)}. Nothing to do yet; a nudge is due after ${wait} ${wait === 1 ? "day" : "days"} of silence.`
        : `${who} wrote ${days(quietDays)} and asked nothing of you. Nothing to do yet.`
    }

    // How much it matters next to the others, and why, in words.
    const why: string[] = [STAGE_WORDS[stage]]
    let weight = STAGE_WEIGHT[stage]
    if (yourTurn) { weight += 25; why.push("waiting on you") }
    if (group === "gone_quiet") { weight += Math.min(quietDays, 14); why.push(`quiet ${quietDays} ${quietDays === 1 ? "day" : "days"}`) }
    const fit = opts.fit?.(thread.threadId)
    if (typeof fit === "number" && fit >= 60) { weight += Math.round(fit / 5); why.push("close to the work you look for") }
    weight -= Math.min(quietDays, 30) / 2

    const titled = [...ordered].reverse().find(m => m.jobTitle)?.jobTitle
    standings.push({
      threadId: thread.threadId, account, about: aboutOf(titled || lastOther.subject) || tidy(lastOther.subject), stage, group, contact,
      others: Math.max(0, new Set(others.map(m => senderEmail(m.from))).size - 1), lastAt, quietDays, yourTurn, lastMine: turn.lastMine, nudges, asked: asked.slice(0, 4), doNext, action,
      weight: Math.round(weight * 10) / 10, why,
    })
  }

  // The person's own standing with each contact: are they working on something together, and whose turn is it.
  for (const s of standings) {
    const p = people.get(`${s.account}|${s.contact.email}`)
    if (!p) continue
    if (!p.working || STAGE_WEIGHT[s.stage] > STAGE_WEIGHT[p.stage || "answered"]) { p.stage = s.stage; p.about = s.about }
    p.working = true
    p.yourTurn = p.yourTurn || s.yourTurn
  }
  for (const p of people.values()) p.answered = writtenTo.has(p.email)

  const byWeight = (a: Standing, b: Standing) => b.weight - a.weight || b.lastAt - a.lastAt
  const needsYou = standings.filter(s => s.group === "needs_you").sort(byWeight)
  const goneQuiet = standings.filter(s => s.group === "gone_quiet").sort(byWeight)
  const moving = standings.filter(s => s.group === "moving").sort(byWeight)
  // People the person is working with come first, the furthest along first; then everyone else, the latest to write first.
  const rank = (p: Person) => (p.working ? STAGE_WEIGHT[p.stage || "answered"] : -1)
  const list = [...people.values()].sort((a, b) => rank(b) - rank(a) || b.lastAt - a.lastAt)
  return {
    looked: { conversations, people: list.length, machines: machines.size },
    nudgeAfterDays: wait, highlights: topOf(needsYou, goneQuiet), needsYou, goneQuiet, moving, counts: { closed, cold, lapsed }, people: list.slice(0, 300),
  }
}
