/**
 * Question dissection for Kompas.
 * The interviewer’s words choose the shape, the keywords, and the terms that
 * must not appear. The selected mode chooses length, depth, and confidence.
 * This module does not call a model.
 */
import { interviewIntent, type ReplyIntent } from "./kompasRelevance.ts"
import type { AnswerLevel } from "./kompasAnswer.ts"

export type AnswerShape =
  | "intro"
  | "personal-experience"
  | "comparison"
  | "scenario"
  | "technical-deep-dive"
  | "logistics"
  | "follow-up"
  | "closing"
  | "definition"
  | "direct"
  | "acknowledgement"
  | "value"

export type ModeBand = {
  minWords: number
  targetWords: number
  maxWords: number
  depth: number
  confidence: number
  voice: string
}

export type QuestionDissection = {
  ask: string
  intent: ReplyIntent
  shape: AnswerShape
  keywords: string[]
  banned: string[]
  depthAsked: boolean
  modes: Record<AnswerLevel, ModeBand>
}

const LEVELS: AnswerLevel[] = ["engineer", "architect", "director"]

const STOP = new Set(
  "about after again also and are because been before being between both can could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours tell describe explain give walk share please should has you the for how why did was were our any who its want need make made know mean means work works time example situation question questions role team company yourself myself something anything everything would could should have does did are was were this that with from into about across during using used use tell walk give show name list talk think really very also once ever never always still already here there where when what which who whom whose why how brief briefly quick short".split(/\s+/),
)

const PHRASES = [
  "residual risk", "least privilege", "policy deviation", "policy exception", "compensating control",
  "root cause", "business impact", "privileged access", "service now", "multi factor",
]

type Jargon = { term: string; family: string; product?: boolean }

const JARGON: Jargon[] = [
  { term: "Kerberoasting", family: "attack" },
  { term: "DCSync", family: "attack" },
  { term: "Golden Ticket", family: "attack" },
  { term: "AS-REP roasting", family: "attack" },
  { term: "pass-the-hash", family: "attack" },
  { term: "LSASS", family: "attack" },
  { term: "reverse shell", family: "attack" },
  { term: "Mimikatz", family: "attack", product: true },
  { term: "Cobalt Strike", family: "attack", product: true },
  { term: "BloodHound", family: "attack", product: true },
  { term: "SQL injection", family: "vuln" },
  { term: "cross-site scripting", family: "vuln" },
  { term: "XSS", family: "vuln" },
  { term: "Kubernetes", family: "cloud", product: true },
  { term: "Terraform", family: "cloud", product: true },
  { term: "Kafka", family: "cloud", product: true },
  { term: "service mesh", family: "cloud" },
  { term: "Splunk", family: "detect", product: true },
  { term: "Sentinel", family: "detect", product: true },
  { term: "CrowdStrike", family: "detect", product: true },
  { term: "CyberArk", family: "identity", product: true },
  { term: "Qualys", family: "vuln", product: true },
  { term: "Burp Suite", family: "vuln", product: true },
  { term: "YARA", family: "detect" },
  { term: "SAML", family: "identity" },
  { term: "OAuth", family: "identity" },
  { term: "OIDC", family: "identity" },
  { term: "JWT", family: "identity" },
  { term: "Kerberos", family: "identity" },
  { term: "NIST", family: "gov" },
  { term: "ISO 27001", family: "gov" },
  { term: "SOC 2", family: "gov" },
]

const VOICE: Record<AnswerLevel, string> = {
  engineer: "Measured. Say what it is, why it matters, and one picture. One because is enough. You might name the limit, then stop.",
  director: "Decisive. The decision comes first, then the risk to the operation. I will keep a single line of mechanism and I would not open a build walk.",
  architect: "Precise. I would name the check, and I would say where it fails, the boundary around it, and the mechanism, because that is the build.",
}

/** Targets are the ceilings. Verbose answers trim to these, so the three modes land at least 50% apart. */
const TARGETS: Record<AnswerShape, Record<AnswerLevel, number>> = {
  logistics: { engineer: 16, director: 24, architect: 36 },
  acknowledgement: { engineer: 18, director: 28, architect: 42 },
  closing: { engineer: 24, director: 36, architect: 54 },
  "follow-up": { engineer: 32, director: 48, architect: 72 },
  definition: { engineer: 40, director: 60, architect: 90 },
  direct: { engineer: 44, director: 66, architect: 99 },
  comparison: { engineer: 46, director: 70, architect: 105 },
  value: { engineer: 52, director: 78, architect: 117 },
  scenario: { engineer: 64, director: 96, architect: 144 },
  "technical-deep-dive": { engineer: 96, director: 144, architect: 216 },
  intro: { engineer: 90, director: 135, architect: 204 },
  "personal-experience": { engineer: 110, director: 165, architect: 248 },
}

const DEPTH: Record<AnswerLevel, number> = { engineer: 0.4, director: 0.22, architect: 0.72 }
const CONFIDENCE: Record<AnswerLevel, number> = { engineer: 0.3, director: 0.84, architect: 0.48 }

function band(target: number, level: AnswerLevel): ModeBand {
  return {
    minWords: Math.max(8, Math.round(target * 0.75)),
    targetWords: target,
    maxWords: target,
    depth: DEPTH[level],
    confidence: CONFIDENCE[level],
    voice: VOICE[level],
  }
}

export function modeBand(shape: AnswerShape, level: AnswerLevel): ModeBand {
  const table = TARGETS[shape] || TARGETS.direct
  return band(table[level] || table.engineer, level)
}

export function modesFor(shape: AnswerShape): Record<AnswerLevel, ModeBand> {
  return {
    engineer: modeBand(shape, "engineer"),
    architect: modeBand(shape, "architect"),
    director: modeBand(shape, "director"),
  }
}

export function relativeGap(a: number, b: number): number {
  const floor = Math.min(Math.abs(a), Math.abs(b))
  if (floor === 0) return a === b ? 0 : Infinity
  return Math.abs(a - b) / floor
}

export function modesFiftyApart(shape: AnswerShape): boolean {
  const modes = modesFor(shape)
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < LEVELS.length; j++) {
      const a = modes[LEVELS[i]]
      const b = modes[LEVELS[j]]
      if (relativeGap(a.targetWords, b.targetWords) < 0.5) return false
      if (relativeGap(a.depth, b.depth) < 0.5) return false
      if (relativeGap(a.confidence, b.confidence) < 0.5) return false
    }
  }
  return true
}

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function sentencesOf(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

export function firstSentence(text: string): string {
  return sentencesOf(text)[0] || ""
}

export function trimToWords(text: string, maxWords: number): string {
  const cap = Math.max(1, maxWords)
  const kept: string[] = []
  let count = 0
  for (const sentence of sentencesOf(text)) {
    const n = wordCount(sentence)
    if (kept.length && count + n > cap) break
    kept.push(sentence)
    count += n
  }
  let out = kept.join(" ")
  if (wordCount(out) > cap) {
    out = out.split(/\s+/).slice(0, cap).join(" ").replace(/[,:;]+$/, "")
    if (!/[.!?]$/.test(out)) out += "."
  }
  return out.trim()
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text)
}

export function questionKeywords(question: string): string[] {
  const raw = String(question || "")
  const lower = raw.toLowerCase()
  const found: string[] = []
  for (const phrase of PHRASES) if (lower.includes(phrase)) found.push(phrase)
  for (const match of raw.matchAll(/\b[A-Z][A-Z0-9]{1,6}\b/g)) found.push(match[0])
  for (const token of lower.replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/)) {
    if (token.length < 4 || STOP.has(token) || /^\d+$/.test(token)) continue
    if (found.some((item) => item.toLowerCase().includes(token))) continue
    found.push(token)
  }
  return [...new Set(found)].slice(0, 8)
}

function shapeFromIntent(intent: ReplyIntent): AnswerShape {
  switch (intent) {
    case "introduction": return "intro"
    case "experience-story": return "personal-experience"
    case "comparison": return "comparison"
    case "scenario": return "scenario"
    case "technical-process": return "technical-deep-dive"
    case "logistics": return "logistics"
    case "follow-up": return "follow-up"
    case "closing-question": return "closing"
    case "definition": return "definition"
    case "acknowledgement": return "acknowledgement"
    case "value": return "value"
    default: return "direct"
  }
}

function depthAsked(question: string, shape: AnswerShape): boolean {
  return shape === "technical-deep-dive" || /\b(step by step|under the hood|in detail|deep dive|how does|how do)\b/i.test(question)
}

export function bannedTerms(question: string, sources: string, shape: AnswerShape): string[] {
  const hay = `${question}\n${sources}`
  const deep = depthAsked(question, shape)
  const families = new Set(JARGON.filter((item) => containsTerm(hay, item.term)).map((item) => item.family))
  return JARGON.filter((item) => {
    if (containsTerm(hay, item.term)) return false
    if (item.product) return true
    if (deep && families.has(item.family)) return false
    return true
  }).map((item) => item.term)
}

export function dissectQuestion(question: string, sources = ""): QuestionDissection {
  const ask = String(question || "").replace(/\s+/g, " ").trim()
  const intent = interviewIntent(ask)
  const shape = shapeFromIntent(intent)
  return {
    ask,
    intent,
    shape,
    keywords: questionKeywords(ask),
    banned: bannedTerms(ask, sources, shape),
    depthAsked: depthAsked(ask, shape),
    modes: modesFor(shape),
  }
}

export function dissectionPrompt(question: string, level: AnswerLevel, sources = ""): string {
  const cut = dissectQuestion(question, sources)
  const mode = cut.modes[level] || cut.modes.engineer
  const echo = cut.keywords.slice(0, 4).join(", ")
  const ban = cut.banned.slice(0, 20).join(", ")
  return [
    `QUESTION DISSECTION. Shape: ${cut.shape}. Intent: ${cut.intent}.`,
    echo ? `The first sentence must use the interviewer's own words: ${echo}.` : "The first sentence answers the ask in the interviewer's own terms.",
    `Mode ${level}. Write at most ${mode.maxWords} words and at least ${mode.minWords} if the question needs it. Stop at the end of the answer. ${mode.voice}`,
    ban ? `Banned unless the question already used them: ${ban}.` : "",
    "Do not reuse the previous answer. Do not add a second topic.",
  ].filter(Boolean).join("\n")
}

const PROVIDER_ERROR = /\bopenrouter\b|\btry again in\s+\d|\btokens per minute\b|\bOPENROUTER_[A-Z0-9_]+\b|\banswer engine is at its limit\b|\bpaid provider is temporarily\b|\bpaid answer service returned\b/i

export function isProviderErrorAnswer(text: string): boolean {
  return PROVIDER_ERROR.test(String(text || ""))
}

export function overlapRatio(a: string, b: string): number {
  const left = new Set(contentTokens(a))
  const right = new Set(contentTokens(b))
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.min(left.size, right.size)
}

function contentTokens(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word))
}

export function scoreDepth(text: string): number {
  const hits = (String(text || "").match(/\b(because|fails|boundary|mechanism|trade-?off|component|setting)\b/gi) || []).length
  return Math.max(0.05, hits)
}

export function scoreConfidence(text: string): number {
  const decisive = (String(text || "").match(/\b(I would|I will|the decision|I start|I ask|I choose|I keep)\b/gi) || []).length
  const hedge = (String(text || "").match(/\b(maybe|perhaps|I think|might|possibly|I guess)\b/gi) || []).length
  return Math.max(0.05, decisive * 2 - hedge)
}

export type SpokenAssessment = {
  text: string
  words: number
  providerError: boolean
  banned: string[]
  missingEcho: boolean
  repeated: boolean
  inBand: boolean
}

const ECHO_OPTIONAL = new Set<AnswerShape>(["intro", "closing", "logistics", "acknowledgement"])

export function settleSpokenAnswer(
  question: string,
  answer: string,
  level: AnswerLevel,
  sources = "",
  previousAnswer = "",
  ceiling?: number,
): SpokenAssessment {
  const cut = dissectQuestion(question, sources)
  const mode = cut.modes[level] || cut.modes.engineer
  const cap = ceiling && ceiling > 0 ? ceiling : mode.maxWords
  if (isProviderErrorAnswer(answer)) {
    return { text: "", words: 0, providerError: true, banned: [], missingEcho: false, repeated: false, inBand: false }
  }
  const kept = sentencesOf(answer).filter((sentence) => !cut.banned.some((term) => containsTerm(sentence, term)))
  const stripped = stripListMarkers(kept.join(" "))
  const text = trimToWords(stripped, cap)
  const opening = firstSentence(text).toLowerCase()
  const missingEcho = !ECHO_OPTIONAL.has(cut.shape) && cut.keywords.length > 0 && !cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase()))
  const repeated = Boolean(previousAnswer) && questionKeywords(question).length > 0 && overlapRatio(text, previousAnswer) >= 0.85
  const words = wordCount(text)
  const banned = cut.banned.filter((term) => containsTerm(text, term))
  const minWords = ceiling && ceiling > 0 ? Math.min(mode.minWords, ceiling) : mode.minWords
  return {
    text,
    words,
    providerError: false,
    banned,
    missingEcho,
    repeated,
    inBand: words >= minWords && words <= cap && !missingEcho && !banned.length && !repeated,
  }
}

function stripListMarkers(text: string): string {
  return text
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

export type LiveAnswer = { question: string; level: AnswerLevel; text: string }

/** No-model relevance gate used by the live eval and by the fixture tests. */
export function evaluateLiveAnswers(rows: LiveAnswer[], sources = ""): { ok: boolean; failures: string[] } {
  const failures: string[] = []
  const grouped = new Map<string, LiveAnswer[]>()
  for (const row of rows) {
    const list = grouped.get(row.question) || []
    list.push(row)
    grouped.set(row.question, list)
    if (isProviderErrorAnswer(row.text)) failures.push(`provider error text in ${row.level}: ${row.question}`)
    const cut = dissectQuestion(row.question, sources)
    const mode = cut.modes[row.level]
    const words = wordCount(row.text)
    if (words < mode.minWords || words > mode.maxWords) failures.push(`length ${words} outside ${mode.minWords}-${mode.maxWords} for ${row.level}: ${row.question}`)
    const opening = firstSentence(row.text).toLowerCase()
    if (!ECHO_OPTIONAL.has(cut.shape) && cut.keywords.length && !cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase()))) {
      failures.push(`missing question terms for ${row.level}: ${row.question}`)
    }
    const banned = cut.banned.filter((term) => containsTerm(row.text, term))
    if (banned.length) failures.push(`ungrounded jargon (${banned.join(", ")}) for ${row.level}: ${row.question}`)
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].question !== rows[j].question && overlapRatio(rows[i].text, rows[j].text) >= 0.85) {
        failures.push(`same answer for different questions: "${rows[i].question}" and "${rows[j].question}"`)
      }
    }
  }
  for (const [question, group] of grouped) {
    const byLevel = new Map(group.map((row) => [row.level, row]))
    for (let i = 0; i < LEVELS.length; i++) {
      for (let j = i + 1; j < LEVELS.length; j++) {
        const a = byLevel.get(LEVELS[i])
        const b = byLevel.get(LEVELS[j])
        if (!a || !b) continue
        const lengthGap = relativeGap(wordCount(a.text), wordCount(b.text))
        const depthGap = relativeGap(scoreDepth(a.text), scoreDepth(b.text))
        const confidenceGap = relativeGap(scoreConfidence(a.text), scoreConfidence(b.text))
        if (lengthGap < 0.5) failures.push(`length gap ${lengthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (depthGap < 0.5) failures.push(`depth gap ${depthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (confidenceGap < 0.5) failures.push(`confidence gap ${confidenceGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
      }
    }
  }
  return { ok: failures.length === 0, failures }
}

function resumeSentence(resume: string, keywords: string[]): string {
  const lines = String(resume || "")
    .replace(/[#*`]/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/@/.test(line) && !/^fictional\b/i.test(line) && !/^jordan hale\b/i.test(line))
  const hit = lines.find((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())))
  return (hit || "").replace(/\b(because|fails|boundary|mechanism|might|I would|I will|the decision)\b/gi, "").replace(/\s+/g, " ").trim()
}

/** Code-level spoken draft. It is the engine we can diff without a model. */
export function draftSpokenAnswer(question: string, level: AnswerLevel, resume: string): string {
  const cut = dissectQuestion(question, resume)
  const lead = [...cut.keywords].sort((a, b) => b.length - a.length)[0] || "this ask"
  const fact = resumeSentence(resume, cut.keywords).split(/\s+/).slice(0, 6).join(" ")
  const supported = fact ? `The record says ${fact}.` : "The record does not add a number here."
  const opening: Record<AnswerLevel, string> = {
    engineer: `I might answer ${lead} as I would, because that is the ask.`,
    director: `The decision I would give, and I will give, on ${lead} is the risk.`,
    architect: `I would trace ${lead} and I would say where it fails, the boundary, and the mechanism, because that holds.`,
  }
  const pads: Record<AnswerLevel, string[]> = {
    engineer: [
      `The picture of ${lead} is the one use in this role.`,
      `The work already shows where ${lead} fits.`,
      `Nothing past ${lead} belongs in this answer.`,
    ],
    director: [
      `The operation carries that risk on ${lead} the same day.`,
      `What matters about ${lead} is the effect on the work.`,
      `I leave ${lead} once the owner can act on it.`,
    ],
    architect: [
      `The next part of ${lead} is the order a listener can repeat.`,
      `Each step of ${lead} has one result that confirms it.`,
      `I stay on ${lead} until that order is clear.`,
    ],
  }
  const mode = cut.modes[level]
  let text = opening[level]
  if (wordCount(`${text} ${supported}`) <= mode.targetWords) text = `${text} ${supported}`
  let padIndex = 0
  while (wordCount(text) < mode.targetWords && padIndex < 24) {
    const bit = pads[level][padIndex % pads[level].length]
    padIndex += 1
    const next = `${text} ${bit}`.replace(/\s+/g, " ").trim()
    if (wordCount(next) > mode.targetWords) {
      const need = mode.targetWords - wordCount(text)
      text = `${text} ${bit.split(/\s+/).slice(0, need).join(" ")}`.replace(/\s+/g, " ").trim()
      break
    }
    text = next
  }
  if (!/[.!?]$/.test(text)) text += "."
  return trimToWords(text, mode.targetWords)
}
