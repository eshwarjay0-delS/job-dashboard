/**
 * Parakeet-style card text. Complex answers become short headed sections.
 * A short answer stays one block. The words are the draft's words; nothing is invented.
 */
export function answerWordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function answerSentences(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1)
}

/** A design, a story, an incident, or a long explanation. A definition or a yes/no stays plain. */
export function answerIsComplex(question: string, text: string): boolean {
  const q = String(question || "")
  const sentences = answerSentences(text)
  const words = answerWordCount(text)
  if (/\*\*(?:Context|What I did|Result)\*\*/.test(text)) return true
  const simple = /^(?:what is|what does|what's|define|do you|are you|have you|can you hear)\b/i.test(q.trim()) && words < 55 && sentences.length < 3
  if (simple) return false
  if (/\b(?:design|tell me about a time|walk me through|incident|war room|contributions|proud of|strategy)\b/i.test(q)) return sentences.length >= 2 || words >= 36
  return sentences.length >= 4 || words >= 70
}

function tightBullets(sentences: string[]): string[] {
  if (sentences.length <= 4) return sentences
  return [...sentences.slice(0, 3), sentences.slice(3).join(" ")]
}

/** Format a finished answer for the card. Idempotent. */
export function presentSpokenAnswer(question: string, text: string): string {
  const raw = String(text || "").trim()
  if (!raw) return raw
  if (/\*\*(?:Context|What I did|Result)\*\*/.test(raw)) return raw
  const sentences = answerSentences(raw)
  if (!answerIsComplex(question, raw) || sentences.length < 2) return raw
  const third = Math.max(1, Math.ceil(sentences.length / 3))
  const groups: Array<[string, string[]]> = [
    ["Context", sentences.slice(0, third)],
    ["What I did", sentences.slice(third, third * 2)],
    ["Result", sentences.slice(third * 2)],
  ]
  const blocks: string[] = []
  for (const [title, group] of groups) {
    if (!group.length) continue
    if (blocks.length) blocks.push("…")
    blocks.push(`**${title}**`)
    for (const sentence of tightBullets(group)) blocks.push(`- ${sentence}`)
  }
  return blocks.join("\n")
}
