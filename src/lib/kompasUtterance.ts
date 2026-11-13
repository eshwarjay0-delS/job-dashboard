/**
 * One heard utterance, the way Parakeet shows it: its own row, a speaker,
 * a clock time, and whether this row is a question.
 * Two interviewers are not separated. Kompas hears one interviewer track.
 */
export type UtteranceItem = {
  speaker: "You" | "Interviewer"
  at: number
  clock: string
  text: string
  tag: "Question detected" | "No question"
}

const QUESTION = /(?:^|\s)(?:what|how|why|when|where|who|which|tell me|describe|walk me|design|talk about|proud of|your role|contribut|project that you)\b|\?/i

export function utteranceTag(text: string): UtteranceItem["tag"] {
  return QUESTION.test(String(text || "")) ? "Question detected" : "No question"
}

export function clockLabel(at: number): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function utteranceItem(who: string, text: string, at: number): UtteranceItem {
  const clean = String(text || "").replace(/\s+/g, " ").trim()
  return {
    speaker: who === "You" ? "You" : "Interviewer",
    at,
    clock: clockLabel(at),
    text: clean,
    tag: utteranceTag(clean),
  }
}

/** Drop a repeated prefix when the next clip starts with the tail of the last one. */
export function stitchUtterance(previous: string, next: string): { part: string; next: string } {
  const cur = String(next || "").replace(/\s+/g, " ").trim()
  const prev = String(previous || "").replace(/\s+/g, " ").trim()
  if (!cur) return { part: "", next: prev }
  if (!prev) return { part: cur, next: cur }
  if (cur === prev) return { part: "", next: prev }
  if (cur.startsWith(prev + " ")) return { part: cur.slice(prev.length).trim(), next: cur }
  if (prev.startsWith(cur + " ")) return { part: "", next: prev }
  const prevWords = prev.split(" ")
  const curWords = cur.split(" ")
  const stop = new Set(["the", "a", "an", "and", "or", "but", "is", "are", "to", "of", "in", "on"])
  let overlap = 0
  const max = Math.min(prevWords.length, curWords.length, 12)
  for (let k = max; k >= 1; k--) {
    const a = prevWords.slice(-k).join(" ").toLowerCase()
    const b = curWords.slice(0, k).join(" ").toLowerCase()
    if (a === b && !(k === 1 && stop.has(b))) { overlap = k; break }
  }
  if (overlap > 0) return { part: curWords.slice(overlap).join(" ").trim(), next: cur }
  return { part: cur, next: cur }
}

const FILLER = /^(?:um+|uh+|erm+|er|hmm+)[,.]?\s*/i

/** Spoken order is the clock order. Arrival order is not trusted. */
export function chronologicalUtterances<T extends { at: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.at - b.at)
}

/**
 * Rebuild one question from broken pieces. Words inside a piece stay in the
 * order the speaker said them. Pieces are joined in clock order.
 */
export function reconstructQuestion(pieces: readonly { text: string; at: number }[]): string {
  return deriveQuestion(chronologicalUtterances(pieces).map((piece) => piece.text))
}

/** Join fragment rows into the question the interviewer was building. */
export function deriveQuestion(fragments: readonly string[]): string {
  const kept: string[] = []
  for (const raw of fragments) {
    const text = String(raw || "").replace(/\s+/g, " ").trim().replace(FILLER, "").replace(/\s+(?:um+|uh+)\b/gi, " ").trim()
    if (!text || /^(?:um+|uh+|right|yeah|ok(?:ay)?)[.!?]*$/i.test(text)) continue
    kept.push(text)
  }
  const joined = kept.join(" ").replace(/\s+/g, " ").trim()
  const asks = joined.split(/(?<=[.?!])\s+/).filter((s) => QUESTION.test(s))
  let question = (asks[asks.length - 1] || joined).replace(FILLER, "").trim()
  question = question
    .replace(/\bwhat did you specifically contribute to it\b/i, "what were your specific contributions")
    .replace(/\s+/g, " ")
    .trim()
  if (question && !/[?]$/.test(question) && /^(?:what|how|why|when|where|who)\b/i.test(question)) question += "?"
  if (question) question = question[0].toUpperCase() + question.slice(1)
  return question
}

/** Word error rate. Insertions, deletions, and substitutions over the reference length. */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const a = reference.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean)
  const b = hypothesis.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean)
  if (!a.length) return b.length ? 1 : 0
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length] / a.length
}
