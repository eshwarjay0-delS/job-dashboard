export type ResumeGapRole = {
  role: string
  bullets: number
  rewritten: number
  added: number
  skills: number
  required: number
}

export type ResumeGapReport = {
  /** Raw JD-term overlap measured on the exported DOCX, not an ATS vendor score. */
  coverage: number | null
  /** JD requirements supported by the original resume or explicit candidate confirmations. */
  supportedCoverage: number | null
  /** Requirements absent from the exported DOCX. */
  missingKeywords: string[]
  /** JD requirements not evidenced by the source resume or explicit confirmations. */
  unsupportedRequirements: string[]
  /** Unsupported JD terms that were detected as new claims in the generated DOCX. */
  unverifiedClaims: string[]
  roles: ResumeGapRole[]
  enrichment: { suggested: string[]; placed: string[]; blocked: string[] } | null
  atsPassed: boolean | null
  atsIssues: string[]
  qualityBlockers: string[]
  hasEvidence: boolean
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const clean = item.trim()
    const key = clean.toLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    out.push(clean)
  }
  return out
}

function percent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

function roles(value: unknown): ResumeGapRole[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const row = record(item)
    if (typeof row.role !== "string" || !row.role.trim()) return []
    return [{
      role: row.role.trim(),
      bullets: count(row.bullets),
      rewritten: count(row.rewritten),
      added: count(row.added),
      skills: count(row.skills),
      required: count(row.required),
    }]
  })
}

/**
 * Build the user-facing gap report from one TailorResult. The exported DOCX's
 * missing terms are deliberately kept separate from requirements that have no
 * source/confirmation evidence; neither list is used to invent experience.
 */
export function buildResumeGapReport(value: unknown): ResumeGapReport {
  const result = record(value)
  const quality = record(result.quality)
  const keywordAnalysis = record(result.keyword_analysis)
  const ats = record(result.ats)

  // quality.missing is recounted from the exact exported DOCX. Only older
  // result shapes without that field fall back to the earlier keyword analysis.
  const missingSource = Array.isArray(quality.missing)
    ? quality.missing
    : keywordAnalysis.missing

  const coverage = typeof result.coverage === "number"
    ? percent(result.coverage)
    : percent(keywordAnalysis.coverage_after)
  const supportedCoverage = percent(result.supported_coverage)
  const missingKeywords = strings(missingSource)
  const unsupportedRequirements = strings(result.unsupported_keywords)
  const unverifiedClaims = strings(result.unverified_added_keywords)
  const roleRows = roles(result.role_alignment)
  const enrichmentKeys = ["enrichment_suggested", "enrichment_placed", "enrichment_blocked"]
  const hasEnrichment = enrichmentKeys.some(key => Array.isArray(result[key]))
  const enrichment = hasEnrichment ? {
    suggested: strings(result.enrichment_suggested),
    placed: strings(result.enrichment_placed),
    blocked: strings(result.enrichment_blocked),
  } : null
  const atsPassed = typeof ats.passed === "boolean" ? ats.passed : null
  const atsIssues = strings(ats.issues)
  const qualityBlockers = strings(result.quality_blockers)

  return {
    coverage,
    supportedCoverage,
    missingKeywords,
    unsupportedRequirements,
    unverifiedClaims,
    roles: roleRows,
    enrichment,
    atsPassed,
    atsIssues,
    qualityBlockers,
    hasEvidence: coverage !== null || supportedCoverage !== null ||
      missingKeywords.length > 0 || unsupportedRequirements.length > 0 ||
      unverifiedClaims.length > 0 || roleRows.length > 0 || hasEnrichment ||
      atsPassed !== null || atsIssues.length > 0 || qualityBlockers.length > 0,
  }
}
