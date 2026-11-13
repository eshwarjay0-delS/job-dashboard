// Stage clock for one answer. Pure. The model call is not made here.

export type LatencyMark = { stage: string; at: number }

export function stageGaps(marks: readonly LatencyMark[]): { stages: Record<string, number>; total: number } {
  const stages: Record<string, number> = {}
  if (marks.length < 2) return { stages, total: 0 }
  for (let i = 1; i < marks.length; i++) stages[marks[i].stage] = Math.max(0, marks[i].at - marks[i - 1].at)
  return { stages, total: Math.max(0, marks[marks.length - 1].at - marks[0].at) }
}

/** One short line shown before the model streams. It does not claim a past job. */
export function instantSpokenLine(question: string): string {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (q.length < 12 || /^(?:preparing|deriving|ready|cleared|no question|waiting|listening)/i.test(q)) return ""
  const words = q.split(" ").slice(0, 8).join(" ").replace(/[?]+$/, "")
  return `I would start with ${words}, and say where I stop.`
}
