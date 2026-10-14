// Which email a job is for, and the resume of that email to start it from.
//
// Asked on 13 Oct 2026: "if a user sent a JD ... WhatsApp should ask which email, like 1 [first address] or 2 [second
// address], and if the person can just send the JD and say number one ... the type of resume would be selected from
// the [first] library, since they have selected one, and it will be selected based on the closest match ... we already
// have a very almost relevant resume, and we just need to brush it up ... instead of always starting from 50%."
//
// This file is the rules only: no storage, no network, no model.
//   - One email is one person's profile. A resume is never picked across emails, so the email is asked, never guessed.
//   - AN EMAIL KEEPS ITS NUMBER FOR GOOD. The person is told to put the number under the next job description, so "2"
//     has to mean the same email next week. (Found in review before this shipped: the numbers were handed out by how
//     many resumes each email held, every finished job added one, and after a few jobs "2" meant the other person.)
//   - The answer may come with the job description (a line of its own) or as the next message.
//   - Inside the chosen email the closest resume wins: the one that already shows the most of what the job asks for.
//   - A resume that was itself built on a saved resume is never built on again (see pickBase in resume-library.ts).

/** One resume that could start a job. `depth`: 0 the person wrote it, 1 made from one they wrote, 2 made from a saved one. */
export type Candidate = {
  path: string
  email: string
  /** The folder it sits in ("SIEM and Incident Response"), or "" for the resume the person sent. */
  folder: string
  name: string
  depth: 0 | 1 | 2
  keywords: string[]
  at: number
  /** The resume this number sent and the bot kept, as opposed to a file in Files. */
  kept?: boolean
  /** The job it was made for, when it was made for one (see jobKeyOf). */
  job?: string
}

export type Ranked = { candidate: Candidate; shows: number; of: number }

const lower = (s: string): string => String(s || "").toLowerCase().trim()
const MOST_NUMBERED = 40

/** The emails of a count table, the one with the most resumes first: the order emails are FIRST numbered in. */
export function emailChoices(counts: Record<string, number>, keptEmail = ""): string[] {
  const all = new Map<string, number>()
  for (const [email, n] of Object.entries(counts)) if (email.includes("@") && n > 0) all.set(lower(email), (all.get(lower(email)) || 0) + n)
  // The resume the person sent counts as a place to start even when Files holds nothing under its email yet.
  if (keptEmail.includes("@") && !all.has(lower(keptEmail))) all.set(lower(keptEmail), 0)
  return [...all.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([email]) => email)
}

/**
 * The numbering. `order` is every email this account was ever given a number for, in that order; it only grows.
 * `slots` is the same list with "" where an email holds nothing now, so slots[n - 1] is always email number n.
 */
export function numberEmails(order: string[], counts: Record<string, number>, keptEmail = ""): { order: string[]; slots: string[] } {
  const now = emailChoices(counts, keptEmail)
  const had = [...new Set((Array.isArray(order) ? order : []).filter(e => typeof e === "string").map(lower).filter(e => e.includes("@")))].slice(0, MOST_NUMBERED)
  const next = [...had, ...now.filter(e => !had.includes(e))].slice(0, MOST_NUMBERED)
  return { order: next, slots: next.map(e => (now.includes(e) ? e : "")) }
}

/** The emails a job can be for right now, without the gaps. */
export const live = (slots: string[]): string[] => (Array.isArray(slots) ? slots : []).filter(Boolean)

const ORDINALS: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5, sixth: 6, "6th": 6, seventh: 7, "7th": 7, eighth: 8, "8th": 8, ninth: 9, "9th": 9 }
const CARDINALS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const VERB = /^(?:use|for|with|pick|choose|select|take|send|go with|it is|its|it's|i want|i choose|i pick|i will take|i'll take)\s+/
// "no" is short for "number" only in front of a digit ("no 1", "no. 2"); "no one" is a sentence.
const NOUN = /^(?:the\s+)?(?:email|e-mail|mail|library|folder|account|option|choice|number|num\.?|no\.?(?=\s*\d)|#)\s*/

/**
 * What one short line says about the choice: the email it names, or "". Nothing else on the line is allowed.
 * `slots[n - 1]` is email number n ("" when that email holds nothing now).
 */
export function choiceIn(line: string, slots: string[]): string {
  const emails = live(slots)
  // As typed or as tapped: a keycap or circled digit is its digit, brackets and closing marks are dropped, and a
  // "please" or "thanks" after the answer is not part of it.
  const said = lower(String(line || "").normalize("NFKC")).replace(/[^\p{L}\p{N}@._+#' -]+/gu, " ").replace(/\s+/g, " ").trim()
    .replace(/[.\s]+$/g, "").replace(/\s+(?:please|pls|plz|thanks|thank you)$/g, "").replace(/[.\s]+$/g, "")
  if (!said || said.length > 80 || !emails.length) return ""
  // The address itself, or the part before the @ when only one address is written that way.
  const byName = (s: string): string => { const hit = emails.filter(e => e === s || e.split("@")[0] === s); return hit.length === 1 ? hit[0] : "" }
  // "number one", "email 2", "#1", "use the second one": the words around the number are dropped.
  const afterVerb = said.replace(VERB, "")
  const noun = NOUN.test(afterVerb)
  const rest = afterVerb.replace(NOUN, "").replace(/^the\s+/, "").replace(/\s+(?:one|email|e-mail|mail|library|folder|account|option)$/, "").trim()
  const named = byName(said) || byName(rest)
  if (named) return named
  // Recognize natural selections, without extracting a recruiter email from a pasted JD.
  if (said.length <= 160 && /^(?:the\s+)?(?:email|e-mail|account|address|library)\s+(?:is|should be|will be|for|to use)\b|^(?:for|use|choose|pick|select|switch to|change to|please use|i want|i choose)\b/.test(said)) {
    const mentioned = [...new Set((said.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []).map(lower))]
    if (mentioned.length === 1 && emails.includes(mentioned[0])) return mentioned[0]
  }
  // A digit or "second" is an answer wherever it stands. "one", "two" as words are an answer alone or after a word
  // like "number" or "email": "pick one", "the one", "no one" are sentences, and the question is asked again.
  const n = /^[1-9]\d?$/.test(rest) ? Number(rest) : /^0[1-9]$/.test(rest) && said === rest ? Number(rest) : ORDINALS[rest] || (noun || said === rest ? CARDINALS[rest] || 0 : 0)
  return n >= 1 && n <= slots.length ? slots[n - 1] || "" : ""
}

// A choice sent with a job description is one plain line: letters, digits, an address. A line with a currency sign, a
// percent, a colon or a bar belongs to the job description ("$2", "Openings: 2", "| 2 |").
const PLAIN_LINE = /^#?\s*[\p{L}\p{N}@._+' -]+[.!]?$/u

/**
 * The choice sent together with a job description: a line of its own at the very end ("1", "number one", the address)
 * or, said in words, at the very start. A job description is full of numbers, so nothing inside it is ever read as the
 * choice, and a bare number at the top (a pasted list's own "1.") is not one either. `rest` is the job description
 * without that line.
 */
export function readChoice(text: string, slots: string[]): { email: string; rest: string } {
  const lines = String(text || "").split(/\r?\n/)
  const filled = lines.map((line, at) => ({ line: line.trim(), at })).filter(l => l.line)
  if (filled.length < 2 || live(slots).length < 2) return { email: "", rest: String(text || "").trim() }
  const last = filled[filled.length - 1], first = filled[0]
  for (const spot of [last, first]) {
    if (spot.line.length > 60 || !PLAIN_LINE.test(spot.line)) continue
    if (spot === first && !/\p{L}/u.test(spot.line)) continue
    if (/^0/.test(spot.line)) continue
    const email = choiceIn(spot.line, slots)
    if (email) return { email, rest: lines.filter((_, at) => at !== spot.at).join("\n").trim() }
  }
  return { email: "", rest: String(text || "").trim() }
}

/** The question, as the bot asks it. Each email is shown with the number it keeps. */
export function askWhichEmail(slots: string[]): string {
  const shown = slots.map((email, i) => ({ email, n: i + 1 })).filter(s => s.email)
  const numbers = shown.map(s => `*${s.n}*`)
  const reply = numbers.length <= 2 ? numbers.join(" or ") : `${numbers.slice(0, -1).join(", ")} or ${numbers[numbers.length - 1]}`
  return [
    "Which email is this job for?",
    "",
    ...shown.map(s => `*${s.n}*  ${s.email}`),
    "",
    `Reply ${reply}. I start from the closest resume of that email.`,
    "_Next time, put the number on a line of its own under the job description and I will not ask._",
  ].join("\n")
}

/**
 * The resumes of one email, the closest to this job first. `asked` is what the job asks for, in the same words the
 * resumes' keywords are kept in. Ties go to the resume the person wrote, then to the newest.
 */
export function rankFor(candidates: Candidate[], email: string, asked: string[]): { ranked: Ranked[]; builtOnAlready: number } {
  const want = [...new Set(asked.map(lower).filter(Boolean))]
  const mine = candidates.filter(c => lower(c.email) === lower(email))
  const ranked = mine.filter(c => c.depth < 2).map(candidate => {
    const has = new Set(candidate.keywords.map(lower))
    return { candidate, shows: want.filter(w => has.has(w)).length, of: want.length }
  })
  ranked.sort((a, b) => b.shows - a.shows || a.candidate.depth - b.candidate.depth || b.candidate.at - a.candidate.at || a.candidate.path.localeCompare(b.candidate.path))
  return { ranked, builtOnAlready: mine.length - ranked.length }
}

/** Said to the person before the work starts: what it starts from and why. */
export function saidOf(pick: Ranked): string {
  const c = pick.candidate
  const what = c.kept ? `your resume *${c.name || "as sent"}*` : `your saved ${c.folder ? `*${c.folder}* ` : ""}resume${c.name ? ` (${c.name})` : ""}`
  return pick.of && pick.shows ? `${what}, which already shows ${pick.shows} of the ${pick.of} things this job asks for` : what
}

/** The small message after every resume (asked for in these words: "after every completion of a resume"). */
export const DIFFERENT_RESUME = "_To start from a different resume, send me that resume first, then the job description._"
