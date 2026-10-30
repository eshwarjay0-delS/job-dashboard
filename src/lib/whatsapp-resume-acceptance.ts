import type { TailorResult } from "./tailor"

/** Return safe diagnostic codes only. Never log resume text, JD or sender identity.
 * A 100% evidence-supported score is necessary but not sufficient: every
 * requested section must be complete and unverified JD claims must be absent.
 * Overall JD overlap remains a separate, honest measure of missing skills.
 */
// Same switch as src/lib/jd-terms-gate.ts, inlined so this module stays import-free for its tests' loader.
function jdTermsGateOn(): boolean {
  const v = String(globalThis.process?.env?.JD_TERMS_ALWAYS_ON_SKILLS ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

// Blueprint 2026-10-30, coverage gate: a complete file under 95% of the job post is delivered with the missing terms
// listed in the reply instead of a refusal. TAILOR_DELIVER_WITH_SHORTFALL=0 (or the job-post terms switch off) restores it.
function shortfallDeliveryOn(): boolean {
  const v = String(globalThis.process?.env?.TAILOR_DELIVER_WITH_SHORTFALL ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}
/** A complete draft under 95% of the job post, sent with the shortfall named. Anything incomplete is still refused. */
export function deliveredWithShortfall(result: TailorResult): boolean {
  return jdTermsGateOn() && shortfallDeliveryOn() && Number.isFinite(result.coverage) && result.coverage! < 95 &&
    !result.partial && !result.skills_only && !result.unchanged && !result.quality?.incomplete &&
    !(result.quality_blockers || []).length && !(result.unverified_added_keywords || []).length
}

export function whatsappResumeRejectionReasons(result: TailorResult): string[] {
  const reasons: string[] = []
  const quality = result.quality
  const supported = result.supported_coverage
  if (!result.token) reasons.push("no_document_token")
  if (result.unchanged || !result.diff?.length) reasons.push("unchanged")
  if (result.skills_only && !(Number.isFinite(result.coverage) && result.coverage! >= 95))
    reasons.push("skills_only")
  // Gate on: a resume whose skills are locked or that has no skills section is sent with the job-post terms listed in
  // the reply, so its coverage is not a refusal. The round-trip guard in the route still decides whether it goes out.
  // Only the coverage shortfall is excused: the file must otherwise be complete (no failed parts, no incomplete report,
  // no other blocker), and the only quality problem allowed is terms left out.
  const unplacedOk = jdTermsGateOn() && !!result.jd_terms_unplaced_reason && !!result.jd_terms_unplaced?.length &&
    !result.partial && !quality?.incomplete && !(result.quality_blockers || []).length
  const shortfallOk = deliveredWithShortfall(result)
  if (!unplacedOk && !shortfallOk && (!Number.isFinite(result.coverage) || result.coverage! < 95))
    reasons.push("jd_coverage_below_floor")
  if (result.partial) reasons.push("draft_parts_missing")
  if (!quality) return [...reasons, "quality_report_missing"]
  if (quality.incomplete) reasons.push("quality_incomplete")
  if (quality.status !== "coverage_met" && quality.status !== "delivered_with_gaps" && !((unplacedOk || shortfallOk) && quality.status === "needs_review"))
    reasons.push("quality_not_deliverable")
  if (!Number.isInteger(quality.total) || quality.total <= 0 ||
      !Number.isInteger(quality.matched) || quality.matched < 0 ||
      quality.matched > quality.total) reasons.push("invalid_supported_denominator")
  if (!Number.isFinite(supported) || supported! < 95)
    reasons.push("supported_coverage_below_floor")
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
