// Fix 7 (defensibility cycle): honest scoring. "grounded" is renamed "ledgerConsistent" (under the invention rule it only
// ever meant consistent with the story ledger and pins, never verified). Factuality and part coverage are reported apart
// from delivery; anti-AI, emphasis, pitch and thoughtfulness leave the headline; a hard failure overrides the total.
// A fixed holdout set (never tuned on) is judged by an independent model.

export const HEADLINE_KEYS = ["partCoverage", "ledgerConsistent", "technicalCoherence", "followUpSurvival", "reasoning", "maturity", "accuracy", "ownership", "commercialLiteracy", "deEscalationEQ"] as const
export const DELIVERY_KEYS = ["human", "grammar", "professional", "antiAI", "emphasis", "pitch", "thoughtfulness", "breathability", "balanced"] as const
export const DEMOTED = new Set(["antiAI", "emphasis", "pitch", "thoughtfulness"])
export const RENAMED: Record<string, string> = { grounded: "ledgerConsistent" }

export function renameDims(d: Record<string, number | null | undefined>): Record<string, number | null | undefined> {
  const out: Record<string, number | null | undefined> = {}
  for (const [k, v] of Object.entries(d)) out[RENAMED[k] || k] = v
  return out
}
export const HARD_TOTAL_CAP = 49
export function honestTotal(dims: Record<string, number | null | undefined>, hardFail: boolean): { headline: number; delivery: number; total: number } {
  const avg = (keys: readonly string[]) => { const v = keys.map((k) => dims[k]).filter((x): x is number => typeof x === "number"); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0 }
  const headline = avg(HEADLINE_KEYS), delivery = avg(DELIVERY_KEYS)
  const total = +(0.8 * headline + 0.2 * delivery).toFixed(1)
  return { headline, delivery, total: hardFail ? Math.min(total, HARD_TOTAL_CAP) : total }
}

export const JUDGE_SYSTEM = `You are an independent senior security hiring manager reviewing ONE interview answer. Stories may be invented inside the candidate's real roles; judge them as an interviewer would: would this survive follow-up? Score separately:
- factuality (0-100): internally consistent, technically correct (tools, logs, OS, event IDs fit; detection supports conclusions; verification proves fixes), right authority, plausible scale, his part distinct from the team's.
- partCoverage (0-100): share of the question's explicit parts that are answered explicitly. List the parts.
- delivery (0-100): sounds like a real person speaking; no slogans, no theatrical dialogue, no tool-as-hero.
- hire: "yes" | "maybe" | "no" for a senior security engineer.
Return JSON only: {"parts":[{"part":"","covered":true}],"factuality":0,"partCoverage":0,"delivery":0,"hire":"maybe","problems":["quote + why"]}`
export type JudgeVerdict = { factuality: number; partCoverage: number; delivery: number; hire: string; problems: string[]; parts: Array<{ part: string; covered: boolean }> }
export function parseJudge(text: string): JudgeVerdict | null {
  const m = String(text || "").match(/\{[\s\S]*\}/); if (!m) return null
  try {
    const j = JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1"))
    const num = (x: unknown) => Math.max(0, Math.min(100, Number(x) || 0))
    return { factuality: num(j.factuality), partCoverage: num(j.partCoverage), delivery: num(j.delivery), hire: String(j.hire || "maybe").toLowerCase(), problems: (Array.isArray(j.problems) ? j.problems : []).map(String), parts: (Array.isArray(j.parts) ? j.parts : []).map((p: Record<string, unknown>) => ({ part: String(p.part || ""), covered: p.covered !== false })) }
  } catch { return null }
}
