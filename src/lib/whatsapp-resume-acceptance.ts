import type { TailorResult } from "./tailor"

/** Return safe diagnostic codes only. Never log resume text, JD or sender identity.
 * A 100% evidence-supported score is necessary but not sufficient: every
 * requested section must be complete and unverified JD claims must be absent.
 * Overall JD overlap remains a separate, honest measure of missing skills.
 */
/** Supported-vocabulary floor for a clean WhatsApp pass that can be filed as a base.
 * A finished file under this share is still sent; the reply names the gap. */
export const WHATSAPP_SUPPORTED_FLOOR = 95
/** Clean WhatsApp pass for raw job-post overlap.
 * 95% remains the target and is named in the caption when the file is short of it.
 * A complete draft from 70% through 94.9% is a clean pass when supported coverage
 * is already at 95%, so an honest gap does not block filing.
 * Below 70% is not a clean pass. It is still sent when the rewrite finished,
 * with the missing terms named. A failed or incomplete rewrite sends the
 * already-chosen resume instead. TAILOR_DELIVER_WITH_SHORTFALL=0 or
 * JD_TERMS_ALWAYS_ON_SKILLS=0 restores the strict under-95% clean-pass refusal. */
export const WHATSAPP_JOB_POST_FLOOR = 70

/** A completed, readable file may be sent with measured coverage/role gaps disclosed.
 * A new unsupported claim about the candidate's experience is not a gap: it is
 * a factual-integrity failure and must use the already-chosen same-account file.
 * roles_unrewritten, a missing part, and a skills-only outage are also unfinished. */
const WHATSAPP_SHORTFALL_REASONS = new Set([
  "jd_coverage_below_floor",
  "supported_coverage_below_floor",
  "quality_not_deliverable",
  "role_evidence_gaps",
])

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

export function whatsappResumeRejectionReasons(result: TailorResult, opts?: { strict?: boolean }): string[] {
  const reasons: string[] = []
  const quality = result.quality
  const supported = result.supported_coverage
  // Web repair withholds anything under 95% raw overlap. The 70% band is WhatsApp delivery only.
  const honest = !opts?.strict && honestProfessionalGap(result)
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
  // A clean pass still requires a passing ATS parse of the exported document.
  // WhatsApp delivery is separate: whatsappRewriteUsable holds the file only
  // when that check shows the export has no resume text or no contact.
  // A missing check, or a date/name miss on a readable file, is not that hold.
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

/** Web download gate. Two repair passes still run, then a draft under 95% raw overlap
 * is held with no token. Unverified claims, identity changes, and an expired budget
 * are not waived by the WhatsApp 70% band or by the delivery failsafe. */
export function acceptableWebResume(result: TailorResult): boolean {
  return whatsappResumeRejectionReasons(result, { strict: true }).length === 0
}

type AtsLike = { passed?: boolean; checks?: { id?: string; passed?: boolean }[]; issues?: string[] }

/** The exported file did not parse as a resume: no body text, or no email and phone.
 * A missing ATS object is not this case. The check was skipped or not attached,
 * and a finished rewrite is still the file to send. A date or name miss on a
 * document that already parsed contact is a gap in the caption, not a broken export. */
export function atsExportUnreadable(ats: AtsLike | null | undefined): boolean {
  if (!ats || ats.passed) return false
  const failed = new Set<string>()
  for (const check of ats.checks || []) if (check && check.passed === false && check.id) failed.add(check.id)
  if (!failed.size) {
    for (const issue of ats.issues || []) {
      const id = String(issue).split(":")[0]?.trim()
      if (id) failed.add(id)
    }
  }
  if (!failed.size) return true
  return failed.has("substantive") || failed.has("contact")
}

/** A finished rewrite WhatsApp can send. A file whose writers did not return,
 * that did not change, or whose export has no resume text or contact is not usable:
 * the caller sends the already-chosen resume instead. A role under the 98%
 * evidence target, a missing ATS attachment, or a date/name parse miss on a
 * readable file is a named gap on that finished file, not a missing file.
 * Identity, name, dates and contact details are checked on the file bytes. */
export function whatsappRewriteUsable(result: TailorResult): boolean {
  if (!result?.token) return false
  if (result.unchanged || !result.diff?.length) return false
  if (result.skills_only || result.partial || result.quality?.incomplete) return false
  if (atsExportUnreadable(result.ats)) return false
  return whatsappResumeRejectionReasons(result).every(reason =>
    WHATSAPP_SHORTFALL_REASONS.has(reason) || reason === "ats_check_failed")
}

/** The usable rewrite is under a coverage floor, or it added job-post terms.
 * The reply names that shortfall. An incomplete draft is not a shortfall delivery.
 * A clean 70–94.9% pass has no rejection reasons, so this stays false for it. */
export function deliveredWithShortfall(result: TailorResult): boolean {
  if (!whatsappRewriteUsable(result)) return false
  const reasons = whatsappResumeRejectionReasons(result)
  return reasons.includes("jd_coverage_below_floor")
    || reasons.includes("supported_coverage_below_floor")
    || reasons.includes("unverified_jd_terms")
}

/** The already-chosen file may go out only for the profile this run selected.
 * No selected email means the person uploaded that file. Two emails in one file
 * are a mixed profile and are not sent. */
export function chosenResumeMatchesProfile(text: string, email?: string): boolean {
  if (!email) return true
  const want = email.toLowerCase()
  const found = [...new Set((String(text || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(s => s.toLowerCase()))]
  return found.length === 1 && found[0] === want
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
