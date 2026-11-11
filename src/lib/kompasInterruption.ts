/**
 * Interruption flush (readability only, 2026-11-10).
 *
 * When interviewer voice arrives while a card is on screen or the candidate
 * is talking, clear the current card and show a short pivot of five words or
 * fewer that names the new constraint, then resolve the new ask.
 * Layout only.
 */

import { resolveStutterRephrase } from "./kompasStutterRephrase.ts"

const STOP = new Set("the a an and or but if like you know um uh so of to for with in on at as is was were be been this that those these it your my their do does did have has had would could can will just maybe even about from into not how what why when where which who whom whose".split(" "))

export const PIVOT_MAX_WORDS = 5

export type InterruptionInput = {
  interviewerSpeaking: boolean
  cardShowing: boolean
  candidateTalking: boolean
  newAsk?: string
}

export type InterruptionDecision = {
  flush: boolean
  pivot: string
  resolve: boolean
  question: string
  reason: string
}

/** Five words or fewer naming the new constraint (content words preferred). */
export function pivotConstraint(text: string, maxWords = PIVOT_MAX_WORDS): string {
  const resolved = resolveStutterRephrase(text)
  const src = resolved.finalConstraint || resolved.text || String(text || "")
  const toks = src.replace(/[^A-Za-z0-9+#./\s-]+/g, " ").split(/\s+/).filter(Boolean)
  const content = toks.filter((w) => !STOP.has(w.toLowerCase()) && w.length > 1)
  const pick = (content.length ? content : toks).slice(0, Math.max(1, maxWords))
  return pick.join(" ").trim()
}

export function interruptionFlush(opts: InterruptionInput): InterruptionDecision {
  const ask = String(opts.newAsk || "").replace(/\s+/g, " ").trim()
  const should = !!opts.interviewerSpeaking && (!!opts.cardShowing || !!opts.candidateTalking) && !!ask
  if (!should) {
    return { flush: false, pivot: "", resolve: false, question: ask, reason: "no-interrupt" }
  }
  const stutter = resolveStutterRephrase(ask)
  const question = stutter.text || ask
  if (stutter.incomplete && !stutter.rephrased) {
    return { flush: true, pivot: pivotConstraint(question), resolve: false, question, reason: "incomplete" }
  }
  return {
    flush: true,
    pivot: pivotConstraint(question),
    resolve: true,
    question,
    reason: "interrupt",
  }
}
