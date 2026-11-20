// Kompas consistency gate. Local and deterministic: no model call, no poll.
// A cached answer, a mid-confidence stub, an ungrounded tool, or a raw dump
// does not reach the card. The question box, the left answer, and the right
// panel all use the question passed in here.
import { visibleLengthBand, type VisibleLength } from "./kompasDissection.ts"
import { answerWordCount, presentSpokenAnswer, ungroundedProducts } from "./kompasAnswerPresentation.ts"

export const HONEST_LINE = "That is not on my resume, so I will not invent it."

/** How a story answer should be told. No section labels and no First, Next, Finally. */
export const NARRATIVE_LINE = "Tell it as something that happened. Open with the direct answer. Then what he did, in the order he did it, and why he did it that way. Close with the result and one number already in the resume. Sound like a person who was there: calm, interested, specific. No First, Next, or Finally, and no section labels."
const CONFIRM_STUB = /I would want to confirm that/i
const CANNED_ASIDE = /what part of this do you want first|want me to keep this short|where should I stop if this runs long|want me to take that in one pass|why do you think that(?:'s| is) happening|want me to stay on/i

const STOP = new Set("the and you your how did what when where which with have about would could should tell explain describe please that this from for are was were has does into a an to of me my we our do is it on in at or".split(" "))

export function askTokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word))
}

/** True only when the two asks are the same question, not a keyword overlap. */
export function sameQuestion(live: string, cached: string): boolean {
  const a = askTokens(live)
  const b = askTokens(cached)
  if (!a.length || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  const nums = (text: string) => (String(text).match(/\d[\d/.,]*/g) || []).join("|")
  return nums(live) === nums(cached)
}

export type CacheGateInput = {
  liveQuestion: string
  cachedQuestion: string
  liveEpoch?: number | null
  cacheEpoch?: number | null
  liveSession?: string
  cacheSession?: string
}

/**
 * Book, anchor, and restored-card caches serve only the live question.
 * A different epoch or session loses, even when the words overlap.
 */
export function cacheMayServe(input: CacheGateInput): boolean {
  if (!sameQuestion(input.liveQuestion, input.cachedQuestion)) return false
  if (input.liveSession && input.cacheSession && input.liveSession !== input.cacheSession) return false
  if (input.liveEpoch != null && input.cacheEpoch != null && input.liveEpoch !== input.cacheEpoch) return false
  return true
}

const NARRATIVE_TEMPLATE = /\b(?:first|next|finally),|\*\*(?:Claim|Context|Result)\*\*|\blets teams\b|\bI would want to confirm that\b|\bIn general, teams\b|\bAs an? \w+ you\b/i
const NARRATIVE_WHY = /\b(?:because|so that|the reason|so we|so I|needed to|which meant)\b/i
const NARRATIVE_DID = /\bI (?:led|opened|isolated|pulled|checked|mapped|closed|contained|searched|told|started|used|ranked|cut|walked|read|blocked)\b/i
const NARRATIVE_RESULT = /\b(?:contained|closed|reduced|finished|cut|stopped|kept|dropped|stayed)\b/i

export type NarrativeJudgment = {
  ok: boolean
  direct: boolean
  did: boolean
  why: boolean
  result: boolean
  grounded: boolean
  template: boolean
  human: boolean
  words: number
}

/**
 * A story is told, not templated: the direct answer, what he did, why, and a
 * result that keeps a number from the resume. Same input, same judgment.
 */
export function judgeNarrative(question: string, answer: string, source: string): NarrativeJudgment {
  const text = presentSpokenAnswer(question, answer, source)
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const first = sentences[0] || ""
  const template = NARRATIVE_TEMPLATE.test(text)
  const grounded = ungroundedProducts(text, `${source}\n${question}`).length === 0 && !/QA Automation|legacy banking|test framework/i.test(text)
  const direct = /^I\b/.test(first) && !template
  const did = NARRATIVE_DID.test(text)
  const why = NARRATIVE_WHY.test(text)
  const number = (text.match(/\d[\d,]*/g) || []).some((n) => `${source}\n${question}`.includes(n.replace(/[.,]+$/, "")))
  const result = NARRATIVE_RESULT.test(text) && number
  const human = direct && why && sentences.length >= 3 && !/\byou primarily\b/i.test(text) && grounded
  const story = /\b(?:tell me about a time|led the response|walk me through|prioriti[sz]e|incident)\b/i.test(question)
  return {
    ok: story ? direct && did && why && result && !template && grounded && human : direct && grounded && !template && sentences.length >= 2,
    direct,
    did,
    why,
    result,
    grounded,
    template,
    human,
    words: answerWordCount(text),
  }
}

export function lengthBandFor(question: string): VisibleLength {
  return visibleLengthBand(question)
}

/** A clarifying question only when the ask itself is ambiguous. Otherwise none. */
export function clarifyingFromQuestion(question: string): string[] {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (!q) return []
  if (/\bdesign(?:ed|ing)?\b/i.test(q) && /\balone\b/i.test(q)) {
    return ["Do you mean the overall design, or one piece such as failover?"]
  }
  if (/\bdifference\b|\bversus\b|\bvs\.?\b/i.test(q)) return []
  const choice = q.match(/\b(?:the|a|an)\s+([^?]{3,48}?)\s+or\s+(?:the|a|an)\s+([^?]{3,48})/i)
  if (choice && /\?/.test(q)) {
    return [`Do you mean ${choice[1].trim()}, or ${choice[2].trim()}?`]
  }
  return []
}

function resumeLines(resume: string): string[] {
  return String(resume || "")
    .split("\n")
    .map((line) => line.replace(/^[\s•▪●\-*]+/, "").trim())
    .filter((line) => line.split(/\s+/).length >= 6 && !/@|gmail|jayeshwar44|jayeshwar24|eshwarjay06/i.test(line))
    .filter((line) => !/^[^:]{0,56}:\s+\S/.test(line) && !/\b(?:using|via)\.?$/i.test(line))
}

/** Short first-person lines he can say now. Empty when the resume has no overlap. */
export function speakableLines(question: string, resume: string): string[] {
  const bag = new Set(askTokens(question))
  const hits = resumeLines(resume)
    .map((line) => ({ line, score: askTokens(line).filter((word) => bag.has(word)).length }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
  const out: string[] = []
  for (const row of hits) {
    let line = row.line.replace(/[,:;]+$/, "")
    if (!/^I\b/.test(line)) line = `I ${line.charAt(0).toLowerCase()}${line.slice(1)}`
    if (!/\byou\b/i.test(line)) line = `${line.replace(/[.]+$/, "")}, and I can walk you through that`
    if (!/[.!?]$/.test(line)) line = `${line}.`
    if (CANNED_ASIDE.test(line) || ungroundedProducts(line, `${resume}\n${question}`).length) continue
    if (!out.includes(line)) out.push(line)
    if (out.length === 2) break
  }
  return out
}

export type DisplayGate = {
  text: string
  ok: boolean
  reasons: string[]
  words: number
  type: string
  floor: number
  aim: number
  ceiling: number
}

/**
 * One local repair. The returned text is the cleaned answer or the honest line.
 * It is never the raw model string when that string failed a rule.
 */
export function gateDisplayedAnswer(input: { question: string; raw: string; source?: string }): DisplayGate {
  const question = String(input.question || "")
  const raw = String(input.raw || "")
  const source = String(input.source || "")
  const band = visibleLengthBand(question)
  const reasons: string[] = []
  let text = presentSpokenAnswer(question, raw, source)
  if (CONFIRM_STUB.test(raw)) reasons.push("stub")
  if (CONFIRM_STUB.test(text) || !text.trim()) {
    text = raw.trim() ? HONEST_LINE : ""
    if (raw.trim()) reasons.push("honest")
  }
  if (CANNED_ASIDE.test(text) || /\bFirst,\s*-/.test(text) || /\*\*(?:Claim|Context|Action|Result)\*\*/.test(text) || /\bIn general, teams\b/i.test(text)) {
    text = presentSpokenAnswer(question, text, source) || HONEST_LINE
    reasons.push("presentation")
  }
  if (source.trim() && text && text !== HONEST_LINE && ungroundedProducts(text, `${source}\n${question}`).length) {
    text = HONEST_LINE
    reasons.push("ungrounded")
  }
  const words = answerWordCount(text)
  if (text && text !== HONEST_LINE && words > band.ceiling) reasons.push("over-ceiling")
  if (text && text !== HONEST_LINE && words < band.floor) reasons.push("under-floor")
  if (band.type === "experience" && text && text !== HONEST_LINE) {
    const bag = `${source}\n${question}`.toLowerCase()
    const tool = (text.match(/\b(?:Splunk|Qualys|CrowdStrike|CyberArk|Sentinel|QRadar|EDR|SIEM)\b/gi) || []).some((name) => bag.includes(name.toLowerCase()))
    if (!(/\bI\b/.test(text) && tool && /\d/.test(text))) reasons.push("thin-example")
  }
  const safe = !!text
    && !CONFIRM_STUB.test(text)
    && !CANNED_ASIDE.test(text)
    && !/\bFirst,\s*-/.test(text)
    && !/\*\*(?:Claim|Context|Action|Result)\*\*/.test(text)
    && !/\bIn general, teams\b/i.test(text)
    && (!source.trim() || text === HONEST_LINE || ungroundedProducts(text, `${source}\n${question}`).length === 0)
  return {
    text,
    ok: safe,
    reasons,
    words,
    type: band.type,
    floor: band.floor,
    aim: band.aim,
    ceiling: band.ceiling,
  }
}
