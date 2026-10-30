// What a tailored resume must contain, and how the last missing terms are put in.
//
// Owner, 19 Oct 2026, on a WhatsApp resume that came back at 96% with "missing: micro-segmentation security, technology,
// protocols": "doesn't have the audacity to apply them all in anyway ... always give this to gemini free api for more
// keywords each iteration. Then concatenate both given user input and that results. And resume tailor for best match."
//
// So the target is the job post's own terms PLUS Gemini's, cleaned of what is not a skill (generic words such as
// "technology", fragments such as "palo" beside "palo alto", Gemini's task sentences and years), and every target the
// rewrite still left out is written onto the best-fitting line of the resume's skills section. Certifications are
// ignored altogether (owner, 19 Oct 2026: "Ignore certs always"): never a target, never added, and one the AI writer
// slips into the skills section without the source resume listing it is taken out again.
// No imports: the tests load this file directly.

// Single words that describe a job post rather than a skill an ATS or a recruiter searches for.
const GENERIC = new Set([
  "technology", "technologies", "protocol", "protocols", "system", "systems", "solution", "solutions", "environment",
  "environments", "tool", "tools", "platform", "platforms", "team", "teams", "policy", "policies", "process", "processes",
  "standard", "standards", "service", "services", "application", "applications", "operations", "requirements",
  "experience", "knowledge", "skills", "ability", "issues", "support", "management", "data", "security", "solutioning",
  "projects", "project", "business", "stakeholders", "documentation", "enterprise", "infrastructure", "networks",
  // Seen as targets on 26 Oct 2026 (a PeopleSoft security post and a zero trust network post): words of the post's
  // sentences, not skills a recruiter searches for.
  "page", "pages", "public", "private", "approval", "approvals", "manager", "managers", "level", "user", "users", "report",
  "reports", "request", "requests", "task", "tasks", "quality", "role", "roles", "close-out", "closeout", "access",
  "engineering", "foundation", "employer", "benefits",
  // 26 Oct 2026 (a cloud security post): "long-term" was listed as a missing keyword.
  "long-term", "short-term", "full-time", "part-time", "contract", "duration", "hybrid", "onsite", "on-site", "remote",
])

// The first word of a task sentence, not of a skill ("remove shadowed rules", "deploy and operate").
const TASK_VERBS = new Set([
  "remove", "clean", "deploy", "operate", "map", "troubleshoot", "automate", "optimize", "optimise", "document", "design",
  "implement", "maintain", "build", "review", "work", "collaborate", "improve", "support", "manage", "lead", "drive",
  "ensure", "perform", "develop", "create", "monitor", "configure", "integrate", "analyze", "analyse", "provide",
  "conduct", "plan", "run", "use", "help", "define", "establish", "own", "partner", "coordinate", "deliver", "prepare",
  "track", "respond", "investigate", "assess", "evaluate", "identify", "mentor", "communicate", "participate", "write",
])

/** A soft skill: a strength the summary states, not a tool for a skills line. */
export const SOFT_SKILL = /\b(?:problem[- ]solving|communication|adaptab\w*|teamwork|team player|collaborat\w*|(?<!(?:technical|people|executive|team) )leadership|attention to detail|critical thinking|time management|interpersonal|self[- ]starter|self[- ]motivated|organi[sz]ational|analytical|cross[- ]functional|detail[- ]oriented|customer service)\b/i

// A hyphenated modifier ("row-level", "role-based", "real-time"): a target only when no longer target holds it.
const MODIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*-(?:level|based|time|side|wide|grained|driven|facing|end|out)$/

// Endings that make a phrase about people, places or paperwork rather than a skill.
const NON_SKILL_TAIL = /\b(teams?|environments?|issues|records|groups of people|stakeholders|candidates?|customers?|clients?|years?|yrs|approvals?)$/

// A word boundary after a terminal + does not match end-of-string or punctuation.
// Use a token-end assertion, and recognize Salesforce credential names without a Certified prefix.
const CERT = /\b(certified|certification|certificate|cissp|ccsp|cism|cisa|crisc|cgeit|oscp|osce|oswe|ceh|gsec|gcih|gcia|gcfa|gpen|gwapt|giac|security\+|network\+|a\+|cysa\+|casp\+|pentest\+|comptia|isc2|\(isc\)2|isc\u00b2|ccna|ccnp|ccie|pcnse|pcnsa|pccse|nse ?[1-8]|jncia|jncis|jncip|cka|ckad|cks|pmp|capm|csm|cspo|safe agilist|cipp(?:\/[a-z]+)?|cipm|cdpse|ccsk|az-\d{3}|sc-\d{3}|ai-\d{3}|dp-\d{3}|ms-\d{3}|aws certified|cpa|cfa|frm|salesforce platform developer (?:ii|i)|salesforce cpq specialist)(?![a-z0-9_+])/i

// More credentials, and the pieces the extractor leaves of them ("cysa" from "CySA+", "isc" from "(ISC)2", "azure az"
// from "Azure AZ-500", "solutions architect associate"): found by the 26 Oct 2026 review, which watched the floor write them.
const CERT_MORE = /(?:\b(?:sscp|csslp|cgrc|rhcsa|rhce|mcsa|mcse|itil|prince2|six sigma|(?:green|black|yellow) belt|cysa|casp|scrummaster|scrum master certified|isc)\b|\(isc\)\s*2|\bazure az\b|\b(?:architect|engineer|developer|administrator|practitioner|analyst)\s+(?:associate|professional|specialty|expert)\b|\b(?:aws|azure|google|microsoft|cisco|oracle|salesforce|comptia|red hat)\b.*\b(?:associate|professional|specialty|expert|foundational)\b)/i

export function isCertification(term: string): boolean {
  return CERT.test(term) || CERT_MORE.test(term)
}

// What a job post asks for that is not a skill to write onto a resume: a clearance, citizenship or tax status, a degree, a
// rank or title, a benefit or the employer's own words, a place, a year or a bare number. Owner rules: certifications are
// never added, seniority never changed; the 26 Oct 2026 review watched the floor write "Top Secret", "CISO", "Dental",
// "FY2027" and "Reston" onto a skills line. These are neither written nor counted in the match.
const CLEARANCE_TERM = /^(?:ts|sci|ts\/sci|ts sci|top secret|secret|poly|w-?2|c2c|1099|iat(?: level)?(?: [iv]+| \d)?|iam level(?: [iv]+| \d)?|8570|8140)$/i
const CLEARANCE_WORD = /\b(?:clearance|polygraph|public trust|citizen\w*|green card|visa|sponsorship)\b/i
const DEGREE_TERM = /^(?:bs|ba|bsc|ms|ma|msc|mba|phd|ph\.d|bachelor'?s?(?: degree)?|master'?s?(?: degree)?|degree|diploma|associate'?s degree|ged)$|\bdegree\b/i
const RANK = new Set(["senior", "sr", "junior", "jr", "lead", "principal", "staff", "chief", "head", "vp", "vice", "president", "director", "manager", "officer", "ciso", "cio", "cto", "cso", "coo", "ceo", "supervisor", "intern", "executive"])
const RANK_COMPANY = new Set([...RANK, "security", "information", "engineering", "engineer", "analyst", "architect", "technology", "it", "of", "the", "and", "cyber", "cybersecurity", "level", "i", "ii", "iii", "iv", "global", "technical"])
const BENEFIT_OR_EMPLOYER = /\b(?:medical|dental|vision|401\s*\(?k\)?|pto|paid time off|holidays?|wellness|tuition|equal opportunity|affirmative action|talent acquisition|fortune \d+|inc|llc|ltd|corp|corporation|staffing)\b/i
const US_STATE_WORDS = new Set(["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming", "district of columbia", "united states", "usa", "us", "remote", "hybrid", "onsite", "on-site"])

// Work status, pay, workplace and authorisation lines (gate change, 29 Oct 2026): "H1-B", "W-2", "GC EAD", "$120k",
// "Remote - US", "Hybrid (3 days)", "Work authorization required", "candidates". "Remote Desktop Services" stays a skill.
const WORK_STATUS = new Set(["gc", "ead", "gcead", "h1", "h1b", "h4", "h4ead", "opt", "cpt", "stemopt", "tn", "l1", "l2", "usc", "w2", "c2c", "corptocorp"])
const POST_FILLER = new Set(["candidates", "candidate", "applicants", "applicant"])
const PAY_TERM = /[$\u20ac\u00a3\u20b9]\s?\d|\b\d+\s?k\b|\/\s?(?:hr|hour|yr|year)\b|\bper (?:hour|annum|year)\b|\bsalary\b/i
const WORKPLACE_TERM = /^(?:remote|hybrid|on ?-?site|in office)\b.*\b(?:in|from|at|days?|weeks?|us|usa|office|only|first)\b|^(?:remote|hybrid|on ?-?site)\s*(?:\(?\d|$)/i
const AUTH_TERM = /\bauthori[sz](?:ed|ation) to work\b|\bwork authori[sz]ation\b|\bright to work\b/i

/** A qualification or a word of the post that is not a skill: never written onto a resume, never counted in the match. */
export function isQualificationOrJunk(term: string): boolean {
  const t = String(term || "").toLowerCase().trim()
  if (!t) return true
  if (isCertification(t) || CLEARANCE_TERM.test(t) || CLEARANCE_WORD.test(t) || DEGREE_TERM.test(t) || BENEFIT_OR_EMPLOYER.test(t)) return true
  if (/^(?:fy\s?)?\d/.test(t) || /^v\d+(?:\.\d+)*$/.test(t)) return true
  if (US_STATE_WORDS.has(t)) return true
  if (WORK_STATUS.has(t.replace(/[^a-z0-9]+/g, "")) || POST_FILLER.has(t)) return true
  if (PAY_TERM.test(t) || WORKPLACE_TERM.test(t) || AUTH_TERM.test(t)) return true
  const w = t.split(/[\s/-]+/).filter(Boolean)
  return w.length > 0 && w.every(x => RANK_COMPANY.has(x)) && w.some(x => RANK.has(x))
}

// Lines and sentences of a post that are not about the work: benefits, the equal-opportunity line, the company's story,
// how to apply or whom to call, pay and place. A recruiter's name lives here ("reach out to Jane Smith on our Talent
// Acquisition team", 26 Oct 2026 review).
const NOT_THE_WORK = /\b(?:benefits?|medical|dental|vision|401\s*\(?k|pto|paid time|equal opportunity|eeo|affirmative action|about (?:us|the company|our)|who we are|our client is|we are an? |to apply|apply (?:now|via|at|online|today)|contact|reach out|recruiter|talent acquisition|regards|thank you|salary|compensation|pay rate|pay range|hourly rate|location\s*:|address|reasonable accommodation|e-?verify|background check|drug (?:test|screen))\b/i
const CREDENTIAL_CLAUSE = /\b(?:certif\w*|credential\w*|licen[cs]\w*|designation)\b/i

/**
 * Of `terms`, the ones the floor may write onto a resume: skills the post itself names in a sentence about the work, not
 * only in a credential clause ("SAFe Agilist certification preferred"), and not a place ("Reston, VA").
 */
export function floorTerms(jd: string, terms: string[]): string[] {
  const clauses = String(jd || "").split(/\r?\n|(?<=[.;!?])\s+/).map(c => c.trim()).filter(Boolean)
  const work = clauses.filter(c => !NOT_THE_WORK.test(c))
  // The term in any letter case, followed by a state written as two capitals: "Reston, VA" is a place.
  const anyCase = (s: string) => escapeRe(s).replace(/[a-z]/gi, ch => `[${ch.toLowerCase()}${ch.toUpperCase()}]`)
  return terms.filter(t => {
    if (isQualificationOrJunk(t)) return false
    if (new RegExp(`(?<![A-Za-z0-9])${anyCase(t)},\\s*[A-Z]{2}\\b`).test(jd)) return false
    return work.some(c => contains(c, t) && !CREDENTIAL_CLAUSE.test(c))
  })
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)

/** A term Gemini suggested that reads as a skill: short, a noun phrase, not a task, a length of time or a list. */
export function skillLike(term: string): boolean {
  const t = term.toLowerCase().trim()
  if (t.length < 2 || t.length > 48) return false
  const w = t.split(/\s+/)
  if (w.length > 4) return false
  if (/\b(and|or|with|across|for|to|of the)\b/.test(t) && w.length > 2) return false
  if (TASK_VERBS.has(w[0])) return false
  if (/\d+\s*\+|\b\d+\s*(?:years?|yrs)\b/.test(t)) return false
  if (NON_SKILL_TAIL.test(t)) return false
  if (w.length === 1 && GENERIC.has(t)) return false
  return true
}

/**
 * The terms the resume is measured against and must end up containing: the job post's own extracted terms and Gemini's
 * skill-like suggestions, together. Generic single words go, and so does a single word that only appears inside a
 * longer target ("palo" beside "palo alto", "micro" beside "micro-segmentation"): the longer term is what is checked.
 */
export function targetKeywords(extracted: string[], generated: string[], jd?: string): string[] {
  const all = [...new Set([
    ...extracted.map(k => k.toLowerCase().trim()),
    ...generated.map(k => k.toLowerCase().trim()).filter(skillLike),
  ])].filter(k => k && !(k.split(/\s+/).length === 1 && GENERIC.has(k)) && !isCertification(k))
  const multi = all.filter(k => /[\s\-/]/.test(k))
  // With the post at hand, a word it also uses on its own stays a target ("Splunk" beside "Splunk Enterprise Security":
  // a resume that shows Splunk shows what the post asked; 26 Oct 2026 review).
  const alone = (k: string) => {
    if (!jd) return false
    let rest = jd
    for (const m of multi) if (m !== k && words(m).includes(k)) rest = rest.replace(new RegExp(`(?<![A-Za-z0-9])${escapeRe(m)}(?![A-Za-z0-9])`, "gi"), " ")
    return contains(rest, k)
  }
  return all.filter(k => {
    // A hyphenated modifier that is only a piece of a longer target ("row-level" beside "row-level security", 26 Oct
    // 2026) is not a target of its own. A product name inside a longer phrase ("palo alto" in "palo alto firewalls") is.
    if (MODIFIER.test(k)) return !multi.some(m => m !== k && m.length > k.length && contains(m, k))
    if (/[\s\-/]/.test(k)) return true
    return !multi.some(m => m !== k && words(m).includes(k)) || alone(k)
  })
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** The term as the job post writes it ("Palo Alto", "micro-segmentation"), else as given. */
export function jdSpelling(term: string, jd: string): string {
  const m = jd.match(new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, "i"))
  return m ? m[0] : term
}

const contains = (text: string, term: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, "i").test(text)

/**
 * Skills-list items that name a job-post tool the source resume does not contain.
 * A bullet is left alone: this only splits a skills line and drops the unconfirmed item.
 * A term the source already shows stays, even if it was also passed in as banned.
 * A heading that is itself that tool ("PW-6000: Sentinel") is not kept as a category name.
 */
export function withoutUnsupportedSkills(lines: { idx: number; text: string }[], sourceText: string, banned: string[]): { idx: number; text: string }[] {
  const terms = [...new Set(banned.map(t => String(t || "").trim()).filter(t => t && !contains(sourceText, t)))]
  if (!terms.length) return []
  const out: { idx: number; text: string }[] = []
  for (const l of lines) {
    const originalHeading = l.text.match(/^([^:\n]{2,70}:)\s*/)?.[0] || ""
    let heading = originalHeading
    const body = l.text.slice(originalHeading.length)
    if (heading) {
      const label = heading.replace(/:\s*$/, "").trim()
      if (terms.some(term => contains(label, term))) {
        const pieces = label.split(/\s*,\s*|\s+and\s+|\s*\/\s*/i).map(s => s.trim()).filter(Boolean)
        const safe = pieces.filter(p => !terms.some(term => contains(p, term)))
        heading = safe.length ? `${safe.join(", ")}: ` : ""
      }
    }
    const sep = separatorOf(body)
    const end = /[.;]\s*$/.test(body) ? body.trim().slice(-1) : ""
    const items = (end ? body.trim().slice(0, -1) : body).split(sep.trim() === "," ? /\s*,\s*/ : new RegExp(`\\s*${escapeRe(sep.trim())}\\s*`))
    const kept = items.filter(item => item.trim() && !terms.some(term => contains(item, term)))
    if (heading === originalHeading && kept.length === items.length) continue
    out.push({ idx: l.idx, text: `${heading}${kept.join(sep)}${end}` })
  }
  return out
}

/**
 * Skills lines with every certification the source resume does not list taken out (the AI writer adds them now and
 * then: PCNSE appeared in a test on 19 Oct 2026). Returns only the lines that changed. A heading ("Governance,
 * Compliance: ") is kept as it is; only the listed items are looked at.
 */
export function withoutAddedCerts(lines: { idx: number; text: string }[], sourceText: string): { idx: number; text: string }[] {
  const out: { idx: number; text: string }[] = []
  for (const l of lines) {
    const heading = l.text.match(/^([^:\n]{2,70}:)\s*/)?.[0] || ""
    const body = l.text.slice(heading.length)
    const sep = separatorOf(body)
    const end = /[.;]\s*$/.test(body) ? body.trim().slice(-1) : ""
    const items = (end ? body.trim().slice(0, -1) : body).split(sep.trim() === "," ? /\s*,\s*/ : new RegExp(`\\s*${escapeRe(sep.trim())}\\s*`))
    const kept = items.filter(item => !(isCertification(item) && !contains(sourceText, item.trim())))
    if (kept.length === items.length) continue
    out.push({ idx: l.idx, text: `${heading}${kept.join(sep)}${end}` })
  }
  return out
}

function separatorOf(line: string): string {
  if (line.includes(" | ")) return " | "
  if (line.includes("•")) return " • "
  if (!line.includes(",") && line.includes(";")) return "; "
  return ", "
}

// The kinds of skill a resume's skills lines are usually grouped by: what such a line's heading says, and the terms that
// belong under it. Only used to choose between lines; a term that fits none goes to the line given least so far.
const FAMILIES: { line: RegExp; term: RegExp }[] = [
  { line: /network|firewall|infrastructure|perimeter|routing|operations/, term: /\b(?:cisco|juniper|arista|palo alto|panorama|fortinet|fortigate|checkpoint|check point|f5|bgp|ospf|eigrp|sd-wan|routing|switching|firewalls?|vpn|ipsec|zscaler|ztna|sase|ise|illumio|guardicore|segmentation|zero trust|load balanc\w*|dns|dhcp|tcp\/ip|wan|lan|wi-?fi|nac|802\.1x|network\w*)\b/i },
  { line: /identity|access|iam|pam|directory/, term: /\b(?:active directory|azure ad|entra|ldap|sso|single sign-on|saml|oauth|oidc|okta|ping|sailpoint|saviynt|cyberark|beyondtrust|provisioning|deprovisioning|rbac|role-based|row-level|permission lists?|user profiles?|access\w*|identity|privileged|mfa|kerberos|peoplesoft security)\b/i },
  { line: /cloud|aws|azure|gcp|container/, term: /\b(?:aws|azure|gcp|google cloud|cloud\w*|kubernetes|docker|terraform|ansible|eks|aks|gke|lambda|iam roles|cspm|cnapp|ec2|s3|vpc|privatelink|transit gateway|macie|guardduty|cloudtrail|security hub|inspector|glue|emr|cloudformation|cloudwatch|route 53|terragrunt)\b/i },
  { line: /devops|ci\/cd|automation|pipeline|sre|tooling/, term: /\b(?:jenkins|gitlab|github actions|helm|prometheus|grafana|openshift|argo\w*|ci\/cd|terraform|ansible|docker|kubernetes)\b/i },
  { line: /governance|compliance|risk|audit|grc|framework|regulat/, term: /\b(?:sox|nist|iso 27001|iso|audit\w*|compliance|risk|change management|policy|policies|hipaa|pci|gdpr|fedramp|cmmc|controls?|soc 2|itgc|segregation of duties|sod)\b/i },
  { line: /operations|siem|soc|monitoring|detection|incident|threat|endpoint/, term: /\b(?:splunk|sentinel|qradar|siem|soar|soc|incident\w*|threat\w*|edr|xdr|crowdstrike|defender|vulnerab\w*|forensics|malware|detection|kql|spl|wiz)\b/i },
  { line: /database|\bdbs?\b|sql|data store|data\b|query/, term: /\b(?:sql|oracle|database|db2|postgres\w*|mysql|redis|mongodb|couchbase|snowflake|dynamodb|sql server|query\w*|data mover|etl)\b/i },
  { line: /language|programming|scripting|development|coding/, term: /\b(?:python|powershell|bash|java|javascript|typescript|go|golang|c#|ruby|scala|kotlin|scripting|peopletools|application designer)\b/i },
  { line: /application|erp|enterprise|platform|software|tools|technolog/, term: /\b(?:peoplesoft|hcm|financials|sap|workday|servicenow|salesforce|oracle ebs|ebs|process scheduler|scheduler|component interfaces?|jira|confluence)\b/i },
]

/**
 * Put each term on the skills line it fits best (the line sharing the most words with it, else the line of its kind,
 * else the line given least so far),
 * keeping the line's own separator and any "Heading:" in front. Returns only the lines that changed. A term already
 * on some line is left alone.
 */
export function placeInSkills(lines: { idx: number; text: string }[], terms: string[], jd: string): { idx: number; text: string }[] {
  if (!lines.length || !terms.length) return []
  const cur = lines.map(l => ({ idx: l.idx, text: l.text }))
  // Never an achievement written as a bullet or a sentence: a resume whose summary has no heading hands its highlight
  // bullets over as "skills" lines (docx.ts), and a term appended to one reads as part of the record (26 Oct 2026 review).
  const prose = (t: string) => /^\s*[•\-–‣▪*·◦●○■]/.test(t) || (t.split(/\s+/).length > 14 && (t.match(/,/g) || []).length < 2)
  const listy = cur.filter(l => !prose(l.text) && (/[,|•;]/.test(l.text) || /^[^:\n]{2,70}:/.test(l.text)))
  const pool = listy.length ? listy : cur.filter(l => !prose(l.text))
  if (!pool.length) return []
  const items = (t: string) => (t.match(/[,|•;]/g) || []).length
  const changed = new Set<number>()
  const given = new Map<number, number>(), home = new Map<number, number>()
  // Lines are judged by what they said before this placement: a term placed a moment ago ("PeopleSoft" on the Languages
  // line) must not pull the next one ("PeopleSoft Security") after it.
  const original = new Map(cur.map(l => [l.idx, l.text]))
  const headOf = (t: string) => (t.match(/^([^:\n]{2,70}):/)?.[1] || t).toLowerCase()
  // A kind of skill no line is about goes, all together, to a line for tools or technologies when there is one, else to
  // the longest list.
  const catchAll = pool.find(l => /tools|technolog|platform|software|other|additional|misc/.test(headOf(original.get(l.idx) || ""))) ||
    [...pool].sort((a, b) => items(original.get(b.idx) || "") - items(original.get(a.idx) || ""))[0]
  for (const term of terms) {
    if (cur.some(l => contains(l.text, term))) continue
    const shown = jdSpelling(term, jd)
    // Words shared with a line count, but not generic ones: "row-level security" is not a security-operations skill
    // because that line's heading says "Security".
    const tw = words(term).filter(w => w.length >= 3 && !GENERIC.has(w))
    const fam = FAMILIES.findIndex(f => f.term.test(term))
    if (fam >= 0 && !home.has(fam) && !pool.some(l => FAMILIES[fam].line.test(headOf(original.get(l.idx) || "")))) home.set(fam, catchAll.idx)
    let best = pool[0], bestScore = -Infinity
    for (const l of pool) {
      const lw = new Set(words(original.get(l.idx) || l.text))
      const head = headOf(original.get(l.idx) || l.text)
      const kin = FAMILIES.some(f => f.line.test(head) && f.term.test(term)) ? 1 : 0
      // Shared words first, then the kind of skill the line is about, then the line its kind already went to (so a
      // resume with no network line still keeps Cisco, F5 and BGP together), then the line given least so far: a term
      // with no home spreads out instead of piling onto one line (26 Oct 2026: they all landed under "Identity & Access
      // Management", the longest line).
      const together = fam >= 0 && home.get(fam) === l.idx ? 3 : 0
      const score = tw.filter(w => lw.has(w)).length * 10 + kin * 6 + together - (given.get(l.idx) || 0) * 0.5 + Math.min(items(l.text), 9) * 0.05
      if (score > bestScore) { best = l; bestScore = score }
    }
    given.set(best.idx, (given.get(best.idx) || 0) + 1)
    if (fam >= 0 && !home.has(fam)) home.set(fam, best.idx)
    const text = best.text.replace(/\s+$/, "")
    const heading = text.match(/^([^:\n]{2,70}:)\s*$/)
    if (heading) best.text = `${heading[1]} ${shown}`
    else {
      const end = text.match(/[.;]$/) ? text.slice(-1) : ""
      const body = end ? text.slice(0, -1) : text
      best.text = `${body}${separatorOf(body)}${shown}${end}`
    }
    changed.add(best.idx)
  }
  return cur.filter(l => changed.has(l.idx))
}

export type RelationalPair = { parent: string; terms: string[] }

/** Keep Gemini's related terms only when the parent skill is in what the candidate confirmed. */
export function parseConfirmedVocabulary(text: string, evidence: string): RelationalPair[] {
  let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
  const a = t.indexOf("["), b = t.lastIndexOf("]")
  if (a >= 0 && b > a) t = t.slice(a, b + 1)
  let arr: unknown
  try { arr = JSON.parse(t) } catch { return [] }
  if (!Array.isArray(arr)) return []
  const out: RelationalPair[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const rec = item as { parent?: unknown; terms?: unknown }
    const parent = typeof rec.parent === "string" ? rec.parent.toLowerCase().trim() : ""
    if (parent.length < 2 || !contains(evidence, parent)) continue
    const terms = Array.isArray(rec.terms) ? rec.terms.flatMap(v => typeof v === "string" ? [v.toLowerCase().trim()] : []) : []
    if (terms.length) out.push({ parent, terms: [...new Set(terms)].slice(0, 6) })
  }
  return out
}
export type ResumeBullet = { idx: number; role: string; text: string }

/** A related term is allowed only when the candidate already stated the parent skill, or the baseline already shows it. */
export function groundedPairs(pairs: RelationalPair[], evidence: string): RelationalPair[] {
  const out: RelationalPair[] = []
  for (const pair of pairs) {
    const parent = pair.parent.toLowerCase().trim()
    if (parent.length < 2 || !contains(evidence, parent)) continue
    const terms = [...new Set(pair.terms.map(t => t.toLowerCase().trim()).filter(t => t !== parent && skillLike(t) && !isCertification(t)))]
    out.push({ parent, terms })
  }
  return out
}

function clause(terms: string[]): string {
  return terms.length === 1 ? terms[0] : `${terms.slice(0, -1).join(", ")} and ${terms[terms.length - 1]}`
}

/**
 * Write confirmed skills and their related vocabulary into the skills list and into a bullet for the role the
 * candidate named. A parent the evidence does not contain is dropped, so a job-post tool they never confirmed stays out.
 */
export function weaveConfirmedVocabulary(input: {
  skills: { idx: number; text: string }[]
  bullets: ResumeBullet[]
  pairs: RelationalPair[]
  evidence: string
  jd: string
}): { skills: { idx: number; text: string }[]; bullets: { idx: number; text: string }[]; text: string } {
  const pairs = groundedPairs(input.pairs, input.evidence)
  const wanted = pairs.flatMap(p => [p.parent, ...p.terms])
  const skillEdits = placeInSkills(input.skills, wanted, input.jd)
  const skillText = new Map(input.skills.map(s => [s.idx, s.text]))
  for (const edit of skillEdits) skillText.set(edit.idx, edit.text)
  const bulletText = input.bullets.map(b => ({ ...b }))
  const evidence = input.evidence.toLowerCase()
  for (const pair of pairs) {
    const shown = pair.terms.map(t => jdSpelling(t, input.jd))
    const named = bulletText.filter(b => {
      const roleWord = b.role.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4)
      return contains(b.text, pair.parent) || roleWord.some(w => evidence.includes(w) && evidence.includes(pair.parent))
    })
    const home = named[0]
    if (!home) continue
    const missing = shown.filter(t => !contains(home.text, t))
    if (!missing.length) continue
    const text = home.text.replace(/\s+$/, "")
    const end = /[.]$/.test(text) ? "." : ""
    const body = end ? text.slice(0, -1) : text
    home.text = `${body}, including ${clause(missing)}${end}`
  }
  const skills = [...skillText.entries()].map(([idx, text]) => ({ idx, text }))
  const text = [...skills.map(s => s.text), ...bulletText.map(b => b.text)].join("\n")
  return { skills: skillEdits, bullets: bulletText.filter(b => !input.bullets.some(o => o.idx === b.idx && o.text === b.text)).map(b => ({ idx: b.idx, text: b.text })), text }
}
