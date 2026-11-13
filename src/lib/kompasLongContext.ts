/**
 * Pick the latest interviewer ask and the setup it needs.
 * The session can hold a long transcript. The model receives only this cut.
 */
export type ContextLine = { who?: string; text?: string; at?: number }

const ASK = /(?:^|\s)(?:what|how|why|when|where|who|which|tell me|describe|walk me|design|have you|do you|can you)\b|\?/i

/** A stem in progress is already the question. Do not wait for the closing punctuation. */
export function captureEarly(partial: string): string {
  const text = String(partial || "").replace(/\s+/g, " ").trim()
  if (!text || !ASK.test(text)) return ""
  if (/[.?!]$/.test(text)) return text
  return `${text}?`
}

export function selectAnswerContext(lines: readonly ContextLine[]): { question: string; passages: string; words: number } {
  const sentences: { who: string; text: string }[] = []
  for (const line of lines || []) {
    const who = line && line.who === "You" ? "You" : "Them"
    const bits = String(line && line.text || "").split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
    for (const text of bits) sentences.push({ who, text })
  }
  let ask = -1
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].who !== "You" && ASK.test(sentences[i].text)) { ask = i; break }
  }
  if (ask < 0) {
    for (let i = sentences.length - 1; i >= 0; i--) if (sentences[i].who !== "You") { ask = i; break }
  }
  if (ask < 0) return { question: "", passages: "", words: 0 }
  const early = captureEarly(sentences[ask].text)
  const partial = early.endsWith("?") && !/[.?!]$/.test(sentences[ask].text) && sentences[ask].text.split(/\s+/).length < 14
  let start = ask
  let words = sentences[ask].text.split(/\s+/).length
  if (!partial) while (start > 0 && words < 140) {
    const prev = sentences[start - 1]
    const n = prev.text.split(/\s+/).length
    if ((prev.who === "You" && n > 8) || words + n > 180) break
    words += n
    start--
  }
  let end = ask
  while (end + 1 < sentences.length && end - ask < 2 && sentences[end + 1].who === sentences[ask].who && !ASK.test(sentences[end + 1].text)) end++
  const passages = sentences.slice(start, end + 1).map((s) => `${s.who}: ${s.text}`).join("\n")
  return { question: partial ? early : sentences[ask].text, passages, words: passages.split(/\s+/).filter(Boolean).length }
}
