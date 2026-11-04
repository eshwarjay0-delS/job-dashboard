// Risk factor score (Nov 4): the tailor had an ATS scorer but no risk-as-a-score —
// risk was only ever prose ("critical risk of getting rejected"). This builds the
// number from the run's own blockers, never from a model verdict, so every
// delivered file can report "ATS score plus risk factor score" side by side.
// Scale: 0 = clean, 100 = do not send. Levels: <25 low, <50 medium, <75 high,
// otherwise critical. Weights are deliberately blunt and documented: claiming
// experience the candidate does not have is the heaviest single factor, because
// that is the rejection that also burns the candidate's name.
export interface RiskInput {
  coverage?: number
  atsIssues?: string[]
  atsPassed?: boolean
  unverifiedAdded?: string[]
  missing?: string[]
  qualityBlockers?: string[]
  droppedCount?: number
  skillsOnly?: boolean
}

export interface RiskResult {
  score: number
  level: "low" | "medium" | "high" | "critical"
  factors: string[]
}

export function riskScore(input: RiskInput): RiskResult {
  const factors: string[] = []
  let score = 0
  const add = (points: number, label: string) => {
    if (points <= 0) return
    score += points
    factors.push(label)
  }
  const coverage = input.coverage
  if (typeof coverage === "number" && Number.isFinite(coverage) && coverage < 95) {
    add(Math.round((95 - coverage) * 0.5), `JD coverage ${coverage}% is below the 95% floor`)
  }
  const issues = (input.atsIssues || []).filter(Boolean)
  if (issues.length) add(issues.length * 8, `${issues.length} ATS parse issue(s)`)
  if (input.atsPassed === false) add(15, "ATS parse check failed")
  const unverified = (input.unverifiedAdded || []).filter(Boolean)
  if (unverified.length) add(unverified.length * 15, `${unverified.length} unverified claim(s) the resume does not support`)
  const missing = (input.missing || []).filter(Boolean)
  if (missing.length) add(Math.min(missing.length, 10) * 2, `${missing.length} JD term(s) still missing`)
  const blockers = (input.qualityBlockers || []).filter(Boolean)
  if (blockers.length) add(Math.min(blockers.length, 4) * 5, `${blockers.length} quality blocker(s)`)
  if (input.droppedCount && input.droppedCount > 0) {
    add(Math.min(input.droppedCount, 3) * 5, `${input.droppedCount} paragraph(s) dropped`)
  }
  if (input.skillsOnly) add(25, "writers did not finish a full resume")
  score = Math.min(100, Math.round(score))
  const level = score < 25 ? "low" : score < 50 ? "medium" : score < 75 ? "high" : "critical"
  return { score, level, factors }
}
