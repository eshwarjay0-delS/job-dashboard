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
 *  3. NOT KNOWING WHO IS IN IT. A transcript starts only after the person has said whether it is only them or other
 *     people too (the owner, 2026-10-08: "Just keep it as only me and other people involved"). The earlier third answer,
 *     "other people who have not been told", and its refusal are gone by his decision; what stays is that the page says,
 *     beside the second answer, that everyone in it should know it is being recorded. Any answer that is neither of the
 *     two starts nothing.
 *  5. A GUESS SHOWN AS A FACT. Who said a line is worked out from the sound (src/lib/kompasVoice.ts) and can be wrong. A
 *     speaker the person set themselves is marked as theirs (`by: "you"`) and is never changed by a later guess.
 *  4. A PART THAT QUIETLY GOES MISSING. A part of a recording that could not be read is kept in the transcript as a marked gap
 *     with its time. It is never dropped.
 *
 * No browser, no server, no clock: every time is handed in. Loads in plain Node, which is how the tests hold it still.
 */

/** The two answers to "Who is speaking?". "others-told" is the name the second answer had before 8 Oct; kept transcripts carry it. */
export type Consent = "only-me" | "others" | "others-told"
export type Layer = "raw" | "clean" | "rewrite"
export type TranscriptRevision = { before: string; after: string; reason: string; at: number; source: "user" }
/**
 * `speaker` is who said it: "you", or "s1", "s2"... for the other voices in the order they were first heard. `by` says who
 * decided that: absent when it was worked out from the sound, "you" when the person set it.
 */
export type Segment = { id: string; startMs: number; endMs: number; raw: string; clean?: string; rewrite?: string; revisions?: TranscriptRevision[]; failed?: true; speaker?: string; by?: "you" }
export type Session = { v: 1; id: string; title: string; startedAt: string; consent: Consent; segments: Segment[]; names?: Record<string, string> }

// ─────────────────────────────────────────── the guard on tidying ────────────────────────────────────────────

// A word, in every script: letters, combining marks and digits, never the ASCII-only word class (a name in Telugu is a word
// too). An apostrophe or a hyphen BETWEEN letters is part of the word. Without that, "can't" is the two words "can" and "t",
// and a tidier that drops the "t" has turned a refusal into a promise while the guard calls it a deleted stumble (found in
// review, 2026-10-08). The same goes for "non-refundable".
const WORD = /[\p{L}\p{M}\p{Nd}]+(?:['’ʼ-][\p{L}\p{M}\p{Nd}]+)*/gu
const LETTER = /\p{L}/u
// A number as it is written: its digits with the marks inside it and the sign, currency or percent touching it. "1.5" and
// "1-5", "50" and "50%", "5" and "-5" have the same digits and are different numbers.
const NUMBER = /[-+−$€£₹¥]?\p{Nd}+(?:[.,:/]\p{Nd}+)*%?/gu
// Words that are numbers. Tidying may never leave one out: "two hundred fifty thousand" must not become "two hundred
// thousand". The price is that a number corrected aloud ("five, no, six") is left as it was said. That is the safe side.
const NUMBER_WORDS = new Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion lakh lakhs crore crores half dozen double triple twice thrice percent minus point".split(" "))

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
/**
 * How many words may be missing from the very end. Far fewer than from the middle: a tidier that ran out of room stops
 * mid-sentence, and an answer with its last ten words gone used to pass as ten deleted stumbles (found in review, 2026-10-08).
 */
export const MAX_DROPPED_TAIL = 3

/** The words of a text as written, lower-cased, with every kind of apostrophe made the plain one. */
const tokensOf = (text: string): string[] => text.normalize("NFC").toLowerCase().replace(/[’ʼ]/g, "'").match(WORD) ?? []
/** A word as it is compared: a hyphen inside it does not make it another word ("follow-up" is "followup"). */
const plainWord = (token: string): string => token.replace(/-/g, "")
const wordsOf = (text: string): string[] => tokensOf(text).map(plainWord)
const numbersOf = (text: string): string => (text.normalize("NFC").match(NUMBER) ?? []).join(" ")
const numberWordsOf = (text: string): string => tokensOf(text).filter(t => t.split(/['-]/).some(part => NUMBER_WORDS.has(part))).map(plainWord).join(" ")
const lettersIn = (text: string): number => [...text.normalize("NFC")].filter(ch => LETTER.test(ch)).length

/** Is `clean` the raw words in order with some left out? The longest stretch left out and how much of the end, or null when a word was never said. */
function gaps(raw: readonly string[], clean: readonly string[]): { longest: number; tail: number } | null {
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
    if (!found) return null
    gap = 0
  }
  return { longest, tail: raw.length - at }
}

/** Why a tidied text may not stand in for what was said, or "" when it may. Every rule fails closed. */
export function cleanupRefusal(raw: string, clean: string): string {
  const before = raw.trim(), after = clean.trim()
  if (after === "") return "the tidied text was empty"
  if (after === before) return ""
  const rawWords = wordsOf(before), cleanWords = wordsOf(after)
  if (rawWords.length === 0) return "there were no words to tidy"
  const left = gaps(rawWords, cleanWords)
  if (!left) return "it used a word that was never said"
  if (numbersOf(after) !== numbersOf(before) || numberWordsOf(after) !== numberWordsOf(before)) return "it changed a number"
  if (left.tail > MAX_DROPPED_TAIL) return "it stopped before the end"
  const deleted = rawWords.length - cleanWords.length
  if (deleted > Math.max(ALWAYS_DELETABLE, Math.floor(rawWords.length * MAX_DELETED_SHARE))) return "it deleted too much"
  if (left.longest > MAX_DELETED_RUN) return "it dropped a whole passage"
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
 * any other answer. A different name ("Priya" for "Priyanka") is too far away to be put back, and is still refused; so is a
 * word with its "n't" or its "non-" taken off.
 */
export function restoreSpelling(raw: string, clean: string): string {
  // Every said word, by the form it is compared in, with the form it was written in.
  const written = new Map<string, string>()
  for (const token of tokensOf(raw)) if (!written.has(plainWord(token))) written.set(plainWord(token), token)
  return clean.normalize("NFC").replace(WORD, word => {
    const lower = plainWord(word.toLowerCase().replace(/[’ʼ]/g, "'"))
    if (written.has(lower) || lower.length < 5 || /\p{Nd}/u.test(lower)) return word
    let best = "", bestApart = 3
    for (const candidate of written.keys()) {
      if (candidate.length < 5 || candidate[0] !== lower[0] || /\p{Nd}/u.test(candidate)) continue
      const apart = lettersApart(candidate, lower, 2)
      if (apart < bestApart) { best = candidate; bestApart = apart }
    }
    if (!best) return word
    const back = written.get(best) as string
    return word[0] !== word[0].toLowerCase() ? back[0].toUpperCase() + back.slice(1) : back
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
 * Start a transcript, once the person has said who is in it. Anything but one of the two answers starts nothing.
 */
export function startSession(input: { id: string; title?: string; startedAt: number; consent: Consent }): { ok: true; session: Session } | { ok: false; because: "not-answered" } {
  if (input.consent !== "only-me" && input.consent !== "others" && input.consent !== "others-told") return { ok: false, because: "not-answered" }
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
  return { ...session, segments: session.segments.map(s => (s.id === segmentId ? { id: s.id, startMs: s.startMs, endMs: s.endMs, raw: text, ...(s.speaker ? { speaker: s.speaker } : {}), ...(s.by ? { by: s.by } : {}) } : s)) }
}

// ─────────────────────────────────────────── who said it ────────────────────────────────────────────

/** Is anyone but the person in this transcript? Only then are lines given a speaker. */
export function hasOthers(session: Session): boolean {
  return session.consent !== "only-me"
}

/** Take the speakers worked out from the sound. A line whose speaker the person set keeps what they set. */
export function withSpeakers(session: Session, speakers: Readonly<Record<string, string>>): Session {
  let changed = false
  const segments = session.segments.map(s => {
    const guess = speakers[s.id]
    if (!guess || s.by === "you" || s.speaker === guess) return s
    changed = true
    return { ...s, speaker: guess }
  })
  return changed ? { ...session, segments } : session
}

/** The person says who said a line. It is theirs from then on: no later guess changes it. */
export function setSpeaker(session: Session, segmentId: string, speaker: string): Session {
  const id = speaker.trim()
  if (!/^(you|s[1-9][0-9]?)$/.test(id)) return session
  return { ...session, segments: session.segments.map(s => (s.id === segmentId ? { ...s, speaker: id, by: "you" as const } : s)) }
}

/** Give a speaker a name in this transcript ("s1" becomes "Priya"). An empty name goes back to "Speaker 1". */
export function nameSpeaker(session: Session, speaker: string, name: string): Session {
  if (speaker === "you" || !/^s[1-9][0-9]?$/.test(speaker)) return session
  const names = { ...(session.names ?? {}) }
  const clean = name.replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 40)
  if (clean) names[speaker] = clean; else delete names[speaker]
  return { ...session, names }
}

/** What a speaker is called on the page and in a download: "You", the name the person gave, or "Speaker 2". */
export function speakerLabel(session: Session, speaker: string | undefined): string {
  if (!speaker) return ""
  if (speaker === "you") return "You"
  return session.names?.[speaker] || `Speaker ${speaker.slice(1)}`
}

/** The speakers heard so far, in the order of their first line: for the list a person picks from. */
export function speakersHeard(session: Session): string[] {
  const seen: string[] = []
  for (const s of session.segments) if (s.speaker && !seen.includes(s.speaker)) seen.push(s.speaker)
  return seen
}

/** Keep a tidied wording beside a part's own words. Unchanged when the tidied text fails the guard. */
export function withClean(session: Session, segmentId: string, clean: string): Session {
  const text = clean.trim()
  return { ...session, segments: session.segments.map(s => (s.id === segmentId && !s.failed && cleanupAllowed(s.raw, text) ? { ...s, clean: text } : s)) }
}

/** A part's words in the asked wording: the tidied one when asked for and present, otherwise what was said. */
export function segmentText(segment: Segment, layer: Layer): string {
  return layer === "rewrite" ? segment.rewrite || segment.clean || segment.raw : layer === "clean" && segment.clean ? segment.clean : segment.raw
}

/** `m:ss` from the start, or `h:mm:ss` past an hour. */
export function clockAt(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), s = String(whole % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** The transcript as lines with their times and, when other people are in it, who said each. A part that could not be read is a line too, marked, with no words. */
export function transcriptLines(session: Session, layer: Layer): { id: string; clock: string; text: string; failed: boolean; speaker: string; who: string; guessed: boolean }[] {
  const others = hasOthers(session)
  return session.segments.map(s => ({
    id: s.id, clock: clockAt(s.startMs), text: s.failed ? "" : segmentText(s, layer), failed: !!s.failed,
    speaker: others && !s.failed ? s.speaker ?? "" : "", who: others && !s.failed ? speakerLabel(session, s.speaker) : "", guessed: others && !!s.speaker && s.by !== "you",
  }))
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
  const lines = transcriptLines(session, layer).map(l => `${l.clock}  ${l.failed ? GAP : `${l.who ? `${l.who}: ` : ""}${l.text}`}`)
  return [session.title, `${session.startedAt.slice(0, 10)}, ${clockAt(lengthMs(session))} long, ${layer === "rewrite" ? "rewritten by you (unedited parts retain prior wording)" : layer === "clean" ? "tidied" : "as said"}`, "", ...lines, ""].join("\n")
}

export function asMarkdown(session: Session, layer: Layer): string {
  const lines = transcriptLines(session, layer).map(l => `**${l.clock}** ${l.failed ? `_${GAP}_` : `${l.who ? `**${l.who}:** ` : ""}${l.text}`}`)
  return [`# ${session.title}`, "", `${session.startedAt.slice(0, 10)} · ${clockAt(lengthMs(session))} long · ${wordCount(session, layer)} words · ${layer === "rewrite" ? "rewritten by you (unedited parts retain prior wording)" : layer === "clean" ? "tidied" : "as said"}`, "", lines.join("\n\n"), ""].join("\n")
}

/** Explicit user edits are evidence, never a replacement for recognition or validated training truth. */
export function manualRewrite<T extends { raw: string; clean?: string | null; rewrite?: string; revisions?: TranscriptRevision[] }>(value: T, text: string, reason: string, at: number): T {
  const after = text.trim(), why = reason.trim()
  if (!after || after.length > 20000 || !why || !Number.isFinite(at)) return value
  const before = value.rewrite || value.clean || value.raw
  if (before === after) return value
  return { ...value, rewrite: after, revisions: [...(value.revisions || []), { before, after, reason: why.slice(0, 500), at, source: "user" }] }
}

export function withManualRewrite(session: Session, segmentId: string, text: string, reason: string, at: number): Session {
  return { ...session, segments: session.segments.map(s => s.id === segmentId && !s.failed ? manualRewrite(s, text, reason, at) : s) }
}

/** Search all preserved layers, speaker names and correction evidence, including older sessions. */
export function transcriptMatches(session: Session, query: string): boolean {
  const terms = query.normalize("NFC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  const haystack = [session.title, ...Object.values(session.names || {}), ...session.segments.flatMap(s => [s.raw, s.clean || "", s.rewrite || "", ...(s.revisions || []).flatMap(r => [r.before, r.after, r.reason])])].join(" ").normalize("NFC").toLocaleLowerCase()
  return terms.every(t => haystack.includes(t))
}
