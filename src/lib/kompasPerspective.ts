// Perspective layer. The lexicon is the fast checked part. These lines are the rest:
// what he thinks the interviewer cares about, a stance with a reason, a follow-up,
// a plain note of interest, and one line of ownership. Wording is fixed here.
// A line that fails the gloss validator or the session ledger is dropped.

import { validateStatement } from "./kompasGloss.ts"
import { screenSuggestion } from "./kompasSessionMind.ts"

export type PerspectiveBeat = "interpretation" | "perspective" | "curiosity" | "interest" | "impression"

const HYPE = /\b(?:amazing|awesome|cutting-edge|delve|exciting|fascinating|game-changer|holistic|incredible|leverage|passionate|robust|seamlessly|thrilled|comprehensive)\b/i
const PROFILE = /\b(?:houston|saint louis|st\.?\s*louis|jayeshwar44|eshwarjay05|eshwarjay06|jayeshwar24)\b/i

const STANCE = /\bI (?:would )?lean toward\b/i
const CURIOSITY = /\bthe follow-up I would ask\b/i
const INTERPRET = /\bwhat I take you to care about\b/i
const INTEREST = /\bworth a closer look\b/i
const IMPRESSION = /\b(?:I would own the stop|the judgement I would keep)\b/i

function hash(text: string): number {
  let h = 7
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

function bitOf(question: string): string {
  const skip = new Set("what how why when where who which does did the and for you your with that this from into about would could should have been are was can tell describe explain walk please just really very".split(" "))
  const words = String(question || "").replace(/[?!.]+/g, " ").toLowerCase().split(/[^a-z0-9+-]+/).filter((word) => word.length > 2 && !skip.has(word))
  return words.slice(0, 4).join(" ") || "this"
}

function reasonFromResume(question: string, resume: string): string {
  const keys = bitOf(question).split(/\s+/).filter((word) => word.length >= 5)
  if (!keys.length) return ""
  const lines = String(resume || "").split(/\n/).map((line) => line.replace(/^[\s#>*•▪●\-]+/, "").trim()).filter((line) => line.length >= 40 && line.length <= 140 && !/@/.test(line) && !PROFILE.test(line))
  const hit = lines.find((line) => keys.some((key) => line.toLowerCase().includes(key)))
  if (!hit) return ""
  return hit.split(/\s+/).slice(0, 8).join(" ")
}

function linesFor(level: string, bit: string, reason: string): Record<PerspectiveBeat, string> {
  if (level === "director") {
    return {
      interpretation: `The decision I hear in ${bit} is which way I would call it.`,
      perspective: reason
        ? `I lean toward ${bit} because the resume already says ${reason}.`
        : `I would lean toward ${bit} because that is the part this question turns on.`,
      curiosity: `What I would ask next about ${bit} is which result would change the call.`,
      interest: `What is worth a closer look in ${bit} is the cost of getting it wrong.`,
      impression: `I would own the stop on ${bit} and name the residual.`,
    }
  }
  if (level === "architect") {
    return {
      interpretation: `The boundary I hear in ${bit} is where I would stop the design.`,
      perspective: reason
        ? `I would lean toward ${bit} because the resume already says ${reason}.`
        : `I would lean toward keeping ${bit} inside one boundary.`,
      curiosity: `The follow-up I would ask is who owns ${bit} when that boundary moves.`,
      interest: `What is worth a closer look in ${bit} is the first place it can break.`,
      impression: `The judgement I would keep on ${bit} is where I stop.`,
    }
  }
  return {
    interpretation: `What I take you to care about in ${bit} is the call, not a definition.`,
    perspective: reason
      ? `I lean toward ${bit} because the resume already says ${reason}.`
      : `I would lean toward ${bit} because that is the check I would not skip.`,
    curiosity: `The follow-up I would ask is what ${bit} looks like when the check fails.`,
    interest: `What is worth a closer look in ${bit} is where that check can fail.`,
    impression: `I would own the stop on ${bit} and say so.`,
  }
}

const MIX: Record<string, PerspectiveBeat[]> = {
  engineer: ["interpretation", "perspective", "impression", "interest", "curiosity"],
  director: ["perspective", "impression", "interest", "interpretation"],
  architect: ["curiosity", "interpretation", "perspective", "interest"],
}

/** One or two beats. The mode changes the pool, and the question changes which beat is used. */
export function perspectiveDraft(question: string, level: string, resume: string, said: readonly string[] = [], spoken = ""): string[] {
  const fromSpoken = String(spoken || "").replace(/\byourself\b/gi, "this work").replace(/\byour\b/gi, "").replace(/\s+/g, " ").trim()
  const bit = fromSpoken || bitOf(question).replace(/\byourself\b/g, "this work")
  const reason = reasonFromResume(question, resume)
  const pool = MIX[level] || MIX.engineer
  const bank = linesFor(level, bit, reason)
  const h = hash(`${level}|${question}`)
  const count = h % 3 === 0 ? 1 : 2
  const start = h % pool.length
  const out: string[] = []
  for (let i = 0; i < pool.length && out.length < count; i++) {
    const beat = pool[(start + i) % pool.length]
    const line = bank[beat]
    if (!line || HYPE.test(line) || PROFILE.test(line) || /\byour(?:self)?\b/i.test(line)) continue
    const screened = screenSuggestion(line, "", said)
    if (!screened.line || screened.blocked || screened.rewritten) continue
    const check = validateStatement(screened.line, resume)
    if (!check.ok) continue
    if (!out.includes(check.line)) out.push(check.line)
  }
  return out
}

export type VarietyReport = {
  n: number
  distinctOpeners: number
  stance: number
  curiosity: number
  interpretation: number
  interest: number
  impression: number
  repetitionRate: number
}

export function varietyReport(answers: readonly string[]): VarietyReport {
  const openers = answers.map((answer) => String(answer || "").toLowerCase().split(/\s+/).slice(0, 3).join(" "))
  const counts: Record<string, number> = {}
  for (const opener of openers) counts[opener] = (counts[opener] || 0) + 1
  const repeated = openers.filter((opener) => counts[opener] > 1).length
  const n = answers.length || 1
  return {
    n: answers.length,
    distinctOpeners: new Set(openers).size,
    stance: answers.filter((answer) => STANCE.test(answer)).length,
    curiosity: answers.filter((answer) => CURIOSITY.test(answer)).length,
    interpretation: answers.filter((answer) => INTERPRET.test(answer)).length,
    interest: answers.filter((answer) => INTEREST.test(answer)).length,
    impression: answers.filter((answer) => IMPRESSION.test(answer)).length,
    repetitionRate: repeated / n,
  }
}
