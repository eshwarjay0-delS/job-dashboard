import type { TailorResult } from "./tailor"

/** Return safe diagnostic codes only. Never log resume text, JD or sender identity.
 * A 100% evidence-supported score is necessary but not sufficient: every
 * requested section must be complete and unverified JD claims must be absent.
 * Overall JD overlap remains a separate, honest measure of missing skills.
 */
/** Supported-vocabulary floor. The rewrite must keep at least this share of the
 * terms the resume or a confirmation already supports. */
export const WHATSAPP_SUPPORTED_FLOOR = 95
/** Raw job-post overlap floor for an otherwise complete draft.
 * 95% remains the target and is still named in the caption when the file is short of it.
 * A complete draft from 70% through 94.9% is delivered when supported coverage is
 * already at the 95% floor, so an honest gap (a certification or product the
 * resume does not claim) does not hold a professional file.
 * Below 70% stays held. That still refuses the 28.5% and 0% WhatsApp holds.
 * TAILOR_DELIVER_WITH_SHORTFALL=0 or JD_TERMS_ALWAYS_ON_SKILLS=0 restores the
 * strict under-95% refusal. */
export const WHATSAPP_JOB_POST_FLOOR = 70

/** Compatibility export. The 70% band is decided in whatsappResumeRejectionReasons,
 * not by this flag. */
export function deliveredWithShortfall(result: TailorResult): boolean {
  void result
  return false
}

function envFlag(name: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return String(proc?.env?.[name] ?? "").trim().toLowerCase()
}

/** Legacy switches that put the raw 95% refusal back. Unset means the 70% band is on. */
function strictJobPostFloor(): boolean {
  const shortfall = envFlag("TAILOR_DELIVER_WITH_SHORTFALL")
  if (shortfall === "0" || shortfall === "false" || shortfall === "off" || shortfall === "no") return true
  const gate = envFlag("JD_TERMS_ALWAYS_ON_SKILLS")
  if (gate === "0" || gate === "false" || gate === "off" || gate === "no") return true
  return false
}

/** A finished rewrite whose only miss is raw job-post overlap in the 70–94.9 band. */
export function honestProfessionalGap(result: TailorResult): boolean {
  if (strictJobPostFloor()) return false
  const coverage = result.coverage
  const supported = result.supported_coverage
  const quality = result.quality
  if (!Number.isFinite(coverage) || !Number.isFinite(supported)) return false
  if (coverage! < WHATSAPP_JOB_POST_FLOOR || coverage! >= 95 || coverage! > 100) return false
  if (supported! < WHATSAPP_SUPPORTED_FLOOR || supported! > 100) return false
  if (!result.token || result.unchanged || !result.diff?.length) return false
  if (result.skills_only || result.partial) return false
  if (result.unverified_added_keywords?.length) return false
  if (result.quality_blockers?.length) return false
  if (result.jd_terms_unplaced_reason) return false
  if (!quality || quality.incomplete) return false
  if (!result.ats?.passed) return false
  if (!Number.isInteger(quality.total) || quality.total <= 0 ||
      !Number.isInteger(quality.matched) || quality.matched < 0 || quality.matched > quality.total) return false
  if (Math.abs(quality.matched / quality.total * 100 - coverage!) > 0.11) return false
  return true
}

export function whatsappResumeRejectionReasons(result: TailorResult): string[] {
  const reasons: string[] = []
  const quality = result.quality
  const supported = result.supported_coverage
  const honest = honestProfessionalGap(result)
  if (!result.token) reasons.push("no_document_token")
  if (result.unchanged || !result.diff?.length) reasons.push("unchanged")
  if (result.skills_only)
    reasons.push("skills_only")
  if ((!Number.isFinite(result.coverage) || result.coverage! < 95 || result.coverage! > 100) && !honest)
    reasons.push("jd_coverage_below_floor")
  if (result.partial) reasons.push("draft_parts_missing")
  if (!quality) return [...reasons, "quality_report_missing"]
  if (quality.incomplete) reasons.push("quality_incomplete")
  if (quality.status !== "coverage_met" && quality.status !== "delivered_with_gaps" && !honest)
    reasons.push("quality_not_deliverable")
  if (!Number.isInteger(quality.total) || quality.total <= 0 ||
      !Number.isInteger(quality.matched) || quality.matched < 0 ||
      quality.matched > quality.total) reasons.push("invalid_supported_denominator")
  if (!Number.isFinite(supported) || supported! < WHATSAPP_SUPPORTED_FLOOR)
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
