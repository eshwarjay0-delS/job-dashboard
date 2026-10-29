import type { TailorResult } from "./tailor"

/** WhatsApp delivery is stricter than the dashboard review surface: a draft must
 * be complete, genuinely changed, and meet the 95% floor on evidenced requirements.
 * Overall JD overlap is reported separately and must never be relabeled as this score.
 */
export function acceptableWhatsAppResume(result: TailorResult): boolean {
  const quality = result.quality
  const supported = result.supported_coverage
  return !!result.token && !result.unchanged && !result.skills_only && !result.partial &&
    !!result.diff?.length && !!quality && quality.status !== "needs_review" &&
    !quality.incomplete && quality.total > 0 && quality.matched <= quality.total &&
    Number.isFinite(supported) && supported! >= 95
}
