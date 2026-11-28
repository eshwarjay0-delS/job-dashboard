// Length follows the question, then the level.
// A complexity score (parts, scope, scenario versus fact) is the full Architect
// answer. Technical HR / Engineer is about 0.75 of that. Director is about 0.5.
// Architect has no fixed word cap: a larger question raises the target.

export type LevelName = "engineer" | "architect" | "director"

export type LevelContract = {
  level: LevelName
  quick: boolean
  score: number
  min: number
  max: number
  target: number
  maxTokens: number
  prompt: string
}

const FACTOR: Record<LevelName, number> = {
  architect: 1,
  engineer: 0.75,
  director: 0.5,
}

const JARGON_LIST = /(?:\b[A-Z]{2,}\b\s*,\s*){3,}\b[A-Z]{2,}\b|\b(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)(?:\s*,\s*(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)){2,}/i

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function hasJargonList(text: string): boolean {
  return JARGON_LIST.test(String(text || ""))
}

export function hasPlainReasoning(text: string): boolean {
  return /in plain terms|the reason I|here is how I think|what that means is/i.test(String(text || ""))
}

export function isQuickQuestion(question: string): boolean {
  const t = String(question || "").replace(/\s+/g, " ").trim()
  if (/\b(?:tell me about yourself|tell me about a time|walk me through|how would you|describe a time|design|rolled out|scenario)\b/i.test(t)) return false
  if (/\b(?:what does|stands? for|yes or no|do you know|what is a |what is an )\b/i.test(t) && t.split(/\s+/).length < 16) return true
  return t.split(/\s+/).length <= 8 && /\?\s*$/.test(t)
}

/** Architect-sized word target before the level factor. A typical story or scenario is about 1040. */
export function complexityScore(question: string): number {
  const t = String(question || "").replace(/\s+/g, " ").trim()
  if (isQuickQuestion(t)) return 400
  let score = 1040
  if (/\b(?:brief|briefly|30 seconds|one minute)\b/i.test(t) && /\b(?:introduc|about yourself|who you are)\b/i.test(t)) score = 640
  const asks = (t.match(/\?/g) || []).length
  const clauses = t.split(/\s+(?:and then|and also|;)\s+/i).filter((part) => part.split(/\s+/).length >= 5).length
  const parts = Math.max(asks, clauses)
  if (parts >= 3) score += (parts - 2) * 180
  if (/\b(?:end[- ]to[- ]end|trade-?offs?|data flow|across (?:the |multiple )|several systems)\b/i.test(t)) score += 220
  return score
}

function asLevel(level: string): LevelName {
  if (level === "architect" || level === "director") return level
  return "engineer"
}

function promptFor(level: LevelName, target: number, quick: boolean): string {
  const length = `This question's spoken length is about ${target} words. Do not stop early. No headings, no labels, and no bullet titles in the words he will say aloud.`
  if (level === "architect") {
    return `LEVEL CONTRACT — ARCHITECT. This is the most comprehensive answer, about 90 to 120 percent of the question. ${length} There is no fixed ceiling: a wider question gets a longer answer. Cover the design reasoning, the components, the trade-offs, how the pieces integrate, how the data flows, the risks, how it was rolled out, and how it was verified. Use spoken paragraphs. ${quick ? "This is a short factual question, so scale the full answer down and stay the longest of the three levels." : "A behavioral or scenario answer stays at this length or longer when the question is wider."}`
  }
  if (level === "director") {
    return `LEVEL CONTRACT — DIRECTOR. This is about half the Architect answer, cut to the point. ${length} Use simple words a person in business operations understands. Speak with ownership. Name the decision and the outcome, and still cover the whole question. Do not list deep tool jargon.`
  }
  return `LEVEL CONTRACT — TECHNICAL HR AND ENGINEER. This is about three quarters of the Architect answer, roughly 20 to 30 percent shorter. ${length} Be clear and easy to follow. Sound conversational, like a strong sales engineer, and explain the thought process in plain language. Translate any jargon. Include a sentence that starts with In plain terms.`
}

export function levelContract(level: string, question: string): LevelContract {
  const name = asLevel(level)
  const score = complexityScore(question)
  const target = Math.max(40, Math.round(score * FACTOR[name]))
  const min = Math.round(target * 0.8)
  const max = name === "architect" ? Math.round(target * 1.8) : Math.round(target * 1.2)
  const maxTokens = Math.min(8192, Math.round(target * 2.6) + 500)
  return {
    level: name,
    quick: isQuickQuestion(question),
    score,
    min,
    max,
    target,
    maxTokens,
    prompt: promptFor(name, target, isQuickQuestion(question)),
  }
}

export const CANNED_FILLER = /in plain terms, the reason i work it this way|what that means is i start from the need|i translate the specialist word|the way i would build it starts from the job the system|i own the decision, and i say it in words anyone|i do not walk the build|i say what i chose|the point is the result, said once|i don't have my resume loaded/i

export function sentenceKey(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
}

export function hasRepeatedSentence(text: string): boolean {
  const seen = new Set<string>()
  for (const sentence of String(text || "").split(/(?<=[.!?])\s+/)) {
    const key = sentenceKey(sentence)
    if (key.split(" ").length < 6) continue
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function trimWords(text: string, max: number): string {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(" ")
  const sliced = words.slice(0, max).join(" ")
  const last = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("!"), sliced.lastIndexOf("?"))
  if (last >= Math.floor(sliced.length * 0.6)) return sliced.slice(0, last + 1).trim()
  return sliced.replace(/[^\w)]+$/g, "") + "."
}

/** Drop canned filler and repeated sentences. Never add stock lines. A short answer stays short until a model writes more. */
export function fitLevelAnswer(text: string, contract: LevelContract): string {
  const kept: string[] = []
  const seen = new Set<string>()
  for (const sentence of String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)) {
    const key = sentenceKey(sentence)
    if (!key || CANNED_FILLER.test(sentence) || seen.has(key)) continue
    seen.add(key)
    kept.push(sentence)
  }
  let out = kept.join(" ").replace(/\s+/g, " ").trim()
  if (contract.level === "director") out = out.replace(JARGON_LIST, "the tools").replace(/\s+/g, " ").trim()
  if (contract.level !== "architect" && wordCount(out) > contract.max) out = trimWords(out, contract.max)
  return out
}
