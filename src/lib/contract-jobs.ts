export type ContractType = 'W2' | 'C2C' | '1099' | 'C2H' | 'Temporary' | 'Contract'

/**
 * Remove only explicit negative employment statements before classifying evidence.
 * A negated term must not turn into a positive contract/permanent signal.
 */
const NEGATED_EMPLOYMENT_TERM = String.raw`(?:contract[ -]to[ -](?:hire|permanent)|temp[ -]to[ -]hire|direct[ -](?:hire|placement)|right[ -]to[ -]hire|corp[ -]to[ -]corp|c2c|c2h|1099|w[ -]?2(?:\s+contract)?|temporary|contract(?:or|ing)?|permanent|full[ -]?time)`
const NEGATED_PREFIX = new RegExp(String.raw`\b(?:no|not|without)\s+(?:(?:a|an|any)\s+)?${NEGATED_EMPLOYMENT_TERM}(?:\s*(?:,|and|or|\/|&)\s*${NEGATED_EMPLOYMENT_TERM})*`, "gi")
const NEGATED_SUFFIX = new RegExp(String.raw`\b${NEGATED_EMPLOYMENT_TERM}(?:\s+(?:role|position|work|engagement))?\s+(?:(?:is|are|was|were)\s+)?(?:not|never)\s+(?:required|accepted|offered|available|permitted|allowed|provided|considered)\b`, "gi")
const NEGATED_REQUIREMENT = new RegExp(String.raw`\b(?:not|never)\s+(?:required|accepted|offered|available|permitted|allowed|provided|considered)\s+(?:for|as|on)\s+${NEGATED_EMPLOYMENT_TERM}\b`, "gi")

export function positiveEmploymentEvidenceText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(NEGATED_PREFIX, " ")
    .replace(NEGATED_SUFFIX, " ")
    .replace(NEGATED_REQUIREMENT, " ")
}

/** Employment evidence, not guesses from company names or ordinary W2 payroll. */
export function contractTypes(text: string, employmentType = ""): ContractType[] {
  const t = positiveEmploymentEvidenceText(text)
  const employment = positiveEmploymentEvidenceText(employmentType)
  const out: ContractType[] = []

  if (/\b(?:c2c|corp[ -]to[ -]corp)\b/.test(t)) out.push("C2C")
  if (/\b1099\b/.test(t)) out.push("1099")
  // Right To Hire and Contract To Perm/Contract To Permanent are not C2H.
  if (/\bc2h\b|contract[ -]to[ -]hire/.test(t)) out.push("C2H")
  if (/\btemporary\b|\btemp[ -]to[ -]hire\b/.test(t) || /\btemporary\b/.test(employment)) out.push("Temporary")

  const contract = /\bcontract(?:or|ing)?\b/.test(t) || /\bcontract(?:or|ing)?\b/.test(employment) || out.length > 0
  if (contract && /\bw[ -]?2\b/.test(t)) out.unshift("W2")
  if (contract && !out.length) out.push("Contract")
  return out
}
export function applicationUrl(value:string):string|null{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}

/**
 * The owner's standing search preference excludes clearance roles. Match only
 * explicit job requirements, not ordinary prose about secure systems or a
 * candidate saying they have no clearance. “Not required initially” is still
 * a clearance role because the qualification is merely deferred.
 */
export function requiresSecurityClearance(text:string):boolean{
 const t=(text||'').toLowerCase().replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ')
 if(!/clearance|public trust|ts\s*[\/-]\s*sci|top secret|\bsc[- ]cleared\b|\bdv[- ]cleared\b/.test(t))return false

 // Remove only complete, unconditional no-clearance statements. Any separate
 // requirement in the same posting remains available to the checks below.
 const scan=t
  .replace(/\bno (?:active |current )?(?:security )?clearance (?:is )?(?:required|needed)\b/g,' ')
  .replace(/\b(?:security )?clearance (?:is )?not (?:required|needed)(?!\s+(?:initially|at first|at the start))\b/g,' ')
  .replace(/\bdoes not require\b.{0,30}\bclearance\b/g,' ')

 const required=[
  /\b(?:active|current|existing)\b.{0,35}\b(?:security )?clearance\b/,
  /\b(?:must|required|mandatory|need(?:ed)?|preferred|eligible|eligibility|ability|able|willing)\b.{0,70}\b(?:security )?(?:clearance|public trust)\b/,
  /\b(?:clearance|public trust)\b.{0,70}\b(?:required|mandatory|must|needed|preferred|eligible|eligibility|obtain|maintain|sponsor(?:ship)?)\b/,
  /\b(?:obtain|maintain|hold|possess)\b.{0,40}\b(?:security )?(?:clearance|public trust)\b/,
  /\bclearance sponsorship\b|\b(?:secret|top secret|dod|doe) clearance\b|\bts\s*[\/-]\s*sci\b|\btop secret\b|\bsc[- ]cleared\b|\bdv[- ]cleared\b|\bpublic trust\b/,
 ]
 if(required.some(re=>re.test(scan)))return true
 return false
}
