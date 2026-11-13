// Kompas brain: a small in-session agent for the context panel.
// Event-driven. Every action is a pure function. Nothing is written to disk.
// The only model call in the product stays the main answer. This file never calls one.

import { extractClaims, longStatementCue, screenSuggestion, type SessionClaim } from "./kompasSessionMind.ts"

export type LineIntent = "question" | "long-statement" | "wrap-up" | "yes-no" | "explanation" | "other"
export type BrainActionName = "summarize" | "booster" | "clarify" | "short-answer" | "prewarm" | "flag-contradiction" | "hold"

export type BrainLog = {
  who: string
  text: string
  intent: LineIntent
  action: BrainActionName
  shown: string
  dropped: boolean
  ms: number
}

export type BrainState = {
  claims: SessionClaim[]
  topics: string[]
  openThreads: string[]
  questions: string[]
  answers: string[]
  prewarm: string
  log: BrainLog[]
}

export type BrainStep = {
  state: BrainState
  intent: LineIntent
  action: BrainActionName
  shown: string
  why: string
  scores: { relevance: number; consistency: number; brevity: number; keep: boolean }
  ms: number
}

export type ReplayRow = { who: string; text: string; action: BrainActionName }
export type ReplayReport = {
  lines: number
  labeled: number
  correct: number
  accuracy: number
  meanMs: number
  maxMs: number
  contradictionsIn: number
  contradictionsShown: number
  contradictionRate: number
}

const WRAP = /\b(?:any questions|to wrap up|that covers|that's all|we'll stop|last thing|in summary)\b/i
const YESNO = /^(?:have you|did you|do you|are you|were you)\b/i
const ASK = /^(?:what|why|how|who|when|where|which|tell me|walk me|describe|design)\b/i
const STOP = new Set("that this with what which when where your have about would could should there their them they then than into from were been being does tell describe explain walk give share just more some also like time thing kind really okay yeah want the and for you how did can will are was who why".split(" "))

/** Perspectives pass, 12 Nov 2026. Spoken rules, not a biography. */
export const BRAIN_POLICY = `BRAIN POLICY: Sentence one answers the question that was asked. A story stays near 80 to 160 words, a scenario near 60 to 140, a how-to near 60 to 200, and a short fact near 25 to 80, then stop. Connect beats by cause, with once that was confirmed, not with And then, From there, or After that. If nothing in the evidence library matches, say I would, and do not borrow another speaker's employer, title, or metric. Never mix the Houston and Saint Louis profiles.`

export function emptyBrain(): BrainState {
  return { claims: [], topics: [], openThreads: [], questions: [], answers: [], prewarm: "", log: [] }
}

export function detectIntent(text: string): LineIntent {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return "other"
  if (WRAP.test(t)) return "wrap-up"
  if (YESNO.test(t)) return "yes-no"
  if (/\?\s*$/.test(t) || ASK.test(t)) return "question"
  const n = t.split(/\s+/).length
  if (n >= 28) return "long-statement"
  if (n >= 12) return "explanation"
  return "other"
}

export function isPartialQuestion(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  return !!t && !/[.?!]$/.test(t) && t.split(/\s+/).length < 14 && ASK.test(t)
}

export function chooseAction(intent: LineIntent, flags: { contradiction: boolean; partial: boolean }): BrainActionName {
  if (flags.contradiction) return "flag-contradiction"
  if (flags.partial) return "prewarm"
  if (intent === "yes-no") return "short-answer"
  if (intent === "question" || intent === "wrap-up") return "clarify"
  if (intent === "long-statement") return "summarize"
  if (intent === "explanation") return "booster"
  return "hold"
}

function topicOf(text: string): string {
  const words = String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w))
  return words.slice(0, 3).join(" ")
}

function heard(state: BrainState): string {
  return state.claims.map((claim) => `You: ${claim.span}`).join("\n")
}

function contradicts(state: BrainState, text: string): boolean {
  const screened = screenSuggestion(text, heard(state), state.answers)
  return screened.rewritten || screened.blocked
}

export function summarizeLine(text: string): string {
  return longStatementCue(text, "boosters").summary
}

export function draftBooster(text: string, resume = ""): string {
  const bag = resume.toLowerCase()
  const noun = String(text || "").toLowerCase().split(/[^a-z0-9]+/).find((w) => w.length >= 5 && bag.includes(w))
  return noun ? `I've seen that with ${noun} too.` : "Yeah, I'd stay with that point."
}

export function draftClarify(text: string): string {
  const topic = topicOf(text)
  return topic ? `Want me to stay on ${topic}?` : "Want me to take that in one pass?"
}

export function draftShortAnswer(text: string, resume: string): string {
  const name = String(text || "").match(/\b(?:worked with|used|familiar with|experience with)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*)?)/i)
  const token = name ? name[1] : ""
  if (token && resume.toLowerCase().includes(token.toLowerCase())) return `Yes, ${token} is on the resume.`
  if (token) return "Not directly."
  return "Not directly. I won't add a name the resume doesn't have."
}

export function prewarmQuestion(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  return /[?]$/.test(t) ? t : `${t}?`
}

export function flagContradiction(text: string, state: BrainState): string {
  const screened = screenSuggestion(text, heard(state), state.answers)
  return screened.line
}

export function scoreSuggestion(line: string, state: BrainState, source: string): { relevance: number; consistency: number; brevity: number; keep: boolean } {
  const text = String(line || "").replace(/\s+/g, " ").trim()
  if (!text) return { relevance: 0, consistency: 1, brevity: 1, keep: false }
  const words = text.split(/\s+/).length
  const brevity = words <= 18 ? 1 : 0
  const screened = screenSuggestion(text, heard(state), state.answers)
  const consistency = screened.rewritten || screened.blocked || screened.line !== text ? 0 : 1
  const bag = new Set(`${source}\n${heard(state)}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4))
  const hit = text.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && bag.has(w))
  const template = /^(?:yeah,|not directly|want me to|yes,|i'll stay with what i already said)/i.test(text)
  const relevance = hit || template ? 1 : 0
  return { relevance, consistency, brevity, keep: relevance === 1 && consistency === 1 && brevity === 1 }
}

function runAction(action: BrainActionName, text: string, state: BrainState, resume: string): string {
  if (action === "summarize") return summarizeLine(text)
  if (action === "booster") return draftBooster(text, resume)
  if (action === "clarify") return draftClarify(text)
  if (action === "short-answer") return draftShortAnswer(text, resume)
  if (action === "prewarm") return ""
  if (action === "flag-contradiction") return flagContradiction(text, state)
  return ""
}

function remember(state: BrainState, who: string, text: string, intent: LineIntent, contradicting: boolean): BrainState {
  const next: BrainState = {
    claims: state.claims.slice(),
    topics: state.topics.slice(),
    openThreads: state.openThreads.slice(),
    questions: state.questions.slice(),
    answers: state.answers.slice(),
    prewarm: state.prewarm,
    log: state.log.slice(),
  }
  const topic = topicOf(text)
  if (topic && !next.topics.includes(topic)) next.topics.push(topic)
  if (who === "You" && !contradicting) {
    const found = extractClaims(`You: ${text}`, next.answers)
    for (const claim of found) {
      if (!next.claims.some((had) => had.span === claim.span)) next.claims.push(claim)
    }
    if (intent === "other" || intent === "explanation") next.answers.push(text)
  }
  if (intent === "question" || intent === "yes-no" || intent === "wrap-up") {
    next.questions.push(text)
    if (topic && !next.openThreads.includes(topic)) next.openThreads.push(topic)
  }
  if (intent === "long-statement" && topic && !next.openThreads.includes(topic)) next.openThreads.push(topic)
  if (next.topics.length > 24) next.topics = next.topics.slice(-24)
  if (next.questions.length > 24) next.questions = next.questions.slice(-24)
  if (next.answers.length > 24) next.answers = next.answers.slice(-24)
  if (next.openThreads.length > 12) next.openThreads = next.openThreads.slice(-12)
  return next
}

/** One transcript line in, one decision out. No timer, no network. */
export function perceive(state: BrainState, line: { who?: string; text?: string }, resume = ""): BrainStep {
  const started = performance.now()
  const who = line && line.who === "You" ? "You" : "Them"
  const text = String(line && line.text || "").replace(/\s+/g, " ").trim()
  const intent = detectIntent(text)
  const partial = who === "Them" && isPartialQuestion(text)
  const contradiction = contradicts(state, text)
  const action = chooseAction(intent, { contradiction, partial })
  let next = remember(state, who, text, intent, contradiction)
  if (action === "prewarm") next = { ...next, prewarm: prewarmQuestion(text) }
  const raw = runAction(action, text, next, resume)
  const scores = action === "prewarm" || action === "hold"
    ? { relevance: 1, consistency: 1, brevity: 1, keep: true }
    : scoreSuggestion(raw, next, `${resume}\n${text}`)
  const shown = scores.keep ? raw : ""
  const ms = performance.now() - started
  const entry: BrainLog = { who, text: text.slice(0, 180), intent, action, shown: shown.slice(0, 180), dropped: !scores.keep && !!raw, ms }
  next = { ...next, log: next.log.concat(entry).slice(-40) }
  return { state: next, intent, action, shown, why: text.slice(0, 140), scores, ms }
}

export function replayBrain(rows: readonly ReplayRow[], resume = ""): ReplayReport {
  let state = emptyBrain()
  let correct = 0
  let labeled = 0
  let maxMs = 0
  let totalMs = 0
  let contradictionsIn = 0
  let contradictionsShown = 0
  for (const row of rows) {
    const before = contradicts(state, row.text)
    if (before) contradictionsIn++
    const step = perceive(state, { who: row.who, text: row.text }, resume)
    state = step.state
    totalMs += step.ms
    if (step.ms > maxMs) maxMs = step.ms
    if (row.action) {
      labeled++
      if (step.action === row.action) correct++
    }
    if (before && step.shown && contradicts(state, step.shown)) contradictionsShown++
  }
  const lines = rows.length
  return {
    lines,
    labeled,
    correct,
    accuracy: labeled ? correct / labeled : 0,
    meanMs: lines ? totalMs / lines : 0,
    maxMs,
    contradictionsIn,
    contradictionsShown,
    contradictionRate: contradictionsIn ? contradictionsShown / contradictionsIn : 0,
  }
}
