// Which saved resume is the same KIND OF ROLE as a job, read from titles, and what a person's short instruction about
// the last job means ("make another one with the Cybersecurity Analyst resume"). No storage, no network, no model.
//
// Owner, 20 Oct 2026, on a "Security Analyst" post that started from an AI/AppSec resume and, asked again, from an IAM
// one: "Resume mapping isn't accurate ... it should've selected something categorized more of security Analyst ... I know
// there might be different skillsets with the same titles but there is also some niche with some specific roles. So
// always start by picking that all." So the pick has two steps: first EVERY resume whose own title is the job's role,
// then the niche inside them (keywords, the AI agent). Until then the pick looked only at keywords and at the folder a
// resume had been sorted into, and a resume titled "Cyber Security Analyst" sat in the Identity folder.
import type { Ranked } from "./library-pick"

// ── Titles ───────────────────────────────────────────────────────────────────────────────────────────────────────
type Parsed = { noun: string; domains: string[] }

const NOUNS: Record<string, string> = {
  analyst: "analyst", analysts: "analyst", specialist: "analyst", engineer: "engineer", engineers: "engineer", engineering: "engineer",
  sre: "engineer", developer: "developer", programmer: "developer", architect: "architect", administrator: "admin", admin: "admin",
  sysadmin: "admin", manager: "manager", consultant: "consultant", scientist: "scientist", lead: "lead", director: "director",
  officer: "officer", technician: "technician", tester: "tester",
}
const TITLE_WORDS = "analyst|analysts|engineer|developer|architect|administrator|admin|manager|consultant|specialist|scientist|programmer|lead|director|officer|technician|tester|sre|devops"
const TITLE_WORD_RE = new RegExp(`\\b(?:${TITLE_WORDS})\\b`, "i")
// Neighbouring kinds of role: a Security Engineer resume is closer to a Security Analyst job than an AI one is.
const NEIGHBOURS = new Set(["analyst|engineer", "engineer|developer", "engineer|architect", "analyst|consultant", "consultant|engineer", "consultant|architect", "admin|engineer"])

// The fields of work a title names. Several can hold at once ("Cloud Security Engineer"); a speciality implies security.
const DOMAINS: [string, RegExp][] = [
  ["salesforce", /\b(?:salesforce|sfdc)\b/],
  ["security", /\b(?:cyber\s?security|cybersecurity|cyber|information security|infosec|it security|security|secops)\b/],
  ["soc", /\b(?:soc|security operations|siem|incident response|incident handler|threat (?:hunt\w*|detection|intelligence|analyst)|detection|dfir|forensics?|csirt|blue team|cyber defen[cs]e|splunk|sentinel)\b/],
  ["appsec", /\b(?:appsec|application security|product security|software security|secure (?:code|sdlc)|api security|devsecops)\b/],
  ["iam", /\b(?:iam|identity|access management|privileged access|pam|sso|sailpoint|okta|cyberark)\b/],
  ["grc", /\b(?:grc|compliance|governance|risk|audit|auditor|regulatory|third[- ]party risk|tprm)\b/],
  ["pentest", /\b(?:pen ?test\w*|penetration|red team|offensive|ethical hack\w*|vulnerability|vuln)\b/],
  ["cloud", /\b(?:cloud|aws|azure|gcp)\b/],
  ["devops", /\b(?:devops|devsecops|sre|site reliability|platform|ci\/?cd|release|infrastructure|kubernetes|k8s)\b/],
  ["network", /\b(?:network|firewall|vpn|routing)\b/],
  ["data", /\b(?:data|analytics|etl|business intelligence|bi|database|dba|big data|snowflake)\b/],
  ["software", /\b(?:software|java|\.net|dotnet|python|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile|react|node|golang)\b/],
  ["ai", /\b(?:ai|ml|machine learning|llm|genai|generative|nlp|deep learning)\b/],
  ["ot", /\b(?:ot|ics|scada|industrial|operational technology)\b/],
  ["systems", /\b(?:systems?|windows|linux|endpoint|desktop|server|active directory)\b/],
  ["quality", /\b(?:qa|quality|testing|validation|sdet)\b/],
]
const IMPLIES_SECURITY = new Set(["soc", "appsec", "iam", "grc", "pentest"])

/** A title as kinds: the one noun it ends on and the fields it names. Levels, companies and brackets are not part of it. */
export function parseTitle(raw: string): Parsed {
  let s = String(raw || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
  const inBrackets = [...s.matchAll(/[([]([^)\]]{1,40})[)\]]/g)].map(m => m[1]).join(" ")
  s = s.replace(/[([][^)\]]*[)\]]/g, " ")
  // "Security Analyst - Northpier (tailored)" is a Security Analyst; the company is not part of the role.
  s = s.split(/\s[-–—|@]\s|\sat\s|,|;/)[0]
  s = s.replace(/\b(?:senior|sr|jr|junior|principal|staff|associate|intermediate|expert|experienced|entry[- ]level|mid[- ]level)\b\.?/g, " ")
    .replace(/\b(?:ii|iii|iv)\b|\bi$|\blevel\s*\d\b|\bl[1-5]\b/g, " ")
  const head = s.replace(/[/&+_]/g, " ").replace(/\s+/g, " ").trim()
  const words = head.split(" ")
  let noun = ""
  for (let i = words.length - 1; i >= 0 && !noun; i--) noun = NOUNS[words[i]] || ""
  const all = `${head} ${inBrackets}`.toLowerCase()
  const domains = new Set<string>()
  for (const [key, re] of DOMAINS) if (re.test(all)) domains.add(key)
  for (const d of IMPLIES_SECURITY) if (domains.has(d)) domains.add("security")
  return { noun, domains: [...domains].sort() }
}

/** The part of a role that says which kind of security (or other) work it is: everything but "security" itself. */
const specific = (p: Parsed): string[] => p.domains.filter(d => d !== "security")

/**
 * How alike two titles are as kinds of role, 0 to 5: the kind of person (analyst, engineer ...) up to 2, the field up to 3.
 * 5 is the same role said another way ("Security Analyst", "Cyber Security Analyst"), 4 the same role or field with a
 * speciality ("Security Analyst", "SOC Analyst"), 3 and under not the same role.
 */
export function titleFit(a: string, b: string): number {
  const A = parseTitle(a), B = parseTitle(b)
  if (!A.domains.length || !B.domains.length) return 0
  const noun = !A.noun || !B.noun ? 1 : A.noun === B.noun ? 2 : NEIGHBOURS.has([A.noun, B.noun].sort().join("|")) ? 1 : 0
  const same = A.domains.length === B.domains.length && A.domains.every(d => B.domains.includes(d))
  const sa = specific(A), sb = specific(B)
  const field = same ? 3
    : (sa.length === 0 && B.domains.includes("security")) || (sb.length === 0 && A.domains.includes("security")) ? 2
    : sa.some(d => B.domains.includes(d)) ? 2
    : A.domains.some(d => B.domains.includes(d)) ? 1 : 0
  return noun + field
}

const plain = (s: string): string => String(s || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim()
/**
 * A file name or headline in the ways people write them: "Eshwar Janjirala - Cyber Security Analyst", "Jay_CyberSecurityAnalyst_2024",
 * "AppSec_Engineer_v3.docx". The whole, and each part between dashes, bars and slashes, with the words run together split.
 */
function variants(t: string): string[] {
  const spaced = String(t || "").replace(/\.docx?$/i, "").replace(/_/g, " ").replace(/\b(?:19|20)\d{2}\b|\bv\d+\b/gi, " ").replace(/\s+/g, " ").trim()
  const camel = spaced.replace(/([a-z])([A-Z])/g, "$1 $2")
  const out = new Set<string>()
  for (const s of [spaced, camel]) {
    out.add(s)
    for (const part of s.split(/\s*[-–—|:/]\s*/)) if (part.trim()) out.add(part.trim())
  }
  return [...out].filter(Boolean)
}
const bestFit = (want: string, titles: (string | undefined)[]): number =>
  Math.max(0, ...titles.filter((t): t is string => !!t && !!t.trim()).flatMap(variants).map(v => titleFit(want, v)))

// ── The role a job post asks for ─────────────────────────────────────────────────────────────────────────────────
function cleanRole(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim().replace(/^[*•>\-–\s"“]+|["”.\s]+$/g, "")
  s = s.split(/\s[-–—|@]\s|\s\(|[,;|]|\s+(?:at|for|with|in)\s+|\s*:\s/i)[0].replace(/\s+(?:role|position|opening|opportunity)$/i, "").trim()
  const words = s.split(" ").filter(Boolean)
  return words.length >= 1 && words.length <= 8 && s.length <= 70 && TITLE_WORD_RE.test(s) ? s : ""
}

/** The role a job post asks for, as a person would say it ("Security Analyst"), or "" when the post names none. */
export function roleOfJob(jd: string): string {
  const text = String(jd || "").replace(/\r/g, "")
  const labelled = text.match(/^[ \t>*•\-–]*(?:job\s*title|position(?:\s*title)?|role|title|designation|job\s*role|opening)\s*[:：]\s*(.{3,100})$/im)
  if (labelled) { const t = cleanRole(labelled[1]); if (t) return t }
  const looking = text.match(new RegExp(`\\b(?:looking for|seeking|hiring|searching for|in need of|needs?)\\s+(?:an?|the)?\\s*(?:[a-z-]+\\s+){0,3}?((?:[A-Z][A-Za-z0-9/&+.#-]*\\s+){0,4}(?:Analyst|Engineer|Developer|Architect|Administrator|Admin|Manager|Consultant|Specialist|Scientist|Programmer|Director|Officer|Technician|Tester|Lead))\\b`))
  if (looking) { const t = cleanRole(looking[1]); if (t) return t }
  const first = text.split("\n").map(l => l.trim()).find(Boolean) || ""
  const head = first.split(/\s[-–—|]\s|[.:]\s|\s\(|,\s/)[0]?.trim() || ""
  return head.length >= 4 && head.length <= 70 ? cleanRole(head) : ""
}

/** True for a title with no speciality: "Security Analyst", "Cyber Security Engineer", "Information Security Specialist". */
export function isGenericSecurityRole(role: string): boolean {
  const p = parseTitle(role)
  return !!role && p.domains.length === 1 && p.domains[0] === "security" && !!p.noun
}

// ── Picking inside the person's resumes ──────────────────────────────────────────────────────────────────────────
/**
 * Step one of a pick: the resumes whose own title (the headline written in the file, or the name it is kept under) is
 * the job's role, all of them. When none is, nothing is left out. `fit` is the closeness of those that stay.
 */
export function narrowByRole(ranked: Ranked[], role: string): { pool: Ranked[]; fit: number; narrowed: boolean } {
  if (!role || ranked.length < 2) return { pool: ranked, fit: 0, narrowed: false }
  const fits = ranked.map(r => ({ r, fit: bestFit(role, [r.candidate.title, r.candidate.name]) }))
  const top = Math.max(...fits.map(f => f.fit))
  if (top < 4) return { pool: ranked, fit: top, narrowed: false }
  const pool = fits.filter(f => f.fit === top).map(f => f.r)
  return { pool, fit: top, narrowed: pool.length < ranked.length }
}

/** The resumes a person named ("Cybersecurity Analyst", "the SOC one"): by title, name or folder; empty when none is that. */
export function matchHint(ranked: Ranked[], hint: string): Ranked[] {
  const want = plain(hint)
  if (!want) return []
  const texts = (r: Ranked) => [r.candidate.title, r.candidate.name, r.candidate.folder]
  const named = ranked.filter(r => want.length >= 4 && texts(r).some(t => t && plain(t).includes(want)))
  if (named.length) return named
  const fits = ranked.map(r => ({ r, fit: bestFit(hint, texts(r)) }))
  const top = Math.max(0, ...fits.map(f => f.fit))
  return top >= 4 ? fits.filter(f => f.fit === top).map(f => f.r) : []
}

/** What a person would call each resume: its own title, else its name, else its folder. One of each, at most `most`. */
export function titlesOf(ranked: Ranked[], most = 8): string[] {
  const seen = new Set<string>(), out: string[] = []
  for (const r of ranked) {
    const t = (r.candidate.title || r.candidate.name || r.candidate.folder || "").trim()
    if (t && !seen.has(plain(t))) { seen.add(plain(t)); out.push(t) }
    if (out.length >= most) break
  }
  return out
}

// ── What a short message about the last job asks for ─────────────────────────────────────────────────────────────
export type Instruction = {
  /** The resume named ("Cybersecurity Analyst"), or "" when only another go was asked for. */
  hint: string
  /** Another go at the same job rather than a resume named. */
  again: boolean
}

// An instruction starts with its verb ("Make another one ...", "Please use the SOC resume"), so a job post that merely
// says "we need one more engineer" is not mistaken for one.
const ASK = /^(?:(?:ok(?:ay)?|hey|hi|please|pls|plz|now|can you|could you|will you|would you|just)[,\s]+)*(?:i\s+(?:want|need|would like|d like)\s+(?:you\s+to\s+)?|let'?s\s+)?(?:make|do|create|generate|prepare|build|redo|retry|try|run|use|pick|choose|select|selecting|start|give|send|tailor|write|take|want|need)\b/i
const AGAIN = /\b(?:another|again|redo|retry|different|other|one more|once more|new one|fresh)\b/i
// "one" counts only as "the AppSec one": a job post says "build one data pipeline" all the time.
const THING = /\b(?:resume|cv|version)\b|\bthe\s+(?:[\w/+&.#-]+\s+){1,4}one\b/i
const JD_SIGNS = /\b(?:responsibilit\w+|requirements?|qualifications?|years? of experience|we are looking|you will|must have|nice to have|benefits|salary|per hour|duration|c2c|w2|hybrid|on-?site|job description|about the (?:role|job|team))\b|\/hr\b/gi
const LEAD = /^(?:with|using|from|based on|based off|by|selecting|select|selected|choose|choosing|pick|picking|use|using|on|for|try|take|start with|start from|the|my|a|an|your|that|this)\s+/i
const TRAIL = /\s+(?:resume|cv|one|version|profile|please|pls|plz|thanks|thank you|instead|now)\s*$/i
const GENERIC_HINT = /^(?:it|this|that|one|another|new|different|other|fresh|again|more|same|first|second|last|previous|old|better)$/i

function hintIn(line: string): string {
  let t = line.trim().replace(/[.!?\s]+$/, "")
  const at = t.search(/\b(?:with|using|from|based on|based off|by selecting|selecting|select|choose|choosing|pick|picking|use|try|take|start with|start from)\b\s+\S/i)
  if (at >= 0) t = t.slice(at)
  for (let i = 0; i < 6 && LEAD.test(t); i++) t = t.replace(LEAD, "")
  // The name ends where "resume" begins, or where what is not wanted is said ("... resume instead of the AppSec one").
  t = t.replace(/\s+(?:instead of|rather than|and not|but not|not the)\b.*$/i, "").replace(/\s+(?:resume|cv|version|profile)\b.*$/i, "")
  for (let i = 0; i < 4 && TRAIL.test(t); i++) t = t.replace(TRAIL, "")
  t = t.replace(/[.!?\s]+$/, "").trim()
  return !t || t.length > 60 || GENERIC_HINT.test(t) || /^(?:make|do|create|generate|prepare|build|redo|retry)\b/i.test(t) ? "" : t
}

/**
 * Is this short message an instruction about the job just made ("Make another one with selecting Cybersecurity Analyst
 * resume", "redo with the SOC resume", "use the AppSec one")? Anything that reads like a job post is not. Until
 * 20 Oct 2026 every message of 60 characters or more was taken for a job post: that one is exactly 60, so it replaced
 * the real post and was matched against the person's resumes, which is how "1 of the 1 things this job asks for" came out.
 */
export function parseInstruction(text: string): Instruction | null {
  const t = String(text || "").trim()
  if (!t || t.length > 120 || t.split(/\r?\n/).filter(l => l.trim()).length > 3) return null
  if ((t.match(JD_SIGNS) || []).length >= 2) return null
  const again = AGAIN.test(t)
  const ask = ASK.test(t) && (THING.test(t) || again)
  // "Cybersecurity Analyst resume": a resume named and nothing else.
  const bare = t.match(/^(?:the\s+|my\s+)?([a-z0-9][a-z0-9 /&+.#-]{2,50}?)\s+(?:resume|cv)(?:\s+(?:please|pls|plz))?[.!]?$/i)
  // "Another one", "different resume please": only a few words, so "we need one more engineer ..." is not one.
  const onlyAgain = again && !ask && t.length <= 40 && !/\b(?:engineer|analyst|developer|architect|administrator|manager)\b/i.test(t)
  if (!ask && !onlyAgain && !bare) return null
  const hint = ask || again ? hintIn(t) : hintIn(bare ? bare[1] : "")
  return { hint, again: again && !hint }
}

export type Question = "why" | "list"

/**
 * A short question about the bot's own work: "Why did you pick that resume?" or "What resumes do I have?". Answered from
 * what it did, not by a model, so the answer is the true one. Anything longer than a line or two is not one.
 */
export function parseQuestion(text: string): Question | null {
  const t = String(text || "").trim()
  if (!t || t.length > 120 || t.split(/\r?\n/).filter(l => l.trim()).length > 2) return null
  if (/^(?:why|how come|how did you)\b.{0,50}\b(?:pick|picked|choose|chose|chosen|use|used|start|started|select|selected|go with|went with)\b/i.test(t) ||
      /^(?:which|what) (?:resume|one)\b.{0,25}\b(?:did you|was)\b.{0,25}\b(?:use|pick|choose|start|select)/i.test(t)) return "why"
  if (/^(?:what|which|show|list|see)\b.{0,25}\bresumes?\b/i.test(t) && /\b(?:have|saved|available|got|my|keep|are there)\b/i.test(t)) return "list"
  return null
}

/** A job post that ends with a line naming the resume to start from ("use the SOC resume"): the post, and the name. */
export function splitTailInstruction(text: string): { jd: string; hint: string } {
  const lines = String(text || "").replace(/\r/g, "").split("\n")
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  const last = (lines[lines.length - 1] || "").trim()
  if (lines.length < 3 || last.length > 70) return { jd: String(text || "").trim(), hint: "" }
  const m = last.match(/^(?:please\s+)?(?:use|start (?:with|from)|pick|choose|select|with|based on)\s+(?:the\s+|my\s+)?(.{3,50}?)\s+(?:resume|cv)[.!]?$/i)
  const hint = m ? hintIn(m[1]) : ""
  return hint ? { jd: lines.slice(0, -1).join("\n").trim(), hint } : { jd: String(text || "").trim(), hint: "" }
}
