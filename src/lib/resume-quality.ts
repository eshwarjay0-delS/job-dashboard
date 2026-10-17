/** Shared acceptance baseline for web, WhatsApp, and cached generations. */
export const RESUME_MIN_COVERAGE = 0.98
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
  const meetsBaseline = validCounts && coverage >= RESUME_MIN_COVERAGE && !input.partial && !input.unchanged
  return {
    status: meetsBaseline ? "coverage_met" as const : "needs_review" as const,
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
