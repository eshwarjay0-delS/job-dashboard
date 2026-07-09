// v2
import { readFile, writeFile, mkdir, readdir } from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { extractText } from "./docx"

import { RESUMES_LIB as RESUMES_DIR, KEYWORDS_FILE as INDEX_FILE } from "@/lib/paths"

// Curated technical vocabulary (lowercased). Multi-word phrases supported.
export const TECH_TERMS: string[] = [
  // security operations
  "soc", "siem", "soar", "edr", "xdr", "incident response", "threat hunting", "threat detection",
  "threat intelligence", "alert triage", "log analysis", "dfir", "forensics", "digital forensics",
  "malware analysis", "phishing", "mitre att&ck", "detection engineering", "ueba", "continuous monitoring",
  // tools
  "splunk", "sentinel", "microsoft sentinel", "qradar", "crowdstrike", "carbon black", "defender",
  "wireshark", "tcpdump", "nessus", "qualys", "rapid7", "burp suite", "burp", "metasploit", "nmap",
  "kali", "cobalt strike", "snyk", "fortify", "invicti", "sonarqube", "checkmarx", "servicenow", "jira",
  // appsec / offensive
  "application security", "appsec", "owasp", "owasp top 10", "sast", "dast", "sca", "secure code",
  "code review", "secure sdlc", "sdlc", "penetration testing", "pentest", "pen testing", "red team",
  "adversary simulation", "vulnerability assessment", "vulnerability management", "patch management", "exploit",
  // devsecops / devops
  "devsecops", "devops", "ci/cd", "jenkins", "gitlab", "github actions", "pipeline", "docker",
  "kubernetes", "k8s", "terraform", "ansible", "helm", "container security", "shift left",
  "argocd", "helm chart", "prometheus", "grafana", "datadog", "site reliability", "sre",
  // cloud
  "aws", "azure", "gcp", "google cloud", "cloudtrail", "guardduty", "kms", "cloud security", "cspm",
  "cnapp", "cloud native", "ec2", "lambda", "s3", "eks", "aks", "gke", "cloudformation", "cdk",
  "azure devops", "azure kubernetes", "cloud architect", "cloud engineer", "cloud infrastructure",
  // iam / network
  "iam", "active directory", "ldap", "okta", "saml", "oauth", "sso", "pam", "privileged access",
  "zero trust", "mfa", "rbac", "firewall", "vpn", "ids", "ips", "tcp/ip", "dns", "dhcp", "nat", "vlan",
  "routing", "switching", "cisco", "network security",
  // grc / compliance
  "grc", "governance", "risk assessment", "compliance", "nist", "nist 800-53", "nist 800-82",
  "iso 27001", "soc 2", "pci", "hipaa", "gdpr", "nerc cip", "it audit", "security architect", "security architecture",
  // ot / ics
  "ot security", "ics", "scada", "industrial control systems", "dragos", "industrial defender",
  "plc", "critical infrastructure", "iec 62443",
  // software / full-stack / mobile
  "java", "spring", "spring boot", "spring framework", "hibernate", "maven", "gradle",
  "react", "react.js", "reactjs", "next.js", "nextjs", "angular", "vue", "vue.js",
  "node.js", "nodejs", "express", "typescript", "graphql", "rest api", "restful", "microservices",
  "kotlin", "swift", "flutter", "react native", "android", "ios",
  "html", "css", "tailwind", "webpack", "vite",
  // data / ai / ml
  "python", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
  "machine learning", "deep learning", "nlp", "natural language processing", "computer vision",
  "llm", "large language model", "generative ai", "genai", "rag", "retrieval augmented generation",
  "langchain", "openai", "hugging face", "fine-tuning", "prompt engineering", "agentic",
  "data engineer", "data pipeline", "etl", "spark", "apache spark", "kafka", "flink",
  "snowflake", "databricks", "dbt", "airflow", "apache airflow", "data warehouse",
  "tableau", "power bi", "looker", "data analysis", "data science", "data analytics",
  "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "nosql",
  // scripting / infra
  "powershell", "bash", "shell scripting", "linux", "windows", "macos",
  "data loss prevention", "dlp", "endpoint security", "cryptography", "pki", "encryption",
  "javascript",
  // certifications
  "cissp", "oscp", "ceh", "comptia", "security+", "cysa+", "pentest+", "az-500", "ccsp", "gsec", "gcih",
  "aws certified", "azure certified", "gcp certified", "cka", "ckad",
  // business analyst / systems / servicenow
  "business analyst", "system engineer", "requirements", "stakeholder", "process improvement",
  "bpmn", "uml", "agile", "scrum", "jira", "confluence",
  "servicenow developer", "servicenow administrator", "itsm", "itom", "itil",
  "power automate", "power apps", "power platform",
]

function gramSet(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9+#.&/-]+/g) || []
  const grams = new Set<string>(words)
  for (let i = 0; i < words.length - 1; i++) grams.add(words[i] + " " + words[i + 1])
  for (let i = 0; i < words.length - 2; i++) grams.add(words[i] + " " + words[i + 1] + " " + words[i + 2])
  return grams
}

// Technical keywords present in a piece of text.
export function extractKeywords(text: string): string[] {
  const grams = gramSet(text)
  return TECH_TERMS.filter(term => grams.has(term))
}

// The resume's FOLDER name is the strongest signal of what role it targets.
// Map each identity token to the distinctive phrases a matching JD would contain.
// (Distinctive multi-word phrases only — avoid common words like "requirements".)
const IDENTITY_PHRASES: Record<string, string[]> = {
  appsec: ["application security", "appsec", "sast", "dast", "secure code review", "secure sdlc", "owasp"],
  application: ["application security", "appsec"],
  devsecops: ["devsecops", "shift left", "ci/cd security", "pipeline security", "secure pipeline"],
  database: ["database administrator", "dba", "sql server", "oracle database", "database security"],
  iam: ["iam", "identity and access management", "identity access management", "okta", "saml", "single sign-on", "sso"],
  pam: ["privileged access management", "privileged access", "pam"],
  network: ["network security", "firewall", "routing and switching", "cisco", "network engineer"],
  ot: ["ot security", "ics security", "scada", "iec 62443", "industrial control systems"],
  penetration: ["penetration testing", "pentest", "pen testing", "ethical hacking"],
  pentest: ["penetration testing", "pentest"],
  tester: ["penetration testing"],
  red: ["red team", "adversary simulation", "adversary emulation", "offensive security"],
  soc: ["security operations center", "soc analyst", "detection engineering", "threat hunting", "incident response", "siem"],
  detection: ["detection engineering", "threat detection"],
  architect: ["security architect", "security architecture"],
  grc: ["governance risk and compliance", "grc", "risk assessment", "compliance", "nist", "iso 27001", "it audit", "soc 2"],
  business: ["business analyst", "business analysis", "business process", "requirements gathering"],
  system: ["systems engineer"],
  admin: ["system administrator", "system administration", "windows administration", "active directory", "sysadmin"],
  // engineering / data / dev roles (often short folder codes)
  ai: ["ai engineer", "ai developer", "llm developer", "genai developer", "generative ai developer", "machine learning", "ml engineer", "llm", "genai", "generative ai", "rag", "prompt engineering", "agentic", "fine-tuning", "langchain", "large language model", "llm engineer"],
  ml: ["machine learning", "ml engineer", "mlops", "deep learning"],
  genai: ["generative ai", "genai", "llm", "rag", "agentic"],
  data: ["data engineer", "etl", "data pipeline", "spark", "snowflake", "data warehouse", "airflow", "databricks", "dbt"],
  sre: ["site reliability", "sre", "observability", "prometheus", "slo", "reliability engineer"],
  fsd: ["full stack", "full-stack", "frontend", "backend", "react", "node", "typescript", "nextjs",
        "software engineer", "software developer", "java", "spring boot", "microservices", "rest api", "api development"],
  fullstack: ["full stack", "full-stack", "react", "node.js"],
  java: ["java", "spring boot", "spring framework", "microservices", "hibernate", "j2ee", "java developer", "java engineer", "backend developer"],
  software: ["software engineer", "software developer", "backend", "api development", "microservices"],
  "software dev": ["software engineer", "software developer", "graphql", "microservices"],
  graph: ["graphql", "graph database", "neo4j"],
  platform: ["platform engineer", "internal developer platform", "backstage"],
  grafana: ["grafana", "observability", "prometheus"],
  servicenow: ["servicenow", "service now", "itsm", "servicenow developer", "servicenow administrator"],
  "service now": ["servicenow", "itsm", "servicenow developer", "servicenow administrator"],
  service: ["servicenow", "service now", "itsm"],
  m365: ["m365", "microsoft 365", "intune", "entra", "exchange online"],
  sap: ["sap", "sap security"],
  ndr: ["ndr", "network detection"],
  dlp: ["dlp", "data loss prevention"],
  cnapp: ["cnapp", "cloud native application protection"],
  saviynt: ["saviynt", "identity governance"],
  cyberark: ["cyberark", "privileged access"],
  vmware: ["vmware", "virtualization", "esxi", "vsphere"],
  manager: ["security manager", "program manager", "engineering manager"],
  medical: ["medical device", "healthcare security", "fda"],
  siem: ["siem", "splunk", "incident response"],
  power: ["power bi", "power automate", "power apps", "power platform", "microsoft power"],
  cloud: ["cloud security", "cspm", "cnapp", "aws security", "azure security", "cloud native", "cloud engineer", "cloud architect", "aws", "azure", "gcp"],
  "cloud data": ["cloud data", "data engineer", "databricks", "snowflake", "aws", "azure", "data warehouse"],
  "cloud sec": ["cloud security", "cspm", "aws security", "azure security"],
  devops: ["devops", "ci/cd", "kubernetes", "docker", "terraform", "ansible", "argocd", "pipeline"],
}
// Generic role words carry no identity — "Cloud Engineer" and "IAM Engineer" must not
// match each other just because both folders end in "Engineer".
const GENERIC_TOK = new Set([
  "engineer", "engineering", "security", "analyst", "administrator", "architect", "consultant",
  "specialist", "manager", "developer", "admin", "lead", "senior", "junior", "sr", "jr",
  "support", "associate", "cyber", "it", "the", "of", "and", "a",
  // "application" alone is too broad (matches "Application Architect", "Application
  // Support Engineer", etc.) — only the "application security"/"appsec" PHRASES (still
  // injected below via the `known` check) should carry identity, not the bare word.
  "application",
])
function escRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
// Multi-word phrases match as substrings; single words match on word boundaries so
// "ware" (from VM_Ware) never matches inside "soft­ware".
function inText(text: string, p: string): boolean {
  return p.includes(" ") ? text.includes(p) : new RegExp(`\\b${escRe(p)}\\b`).test(text)
}
// The identity of a resume's folder: specific PHRASES (for title/body matching) and the
// distinctive domain TOKENS (matched as whole words in the JD title only).
// Multi-word folder names that map to a known identity key (so e.g. the
// "Full stack developer" folder picks up the software-dev identity — the closest
// home for Java/backend JDs when no dedicated Java resume exists).
const FOLDER_ALIAS: Record<string, string> = {
  "full stack developer": "fsd", "full stack": "fsd", "fullstack": "fsd",
  "data eng": "data", "data engineer": "data", "data genai": "genai",
  "power cloud": "power", "ai marketing": "ai",
  // Python and FSD resumes are the best match for AI/ML/GenAI developer JDs
  // when no dedicated AI resume exists (or the AI folder has a mismatched resume).
  "python": "ai", "python developer": "ai", "python engineer": "ai",
  "ml": "ai", "genai": "ai",
}
export function categoryIdentity(category: string): { phrases: string[]; tokens: string[] } {
  const seg = (category.split("/").pop() || category).toLowerCase().trim()
  const full = seg.replace(/[_\-&/+]+/g, " ").replace(/\s+/g, " ").trim() // "security analyst", "appsec engineer"
  const phrases = new Set<string>()
  const alias = FOLDER_ALIAS[full]
  if (alias && IDENTITY_PHRASES[alias]) IDENTITY_PHRASES[alias].forEach(p => phrases.add(p))
  if (full.includes(" ") && full.length <= 30) phrases.add(full) // the full folder name (2+ words)
  const tokens = new Set<string>()
  for (const tok of seg.split(/[\s_\-&/+]+/).filter(t => t.length > 1)) {
    const known = tok in IDENTITY_PHRASES
    const generic = GENERIC_TOK.has(tok)
    if (generic && !known) continue            // generic word with no mapping → no identity
    if (!generic) tokens.add(tok)              // distinctive whole-word token (for title matching)
    if (known) IDENTITY_PHRASES[tok].forEach(p => phrases.add(p)) // explicit phrases, even for generic words like "admin"
    else if (tok.length > 3) phrases.add(tok)  // distinctive unknown token
  }
  return { phrases: [...phrases], tokens: [...tokens] }
}

// Numeric years-of-experience a piece of resume text represents, computed from its own
// date ranges (e.g. "Jan 2020 - Present", "2018-2021") — merged, not summed naively, so
// overlapping roles don't double-count. Shared by resume indexing (this file) and the
// tailor pipeline's score-breakdown display (src/lib/tailor.ts).
export function estimateYears(text: string): number {
  const re = /((?:[A-Za-z]{3,9}\.?\s+)?\d{4})\s*(?:-|–|—|to)\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|present|current|now)/gi
  let months = 0
  for (const m of text.matchAll(re)) {
    const y1 = parseInt((m[1].match(/\d{4}/) || ["0"])[0], 10)
    const end = m[2].toLowerCase()
    const y2 = /present|current|now/.test(end) ? new Date().getFullYear() : parseInt((end.match(/\d{4}/) || ["0"])[0], 10)
    const diff = (y2 - y1) * 12
    if (diff > 0 && diff <= 600) months += diff
  }
  return Math.round((months / 12) * 10) / 10
}

// Numeric years-of-experience a JD REQUIRES, parsed from its own text (ranges, "X+
// years", "minimum of X years", or explicit seniority words as a fallback estimate).
export function detectJDYears(jd: string): number | null {
  const range = jd.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\+?\s*years?\b/i)
  if (range) return parseInt(range[1], 10)
  const min = jd.match(/minimum\s+(?:of\s+)?(\d{1,2})\+?\s*years?/i)
  if (min) return parseInt(min[1], 10)
  const plus = jd.match(/\b(\d{1,2})\+\s*years?\b/i)
  if (plus) return parseInt(plus[1], 10)
  const plain = jd.match(/\b(\d{1,2})\s*years?\s+(?:of\s+)?experience\b/i)
  if (plain) return parseInt(plain[1], 10)
  if (/\b(entry[\s-]?level|junior|jr\.?|new\s+grad|recent\s+grad|fresher|associate\s+(?:engineer|developer))\b/i.test(jd)) return 1
  if (/\b(senior|sr\.?|lead|principal|staff|director)\b/i.test(jd)) return 6
  return null
}

// Detect required experience level from JD text.
// "entry" = 0-3 yr or explicitly junior/entry. "mid" = 3-5 yr. "senior" = 5+ yr.
export function detectJDLevel(jd: string): "entry" | "mid" | "senior" | "unknown" {
  // Senior: explicit seniority titles or 5+ years (with or without "experience" word)
  if (/(^|\W)(senior|sr\.?|lead|principal|staff|director|vp|head\s+of)(\W|$)/i.test(jd) ||
      /\b(7|8|9|10|11|12|13|14|15|\d{2})\+?\s*years?\b/i.test(jd) ||
      /minimum\s+(of\s+)?(5|6|7|8|9|10)\+?\s*years?/i.test(jd) ||
      /\b(5|6)\+\s*years?\b/i.test(jd) ||
      /\b[56]\s*[-–]\s*\d+\s*years?\b/i.test(jd)) return "senior"
  // Entry: explicitly junior/entry or 0-2 yr patterns
  if (/\b(entry[\s-]?level|junior|jr\.?|associate\s+engineer|associate\s+developer|new\s+grad|recent\s+grad|fresher|0\s*[-–]\s*[123]\s*years?)\b/i.test(jd) ||
      /\b[0-2]\+?\s*years?\b/i.test(jd) ||
      /\bno\s*(prior\s*)?experience\s*required\b/i.test(jd)) return "entry"
  // Mid: 3-4+ years, or explicit mid-level
  if (/\b[34]\+?\s*years?\b/i.test(jd) ||
      /\b[23]\s*[-–]\s*[45]\s*years?\b/i.test(jd) ||
      /\b4\s*[-–]\s*[67]\s*years?\b/i.test(jd) ||
      /\bmid[\s-]?level\b/i.test(jd) || /\bintermediate\b/i.test(jd)) return "mid"
  return "unknown"
}

// Does the JD target GC / remote workers (no sponsorship, remote role)?
export function isGCRemoteJD(jd: string): boolean {
  const noSponsor = /(no\s*h[-\s]?1b|no\s*(visa\s*)?sponsorship|must\s*be\s*(authorized|eligible|legally)|authorized\s*to\s*work\s*in\s*the\s*u\.?s|us\s*citizen\b|permanent\s*resident|green\s*card|\bgc\s+holder|\bead\b|\bc2c\b|\b1099\b)/i.test(jd)
  const isRemote = /\bremote\b/i.test(jd)
  const offersSponsorship = /\b(will\s*sponsor|visa\s*sponsorship\s*(available|provided|offered|is\s+available))/i.test(jd)
  return isRemote && noSponsor && !offersSponsorship
}

// `title` = the resume's OWN headline role title, read from its content at index time
// (the spec's "build the base at parse time" — identity comes from the resume itself,
// not only the folder name). Powers title-first selection for arbitrary uploads.
interface IndexEntry { keywords: string[]; title: string; hash: string; filename: string; category: string; updatedAt: string; yoe: number }
type Index = Record<string, IndexEntry>

const TITLE_ROLE_RE = /\b(engineer|developer|analyst|architect|administrator|manager|consultant|specialist|scientist|designer|programmer|lead|director|devops|sre|administrat\w*)\b/i
function isContactLine(t: string): boolean {
  return /@|linkedin|github\.com|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i.test(t)
}
// The resume's headline role title — e.g. "AI/ML Engineer", "Cloud DevOps Engineer".
// Looks at the top lines: a standalone title line under the name, or the "NAME — Title"
// form. Returns "" when no clear title (then folder identity carries the signal).
export function headlineTitle(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 8)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (isContactLine(l)) {
      // "NAME — Title  (contact…)" all on one line: pull the title between separator and contact.
      const m = l.match(/[—–|]\s*([A-Za-z][A-Za-z0-9/&+. ]{2,48}?)\s*(?:\(|\d{3}[-.\s]|[A-Za-z0-9._%+-]+@|$)/)
      if (m && TITLE_ROLE_RE.test(m[1])) return m[1].trim()
      break
    }
    const m = l.match(/[—–|]\s*([A-Za-z][A-Za-z0-9/&+. ]{2,48})$/) // "NAME — Title"
    if (m && TITLE_ROLE_RE.test(m[1])) return m[1].trim()
    if (i > 0 && l.length <= 55 && TITLE_ROLE_RE.test(l) && !/[•·]/.test(l)) return l // standalone title line
  }
  return ""
}

async function readIndex(indexFile: string): Promise<Index> {
  try { return JSON.parse(await readFile(indexFile, "utf8")) } catch { return {} }
}
async function writeIndex(idx: Index, indexFile: string): Promise<void> {
  await mkdir(path.dirname(indexFile), { recursive: true })
  await writeFile(indexFile, JSON.stringify(idx, null, 2))
}

async function listDocx(dir: string, category = ""): Promise<{ filepath: string; filename: string; category: string }[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out: { filepath: string; filename: string; category: string }[] = []
  for (const e of entries) {
    if (e.name.startsWith("~$") || e.name.startsWith(".")) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await listDocx(full, category ? `${category} / ${e.name}` : e.name))
    else if (e.name.toLowerCase().endsWith(".docx")) out.push({ filepath: full, filename: e.name.replace(/\.docx$/i, ""), category: category || "General" })
  }
  return out
}

// Make sure every current resume has up-to-date keywords saved (re-extracts only
// new/changed files, by content hash). Pass `dir` to scope to a user's personal folder.
export async function ensureIndex(dir?: string): Promise<Index> {
  const resumesDir = dir ?? RESUMES_DIR
  const indexFile  = dir ? path.join(dir, "_keywords.json") : INDEX_FILE
  const files = await listDocx(resumesDir)
  const idx = await readIndex(indexFile)
  const present = new Set(files.map(f => f.filepath))
  let changed = false

  for (const key of Object.keys(idx)) {
    if (!present.has(key)) { delete idx[key]; changed = true }
  }
  for (const f of files) {
    let buf: Buffer
    try { buf = await readFile(f.filepath) } catch { continue }
    const hash = createHash("sha1").update(buf).digest("hex")
    if (idx[f.filepath]?.hash === hash && typeof idx[f.filepath]?.title === "string" && typeof idx[f.filepath]?.yoe === "number") continue
    let text = ""
    try { text = await extractText(buf) } catch { /* keep empty */ }
    idx[f.filepath] = { keywords: extractKeywords(text), title: headlineTitle(text), hash, filename: f.filename, category: f.category, updatedAt: new Date().toISOString(), yoe: estimateYears(text) }
    changed = true
  }
  if (changed) await writeIndex(idx, indexFile)
  return idx
}

export interface KeywordMatch { filepath: string; filename: string; category: string; score: number; matchedOn: string[]; identityHit: boolean; yoe: number }

// Match a JD to the best resume. Scoring combines:
//   • folder IDENTITY match (folder name → JD title/body phrases) — direction signal
//   • resume CONTENT keyword overlap (actual keywords in the resume text vs JD) — content signal
// Both signals matter equally. A folder named "AI" that contains an OT Security resume
// will score high on identity for an AI JD but low on content — so the Python/FSD resume
// with real ML keywords will beat it when the content signal is included.
export async function matchByKeywords(jd: string, gcRemoteOverride?: boolean, dir?: string): Promise<{ best: KeywordMatch; ranked: KeywordMatch[]; jdKeywords: string[] } | null> {
  const idx = await ensureIndex(dir)
  const entries = Object.entries(idx)
  if (!entries.length) return null

  const jdKeywords = extractKeywords(jd)
  const jdSet = new Set(jdKeywords)
  const jdLow = jd.toLowerCase()
  // First non-empty line is usually the job title
  const titleLow = (jd.split("\n").map(l => l.trim()).find(Boolean) || "").toLowerCase().slice(0, 160)

  const jdLevel = detectJDLevel(jd)
  const jdYears = detectJDYears(jd)
  const gcRemote = gcRemoteOverride !== undefined ? gcRemoteOverride : isGCRemoteJD(jd)

  // Total JD keywords for normalizing content overlap percentage
  const jdKwCount = jdKeywords.length || 1

  const ranked: KeywordMatch[] = entries.map(([filepath, e]) => {
    const matchedOn = e.keywords.filter(k => jdSet.has(k))
    const top = e.category.split("/")[0].trim()

    // ── 1) Identity score (folder name AND the resume's own headline title) ───
    // Identity comes from BOTH the folder name and the title written inside the
    // resume itself — so an "AI/ML Engineer" resume matches "AI Developer" JDs even
    // when its folder is generic ("Uploaded"). Phrases/tokens are deduped across the
    // two sources so agreement doesn't inflate the score.
    const folderId = categoryIdentity(e.category)
    const titleId = e.title ? categoryIdentity(e.title) : { phrases: [], tokens: [] }
    const phrases = [...new Set([...folderId.phrases, ...titleId.phrases])]
    const tokens = [...new Set([...folderId.tokens, ...titleId.tokens])]
    const titleHit = phrases.some(p => inText(titleLow, p)) || tokens.some(t => inText(titleLow, t))
    const bodyHits = phrases.filter(p => inText(jdLow, p)).length

    // ── 2) Content score (how much of the JD the resume's actual text covers) ──
    // Use a PERCENTAGE of the JD's own keywords covered, scaled 0–60.
    // This prevents generic-keyword resumes (python, azure in a security resume)
    // from beating domain-specific resumes just because they share common words.
    const contentCoverage = matchedOn.length / jdKwCount   // 0.0–1.0
    const contentScore = Math.round(contentCoverage * 60)  // 0–60 points

    // ── 3) Visa/remote routing bonus (folder-name based — visa category genuinely
    //    IS a folder-level fact, unlike seniority) ───────────────────────────────
    let levelBonus = 0
    if (gcRemote) {
      if (top === "GC Remote") levelBonus = 70
      else if (top === "Thakkuva") levelBonus = -25
      else if (top === "Cyber Marketing") levelBonus = -20
    }

    // ── 4) Seniority fit — computed from each resume's OWN years of experience,
    //    not folder-name guessing. Works for any candidate's folder taxonomy, not
    //    just a hardcoded "Thakkuva" bucket. Heavily penalize an overqualified
    //    resume (a 9-year resume tailored down for a 3-year JD is dishonest — the
    //    employer/date history still reads senior no matter what the summary says);
    //    only lightly penalize a slightly-underqualified one, so ties default to
    //    the LESSER-years resume per product rule ("always prefer fewer years").
    let yoeBonus = 0
    if (jdYears != null && e.yoe > 0) {
      const diff = e.yoe - jdYears
      yoeBonus = diff > 0 ? -Math.min(90, diff * 12) : Math.max(-20, diff * 3)
    } else if (!gcRemote) {
      // Fallback when a resume's own dates couldn't be parsed: the old folder-name
      // heuristic (only fires for the 3 folder names it actually knows about).
      if (jdLevel === "senior") {
        if (top === "Cyber Marketing") yoeBonus = 45
        else if (top === "Thakkuva") yoeBonus = -65
        else if (top === "GC Remote") yoeBonus = -45
      } else if (jdLevel !== "unknown") {
        if (top === "Thakkuva") yoeBonus = jdLevel === "entry" ? 80 : 65
        else if (top === "GC Remote") yoeBonus = -30
        else if (top === "Cyber Marketing") yoeBonus = jdLevel === "entry" ? -40 : -10
      }
    }

    // ── Combined score ─────────────────────────────────────────────────────────
    // Identity: title match (50pt) + each body phrase (10pt), capped at 80
    // Content: percentage of JD keywords covered, 0–60pt
    // Level: visa/remote routing bonus + YOE-fit bonus/penalty
    const identityScore = Math.min(80, (titleHit ? 50 : 0) + bodyHits * 10)
    const score = identityScore + contentScore + levelBonus + yoeBonus
    return { filepath, filename: e.filename, category: e.category, score, matchedOn, identityHit: titleHit || bodyHits > 0, yoe: e.yoe }
  })

  // Sort by score. Tie-breaker: raw matchedOn count.
  ranked.sort((a, b) => (b.score - a.score) || (b.matchedOn.length - a.matchedOn.length))
  return { best: ranked[0], ranked, jdKeywords }
}
