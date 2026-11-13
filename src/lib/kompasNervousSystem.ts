// One memory for the Kompas engines. Each engine publishes on the bus and
// reads the same brain state. Nothing here calls a model or the network.

import { lensBlock } from "./kompasAudience.ts"
import { emptyBrain, isPartialQuestion, perceive, type BrainState } from "./kompasBrain.ts"
import { createBus, type EarSource, type KompasBus } from "./kompasBus.ts"
import { defensibilityReport } from "./kompasDefensibility.ts"
import { captureEarly, selectAnswerContext } from "./kompasLongContext.ts"
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

export function createNervousSystem() {
  const bus = createBus()
  let brain: BrainState = emptyBrain()
  let question = ""
  let resume = ""
  let jd = ""
  let dossier = ""
  let lensNote = ""
  let dossierNote = ""
  let relevance: number | null = null
  let hardFlags = 0
  const events: string[] = []
  const note = (type: string) => { events.push(type); if (events.length > 80) events.shift() }

  const publishState = () => {
    bus.publish({ type: "brain.state", question, topics: brain.topics.slice(), claims: brain.claims.length })
  }

  bus.subscribe("context.attach", (event) => {
    if (event.type !== "context.attach") return
    resume = event.resume
    jd = event.jd
    dossier = event.dossier
    note(event.type)
  })

  bus.subscribe("ear.transcript", (event) => {
    if (event.type !== "ear.transcript") return
    note(event.type)
    const step = perceive(brain, { who: event.who, text: event.text }, resume)
    brain = step.state
    bus.publish({ type: "clarify.action", action: step.action, shown: step.shown, ms: step.ms })
    if (event.who !== "You") {
      const early = captureEarly(event.text)
      if (early) bus.publish({ type: "ear.question", text: early, partial: isPartialQuestion(event.text) })
    }
    publishState()
  })

  bus.subscribe("ear.question", (event) => {
    if (event.type !== "ear.question") return
    note(event.type)
    question = event.text
    const picked = selectAnswerContext([{ who: "Them", text: event.text }])
    if (picked.question) question = picked.question
    lensNote = lensBlock("engineer", question).slice(0, 180)
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
    bus.publish({ type: "answer.scored", question: asked, relevance, hardFlags })
  })

  bus.subscribe("clarify.action", (event) => { if (event.type === "clarify.action") note(event.type) })
  bus.subscribe("lens.note", (event) => { if (event.type === "lens.note") note(event.type) })
  bus.subscribe("dossier.note", (event) => { if (event.type === "dossier.note") note(event.type) })
  bus.subscribe("answer.scored", (event) => { if (event.type === "answer.scored") note(event.type) })
  bus.subscribe("brain.state", (event) => { if (event.type === "brain.state") note(event.type) })

  return {
    bus: bus as KompasBus,
    attach(input: { resume?: string; jd?: string; dossier?: string }) {
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
      }
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
}): SessionSnapshot {
  const started = performance.now()
  const system = createNervousSystem()
  system.attach({ resume: input.resume, jd: input.jd, dossier: input.dossier })
  const lines = input.lines && input.lines.length ? input.lines : linesFromTranscript(input.transcript || "")
  for (const line of lines) system.hear(line)
  if (input.question && !system.snapshot().question) {
    system.hear({ who: "Them", text: input.question, source: "computer" })
  }
  if (input.answer) system.answer(input.answer, input.question || system.snapshot().question)
  const shot = system.snapshot()
  shot.ms = performance.now() - started
  return shot
}
