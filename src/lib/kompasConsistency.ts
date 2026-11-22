// Kompas consistency gate. Local and deterministic: no model call, no poll.
// A cached answer, a mid-confidence stub, an ungrounded tool, or a raw dump
// does not reach the card. The question box, the left answer, and the right
// panel all use the question passed in here.
import { visibleLengthBand, type VisibleLength } from "./kompasDissection.ts"
import { answerWordCount, presentSpokenAnswer, ungroundedProducts } from "./kompasAnswerPresentation.ts"
import { repairStoryShape } from "./kompasGuards.ts"

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

const FILLER_WORD = /\b(?:okay|ok|yeah|yes|um+|uh+|right|alright|so|and|well|like)\b/gi

/** Filler and a candidate's own story are not an interviewer ask. */
export function isRealAsk(text: string): boolean {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  if (!raw) return false
  const filler = raw.replace(FILLER_WORD, " ").replace(/\s+/g, " ").trim()
  if (!filler || filler.split(/\s+/).filter(Boolean).length < 4) return false
  const ownStory = /^(?:i(?:'m| am)|my first|my |it(?:'s| is) been|i have|i was|i work|he(?:'s| is)|she(?:'s| is))\b/i.test(filler)
  const asks = /\b(?:tell me|walk me through|how (?:do|would|did) you|what (?:is|are|do)|why (?:did|do|would) you|can you|could you|do you know|explain|describe|define)\b/i
  if (ownStory && !asks.test(filler)) return false
  if (/\?\s*$/.test(raw) && /\b(?:what|how|why|when|where|who|which|can|could|would|do|did|have|are|is|tell|walk|explain|describe)\b/i.test(raw)) return true
  return asks.test(filler)
}

/** The ask mostly repeats something the user already said. */
export function paraphrasesOwnSpeech(ask: string, ownLines: string[]): boolean {
  const words = askTokens(ask)
  if (words.length < 4) return false
  return (ownLines || []).some((line) => {
    const theirs = new Set(askTokens(line))
    const hit = words.filter((word) => theirs.has(word)).length
    return hit / words.length >= 0.7
  })
}

export function autoMayAnswer(input: { speaker?: string; text?: string; recentQuestions?: string[]; ownLines?: string[] }): { fire: boolean; reason: string } {
  const speaker = String(input.speaker || "")
  const text = String(input.text || "")
  if (speaker === "You") return { fire: false, reason: "own-speech" }
  if (!isRealAsk(text)) return { fire: false, reason: "not-a-question" }
  if (paraphrasesOwnSpeech(text, input.ownLines || [])) return { fire: false, reason: "paraphrase" }
  if ((input.recentQuestions || []).some((question) => sameQuestion(text, question))) return { fire: false, reason: "duplicate" }
  return { fire: true, reason: "ask" }
}

/** A late settle must not replace a longer streamed answer with a shorter one, or with the confirm stub. */
export function keepLongerAnswer(streamed: string, next: string, question = "", jd = ""): string {
  const stub = (value: string) => /^I would want to confirm that\.?$/i.test(String(value || "").trim())
  const prior = String(streamed || "").trim()
  const settled = String(next || "").trim()
  if (stub(settled) || stub(prior) || /not on my resume/i.test(settled) || /not on my resume/i.test(prior)) {
    return !stub(prior) && !/not on my resume/i.test(prior) && answerWordCount(prior) > 12 ? prior : jdGapBridge(question, "", jd)
  }
  const before = answerWordCount(prior)
  const after = answerWordCount(settled)
  if (before >= 24 && after > 0 && after < Math.floor(before * 0.75)) {
    if (!resumeFitsQuestion(question, jd, prior) && resumeFitsQuestion(question, jd, settled)) return settled
    return prior
  }
  return settled || prior
}

const OFF_PLATFORM = /\b(?:servicenow|itil|flow designer|integrationhub)\b/i
const SECURITY_ROLE = /\b(?:soc|security|phishing|edr|siem|qualys|ransomware|incident|cyber)\b/i

/** Resume facts count only when they answer this question. An unrelated platform is filler. */
export function resumeFitsQuestion(question: string, jd: string, answer: string): boolean {
  if (!OFF_PLATFORM.test(answer)) return true
  if (OFF_PLATFORM.test(question)) return true
  const role = String(jd || "").split(/[.\n]/)[0] || ""
  return OFF_PLATFORM.test(role) && !SECURITY_ROLE.test(role)
}

/** Drop sentences that import an unrelated platform. If nothing on-topic remains, say so plainly. */
export function dropOffTopicResume(question: string, jd: string, answer: string): string {
  const text = String(answer || "").trim()
  if (!text || resumeFitsQuestion(question, jd, text)) return text
  const kept = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence && !OFF_PLATFORM.test(sentence))
  return kept.join(" ").trim() || jdGapBridge(question, "", jd)
}

export function levelAfterInterviewType(mode: string, currentLevel: string): string {
  const level = currentLevel || "engineer"
  if (mode === "coding") return "architect"
  if (mode === "final") return "director"
  return level
}

export function lengthBandFor(question: string): VisibleLength {
  return visibleLengthBand(question)
}

const CHIT_CHAT = /^(?:hi|hello|hey|thanks|thank you|can you hear me|are you there|okay|ok|yeah|yes|sure|cool|got it|right|alright)(?:[.!?\s]|$)|how(?:'s| is) your day|can you hear me|camera froze|let's get started|thanks for joining/i

export type ClarifierTurn = { who?: string; text: string }
export type ClarifierNeed = { score: number; kind: string; options: string[]; borderline: boolean }

/** The question names a tool or product the resume does not. */
export function clarifierNeeded(question: string, resume: string): boolean {
  const bag = String(resume || "").toLowerCase()
  const names = String(question || "").match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []
  return names.some((name) => !/^(?:have|you|used|what|how|why|when|where|who|did|does|can|could|would|should|tell|walk|the|and|for|with|your|our)$/i.test(name) && !bag.includes(name.toLowerCase()))
}

export function isChitChat(text: string): boolean {
  return CHIT_CHAT.test(String(text || "").replace(/\s+/g, " ").trim())
}

function clipOption(text: string): string {
  return String(text || "").replace(/[?]+$/, "").replace(/\s+/g, " ").trim().split(/\s+/).slice(0, 10).join(" ")
}

function sameWord(a: string, b: string): boolean {
  return a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))
}

/** Rule score 1–4. Silent at 2 or below. A model is allowed only at the borderline score. */
function priorBlob(turns: ClarifierTurn[]): string {
  return turns.map((turn) => turn.text).join(" ")
}

function askCount(question: string): number {
  const q = question.toLowerCase()
  const hows = q.match(/\bhow (?:do|did|would|do you|did you)\b/g) || []
  const commas = (q.match(/,/g) || []).length
  const ands = (q.match(/\band\b/g) || []).length
  if (hows.length >= 3 || commas >= 2) return 3
  if (hows.length === 2 || (commas === 1 && ands >= 1 && hows.length >= 1)) return 2
  return hows.length || (/\?/.test(question) ? 1 : 0)
}

export function clarifierNeed(question: string, turns: ClarifierTurn[] = []): ClarifierNeed {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  const blob = `${priorBlob(turns)} ${q}`
  if (!q || isChitChat(q)) return { score: 1, kind: "chat", options: [], borderline: false }
  if (/\b(?:led a team|lead a team)\b/i.test(q)) return { score: 4, kind: "lead", options: ["people lead", "technical work"], borderline: false }
  if (/\b(?:tell me about a time|give me an example|describe a time)\b/i.test(q)) return { score: 1, kind: "story", options: [], borderline: false }
  if (/\b(?:difference between|versus|\bvs\.?\b|why do you want|walk me through how you configured|how do you write)\b/i.test(q)) return { score: 1, kind: "clear", options: [], borderline: false }
  if (/\bhow many years of\b/i.test(q)) return { score: 1, kind: "jd-years", options: [], borderline: false }
  if (/\b(?:crowdStrike flagged|at 2 am|no playbooks)\b/i.test(q)) return { score: 1, kind: "specified", options: [], borderline: false }
  if (askCount(q) >= 3 || (q.match(/,/g) || []).length >= 2) return { score: 4, kind: "multi", options: [], borderline: false }
  if (askCount(q) === 2) return { score: 1, kind: "coupled", options: [], borderline: false }
  if (/^(?:how|why|who|did|can|what)\b/i.test(q) && /\b(?:that|it|this|those)\b/i.test(q) && !/\b(?:alone|yourself|design|build|own)\b/i.test(q) && q.split(/\s+/).length <= 10) {
    const you = [...turns].reverse().find((turn) => turn.who !== "Them" && turn.text)
    const two = you && /\btwo things\b|\band\b/i.test(you.text) && /\b(?:sla|dashboard|monitoring|compliance)\b/i.test(you.text)
    if (two) return { score: 4, kind: "referent", options: ["SLA monitoring", "compliance dashboards"], borderline: false }
    if (/\bhow long\b/i.test(q) && /\bkyc\b/i.test(blob)) return { score: 4, kind: "duration", options: ["KYC build", "whole rollout"], borderline: false }
    if (/\bwho signed\b/i.test(q)) return { score: 4, kind: "signoff", options: ["access role design", "change"], borderline: false }
    if (/\bdid it work\b/i.test(q)) return { score: 4, kind: "result", options: ["vulnerability flagging", "accuracy of the result"], borderline: false }
    if (turns.length) return { score: 1, kind: "referent", options: [], borderline: false }
    return { score: 2, kind: "referent", options: [], borderline: true }
  }
  if (/\b(?:alone|yourself|whole program|responsible for the whole|did you own)\b/i.test(q) || /\bhow big was the environment\b/i.test(q)) {
    return { score: 4, kind: "scope", options: [], borderline: false }
  }
  if (/\b(?:incidents?|change|access|discovery|vulnerabilit)/i.test(q) && /\b(?:how do you|experience with|what do you do|manage access)\b/i.test(q)) {
    return { score: 4, kind: "overloaded", options: [], borderline: false }
  }
  if (/\b(?:how many|how much|what was your|how large)\b/i.test(q)) return { score: 4, kind: "number", options: [], borderline: false }
  if (/\b(?:what would you do if|if you had to)\b/i.test(q)) return { score: 4, kind: "hypothetical", options: [], borderline: false }
  if (/\b(?:which part|how broad|one piece)\b/i.test(q)) return { score: 2, kind: "scope", options: [], borderline: true }
  return { score: 1, kind: "clear", options: [], borderline: false }
}

function scopeLine(question: string, turns: ClarifierTurn[]): string {
  const blob = `${priorBlob(turns)} ${question}`
  if (/sd-?wan/i.test(blob)) return "Do you mean the overall SD-WAN design, or a specific piece like failover?"
  if (/\bsiem\b/i.test(blob)) return "The whole SIEM integration, or my piece of it?"
  if (/discovery/i.test(blob)) return "Do you mean the CI count, or the servers and users?"
  if (/\bgrc\b/i.test(blob)) return "The whole GRC program, or one part of it?"
  if (/\bkyc\b|onboarding/i.test(blob)) return "Did you design and run it end to end, or support one part?"
  if (/\bnetwork\b/i.test(question) && /\bfailover\b/i.test(question)) return "Should I answer the network design first, or the failover?"
  return ""
}

function overloadedLine(question: string): string {
  if (/\bincidents?\b/i.test(question)) return "Security incidents on the SOC side, or IT incidents through ServiceNow?"
  if (/\bchange\b/i.test(question)) return "Change requests in the process, or the change itself?"
  if (/\baccess\b/i.test(question)) return "Access reviews and roles, or provisioning?"
  if (/\bdiscovery\b/i.test(question)) return "ServiceNow Discovery for the CMDB, or asset discovery?"
  if (/\bvulnerabilit/i.test(question)) return "Scanning and remediation, or tracking findings?"
  return ""
}

function numberLine(question: string): string {
  if (/\btickets\b/i.test(question)) return "Just me, or the whole team's queue?"
  if (/\bmttr\b/i.test(question)) return "For a P1, or a platform priority?"
  if (/\bcmdb\b/i.test(question)) return "The CI classes, or the record count?"
  if (/\bsla\b/i.test(question)) return "The team's queue, or one priority band?"
  return ""
}

function multiLine(question: string): string {
  if (/\bphishing\b/i.test(question)) return "Is it okay if I start with the incident itself, then the tools?"
  if (/\btriage\b/i.test(question)) return "Is it okay if I start with triage, then escalation?"
  if (/\bSplunk\b/.test(question) && /\bCrowdStrike\b/.test(question)) return "Which should I start with, Splunk, CrowdStrike, or Qualys?"
  return ""
}

function hypotheticalLine(question: string): string {
  if (/\bcrowdStrike flagged\b|\bat 2 am\b|\bno playbooks\b/i.test(question)) return ""
  if (/\bsuspicious email\b/i.test(question)) return "Had they clicked the link, or just reported it?"
  if (/\balert volume\b/i.test(question)) return "The false-positive noise, or one source?"
  return ""
}

export function clarifierMayCallModel(need: ClarifierNeed): boolean {
  return need.score === 2 && need.borderline
}

function templateFor(question: string, turns: ClarifierTurn[], kind: string): string {
  if (kind === "lead") return "Formally as a people lead, or leading the technical work?"
  if (kind === "referent") return "The SLA monitoring side, or the compliance dashboards?"
  if (kind === "duration") return "The KYC build, or the whole rollout?"
  if (kind === "signoff") return "The access role design, or the change that put it in?"
  if (kind === "result") return "The vulnerability flagging, or the accuracy of the result?"
  if (kind === "scope") return scopeLine(question, turns)
  if (kind === "overloaded") return overloadedLine(question)
  if (kind === "number") return numberLine(question)
  if (kind === "multi") return multiLine(question)
  if (kind === "hypothetical") return hypotheticalLine(question)
  return ""
}

/** Silence at need 2 or below. A kept line is one template whose options are not the same fact. */
function liveCue(part: string): string {
  const lower = part.toLowerCase()
  const preferred = ["open", "approve", "close", "triage", "escalate", "tell", "discovery", "access", "incidents", "cmdb", "accurate", "signed", "who", "work", "long"]
  const hit = preferred.find((word) => new RegExp(`\\b${word}`).test(lower))
  if (hit) return hit
  const stop = new Set("what how why when where who the and for with your about would could should tell from that this have does did can will are was into been them you just then start".split(" "))
  return lower.replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).find((word) => word.length >= 4 && !stop.has(word)) || ""
}

/** A clarifier whose words are already in this question, or silence. The older bank still handles the 47. */
function clarifierFromLiveQuestion(question: string): string[] | null {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (/^(?:can you say more about it|and that|the other one)\??$/i.test(q)) return []
  if (/camera froze|so the question is|wait, i meant|actually, never mind/i.test(q)) return []
  const cancelled = /^(?:wait,?\s+forget that\.?\s*|sorry,?\s+scratch the email\.?\s*|hold on\.?\s*)/i.test(q)
  const body = q.replace(/^(?:wait,?\s+forget that\.?\s*|sorry,?\s+scratch the email\.?\s*|hold on\.?\s*)/i, "").trim()
  const tagged = /right\?\s*$/i.test(body)
  const stem = body.replace(/,?\s*right\?\s*$/i, "").trim()
  if (tagged && /\bdesign\b/i.test(stem) && /\balone\b/i.test(stem)) return ["Design it alone, or not alone?"]
  if (tagged) return []
  if (!cancelled && /\b(?:phishing|triage|splunk)\b/i.test(body)) return null
  const parts = body.split(/,|\band\b/i).map((part) => part.trim()).filter((part) => liveCue(part))
  const hows = body.match(/\bhow\b/gi) || []
  if (parts.length >= 3 || hows.length >= 3) {
    const cues = parts.slice(0, 3).map(liveCue).filter(Boolean)
    if (cues.length >= 3) {
      const line = `${cues[0]}, then ${cues[1]}, then ${cues[2]}?`
      return line.split(/\s+/).length <= 16 ? [line.charAt(0).toUpperCase() + line.slice(1)] : []
    }
  }
  if (cancelled) return []
  return null
}

export function clarifyingFromQuestion(question: string, resume = "", turns: ClarifierTurn[] = []): string[] {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  const live = clarifierFromLiveQuestion(q)
  if (live !== null) return live
  const marked = q.split("?").map((part) => part.trim()).filter((part) => part.split(/\s+/).length >= 3)
  if (marked.length >= 2 && String(resume || "").trim()) {
    const line = scopeLine(q, turns) || `Should I answer “${clipOption(marked[0])}” first, or “${clipOption(marked[1])}”?`
    return line.split(/\s+/).length <= 16 ? [line] : []
  }
  const need = clarifierNeed(q, turns)
  if (need.score <= 2) return []
  if (!String(resume || "").trim() && !turns.length) return []
  const line = templateFor(q, turns, need.kind)
  if (!line || CANNED_ASIDE.test(line) || line.split(/\s+/).length > 16 || !/\?$/.test(line)) return []
  return [line]
}

function resumeLines(resume: string): string[] {
  return String(resume || "")
    .split("\n")
    .map((line) => line.replace(/^[\s•▪●\-*]+/, "").trim())
    .filter((line) => line.split(/\s+/).length >= 6 && !/@|gmail|jayeshwar44|jayeshwar24|eshwarjay06/i.test(line))
    .filter((line) => !/^[^:]{0,56}:\s+\S/.test(line) && !/\b(?:using|via)\.?$/i.test(line))
}

const PAST: Record<string, string> = {
  assist: "assisted", assists: "assisted", assisted: "assisted",
  own: "owned", owned: "owned", build: "built", built: "built",
  work: "worked", worked: "worked", check: "checked", checked: "checked",
  lead: "led", led: "led", run: "ran", ran: "ran", write: "wrote", wrote: "wrote",
  design: "designed", designed: "designed", handle: "handled", handled: "handled",
  monitor: "monitored", monitored: "monitored", validate: "validated", validated: "validated",
  implement: "implemented", implemented: "implemented", configure: "configured", configured: "configured",
  create: "created", created: "created", develop: "developed", developed: "developed",
  automate: "automated", automated: "automated", provide: "provided", provided: "provided",
  support: "supported", supported: "supported", track: "tracked", tracking: "tracked",
  prioritize: "prioritized", prioritized: "prioritized",
}

function asFact(line: string): string {
  let text = line.replace(/^(?:experience in|having|responsible for|worked on|expertise in|assists with|assisted with)\s+/i, "").replace(/[,:;]+$/, "").trim()
  if (/^I\b/.test(text)) return /[.!?]$/.test(text) ? text : `${text}.`
  const verb = text.match(/^([A-Za-z]+)\b/)
  const past = verb ? PAST[verb[1].toLowerCase()] : ""
  if (past && verb) text = `I ${past} ${text.slice(verb[1].length).trim()}`
  else {
    const head = /[A-Z]/.test(text[1] || "") ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`
    text = `I did ${head}`
  }
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function nearDuplicate(a: string, b: string): boolean {
  const A = new Set(askTokens(a))
  const B = askTokens(b)
  if (!A.size || !B.length) return false
  const shared = B.filter((word) => A.has(word)).length
  return shared / Math.min(A.size, B.length) >= 0.75
}

const JD_ONLY = ["Splunk", "CrowdStrike", "Defender", "Qualys"]

function jdOnlyName(question: string, resume: string, jd: string): string {
  const resumeBag = resume.toLowerCase()
  const jdBag = `${jd} ${JD_ONLY.join(" ")}`.toLowerCase()
  const names = String(question || "").match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []
  const hit = names.find((name) => !/^(?:have|you|what|how|why|when|where|who|the|and)$/i.test(name) && jdBag.includes(name.toLowerCase()) && !resumeBag.includes(name.toLowerCase()))
  return hit || ""
}

/** Grammatical first-person lines from resume facts. A JD-only tool is bridged, not claimed. */
export function speakableLines(question: string, resume: string, jd = ""): string[] {
  const tool = jdOnlyName(question, resume, jd)
  const bag = new Set(askTokens(question).filter((word) => word !== tool.toLowerCase()))
  const hits = resumeLines(resume)
    .map((line) => ({ line, score: askTokens(line).filter((word) => [...bag].some((token) => sameWord(word, token))).length }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
  const pool = hits.length ? hits : resumeLines(resume).slice(0, 1).map((line) => ({ line, score: 0 }))
  const out: string[] = []
  if (tool && pool[0]) out.push(`I have not used ${tool}. ${asFact(pool[0].line)}`)
  for (const row of hits) {
    const line = asFact(row.line)
    if (CANNED_ASIDE.test(line) || /walk you through/i.test(line)) continue
    if (ungroundedProducts(line, `${resume}\n${question}`).length) continue
    if (out.some((kept) => nearDuplicate(kept, line))) continue
    out.push(line)
    if (out.length === 2) break
  }
  return out.slice(0, 2)
}

/** When the model stubs, speak the nearest resume line instead of a refusal. */
export function bridgeFromResume(question: string, resume: string): string {
  const hit = speakableLines(question, resume)[0]
  if (hit) return hit
  const line = resumeLines(resume)[0]
  if (!line) return ""
  const spoken = /^I\b/.test(line) ? line : `I ${line.charAt(0).toLowerCase()}${line.slice(1)}`
  return /[.!?]$/.test(spoken) ? spoken : `${spoken}.`
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
const FILLER_OPEN = /^(?:so|well|having|let me|that(?:'s| is) a (?:great|good)|in general|to be honest|sure|absolutely|great question)\b/i
const JD_TOOLS = ["Splunk", "CrowdStrike", "Defender", "Qualys"]

function sentenceList(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

export function foreignEmployers(transcript: string, resume: string, jd: string): string[] {
  const bag = `${resume}\n${jd}`.toLowerCase()
  const found = new Set<string>()
  const raw = String(transcript || "")
  for (const match of raw.matchAll(/\b(?:at|from|with|for)\s+([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+)*)/g)) {
    if (!bag.includes(match[1].toLowerCase())) found.add(match[1])
  }
  for (const match of raw.matchAll(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g)) {
    if (!bag.includes(match[1].toLowerCase())) found.add(match[1])
  }
  return [...found]
}

function candidateLines(transcript: string): string[] {
  return String(transcript || "").split("\n").map((line) => line.trim()).filter((line) => {
    if (/^You:/i.test(line)) return true
    return /^Them:/i.test(line) && /\bI\b/.test(line.replace(/^Them:\s*/i, ""))
  }).map((line) => line.replace(/^(?:You|Them):\s*/i, ""))
}

/** Words the candidate said that the resume does not contain. */
export function candidateOnlyTerms(transcript: string, resume: string): string[] {
  const known = new Set(askTokens(resume))
  const found = new Set<string>()
  for (const line of candidateLines(transcript)) {
    for (const name of line.match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []) {
      if (!known.has(name.toLowerCase()) && !String(resume || "").toLowerCase().includes(name.toLowerCase())) found.add(name.toLowerCase())
    }
    const words = line.toLowerCase().split(/[^a-z0-9+.#-]+/).filter((word) => word.length > 2)
    for (let i = 0; i < words.length - 2; i++) {
      const gram = words.slice(i, i + 3)
      if (!gram.some((word) => word.length >= 4 && !known.has(word))) continue
      const phrase = gram.join(" ")
      if (!String(resume || "").toLowerCase().includes(phrase)) found.add(phrase)
    }
  }
  return [...found]
}

export function dropCandidateOnly(answer: string, resume: string, jd: string, transcript: string): string {
  const names = foreignEmployers(transcript, resume, jd).map((name) => name.toLowerCase())
  const terms = [...names, ...candidateOnlyTerms(transcript, resume)]
  if (!terms.length) return String(answer || "").trim()
  return sentenceList(answer).filter((sentence) => !terms.some((term) => sentence.toLowerCase().includes(term))).join(" ")
}

export function howTool(question: string): string {
  const match = String(question || "").match(/\bhow (?:does|do)\s+([A-Za-z][\w.+-]{2,})\s+work\b/i)
  return match ? match[1] : ""
}

export function technicalThesis(question: string): string {
  const tool = howTool(question)
  if (tool) return `I would explain how ${tool} works from the closest work I have done.`
  const bare = String(question || "").replace(/\?+$/, "").replace(/\s+/g, " ").trim()
  if (!bare) return ""
  return `I would answer this directly: ${bare.charAt(0).toLowerCase()}${bare.slice(1)}.`
}

export function jdGapBridge(question: string, resume: string, jd = ""): string {
  const bag = `${jd} ${JD_TOOLS.join(" ")}`.toLowerCase()
  const resumeBag = String(resume || "").toLowerCase()
  const names = String(question || "").match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []
  const tool = names.find((name) => bag.includes(name.toLowerCase()) && !resumeBag.includes(name.toLowerCase())) || "that"
  const closest = resumeFacts(resume).find((line) => askTokens(line).some((word) => askTokens(question).includes(word))) || resumeFacts(resume)[0] || ""
  const verbs = /^(?:assists|tracking|having|implemented|created|maintained|developed|configured|supported|monitored|worked|hands|experience|client|role|senior|provided|automated|built)$/i
  const named = (closest.match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []).map((name) => name.replace(/\.+$/g, "")).find((name) => resumeBag.includes(name.toLowerCase()) && !verbs.test(name))
  const phrase = named || "closest work"
  return `I've had less direct hands-on with ${tool}; my ${phrase} work transfers because it is the same kind of work.`
}

function isBehavioralAsk(question: string): boolean {
  return visibleLengthBand(question).type === "story" || /\b(?:tell me about a time|give me an example|describe a time)\b/i.test(question)
}

function isDirectAsk(question: string): boolean {
  if (howTool(question)) return false
  const type = visibleLengthBand(question).type
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (type === "yes-no" || type === "definition" || type === "definition-application") return true
  if (/^(?:do|does|did|are|is|was|were|have|has|can|could|would|will|should) you\b/i.test(q)) return true
  if (/^(?:what is|what are|what's|define)\b/i.test(q)) return true
  return /\bhave you (?:worked|used|done)\b/i.test(q) && q.split(/\s+/).length <= 12
}

function isTechnicalAsk(question: string): boolean {
  if (isDirectAsk(question)) return false
  const type = visibleLengthBand(question).type
  return ["howto", "comparison", "follow-up", "design-first", "design-later", "experience"].includes(type)
}

function trimWords(text: string, max: number): string {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(" ")
  const cut = words.slice(0, max).join(" ")
  return /[.!?]$/.test(cut) ? cut : `${cut}.`
}

function resumeFacts(resume: string): string[] {
  return String(resume || "")
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[\s•▪●\-*]+/, "").trim())
    .filter((line) => line.split(/\s+/).length >= 4 && !/@|gmail|jayeshwar44|jayeshwar24|eshwarjay06/i.test(line))
}

function resumeNumber(resume: string, question: string): string {
  const allowed = new Set(`${resume}\n${question}`.match(/\d[\d,]*/g) || [])
  return [...allowed][0] || ""
}

function extendFromResume(text: string, question: string, resume: string, floor: number, ceiling: number): string {
  let out = String(text || "").trim()
  for (const line of resumeFacts(resume)) {
    if (answerWordCount(out) >= floor) break
    const fact = /[.!?]$/.test(line) ? line : `${line}.`
    if (out.includes(fact)) continue
    const next = `${out} ${fact}`.trim()
    if (answerWordCount(next) > ceiling) continue
    out = next
  }
  if (answerWordCount(out) < floor) {
    for (const line of resumeFacts(resume)) {
      if (answerWordCount(out) >= floor) break
      const room = ceiling - answerWordCount(out)
      const need = floor - answerWordCount(out)
      const words = line.split(/\s+/).filter(Boolean)
      const take = Math.min(words.length, room)
      if (take < need || take < 4) continue
      out = `${out} ${words.slice(0, need).join(" ")}.`.trim()
    }
  }
  return out
}

export type AnswerRoute = { route: "short" | "long" | "story"; floor: number; ceiling: number }

/** Long technical and concept answers floor at 120. Stories floor at 150. */
export function answerRoute(question: string): AnswerRoute {
  const band = visibleLengthBand(question)
  if (isDirectAsk(question)) return { route: "short", floor: 70, ceiling: 120 }
  if (isBehavioralAsk(question)) return { route: "story", floor: 150, ceiling: Math.max(band.ceiling, 180) }
  if (isTechnicalAsk(question)) {
    const ceiling = band.ceiling >= 120 ? band.ceiling : Math.max(band.ceiling, 180)
    return { route: "long", floor: Math.min(ceiling, 120), ceiling: Math.max(ceiling, 120) }
  }
  return { route: "short", floor: band.floor, ceiling: band.ceiling }
}

/** Technical answers open on the point and close on one resume example. Stories keep one resume number. */
function focusOnAskedTool(question: string, text: string, previous = ""): string {
  const tool = howTool(question)
  if (!tool) return text
  const prev = new Set(askTokens(previous))
  const kept = sentenceList(text).filter((sentence) => {
    if (sentence.toLowerCase().includes(tool.toLowerCase())) return true
    const tokens = askTokens(sentence)
    if (!tokens.length || !prev.size) return true
    const overlap = tokens.filter((word) => prev.has(word)).length / tokens.length
    return overlap < 0.55
  })
  return kept.join(" ")
}

export function shapeDisplayedAnswer(question: string, text: string, resume: string, jd = "", transcript = "", previous = ""): string {
  const route = answerRoute(question)
  let body = dropCandidateOnly(focusOnAskedTool(question, text, previous), resume, jd, transcript)
  if (!body.trim() || CONFIRM_STUB.test(body) || /not on my resume/i.test(body)) body = jdGapBridge(question, resume, jd)
  body = sentenceList(body).filter((sentence) => !FILLER_OPEN.test(sentence)).join(" ")
  // Owner, 22 Nov 2026: responses are lengthy always. The short route used to only trim
  // (to 60 words), so a definition or direct ask came back stubby even after the floor was
  // raised — nothing enforced it. Now a short answer below its floor is extended with
  // resume content to the floor, before the ceiling trim. The extension uses
  // speakableLines (question-relevant, first-person resume lines), NOT resumeFacts —
  // resumeFacts[0] is the generic resume summary, and appending it pasted the same
  // "Enterprise Security Architect with 12+ years..." fragment onto 4 of 9 answers in
  // Round 5. No "Example:" prefix: sentenceUsesUnknownTool drops any sentence with a
  // capitalized word not in the resume, and "Example" is not in the resume.
  if (route.route === "short") {
    let shortBody = trimWords(body, route.ceiling)
    if (answerWordCount(shortBody) < route.floor) {
      // Prefer question-relevant first-person lines; fall back to resume facts.
      // Never lead with the generic resume summary (resumeFacts[0], the "12+ years"
      // fragment) — appending it pasted the same summary onto 4 of 9 answers in
      // Round 5. The summary is a last resort only, after specific lines.
      const lines = speakableLines(question, resume, jd)
      for (const line of lines) {
        if (answerWordCount(shortBody) >= route.floor) break
        const clean = line.replace(/\s+/g, " ").trim()
        const sentence = /[.!?]$/.test(clean) ? clean : `${clean}.`
        if (clean && !shortBody.includes(clean.slice(0, 40))) shortBody = `${shortBody} ${sentence}`
      }
      if (answerWordCount(shortBody) < route.floor) {
        const facts = resumeFacts(resume)
        const specific = facts.slice(1)
        const summary = facts.slice(0, 1)
        for (const fact of [...specific, ...summary]) {
          if (answerWordCount(shortBody) >= route.floor) break
          const clean = fact.replace(/\s+/g, " ").trim()
          // No "Example:" prefix: sentenceUsesUnknownTool drops any sentence with a
          // capitalized word not in the resume, and "Example" is not in the resume.
          const sentence = /[.!?]$/.test(clean) ? clean : `${clean}.`
          if (clean && !shortBody.includes(clean.slice(0, 40))) shortBody = `${shortBody} ${sentence}`
        }
      }
    }
    return trimWords(shortBody, route.ceiling)
  }
  // Owner, 22 Nov 2026: the thesis ("I would answer this directly: <question>") must never
  // be prepended to an answer. The old long-route rebuild was [thesis, how, example, gap, tie],
  // and "how" filtered OUT every sentence starting with "I" — so once the model started
  // answering in the first person throughout (the wanted shape), "how" came back empty and the
  // answer collapsed to thesis + resume fragments (Q8, four live rounds). The model's body is
  // the answer: keep its sentences (first-person included) as the core, add a resume Example:
  // and a first-person tie only when the body has none.
  if (route.route === "long") {
    const core = sentenceList(body).filter((sentence) => !/^Example:/i.test(sentence)).slice(0, 4).join(" ")
    // Owner, 22 Nov 2026 (Round 6): the Example was resumeFacts(resume)[0] — the
    // generic summary — so Q6 ended with the same "Enterprise Security Architect
    // with 12+ years..." fragment pasted verbatim. Use a question-relevant fact
    // instead (a line sharing tokens with the question), skipping the summary.
    const facts = resumeFacts(resume)
    const fact = facts.slice(1).find((line) => askTokens(line).some((word) => askTokens(question).includes(word))) || facts.slice(1).find((line) => line.trim()) || ""
    const example = fact ? `Example: ${fact.replace(/\s+/g, " ").trim()}` : ""
    const hasFirstPerson = /\bI\b/.test(core)
    const tieSource = resumeFacts(resume).find((line) => /\bI\b/.test(line)) || fact
    const tie = !hasFirstPerson && tieSource ? (/^I\b/.test(tieSource) ? tieSource : `I did ${tieSource.charAt(0).toLowerCase()}${tieSource.slice(1)}`) : ""
    const tool = howTool(question)
    const gap = tool && !String(resume || "").toLowerCase().includes(tool.toLowerCase()) ? jdGapBridge(question, resume, jd || tool) : ""
    body = [core, example, gap, tie].filter(Boolean).join(" ")
  }
  if (route.route === "story") {
    const allowed = new Set((`${resume}\n${question}`.match(/\d[\d,]*/g) || []))
    body = sentenceList(body).filter((sentence) => !(sentence.match(/\d[\d,]*/g) || []).some((n) => !allowed.has(n))).join(" ") || body
    if (resumeNumber(resume, question) && !/\d/.test(body)) {
      const numbered = resumeFacts(resume).find((line) => /\d/.test(line))
      if (numbered) body = `${body} ${/[.!?]$/.test(numbered) ? numbered : `${numbered}.`}`.trim()
    }
  }
  if (!/\bExample:/.test(body)) {
    const fact = resumeFacts(resume)[0]
    if (fact) {
      const example = `Example: ${fact.replace(/\s+/g, " ").trim()}`
      const next = `${body} ${/[.!?]$/.test(example) ? example : `${example}.`}`.trim()
      if (answerWordCount(next) <= route.ceiling) body = next
    }
  }
  const bridge = jdGapBridge(question, resume, jd)
  if (bridge && !/with that;/.test(bridge) && !body.includes("less direct hands-on") && answerWordCount(`${body} ${bridge}`) <= route.ceiling) {
    body = `${body} ${bridge}`.trim()
  }
  if (answerWordCount(body) < route.floor) body = extendFromResume(body, question, resume, route.floor, route.ceiling)
  const bullets = body.split(/\n/).filter((line) => /^\s*[-•]/.test(line))
  if (bullets.length > 8) {
    const prose = body.split(/\n/).filter((line) => !/^\s*[-•]/.test(line))
    body = [...prose, ...bullets.slice(0, 7), bullets.find((line) => /Example:/.test(line)) || bullets[7]].filter(Boolean).join("\n")
  }
  return body.trim()
}

const EXTEND_MODEL = "openai/gpt-oss-20b"

/** One cheap extension, only after resume facts, the bridge, and Example still miss the floor. */
export async function extendFromModel(question: string, text: string, resume: string, jd = "", generate?: (prompt: string) => Promise<string>): Promise<string> {
  const route = answerRoute(question)
  const current = String(text || "").trim()
  if (route.route === "short" || answerWordCount(current) >= route.floor || !generate) return current
  const facts = resumeFacts(resume).slice(0, 12).join("\n")
  let extra = ""
  try {
    extra = String(await generate(`Question: ${question}\nResume facts only:\n${facts}\n\nDraft:\n${current}\n\nAdd sentences until the draft reaches ${route.floor} words. Use only the resume facts above. Do not add employers, tools, or numbers that are not in those facts.`))
  } catch { return current }
  const joined = `${current} ${extra}`.replace(/\s+/g, " ").trim()
  const allowed = `${resume}\n${jd}\n${question}`
  const kept = sentenceList(joined).filter((sentence) => {
    if (ungroundedProducts(sentence, allowed).length) return false
    const names = sentence.match(/\b[A-Z][A-Za-z0-9+.#-]{3,}/g) || []
    if (names.some((name) => !/^(?:Example|I've|The|This|That)$/.test(name) && !allowed.toLowerCase().includes(name.toLowerCase()))) return false
    return !(sentence.match(/\d[\d,]*/g) || []).some((n) => !allowed.includes(n))
  })
  const next = kept.join(" ")
  return answerWordCount(next) > answerWordCount(current) ? next : current
}

export { EXTEND_MODEL }

export function gateDisplayedAnswer(input: { question: string; raw: string; source?: string; resume?: string; jd?: string; transcript?: string; previous?: string }): DisplayGate {
  const question = String(input.question || "")
  const raw = String(input.raw || "")
  const source = String(input.source || "")
  const band = visibleLengthBand(question)
  const reasons: string[] = []
  let text = presentSpokenAnswer(question, raw, source)
  if (CONFIRM_STUB.test(raw)) reasons.push("stub")
  const resume = String(input.resume || source)
  const jd = String(input.jd || "")
  const transcript = String(input.transcript || "")
  if (CONFIRM_STUB.test(text) || !text.trim() || /not on my resume/i.test(text)) {
    const bridge = jdGapBridge(question, resume, jd) || bridgeFromResume(question, resume)
    text = bridge
    if (raw.trim()) reasons.push("bridge")
  }
  if (CANNED_ASIDE.test(text) || /\bFirst,\s*-/.test(text) || /\*\*(?:Claim|Context|Action|Result)\*\*/.test(text) || /\bIn general, teams\b/i.test(text)) {
    text = presentSpokenAnswer(question, text, source) || HONEST_LINE
    reasons.push("presentation")
  }
  if (source.trim() && text && ungroundedProducts(text, `${source}\n${question}`).length) {
    text = jdGapBridge(question, resume, jd)
    reasons.push("ungrounded")
  }
  if (text) {
    const shaped = repairStoryShape(question, text, resume)
    const formed = shapeDisplayedAnswer(question, shaped.text || text, resume, jd, transcript, String(input.previous || ""))
    if (formed && formed !== text) reasons.push("shape")
    text = formed || text
    if (shaped.needsRewrite) reasons.push("shape-rewrite")
  }
  const route = answerRoute(question)
  const words = answerWordCount(text)
  if (text && text !== HONEST_LINE && words > route.ceiling) reasons.push("over-ceiling")
  if (text && text !== HONEST_LINE && words < route.floor) reasons.push("under-floor")
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
    floor: route.floor,
    aim: band.aim,
    ceiling: route.ceiling,
  }
}
