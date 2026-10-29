import type { TailorResult } from "./tailor"

/** Return safe diagnostic codes only. Never log resume text, JD or sender identity.
 * A 100% evidence-supported score is necessary but not sufficient: every
 * requested section must be complete and unverified JD claims must be absent.
 * Overall JD overlap remains a separate, honest measure of missing skills.
 */
export function whatsappResumeRejectionReasons(result: TailorResult): string[] {
  const reasons: string[] = []
  const quality = result.quality
  const supported = result.supported_coverage
  if (!result.token) reasons.push("no_document_token")
  if (result.unchanged || !result.diff?.length) reasons.push("unchanged")
  if (result.skills_only) reasons.push("skills_only")
  if (result.partial) reasons.push("draft_parts_missing")
  if (!quality) return [...reasons, "quality_report_missing"]
  if (quality.incomplete) reasons.push("quality_incomplete")
  if (quality.status !== "coverage_met" && quality.status !== "delivered_with_gaps")
    reasons.push("quality_not_deliverable")
  if (!Number.isInteger(quality.total) || quality.total <= 0 ||
      !Number.isInteger(quality.matched) || quality.matched < 0 ||
      quality.matched > quality.total) reasons.push("invalid_supported_denominator")
  if (!Number.isFinite(supported) || supported! < 95)
    reasons.push("supported_coverage_below_floor")
  // Protect against stale caches reporting 100% while their quality counts
  // still show a lower coverage. coveragePercent truncates to one decimal.
  if (quality.total > 0 && quality.matched >= 0 && quality.matched <= quality.total &&
      Number.isFinite(supported) &&
      Math.abs(quality.matched / quality.total * 100 - supported!) > 0.11)
    reasons.push("supported_score_mismatch")
  if (result.unverified_added_keywords?.length) reasons.push("unverified_jd_terms")
  if (result.quality_blockers?.length) reasons.push(...result.quality_blockers)
  return [...new Set(reasons)]
}

export function acceptableWhatsAppResume(result: TailorResult): boolean {
  return whatsappResumeRejectionReasons(result).length === 0
}
