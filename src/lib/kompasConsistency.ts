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
  if (stub(settled) || stub(prior)) return !stub(prior) && answerWordCount(prior) > 12 ? prior : HONEST_LINE
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
  return kept.join(" ").trim() || HONEST_LINE
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

const CHIT_CHAT = /^(?:hi|hello|hey|thanks|thank you|can you hear me|are you there|okay|ok|yeah|yes|sure|cool|got it|right|alright)(?:[.!?\s]|$)/i

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

function bestLine(option: string, lines: string[]): string {
  const tokens = askTokens(option)
  let best = ""
  let score = 0
  for (const line of lines) {
    const n = askTokens(line).filter((word) => tokens.some((token) => sameWord(word, token))).length
    if (n > score) { score = n; best = line }
  }
  return score > 0 ? best : ""
}

function differentResumeLines(options: string[], lines: string[]): boolean {
  if (options.length < 2) return false
  const a = bestLine(options[0], lines)
  const b = bestLine(options[1], lines)
  return !!a && !!b && a !== b
}

function referentOptions(turns: ClarifierTurn[]): string[] {
  return turns
    .map((turn) => String(turn.text || "").replace(/^(?:Them|You):\s*/i, "").replace(/\s+/g, " ").trim())
    .filter((text) => text.split(/\s+/).length >= 4 && !isChitChat(text))
    .slice(-2)
}

/** Rule score 1–4. Silent at 2 or below. A model is allowed only at the borderline score. */
export function clarifierNeed(question: string, turns: ClarifierTurn[] = []): ClarifierNeed {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (!q || isChitChat(q)) return { score: 1, kind: "chat", options: [], borderline: false }
  const parts = q.split(/\?\s+/).map((part) => part.replace(/\?+$/, "").trim()).filter((part) => part.split(/\s+/).length >= 3)
  if (parts.length >= 2) return { score: 4, kind: "multi", options: parts.slice(0, 2).map(clipOption), borderline: false }
  const choice = !/\bdifference\b|\bversus\b|\bvs\.?\b/i.test(q) && /\?/.test(q)
    ? q.match(/\b(?:the|a|an)\s+([^?]{3,40}?)\s+or\s+(?:the|a|an)\s+([^?]{3,40})/i)
    : null
  if (choice) return { score: 4, kind: "scope", options: [clipOption(choice[1]), clipOption(choice[2])], borderline: false }
  const term = q.match(/\b(?:when you say|what do you mean by|which kind of)\s+([A-Za-z][\w-]{2,})/i)
  if (term) return { score: 4, kind: "term", options: [term[1]], borderline: false }
  if (/\b(?:how many|how much|what percent|what number|how long)\b/i.test(q)) return { score: 3, kind: "number", options: [], borderline: false }
  if (/\b(?:what if|suppose|imagine|hypothetically)\b/i.test(q)) return { score: 3, kind: "hypothetical", options: [], borderline: false }
  if (/\b(?:that|it|this)\b/i.test(q) && q.split(/\s+/).length <= 14) {
    const refs = referentOptions(turns)
    if (refs.length >= 2) return { score: 4, kind: "referent", options: refs.map(clipOption), borderline: false }
    if (refs.length === 1) return { score: 1, kind: "referent", options: refs, borderline: false }
    return { score: 2, kind: "referent", options: [], borderline: true }
  }
  if (/\b(?:which part|how broad|the whole thing|one piece|alone)\b/i.test(q)) return { score: 2, kind: "scope", options: [], borderline: true }
  return { score: 1, kind: "clear", options: [], borderline: false }
}

export function clarifierMayCallModel(need: ClarifierNeed): boolean {
  return need.score === 2 && need.borderline
}

function clarifierLine(kind: string, options: string[]): string {
  const a = clipOption(options[0] || "")
  const b = clipOption(options[1] || "")
  if (!a || !b) return ""
  if (kind === "multi") return `Should I answer “${a}” first, or “${b}”?`
  if (kind === "number") return `Do you want the figure in “${a}”, or the one in “${b}”?`
  if (kind === "hypothetical") return `Do you want what I did on “${a}”, or how I would handle “${b}”?`
  if (kind === "term") return `When you say that, do you mean “${a}”, or “${b}”?`
  return `Do you mean “${a}”, or “${b}”?`
}

/** A clarifier only when the need is 3 or 4 and the two options hit different resume lines. */
export function clarifyingFromQuestion(question: string, resume = "", turns: ClarifierTurn[] = []): string[] {
  const need = clarifierNeed(question, turns)
  if (need.score <= 2) return []
  const lines = resumeLines(resume)
  let options = need.options.slice(0, 2)
  if (options.length < 2) {
    const bag = askTokens(`${question} ${options.join(" ")}`)
    const ranked = lines
      .map((line) => ({
        line,
        score: askTokens(line).filter((word) => bag.some((token) => sameWord(word, token))).length + (need.kind === "number" && /\d/.test(line) ? 1 : 0),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
    options = ranked.slice(0, 2).map((row) => clipOption(row.line))
  }
  if (!differentResumeLines(options, lines)) return []
  const line = clarifierLine(need.kind, options)
  return line && !CANNED_ASIDE.test(line) ? [line] : []
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

function jdOnlyName(question: string, resume: string, jd: string): string {
  if (!jd.trim()) return ""
  const names = String(question || "").match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []
  const resumeBag = resume.toLowerCase()
  const jdBag = jd.toLowerCase()
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
export function gateDisplayedAnswer(input: { question: string; raw: string; source?: string }): DisplayGate {
  const question = String(input.question || "")
  const raw = String(input.raw || "")
  const source = String(input.source || "")
  const band = visibleLengthBand(question)
  const reasons: string[] = []
  let text = presentSpokenAnswer(question, raw, source)
  if (CONFIRM_STUB.test(raw)) reasons.push("stub")
  if (CONFIRM_STUB.test(text) || !text.trim() || /not on my resume/i.test(text)) {
    const bridge = bridgeFromResume(question, source)
    text = bridge || (raw.trim() ? HONEST_LINE : "")
    if (raw.trim()) reasons.push(bridge ? "bridge" : "honest")
  }
  if (CANNED_ASIDE.test(text) || /\bFirst,\s*-/.test(text) || /\*\*(?:Claim|Context|Action|Result)\*\*/.test(text) || /\bIn general, teams\b/i.test(text)) {
    text = presentSpokenAnswer(question, text, source) || HONEST_LINE
    reasons.push("presentation")
  }
  if (source.trim() && text && text !== HONEST_LINE && ungroundedProducts(text, `${source}\n${question}`).length) {
    text = HONEST_LINE
    reasons.push("ungrounded")
  }
  if (text && text !== HONEST_LINE) {
    const shaped = repairStoryShape(question, text, source)
    if (shaped.text && shaped.text !== text) {
      text = shaped.text
      reasons.push("shape")
    }
    if (shaped.needsRewrite) reasons.push("shape-rewrite")
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
