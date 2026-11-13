/**
 * Pick the latest interviewer ask and the setup it needs.
 * The session can hold a long transcript. The model receives only this cut.
 */
export type ContextLine = { who?: string; text?: string; at?: number }

const ASK = /(?:^|\s)(?:what|how|why|when|where|who|which|tell me|describe|walk me|design)\b|\?/i

/** Used by the side panel only. The answer cut below does not call this. */
export function captureEarly(partial: string): string {
  const text = String(partial || "").replace(/\s+/g, " ").trim()
  if (!text || !ASK.test(text)) return ""
  if (/[.?!]$/.test(text)) return text
  return `${text}?`
}

const INTRO_ONLY = /^(?:please\s+)?(?:introduce yourself|tell me about yourself|walk me through your (?:background|career|resume))[.?!]*$/i
const SIDE_TALK = /\b(?:not sure|get to the end of this|your introduction|i(?:'m| am) not going to|let me see|we(?:'ll| will) come back|i might not)\b/i

function finishAsk(text: string): string {
  const bare = String(text || "").replace(/[.?!]+$/g, "").trim()
  if (!bare) return ""
  return `${bare.charAt(0).toUpperCase()}${bare.slice(1)}.`
}

/** Drop interviewer side-talk. "… I'm not sure …. introduce yourself." is "Introduce yourself." */
export function cleanHeardQuestion(text: string): string {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  if (!raw) return ""
  const tail = raw.match(/(?:^|[.?!]\s+)((?:please\s+)?(?:introduce yourself|tell me about yourself|walk me through your (?:background|career|resume)))[.?!]*\s*$/i)
  if (tail) {
    const before = raw.slice(0, tail.index).trim()
    if (!before || SIDE_TALK.test(before) || /^your introduction\b/i.test(before)) return finishAsk(tail[1])
  }
  const parts = raw.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
  const lead = /^(?:so|okay|ok|um+|uh+|well|now|and|then)[, ]+/i
  const intros = parts.filter((part) => INTRO_ONLY.test(part.replace(lead, "")))
  const rest = parts.filter((part) => !INTRO_ONLY.test(part.replace(lead, "")))
  if (intros.length === 1 && rest.every((part) => SIDE_TALK.test(part) || /^your introduction\b/i.test(part))) return finishAsk(intros[0])
  return raw
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
  let start = ask
  let words = sentences[ask].text.split(/\s+/).length
  while (start > 0 && words < 140) {
    const prev = sentences[start - 1]
    const n = prev.text.split(/\s+/).length
    if ((prev.who === "You" && n > 8) || words + n > 180) break
    words += n
    start--
  }
  let end = ask
  while (end + 1 < sentences.length && end - ask < 2 && sentences[end + 1].who === sentences[ask].who && !ASK.test(sentences[end + 1].text)) end++
  const passages = sentences.slice(start, end + 1).map((s) => `${s.who}: ${s.text}`).join("\n")
  return { question: sentences[ask].text, passages, words: passages.split(/\s+/).filter(Boolean).length }
}
