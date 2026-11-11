// Defensibility layer for live answers (outside review of round-35, Nov 11 2026). One prompt block and one report so the
// answer service touches two lines; each fix adds its part here.
//   defensibilityPrompt(question)        appended to the model's user text
//   defensibilityReport(question, text)  attached to the done event / JSON body (never changes the answer text)
import { checklistPrompt, validate } from "./kompasChecklist.ts"
import { COHERENCE_PROMPT, coherence } from "./kompasCoherence.ts"
import { HARD_CODES } from "./kompasShipGate.ts"

export type DefensibilityReport = {
  pass: boolean
  checklist: { coverage: number; missed: string[] }
  flags: string[]
  /** flags that fail the answer regardless of its mean (never ship worse) */
  hardFlags: string[]
}

export function defensibilityPrompt(question: string): string {
  return [checklistPrompt(question), COHERENCE_PROMPT].filter(Boolean).join("\n\n")
}

export function defensibilityReport(question: string, answer: string): DefensibilityReport {
  const v = validate(question, answer)
  const flags = v.missed.map((m) => `checklist-missed:${m.key}`)
  const coh = coherence(answer)
  for (const f of coh) flags.push(f.code)
  const hardFlags = flags.filter((f) => HARD_CODES.has(f.split(":")[0]) || f.startsWith("checklist-missed"))
  return { pass: !hardFlags.length, checklist: { coverage: v.coverage, missed: v.missed.map((m) => m.text) }, flags, hardFlags }
}
