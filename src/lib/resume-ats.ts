import type { Zones } from "./docx"

/**
 * ATS parseability of the EXPORTED document, measured on the text and zones
 * extracted from the rendered DOCX — never on the edits that were supposed to
 * go in. This is the structural half of the Nov 4 "real match" fix: a resume
 * can score 100% on JD keywords and still fail an applicant tracking system
 * when its contact block, sections, or role dates do not parse.
 *
 * The module is deliberately import-free at runtime (Zones is a type-only
 * import) so its tests load without the docx toolchain, the same way
 * whatsapp-resume-acceptance stays import-free for its tests.
 *
 * Scoring is a plain fraction of checks passed, truncated to one decimal —
 * the same truncation coveragePercent uses — so a reported score can be
 * recomputed from the check list with no hidden weighting. There is no
 * partial credit inside a check: a role without a date fails the dates
 * check outright, and a missing contact block fails the contact check.
 *
 * What this does NOT measure: keyword match (that is coverage), claim
 * truthfulness (that is the evidence gate), or hiring probability. An ATS
 * pass plus an evidence pass is the delivery bar; neither alone is enough.
 * Issue strings carry no resume content, only counts and positions, so a
 * caller may safely log them or name them in a reply.
 */

export interface AtsCheck {
  id: string
  passed: boolean
  reason: string
}

export interface AtsResult {
  /** 0–100, truncated to one decimal. 100 means every check passed. */
  score: number
  passed: boolean
  checks: AtsCheck[]
  issues: string[]
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_RE = /(?:\d[\s\-().]*){10,}/
const MONTH_YEAR_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b/i
const YEAR_RANGE_RE = /\b\d{4}\s*[-–—]\s*(?:present|current|now|\d{4})\b/i
const NUMERIC_DATE_RE = /\b\d{1,2}\/\d{4}\b/

function roleHasDate(roleLine: string): boolean {
  return MONTH_YEAR_RE.test(roleLine) || YEAR_RANGE_RE.test(roleLine) || NUMERIC_DATE_RE.test(roleLine)
}

export function atsCheck(text: string, zones: Zones): AtsResult {
  const body = text || ""
  const checks: AtsCheck[] = []

  const hasEmail = EMAIL_RE.test(body)
  const hasPhone = PHONE_RE.test(body)
  checks.push({
    id: "contact",
    passed: hasEmail && hasPhone,
    reason: !hasEmail && !hasPhone
      ? "no email address or phone number parses from the document"
      : !hasEmail
        ? "no email address parses from the document"
        : "no phone number parses from the document",
  })

  const name = (zones.header?.name || "").trim()
  checks.push({
    id: "name",
    passed: name.length > 0,
    reason: "no candidate name parses from the document header",
  })

  const skillLines = (zones.skills || []).filter(s => (s.text || "").trim())
  checks.push({
    id: "skills_section",
    passed: skillLines.length > 0,
    reason: "no skills section parses from the document",
  })

  const roles = zones.roles || []
  checks.push({
    id: "experience_section",
    passed: roles.length > 0,
    reason: "no experience section parses from the document",
  })

  const dateless = roles.filter(r => !roleHasDate(r.role || ""))
  checks.push({
    id: "roles_have_dates",
    passed: dateless.length === 0,
    reason: dateless.length
      ? `${dateless.length} of ${roles.length} role(s) have no parseable date range`
      : "every role header carries a parseable date range",
  })

  const summaryExpected = zones.summaryIdx !== null && zones.summaryIdx !== undefined
  const summaryOk = !summaryExpected || (zones.summaryText || "").trim().length > 0
  checks.push({
    id: "summary_not_empty",
    passed: summaryOk,
    reason: "a summary section heading parses but its body is empty",
  })

  checks.push({
    id: "substantive",
    passed: body.trim().length >= 200,
    reason: "the extracted document text is under 200 characters — the export did not carry the resume",
  })

  const passedCount = checks.filter(c => c.passed).length
  const score = Math.floor((passedCount / checks.length) * 1000) / 10
  return {
    score,
    passed: passedCount === checks.length,
    checks,
    issues: checks.filter(c => !c.passed).map(c => `${c.id}: ${c.reason}`),
  }
}
