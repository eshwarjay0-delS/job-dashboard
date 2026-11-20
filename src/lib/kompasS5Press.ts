/**
 * Manual AI Answer target (Parakeet S5).
 * The button and Ctrl+Enter always name the latest interviewer question
 * plus about two seconds of speech after it. An already-answered ask is
 * regenerated from another angle. This never returns a "no new question" hold.
 */

export const PRESS_TAIL_MS = 2000

export const ANSWER_ANGLES = [
  "the tradeoff you would not drop",
  "what you would check in the first minute",
  "your piece versus the team's piece",
  "the constraint that made it this way",
  "what you would do differently on a second pass",
] as const

export type PressLine = { who?: string; text?: string; at?: number }

export type ManualAnswerTarget = {
  question: string
  regenerate: boolean
  angle: string
}

const ASK = /[?]|\b(?:tell me|walk me|describe|explain|what|why|how|when|where|which|who|can you|could you|would you|do you|did you)\b/i

function clean(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim()
}

function norm(text: string): string {
  return clean(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

function sameQuestion(a: string, b: string): boolean {
  const A = norm(a)
  const B = norm(b)
  if (!A || !B) return false
  return A === B || A.includes(B) || B.includes(A)
}

function isThem(who: string): boolean {
  return /^(?:them|interviewer(?:\s*\d+)?)$/i.test(who)
}

function isAsk(text: string): boolean {
  const s = clean(text)
  if (!s) return false
  if (/^(?:i(?:'m| am|'ll| will|'ve|'d)?\b)/i.test(s) && !/[?]/.test(s)) return false
  return ASK.test(s)
}

type Row = { who: string; text: string; at: number; index: number; stamped: boolean }

function rows(lines: readonly PressLine[] | null | undefined): Row[] {
  return Array.from(lines || []).map((line, index) => {
    const text = clean(line?.text || "")
    const at = Number(line?.at)
    return { who: String(line?.who || ""), text, at: Number.isFinite(at) ? at : NaN, index, stamped: Number.isFinite(at) }
  }).filter((line) => line.text)
}

/** Latest interviewer ask, plus interviewer speech in the next ~2 seconds. */
export function manualAnswerTarget(opts: {
  pending?: readonly PressLine[] | null
  recent?: readonly PressLine[] | null
  lastQuestion?: string
  alreadyAnswered?: boolean
  pass?: number
}): ManualAnswerTarget {
  const empty: ManualAnswerTarget = { question: "", regenerate: false, angle: "" }
  const recent = rows(opts.recent && opts.recent.length ? opts.recent : opts.pending)
  const them = recent.filter((line) => isThem(line.who))
  const asks = them.filter((line) => isAsk(line.text))
  const ask = asks.length ? asks[asks.length - 1] : null
  if (!ask) return empty
  const tail = them.filter((line) => {
    if (line.index <= ask.index) return false
    if (isAsk(line.text)) return false
    if (ask.stamped && line.stamped) return line.at >= ask.at && line.at - ask.at <= PRESS_TAIL_MS
    return line.index === ask.index + 1 && line.text.split(/\s+/).length <= 12
  })
  const question = clean([ask.text, ...tail.map((line) => line.text)].join(" "))
  if (!question) return empty
  const regenerate = !!(opts.alreadyAnswered && (sameQuestion(question, opts.lastQuestion || "") || sameQuestion(ask.text, opts.lastQuestion || "")))
  const pass = Math.abs(Math.trunc(Number(opts.pass) || 0))
  return {
    question,
    regenerate,
    angle: regenerate ? ANSWER_ANGLES[pass % ANSWER_ANGLES.length] : "",
  }
}
