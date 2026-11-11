/**
 * Live-question resolution for Kompas (2026-11-10).
 *
 * When AI Answer is pressed, the question is not only a copied span of the
 * last line. The last 60–90 seconds of transcript are the context window:
 * adjacent question sentences are merged, phrases such as "this question"
 * are resolved from that window, and filler is dropped. The model derive
 * prompt does the same rewrite; this module is the offline, deterministic
 * half used as a fallback and in tests. Written for Kompas; not a copy of
 * any third-party client.
 */

export const CONTEXT_WINDOW_MS = 90_000
export const CONTEXT_WINDOW_MIN_MS = 60_000

export type TranscriptLine = {
  who?: string
  text?: string
  at?: number
  seq?: number
}

const LABEL = /^\s*(?:You(?: \((?:typed|earlier|context keywords)\))?|Them(?: \(earlier\))?):\s*/i
const THIS_REF = /\bthis (?:kind of |sort of |type of )?question\b/i
const FILLER_LEAD = /^(?:(?:uh|um|so|like|okay|ok|right|yeah|yes|well)\s*,?\s*)+/i

export function stripLineLabel(text: string): string {
  return String(text || "").replace(LABEL, "").replace(/\s+/g, " ").trim()
}

/** Lines spoken inside the last `windowMs` (default 90 s). Falls back to the last 40 lines when timestamps are missing. */
export function linesInWindow(
  lines: readonly TranscriptLine[] | null | undefined,
  now = Date.now(),
  windowMs = CONTEXT_WINDOW_MS,
  beforeSeq?: number,
): TranscriptLine[] {
  const all = Array.from(lines || []).filter((l) => (beforeSeq == null ? true : Number(l.seq) < beforeSeq))
  const cutoff = now - windowMs
  const stamped = all.filter((l) => Number.isFinite(Number(l.at)) && Number(l.at) > 0)
  if (stamped.length >= Math.min(all.length, 1) && stamped.length === all.length) {
    const recent = all.filter((l) => Number(l.at) >= cutoff)
    return recent.length ? recent : all.slice(-40)
  }
  return all.slice(-40)
}

export function interviewerTexts(lines: readonly TranscriptLine[] | readonly string[]): string[] {
  const raw: ReadonlyArray<TranscriptLine | string> = lines || []
  return raw
    .map((l) => (typeof l === "string" ? l : `${l.who || ""}: ${l.text || ""}`))
    .map(stripLineLabel)
    .map((text) => text.replace(FILLER_LEAD, "").trim())
    .filter(Boolean)
}

/** Last explicit interviewer question in the window, ignoring mere back-references. */
export function priorExplicitQuestion(context: readonly string[]): string {
  const asks = Array.from(context || [])
    .map((t) => String(t || "").replace(/\s+/g, " ").trim())
    .filter((t) => /[?]/.test(t) || /^(?:tell|walk|describe|explain|give|how|what|why|when|where|which|who|can|could|would|will|do|does|did)\b/i.test(t))
    .filter((t) => !THIS_REF.test(t))
  return asks.length ? asks[asks.length - 1] : ""
}

function topicFromQuestion(ask: string): string {
  const t = String(ask || "").replace(/\?\s*$/, "").replace(/\s+/g, " ").trim()
  const about = t.match(/\b(?:about|on)\s+(.+)$/i)
  if (about) return about[1].replace(/^(?:a|an|the)\s+/i, "").trim()
  const tell = t.match(/^tell me about\s+(.+)$/i)
  if (tell) return tell[1].replace(/^(?:a|an|the)\s+/i, "").trim()
  return t
}

/** Resolve "this question" / "this kind of question" against the prior explicit ask in the window. */
export function resolveReferent(question: string, context: readonly string[]): string {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (!q || !THIS_REF.test(q)) return q
  const prior = priorExplicitQuestion(context)
  if (!prior) return q
  const topic = topicFromQuestion(prior)
  if (!topic) return q
  // "from this question" → "from the conflict question" when the prior ask is a conflict question.
  const shortTopic = topic.length > 80 ? topic.slice(0, 77).trim() + "…" : topic
  if (/\bthis question\b/i.test(q)) {
    return q.replace(THIS_REF, () => {
      // Prefer a compact noun phrase when the prior ask is a well-known pattern.
      if (/\bconflict\b/i.test(prior)) return "the conflict question"
      return `the question about ${shortTopic}`
    })
  }
  return q.replace(THIS_REF, `the question about ${shortTopic}`)
}

/** Merge two adjacent interviewer asks that belong to the same turn (e.g. story + "How did you resolve it?"). */
export function mergeAdjacentAsks(asks: readonly string[]): string {
  const parts = Array.from(asks || []).map((s) => String(s || "").replace(/\s+/g, " ").trim()).filter(Boolean)
  if (!parts.length) return ""
  if (parts.length === 1) return parts[0]
  // Keep the last two when the second is a short follow-up of the first.
  const a = parts[parts.length - 2]
  const b = parts[parts.length - 1]
  const bWords = b.split(/\s+/).length
  const pointsBack = /\b(?:it|that|this|those|them)\b/i.test(b)
  const followUp = /^(?:how|why|what|and how|and what|can you|could you)\b/i.test(b) && bWords <= 16 && (pointsBack || !differentSubjects(a, b))
  const sameSubject = !differentSubjects(a, b)
  if (followUp || (sameSubject && bWords <= 16)) {
    const left = /[.?!]$/.test(a) ? a : a + (a.endsWith("?") ? "" : ".")
    return `${left} ${b}`.replace(/\s+/g, " ").trim()
  }
  return b
}

const SUBJECT_STOP = new Set("what when where which whom this that than them they their there then with from have been will would could should does did into about your yours were here some have been than".split(" "))

function differentSubjects(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !SUBJECT_STOP.has(w)))
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return false
  let overlap = 0
  for (const w of B) if (A.has(w)) overlap++
  return overlap === 0
}

/**
 * Form the one question the Answer button should send: merge adjacent asks,
 * resolve back-references from the 60–90 s window, drop filler leads.
 */
export function resolveLiveQuestion(opts: {
  formed?: string
  pending?: readonly string[]
  context?: readonly string[]
}): string {
  const pending = (opts.pending || []).map((t) => stripLineLabel(t).replace(FILLER_LEAD, "").trim()).filter(Boolean)
  const context = (opts.context || []).map((t) => stripLineLabel(t).replace(FILLER_LEAD, "").trim()).filter(Boolean)
  const mergedPending = pending.length ? mergeAdjacentAsks(pending) : ""
  const mergedBoth = pending.length >= 2 && !!mergedPending && mergedPending !== pending[pending.length - 1]
  let formed = String((mergedBoth ? mergedPending : opts.formed) || mergedPending || "").replace(/\s+/g, " ").trim()
  if (!formed && pending.length) formed = pending[pending.length - 1]
  formed = formed.replace(FILLER_LEAD, "").trim()
  const windowTexts = context.length ? context : pending
  return resolveReferent(formed, windowTexts)
}

/** A silence press longer than this, with no new interviewer ask, must not regenerate the last topic. */
export const SILENCE_LISTEN_MS = 20_000
export const LISTENING_STATUS = "Listening"

const CANDIDATE_WHO = /^(?:you|interviewee|candidate)$/i
const INTERVIEWER_WHO = /^(?:them|interviewer(?:\s*\d+)?)$/i
const ASK_CUE = /[?]|^(?:tell|walk|describe|explain|give|how|what|why|when|where|which|who|can|could|would|will|do|does|did|is there|are there)\b/i

function asLabeled(line: TranscriptLine | string): { who: string; text: string } {
  if (typeof line === "string") {
    const m = String(line).match(/^\s*(You|Them|Interviewee|Interviewer(?:\s*\d+)?|Candidate)\s*:\s*(.*)$/i)
    if (m) return { who: m[1], text: String(m[2] || "").replace(/\s+/g, " ").trim() }
    return { who: "", text: stripLineLabel(line).replace(FILLER_LEAD, "").trim() }
  }
  return { who: String(line.who || ""), text: stripLineLabel(String(line.text || "")).replace(FILLER_LEAD, "").trim() }
}

export function isCandidateSpeech(line: TranscriptLine | string): boolean {
  return CANDIDATE_WHO.test(asLabeled(line).who)
}

export function isInterviewerSpeech(line: TranscriptLine | string): boolean {
  const who = asLabeled(line).who
  return INTERVIEWER_WHO.test(who) || who === "Them"
}

function looksLikeAsk(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  return ASK_CUE.test(t) && !looksLikeCandidateAnswer(t)
}

/** Mid-answer speech (including tab-side candidate talk) must not be titled as a new question. */
export function looksLikeCandidateAnswer(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || /[?]/.test(t)) return false
  if (/\b(?:my question is|i wanted to ask|i want to ask|i'?d like to ask)\b/i.test(t)) return false
  if (/^(?:(?:and|so|yeah|yes|um+|uh+|ok(?:ay)?|well|right|got it)[, ]+)*(?:i(?:'m| am|'ll| will|'ve|'d)?\b)/i.test(t)) return true
  if (/\b(?:i would|i'?d |i will|i'?m going to|i typically|my approach|i usually|i tend to)\b/i.test(t)) return true
  if (/^(?:when|while|if) (?:integrating|working|using|building|implementing|designing|doing|running|adding|calling)\b/i.test(t)) return true
  return false
}

/** Mic speech is the interviewer's ask only when the user is clearly reading a question aloud. */
export function isReadAloudQuestion(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || looksLikeCandidateAnswer(t)) return false
  return looksLikeAsk(t)
}

/** A user follow-up spoken into the mic ("go deeper on that exception") is a new ask, not silence. */
const USER_FOLLOW_UP = /^(?:(?:and|so|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:go deeper|dig deeper|elaborate|explain that|explain this|explain it|say that again|more detail)\b/i
export function isUserFollowUp(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  return !!t && (USER_FOLLOW_UP.test(t) || isReadAloudQuestion(t))
}

function sameQuestion(a: string, b: string): boolean {
  const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  const A = norm(a), B = norm(b)
  if (!A || !B) return false
  return A === B || A.includes(B) || B.includes(A)
}

/**
 * When the latest speech is the candidate's turn, keep the outstanding
 * unanswered interviewer question instead of titling the candidate's topic
 * (session 4 mid-candidate-answer: Stripe talk over a rate-limit strategies ask).
 */
export function outstandingInterviewerAsk(
  lines: readonly (TranscriptLine | string)[] | null | undefined,
  opts?: { lastAnswered?: string },
): string {
  const labeled = Array.from(lines || []).map(asLabeled).filter((l) => l.text)
  if (!labeled.length) return ""
  const asks = labeled.filter((l) => isInterviewerSpeech(l) && looksLikeAsk(l.text)).map((l) => l.text)
  const unanswered = asks.filter((t) => !sameQuestion(t, opts?.lastAnswered || ""))
  const last = labeled[labeled.length - 1]
  if (isCandidateSpeech(last) || looksLikeCandidateAnswer(last.text)) {
    if (!unanswered.length) return ""
    return unanswered.length > 1 ? mergeAdjacentAsks(unanswered.slice(-2)) : unanswered[unanswered.length - 1]
  }
  if (isInterviewerSpeech(last) && looksLikeAsk(last.text)) {
    const recent = unanswered.slice(-2)
    return recent.length > 1 ? mergeAdjacentAsks(recent) : (unanswered[unanswered.length - 1] || "")
  }
  return unanswered.length ? unanswered[unanswered.length - 1] : ""
}

/**
 * A silence press with no new interviewer ask must return "Listening",
 * not a regenerated card on the prior topic (session 4, >20 s pause).
 */
export function silencePressResult(opts: {
  quietMs: number
  lastQuestion?: string
  newInterviewerAsks?: readonly string[]
}): { listening: true; question: typeof LISTENING_STATUS } | { listening: false; question: string } {
  const asks = (opts.newInterviewerAsks || [])
    .map((s) => String(s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((s) => !sameQuestion(s, opts.lastQuestion || ""))
  if (Number(opts.quietMs) >= SILENCE_LISTEN_MS && asks.length === 0) {
    return { listening: true, question: LISTENING_STATUS }
  }
  return { listening: false, question: asks.length ? mergeAdjacentAsks(asks) : "" }
}

export const LISTENING_NO_QUESTION = "Listening, no new question yet"

function isThemChannel(line: { who: string; text: string }): boolean {
  return isInterviewerSpeech(line) || /^(?:Them|Interviewer(?:\s*\d+)?)$/i.test(line.who)
}

/** Interviewer asks in a window. Mic (You) counts only when clearly read aloud. */
export function interviewerAsksFrom(
  lines: readonly (TranscriptLine | string)[] | null | undefined,
  opts?: { lastAnswered?: string },
): string[] {
  return Array.from(lines || [])
    .map(asLabeled)
    .filter((l) => l.text)
    .filter((l) => (isThemChannel(l) && looksLikeAsk(l.text)) || (isCandidateSpeech(l) && isReadAloudQuestion(l.text)))
    .map((l) => l.text)
    .filter((t) => !sameQuestion(t, opts?.lastAnswered || ""))
}

function hasNewThemSpeech(
  pending: readonly (TranscriptLine | string)[] | null | undefined,
): boolean {
  return Array.from(pending || []).map(asLabeled).some((l) => l.text && isThemChannel(l))
}

export type LivePressDecision = {
  listening: boolean
  question: string
  reason: "listening" | "merge" | "outstanding" | "ask" | "none"
}

/**
 * Live manual AI Answer decision. A silence or already-answered press with no
 * new interviewer ask holds at "Listening, no new question yet". A candidate
 * or candidate-like Them turn keeps the outstanding interviewer ask. Adjacent
 * interviewer asks merge into one composite question. Typed text and an
 * "Answer anyway" override skip the hold (caller applies those).
 */
export function livePressDecision(opts: {
  pending?: readonly (TranscriptLine | string)[] | null
  recent?: readonly (TranscriptLine | string)[] | null
  lastQuestion?: string
  alreadyAnswered?: boolean
  questionSource?: string
  typed?: string
  anyway?: boolean
  fromAuto?: boolean
}): LivePressDecision {
  if (opts.anyway || String(opts.typed || "").trim()) {
    return { listening: false, question: "", reason: "none" }
  }
  const pending = Array.from(opts.pending || [])
  const recent = Array.from(opts.recent || pending)
  const lastAnswered = opts.alreadyAnswered ? String(opts.lastQuestion || "") : ""
  const window = recent.length ? recent : pending
  const lastSrc = pending.length ? pending : window
  const last = lastSrc.length ? asLabeled(lastSrc[lastSrc.length - 1]) : { who: "", text: "" }
  const candidateTurn = !!(last.text && (isCandidateSpeech(last) || looksLikeCandidateAnswer(last.text)))

  if (candidateTurn) {
    // Mic follow-ups and clearly read-aloud questions stay on the existing press path.
    const userAsk = pending.some((l) => {
      const row = asLabeled(l)
      return (isCandidateSpeech(row) || !row.who) && isUserFollowUp(row.text) && !looksLikeCandidateAnswer(row.text)
    }) || (isCandidateSpeech(last) && isUserFollowUp(last.text) && !looksLikeCandidateAnswer(last.text))
    if (userAsk) {
      return { listening: false, question: "", reason: "none" }
    }
    const held = outstandingInterviewerAsk(pending.length ? window.concat(pending) : window, { lastAnswered })
    if (held) return { listening: false, question: held, reason: "outstanding" }
    if (opts.alreadyAnswered || !hasNewThemSpeech(pending) || pending.every((l) => looksLikeCandidateAnswer(asLabeled(l).text) || isCandidateSpeech(l))) {
      return { listening: true, question: LISTENING_NO_QUESTION, reason: "listening" }
    }
  }

  const asks = interviewerAsksFrom(pending, { lastAnswered })
  if (asks.length >= 2) {
    const merged = mergeAdjacentAsks(asks.slice(-2))
    if (merged && merged !== asks[asks.length - 1]) {
      return { listening: false, question: resolveReferent(merged, asks), reason: "merge" }
    }
  }
  if (asks.length) {
    return { listening: false, question: resolveLiveQuestion({ pending: asks, context: interviewerTexts(window.map((l) => asLabeled(l).text)) }), reason: "ask" }
  }

  const pendingFollowUp = pending.some((l) => {
    const row = asLabeled(l)
    return isUserFollowUp(row.text) && !looksLikeCandidateAnswer(row.text)
  })
  // Manual silence / already-answered: do not regenerate the last topic.
  if (!opts.fromAuto && opts.alreadyAnswered && !asks.length && !pendingFollowUp) {
    return { listening: true, question: LISTENING_NO_QUESTION, reason: "listening" }
  }
  if (!opts.fromAuto && opts.alreadyAnswered && !hasNewThemSpeech(pending) && !pendingFollowUp) {
    return { listening: true, question: LISTENING_NO_QUESTION, reason: "listening" }
  }
  return { listening: false, question: "", reason: "none" }
}

