/** Shared acceptance baseline for web, WhatsApp, and cached generations.
 * 95% is the delivery floor (owner: "we should deliver 95 to 100% match resumes");
 * 98% is the target. Below 95% the file is held; 95-97% ships with gaps noted. */
export const RESUME_MIN_COVERAGE = 0.95
export const RESUME_TARGET_COVERAGE = 0.98

export function resumeQuality(input: {
  matched: number
  total: number
  missing: string[]
  partial?: boolean
  unchanged?: boolean
}) {
  const validCounts = Number.isInteger(input.total) && Number.isInteger(input.matched) && input.total > 0 && input.matched >= 0 && input.matched <= input.total
  const coverage = validCounts ? input.matched / input.total : 0
  const meetsTarget = validCounts && coverage >= RESUME_TARGET_COVERAGE && !input.partial && !input.unchanged
  const meetsFloor = validCounts && coverage >= RESUME_MIN_COVERAGE && !input.partial && !input.unchanged
  return {
    status: meetsTarget ? "coverage_met" as const : meetsFloor ? "delivered_with_gaps" as const : "needs_review" as const,
    minimum: RESUME_MIN_COVERAGE * 100,
    target: RESUME_TARGET_COVERAGE * 100,
    matched: input.matched,
    total: input.total,
    missing: input.missing,
  }
}

/** Enrichment is writing context, never a new acceptance obligation. */
export function requiredEvidenceTerms(original: readonly string[], listed: readonly string[]): string[] {
  const required = new Set(original)
  return [...new Set(listed)].filter(term => required.has(term))
}
