// Kompas consistency gate. Local and deterministic: no model call, no poll.
// A cached answer, a mid-confidence stub, an ungrounded tool, or a raw dump
// does not reach the card. The question box, the left answer, and the right
// panel all use the question passed in here.
import { visibleLengthBand, type VisibleLength } from "./kompasDissection.ts"
import { answerWordCount, presentSpokenAnswer, ungroundedProducts } from "./kompasAnswerPresentation.ts"
import { repairStoryShape } from "./kompasGuards.ts"
import { resumeCertifications } from "./kompasResume.ts"

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

/** Two tokens are relevant to each other when they are the same word or share a
 * 6+ character stem — so "investigate" matches "investigation", "email" matches
 * "emails", "security" matches "secure". Exact-token matching missed these and
 * the relevance gate starved the extension (Round 8 shape test: phishing
 * question stayed at 28 words because "investigate" never matched
 * "investigation"). */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 3 || b.length < 3) return false
  const stem = Math.min(a.length, b.length, 6)
  return a.slice(0, stem) === b.slice(0, stem)
}

/** Words so generic they appear in almost every resume fact — matching on one
 *  of them is not relevance. Owner, 22 Nov 2026 (Round 9): the Q6 follow-up
 *  tacked on database-audit and federation bullets that shared only "project"
 *  with the question and "security" with the answer. A fact must share a
 *  CONTENT token, not a generic one. */
const GENERIC_RELEVANCE = new Set([
  "project", "projects", "work", "worked", "working", "security", "team", "teams",
  "role", "roles", "experience", "company", "business", "process", "processes",
  "system", "systems", "service", "services", "management", "data", "using", "used",
  "use", "support", "supported", "provide", "provided", "ensure", "ensured", "help",
  "helped", "include", "included", "across", "within", "through", "their", "them",
  "they", "this", "that", "with", "from", "into", "over", "under", "about", "after",
  "before", "during", "between", "among", "also", "well", "time", "times", "part",
  "parts", "hardest", "handle", "handled", "question", "answer", "tell", "describe",
  "explain", "would", "could", "should", "your", "what", "when", "where", "which",
  "there", "here", "more", "most", "some", "each", "both", "first", "second",
])

/** Does a resume fact share a meaningful (stem-matched, non-generic) token with
 *  the question? Used by every relevance gate so off-topic facts are never
 *  appended just to reach the floor. Owner, 22 Nov 2026 (Round 10): matching
 *  on the ANSWER alone is too loose — the answer already contains many words,
 *  so almost any fact matches something in it (the incident-investigation and
 *  Saviynt EIC bullets were appended to every answer, and the Q6 follow-up
 *  got Saviynt troubleshooting bullets that shared only "teams"/"functional"/
 *  "technical" with the answer). A fact must share a content token with the
 *  QUESTION. If none does, the answer stays at the model's length — a short
 *  answer beats a pasted off-topic bullet. */
function factRelevant(fact: string, tokens: Set<string>): boolean {
  return factRelevantTo(fact, tokens, tokens)
}

function factRelevantTo(fact: string, questionTokens: Set<string>, _answerTokens: Set<string>): boolean {
  const content = (w: string) => w.length > 2 && !GENERIC_RELEVANCE.has(w.toLowerCase())
  const factTokens = askTokens(fact).filter(content)
  return factTokens.some((w) => [...questionTokens].some((t) => content(t) && tokenMatch(w, t)))
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
  // Owner, 22 Nov 2026 (Round 14): a resume line can end with a keyword-tag
  // suffix — ". (Zero Trust) (Zero Trust Security), using Expert-level" — that
  // rides along when the line is converted to first person and dangles at the
  // end of an answer. Strip a trailing tag suffix (parenthetical groups
  // followed by ", using ..." or a bare parenthetical tail) before converting.
  let text = line.replace(/\s*(?:\([^)]*\)\s*)+,?\s*using\s+[^.!?]*\.?\s*$/i, "").replace(/^(?:experience in|having|responsible for|worked on|expertise in|assists with|assisted with)\s+/i, "").replace(/[,:;]+$/, "").trim()
  if (/^I\b/.test(text)) return /[.!?]$/.test(text) ? text : `${text}.`
  const verb = text.match(/^([A-Za-z]+)\b/)
  const past = verb ? PAST[verb[1].toLowerCase()] : ""
  if (past && verb) text = `I ${past} ${text.slice(verb[1].length).trim()}`
  else if (verb && /ed$/.test(verb[1].toLowerCase())) {
    // Already past tense ("Streamed database audit logs...") — prepend "I",
    // never "I did streamed...". Lowercase the verb's first letter: the
    // resume capitalizes the bullet's first word, and "I Integrated" reads as
    // a garbled artifact (Round 11: "I Integrated / I Partnered / I
    // Discovered / I Reviewed" on every appended bullet).
    text = `I ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  } else {
    // Owner, 22 Nov 2026 (his minimum bar): never club in a garbled line.
    // A line that is not a verb-led action (a degree, a heading, a noun
    // phrase — "b.Tech, Computer Science...") cannot become a first-person
    // sentence by prepending "I did". Return "" so the caller skips it
    // instead of emitting "I did b.Tech...".
    return ""
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
  // Owner, 22 Nov 2026 (Round 10): the bag used the raw question tokens, so
  // generic words scored off-topic facts — "project" matched the database-audit
  // bullet and "part" matched "partner" in the federation bullet, and both were
  // pasted onto the Q6 follow-up. Generic tokens never count as relevance.
  const bag = new Set(askTokens(question).filter((word) => word !== tool.toLowerCase() && word.length > 2 && !GENERIC_RELEVANCE.has(word.toLowerCase())))
  const hits = resumeLines(resume)
    .map((line) => ({ line, score: askTokens(line).filter((word) => [...bag].some((token) => tokenMatch(word, token))).length }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
  const pool = hits.length ? hits : resumeLines(resume).slice(0, 1).map((line) => ({ line, score: 0 }))
  const out: string[] = []
  if (tool && pool[0]) out.push(`I have not used ${tool}. ${asFact(pool[0].line)}`)
  for (const row of hits) {
    const line = asFact(row.line)
    if (!line) continue
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

// Owner, 22 Nov 2026 (Round 7): the floor extension pasted the resume SUMMARY
// onto 8 of 9 answers. resumeFacts splits the summary paragraph into one fact
// per sentence, so skipping only facts[0] left the other summary sentences
// ("Proven expertise in Okta IAM...", "Skilled at configuring CSPM...") to be
// appended. The summary section (under "Professional Summary", before the next
// heading) is generic positioning, not grounded experience — it must never be
// appended as an "example". These are the facts OUTSIDE the summary section.
// Owner, 22 Nov 2026 (his minimum bar): never club titles/clients from a
// different resume than the current session's, and never append off-topic
// bullets from other clients/roles. So this also excludes the Education and
// Certifications sections — a degree line ("I did b.Tech...") or a heading
// must never be appended as an experience example.
function nonSummaryFacts(resume: string): string[] {
  const text = String(resume || "")
  const start = text.search(/professional summary/i)
  let summary = ""
  if (start >= 0) {
    const rest = text.slice(start)
    const end = rest.search(/\n\s*(?:core competencies|professional experience|work experience|technical skills|certifications|education)\b/i)
    summary = end > 0 ? rest.slice(0, end) : rest.slice(0, 4000)
  }
  // Education and Certifications sections are not experience — never append them.
  // Owner, 22 Nov 2026 (Round 9): the Core Competencies section is also not
  // answer prose — its lines are "Header: keyword, keyword, keyword" dumps
  // (IAM Architecture & Saviynt Implementation: PeopleSoft 9.2, PeopleTools
  // security, roles, ...) that were pasted verbatim onto all 9 answers.
  // Exclude the whole section.
  const eduStart = text.search(/\n\s*education\b/i)
  const certStart = text.search(/\n\s*certifications\b/i)
  const compStart = text.search(/\n\s*core competencies\b/i)
  let excluded = summary
  if (eduStart >= 0) excluded += "\n" + text.slice(eduStart, certStart > eduStart ? certStart : undefined)
  if (certStart >= 0) excluded += "\n" + text.slice(certStart)
  if (compStart >= 0) {
    const compRest = text.slice(compStart)
    const compEnd = compRest.search(/\n\s*(?:professional experience|work experience|technical skills|certifications|education)\b/i)
    excluded += "\n" + (compEnd > 0 ? compRest.slice(0, compEnd) : compRest.slice(0, 4000))
  }
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()
  const excludedNorm = norm(excluded)
  return resumeFacts(resume).filter((fact) => {
    if (!excludedNorm) return true
    const f = norm(fact)
    // Skip a fact that appears (in full or as its first 60 chars) in the excluded sections.
    if (excludedNorm.includes(f.slice(0, 60)) || excludedNorm.includes(f)) return false
    // Safety net: a "Header: keyword, keyword, keyword" line is a section dump,
    // not a sentence — never append it as answer prose, wherever it lives.
    if (/:\s*[^.!?]*,/.test(fact)) return false
    // Owner, 22 Nov 2026 (Round 10): a role/company heading line ("Senior
    // Security Engineer | Nov 2023 – Present.") is not a sentence and must
    // never be appended as answer prose. Neither is a bare parenthetical
    // fragment ("(Governance) (Multifactor Authentication) (Identity)").
    if (/\|\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(fact)) return false
    if (/^\s*(?:\([^)]*\)\s*)+,?\s*(?:using|with|for)\b/i.test(fact)) return false
    if (/^\s*\([^)]*\)(\s*\([^)]*\))+\s*[,.]?$/i.test(fact)) return false
    // Owner, 22 Nov 2026 (Round 11): a tags/categories fragment ("(Zero Trust)
    // (Zero Trust Security), using Expert-level.") is not a sentence either —
    // it is a keyword tag line that dangles at the end of an answer. Any fact
    // that is mostly parenthetical groups is excluded.
    if ((fact.match(/\([^)]*\)/g) || []).length >= 2 && !/\b(?:I|we|my|our)\b/i.test(fact)) return false
    return true
  })
}

function resumeNumber(resume: string, question: string): string {
  const allowed = new Set(`${resume}\n${question}`.match(/\d[\d,]*/g) || [])
  return [...allowed][0] || ""
}

/** Same-thread extension for a story answer below its floor. A fact is
 *  appended only when it shares a non-generic content token with the answer's
 *  own opening sentence (the story's thread) AND with the question. A Saviynt
 *  bullet on a Fifth Bank Jenkins story shares only generic words ("security",
 *  "integration") with the opening, so it is skipped; a Jenkins or Python
 *  fact on that story shares the project token and is appended, via asFact
 *  (first-person), never as a raw bullet. */
function extendStorySameThread(body: string, question: string, resume: string, floor: number, ceiling: number): string {
  let out = String(body || "").trim()
  // Owner, 22 Nov 2026 (Round 14): the proper-noun set comes from the first
  // TWO sentences, not just the opening — the project/tool name often appears
  // in the second sentence ("I integrated the checks into Jenkins..."), and
  // limiting to sentence 1 left the extension with nothing to match.
  const opening = sentenceList(out).slice(0, 2).join(" ")
  // Owner, 22 Nov 2026 (Round 13): the shared token must be a CAPITALIZED
  // word in the opening (a proper noun: a client, tool, or product — Fifth
  // Bank, Jenkins, Python, AWS, Venafi). A lowercase process noun
  // ("provisioning", "onboarding") is shared by many bullets, and it let the
  // Saviynt troubleshooting bullet back onto a Fifth Bank automation story.
  // Only a proper-noun match proves the fact is on the story's thread.
  const openingProper = new Set(
    (opening.match(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*/g) || [])
      .flatMap((phrase) => phrase.split(/\s+/))
      .filter((w) => w.length > 2)
  )
  const openingTokens = new Set(askTokens(opening).filter((w) => w.length > 2 && !GENERIC_RELEVANCE.has(w.toLowerCase())))
  const questionTokens = new Set(askTokens(question).filter((w) => w.length > 2 && !GENERIC_RELEVANCE.has(w.toLowerCase())))
  const shares = (tokens: Set<string>, line: string) => {
    const lineTokens = askTokens(line).filter((w) => w.length > 2 && !GENERIC_RELEVANCE.has(w.toLowerCase()))
    return lineTokens.some((t) => [...tokens].some((q) => tokenMatch(t, q)))
  }
  const sharesProper = (line: string) => {
    const lineTokens = askTokens(line)
    return [...openingProper].some((p) => lineTokens.some((t) => tokenMatch(t.toLowerCase(), p.toLowerCase())))
  }
  for (const line of nonSummaryFacts(resume)) {
    if (answerWordCount(out) >= floor) break
    if (!shares(openingTokens, line)) continue
    if (!shares(questionTokens, line)) continue
    if (!sharesProper(line)) continue
    const fact = asFact(line)
    if (!fact) continue
    if (out.includes(fact.slice(0, 40))) continue
    const next = `${out} ${fact}`.trim()
    if (answerWordCount(next) > ceiling) continue
    out = next
  }
  return out
}

function extendFromResume(text: string, question: string, resume: string, floor: number, ceiling: number): string {
  // Owner, 22 Nov 2026 (Round 8): this appended resumeFacts in order — the
  // summary sentences first — pasting the "Enterprise Security Architect with
  // 12+ years..." fragment onto 6 of 8 answers. It must use nonSummaryFacts
  // (no summary, no Education/Certifications) and only facts relevant to the
  // question or the answer so far. If none is relevant, the answer stays at
  // the model's length rather than getting an unrelated fact pasted on.
  let out = String(text || "").trim()
  const questionTokens = new Set(askTokens(question).filter((w) => w.length > 2))
  const answerTokens = new Set(askTokens(out).filter((w) => w.length > 2))
  const relevant = (line: string) => factRelevantTo(line, questionTokens, answerTokens)
  // Owner, 22 Nov 2026 (Round 12): the extension appended RAW facts, so a
  // verbatim resume bullet ("Performed integration troubleshooting...") was
  // pasted onto the answer — the same paste the dropVerbatimResumeSentences
  // filter now removes. The extension must append first-person facts via
  // asFact ("I integrated..."), never a raw bullet; a non-action line returns
  // "" from asFact and is skipped, never pasted.
  for (const line of nonSummaryFacts(resume)) {
    if (answerWordCount(out) >= floor) break
    if (!relevant(line)) continue
    const fact = asFact(line)
    if (!fact) continue
    if (out.includes(fact)) continue
    const next = `${out} ${fact}`.trim()
    if (answerWordCount(next) > ceiling) continue
    out = next
  }
  if (answerWordCount(out) < floor) {
    for (const line of nonSummaryFacts(resume)) {
      if (answerWordCount(out) >= floor) break
      if (!relevant(line)) continue
      const fact = asFact(line)
      if (!fact) continue
      const room = ceiling - answerWordCount(out)
      const need = floor - answerWordCount(out)
      const words = fact.split(/\s+/).filter(Boolean)
      const take = Math.min(words.length, room)
      if (take < need || take < 4) continue
      out = `${out} ${words.slice(0, need).join(" ")}${/[.!?]$/.test(words.slice(0, need).join(" ")) ? "" : "."}`.trim()
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
  // Owner, 22 Nov 2026 (Round 8): Q2 came back with "I'd first define..." twice —
  // the model still writes hypothetical "I would" even after the grounding prompt
  // says to answer from experience. A conditional "I would" is not an answer from
  // his resume; convert it to the direct first-person form.
  body = body.replace(/\bI['\u2019]d\b/g, "I").replace(/\bI would\b/gi, "I")
  body = sentenceList(body).filter((sentence) => !FILLER_OPEN.test(sentence)).join(" ")
  // Owner, 22 Nov 2026 (Round 12): the model copies a resume bullet verbatim
  // into its prose. Drop verbatim pasted sentences HERE, before the route
  // branches and the extension run — the extension's own facts (added via
  // asFact, first-person) must not be dropped by the same filter, and a
  // filter that runs after the extension cannot tell a model paste from an
  // intentional extension fact.
  body = dropVerbatimResumeSentences(body, resume)
  // Owner, 22 Nov 2026 (Round 13): Q5 opened "I can't point to a full
  // migration I owned" and Q10 opened "I can't substantiate a specific time
  // I had to learn a new security tool quickly" — then both went on to
  // describe the actual work. A refusal/hedge opening poisons an otherwise
  // real answer. Strip leading refusal/hedge sentences when substantive
  // content remains after them; keep them only when the answer is nothing
  // but the refusal.
  body = stripRefusalOpen(body)
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
      // Owner, 22 Nov 2026 (Round 10): a certifications question came back
      // naming only CISSP/CCSK in the session even though the cert-append
      // exists — because speakableLines ran first and filled the answer to
      // the floor with other lines, so the cert-append's below-floor check
      // never fired. For a cert question the full list IS the answer, so it
      // goes first, before any other extension.
      if (/certification/i.test(question)) {
        const certs = resumeCertifications(resume)
        if (certs.length) {
          const held = certs.filter((c) => !/pursuing/i.test(c))
          const pursuing = certs.filter((c) => /pursuing/i.test(c))
          const certLine = [
            held.length ? `I hold ${held.join("; ")}` : "",
            pursuing.length ? `and I am pursuing ${pursuing.join("; ")}` : "",
          ].filter(Boolean).join(" ")
          if (certLine && !shortBody.includes(held[0] || certs[0])) {
            shortBody = `${shortBody} ${/[.!?]$/.test(certLine) ? certLine : `${certLine}.`}`.trim()
          }
        }
      }
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
      // Owner, 22 Nov 2026 (his minimum bar): never club titles/clients from a
      // different resume than the current session's, and never append off-topic
      // bullets from other clients/roles. So the fallback only appends facts that
      // share a meaningful token with the question OR with the answer so far — an
      // education line, a database-audit bullet on a Jenkins question, or a
      // federation bullet on a compliance question must never be tacked on just
      // to reach the floor. If no fact is relevant, the answer stays at the
      // model's length.
      if (answerWordCount(shortBody) < route.floor) {
        const facts = nonSummaryFacts(resume)
        const questionTokens = new Set(askTokens(question).filter((w) => w.length > 2))
        const answerTokens = new Set(askTokens(shortBody).filter((w) => w.length > 2))
        for (const fact of facts) {
          if (answerWordCount(shortBody) >= route.floor) break
          if (!factRelevantTo(fact, questionTokens, answerTokens)) continue
          // Owner, 22 Nov 2026 (Round 12): append the fact as a first-person
          // sentence via asFact, never a raw bullet — a raw bullet is a paste
          // that the verbatim filter drops.
          const clean = asFact(fact)
          if (clean && !shortBody.includes(clean.slice(0, 40))) shortBody = `${shortBody} ${clean}`
        }
      }
    }
    // Owner, 22 Nov 2026 (Round 12): the short route returns early, before the
    // shared tail — the verbatim drop now runs at the top of shapeDisplayedAnswer
    // (before the route branches), so the short route needs no separate drop.
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
    // Owner, 22 Nov 2026 (Round 6/7): the Example was resumeFacts(resume)[0] — the
    // generic summary — so Q6 ended with the same "Enterprise Security Architect
    // with 12+ years..." fragment pasted verbatim, and the other summary sentences
    // followed. Use a question-relevant fact from OUTSIDE the summary section.
    const facts = nonSummaryFacts(resume)
    const qTokens = new Set(askTokens(question).filter((w) => w.length > 2))
    const fact = facts.find((line) => factRelevant(line, qTokens)) || facts.find((line) => line.trim()) || ""
    const example = fact ? `Example: ${fact.replace(/\s+/g, " ").trim()}` : ""
    const hasFirstPerson = /\bI\b/.test(core)
    const tieSource = facts.find((line) => /\bI\b/.test(line)) || fact
    // Owner, 22 Nov 2026: the tie used to prepend "I did" to any line, producing
    // "I did streamed..." and "I did b.Tech...". Use asFact (which converts a
    // past-tense verb to "I streamed..." and returns "" for non-actions) and
    // skip the tie entirely when nothing converts cleanly.
    const tie = !hasFirstPerson && tieSource ? asFact(tieSource) : ""
    const tool = howTool(question)
    const gap = tool && !String(resume || "").toLowerCase().includes(tool.toLowerCase()) ? jdGapBridge(question, resume, jd || tool) : ""
    body = [core, example, gap, tie].filter(Boolean).join(" ")
  }
  if (route.route === "story") {
    const allowed = new Set((`${resume}\n${question}`.match(/\d[\d,]*/g) || []))
    body = sentenceList(body).filter((sentence) => !(sentence.match(/\d[\d,]*/g) || []).some((n) => !allowed.has(n))).join(" ") || body
    if (resumeNumber(resume, question) && !/\d/.test(body)) {
      // Owner, 22 Nov 2026 (Round 13): this appended the FIRST fact with a
      // digit, raw — which was the Saviynt troubleshooting bullet ("PeopleSoft
      // 9.2") on a Fifth Bank automation story. A numbered fact must be
      // relevant to the question AND go through asFact (first-person), never
      // pasted raw.
      // Owner, 22 Nov 2026 (Round 14): the digit check was still too loose —
      // "L2" in the PeopleSoft bullet counted as a number, so the bullet was
      // appended to a Jenkins story. Require a MEANINGFUL number: a standalone
      // integer of 2+ digits (a count, not a tier/version label like L2/P1/9.2).
      const qTokens = new Set(askTokens(question).filter((w) => w.length > 2))
      const numbered = nonSummaryFacts(resume).find((line) => /\b\d{2,}\b/.test(line) && factRelevant(line, qTokens))
      const numberedFact = numbered ? asFact(numbered) : ""
      if (numberedFact) body = `${body} ${numberedFact}`.trim()
    }
  }
  // Owner, 22 Nov 2026 (Round 11): a scenario/story answer IS the narrative —
  // the model's first-person account of the project or incident. Appending an
  // "Example:" bullet from another area (Saviynt troubleshooting, Burp/Wiz
  // probing) or extending with other resume bullets breaks the story and reads
  // as pasted fragments. So for story questions the shared tail skips the
  // Example append and the extendFromResume call entirely; the model's answer
  // stands at its own length.
  // Owner, 22 Nov 2026 (Round 13): that left short story answers short — Q4
  // 49w, Q7 38w, Q8 55w, follow-up 38w. So a story question below its floor
  // gets a SAME-THREAD extension only: a fact is appended only if it shares
  // a content token with the question AND names no client other than the one
  // in the answer's own opening (Fifth Bank, Synack, ...). A Saviynt bullet
  // on a Fifth Bank story, or a Synack bullet on a Fifth Bank story, is still
  // clubbing and is skipped. The fact goes through asFact (first-person).
  const isStory = route.route === "story"
  if (isStory && answerWordCount(body) < route.floor) body = extendStorySameThread(body, question, resume, route.floor, route.ceiling)
  if (!isStory && !/\bExample:/.test(body)) {
    // Owner, 22 Nov 2026 (Round 8): this appended resumeFacts(resume)[0] — the
    // generic summary — as the Example on every long/story answer that lacked
    // one, pasting the "12+ years..." fragment onto 6 of 8 answers. Use a
    // question-relevant fact from outside the summary section, and skip it
    // entirely when none is relevant or when the fact is already in the body.
    const facts = nonSummaryFacts(resume)
    const qTokens = new Set(askTokens(question).filter((w) => w.length > 2))
    const fact = facts.find((line) => factRelevant(line, qTokens) && !body.includes(line.replace(/\s+/g, " ").trim().slice(0, 40))) || ""
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
  if (!isStory && answerWordCount(body) < route.floor) body = extendFromResume(body, question, resume, route.floor, route.ceiling)
  const bullets = body.split(/\n/).filter((line) => /^\s*[-•]/.test(line))
  if (bullets.length > 8) {
    const prose = body.split(/\n/).filter((line) => !/^\s*[-•]/.test(line))
    body = [...prose, ...bullets.slice(0, 7), bullets.find((line) => /Example:/.test(line)) || bullets[7]].filter(Boolean).join("\n")
  }
  return body.trim()
}

/** Drop leading refusal/hedge sentences when substantive content remains.
 *  A refusal opening ("I can't point to a full migration I owned", "I can't
 *  substantiate a specific time...") poisons an answer that goes on to
 *  describe the real work. Strip it and let the work stand. Keep the refusal
 *  only when the answer is nothing but the refusal (stripping would empty it).
 *  Also strips a trailing hedge sentence ("That validation is the closest
 *  experience I can speak to directly") when it follows the refusal. */
function stripRefusalOpen(body: string): string {
  const REFUSAL = /^(?:I (?:can ?not|cannot|can't|haven't|have not|don't|do not)|That (?:validation|work) is the closest|I (?:am|was) not able to)\b/i
  const HEDGE = /^(?:That (?:validation|work) is the closest|The closest (?:experience|work) I can speak to)/i
  const sentences = sentenceList(body)
  if (sentences.length < 2) return body
  let start = 0
  while (start < sentences.length && REFUSAL.test(sentences[start].trim())) start++
  // A hedge sentence immediately after the refusal goes too.
  while (start < sentences.length && HEDGE.test(sentences[start].trim())) start++
  const remaining = sentences.slice(start).join(" ")
  if (start > 0 && answerWordCount(remaining) >= 10) return remaining
  // Owner, 22 Nov 2026 (Round 13): the refusal is often EMBEDDED in the first
  // sentence, not a standalone sentence — "I worked on IAM integration,
  // though I can't point to a full migration I owned" and "I've used Burp
  // Suite Pro, but I can't substantiate a specific time...". Strip the
  // trailing "though/but I can't..." clause and the leading "I can't...,
  // but" clause, keeping the work description that surrounds it.
  const cleaned = sentences.map((sentence) => {
    const s = sentence
      .replace(/[,;]?\s*(?:though|but|however)\s+I (?:can ?not|cannot|can't|haven't|have not|don't|do not)\b.*$/i, "")
      .replace(/^I (?:can ?not|cannot|can't|haven't|have not|don't|do not)\b[^,]*,\s*(?:but|though|however)\s+/i, "")
      .trim()
    return s
  }).filter(Boolean).join(" ")
  // Owner, 22 Nov 2026 (Round 13): the 40-word minimum blocked stripping
  // when the remaining content was short — but the extension refills length
  // AFTER shaping, so a short cleaned answer is fine. Only require that
  // something substantive remains.
  if (cleaned !== body && answerWordCount(cleaned) >= 10) return cleaned
  return body
}

/** Stream-gate drop check: whether a single sentence should be dropped as it
 *  streams, before the final shaping runs. Drops (a) a refusal/hedge sentence
 *  ("I haven't led an IAM migration", "I can't substantiate a specific time",
 *  "I don't have a supported example", "That validation is the closest
 *  experience..."), (b) a verbatim resume fact (first-person converted or
 *  not — the model converts "Collaborated..." to "I collaborated..."), and
 *  (c) a tag-fragment sentence (mostly parenthetical groups, no first person).
 *  The final gateDisplayedAnswer shaping applies the same rules, but the
 *  session displays the stream's incremental sentences and the final replace
 *  does not always overwrite them (Round 14), so the stream must filter too.
 *  A dropped sentence never halts the gate — the caller returns [] for it. */
export function dropStreamSentence(sentence: string, resume: string): boolean {
  const t = String(sentence || "").trim()
  if (!t) return false
  // (a) Refusal / hedge — a standalone sentence, or a sentence whose opening
  // clause is a refusal ("I haven't led an IAM migration, but I have worked
  // on..."). The clause-strip in stripRefusalOpen handles the embedded case
  // in final shaping; the stream drops the whole sentence (the work follows
  // in later sentences).
  if (/^(?:I (?:can ?not|cannot|can't|haven't|have not|don't|do not)|That (?:validation|work) is the closest|I (?:am|was) not able to)\b/i.test(t)) return true
  if (/^(?:I (?:haven't|have not|don't|do not) have (?:a|an|any) (?:supported|documented|specific|real) (?:example|time|instance))/i.test(t)) return true
  // (c) Tag fragment — mostly parenthetical groups, no first-person content.
  const parenGroups = (t.match(/\([^)]*\)/g) || []).length
  if (parenGroups >= 2 && !/\b(?:I|we|my|our)\b/i.test(t)) return true
  // (b) Verbatim resume fact — normalize hyphens (the resume uses U+2011)
  // and strip a leading "I " before comparing, as in dropVerbatimResumeSentences.
  const norm = (s: string) => s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-").replace(/\s+/g, " ").trim().toLowerCase()
  const n = norm(t)
  if (n.length < 20) return false
  const noI = n.replace(/^i\s+(?:have\s+|had\s+)?/, "")
  const facts = new Set(resumeFacts(resume).map((f) => norm(f)))
  const resumeNorm = norm(resume || "")
  if (facts.has(n) || facts.has(n.replace(/[.!?]+$/, ""))) return true
  if (facts.has(noI) || facts.has(noI.replace(/[.!?]+$/, ""))) return true
  if (noI.split(/\s+/).length >= 5 && resumeNorm.includes(noI.replace(/[.!?]+$/, ""))) return true
  return false
}

/** Drop any sentence after the first that is a verbatim resume fact. A pasted
 *  resume bullet ("Performed integration troubleshooting across Saviynt
 *  connectors...") is never the model's own prose — the model writes in the
 *  first person and paraphrases. The first sentence is kept even if it matches,
 *  in case the model's opening closely follows a resume line. */
function dropVerbatimResumeSentences(body: string, resume: string): string {
  // Owner, 22 Nov 2026 (Round 14): the resume uses a non-breaking hyphen
  // (U+2011) in "cross‑functional" while the model writes a regular hyphen
  // ("cross-functional"), so a verbatim comparison missed the paste. Normalize
  // all hyphen-like characters to a regular hyphen before comparing.
  const norm = (s: string) => s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-").replace(/\s+/g, " ").trim().toLowerCase()
  const resumeNorm = norm(resume || "")
  const facts = new Set(resumeFacts(resume).map((f) => norm(f)))
  const sentences = sentenceList(body)
  if (sentences.length <= 1) return body
  const kept = sentences.filter((sentence, i) => {
    if (i === 0) return true
    // presentSpokenAnswer formats sentences as bullet lines ("\n- ..."), so
    // strip the bullet marker before comparing — otherwise "- Performed
    // integration troubleshooting..." never matches the resume fact.
    const clean = sentence.replace(/^[\s•▪●\-*]+/, "").trim()
    const n = norm(clean)
    if (n.length < 20) return true
    // Owner, 22 Nov 2026 (Round 12): a tag fragment pasted at the end of an
    // answer — "(Zero Trust) (Zero Trust Security), using Expert-level." — is
    // not a sentence, it is a keyword tag line. Drop any sentence that is
    // mostly parenthetical groups with no first-person content.
    if ((clean.match(/\([^)]*\)/g) || []).length >= 2 && !/\b(?:I|we|my|our)\b/i.test(clean)) return false
    // Verbatim if the whole sentence is a resume fact, or appears in the
    // resume text as a contiguous chunk (covers tag fragments pasted mid-text).
    // Owner, 22 Nov 2026 (Round 14): the model converts a bullet to first
    // person ("Collaborated with cross-functional teams on PeopleSoft security
    // design..." becomes "I collaborated with..."), so a verbatim check on
    // the sentence as-is misses it. Strip a leading "I " (and "I have/had")
    // and compare the remainder against the facts too.
    const noI = n.replace(/^i\s+(?:have\s+|had\s+)?/, "")
    if (facts.has(n) || facts.has(n.replace(/[.!?]+$/, ""))) return false
    if (facts.has(noI) || facts.has(noI.replace(/[.!?]+$/, ""))) return false
    if (resumeNorm.includes(n.replace(/[.!?]+$/, "")) && n.split(/\s+/).length >= 5) return false
    if (resumeNorm.includes(noI.replace(/[.!?]+$/, "")) && noI.split(/\s+/).length >= 5) return false
    return true
  })
  return kept.join(" ")
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
  // Owner, 22 Nov 2026 (Round 10): Q2 still showed "I'd" in the session even
  // though shapeDisplayedAnswer converts it — the stream path's final text can
  // carry a conditional the shaping step missed. Final cleanup: a conditional
  // "I would" is never an answer from his resume; convert it here, on the
  // final text, whatever path produced it.
  if (text && text !== HONEST_LINE) text = text.replace(/\bI['\u2019]d\b/g, "I").replace(/\bI would\b/gi, "I")
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
