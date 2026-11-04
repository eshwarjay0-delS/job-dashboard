import type { TailorResult } from "./tailor"

/** Return safe diagnostic codes only. Never log resume text, JD or sender identity.
 * A 100% evidence-supported score is necessary but not sufficient: every
 * requested section must be complete and unverified JD claims must be absent.
 * Overall JD overlap remains a separate, honest measure of missing skills.
 */
/** Compatibility export: Nov4 owner requires at least 95% actual JD coverage.
 * No environment switch or locked section may waive that delivery target. */
export function deliveredWithShortfall(result: TailorResult): boolean {
  void result
  return false
}

export function whatsappResumeRejectionReasons(result: TailorResult): string[] {
  const reasons: string[] = []
  const quality = result.quality
  const supported = result.supported_coverage
  if (!result.token) reasons.push("no_document_token")
  if (result.unchanged || !result.diff?.length) reasons.push("unchanged")
  if (result.skills_only)
    reasons.push("skills_only")
  if (!Number.isFinite(result.coverage) || result.coverage! < 95 || result.coverage! > 100)
    reasons.push("jd_coverage_below_floor")
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
  // Fail closed: a delivered resume must carry a passing ATS parse check
  // measured on its exported document. A result without one is unproven.
  if (!result.ats || !result.ats.passed)
    reasons.push("ats_check_failed")
  // Protect against a stale cache whose quality counts do not match the job-post
  // coverage on the result. coveragePercent truncates to one decimal.
  if (quality.total > 0 && quality.matched >= 0 && quality.matched <= quality.total &&
      Number.isFinite(result.coverage) &&
      Math.abs(quality.matched / quality.total * 100 - result.coverage!) > 0.11)
    reasons.push("supported_score_mismatch")
  if (result.unverified_added_keywords?.length) reasons.push("unverified_jd_terms")
  if (result.quality_blockers?.length) reasons.push(...result.quality_blockers)
  return [...new Set(reasons)]
}

export function acceptableWhatsAppResume(result: TailorResult): boolean {
  return whatsappResumeRejectionReasons(result).length === 0
}

/** Plain words for rejection codes, for the message that tells the user why a
 * draft was held. Unknown codes are dropped, never shown as jargon. */
const REJECTION_WORDS: Record<string, string> = {
  no_document_token: "no finished document was produced",
  unchanged: "the rewrite made no changes",
  draft_parts_missing: "parts of the draft are missing",
  quality_report_missing: "the quality report is missing",
  quality_incomplete: "the quality report is incomplete",
  quality_not_deliverable: "the quality report does not clear the delivery bar",
  invalid_supported_denominator: "the supported-skills count is invalid",
  supported_score_mismatch: "the quality counts do not match the job-post coverage",
  unverified_jd_terms: "the draft added job-post terms that are not in your resume",
}

export function describeRejectionReasons(reasons: string[]): string[] {
  const out: string[] = []
  for (const reason of reasons) {
    const words = REJECTION_WORDS[reason]
    if (words && !out.includes(words)) out.push(words)
  }
  return out
}
