// Writing a reply in the person's own words, with their own earlier sentences offered as they type, and the grammar
// put right when they ask.
//
// Asked on 13 Oct 2026: "whenever I'm replying, give me an option to at least write an email to them in my own words. Like
// if I'm typing something that was already been filled out many, many times, just on the drop down ... as a grid UI,
// just how Gmail view the suggestions. Once you click on that suggestion, it would just come out to the message that
// you are typing, and it would also auto-correct as a Grammarly ... people then hit G, and that would just correct the
// grammar, and the suggestion would just be a floating window that would pop [at the] bottom of the message ... If not,
// they can type whatever they wish."
//
// What is offered is what the person has themselves written more than once, word for word: nothing is composed. This
// file is the rules only (no network, no model): which sentences count, which fit what is being typed, and the grammar
// fixes that need no model (the rest is one model call, made only when G is pressed: /api/gmail/polish).

import { senderEmail, senderName, ownPart, dropFooter, tidy } from "./mail-reading.ts"
import { ownWords } from "./mail-habits.ts"

export type Phrase = { text: string; count: number }
export const MOST_PHRASES = 150
const FEWEST_WORDS = 4, MOST_WORDS = 34

const keyOf = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}$%]+/gu, " ").trim()
const sentencesOf = (text: string): string[] => String(text || "").split(/\n+/).flatMap(line => line.match(/[^.?!]+[.?!]*/g) || []).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean)
// Not offered again: a line with an address or a phone number in it (it was for one person, once), or a quoted line.
const NOT_REUSABLE = /\S+@\S+\.\S+|https?:\/\/|\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|^>/

/** The sentences the person has written in more than one message, the most used first. Their latest wording is kept. */
export function phrasesOf(threads: Array<{ messages: Array<{ id?: string; from: string; bodyText?: string; internalDate?: string }> }>, myEmails: string[]): Phrase[] {
  const me = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const seen = new Map<string, { text: string; at: number; in: Set<string> }>()
  let n = 0
  for (const t of threads || []) for (const m of t.messages || []) {
    if (!me.has(senderEmail(m.from)) || !m.bodyText) continue
    const id = m.id || `m${++n}`, at = Number(m.internalDate || 0)
    const core = ownWords(dropFooter(tidy(ownPart(m.bodyText))).text, senderName(m.from)).core
    for (const s of sentencesOf(core)) {
      const words = s.split(" ").length
      if (words < FEWEST_WORDS || words > MOST_WORDS || NOT_REUSABLE.test(s)) continue
      const key = keyOf(s)
      const had = seen.get(key)
      if (had) { had.in.add(id); if (at >= had.at) { had.text = s; had.at = at } }
      else seen.set(key, { text: s, at, in: new Set([id]) })
    }
  }
  return [...seen.values()].filter(p => p.in.size >= 2).map(p => ({ text: p.text, count: p.in.size }))
    .sort((a, b) => b.count - a.count || a.text.length - b.text.length).slice(0, MOST_PHRASES)
}

/** Where the sentence being typed begins: after the last full stop, question mark, exclamation mark or line break. */
export function fragmentOf(body: string): { start: number; fragment: string } {
  const text = String(body || "")
  let start = 0
  for (let i = text.length - 1; i >= 0; i--) { const c = text[i]; if (c === "\n" || ((c === "." || c === "?" || c === "!") && (text[i + 1] === " " || text[i + 1] === undefined))) { start = i + 1; break } }
  const fragment = text.slice(start)
  return { start: start + (fragment.length - fragment.trimStart().length), fragment: fragment.trim() }
}

/**
 * The person's own sentences that fit what is being typed now: the ones that begin the same way first, then the ones
 * that hold every word typed so far. Nothing is offered for less than three letters, or for a sentence already there.
 */
export function suggestPhrases(phrases: Phrase[], body: string, most = 6): Phrase[] {
  const { fragment } = fragmentOf(body)
  const typed = keyOf(fragment)
  if (typed.length < 3) return []
  const words = typed.split(" ").filter(Boolean)
  const there = new Set(sentencesOf(body).map(keyOf))
  const begins: Phrase[] = [], holds: Phrase[] = []
  for (const p of phrases || []) {
    const key = keyOf(p.text)
    if (there.has(key) || key === typed) continue
    if (key.startsWith(typed)) begins.push(p)
    else if (words.length >= 2 && words.every(w => ` ${key}`.includes(` ${w}`))) holds.push(p)
  }
  return [...begins, ...holds].slice(0, most)
}

/** The message with the sentence being typed replaced by the one chosen, ready for the next sentence. */
export function applyPhrase(body: string, phrase: string): string {
  const text = String(body || ""), { start } = fragmentOf(text)
  const before = text.slice(0, start)
  return `${before}${before && !/\s$/.test(before) ? " " : ""}${phrase.trim()} `
}

// ── Grammar that needs no model ───────────────────────────────────────────────────────────────────────────────────────

const WORDS: Array<[RegExp, string]> = [
  [/\bi\b(?!['\u2019]?\s*\.e\.)/g, "I"], [/\bi['\u2019](m|ll|ve|d)\b/gi, "I'$1"], [/\bim\b/g, "I'm"], [/\bive\b/g, "I've"],
  [/\b(do|does|did|is|are|was|were|have|has|had|would|should|could|must)nt\b/gi, "$1n't"], [/\bcant\b/gi, "can't"], [/\bwont\b/gi, "won't"], [/\b(that|what|here|there)s\b(?= (?:a|an|the|my|your|our|not|why|how|what|great|good|fine|correct|right)\b)/gi, "$1's"],
  [/\bteh\b/gi, "the"], [/\brecieve(d|s)?\b/gi, "receive$1"], [/\badress\b/gi, "address"], [/\bseperate(ly)?\b/gi, "separate$1"], [/\bdefinately\b/gi, "definitely"], [/\boccured\b/gi, "occurred"],
  [/\buntill\b/gi, "until"], [/\bwich\b/gi, "which"], [/\bbecuase\b/gi, "because"], [/\balot\b/gi, "a lot"], [/\bthier\b/gi, "their"], [/\bavail(?:i|a)ble\b/gi, "available"], [/\boppurtunity\b/gi, "opportunity"],
  [/\bintrested\b/gi, "interested"], [/\bavailab?ility\b/gi, "availability"], [/\bconfrim(ed)?\b/gi, "confirm$1"], [/\bplz\b/gi, "please"], [/\bpls\b/gi, "please"], [/\bthx\b/gi, "thanks"],
]

/**
 * What can be put right without asking anyone: "i" as a word, missing apostrophes, a handful of spellings everyone
 * misses, spaces doubled or set before a comma, and a small letter at the start of a sentence. Addresses, links and
 * numbers are not touched. Says how many places it changed.
 */
export function tidyWriting(text: string): { text: string; changes: number } {
  const before = String(text || "")
  const out = before.split("\n").map(line => {
    if (/^\s*>/.test(line)) return line                       // quoted mail is someone else's writing
    // Addresses and links are set aside so nothing inside them is "corrected".
    const kept: string[] = []
    let s = line.replace(/\S+@\S+|https?:\/\/\S+|www\.\S+/g, m => `\u0000${kept.push(m) - 1}\u0000`)
    for (const [re, to] of WORDS) s = s.replace(re, (m, ...g) => { const made = to.replace(/\$(\d)/g, (_x, d) => String(g[Number(d) - 1] ?? "")); return /^[A-Z]/.test(m) && !/^I\b/.test(made) ? made.charAt(0).toUpperCase() + made.slice(1) : made })
    s = s.replace(/([^\s]) {2,}(?=\S)/g, "$1 ").replace(/ +([,;!?])/g, "$1").replace(/ +\.(?=\s|$)/g, ".").replace(/([,;])(?=[A-Za-z])/g, "$1 ").replace(/([.?!])(?=[A-Z](?:[a-z]|['\s]))/g, "$1 ")
    // A small letter at the start of a sentence. "e.g. this" and "no. 4" are not the end of one.
    s = s.replace(/(^\s*|[.?!]\s+)([a-z])(?=[a-z]*[\s,.!?]|[a-z]*$)/g, (m: string, lead: string, c: string, at: number, whole: string) =>
      lead[0] === "." && /(?:\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|no|approx|inc|ltd|st)|\b[A-Za-z])$/i.test(whole.slice(0, at)) ? m : lead + c.toUpperCase())
    return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[Number(i)] ?? "")
  }).join("\n")
  let changes = 0
  const a = before.split(/(\s+)/), b = out.split(/(\s+)/)
  if (a.length === b.length) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changes++ } else changes = out === before ? 0 : Math.max(1, Math.abs(a.length - b.length))
  return { text: out, changes }
}

/**
 * Is a corrected text still the person's own message? A model asked to fix grammar must not add, drop or change what is
 * said: the same numbers, about the same length, the same number of lines. When it is not, the model's text is not used.
 */
export function keepsMeaning(original: string, corrected: string): boolean {
  const a = String(original || "").trim(), b = String(corrected || "").trim()
  if (!b) return false
  const numbers = (s: string) => (s.match(/\d[\d,.:/-]*\d|\d/g) || []).join(" ")
  if (numbers(a) !== numbers(b)) return false
  if (Math.abs(a.length - b.length) > Math.max(12, a.length * 0.2)) return false
  const lines = (s: string) => s.split("\n").filter(l => l.trim()).length
  if (lines(a) !== lines(b)) return false
  const words = (s: string) => new Set(keyOf(s).split(" ").filter(w => w.length > 3))
  const wa = words(a), wb = words(b)
  let kept = 0
  for (const w of wa) if (wb.has(w)) kept++
  return wa.size === 0 || kept / wa.size >= 0.7
}
