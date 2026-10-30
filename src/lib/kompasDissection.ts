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
  /** What the prompt asks for. Below the ceiling by a per-mode share, so real answers land 50% apart, not only their ceilings. */
  aimWords: number
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
  "about after again also and are because been before being between both can could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours tell describe explain give walk share please should has you the for how why did was were our any who its want need make made know mean means work works time example situation question questions role team company yourself myself something anything everything would could should have does did are was were this that with from into about across during using used use tell walk give show name list talk think really very also once ever never always still already here there where when what which who whom whose why how brief briefly quick short keep suitable define state now same deeper first going interviewer simple simply plain words".split(/\s+/),
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

// Plain instructions only. The v1 wording ("I would not open a build walk", "One because is enough") was written to
// hit the depth and confidence word counters, and a model copies odd phrasing into the spoken answer.
const VOICE: Record<AnswerLevel, string> = {
  engineer: "Plain and accessible, for technical HR or an engineer screen. Say what it is, why the role needs it, and one example from my own work. Then stop.",
  director: "Decision first, then the business risk and who owns it. At most one sentence on how it works. No build walkthrough.",
  architect: "Precise. Say how it works, where it breaks, and what contains it. Use only the technical terms the question or my resume already uses.",
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

const AIM: Record<AnswerLevel, number> = { engineer: 0.75, director: 0.9, architect: 0.95 }
const DEPTH: Record<AnswerLevel, number> = { engineer: 0.4, director: 0.22, architect: 0.72 }
const CONFIDENCE: Record<AnswerLevel, number> = { engineer: 0.3, director: 0.84, architect: 0.48 }

function band(target: number, level: AnswerLevel): ModeBand {
  return {
    minWords: Math.max(8, Math.round(target * 0.4)),
    targetWords: target,
    maxWords: target,
    aimWords: Math.round(target * AIM[level]),
    depth: DEPTH[level],
    confidence: CONFIDENCE[level],
    voice: VOICE[level],
  }
}

export function modeBand(shape: AnswerShape, level: AnswerLevel, scale = 1): ModeBand {
  const table = TARGETS[shape] || TARGETS.direct
  return band(Math.round((table[level] || table.engineer) * scale), level)
}

/** One scale for all three modes, so the 50% gaps between them hold for a long multi-part ask too. */
export function modesFor(shape: AnswerShape, scale = 1): Record<AnswerLevel, ModeBand> {
  return {
    engineer: modeBand(shape, "engineer", scale),
    architect: modeBand(shape, "architect", scale),
    director: modeBand(shape, "director", scale),
  }
}

/**
 * How many separate things the interviewer listed. "Explain trust boundaries, data flow, failure isolation,
 * rollout and validation" is five. Each one needs a sentence, so a five-part ask gets a longer ceiling than a
 * one-part ask of the same shape (measured: hitachi-grc-5 named three parts and had a 70-word Director ceiling).
 */
export function askedParts(question: string): number {
  const topic = topicOfAsk(question)
  let total = 0
  for (const clause of topic.split(/[.?!;]\s+/).filter((c) => c.trim().split(/\s+/).length >= 3)) {
    const commas = (clause.match(/,/g) || []).length
    total += commas >= 1 ? commas + (/\band\b/i.test(clause.split(",").pop() || "") ? 2 : 1) : 1
  }
  return Math.max(1, total)
}

export function partsScale(question: string): number {
  const parts = askedParts(question)
  return parts >= 3 ? Math.min(1.3, 1 + 0.1 * (parts - 2)) : 1
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

/**
 * Cut at the ceiling on a sentence boundary. A sentence that `mustKeep` marks (a repaired rejected alternative,
 * a numbered hypothesis, the decision owner) is kept even past the ceiling and the plain sentences around it give
 * way first, so the cut never undoes a repair the answer was just given.
 */
export function trimToWords(text: string, maxWords: number, mustKeep?: (sentence: string) => boolean): string {
  const cap = Math.max(1, maxWords)
  const all = sentencesOf(text)
  const pinned = new Set<number>()
  if (mustKeep) all.forEach((sentence, i) => { if (i > 0 && mustKeep(sentence)) pinned.add(i) })
  let budget = cap - [...pinned].reduce((sum, i) => sum + wordCount(all[i]), 0)
  const keep = new Set<number>(pinned)
  let full = false
  for (let i = 0; i < all.length; i++) {
    if (pinned.has(i)) continue
    const n = wordCount(all[i])
    if (full || (i > 0 && n > budget)) { full = true; continue }
    keep.add(i)
    budget -= n
  }
  const kept = all.filter((_, i) => keep.has(i))
  let out = kept.join(" ")
  if (pinned.size) return out.trim()
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

/**
 * The topic part of the ask. Audience and format instructions ("Keep it suitable for technical HR",
 * "explain it to a director", "in two minutes") steer the mode, not the topic, so they are not keywords.
 */
export function topicOfAsk(question: string): string {
  return String(question || "")
    .replace(/\b(?:keep|make) it (?:suitable|simple|short|brief|plain)[^.?!]*[.?!]?/gi, " ")
    .replace(/\b(?:for|to) (?:a |an |the )?(?:technical hr|non-technical|recruiter|director|executive|cfo|ceo|business audience|hiring manager)\b/gi, " ")
    .replace(/\bin (?:one|two|three|\d+) (?:minutes?|sentences?|lines?)\b/gi, " ")
    .replace(/\bwithout inventing achieved numbers\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Idea D (stress round 3, 29 Oct 2026): a follow-up is tied to the previous question in code as
 * `ask — following up on: "previous"?`. The tag is ours, not the interviewer's: the follow-up's own words lead and the
 * previous question only adds topic, so "following" was never a keyword and the intent was not read off the old ask.
 */
const FOLLOW_UP_TAG = /\s+—\s+following up on:\s+"([^"]*)"\??\s*$/
export function splitFollowUp(question: string): { own: string; previous: string } {
  const text = String(question || "")
  const m = text.match(FOLLOW_UP_TAG)
  if (!m) return { own: text, previous: "" }
  const own = text.slice(0, m.index).trim()
  // Failsafe: an empty follow-up part (never expected) keeps the whole text, so the ask is never lost.
  return own ? { own: /[?.!]$/.test(own) ? own : `${own}?`, previous: m[1].trim() } : { own: text, previous: "" }
}

export function questionKeywords(question: string): string[] {
  const tied = splitFollowUp(question)
  if (tied.previous) return [...new Set([...questionKeywords(tied.own), ...questionKeywords(tied.previous)])].slice(0, 8)
  const raw = topicOfAsk(question)
  const lower = raw.toLowerCase()
  const found: string[] = []
  for (const phrase of PHRASES) if (lower.includes(phrase)) found.push(phrase)
  for (const match of raw.matchAll(/\b[A-Z][A-Z0-9]{1,6}\b/g)) found.push(match[0])
  for (const rawToken of lower.replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/)) {
    const token = rawToken.replace(/^[.\-]+|[.\-]+$/g, "")
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
  return shape === "technical-deep-dive" || /\b(step by step|under the hood|in detail|deep dive|go deeper|deeper on|walk (?:me )?through|how does|how do)\b/i.test(question)
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

/**
 * Stress round 2 (29 Oct 2026): speech fillers decided the cut. "Tell me about uh yourself" was not an intro, and
 * "the uh resid jewel risk thing" made "thing" a keyword. Fillers, doubled words and a trailing "thing" go before the
 * intent and keywords are read; the ask itself is returned as heard.
 */
export function cleanSpokenAsk(question: string): string {
  const out = String(question || "")
    .replace(/\b(?:um+|uh+|erm+|er|hmm+)\b[,.]?/gi, " ")
    .replace(/\b(?:you know|i mean|sort of|kind of)\b,?/gi, " ")
    .replace(/(^|[\s,])like,?(?=\s+(?:what|how|why|the|a|an|inherent|residual|\w+ing)\b)/gi, "$1")
    .replace(/^\s*(?:so|okay so|ok so|alright so|well)[,\s]+/i, "")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\s+(?:thing|stuff)(?=\s*[?.!]*\s*$)/i, "")
    .replace(/\s+([?.!,])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  // Failsafe: an ask that is only filler keeps its words, so nothing is lost.
  return out || String(question || "").trim()
}

export function dissectQuestion(question: string, sources = ""): QuestionDissection {
  const ask = String(question || "").replace(/\s+/g, " ").trim()
  const tied = splitFollowUp(cleanSpokenAsk(ask))
  const own = interviewIntent(tied.own)
  // A tied follow-up keeps its own intent when it has one; a generic one ("what would you monitor?") is a follow-up.
  const intent: ReplyIntent = tied.previous && (own === "direct" || own === "acknowledgement") ? "follow-up" : own
  let shape = shapeFromIntent(intent)
  // "Go deeper on that failure" was a direct answer with a 99-word Architect ceiling. Asked depth wins over a
  // generic shape; it never turns an intro, a story, or a logistics ask into a deep dive.
  if ((shape === "direct" || shape === "follow-up") && depthAsked(ask, shape)) shape = "technical-deep-dive"
  return {
    ask,
    intent,
    shape,
    keywords: questionKeywords(cleanSpokenAsk(ask)),
    banned: bannedTerms(ask, sources, shape),
    depthAsked: depthAsked(ask, shape),
    modes: modesFor(shape, partsScale(ask)),
  }
}

// Same trigger the service uses for its coding block (CODE_ASK_Q), narrowed to an actual request for code so a
// question that only mentions "function" in passing is not forced into a code block.
const CODE_REQUEST_Q = /\b(?:write|implement|code up|show me the code|give me (?:the )?code)\b[^?]*\b(?:code|function|script|query|program|class|regex|algorithm|endpoint|test)\b|\b(?:sql query|regex (?:to|for)|unit test for)\b/i
export function asksForCode(question: string): boolean {
  const tied = splitFollowUp(question)
  // "Can you also add unit tests?" after a coding ask is still a coding ask; any other follow-up is judged on its own words.
  if (tied.previous) return CODE_REQUEST_Q.test(tied.own) || (CODE_REQUEST_Q.test(tied.previous) && /\b(?:tests?|code|function|index|query|edge cases?|complexity|handle|refactor)\b/i.test(tied.own))
  return CODE_REQUEST_Q.test(String(question || ""))
}

export function dissectionPrompt(question: string, level: AnswerLevel, sources = ""): string {
  const cut = dissectQuestion(question, sources)
  const mode = cut.modes[level] || cut.modes.engineer
  const echo = cut.keywords.slice(0, 4).join(", ")
  const ban = cut.banned.slice(0, 20).join(", ")
  return [
    `QUESTION DISSECTION. Shape: ${cut.shape}. Intent: ${cut.intent}.`,
    echo ? `The first sentence must use the interviewer's own words: ${echo}.` : "The first sentence answers the ask in the interviewer's own terms.",
    asksForCode(question)
      ? `Mode ${level}. Code first at every level: one fenced, runnable block in the language asked for, before any words. After the block, at most ${mode.aimWords} spoken words. ${mode.voice}`
      : `Mode ${level}. Aim for about ${mode.aimWords} words and never more than ${mode.maxWords}. Stop as soon as the question is answered. ${mode.voice}`,
    ban ? `Banned unless the question already used them: ${ban}.` : "",
    "Do not reuse the previous answer. Do not add a second topic.",
  ].filter(Boolean).join("\n")
}

const PROVIDER_ERROR = /\bopenrouter\b|\btry again in\s+\d|\btokens per minute\b|\bOPENROUTER_[A-Z0-9_]+\b|\banswer engine is at its limit\b|\bpaid provider is temporarily\b|\bpaid answer service returned\b/i

// Stress round 3 (29 Oct 2026): nine of ten raw provider or gateway failures ("Error: Request failed with status code 429",
// "502 Bad Gateway", a JSON error body, "model is overloaded", a context-length refusal, a model refusal) were not
// recognised, so settle would have shown them as the answer. These shapes only count when the text IS the failure:
// short, or opening with it. A real answer that mentions a 502 or rate limiting while explaining a design is kept.
const PROVIDER_FAILURE_SHAPE = [
  /^\s*\{\s*"error"\s*:/i,
  /^\s*(?:error\b|request failed\b)/i,
  /\bstatus code (?:4\d\d|5\d\d)\b/i,
  /^\s*(?:4\d\d|5\d\d)\s+(?:bad gateway|gateway time-?out|service unavailable|internal server error|too many requests|payment required)\b/i,
  /^\s*(?:internal server error|bad gateway|service unavailable|gateway time-?out|too many requests)[.!]?\s*$/i,
  /\bupstream connect error\b|\bdisconnect\/reset before headers\b/i,
  /\brate limit (?:exceeded|reached)\b|\bplease retry later\b/i,
  /\binsufficient (?:credits|quota|balance)\b|\bquota exceeded\b/i,
  /\b(?:model|server) is (?:currently )?overloaded\b/i,
  /\bmaximum context length\b|\bcontext[_ ]length[_ ]exceeded\b/i,
  /^\s*(?:i'm sorry|i am sorry|sorry),? (?:but )?i (?:can't|cannot|am unable to|won't) (?:help|assist|comply|answer)\b/i,
  /^\s*as an ai(?: language model)?\b/i,
]
export function isProviderErrorAnswer(text: string): boolean {
  const t = String(text || "")
  if (PROVIDER_ERROR.test(t)) return true
  const short = wordCount(t) <= 30
  return PROVIDER_FAILURE_SHAPE.some((re) => re.test(t) && (short || re.source.startsWith("^")))
}

/** Shared content words over all content words of both answers (Jaccard). Two grounded answers may share a resume line; the same answer shares nearly everything. */
export function sameAnswerRatio(a: string, b: string): number {
  const left = new Set(contentTokens(a))
  const right = new Set(contentTokens(b))
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / (left.size + right.size - shared)
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
  // Code-first: a fenced block is shown exactly as written, at every level. Only the prose around it is settled.
  const fence = String(answer || "").match(/```[\s\S]*?```/)
  if (fence) {
    const prose = String(answer).replace(fence[0], " ").replace(/\s+/g, " ").trim()
    const around = prose ? trimToWords(stripListMarkers(prose), cap) : ""
    const text = [fence[0], around].filter(Boolean).join("\n\n")
    return { text, words: wordCount(around), providerError: false, banned: [], missingEcho: false, repeated: false, inBand: true }
  }
  // An asked repeat ("say that again") keeps every sentence; only an unasked read-back is trimmed.
  const askedRepeat = /\b(?:repeat|again|once more|say that|same answer)\b/i.test(question)
  const spoken = askedRepeat ? spokenMarkup(answer) : dropRepeatedSentences(spokenMarkup(answer), previousAnswer)
  const kept = sentencesOf(spoken).filter((sentence) => !cut.banned.some((term) => containsTerm(sentence, term)))
  const stripped = stripListMarkers(kept.join(" "))
  const text = trimToWords(stripped, cap, (sentence) => requiredSentence(question, sentence))
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

/**
 * A sentence that carries a part the question explicitly asked for. Measured in rounds 11-14 (hitachi-grc Q2, Q3):
 * the repair added the rejected alternative and the numbered hypotheses at the end, and the ceiling cut removed
 * exactly those sentences again.
 */
export function requiredSentence(question: string, sentence: string): boolean {
  const q = String(question || "")
  if (/\bhypothes/i.test(q) && /\bhypothesis\s+\d/i.test(sentence)) return true
  if (/\b(design|architect|approach|trade-?off|versus|vs\.?)\b/i.test(q) && /\b(rejected|instead of|rather than|the alternative|i ruled out|i chose .+ over)\b/i.test(sentence)) return true
  if (/\bowner\b/i.test(q) && /\bowner\b|\bowns\b/i.test(sentence)) return true
  if (/\bmeasures?\b|\bmetrics?\b|\btrack\b/i.test(q) && /\b(measure|metric|track)/i.test(sentence)) return true
  if (/\b(exit criterion|stop condition|falsifiable)\b/i.test(q) && /\b(exit|stop|falsif|disprove)/i.test(sentence)) return true
  for (const code of q.match(/\b\d{2,4}-\d{1,3}\b/g) || []) if (sentence.includes(code)) return true
  return false
}

/**
 * Stress round 4 (29 Oct 2026): the model sometimes writes for a page, not for speech ("## Answer", "**Residual risk**",
 * "Answer: ..."). Those were read out as written. Only the markup goes; every word of the answer stays.
 */
export function spokenMarkup(text: string): string {
  const out = String(text || "")
    .replace(/^\s{0,3}#{1,6}\s*(?:(?:short |spoken |final )?answer|response|summary)\s*:?\s*$/gim, "")
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, (_, heading: string) => (/[.?!:]$/.test(heading.trim()) ? heading.trim() : `${heading.trim()}.`))
    .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a: string, b: string) => a || b)
    .replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,;:!?]|$)/g, "$1$2")
    .replace(/\[([^\]\n]+)\]\((?:https?:)?[^)\s]*\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*(?:(?:short|spoken|final|my)\s+)?(?:answer|response)\s*[:\-–—]\s*/i, "")
    .trim()
  // Failsafe: markup-only text (never expected) keeps the original rather than showing nothing.
  return out || String(text || "")
}

/**
 * Stress round 4: when the model reads back the previous answer, the sentences it already said are dropped. If too
 * little is left to stand as an answer, the text is kept as written (the repeated flag still reports it).
 */
export function dropRepeatedSentences(text: string, previousAnswer = ""): string {
  if (!previousAnswer) return text
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const said = new Set(sentencesOf(previousAnswer).map(key).filter((k) => k.split(" ").length >= 5))
  const all = sentencesOf(text)
  const fresh = all.filter((sentence) => !said.has(key(sentence)))
  if (fresh.length === all.length) return text
  return fresh.length && wordCount(fresh.join(" ")) >= 8 ? fresh.join(" ") : text
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
const GAP_EXEMPT = new Set<AnswerShape>(["logistics", "acknowledgement"])

/**
 * Hard failures: provider error text, outside the mode band, first sentence without the question's words, an
 * ungrounded tool, the same answer for different questions (same mode, Jaccard >= 0.7), or two modes under 50%
 * apart on length. Depth and confidence gaps are word-count heuristics, so they are warnings, not failures:
 * failing on them taught the offline draft to stuff "because" and "I would" into every sentence.
 * A yes-or-no logistics answer is not stretched to make Architect 50% longer than Engineer.
 */
export function evaluateLiveAnswers(rows: LiveAnswer[], sources = ""): { ok: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = []
  const warnings: string[] = []
  const grouped = new Map<string, LiveAnswer[]>()
  for (const row of rows) {
    const list = grouped.get(row.question) || []
    list.push(row)
    grouped.set(row.question, list)
    if (isProviderErrorAnswer(row.text)) failures.push(`provider error text in ${row.level}: ${row.question}`)
    const cut = dissectQuestion(row.question, sources)
    const mode = cut.modes[row.level]
    const code = asksForCode(row.question)
    if (code && !/^\s*```/.test(row.text)) failures.push(`code question without a fenced block first for ${row.level}: ${row.question}`)
    // For a code answer only the words after the block are measured; the block itself is the answer.
    const prose = code ? row.text.replace(/```[\s\S]*?(?:```|$)/g, " ") : row.text
    const words = wordCount(prose)
    if ((!code && words < mode.minWords) || words > mode.maxWords) failures.push(`length ${words} outside ${mode.minWords}-${mode.maxWords} for ${row.level}: ${row.question}`)
    const opening = firstSentence(prose).toLowerCase()
    if (!code && !ECHO_OPTIONAL.has(cut.shape) && cut.keywords.length && !cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase()))) {
      failures.push(`missing question terms for ${row.level}: ${row.question}`)
    }
    const banned = cut.banned.filter((term) => containsTerm(row.text, term))
    if (banned.length) failures.push(`ungrounded jargon (${banned.join(", ")}) for ${row.level}: ${row.question}`)
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].question !== rows[j].question && rows[i].level === rows[j].level && sameAnswerRatio(rows[i].text, rows[j].text) >= 0.7) {
        failures.push(`same answer for different questions: "${rows[i].question}" and "${rows[j].question}"`)
      }
    }
  }
  for (const [question, group] of grouped) {
    const exempt = GAP_EXEMPT.has(dissectQuestion(question, sources).shape) || asksForCode(question)
    const byLevel = new Map(group.map((row) => [row.level, row]))
    for (let i = 0; i < LEVELS.length; i++) {
      for (let j = i + 1; j < LEVELS.length; j++) {
        const a = byLevel.get(LEVELS[i])
        const b = byLevel.get(LEVELS[j])
        if (!a || !b) continue
        const lengthGap = relativeGap(wordCount(a.text), wordCount(b.text))
        const depthGap = relativeGap(scoreDepth(a.text), scoreDepth(b.text))
        const confidenceGap = relativeGap(scoreConfidence(a.text), scoreConfidence(b.text))
        if (lengthGap < 0.5) (exempt ? warnings : failures).push(`length gap ${lengthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (depthGap < 0.5) warnings.push(`depth gap ${depthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (confidenceGap < 0.5) warnings.push(`confidence gap ${confidenceGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
      }
    }
  }
  return { ok: failures.length === 0, failures, warnings }
}

/** The experience lines of a resume, in the candidate's order. Header, name, contact, and education are not experience. */
export function experienceLines(resume: string): string[] {
  const text = String(resume || "").replace(/[*`]/g, " ")
  const section = text.match(/^#+\s*(?:experience|work history|professional experience)\b[^\n]*\n([\s\S]*?)(?=^#+\s|\s*$(?![\s\S]))/im)
  const body = section ? section[1] : text
  return body
    .split(/\n+/)
    .map((line) => line.replace(/^[-•\s#]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => wordCount(line) >= 6 && !/@|https?:|^fictional\b|^b\.?s\.?\b|^education\b/i.test(line))
}

function firstPerson(line: string): string {
  const clean = line.replace(/[.\s]+$/, "")
  if (/^(?:I|We|My)\b/.test(clean)) return `${clean}.`
  if (/^(?:[A-Z][a-z]*ed|Wrote|Sent|Led|Built|Made|Took|Told|Kept|Set|Ran|Drove|Taught|Brought|Thought|Held|Won|Grew|Gave|Spoke|Met|Found|Began|Ran|Rewrote|Ran)\b/.test(clean)) return `I ${clean[0].toLowerCase()}${clean.slice(1)}.`
  return `In my work, ${clean[0].toLowerCase()}${clean.slice(1)}.`
}

/**
 * The interviewer's own phrase: the ask with its question frame taken off ("Tell me about a time you",
 * "What is the difference between", "Are you able to", "How do you"), so the answer can open on those exact words.
 */
export function leadPhrase(question: string): string {
  const tied = splitFollowUp(cleanSpokenAsk(question))
  question = tied.previous ? tied.own : cleanSpokenAsk(question)
  let topic = (topicOfAsk(question).split(/(?<=[a-z0-9)])[?!.]\s+/i)[0] || "").replace(/[?!.]+\s*$/, "").trim()
  const frames = [
    /^(?:so,?\s+|and\s+|now,?\s+)/i,
    /^(?:can|could|would) you\s+(?:please\s+)?(?:tell me|explain|describe|walk me through|share)\s+(?:about\s+)?/i,
    /^(?:can|could|would) you\s+(?:also\s+)?(?:add|include)\s+(?:an?\s+|the\s+|some\s+)?/i,
    /^what about\s+/i,
    /^what would you\s+/i,
    /^tell me about (?:a time (?:when )?(?:you|that you)\s+)?/i,
    /^(?:give me an example of (?:a time )?(?:when )?(?:you\s+)?)/i,
    /^what(?:'s| is) the difference between\s+/i,
    /^what(?:'s| is| are| does| do)\s+(?:a |an |the )?/i,
    /^(?:how|why) (?:do|did|would|does|is|are) (?:you\s+)?/i,
    /^(?:are|were) you (?:able|willing|comfortable|open) to\s+/i,
    /^(?:do|did|have|has) you\s+/i,
    /^(?:define|explain|describe|compare)\s+/i,
  ]
  for (let i = 0; i < 3; i++) for (const frame of frames) topic = topic.replace(frame, "")
  topic = topic.replace(/\s+(?:mean|means|work|works)$/i, "").replace(/\s+/g, " ").trim()
  const words = topic.split(/\s+/).filter(Boolean)
  if (!words.length) return questionKeywords(question)[0] || "this question"
  if (/^[A-Z][a-z]/.test(words[0])) words[0] = words[0].toLowerCase()
  return words.slice(0, 9).join(" ").replace(/[,;:]+$/, "")
}

/** The separate things the interviewer listed, in order: "trust boundaries, data flow, failure isolation, rollout and validation". */
export function askedPartList(question: string): string[] {
  const out: string[] = []
  for (const clause of topicOfAsk(question).split(/(?<=[a-z0-9)])[?!.]\s+/i)) {
    if (!clause.includes(",")) continue
    const body = clause.replace(/^(?:explain|walk (?:me )?through|give|state|cover|describe|include|discuss)\s+/i, "").replace(/[?!.]+$/, "")
    for (const item of body.split(/,\s*|\s+and\s+/)) {
      const part = item.replace(/^(?:the|a|an)\s+/i, "").trim()
      if (part && wordCount(part) <= 5) out.push(part.toLowerCase())
    }
  }
  return [...new Set(out)]
}

const PART_LINES: Record<AnswerLevel, Array<(part: string) => string>> = {
  engineer: [(p) => `For ${p}, I say what it is in one line and why it matters here.`],
  director: [
    (p) => `On ${p}, I name the owner and the risk if it slips.`,
    (p) => `For ${p}, I give the decision and the date it is due.`,
  ],
  architect: [
    (p) => `For ${p}, I state what it covers and the check that proves it.`,
    (p) => `On ${p}, I name where it can fail and what stops the failure from spreading.`,
    (p) => `With ${p}, I keep one result that confirms it before I move on.`,
  ],
}

function rankedExperience(question: string, resume: string, offTopicAllowed = 99): string[] {
  const lines = experienceLines(resume)
  const keys = questionKeywords(question).map((k) => k.toLowerCase())
  const score = (line: string) => {
    const low = line.toLowerCase()
    return keys.reduce((sum, key) => sum + (low.includes(key) ? (key.includes(" ") ? 3 : 1) : 0), 0)
  }
  // Lines that do not match the question are rotated by the question, so two questions never fall back on the same lines.
  const seed = [...String(question)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const spin = (i: number) => (i + seed) % Math.max(1, lines.length)
  const ranked = lines
    .map((line, i) => ({ line, i, n: score(line) }))
    .sort((a, b) => b.n - a.n || spin(a.i) - spin(b.i))
  // The best line always stays (it is the experience the answer points at). Lines that share no word with the
  // question are capped, so a long mode does not become a reading of the whole resume.
  let offTopic = 0
  // When nothing in the resume matches, no resume line is cited: reusing the same unrelated lines for every
  // question is how different questions got the same answer.
  if (!ranked.some((row) => row.n > 0)) return []
  return ranked.filter((row, index) => index === 0 || row.n > 0 || offTopic++ < offTopicAllowed).map((row) => row.line)
}

const OPENERS: Record<AnswerShape, Record<AnswerLevel, (lead: string) => string>> = {
  definition: {
    engineer: (l) => `Here is what ${l} means in my own work.`,
    director: (l) => `For the business, ${l} decides what risk we carry, so I lead with the decision.`,
    architect: (l) => `I would explain ${l} by where it sits in the process and where it can break.`,
  },
  comparison: {
    engineer: (l) => `Here is the difference in ${l}, from my own work.`,
    director: (l) => `On ${l}, the choice changes who carries the risk, so I make that call early.`,
    architect: (l) => `I separate ${l} by what each one checks and where each one stops.`,
  },
  "personal-experience": {
    engineer: (l) => `Yes, I have ${l}, and here is the real example.`,
    director: (l) => `When I ${l}, my decision was to hold the item until the proof was there.`,
    architect: (l) => `When I ${l}, I checked the plan against the evidence one step at a time.`,
  },
  logistics: {
    engineer: (l) => `Yes, I can ${l}, and that schedule works for me.`,
    director: (l) => `Yes, I can ${l}, and I plan my week around it.`,
    architect: (l) => `Yes, I can ${l}, and I have worked that way before.`,
  },
  "follow-up": {
    engineer: (l) => `Building on that, for ${l}, I add one concrete step.`,
    director: (l) => `Building on that, ${l} is where I make the next call for the business.`,
    architect: (l) => `Building on that, I treat ${l} as its own check with its own failure point.`,
  },
  direct: {
    engineer: (l) => `Here is how I ${l}.`,
    director: (l) => `To ${l}, I start with the decision and the risk it carries for the business.`,
    architect: (l) => `To ${l}, I would show how the pieces connect and where they fail.`,
  },
} as Record<AnswerShape, Record<AnswerLevel, (lead: string) => string>>

const CLOSERS: Record<AnswerLevel, string[]> = {
  engineer: [],
  director: [
    "The owner leaves with one clear next step and a date.",
    "I report what is still open in business terms, not tool terms.",
  ],
  architect: [
    "The boundary I watch is the point where the evidence stops matching the plan.",
    "When that check fails, I send the item back instead of closing it.",
    "Each step has one result that tells me it worked, so the next person can repeat it.",
  ],
}

/**
 * Code-level spoken draft so the gates can run with no model. It opens on the interviewer's own phrase, uses the
 * experience lines that match the question (never the resume header), and adds more supported lines per mode
 * instead of filler, so Engineer, Director, and Architect differ by real content. It is a stand-in, not a live answer.
 */
export function draftSpokenAnswer(question: string, level: AnswerLevel, resume: string): string {
  const cut = dissectQuestion(question, resume)
  const lead = leadPhrase(question)
  const opener = (OPENERS[cut.shape] || OPENERS.direct)[level] || OPENERS.direct[level]
  // A tied follow-up is ranked on its own words, so it does not read back the lines the first answer already used.
  const tied = splitFollowUp(question)
  const lines = rankedExperience(tied.previous ? tied.own : question, resume, { engineer: 0, director: 1, architect: 3 }[level]).map(firstPerson)
  const mode = cut.modes[level]
  const parts = [opener(lead)]
  let words = wordCount(parts[0])
  const story = cut.shape === "personal-experience" || cut.shape === "scenario"
  const deep = story || cut.shape === "technical-deep-dive"
  const most = { engineer: deep ? 2 : 1, director: 3, architect: 5 }[level]
  let used = 0
  // Supported lines are added until the mode's aim; a line that does not fit is skipped, not cut.
  for (const line of lines) {
    const n = wordCount(line)
    // The best matching line may run past the aim (never past the ceiling): it is the evidence the answer needs.
    if (used >= most || words + n > (used ? mode.aimWords : mode.maxWords)) continue
    parts.push(line)
    words += n
    used++
  }
  if (!used) {
    const honest = "My resume does not show this exact work, so I answer from how I would approach it."
    parts.push(honest)
    words += wordCount(honest)
  }
  const askedParts = askedPartList(question)
  askedParts.slice(0, level === "engineer" ? 2 : level === "director" ? 3 : askedParts.length).forEach((part, i) => {
    const templates = PART_LINES[level]
    const line = templates[i % templates.length](part)
    const n = wordCount(line)
    if (words + n > mode.aimWords) return
    parts.push(line)
    words += n
  })
  for (const line of CLOSERS[level]) {
    const n = wordCount(line)
    if (words + n > mode.aimWords) continue
    parts.push(line)
    words += n
  }
  return trimToWords(parts.join(" "), mode.maxWords)
}
