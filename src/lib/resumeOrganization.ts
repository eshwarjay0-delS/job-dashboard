/** Contact-email grouping and deterministic category ranking. Scores are category
 * evidence counts, never an ATS percentage or a job-match claim. */
export const RESUME_CATEGORIES: Record<string, string[]> = {
  "SIEM and Incident Response": ["siem", "splunk", "sentinel", "qradar", "soc", "incident response", "alert triage", "soar"],
  "Threat Hunting and Detection": ["threat hunting", "detection engineering", "sigma", "yara", "threat intelligence", "mitre att&ck"],
  "Digital Forensics": ["digital forensics", "forensic investigations", "autopsy", "encase", "volatility", "chain of custody"],
  "Application and API Security": ["application security", "api security", "owasp", "sast", "dast", "burp", "secure sdlc"],
  "Penetration Testing and Red Team": ["penetration testing", "red team", "adversary", "exploitation", "metasploit", "fuzzers", "oscp"],
  "Vulnerability Management": ["vulnerability management", "tenable", "qualys", "nessus", "findings remediation", "risk record", "cvss"],
  "Security Architecture": ["security architect", "security architecture", "threat modeling", "stride", "c4", "architecture patterns"],
  "AWS Security": ["aws security", "guardduty", "security hub", "cloudtrail", "aws config", "amazon web services"],
  "Azure Security": ["azure security", "defender for cloud", "azure policy", "azure key vault", "azure cloud"],
  "GCP Security": ["gcp", "google cloud", "security command center", "pub/sub", "cloud armor", "multi-project"],
  "Cloud Governance and Infrastructure": ["cspm", "cloud governance", "infrastructure-as-code", "terraform", "cloud networking", "security remediation"],
  "DevSecOps": ["devsecops", "snyk", "checkmarx", "sonarqube", "security gates", "pipeline security"],
  "Kubernetes and Container Security": ["kubernetes", "container security", "workload governance", "vmware", "vcf", "container adoption"],
  "DevOps and Platform Engineering": ["devops", "ci/cd", "jenkins", "argocd", "platform engineer", "site reliability", "helm"],
  "Identity and Access Management": ["identity governance", "identity and access", "sso", "oauth", "openid", "saml", "okta", "sailpoint"],
  "Privileged Access Management": ["privileged access", "cyberark", "epv", "psm", "cpm", "beyondtrust", "password vault"],
  "Network Security": ["network security", "firewall", "palo alto", "fortinet", "cisco", "vpn", "zero trust"],
  "OT and Industrial Security": ["ot security", "industrial", "scada", "ics", "plc", "iec 62443", "operational technology"],
  "Endpoint and Systems Security": ["systems administrator", "sccm", "mecm", "endpoint management", "windows server", "domain consolidation", "active directory"],
  "GRC and IT Risk": ["grc", "risk management", "second-line", "audit", "iso 27001", "soc 2", "risk assessment"],
  "Data Protection and Privacy": ["data protection", "dlp", "privacy", "gdpr", "purview", "encryption", "data classification"],
  "AI Security and Governance": ["ai security", "ai cyber", "ai/ml", "llm", "generative", "prompt injection", "agentic", "nist ai"],
  "Software Validation and Quality": ["validation", "medical device", "fda", "21 cfr", "regulated environments", "software quality", "gamp"],
  "Data and Software Engineering": ["data engineer", "snowflake", "spark", "kafka", "full stack", "spring boot", "react", "software developer"],
  "General Security": ["security engineer", "cybersecurity", "information security"]
}
export const CATEGORY_FOLDERS = Object.keys(RESUME_CATEGORIES)
export const MAX_RESUMES_PER_CATEGORY = 2
export const ORGANIZED_RESUMES_PER_EMAIL = CATEGORY_FOLDERS.length * MAX_RESUMES_PER_CATEGORY

// An address, and only the address. On a resume the contact line often runs straight into the next word with no space
// ("sam@gmail.comLinkedIn: ..."), and the pattern below then takes the word as part of the address. Found on 13 Oct
// 2026: Files held two folders for one person, "x@gmail.com" and "x@gmail.comlinkedin" (the owner: "Both are same!!",
// "Just always only takes the emails"). A well-known mail service ends where its name ends; anywhere else a common
// ending is cut where a word that is plainly not part of an address begins.
const MAIL_SERVICE = /^(gmail\.com|googlemail\.com|yahoo\.com|yahoo\.co\.in|yahoo\.in|ymail\.com|outlook\.com|hotmail\.com|live\.com|msn\.com|icloud\.com|me\.com|aol\.com|protonmail\.com|proton\.me|rediffmail\.com|zoho\.com)(?=[a-z0-9])/i
const RUNS_INTO = /(\.(?:com|net|org|edu|gov|io|co|us|in|ai|dev|info|me|uk|ca))(?:linkedin|github|gitlab|https?|www|phone|mobile|cell|tel|portfolio|website|twitter|location|address|skype|medium|stackoverflow|summary|professional|experience|objective|profile)[a-z0-9.-]*$/i
const NOT_AN_ADDRESS = /^(?:linkedin|github|gitlab|https?|www|phone|mobile|cell|tel|portfolio|website|twitter|location|address|skype|medium|stackoverflow)/i
export function cleanEmail(found: string): string {
  const [local, domain = ""] = String(found || "").trim().toLowerCase().split("@")
  if (!local || !domain) return ""
  const service = MAIL_SERVICE.exec(domain)
  if (service) {
    // What follows a mail service's name is cut when it is a word run on ("linkedin", "linkedin.com/in/x"), and kept
    // when it is more of a real address ("gmail.company.example" is a company's own, not Gmail).
    const rest = domain.slice(service[1].length)
    if (!rest.includes(".") || NOT_AN_ADDRESS.test(rest)) return `${local}@${service[1]}`
  }
  return `${local}@${domain.replace(RUNS_INTO, "$1")}`
}

export function resumeEmails(text: string): string[] {
  // DOCX runs often split the @ sign from either side. Do not remove all spaces:
  // that would combine labels or neighboring words into the contact address.
  const header = text.slice(0, 2500).replace(/\s*@\s*/g, "@")
  return [...new Set((header.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(cleanEmail).filter(Boolean))]
}
export function normalizedResume(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s*@\s*/g, "@").replace(/[^\p{L}\p{N}@+#]+/gu, " ").trim()
}
export function rankResumeCategories(text: string, filename = "") {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ")
  const header = normalized.slice(0, 1800)
  return Object.entries(RESUME_CATEGORIES).map(([category, words]) => {
    const evidence = words.filter(word => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(normalized))
    const score = evidence.reduce((sum, word) => sum + 1 + (header.includes(word) ? 2 : 0), 0)
    const titleHint = filename.toLowerCase().replace(/[_-]/g, " ")
    const explicit = (category === "OT and Industrial Security" && /\bot security\b/.test(titleHint)) ||
      (category === "GRC and IT Risk" && /\bgrc\b/.test(titleHint))
    return { category, score: explicit ? score + 20 : category === "General Security" ? Math.min(score, 1) : score, evidence }
  }).sort((a, b) => b.score - a.score || a.category.localeCompare(b.category))
}
export interface OrganizationInput { id: string; filename: string; text: string }
export function organizeResumes<T extends OrganizationInput>(inputs: T[]) {
  const candidates = inputs.map(input => {
    const emails = resumeEmails(input.text)
    const rank = rankResumeCategories(input.text, input.filename)[0]
    return { ...input, email: emails.length === 1 ? emails[0] : null, category: rank.score ? rank.category : "General Security", score: rank.score, evidence: rank.evidence, normalized: normalizedResume(input.text) }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const kept: typeof candidates = []
  const removed: { id: string; keptId: string; reason: string }[] = []
  const fingerprints = new Map<string, string>()
  for (const item of candidates) {
    // Unassigned records require review; never delete or merge identities by name.
    if (!item.email || !item.normalized) { kept.push(item); continue }
    const key = item.email + "\0" + item.normalized
    const duplicate = fingerprints.get(key)
    if (duplicate) { removed.push({ id: item.id, keptId: duplicate, reason: "Identical normalized resume content within the same email" }); continue }
    const group = kept.filter(k => k.email === item.email && k.category === item.category)
    if (group.length >= MAX_RESUMES_PER_CATEGORY) {
      removed.push({ id: item.id, keptId: group[0].id, reason: `Lower category evidence score (${item.score}); strongest two versions retained` })
      continue
    }
    fingerprints.set(key, item.id)
    kept.push(item)
  }
  return { kept, removed, emails: [...new Set(candidates.flatMap(c => c.email ? [c.email] : []))].sort() }
}
