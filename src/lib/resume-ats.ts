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
// Dots and unicode dashes are normal in a phone ("314.255.9156", "314–255–9156").
const PHONE_RE = /(?:\d[\s.\u2010\u2011\u2012\u2013\u2014\u2015\-().]*){10,}/
const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
// No leading word boundary: "MAFeb 2021" and "RemoteNov 2022" are dates, not missing dates.
const MONTH_YEAR_RE = new RegExp(`(?:${MONTH})\\.?\\s+\\d{4}\\b`, "i")
// "Till date" and "to Present" are current-role endings. A month word may sit between the dash and the end year.
const YEAR_RANGE_RE = new RegExp(
  `\\b\\d{4}\\s*(?:[-–—]|to)\\s*(?:(?:${MONTH})\\.?\\s+)?(?:present|current|now|till(?:\\s+date)?|ongoing|\\d{4})\\b`,
  "i",
)
const NUMERIC_DATE_RE = /\b\d{1,2}\/\d{4}\b/
// extractZones opens a bucket named "Projects" or "Experience" when that section has
// lines and no dated employer header. That label is not an employment row.
const SECTION_BUCKET = /^(?:projects?|experience|professional experience|work experience|employment|work history|career history|selected projects|key projects)$/i
const SECTION_LINE = /^(?:(?:professional|technical|core)\s+)?(?:summary|skills|experience|education|objective|profile|projects|certifications?|competencies)\b/i

function roleHasDate(roleLine: string): boolean {
  return MONTH_YEAR_RE.test(roleLine) || YEAR_RANGE_RE.test(roleLine) || NUMERIC_DATE_RE.test(roleLine)
}

function employmentRole(roleLine: string): boolean {
  const title = roleLine.replace(/\s+/g, " ").trim()
  return !!title && !SECTION_BUCKET.test(title)
}

function lineLooksLikeName(line: string): boolean {
  // Word drawing ids are stored as text and docxText glues them to the name ("438150356870JAY ESHWAR").
  let head = line.replace(/\s+/g, " ").trim().replace(/^\d+(?=[A-Za-z])/, "").replace(/^name\s*:\s*/i, "")
  head = head.split(/\s+(?:e-?mail\s*:|ph(?:one)?\s*:|https?:|www\.|linkedin\b)/i)[0] || ""
  head = head.split(/\s*[|]\s*/)[0] || ""
  head = head.split(/\s+[—–-]\s+/)[0] || ""
  head = head.trim()
  if (!head || head.length > 60 || SECTION_LINE.test(head) || /@|\d/.test(head)) return false
  if (!/^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,4}$/.test(head)) return false
  const tokens = head.split(/\s+/)
  if (tokens.length === 1 && (tokens[0].length < 4 || /engineer|analyst|security|developer|manager|summary|skills/i.test(tokens[0]))) return false
  return true
}

/** Header-zone misses are common when the name shares a run with the email.
 * The exported text still has the name. A document with neither is a real miss. */
function documentHasCandidateName(text: string, headerName: string): boolean {
  if (headerName.trim()) return true
  return text.split(/\n/).map(line => line.trim()).filter(Boolean).slice(0, 8).some(lineLooksLikeName)
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
    passed: documentHasCandidateName(body, name),
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

  const datedRoles = roles.filter(r => employmentRole(r.role || ""))
  const dateless = datedRoles.filter(r => !roleHasDate(r.role || ""))
  checks.push({
    id: "roles_have_dates",
    passed: dateless.length === 0,
    reason: dateless.length
      ? `${dateless.length} of ${datedRoles.length} role(s) have no parseable date range`
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
