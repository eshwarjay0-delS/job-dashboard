// Defensibility layer for live answers (outside review of round-35, Nov 11 2026). One prompt block and one report so the
// answer service touches two lines; each fix adds its part here.
//   defensibilityPrompt(question)        appended to the model's user text
//   defensibilityReport(question, text)  attached to the done event / JSON body (never changes the answer text)
import { checklistPrompt, validate } from "./kompasChecklist.ts"
import { COHERENCE_PROMPT, coherence, coherenceScore } from "./kompasCoherence.ts"
import { RENAMED } from "./kompasHonestScore.ts"
import { HARD_CODES } from "./kompasShipGate.ts"
import { SPOKEN_STYLE_PROMPT, needsReasoning, reasoning, styleFindings } from "./kompasSpokenStyle.ts"
import { VARIETY_PROMPT, screenplay } from "./kompasStoryVariety.ts"

export type DefensibilityReport = {
  pass: boolean
  checklist: { coverage: number; missed: string[] }
  flags: string[]
  /** flags that fail the answer regardless of its mean (never ship worse) */
  hardFlags: string[]
  reasoning: { n: number; missing: string[] }
  /** honest naming: factuality-side checks are reported apart from delivery */
  factuality: { partCoverage: number; ledgerConsistent: null; technicalCoherence: number | null }
}

export function defensibilityPrompt(question: string): string {
  return [checklistPrompt(question), COHERENCE_PROMPT, SPOKEN_STYLE_PROMPT, VARIETY_PROMPT].filter(Boolean).join("\n\n")
}

export function defensibilityReport(question: string, answer: string): DefensibilityReport {
  const v = validate(question, answer)
  const flags = v.missed.map((m) => `checklist-missed:${m.key}`)
  const coh = coherence(answer)
  for (const f of coh) flags.push(f.code)
  for (const f of styleFindings(answer)) flags.push(f.code)
  const r = reasoning(answer)
  if (needsReasoning(question) && r.n < 4) flags.push("thin-reasoning")
  if (screenplay(answer).formula) flags.push("screenplay")
  const hardFlags = flags.filter((f) => HARD_CODES.has(f.split(":")[0]) || f.startsWith("checklist-missed"))
  return { pass: !hardFlags.length, checklist: { coverage: v.coverage, missed: v.missed.map((m) => m.text) }, flags, hardFlags, reasoning: { n: r.n, missing: r.missing }, factuality: { partCoverage: v.coverage, ledgerConsistent: null, technicalCoherence: coherenceScore(coh) } }
}

// "grounded" is reported as "ledgerConsistent" everywhere (it never meant verified).
export const dimensionLabel = (key: string): string => RENAMED[key] || key
