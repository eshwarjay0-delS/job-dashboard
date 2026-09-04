// v2
import path from "path"
import { readPath, readPathText, writePath, listFiles } from "@/lib/storage"
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

// Business-analyst / GRC / project & process vocabulary. TECH_TERMS is security/dev
// only, so for BA/GRC/PM job descriptions the coverage metric was BLIND to the terms
// that actually matter (BRD, RTM, UAT, gap analysis, stakeholder interviews, etc.) —
// it declared "100%" while these were entirely absent. These make those phrases count
// for coverage AND get injected when missing.
export const BUSINESS_TERMS: string[] = [
  // business analysis core
  "business analyst", "business analysis", "business systems analyst", "requirements gathering",
  "requirements elicitation", "requirements management", "business requirements", "functional requirements",
  "non-functional requirements", "business requirements document", "brd", "brds", "functional specification",
  "requirements traceability matrix", "rtm", "requirements traceability", "traceability matrix",
  "use cases", "user stories", "acceptance criteria", "process mapping", "process flows", "workflow analysis",
  "business process analysis", "business process improvement", "process improvement", "as-is", "to-be",
  "current state", "future state", "current and future state", "gap analysis", "impact analysis",
  "root cause analysis", "cost-benefit analysis", "business case", "feasibility analysis", "swot",
  // stakeholder / facilitation
  "stakeholder interviews", "stakeholder management", "stakeholder engagement", "requirements workshops",
  "elicitation sessions", "facilitation", "jad sessions", "workshop facilitation",
  // implementation / config
  "enterprise software implementation", "software implementation", "application configuration",
  "software configuration", "system configuration", "configuration management", "solution design",
  "implementation activities", "implementation support", "review configured functionality", "issue resolution",
  "system integration", "data migration", "data migration validation", "data validation", "data mapping",
  // testing
  "user acceptance testing", "uat", "uat coordination", "test cases", "test scenarios", "test planning",
  "defect tracking", "defect resolution", "defect management", "quality assurance", "regression testing",
  // agile / delivery
  "agile", "scrum", "kanban", "backlog refinement", "product backlog", "sprint planning", "user story mapping",
  "change management", "change request", "release management", "deployment", "go-live", "post-implementation",
  "cutover", "knowledge transfer", "project status report", "weekly project status", "status reports",
  "project coordination", "project management", "raci", "work breakdown structure", "milestones",
  // documentation / training
  "technical documentation", "documentation", "user guides", "standard operating procedures", "sops",
  "training documentation", "training materials", "end-user training", "end-user communications",
  "runbooks", "job aids", "process documentation", "requirements documentation",
  // grc / governance / compliance (BA-flavored)
  "governance risk and compliance", "grc", "governance", "risk management", "risk assessment",
  "regulatory compliance", "compliance", "controls", "control framework", "audit", "audit support",
  "internal controls", "policy", "policies and procedures", "regulated environment", "healthcare",
  "information security", "cybersecurity", "security controls",
  // tools / office
  "microsoft sharepoint", "sharepoint", "microsoft office", "office 365", "excel", "visio", "powerpoint",
  "jira", "confluence", "azure devops", "servicenow",
  // soft skills ATS scans for
  "analytical", "analytical skills", "problem-solving", "problem solving", "written and verbal communication",
  "communication skills", "attention to detail", "collaboration", "self-motivated", "cross-functional",
  // network / firewall / infra-ops (JDs use exact abbreviations ATS keys on)
  "cisco asa", "palo alto", "pan-os", "next-generation firewall", "firepower", "fortigate", "check point",
  "zones", "security policies", "security controls", "threat prevention", "s2s vpn", "site-to-site vpn",
  "ipsec", "nat", "natting", "access control list", "acl", "stateful inspection", "failover", "high availability",
  "subnetting", "osi model", "routing protocols", "control plane", "data plane", "packet analysis",
  "firewall service request", "fsr", "break-fix", "change request", "change management",
  "infrastructure modernization", "decommissioning", "end-of-life", "eol", "hardware refresh", "hardware administration",
  "irs compliance", "fbi compliance", "cji", "cjis", "cji compliance", "compliance standards",
]

// Combined, de-duplicated vocabulary used for keyword coverage.
const VOCAB: string[] = Array.from(new Set([...TECH_TERMS, ...BUSINESS_TERMS]))

function gramSet(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9+#.&/-]+/g) || []
  const grams = new Set<string>(words)
  for (let i = 0; i < words.length - 1; i++) grams.add(words[i] + " " + words[i + 1])
  for (let i = 0; i < words.length - 2; i++) grams.add(words[i] + " " + words[i + 1] + " " + words[i + 2])
  return grams
}

// Keywords present in a piece of text, matched against the combined vocabulary.
// Terms up to 3 words match via the gram set (fast, word-boundary-safe); longer
// phrases (e.g. "current and future state", "written and verbal communication")
// fall back to a normalized substring test since they exceed the 3-gram window.
export function extractKeywords(text: string): string[] {
  const grams = gramSet(text)
  const low = " " + text.toLowerCase().replace(/\s+/g, " ") + " "
  return VOCAB.filter(term =>
    term.split(" ").length <= 3 ? grams.has(term) : low.includes(" " + term + " ") || low.includes(term),
  )
}

// Is `term` literally present in `text`? Word-boundary for single tokens (so "nat"
// doesn't match "coordinate"), normalized substring for multi-word phrases. This is
// the ATS reality: keyword matching is literal, so we measure literal presence.
export function present(text: string, term: string): boolean {
  const t = term.trim().toLowerCase()
  if (!t) return false
  const low = " " + text.toLowerCase().replace(/\s+/g, " ") + " "
  if (t.includes(" ")) return low.includes(" " + t + " ") || low.includes(t)
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp("(^|[^a-z0-9])" + esc + "([^a-z0-9]|$)").test(low)
}

// Common all-caps / short tokens that are NOT meaningful ATS keywords — filtered out
// of the generic extractor so junk never inflates the "missing" set (junk that can
// never be matched would force needless model escalation = wasted tokens).
const CAPS_STOP = new Set([
  "THE","AND","FOR","YOU","ARE","OUR","ETC","INC","LLC","LTD","USA","US","ID","IT","IS","OF","TO","IN","ON","OR","AS","AT","BY","BE","WE","AN","A",
  "II","III","IV","VI","CO","CA","NY","TX","WA","DC","EST","PST","CST","AM","PM","EOD","ASAP","OK","NO","YES","MUST","WILL","SHALL","ALL","ANY","PER","VIA","NEW",
  "JOB","ROLE","TEAM","YEAR","YEARS","PLUS","DAY","DAYS","WEEK","MONTH","MONTHS","FT","PT","W2","C2C","GC","USC","EAD","CFR","N/A","NA","OT",
])
const WORD_STOP = new Set([
  "the","and","for","with","you","are","our","etc","will","must","shall","should","this","that","their","them","from","into","across","various","daily",
  "such","basic","strong","excellent","ability","experience","knowledge","proficiency","responsibilities","qualifications","required","preferred","scope",
  "candidate","contractor","client","services","state","agencies","agency","local","valid","review","execution","ensure","perform","provide","support","maintain",
])
// Gerund/verb words that must NOT start a domain-noun phrase (else "implementing
// security", "performing analysis" leak in as junk that can't match the resume).
const VERB_STOP = new Set([
  "implementing","performing","conducting","managing","providing","ensuring","supporting","maintaining","developing","designing","configuring",
  "troubleshooting","reviewing","executing","facilitating","leading","coordinating","assisting","addressing","resolving","monitoring","building",
  "including","using","regular","ongoing","overall","general","strong","basic","daily","related","other","various","additional","enterprise-wide",
])

// Extract the JD's OWN keywords — DOMAIN-AGNOSTIC, so it works for any job description
// without hand-curated per-domain vocab. Three high-precision signals:
//   1) curated VOCAB hits (known tools/skills, highest precision)
//   2) acronyms & distinctive tech tokens (S2S, FSR, CJI, PAN-OS, IPsec, IOS-XR, AZ-500…)
//   3) parenthetical abbreviations — "(FSRs)", "(RTM)", "(EOL)", "(BRDs)" — near-perfect signal
// Multi-word product/framework names (Palo Alto, Cisco ASA, Microsoft SharePoint) are
// covered by the curated layer, so we deliberately DON'T scrape capitalized bigrams —
// that only produced sentence-fragment junk ("develop business", "general networking")
// that can never match and would waste model escalation. Precision over recall = fewer
// tokens. Everything normalized to lowercase.
export function extractJdKeywords(jd: string): string[] {
  const out = new Set<string>()
  for (const k of extractKeywords(jd)) out.add(k)

  // 2) acronyms / tech tokens: has 2+ caps, OR a digit, OR an internal cap, OR a
  //    hyphen/dot/slash separator (distinctive) — e.g. ASA, VPN, FSR, S2S, PAN-OS,
  //    IPsec, IOS-XR, AZ-500, CI/CD. Skip plain Title-Case words (sentence starts).
  for (const m of jd.matchAll(/\b([A-Za-z][A-Za-z0-9]*(?:[-./][A-Za-z0-9]+)*)\b/g)) {
    const raw = m[1]
    if (raw.length < 2 || raw.length > 24) continue
    if (!(/[A-Z]{2,}/.test(raw) || /[a-z][A-Z]/.test(raw) || /[0-9]/.test(raw) || /[-./]/.test(raw))) continue
    if (CAPS_STOP.has(raw.toUpperCase())) continue
    // Only strip a plural "s" on a PLAIN token. On separator tokens it corrupted the
    // keyword ("EKS/AKS" → "eks/ak", "CI/CDs" → "ci/cd"), so leave those intact — and
    // for slash tokens also emit each side ("EKS/AKS" → eks, aks) since ATS matches both.
    const lowRaw = raw.toLowerCase()
    const hasSep = /[-./]/.test(raw)
    const low = hasSep ? lowRaw : lowRaw.replace(/s$/, m => (raw.length > 3 ? "" : m))
    if (low.length >= 2 && !WORD_STOP.has(low)) out.add(low)
    if (raw.includes("/")) {
      for (const part of lowRaw.split("/")) {
        if (part.length >= 2 && part.length <= 12 && !WORD_STOP.has(part) && !CAPS_STOP.has(part.toUpperCase())) out.add(part)
      }
    }
  }

  // 3) parenthetical abbreviations — the JD author is literally telling us the acronym.
  for (const m of jd.matchAll(/\(([A-Za-z][A-Za-z0-9/&+ -]{1,14})\)/g)) {
    const t = m[1].trim().toLowerCase()
    // Same plural trap as layer 2: "(EKS/AKS)" must not become "eks/ak".
    const low = /[-./]/.test(t) ? t : t.replace(/s$/, "")
    if (low.length >= 2 && !WORD_STOP.has(low)) out.add(low)
  }

  // 4) domain-noun phrases: a noun immediately followed by a domain suffix
  //    (management/security/governance/services/training/response/testing/controls…).
  //    HIGH-precision recall for the phrase keywords the vocab misses — "access
  //    governance", "identity governance", "secrets management", "directory services",
  //    "incident response", "information security", "change management" — for ANY domain.
  //    Two words only, and the preceding word can't be a stopword or a gerund verb
  //    (so "implementing security" / "performing analysis" never leak in).
  const SUFFIX = /^(management|security|governance|testing|controls?|compliance|analysis|response|services|provisioning|deprovisioning|training|protocols?|assessment|monitoring|administration|remediation|authentication|authorization|architecture|mitigation|hardening|onboarding|scanning|reporting|engineering|operations|modeling|modelling|segmentation|privilege|detection|hunting|orchestration|migration|integration|optimization|automation|validation|encryption|recovery|continuity|discovery|enrichment|triage|forensics|resilience|pipelines?|reviews?|policies|policy)$/
  for (const m of jd.matchAll(/\b([a-z][a-z-]{2,})\s+([a-z][a-z-]+)\b/gi)) {
    const a = m[1].toLowerCase(), b = m[2].toLowerCase()
    if (!SUFFIX.test(b)) continue
    if (WORD_STOP.has(a) || VERB_STOP.has(a)) continue
    out.add(a + " " + b)
  }

  // 5) PRODUCT / TOOL proper nouns. Vendor names carry no acronym caps and aren't in the
  //    curated vocab, so tools like Wiz, Trivy, Vault, Snowflake, Datadog were dropped
  //    entirely — exactly the keywords an ATS looks for. High precision comes from taking
  //    Title-Case tokens ONLY mid-sentence: a capitalised word that is NOT the first word
  //    of a sentence/line/bullet is almost always a proper noun, not sentence casing.
  for (const m of jd.matchAll(/(?<=[^\s.!?;:•\-–—\n])[ \t]+([A-Z][a-zA-Z0-9]{2,15})\b/g)) {
    const raw = m[1]
    if (/^[A-Z]+$/.test(raw)) continue              // ALL-CAPS already handled above
    const low = raw.toLowerCase()
    if (WORD_STOP.has(low) || CAPS_STOP.has(raw.toUpperCase()) || TITLE_STOP.has(low)) continue
    out.add(low)
  }

  return [...out]
}

// Capitalised words that are ordinary English (or JD boilerplate) rather than product
// names — these would otherwise slip through the mid-sentence proper-noun layer.
const TITLE_STOP = new Set([
  "we","our","you","your","the","this","that","and","for","with","from","must","will","have","has",
  "responsibilities","requirements","required","preferred","qualifications","experience","years",
  "role","team","teams","company","client","clients","candidate","candidates","position","job",
  "design","designing","implement","implementing","manage","managing","build","building","run",
  "running","operate","operating","enforce","ensure","ensuring","support","supporting","develop",
  "developing","maintain","maintaining","lead","leading","work","working","collaborate","provide",
  "strong","excellent","good","great","plus","bonus","nice","ability","knowledge","skills","skill",
  "understanding","familiarity","proficiency","expertise","background","degree","bachelor","master",
  "senior","junior","lead","principal","staff","engineer","developer","analyst","architect","manager",
  "monday","tuesday","wednesday","thursday","friday","january","february","march","april","june",
  "july","august","september","october","november","december","remote","hybrid","onsite","full",
  "part","time","note","please","apply","join","help","also","other","others","etc","including",
])

// Which of the JD's keywords are literally present in a resume's text.
export function coveredJdKeywords(text: string, jdKeywords: string[]): Set<string> {
  return new Set(jdKeywords.filter(k => present(text, k)))
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
  try { const raw = await readPathText(indexFile); return raw ? JSON.parse(raw) : {} } catch { return {} }
}
async function writeIndex(idx: Index, indexFile: string): Promise<void> {
  await writePath(indexFile, JSON.stringify(idx, null, 2))
}

// List every .docx under a resume dir → filepath + filename + category (from the folder
// chain relative to `root`). Uses the storage layer's recursive listing (R2-safe).
async function listDocx(root: string): Promise<{ filepath: string; filename: string; category: string }[]> {
  const files = await listFiles(root)
  const out: { filepath: string; filename: string; category: string }[] = []
  for (const full of files) {
    if (!full.toLowerCase().endsWith(".docx")) continue
    const rel = path.relative(root, full)
    const parts = rel.split(path.sep)
    const category = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General"
    out.push({ filepath: full, filename: path.basename(full).replace(/\.docx$/i, ""), category })
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
    const buf = await readPath(f.filepath)
    if (!buf) continue
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
