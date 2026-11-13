// Session integration. Each function feeds the next one. Nothing here polls or calls the network.
// A line that fails the gloss validator is dropped. New JD terms are noted, not claimed.

import { validateStatement } from "./kompasGloss.ts"
import { matchKnownTerms, sessionProfile } from "./kompasLexicon.ts"
import { perspectiveDraft } from "./kompasPerspective.ts"

export type InterviewerRole = "hr" | "technical" | "manager"
export type InterviewerTone = "warm" | "blunt" | "plain"
export type InterviewerPace = "fast" | "steady" | "slow"
export type AnswerMode = "engineer" | "director" | "architect"

export type InterviewerRead = {
  role: InterviewerRole
  tone: InterviewerTone
  pace: InterviewerPace
  mode: AnswerMode
}

export const INTEGRATION = [
  { module: "session start", inputs: "resume, JD, dossier, prior prep", outputs: "session.prime", consumers: "topic tracker, interviewer model" },
  { module: "topic tracker", inputs: "interviewer lines, primed JD topics", outputs: "topic.track", consumers: "clarify framing, answer frame" },
  { module: "interviewer model", inputs: "JD, interviewer lines", outputs: "interviewer.model", consumers: "answer mode, pace nudge" },
  { module: "answer feedback", inputs: "mic line, last suggestion", outputs: "answer.feedback", consumers: "ledger, repetition guard" },
  { module: "repetition guard", inputs: "openers already said", outputs: "repetition.guard", consumers: "clarify line, answer frame" },
  { module: "time awareness", inputs: "elapsed ms, interviewer words, answer length, pace", outputs: "time.pace", consumers: "clarify nudge" },
  { module: "confidence", inputs: "question, resume, perspective lines", outputs: "confidence.flag", consumers: "clarify question, honest I would line" },
  { module: "post-session debrief", inputs: "questions, answers, gaps, unknown JD terms", outputs: "session.debrief", consumers: "lexicon candidates, next prep" },
  { module: "health", inputs: "subscriber errors, pass latency", outputs: "health.check", consumers: "degraded flag, last good panel" },
  { module: "observability", inputs: "every bus event latency", outputs: "debug.span", consumers: "dev timeline on the snapshot" },
] as const

const SKIP = new Set("about after again also and are because been before being both can could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours tell describe explain give walk share please should has you the for how why did was were our any who its want need make made know mean means work works time".split(" "))

function words(text: string): string[] {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !SKIP.has(word))
}

export function topicOfLine(text: string): string {
  return words(text).slice(0, 3).join(" ")
}

export function openerOf(text: string): string {
  return String(text || "").toLowerCase().replace(/[^a-z0-9'\s]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 3).join(" ")
}

export function primeContext(input: { resume?: string; jd?: string; dossier?: string; prep?: string }): { known: string[]; jdTerms: string[]; topics: string[] } {
  const blob = [input.resume, input.jd, input.dossier, input.prep].filter(Boolean).join("\n")
  const profile = sessionProfile()
  const known = matchKnownTerms(profile, blob).known.map((item) => item.term).slice(0, 12)
  const jdTerms = matchKnownTerms(profile, String(input.jd || "")).unknown.slice(0, 8)
  const topics: string[] = []
  const prep = topicOfLine(String(input.prep || ""))
  const fromJd = topicOfLine(String(input.jd || ""))
  if (prep) topics.push(prep)
  if (fromJd && !topics.includes(fromJd)) topics.push(fromJd)
  return { known, jdTerms, topics }
}

export function nextTopics(topics: readonly string[], line: string, who: string): string[] {
  const next = topics.slice()
  if (who !== "Them") return next
  const topic = topicOfLine(line)
  if (topic && !next.includes(topic)) next.push(topic)
  return next.length > 24 ? next.slice(-24) : next
}

export function frameFromTopics(topics: readonly string[], mode: AnswerMode): string {
  const topic = topics[topics.length - 1] || ""
  if (!topic) return ""
  if (mode === "architect") return `The boundary to stay on is ${topic}.`
  if (mode === "director") return `The decision to stay on is ${topic}.`
  return `Stay with ${topic}.`
}

export function readInterviewer(jdAndQuestion: string, themLines: readonly string[]): InterviewerRead {
  const blob = `${jdAndQuestion}\n${themLines.join("\n")}`
  const role: InterviewerRole = /\b(?:human resources|recruiter|culture fit|tell me about yourself|why do you want)\b/i.test(blob)
    ? "hr"
    : /\b(?:people manager|direct reports|stakeholder management)\b/i.test(blob)
      ? "manager"
      : "technical"
  const tone: InterviewerTone = /\b(?:great|love|wonderful|glad)\b/i.test(blob)
    ? "warm"
    : /\b(?:wrong|bottom line|just answer)\b/i.test(blob)
      ? "blunt"
      : "plain"
  const lengths = themLines.map((line) => String(line || "").split(/\s+/).filter(Boolean).length).filter((n) => n > 0)
  const avg = lengths.length ? lengths.reduce((sum, n) => sum + n, 0) / lengths.length : 12
  const pace: InterviewerPace = avg >= 28 ? "slow" : avg <= 8 ? "fast" : "steady"
  const design = /\b(?:how would you design|design a|architecture)\b/i.test(blob)
  const mode: AnswerMode = design ? "architect" : role === "technical" ? "engineer" : "director"
  return { role, tone, pace, mode }
}

export function spokenFeedback(suggestion: string, said: string): { overlap: number; opener: string; used: boolean } {
  const left = new Set(words(suggestion))
  const right = words(said)
  if (!right.length || !left.size) return { overlap: 0, opener: openerOf(said), used: false }
  let shared = 0
  for (const word of right) if (left.has(word)) shared++
  const overlap = shared / new Set([...left, ...right]).size
  return { overlap, opener: openerOf(said), used: overlap >= 0.34 }
}

export function guardRepeat(used: readonly string[], line: string): { blocked: boolean; line: string } {
  const opener = openerOf(line)
  if (opener && used.includes(opener)) return { blocked: true, line: "I'll take a different opening." }
  return { blocked: false, line }
}

export function paceNudge(input: { elapsedMs: number; themWords: number; answerWords: number; pace: InterviewerPace }): string {
  const ceiling = input.pace === "fast" ? 40 : input.pace === "slow" ? 140 : 90
  if (input.elapsedMs >= 25 * 60 * 1000 || input.themWords >= 700) return "I'd wrap this one and stop."
  if (input.answerWords > ceiling && input.themWords >= 120) return "I'd wrap this one and stop."
  return ""
}

export function confidenceLine(question: string, resume: string, mode: AnswerMode, said: readonly string[] = []): { low: boolean; say: string; ask: string } {
  const keys = words(question)
  const bag = String(resume || "").toLowerCase()
  const low = keys.length > 0 && !keys.some((word) => bag.includes(word))
  if (!low) return { low: false, say: "", ask: "" }
  const say = "I would walk this as a method, since the resume does not show that exact work."
  let ask = "Which part should I take, given I have not done that exact piece?"
  try {
    const hit = perspectiveDraft(question, mode, resume, said).find((line) => /follow-up I would ask/i.test(line))
    if (hit && validateStatement(hit, resume).ok) ask = hit
  } catch { /* the fallback question still stands */ }
  const saidOk = validateStatement(say, resume)
  const askOk = validateStatement(ask, resume)
  return { low: true, say: saidOk.ok ? say : "", ask: askOk.ok ? ask : "" }
}

export function buildDebrief(input: { questions: readonly string[]; answers: readonly string[]; resume: string; jdTerms: readonly string[]; topics: readonly string[] }): { questions: string[]; gaps: string[]; candidates: string[]; prep: string } {
  const gaps = input.questions.filter((question) => confidenceLine(question, input.resume, "engineer").low).slice(0, 6)
  const topic = input.topics[input.topics.length - 1] || ""
  const prep = gaps.length ? `Next time, prepare ${gaps[0].slice(0, 80)}.` : topic ? `Next time, start from ${topic}.` : ""
  return {
    questions: input.questions.slice(-8),
    gaps,
    candidates: input.jdTerms.slice(0, 8),
    prep,
  }
}

export function isWrapUp(text: string): boolean {
  return /\b(?:any questions|to wrap up|that covers|that's all|we'll stop|last thing|in summary)\b/i.test(text)
}
