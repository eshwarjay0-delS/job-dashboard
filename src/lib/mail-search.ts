// Searching the job mail the way Gmail's search bar is used. Pure functions: no network.
//
// The owner, 12 Oct 2026, of the inbox: "Give me search bar similar to gmail search bar as well."
//
// What Gmail's bar does that a plain filter box does not, and what this file holds:
//   - a word is looked for everywhere: who wrote, who it went to, the subject, and the words of every message;
//   - "from:", "to:", "cc:" and "subject:" look in one place; "is:unread" and "is:read"; "newer_than:7d",
//     "older_than:2w", "after:2026/10/01", "before:2026/10/01"; a "quoted phrase" stays together; a minus in front
//     leaves things out; OR between two of them takes either; brackets hold a few of them together, so
//     "-(remote OR hybrid)" and "(senior java) OR analyst" mean what they say;
//   - what it cannot answer it names (`unknown`) and never quietly drops: this app does not keep attachments or labels,
//     so "has:attachment" is said to be left out, not treated as matching everything.
// One difference from Gmail, on purpose: a word matches the START of a word ("jav" finds "Java"), so the list can narrow
// while the person is still typing. Gmail waits for Enter and matches whole words.

import { decodeEntities } from "./mail-reading.ts"

/** One conversation, as far as searching goes. */
export interface SearchDoc {
  from: string      // every name and address that wrote in it
  to: string
  cc: string
  subject: string
  text: string      // everything else there is to read: the job, the company, and the messages themselves
  unread: boolean
  ts: number        // the latest message, epoch ms
}
export type Field = "any" | "from" | "to" | "cc" | "subject" | "is" | "newer" | "older" | "after" | "before"
export interface Term { field: Field; value: string; num?: number }
/** What is asked, as a tree: all of these, any of these, not this, or one thing. */
export type Ask = { all: Ask[] } | { any: Ask[] } | { not: Ask } | { term: Term }
export interface Query {
  root: Ask | null    // null when nothing is asked
  unknown: string[]   // typed, understood as a Gmail operator, and not answerable here
  empty: boolean      // nothing to search for
}
export interface Indexed { from: string; to: string; cc: string; subject: string; any: string; fromRaw: string; toRaw: string; ccRaw: string; unread: boolean; ts: number }

// A Map, not a plain object: "constructor:x" must not find Object's own constructor and be taken for an operator.
const FIELDS = new Map<string, Field>([["from", "from"], ["to", "to"], ["cc", "cc"], ["subject", "subject"], ["is", "is"], ["newer_than", "newer"], ["older_than", "older"], ["after", "after"], ["before", "before"], ["newer", "after"], ["older", "before"]])
// Operators Gmail has and this app has nothing to answer with.
const GMAIL_ONLY = new Set(["has", "label", "category", "filename", "bcc", "in", "list", "deliveredto", "size", "larger", "smaller", "rfc822msgid", "around"])
const SPAN: Record<string, number> = { h: 3_600_000, d: 86_400_000, w: 7 * 86_400_000, m: 30 * 86_400_000, y: 365 * 86_400_000 }

/** Lower case, accents off, "&amp;" as "&": "Renée" and "renee" are the same word to a person searching. */
export function fold(text: string): string {
  return decodeEntities(String(text || "")).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
}
// The words of a text. "C++" and "C#" keep their marks (as the bare letter they would match every word that begins with
// c), and ".NET" is the word "dotnet" (as "net" it would match "network"). Both sides are read this way: what was typed
// and what the mail says.
const wordsOf = (text: string): string[] => fold(text).replace(/(^|[\s(/,;])\.(?=\p{L})/gu, "$1dot").match(/[\p{L}\p{N}]+[+#]*/gu) || []
// " senior java developer ": a needle of " java dev" is then found at the start of a word, whole words before the last.
const hay = (text: string): string => " " + wordsOf(text).join(" ") + " "

function dayStart(value: string, tzOffsetMinutes: number): number | undefined {
  const v = value.trim()
  if (/^\d{9,13}$/.test(v)) return v.length > 10 ? Number(v) : Number(v) * 1000   // Gmail also takes seconds since 1970
  const ymd = v.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/)
  const mdy = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  const [y, mo, d] = ymd ? [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])] : mdy ? [Number(mdy[3]), Number(mdy[1]), Number(mdy[2])] : [0, 0, 0]
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  // Midnight where the person is: getTimezoneOffset() minutes are added to local time to reach UTC.
  return Date.UTC(y, mo - 1, d) + tzOffsetMinutes * 60_000
}

function termOf(field: Field, value: string, raw: string, unknown: string[], tz: number): Term | null {
  const v = value.trim()
  if (!v) return null
  if (field === "is") {
    const state = fold(v)
    if (state !== "unread" && state !== "read") { unknown.push(raw); return null }
    return { field, value: state }
  }
  if (field === "newer" || field === "older") {
    const m = fold(v).match(/^(\d{1,4})\s*([hdwmy])$/)
    if (!m) { unknown.push(raw); return null }
    return { field, value: v, num: Number(m[1]) * SPAN[m[2]!]! }
  }
  if (field === "after" || field === "before") {
    const at = dayStart(v, tz)
    if (at === undefined) { unknown.push(raw); return null }
    return { field, value: v, num: at }
  }
  // Something with no letter or digit in it ("cc:@", "from:.") asks for nothing: as a question it would be true of every mail.
  return wordsOf(v).length ? { field, value: v } : null
}

type Piece = { kind: "open"; not: boolean; op: string; raw: string } | { kind: "close" } | { kind: "or" } | { kind: "item"; not: boolean; op: string; value: string; raw: string }
const SPACE = /\s/

/** What was typed, cut into its pieces: words, "phrases", operators, brackets and OR. */
function pieces(input: string): Piece[] {
  const out: Piece[] = []
  const s = input
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (SPACE.test(c)) { i++; continue }
    if (c === ")") { out.push({ kind: "close" }); i++; continue }
    const start = i
    let not = false
    if (c === "-" && i + 1 < s.length && !SPACE.test(s[i + 1]!)) { not = true; i++ }
    // "from:" is an operator; "10:30", "https://…" and "c2c:" are not, they are words that were typed.
    let op = ""
    const named = /^([a-z_]+):/i.exec(s.slice(i, i + 24))
    if (named && (FIELDS.has(named[1]!.toLowerCase()) || GMAIL_ONLY.has(named[1]!.toLowerCase()))) { op = named[1]!.toLowerCase(); i += named[0].length }
    if (s[i] === "(") { i++; out.push({ kind: "open", not, op, raw: s.slice(start, i) }); continue }
    if (s[i] === '"') {
      const end = s.indexOf('"', i + 1)   // a phrase still being typed has no closing mark yet: it runs to the end
      const value = s.slice(i + 1, end < 0 ? s.length : end)
      i = end < 0 ? s.length : end + 1
      out.push({ kind: "item", not, op, value, raw: s.slice(start, i) })
      continue
    }
    let j = i
    while (j < s.length && !SPACE.test(s[j]!) && s[j] !== "(" && s[j] !== ")") j++
    const value = s.slice(i, j)
    i = Math.max(j, start + 1)
    if (!not && !op && value === "OR") out.push({ kind: "or" })
    else out.push({ kind: "item", not, op, value, raw: s.slice(start, i) })
  }
  return out
}

/** What was typed, as something that can be asked of each conversation. Never throws: half-typed text is normal here. */
export function parseQuery(input: string, opts: { tzOffsetMinutes?: number } = {}): Query {
  const tz = Number(opts.tzOffsetMinutes) || 0
  const unknown: string[] = []
  const all = pieces(String(input || "").slice(0, 500))
  let at = 0
  // Everything up to the bracket that closes this one. Things side by side must all hold; OR between two takes either,
  // and binds first: "dana OR omar remote" is (dana OR omar) and remote. `inside` is the field a bracket was opened
  // under, as in subject:(soc analyst).
  const read = (inside: Field | undefined, depth: number): Ask | null => {
    const groups: Ask[][] = []
    let either = false
    while (at < all.length) {
      const p = all[at]!
      if (p.kind === "close") { at++; if (depth > 0) break; continue }   // a stray ")" on its own is ignored
      if (p.kind === "or") { either = true; at++; continue }
      at++
      let ask: Ask | null = null
      if (p.kind === "open") {
        const field = p.op ? FIELDS.get(p.op) : inside
        const inner = read(field, depth + 1)
        if (p.op && GMAIL_ONLY.has(p.op)) unknown.push(`${p.op}:(…)`)
        else ask = inner
      } else if (p.op && GMAIL_ONLY.has(p.op)) {
        unknown.push(p.raw)
      } else {
        const term = termOf(p.op ? FIELDS.get(p.op)! : inside ?? "any", p.value, p.raw, unknown, tz)
        ask = term ? { term } : null
      }
      if (ask && p.not) ask = { not: ask }
      if (ask) { if (either && groups.length) groups[groups.length - 1]!.push(ask); else groups.push([ask]) }
      either = false
    }
    const parts = groups.map(g => (g.length === 1 ? g[0]! : { any: g }))
    return parts.length === 0 ? null : parts.length === 1 ? parts[0]! : { all: parts }
  }
  const root = read(undefined, 0)
  return { root, unknown: [...new Set(unknown)], empty: !root }
}

/** A conversation made ready to be asked many questions: done once, not once per keystroke. */
export function indexDoc(doc: SearchDoc): Indexed {
  return {
    from: hay(doc.from), to: hay(doc.to), cc: hay(doc.cc), subject: hay(doc.subject),
    any: hay(`${doc.from} ${doc.to} ${doc.cc} ${doc.subject} ${doc.text}`),
    fromRaw: fold(doc.from), toRaw: fold(doc.to), ccRaw: fold(doc.cc),
    unread: !!doc.unread, ts: Number(doc.ts) || 0,
  }
}

function holds(doc: Indexed, term: Term, now: number): boolean {
  const needle = " " + wordsOf(term.value).join(" ")
  // An address is remembered in pieces ("apex" for jane@apexsystems.com): any part of it counts, not only its start.
  const part = fold(term.value).trim()
  switch (term.field) {
    case "any": return doc.any.includes(needle)
    case "subject": return doc.subject.includes(needle)
    case "from": return doc.from.includes(needle) || doc.fromRaw.includes(part)
    case "to": return doc.to.includes(needle) || doc.toRaw.includes(part)
    case "cc": return doc.cc.includes(needle) || doc.ccRaw.includes(part)
    case "is": return term.value === "unread" ? doc.unread : !doc.unread
    case "newer": return doc.ts > 0 && doc.ts >= now - (term.num || 0)
    case "older": return doc.ts > 0 && doc.ts < now - (term.num || 0)
    case "after": return doc.ts > 0 && doc.ts >= (term.num || 0)
    case "before": return doc.ts > 0 && doc.ts < (term.num || 0)
    default: return false
  }
}
function answers(doc: Indexed, ask: Ask, now: number): boolean {
  if ("term" in ask) return holds(doc, ask.term, now)
  if ("not" in ask) return !answers(doc, ask.not, now)
  if ("any" in ask) return ask.any.some(a => answers(doc, a, now))
  return ask.all.every(a => answers(doc, a, now))
}

/** Does this conversation answer the search? An empty search matches nothing: the caller shows the ordinary list. */
export function matches(doc: Indexed, query: Query, now: number): boolean {
  return !!query.root && answers(doc, query.root, now)
}

/** Every single thing asked, with whether it was asked for or ruled out. */
export function termsOf(query: Query): Array<Term & { not: boolean }> {
  const out: Array<Term & { not: boolean }> = []
  const walk = (ask: Ask | null, not: boolean) => {
    if (!ask) return
    if ("term" in ask) out.push({ ...ask.term, not })
    else if ("not" in ask) walk(ask.not, !not)
    else for (const a of "any" in ask ? ask.any : ask.all) walk(a, not)
  }
  walk(query.root, false)
  return out
}

/** The words worth showing in bold: what was asked for, not what was ruled out. */
export function wordsToShow(query: Query): string[] {
  return [...new Set(termsOf(query).filter(t => !t.not && (t.field === "any" || t.field === "subject")).map(t => t.value))]
}

export interface Found { before: string; hit: string; after: string }
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** The place in a text where a searched word stands, with a few words either side. Null when it is not in this text. */
export function findIn(text: string, words: string[], width = 90): Found | null {
  const clean = decodeEntities(String(text || "")).replace(/\s+/g, " ").trim()
  const patterns: string[] = []
  const seen = new Set<string>()
  for (const word of words) {
    // The same reading of a word as the search itself: "c++" is looked for as c++, ".net" as .net.
    const typed = String(word || "").trim()
    const parts = (typed.replace(/^\./, "").match(/[\p{L}\p{N}]+[+#]*/gu) || []).map(escapeRe)
    if (!parts.length) continue
    const lead = typed.startsWith(".") ? "\\." : ""
    const pattern = `${lead}${parts.join("[^\\p{L}\\p{N}]+")}`
    if (!seen.has(pattern)) { seen.add(pattern); patterns.push(pattern) }
  }
  if (!patterns.length) return null
  // Search the message once. Previously every OR/highlight term rescanned the full body and
  // a bounded 500-character query could still trigger dozens of long regex passes.
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${patterns.join("|")})`, "iu").exec(clean)
  if (!match) return null
  const best = { at: match.index + match[1]!.length, len: match[2]!.length }
  // A few words before it, starting on a whole word.
  let start = Math.max(0, best.at - Math.floor(width / 3))
  if (start > 0) { const space = clean.indexOf(" ", start); if (space !== -1 && space < best.at) start = space + 1 }
  const end = Math.min(clean.length, best.at + best.len + width)
  return {
    before: (start > 0 ? "…" : "") + clean.slice(start, best.at),
    hit: clean.slice(best.at, best.at + best.len),
    after: clean.slice(best.at + best.len, end) + (end < clean.length ? "…" : ""),
  }
}

export interface Person { name: string; email: string; count: number; last: number }

/** People to offer while a name is being typed, most written-with first. The typed word is the last one in the box. */
export function suggestPeople(people: Person[], typed: string, most = 4): Person[] {
  const last = String(typed || "").split(/\s+/).pop() || ""
  if (last.length < 2 || /[:"()]/.test(last) || last.startsWith("-")) return []
  const needle = " " + wordsOf(last).join(" ")
  if (needle.length < 3) return []
  return people
    .filter(p => hay(`${p.name} ${p.email}`).includes(needle))
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, most)
}

/** The box with its last word replaced by a person: "resume jee" and Jeevan gives "resume from:jeevan@…". */
export function pickPerson(typed: string, email: string): string {
  const parts = String(typed || "").split(/\s+/)
  parts.pop()
  return [...parts.filter(Boolean), `from:${email}`].join(" ") + " "
}

/** Put a word in the box, or take it out if it is already there: the quick buttons under the bar. */
export function toggleWord(typed: string, word: string): string {
  const parts = String(typed || "").split(/\s+/).filter(Boolean)
  const has = parts.some(p => p.toLowerCase() === word.toLowerCase())
  const next = has ? parts.filter(p => p.toLowerCase() !== word.toLowerCase()) : [...parts, word]
  return next.join(" ") + (next.length && !has ? " " : "")
}
