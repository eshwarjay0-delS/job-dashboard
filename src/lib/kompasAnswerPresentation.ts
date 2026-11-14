import { dissectQuestion, formatForBand, lengthKind } from "./kompasDissection.ts"
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

/** Drop a figure the resume and the question do not already contain. */
export function withoutInventedNumbers(sentence: string, source: string): string {
  return String(sentence || "")
    .replace(/\d[\d,.]*/g, (n) => (source.includes(n.replace(/[.,]+$/, "")) ? n : ""))
    .replace(/\bby percent\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
}

const HEADER = /^\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*$/
const META_LINE = /\b(?:that (?:part|detail) is not in the sources|not in the (?:sources|resume)|no evidence for|sources or evidence)\b/i
const DICTIONARY = /,\s+or\s+[“"'][^”"']{1,90}[”"'],?\s+is\b/i
const GENERIC_THIRD = /(?:^|\b)(?:(?:first|then|next|finally)\b[:,]?\s+)?in general,\s+teams\b|\bteams (?:start|see|design|build|run)\b|\b(?:next|finally) they\b|\bthey (?:build|run)\b/i

/** Peel a renderer artifact. A First the model actually wrote stays. */
export function peelDisplayArtifact(sentence: string): string {
  let s = String(sentence || "").trim()
  let guard = 0
  while (s && guard++ < 8) {
    const next = s
      .replace(/^(?:[-•*]|\d+[.)])\s+/, "")
      .replace(/^(?:first|then|next|finally|the result)\b[:,]\s+[-–—]\s+/i, "")
      .replace(/^(?:first|then|next|finally),\s+(?=(?:first|then|next|finally)\b)/i, "")
      .replace(/^(?:first|then|next|finally)\b[:,]?\s+(?=once that is established\b)/i, "")
      .replace(/^once that is established\b[:,]?\s+/i, "")
      .replace(/^in addition\b[:,]?\s+/i, "")
      .replace(/^the result\s*:\s+/i, "")
      .replace(/^(?:first|then|next|finally)\b[:,]?\s+(?=(?:failure mode|root cause|touch ?point)\s*:)/i, "")
      .replace(/^(?:failure mode|root cause|touch ?point)\s*:\s*/i, "")
      .trim()
    if (next === s) break
    s = next
  }
  return s.replace(/^in general,\s+(?=(?:I|we|my|our)\b)/i, "").trim()
}

function genericThirdPerson(sentence: string): boolean {
  if (/\bin general,\s+teams\b/i.test(sentence) || /\bteams (?:start|see|design|build|run)\b/i.test(sentence)) return true
  if (/\b(?:I|we|my|our)\b/.test(sentence)) return false
  return GENERIC_THIRD.test(sentence)
}

function ordinalStart(sentence: string): boolean {
  return /^first\b/i.test(sentence)
}

/** At most one leading First. Later ones were the repeated signpost. */
function oneLeadingFirst(lines: string[]): string[] {
  let seen = false
  const out: string[] = []
  for (const line of lines) {
    if (!ordinalStart(line)) { out.push(line); continue }
    if (!seen) { seen = true; out.push(line); continue }
    const rest = line.replace(/^first\b[:,]?\s+/i, "").trim()
    if (rest) out.push(rest.replace(/^([a-z])/, (letter) => letter.toUpperCase()))
  }
  return out
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

/**
 * The card keeps the model's order. It does not insert First, Then, or Finally,
 * and it does not regroup sentences under Claim, Context, or Result.
 */
export function presentSpokenAnswer(question: string, text: string, source = ""): string {
  const asked = cleanHeardQuestion(question)
  const raw = String(text || "").trim()
  if (!raw) return raw
  const intro = INTRO_ASK.test(asked)
  const allowed = `${source}\n${asked}`
  const pieces: string[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || HEADER.test(t) || /^(?:…|\.{3})$/.test(t)) continue
    const chunks = peelDisplayArtifact(t).split(/(?<=[.!?])\s+|\s+-\s+(?=I\b)/)
    for (const chunk of chunks) {
      let s = peelDisplayArtifact(chunk)
      if (!s || DICTIONARY.test(s) || genericThirdPerson(s) || META_LINE.test(s)) continue
      s = withoutInventedNumbers(s, allowed).replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim()
      if (answerWordCount(s) < 3) continue
      if (/^[a-z]/.test(s)) s = s.charAt(0).toUpperCase() + s.slice(1)
      pieces.push(s)
    }
  }
  const ordered = oneLeadingFirst(intro ? pieces.map((s) => s.replace(/^(?:first|then|finally|the result)\b[:,]?\s+/i, "").replace(/^([a-z])/, (letter) => letter.toUpperCase())) : pieces)
    .filter((s) => answerWordCount(s) >= 3 && !META_LINE.test(s) && !genericThirdPerson(s))
  if (!ordered.length) return ""
  if (intro) return ordered.join(" ")
  const band = formatForBand(lengthKind(asked, dissectQuestion(asked).shape), asked)
  const lines = band === "sentences" ? ordered.slice(0, 2) : ordered
  if (band !== "script_bullets" || lines.length < 2) return lines.join(" ")
  return [lines[0], ...lines.slice(1).map((s) => `- ${s}`)].join("\n")
}

export function sectionOrder(card: string): string[] {
  return [...String(card || "").matchAll(/^\*\*([^*]+)\*\*$/gm)].map((m) => m[1])
}
