/**
 * Newest-inclusive question windows (6 Nov 2026).
 *
 * When Kompas assembles the interviewer ask, it tries the last four detected
 * question pieces, then the last three, the last two, and the newest piece
 * alone. It keeps the longest window that is still one interview question:
 * a trailing fragment stays attached to the setup it needs, and a later
 * standalone question does not swallow the unrelated asks before it.
 *
 * Pieces are question utterances, not company preface. "We have 27 control
 * areas" is not a piece. "Specifically the rollback plan" is.
 */

export type QuestionWindowSpan = 1 | 2 | 3 | 4

export type QuestionWindowPick = {
  text: string
  span: QuestionWindowSpan
  label: "Last 1" | "Last 1 2" | "Last 1 2 3" | "Last 1 2 3 4"
}

const LABELS: Record<QuestionWindowSpan, QuestionWindowPick["label"]> = {
  1: "Last 1",
  2: "Last 1 2",
  3: "Last 1 2 3",
  4: "Last 1 2 3 4",
}

const NOISE = /^(?:ok(?:ay)?|yeah|yep|yes|no|right|thanks|thank you|uh+|um+|hmm+|sure|great|perfect|cool|got it|alright|all right|sounds good)[.!?]*$/i
const ASK_START = /^(?:(?:ok(?:ay)?|alright|all right|so|and|also|but|now|then|well|right|yeah|yes|um+|uh+|please)[, ]+)*(?:what|which|who|why|how|where|when|can you|could you|would you|will you|do you|did you|have you|are you|is there|tell me|describe|explain|give me|walk me|talk me|show me|share)\b/i
const FACET = /^(?:specifically|especially|particularly|including|namely|in particular|more on|focusing on|starting with)\b/i
const PREFACE = /^(?:we(?:'ve| have| use| follow| manage| need| can| want| finished)|i(?:'m| am| appreciate| liked| work)|our|the (?:team|ceo|first)|there (?:are|is)|you (?:cannot|can't|must|have|should|will|need|know)|no |only the|within the|a change must|the remediation must|thanks for)\b/i
const PIVOT = /(?:[;,]\s*|\b(?:so|then|now)\s*,?\s*|\b(?:my|the) (?:real |next )?question is\s*)(?=(?:what|which|who|why|how|when|can|could|would|do|have|tell me|describe|explain|give me|walk me through)\b)/gi
const CONTENT_STOP = new Set("about after again also been before being could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours explain describe tell walk specifically especially particularly including namely change differently communicated handle handled next else about your you plan time".split(" "))
const PROPER_STOP = new Set("what how why when where which who tell walk have has can could would will did does are the and but for you your yeah okay right great thanks this that those these specifically especially and give show share describe explain me".split(" "))

function cleaned(value: string): string {
  return String(value || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sentencesOf(value: string): string[] {
  const hidden = cleaned(value).replace(/\bU\.S\.(?=\s)/gi, "U\u0001S\u0001").replace(/\bU\.K\.(?=\s)/gi, "U\u0001K\u0001")
  return hidden
    .split(/(?<=[?!.])\s+(?=[A-Z]|(?:[Ss]o|[Ww]hat|[Hh]ow|[Ww]hich|[Ww]hy|[Tt]ell|[Aa]nd|[Nn]ow|[Ss]pecifically)\b)/)
    .map((s) => s.replace(/\u0001/g, ".").trim())
    .filter(Boolean)
}

function wordsOf(value: string): string[] {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+# ]+/g, " ").split(/\s+/).filter(Boolean)
}

function contentWords(value: string): string[] {
  return wordsOf(value).filter((w) => w.length >= 4 && !CONTENT_STOP.has(w))
}

function properNouns(value: string): string[] {
  return (String(value || "").match(/\b[A-Z][A-Za-z0-9+#.-]{2,}\b/g) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => !PROPER_STOP.has(w))
}

function whatIsHead(value: string): string {
  const m = String(value || "").match(/^(?:(?:and|but|so)\s+)?what (?:is|are)\s+(?:an?|the\s+)?([a-z0-9][\w+#.-]*)/i)
  return m ? m[1].toLowerCase() : ""
}

function looksLikeAsk(value: string): boolean {
  const t = String(value || "").trim()
  if (!t || NOISE.test(t)) return false
  if (ASK_START.test(t) || FACET.test(t)) return true
  return /\?\s*$/.test(t) && !/^(?:right|okay|yeah|you know)\??$/i.test(t)
}

function embeddedAsk(sentence: string): string {
  PIVOT.lastIndex = 0
  const parts = Array.from(String(sentence || "").matchAll(PIVOT))
  if (!parts.length) return sentence
  const m = parts[parts.length - 1]
  const after = sentence.slice((m.index || 0) + m[0].length).trim()
  return after || sentence
}

function pieceOf(sentence: string): string | null {
  const s = String(sentence || "").trim()
  if (!s || NOISE.test(s)) return null
  if (FACET.test(s) || ASK_START.test(s)) return s
  if (PREFACE.test(s)) {
    const embedded = embeddedAsk(s)
    if (embedded !== s && looksLikeAsk(embedded)) return embedded
    return null
  }
  return looksLikeAsk(s) ? s : null
}

/** Detected question utterances, oldest first. Preface and fillers are not pieces. */
export function questionPieces(heard: string): string[] {
  const out: string[] = []
  for (const sentence of sentencesOf(heard)) {
    const piece = pieceOf(sentence)
    if (piece) out.push(piece)
  }
  return out
}

function hasOwnNoun(value: string): boolean {
  return contentWords(value).length > 0
}

/** A later piece that cannot be answered until the earlier ask is heard. */
export function dependentQuestionPiece(value: string): boolean {
  const raw = String(value || "").trim()
  if (!raw) return false
  if (FACET.test(raw)) return true
  if (/^(?:and|but)\s+what (?:is|are)\b/i.test(raw) && whatIsHead(raw)) return false
  if (/^(?:and|but)\b/i.test(raw)) return true
  const t = raw.replace(/^(?:(?:and|but|so|then|now|well)[, ]+)/i, "")
  if (/^(?:what|how|why)\b/i.test(t) && wordsOf(t).length <= 6 && !hasOwnNoun(t)) return true
  if (/\b(?:it|that|this|them|those)\b/i.test(t) && wordsOf(t).length <= 12 && !/^what (?:is|are)\b/i.test(t)) return true
  return false
}

function logisticsAsk(value: string): boolean {
  return /\b(?:where (?:do|are) you|visa|salary|notice period|relocat|address|work authorization|citizen|green card|h-?1b)\b/i.test(value)
}

function parallelAsk(value: string): boolean {
  return /^(?:(?:and|but|so)\s+)?(?:how|what|why|when|where)\b/i.test(String(value || "").trim())
}

/** Whether `next` continues the same interviewer ask as the pieces already in the window. */
export function questionPieceContinues(prevSpan: string[], next: string): boolean {
  if (!next || !prevSpan.length) return false
  if (dependentQuestionPiece(next)) {
    const head = whatIsHead(next)
    if (head && !prevSpan.join(" ").toLowerCase().includes(head)) return false
    return true
  }
  const prevHead = whatIsHead(prevSpan[prevSpan.length - 1] || "")
  const nextHead = whatIsHead(next)
  if (prevHead && nextHead && prevHead !== nextHead) return false
  if (logisticsAsk(next) && !prevSpan.some(logisticsAsk)) return false
  if (/\bwhat (?:is|are)\b/i.test(next) && !prevSpan.some((p) => /\bwhat (?:is|are)\b/i.test(p))) {
    const bag = new Set(contentWords(prevSpan.join(" ")))
    if (!contentWords(next).some((w) => bag.has(w))) return false
  }
  if (parallelAsk(next) && prevSpan.some(parallelAsk)) {
    const prevProper = new Set(prevSpan.flatMap(properNouns))
    const fresh = properNouns(next).filter((n) => !prevProper.has(n))
    if (fresh.length && !/\b(?:it|that|this|them|those|the same)\b/i.test(next)) return false
    return true
  }
  const bag = new Set(contentWords(prevSpan.join(" ")))
  const shared = contentWords(next).filter((w) => bag.has(w))
  if (shared.length >= 1) return true
  return false
}

export function joinPieces(parts: string[]): string {
  let out = ""
  for (const part of parts) {
    const piece = String(part || "").trim()
    if (!piece) continue
    if (!out) { out = piece; continue }
    out += (/[.?!]["']?$/.test(out) ? " " : ". ") + piece
  }
  return out.replace(/\s+/g, " ").trim()
}

export function questionWindowCoherent(parts: string[]): boolean {
  if (parts.length <= 1) return true
  for (let i = 1; i < parts.length; i++) {
    if (!questionPieceContinues(parts.slice(0, i), parts[i])) return false
  }
  return true
}

/**
 * Pick Last 1 2 3 4, then Last 1 2 3, then Last 1 2, then Last 1.
 * The longest coherent window wins. Last 1 is always coherent.
 */
export function selectQuestionWindow(pieces: string[]): QuestionWindowPick {
  const recent = (Array.isArray(pieces) ? pieces : []).map((p) => String(p || "").trim()).filter(Boolean).slice(-4)
  if (!recent.length) return { text: "", span: 1, label: "Last 1" }
  for (let size = recent.length; size >= 1; size--) {
    const window = recent.slice(-size)
    const span = size as QuestionWindowSpan
    if (span === 1 || questionWindowCoherent(window)) {
      return { text: joinPieces(window), span, label: LABELS[span] }
    }
  }
  const last = recent[recent.length - 1]
  return { text: last, span: 1, label: "Last 1" }
}

/** Window over the question pieces inside one heard turn. */
export function assembleQuestionWindow(heard: string): QuestionWindowPick {
  return selectQuestionWindow(questionPieces(heard))
}

/**
 * Rejoin only a coherent tail. Earlier separate asks stay their own questions,
 * so four unrelated asks are not one mega-question.
 */
export function mergeQuestionSpans(spans: string[]): string[] {
  const list = (Array.isArray(spans) ? spans : []).map((s) => String(s || "").trim()).filter(Boolean)
  if (list.length < 2) return list
  const selected = selectQuestionWindow(list.slice(-4))
  if (selected.span <= 1) return list
  const head = list.slice(0, list.length - selected.span)
  return [...head, selected.text]
}
