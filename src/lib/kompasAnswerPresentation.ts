import { cleanHeardQuestion } from "./kompasLongContext.ts"

/**
 * Fixed card order: claim, context, action, result, close.
 * The same question and the same words always produce the same sections.
 * A number is shown only when the resume or the question already contains it.
 */
export const SECTION_ORDER = ["Claim", "Context", "Action", "Result", "Close"] as const
export type AnswerSection = (typeof SECTION_ORDER)[number]

export function answerWordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function answerSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^(?:and|but|or|which|that)\b/i.test(s))
}

/** A design, a story, an incident, or a long explanation. A definition or a yes/no stays plain. */
export function answerIsComplex(question: string, text: string): boolean {
  const q = String(question || "")
  const sentences = answerSentences(text)
  const words = answerWordCount(text)
  if (/\*\*(?:Claim|Context|Action|Result|Close)\*\*/.test(text)) return true
  const simple = /^(?:what is|what does|what's|define|do you|are you|have you|can you hear)\b/i.test(q.trim()) && words < 55 && sentences.length < 3
  if (simple) return false
  if (/\b(?:design|tell me about a time|walk me through|incident|war room|contributions|proud of|strategy)\b/i.test(q)) return sentences.length >= 2 || words >= 36
  return sentences.length >= 4 || words >= 70
}

function digitsIn(text: string): string[] {
  return String(text || "").match(/\d[\d,.]*/g) || []
}

function numberIsSourced(sentence: string, source: string): boolean {
  const nums = digitsIn(sentence)
  if (!nums.length) return false
  return nums.every((n) => source.includes(n.replace(/[.,]+$/, "")))
}

/** Drop a figure the resume and the question do not already contain. */
export function withoutInventedNumbers(sentence: string, source: string): string {
  return String(sentence || "")
    .replace(/\d[\d,.]*/g, (n) => (source.includes(n.replace(/[.,]+$/, "")) ? n : ""))
    .replace(/\bby percent\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
}

function uncap(sentence: string): string {
  return sentence.replace(/^([A-Z])([a-z])/, (_, a: string, b: string) => a.toLowerCase() + b)
}

function signpost(section: AnswerSection, sentence: string): string {
  const clean = uncap(sentence.replace(/^(?:first|then|the result)\b[:,]?\s+/i, ""))
  if (section === "Context") return /^first\b/i.test(sentence) ? sentence : `First, ${clean}`
  if (section === "Action") return /^then\b/i.test(sentence) ? sentence : `Then, ${clean}`
  if (section === "Result") return /^the result\b/i.test(sentence) ? sentence : `The result: ${clean}`
  return sentence
}

function bucket(sentence: string, source: string): AnswerSection {
  if (numberIsSourced(sentence, source)) return "Result"
  if (/\b(?:result|stopped|outcome)\b/i.test(sentence)) return "Close"
  if (/\b(?:I|we)\s+(?:checked|built|added|implemented|sent|reviewed|mapped|held|would|joined|ran)\b/i.test(sentence)) return "Action"
  return "Context"
}

const INTRO_ASK = /^(?:introduce yourself|tell me about yourself|walk me through your (?:background|career|resume))\.$/i

/** An introduction stays one paragraph. Kept from the intro cleanup. */
export function plainIntroAnswer(text: string): string {
  const sentences: string[] = []
  for (const line of String(text || "").split("\n")) {
    const t = line.trim()
    if (!t || /^(?:…|\.{3})$/.test(t) || /^\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*$/.test(t)) continue
    for (const bit of t.split(/(?<=[.!?])\s+/)) {
      let spoken = bit.replace(/^(?:[-•*]|\d+[.)])\s+/, "").replace(/^(?:first|then|finally|the result)\b[:,]?\s+/i, "").trim()
      if (!spoken) continue
      spoken = spoken.replace(/^([a-z])/, (letter) => letter.toUpperCase())
      if (answerWordCount(spoken) >= 3) sentences.push(spoken)
    }
  }
  return sentences.join(" ")
}

/** Format a finished answer for the card. Idempotent. No random choice. */
export function presentSpokenAnswer(question: string, text: string, source = ""): string {
  const raw = String(text || "").trim()
  if (!raw) return raw
  if (INTRO_ASK.test(cleanHeardQuestion(question))) return plainIntroAnswer(raw)
  if (/\*\*(?:Claim|Context|Action|Result|Close)\*\*/.test(raw)) return raw
  const allowed = `${source}\n${question}`
  const sentences = answerSentences(raw).map((s) => withoutInventedNumbers(s, allowed)).filter((s) => answerWordCount(s) >= 3)
  if (!answerIsComplex(question, sentences.join(" ")) || sentences.length < 2) return sentences.join(" ") || raw
  const groups: Record<AnswerSection, string[]> = { Claim: [], Context: [], Action: [], Result: [], Close: [] }
  groups.Claim.push(sentences[0])
  for (const sentence of sentences.slice(1)) groups[bucket(sentence, allowed)].push(sentence)
  const blocks: string[] = []
  for (const title of SECTION_ORDER) {
    const group = groups[title]
    if (!group.length) continue
    if (blocks.length) blocks.push("…")
    blocks.push(`**${title}**`)
    const tight = group.length <= 4 ? group : [...group.slice(0, 3), group.slice(3).join(" ")]
    for (const sentence of tight) blocks.push(`- ${signpost(title, sentence)}`)
  }
  return blocks.join("\n")
}

export function sectionOrder(card: string): string[] {
  return [...String(card || "").matchAll(/^\*\*([^*]+)\*\*$/gm)].map((m) => m[1])
}
