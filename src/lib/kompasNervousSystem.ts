// One memory for the Kompas engines. Each engine publishes on the bus and
// reads the same brain state. Nothing here calls a model or the network.

import { lensBlock } from "./kompasAudience.ts"
import { emptyBrain, isPartialQuestion, perceive, type BrainState } from "./kompasBrain.ts"
import { createBus, type EarSource, type KompasBus } from "./kompasBus.ts"
import { defensibilityReport } from "./kompasDefensibility.ts"
import { captureEarly, selectAnswerContext } from "./kompasLongContext.ts"
import {
  buildDebrief, confidenceLine, frameFromTopics, guardRepeat, isWrapUp, nextTopics, openerOf, paceNudge, primeContext, readInterviewer, spokenFeedback,
  type AnswerMode, type InterviewerRead,
} from "./kompasIntegration.ts"
import { matchKnownTerms, noteCandidateTerm, sessionProfile } from "./kompasLexicon.ts"
import { contentRelevance } from "./kompasAnswerQuality.ts"

export type SessionLine = { who?: string; text?: string; source?: EarSource }

export type SessionSnapshot = {
  question: string
  topics: string[]
  claims: string[]
  answers: string[]
  prewarm: string
  lensNote: string
  dossierNote: string
  relevance: number | null
  hardFlags: number
  events: string[]
  ms: number
  primed: boolean
  knownTerms: string[]
  mode: AnswerMode
  interviewer: InterviewerRead
  frame: string
  nudge: string
  say: string
  clarify: string
  avoid: string[]
  debrief: { questions: string[]; gaps: string[]; candidates: string[]; prep: string } | null
  degraded: boolean
  timeline: { type: string; ms: number }[]
}

function whoOf(value: string | undefined): "You" | "Them" {
  return value === "You" ? "You" : "Them"
}

function sourceOf(who: "You" | "Them", source: EarSource | undefined): EarSource {
  if (source === "mic" || source === "computer") return source
  return who === "You" ? "mic" : "computer"
}

export function linesFromTranscript(transcript: string): SessionLine[] {
  return String(transcript || "").split("\n").map((raw) => raw.trim()).filter(Boolean).map((line) => {
    const you = /^You:\s*/i.test(line)
    return { who: you ? "You" : "Them", text: line.replace(/^(?:You|Them):\s*/i, ""), source: you ? "mic" as const : "computer" as const }
  })
}

export function createNervousSystem(prep = "") {
  const marks: { type: string; ms: number }[] = []
  let degraded = false
  let reporting = false
  const bus = createBus({
    onError(type) {
      degraded = true
      if (reporting || type === "health.check") return
      reporting = true
      try { bus.publish({ type: "health.check", ok: false, slow: false, ms: 0, detail: type }) }
      finally { reporting = false }
    },
    onEvent(type, ms) {
      marks.push({ type, ms })
      if (marks.length > 80) marks.shift()
    },
  })
  let brain: BrainState = emptyBrain()
  let question = ""
  let resume = ""
  let jd = ""
  let dossier = ""
  let lensNote = ""
  let dossierNote = ""
  let relevance: number | null = null
  let hardFlags = 0
  let primed = false
  let knownTerms: string[] = []
  let jdTerms: string[] = []
  let mode: AnswerMode = "engineer"
  let interviewer: InterviewerRead = { role: "technical", tone: "plain", pace: "steady", mode: "engineer" }
  let frame = ""
  let nudge = ""
  let say = ""
  let clarify = ""
  let lastShown = ""
  const avoid: string[] = []
  const themLines: string[] = []
  let themWords = 0
  let debrief: SessionSnapshot["debrief"] = null
  const startedAt = performance.now()
  const events: string[] = []
  const note = (type: string) => { events.push(type); if (events.length > 80) events.shift() }
  const dev = () => process.env.NODE_ENV !== "production"

  const publishDebrief = () => {
    const report = buildDebrief({ questions: brain.questions, answers: brain.answers, resume, jdTerms, topics: brain.topics })
    for (const term of report.candidates) noteCandidateTerm(sessionProfile(), term)
    debrief = report
    bus.publish({ type: "session.debrief", prep: report.prep, gaps: report.gaps.length, candidates: report.candidates })
  }

  const publishState = () => {
    bus.publish({ type: "brain.state", question, topics: brain.topics.slice(), claims: brain.claims.length })
  }

  bus.subscribe("context.attach", (event) => {
    if (event.type !== "context.attach") return
    resume = event.resume
    jd = event.jd
    dossier = event.dossier
    note(event.type)
    const primedNow = primeContext({ resume, jd, dossier, prep })
    bus.publish({ type: "session.prime", known: primedNow.known, jdTerms: primedNow.jdTerms, topics: primedNow.topics })
  })

  bus.subscribe("session.prime", (event) => {
    if (event.type !== "session.prime") return
    note(event.type)
    primed = true
    knownTerms = event.known.slice()
    jdTerms = event.jdTerms.slice()
    for (const topic of event.topics) {
      if (topic && !brain.topics.includes(topic)) brain.topics.push(topic)
    }
    const read = readInterviewer(`${jd}\n${dossier}`, themLines)
    bus.publish({ type: "interviewer.model", role: read.role, tone: read.tone, pace: read.pace, mode: read.mode })
  })

  bus.subscribe("interviewer.model", (event) => {
    if (event.type !== "interviewer.model") return
    note(event.type)
    interviewer = { role: event.role as InterviewerRead["role"], tone: event.tone as InterviewerRead["tone"], pace: event.pace as InterviewerRead["pace"], mode: event.mode as AnswerMode }
    mode = interviewer.mode
    frame = frameFromTopics(brain.topics, mode)
  })

  bus.subscribe("topic.track", (event) => {
    if (event.type !== "topic.track") return
    note(event.type)
    brain = { ...brain, topics: event.topics.slice() }
    frame = frameFromTopics(brain.topics, mode)
  })

  bus.subscribe("answer.feedback", (event) => {
    if (event.type !== "answer.feedback") return
    note(event.type)
    if (event.opener && !avoid.includes(event.opener)) avoid.push(event.opener)
    const guarded = guardRepeat(avoid, lastShown)
    bus.publish({ type: "repetition.guard", blocked: guarded.blocked, line: guarded.line })
  })

  bus.subscribe("repetition.guard", (event) => {
    if (event.type !== "repetition.guard") return
    note(event.type)
    if (event.blocked && event.line) lastShown = event.line
  })

  bus.subscribe("time.pace", (event) => {
    if (event.type !== "time.pace") return
    note(event.type)
    if (event.nudge) nudge = event.nudge
  })

  bus.subscribe("confidence.flag", (event) => {
    if (event.type !== "confidence.flag") return
    note(event.type)
    if (!event.low) return
    say = event.say
    clarify = event.ask
  })

  bus.subscribe("session.debrief", (event) => { if (event.type === "session.debrief") note(event.type) })
  bus.subscribe("health.check", (event) => {
    if (event.type !== "health.check") return
    note(event.type)
    if (!event.ok || event.slow) degraded = true
  })
  bus.subscribe("debug.span", (event) => { if (event.type === "debug.span") note(event.type) })

  bus.subscribe("ear.transcript", (event) => {
    if (event.type !== "ear.transcript") return
    note(event.type)
    const step = perceive(brain, { who: event.who, text: event.text }, resume)
    brain = step.state
    let shown = step.shown
    const guarded = guardRepeat(avoid, shown)
    if (guarded.blocked) shown = guarded.line
    if (shown) lastShown = shown
    bus.publish({ type: "clarify.action", action: step.action, shown, ms: step.ms })
    if (event.who === "Them") {
      themLines.push(event.text)
      themWords += event.text.split(/\s+/).filter(Boolean).length
      bus.publish({ type: "topic.track", topics: nextTopics(brain.topics, event.text, "Them"), line: event.text })
      const read = readInterviewer(`${jd}\n${event.text}`, themLines)
      bus.publish({ type: "interviewer.model", role: read.role, tone: read.tone, pace: read.pace, mode: read.mode })
      const pace = paceNudge({ elapsedMs: performance.now() - startedAt, themWords, answerWords: 0, pace: read.pace })
      if (pace) bus.publish({ type: "time.pace", nudge: pace, elapsedMs: performance.now() - startedAt })
      if (isWrapUp(event.text)) publishDebrief()
    } else {
      const feedback = spokenFeedback(lastShown, event.text)
      bus.publish({ type: "answer.feedback", overlap: feedback.overlap, opener: feedback.opener || openerOf(event.text), used: feedback.used })
    }
    if (event.who !== "You") {
      const early = captureEarly(event.text)
      if (early) bus.publish({ type: "ear.question", text: early, partial: isPartialQuestion(event.text) })
    }
    const started = performance.now()
    const terms = matchKnownTerms(sessionProfile(), event.text)
    for (const term of terms.unknown) noteCandidateTerm(terms.profile, term)
    bus.publish({ type: "known-terms", profile: terms.profile, known: terms.known.map((item) => item.term), unknown: terms.unknown, ms: performance.now() - started })
    publishState()
  })

  bus.subscribe("ear.question", (event) => {
    if (event.type !== "ear.question") return
    note(event.type)
    question = event.text
    const picked = selectAnswerContext([{ who: "Them", text: event.text }])
    if (picked.question) question = picked.question
    lensNote = lensBlock(mode, question).slice(0, 180)
    if (lensNote) bus.publish({ type: "lens.note", text: lensNote })
    if (dossier) {
      dossierNote = dossier.replace(/\s+/g, " ").trim().slice(0, 180)
      bus.publish({ type: "dossier.note", text: dossierNote })
    }
    publishState()
  })

  bus.subscribe("answer.ready", (event) => {
    if (event.type !== "answer.ready") return
    note(event.type)
    const asked = event.question || question
    relevance = contentRelevance(asked, event.text)
    hardFlags = defensibilityReport(asked, event.text).hardFlags.length
    const confidence = confidenceLine(asked, resume, mode, brain.answers)
    if (confidence.low) bus.publish({ type: "confidence.flag", low: true, say: confidence.say, ask: confidence.ask })
    const words = String(event.text || "").split(/\s+/).filter(Boolean).length
    const pace = paceNudge({ elapsedMs: performance.now() - startedAt, themWords, answerWords: words, pace: interviewer.pace })
    if (pace) bus.publish({ type: "time.pace", nudge: pace, elapsedMs: performance.now() - startedAt })
    bus.publish({ type: "answer.scored", question: asked, relevance, hardFlags })
  })

  bus.subscribe("clarify.action", (event) => { if (event.type === "clarify.action") note(event.type) })
  bus.subscribe("lens.note", (event) => { if (event.type === "lens.note") note(event.type) })
  bus.subscribe("dossier.note", (event) => { if (event.type === "dossier.note") note(event.type) })
  bus.subscribe("answer.scored", (event) => { if (event.type === "answer.scored") note(event.type) })
  bus.subscribe("brain.state", (event) => { if (event.type === "brain.state") note(event.type) })
  bus.subscribe("known-terms", (event) => {
    if (event.type !== "known-terms") return
    note(event.type)
    for (const term of event.known) if (!knownTerms.includes(term)) knownTerms.push(term)
    if (knownTerms.length) frame = frameFromTopics(brain.topics, mode)
  })

  return {
    bus: bus as KompasBus,
    attach(input: { resume?: string; jd?: string; dossier?: string; prep?: string }) {
      if (input.prep) prep = input.prep
      bus.publish({
        type: "context.attach",
        resume: String(input.resume || ""),
        jd: String(input.jd || ""),
        dossier: String(input.dossier || ""),
      })
    },
    hear(line: SessionLine) {
      const who = whoOf(line.who)
      const text = String(line.text || "").replace(/\s+/g, " ").trim()
      if (!text) return
      bus.publish({ type: "ear.transcript", who, source: sourceOf(who, line.source), text })
    },
    answer(text: string, asked = "") {
      bus.publish({ type: "answer.ready", question: asked || question, text: String(text || "") })
    },
    snapshot(): SessionSnapshot {
      return {
        question,
        topics: brain.topics.slice(),
        claims: brain.claims.map((claim) => claim.span),
        answers: brain.answers.slice(),
        prewarm: brain.prewarm,
        lensNote,
        dossierNote,
        relevance,
        hardFlags,
        events: events.slice(),
        ms: 0,
        primed,
        knownTerms: knownTerms.slice(),
        mode,
        interviewer,
        frame,
        nudge,
        say,
        clarify,
        avoid: avoid.slice(),
        debrief,
        degraded,
        timeline: dev() ? marks.slice() : [],
      }
    },
    finish() {
      if (!debrief) publishDebrief()
      const elapsed = performance.now() - startedAt
      bus.publish({ type: "health.check", ok: !degraded, slow: elapsed > 150, ms: elapsed, detail: degraded ? "degraded" : "ok" })
      bus.publish({ type: "debug.span", count: marks.length })
    },
  }
}

/** One pass over the lines already on the request. No timer. No model. */
export function runSession(input: {
  transcript?: string
  lines?: SessionLine[]
  resume?: string
  jd?: string
  dossier?: string
  question?: string
  answer?: string
  prep?: string
  done?: boolean
}): SessionSnapshot {
  const started = performance.now()
  const system = createNervousSystem(input.prep || "")
  system.attach({ resume: input.resume, jd: input.jd, dossier: input.dossier, prep: input.prep })
  const lines = input.lines && input.lines.length ? input.lines : linesFromTranscript(input.transcript || "")
  for (const line of lines) system.hear(line)
  if (input.question && !system.snapshot().question) {
    system.hear({ who: "Them", text: input.question, source: "computer" })
  }
  if (input.answer) system.answer(input.answer, input.question || system.snapshot().question)
  if (input.done || lines.some((line) => isWrapUp(String(line.text || "")))) system.finish()
  const shot = system.snapshot()
  shot.ms = performance.now() - started
  return shot
}
