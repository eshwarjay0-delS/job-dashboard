/**
 * The rules of Kompas Flow and Kompas Transcribe: what was said, kept as it was said.
 *
 * The owner, 2026-10-07: "Kompas flow and transcribe in the kompas section in job dashboard". These are his own rules from the
 * Kompas repository (packages/core/src/transcript.ts and cleanup-guard.ts), carried here for the two pages that use them.
 *
 * The mistakes this file exists to prevent:
 *
 *  1. THE TIDY VERSION REPLACES THE REAL ONE. `raw` is what the recogniser wrote. A tidied text is stored BESIDE it, never over
 *     it, so "what did I actually say" always has an answer.
 *  2. THE TIDY VERSION SAYS SOMETHING ELSE. A language model asked to tidy text will, sooner or later, improve it: fix a name
 *     that was spelled on purpose, round a number, add a sentence. Asking it nicely in a prompt is not a control.
 *     `cleanupAllowed` is the control: the tidied words must be the raw words, in order, with some left out. That allows
 *     dropping a filler or a false start and changing punctuation and capitals, and nothing else, because anything else has to
 *     use a word that was never said.
 *  3. RECORDING PEOPLE WHO WERE NOT TOLD. A transcript of other people will not start unless the person starting it says the
 *     others know. There is no path around that refusal in code.
 *  4. A PART THAT QUIETLY GOES MISSING. A part of a recording that could not be read is kept in the transcript as a marked gap
 *     with its time. It is never dropped.
 *
 * No browser, no server, no clock: every time is handed in. Loads in plain Node, which is how the tests hold it still.
 */

export type Consent = "only-me" | "others-told" | "others-not-told"
export type Layer = "raw" | "clean"
export type Segment = { id: string; startMs: number; endMs: number; raw: string; clean?: string; failed?: true }
export type Session = { v: 1; id: string; title: string; startedAt: string; consent: "only-me" | "others-told"; segments: Segment[] }

// ─────────────────────────────────────────── the guard on tidying ────────────────────────────────────────────

// Letters, combining marks and digits in every script, never the ASCII-only word class: a name in Telugu is a word too.
const WORD = /[\p{L}\p{M}\p{Nd}]+/gu
const DIGIT = /\p{Nd}/gu
const LETTER = /\p{L}/u

/**
 * How much of a passage tidying may delete before it is cutting content.
 *
 * 0.3 in the Kompas repository, where its comment asks for the number to be set by measurement. The first real run here
 * (2026-10-07, four dictated sentences through the live tidier) refused the best answer of the four: 23 words with two
 * fillers, a doubled word and "on Friday, no, on Monday" came back as 16, every deletion an honest stumble, 30.4 per cent.
 * So 0.4. It is still one measurement on four sentences; the rule that carries the weight is that no word may be added.
 */
export const MAX_DELETED_SHARE = 0.4
/** Words tidying may always delete, however short the passage: a stumble is a stumble in a seven-word sentence too. */
export const ALWAYS_DELETABLE = 4
/** The longest single stretch tidying may drop. Scattered deletions are stumbles; one long one is a missing thought. */
export const MAX_DELETED_RUN = 12

const wordsOf = (text: string): string[] => text.normalize("NFC").toLowerCase().match(WORD) ?? []
const digitsOf = (text: string): string => (text.normalize("NFC").match(DIGIT) ?? []).join("")
const lettersIn = (text: string): number => [...text.normalize("NFC")].filter(ch => LETTER.test(ch)).length

/** Is `clean` the raw words in order with some left out? The longest stretch left out, or -1 when a word was never said. */
function longestGap(raw: readonly string[], clean: readonly string[]): number {
  let longest = 0, gap = 0, at = 0
  for (const word of clean) {
    let found = false
    while (at < raw.length) {
      const candidate = raw[at]
      at += 1
      if (candidate === word) { found = true; break }
      gap += 1
      if (gap > longest) longest = gap
    }
    if (!found) return -1
    gap = 0
  }
  // What is left at the end was deleted too: a cut-off ending is the easiest way to lose a sentence.
  return Math.max(longest, raw.length - at)
}

/** Why a tidied text may not stand in for what was said, or "" when it may. Every rule fails closed. */
export function cleanupRefusal(raw: string, clean: string): string {
  const before = raw.trim(), after = clean.trim()
  if (after === "") return "the tidied text was empty"
  if (after === before) return ""
  const rawWords = wordsOf(before), cleanWords = wordsOf(after)
  if (rawWords.length === 0) return "there were no words to tidy"
  const gap = longestGap(rawWords, cleanWords)
  if (gap === -1) return "it used a word that was never said"
  if (digitsOf(after) !== digitsOf(before)) return "it changed a number"
  const deleted = rawWords.length - cleanWords.length
  if (deleted > Math.max(ALWAYS_DELETABLE, Math.floor(rawWords.length * MAX_DELETED_SHARE))) return "it deleted too much"
  if (gap > MAX_DELETED_RUN) return "it dropped a whole passage"
  if (lettersIn(after) > lettersIn(before)) return "it added text"
  return ""
}

/** How many single-letter changes turn one word into another, counted only as far as `limit`. */
function lettersApart(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]
}

/**
 * Put back the spelling that was said.
 *
 * A tidier told never to change a word still respells one now and then ("travelling" came back "traveling" in the first real
 * run), and the guard then rightly refuses the whole answer, so a good tidying is lost to one letter. This undoes exactly
 * that and nothing more: a tidied word that was never said, of five letters or more and with no digit in it, is replaced by
 * the said word it is a letter or two away from and shares a first letter with. The result is then judged by the guard like
 * any other answer. A different name ("Priya" for "Priyanka") is too far away to be put back, and is still refused.
 */
export function restoreSpelling(raw: string, clean: string): string {
  const said = [...new Set(wordsOf(raw))]
  const known = new Set(said)
  return clean.normalize("NFC").replace(WORD, word => {
    const lower = word.toLowerCase()
    if (known.has(lower) || lower.length < 5 || /\p{Nd}/u.test(lower)) return word
    let best = "", bestApart = 3
    for (const candidate of said) {
      if (candidate.length < 5 || candidate[0] !== lower[0] || /\p{Nd}/u.test(candidate)) continue
      const apart = lettersApart(candidate, lower, 2)
      if (apart < bestApart) { best = candidate; bestApart = apart }
    }
    if (!best) return word
    return word[0] !== lower[0] ? best[0].toUpperCase() + best.slice(1) : best
  })
}

/** May this tidied text be shown in place of what was said? */
export function cleanupAllowed(raw: string, clean: string): boolean {
  return cleanupRefusal(raw, clean) === ""
}

// ─────────────────────────────────────────── Flow: one thing said ────────────────────────────────────────────

/** One dictation in its two wordings. `kept` is the one to show first: the tidied one only when it passed the guard. */
export function flowResult(raw: string, clean: string | null): { raw: string; clean: string | null; kept: Layer } {
  const said = raw.trim(), offered = (clean ?? "").trim()
  const ok = offered !== "" && cleanupAllowed(said, offered)
  return { raw: said, clean: ok ? offered : null, kept: ok ? "clean" : "raw" }
}

// ─────────────────────────────────────────── Transcribe: a kept session ────────────────────────────────────────────

/**
 * Start a transcript. Refused when other people are in it and have not been told: tell them first.
 * Recording only oneself needs nothing but one's own Start.
 */
export function startSession(input: { id: string; title?: string; startedAt: number; consent: Consent }): { ok: true; session: Session } | { ok: false; because: "others-not-told" } {
  if (input.consent !== "only-me" && input.consent !== "others-told") return { ok: false, because: "others-not-told" }
  const title = (input.title ?? "").trim().slice(0, 120) || "Untitled transcript"
  return { ok: true, session: { v: 1, id: input.id, title, startedAt: new Date(input.startedAt).toISOString(), consent: input.consent, segments: [] } }
}

/** Add a part. Parts are kept in time order. A part with no words is left out unless it is marked as one that could not be read. */
export function appendSegment(session: Session, segment: { id: string; startMs: number; endMs: number; raw: string; failed?: true }): Session {
  const raw = segment.raw.trim()
  if (!raw && !segment.failed) return session
  const part: Segment = { id: segment.id, startMs: Math.max(0, segment.startMs), endMs: Math.max(segment.startMs, segment.endMs), raw, ...(segment.failed ? { failed: true as const } : {}) }
  const others = session.segments.filter(s => s.id !== segment.id)
  return { ...session, segments: [...others, part].sort((a, b) => a.startMs - b.startMs) }
}

/** A part that was read again. Its tidied text belonged to the old words, so it goes; an empty reading leaves the part as it was. */
export function replaceSegment(session: Session, segmentId: string, raw: string): Session {
  const text = raw.trim()
  if (!text) return session
  return { ...session, segments: session.segments.map(s => (s.id === segmentId ? { id: s.id, startMs: s.startMs, endMs: s.endMs, raw: text } : s)) }
}

/** Keep a tidied wording beside a part's own words. Unchanged when the tidied text fails the guard. */
export function withClean(session: Session, segmentId: string, clean: string): Session {
  const text = clean.trim()
  return { ...session, segments: session.segments.map(s => (s.id === segmentId && !s.failed && cleanupAllowed(s.raw, text) ? { ...s, clean: text } : s)) }
}

/** A part's words in the asked wording: the tidied one when asked for and present, otherwise what was said. */
export function segmentText(segment: Segment, layer: Layer): string {
  return layer === "clean" && segment.clean ? segment.clean : segment.raw
}

/** `m:ss` from the start, or `h:mm:ss` past an hour. */
export function clockAt(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), s = String(whole % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** The transcript as lines with their times. A part that could not be read is a line too, marked, with no words. */
export function transcriptLines(session: Session, layer: Layer): { id: string; clock: string; text: string; failed: boolean }[] {
  return session.segments.map(s => ({ id: s.id, clock: clockAt(s.startMs), text: s.failed ? "" : segmentText(s, layer), failed: !!s.failed }))
}

export function wordCount(session: Session, layer: Layer): number {
  return session.segments.reduce((total, s) => total + (s.failed ? 0 : (segmentText(s, layer).match(WORD)?.length ?? 0)), 0)
}

/** How long the transcript runs, to the end of its last part. */
export function lengthMs(session: Session): number {
  return session.segments.reduce((end, s) => Math.max(end, s.endMs), 0)
}

const GAP = "[This part could not be read]"

export function asPlainText(session: Session, layer: Layer): string {
  const lines = transcriptLines(session, layer).map(l => `${l.clock}  ${l.failed ? GAP : l.text}`)
  return [session.title, `${session.startedAt.slice(0, 10)}, ${clockAt(lengthMs(session))} long, ${layer === "clean" ? "tidied" : "as said"}`, "", ...lines, ""].join("\n")
}

export function asMarkdown(session: Session, layer: Layer): string {
  const lines = transcriptLines(session, layer).map(l => `**${l.clock}** ${l.failed ? `_${GAP}_` : l.text}`)
  return [`# ${session.title}`, "", `${session.startedAt.slice(0, 10)} · ${clockAt(lengthMs(session))} long · ${wordCount(session, layer)} words · ${layer === "clean" ? "tidied" : "as said"}`, "", lines.join("\n\n"), ""].join("\n")
}
