import JSZip from "jszip"
import mammoth from "mammoth"

// The name/title/contact header is one paragraph of separate runs. We edit ONLY the
// title run and the identity-tagline run; the name and contact runs are never touched.
// idx = the paragraph carrying the name (and, for single-line headers, the title/tagline runs).
// titleIdx / taglineIdx point at SEPARATE paragraphs when the resume puts the title or the
// identity strip on its own line (the common "name / title / contact" stacked layout).
export interface Header { idx: number; name: string; title: string; tagline: string; titleIdx?: number; taglineIdx?: number }

// The resume's editable zones, each line tagged with a STABLE paragraph index.
export interface Zones {
  header: Header | null
  summaryIdx: number | null
  summaryText: string
  // Paragraph indices of any ADDITIONAL prose paragraphs found in the summary section
  // after the first one (a source resume with a concatenated multi-paragraph "summary" —
  // several AI runs pasted together — has real content sitting here that extractZones
  // used to silently ignore). Their text is folded into summaryText for context; when the
  // summary is actually rewritten, applyRewrites blanks these so the consolidated single
  // paragraph doesn't sit next to 2-3 stale leftover paragraphs.
  summaryOverflowIdx: number[]
  skills: { idx: number; text: string }[]
  // roles in document order — roles[0]'s job is the most recent; `current` marks it.
  roles: { role: string; bullets: { idx: number; text: string }[]; current?: boolean }[]
  // certifications / education / awards lines, grouped by their section heading.
  extras: { idx: number; text: string; section: string }[]
}

// What the model returns / the builder saves: rewrites keyed by the same stable indices.
export interface Edits {
  headline?: { title?: string; tagline?: string }
  summary?: string
  skills?: { idx: number; text: string }[]
  bullets?: { idx: number; text: string }[]
  extras?: { idx: number; text: string }[]
}

const SUMMARY_HEADS = ["summary", "profile", "objective", "about me", "professional summary", "career summary", "overview"]
const SKILLS_HEADS = ["skills", "skill set", "skillset", "technical skills", "core competencies", "competencies", "technologies", "technical proficiencies", "proficiencies", "areas of expertise", "tools", "key skills", "expertise"]
const EXPERIENCE_HEADS = ["experience", "work history", "employment", "professional experience", "work experience", "career history"]
const PROJECT_HEADS = ["projects", "project experience", "selected projects", "key projects", "notable projects"]
const OTHER_HEADS = ["education", "certification", "certifications", "awards", "interests", "references", "contact", "achievements", "publications", "volunteer", "languages", "hobbies", "personal", "declaration"]
const HAS_DATE = /\b(19|20)\d{2}\b/
// A company/title line carries a date RANGE (e.g. "July 2023 – Present", "Jan 2019 – June 2022").
const DATE_RANGE = /\b(?:19|20)\d{2}\b\s*[–—-]\s*(?:[A-Za-z]{3,9}\.?\s+)?(?:(?:19|20)\d{2}|present|current|now)/i
const BULLET_RE = /^\s*[•\-–‣▪*·◦●○■]\s*/

// ── helpers ───────────────────────────────────────────────────────────────────
async function loadXml(buffer: Buffer): Promise<{ zip: JSZip; xml: string }> {
  const zip = await JSZip.loadAsync(buffer)
  const f = zip.file("word/document.xml")
  if (!f) throw new Error("Not a valid .docx (missing document.xml)")
  return { zip, xml: await f.async("string") }
}
function allParas(xml: string): string[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(m => m[0])
}
function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function paraText(p: string): string {
  return decodeXml([...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join(""))
}
function isBoldPara(p: string): boolean {
  if (/<w:b\s+w:val="(?:0|false|off)"/.test(p)) return false
  return /<w:b\s*\/?>/.test(p) || /<w:b\s+w:val="(?:1|true|on)"/.test(p)
}
function isHeading(text: string, p: string): boolean {
  const t = text.trim()
  if (!t || t.length > 70) return false
  if (t === t.toUpperCase() && t.replace(/[^A-Za-z]/g, "").length > 2) return true
  return isBoldPara(p)
}
function isBullet(text: string, p: string): boolean {
  if (/<w:numPr\b/.test(p)) return true
  const styleId = (p.match(/<w:pStyle\s+w:val="([^"]*)"/) || [])[1] || ""
  if (/list|bullet/i.test(styleId)) return true
  return BULLET_RE.test(text)
}
function matchesHead(low: string, heads: string[]): boolean {
  return heads.some(h => low.includes(h))
}
// The name/contact header (email, phone, LinkedIn) must never be mistaken for the summary.
function looksLikeContact(t: string): boolean {
  return /@|linkedin|github\.com|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i.test(t)
}
// A location / relocation strip, e.g. "Santa Clara, CA | Seattle, WA | Austin, TX" or
// "Open for relocation to …". These must NEVER be read as a title or edited as one —
// doing so overwrites a city with the job title and corrupts the contact line.
// Matched against REAL US state codes so a title like "Developer, AI" never misfires.
const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC"
const STATE_CODE_RE = new RegExp(`,\\s*(?:${US_STATES.split(" ").join("|")})\\b`, "g")
function looksLikeLocationList(t: string): boolean {
  if (/\brelocation\b|\bopen to relocat/i.test(t)) return true
  const hits = (t.match(STATE_CODE_RE) || []).length
  if (hits >= 2) return true                                              // ≥2 "City, ST" pairs
  if (hits === 1 && /^[A-Za-z][A-Za-z .'\-]*,\s*[A-Z]{2}$/.test(t.trim())) return true // a lone "City, ST"
  return false
}
// A "Company — Title | Location | Dates" line: a role boundary, never an editable bullet.
// Length is checked on WHITESPACE-COLLAPSED text — some resumes right-align the date with
// a long run of literal spaces instead of a tab stop (seen padding a title line out past
// 160 raw chars while the actual content is ~40), which silently failed this check and
// merged that whole job's bullets into the PREVIOUS role (the "orphaned bullets" defect).
function looksLikeRoleTitle(t: string): boolean {
  const collapsed = t.replace(/\s+/g, " ").trim()
  if (collapsed.length > 160) return false
  return DATE_RANGE.test(t) && (/[|]/.test(t) || /\s[—–]\s/.test(t))
}
type Section = "summary" | "skills" | "experience" | "projects" | "other"
// A section heading recognised by its NAME — works even when it isn't UPPERCASE or bold
// (e.g. Title-Case "Professional Summary" / "Core Competencies" / "Professional Experience").
function sectionHead(t: string, p: string): Section | null {
  if (t.length > 45) return null
  if (/<w:numPr\b/.test(p) || BULLET_RE.test(t)) return null // a bullet is never a heading
  const low = t.toLowerCase()
  if (matchesHead(low, SUMMARY_HEADS)) return "summary"
  if (matchesHead(low, SKILLS_HEADS)) return "skills"
  if (matchesHead(low, PROJECT_HEADS)) return "projects"
  if (matchesHead(low, EXPERIENCE_HEADS)) return "experience"
  if (matchesHead(low, OTHER_HEADS)) return "other"
  return null
}
function runTexts(p: string): string[] {
  return [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decodeXml(m[1]))
}
// Parse the header paragraph's runs into name / role-title / identity-tagline.
function parseHeader(p: string, idx: number): Header | null {
  const runs = runTexts(p)
  if (!runs.some(looksLikeContact)) return null // not a contact header
  let name = "", title = ""
  for (const r of runs) {
    if (looksLikeContact(r)) break // stop before contact runs
    if (looksLikeLocationList(r)) continue // never read a title out of a location/relocation strip
    const m = r.match(/^(.+?)\s*[—–|]\s*(.+)$/) // "NAME — TITLE" in one run
    // Accept a short title that is NOT itself a city list (works for any domain, incl.
    // security titles like "Cloud Security" / "Penetration Tester" that have no role-word).
    if (m && m[1].trim().length > 1 && m[2].trim().length > 1 && m[2].trim().length <= 60
        && !looksLikeLocationList(m[2]) && !looksLikeContact(m[2])) {
      name = m[1].trim(); title = m[2].trim(); break
    }
  }
  // Split pattern: the name run ENDS with a trailing separator and the title is the
  // NEXT run, e.g. ["ESHWAR JANJIRALA —"] [" "] ["Cloud Security"] [contact…]. Common
  // in the single-paragraph header where each segment is its own run.
  if (!title) {
    for (let i = 0; i < runs.length && !looksLikeContact(runs[i]); i++) {
      if (looksLikeLocationList(runs[i])) continue            // not a name→title boundary
      if (!/[—–|]\s*$/.test(runs[i])) continue
      for (let j = i + 1; j < runs.length; j++) {
        const cand = runs[j].trim()
        if (!cand) continue                                   // skip blank spacer runs
        if (looksLikeContact(cand) || looksLikeLocationList(cand) || /[•·]/.test(cand) || cand.length > 60) break
        if (!name) name = runs[i].replace(/[—–|]\s*$/, "").trim()
        title = cand
        break
      }
      break
    }
  }
  let tagline = ""
  for (const r of runs) {
    if (looksLikeContact(r)) continue
    if (/[•·]/.test(r) && r.split(/[•·]/).filter(s => s.trim()).length >= 3) { tagline = r.trim(); break }
  }
  // Multi-run tagline fallback: join non-contact runs that follow the last contact run.
  // This covers resumes where each "•" is its own run (character-level formatting).
  if (!tagline) {
    const lastContactIdx = runs.reduce((last, r, i) => looksLikeContact(r) ? i : last, -1)
    if (lastContactIdx >= 0) {
      const afterContact = runs.slice(lastContactIdx + 1).filter(r => r.trim())
      const joined = afterContact.join("").replace(/\s+/g, " ").trim()
      if (joined && joined.split(/[•·]/).filter(s => s.trim()).length >= 2) tagline = joined
    }
  }
  return name || title || tagline ? { idx, name, title, tagline } : null
}

// Stacked header: name, title, and contact each on their OWN paragraph (the most
// common resume layout). parseHeader can't see across paragraphs, so we scan the
// run of paragraphs up to the contact line and capture the title (and tagline)
// paragraph indices so applyRewrites can rewrite them in place.
function parseStackedHeader(paras: string[]): Header | null {
  const scan = Math.min(paras.length, 8)
  let contactIdx = -1
  for (let i = 0; i < scan; i++) {
    if (looksLikeContact(paraText(paras[i]))) { contactIdx = i; break }
  }
  if (contactIdx < 1) return null // need at least a name line before the contact line

  // Non-empty paragraphs BEFORE the contact line = the name (+ maybe a title) block.
  const before: { i: number; t: string }[] = []
  for (let i = 0; i < contactIdx; i++) {
    const t = paraText(paras[i]).trim()
    if (t) before.push({ i, t })
  }
  if (!before.length) return null

  const name = before[0].t
  const nameIdx = before[0].i
  let title = "", titleIdx: number | undefined
  let tagline = "", taglineIdx: number | undefined

  // Among the lines between the name and the contact line, classify each:
  //   a "•/·"-separated line is the identity tagline; the first short line that is NOT a
  //   location/relocation strip is the title (domain-agnostic — works for "Cloud Security",
  //   "Penetration Tester", etc., which carry no generic "role word").
  for (let k = 1; k < before.length; k++) {
    const cand = before[k].t
    if (/[•·]/.test(cand) && cand.split(/[•·]/).filter(s => s.trim()).length >= 2) {
      if (!tagline) { tagline = cand; taglineIdx = before[k].i }
    } else if (!title && cand.length <= 70 && !looksLikeLocationList(cand)) {
      title = cand; titleIdx = before[k].i
    }
  }
  // Title AFTER the contact line: some resumes stack Name → Contact → TITLE →
  // Summary (the title sits below the email/phone). parseHeader/the loop above only
  // look BEFORE contact, so scan a few paragraphs past it for a short title-like line
  // (stop at the first section heading or a long paragraph = the summary body).
  if (!title) {
    for (let i = contactIdx + 1; i < Math.min(paras.length, contactIdx + 6); i++) {
      const t = paraText(paras[i]).trim()
      if (!t) continue
      if (t.replace(/\s+/g, " ").length > 70) break          // long line → summary body, stop
      if (sectionHead(t, paras[i])) break                    // hit a real section heading, stop
      if (looksLikeContact(t) || looksLikeLocationList(t) || isBullet(t, paras[i])) continue
      if (/[•·]/.test(t)) continue                           // that's a tagline strip, not the title
      title = t; titleIdx = i; break                         // first qualifying short line = the title
    }
  }

  if (!title && !tagline) return null // nothing safely editable → leave header alone
  return { idx: nameIdx, name, title, tagline, titleIdx, taglineIdx }
}

const MONTH_MAP: Record<string, number> = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
}
function parseYM(s: string): [number, number] | null {
  s = s.trim().toLowerCase()
  if (/^(present|current|now)$/.test(s)) { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1] }
  const yOnly = s.match(/^((?:19|20)\d{2})$/)
  if (yOnly) return [+yOnly[1], 1]
  const my = s.match(/([a-z]{3,9})\.?\s+((?:19|20)\d{2})/)
  if (my && MONTH_MAP[my[1]]) return [+my[2], MONTH_MAP[my[1]]]
  const ym = s.match(/((?:19|20)\d{2})\s+([a-z]{3,9})/)
  if (ym && MONTH_MAP[ym[2]]) return [+ym[1], MONTH_MAP[ym[2]]]
  return null
}

// Calculate total unique months of work experience from role-title strings.
// Returns a label like "7 years 3 months" or "5 years".
export function calcYOE(roles: Zones["roles"]): string {
  const intervals: [number, number][] = [] // [startMonths, endMonths] as month index
  const toAbs = (y: number, m: number) => y * 12 + m
  for (const r of roles) {
    const m = r.role.match(
      /\b((?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}|present|current|now)\s*[–—-]+\s*((?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}|present|current|now)/i
    )
    if (!m) continue
    const s = parseYM(m[1]), e = parseYM(m[2])
    if (s && e) {
      const sa = toAbs(s[0], s[1]), ea = toAbs(e[0], e[1])
      if (ea >= sa) intervals.push([sa, ea])
    }
  }
  if (!intervals.length) return ""
  // Merge overlapping intervals to avoid double-counting.
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = [intervals[0]]
  for (const [s, e] of intervals.slice(1)) {
    const last = merged[merged.length - 1]
    if (s <= last[1] + 1) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  const total = merged.reduce((sum, [s, e]) => sum + (e - s), 0)
  // Round to nearest whole year — no months in the summary.
  const years = Math.round(total / 12)
  return `${years || 1} year${years !== 1 ? "s" : ""}`
}

export async function extractText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer })
  return value || ""
}

// ── 1) Extract the editable zones with stable indices ─────────────────────────
export async function extractZones(buffer: Buffer): Promise<Zones> {
  const { xml } = await loadXml(buffer)
  const paras = allParas(xml)

  let summaryIdx: number | null = null
  let summaryText = ""
  const summaryOverflowIdx: number[] = []
  // True when the summary was found via the no-heading fallback (a bulleted highlight
  // block with no "Summary" heading). Those follow-on lines are prime keyword space —
  // capture them as in-place editable lines instead of leaving them stale.
  let summaryNoHeading = false
  const skills: { idx: number; text: string }[] = []
  type Role = { role: string; bullets: { idx: number; text: string }[]; current?: boolean }
  const roles: Role[] = []
  let curRole: Role | null = null
  let section: "summary" | "skills" | "experience" | "projects" | "other" | null = null
  let seenExpRole = false // the first EXPERIENCE role is the candidate's current job
  const extras: { idx: number; text: string; section: string }[] = []
  let otherLabel = "" // the current "other" heading (Certifications / Education / …)

  // The name/title/contact header — usually the first paragraph that carries contact info.
  let header: Header | null = null
  for (let i = 0; i < Math.min(paras.length, 4) && !header; i++) header = parseHeader(paras[i], i)
  // Single-paragraph parse found nothing (or no title) → try the stacked layout where
  // name / title / contact each sit on their own paragraph (the user's resume format).
  if (!header || !header.title) {
    const stacked = parseStackedHeader(paras)
    if (stacked && (stacked.title || stacked.tagline)) header = stacked
  }

  const startRole = (title: string, isExp: boolean) => {
    const current = isExp && !seenExpRole
    if (isExp) seenExpRole = true
    curRole = { role: title, bullets: [], current }
    roles.push(curRole)
  }

  for (let idx = 0; idx < paras.length; idx++) {
    const p = paras[idx]
    const t = paraText(p).trim()
    if (!t) continue

    // 1) A known section heading by NAME (handles Title-Case / un-bolded headings too).
    const sec = sectionHead(t, p)
    if (sec) {
      section = sec
      if (sec === "experience" || sec === "projects") curRole = null
      if (sec === "other") otherLabel = t.replace(/[:•]+$/, "").trim()
      continue
    }

    // 2) A short UPPERCASE/bold role-title heading that carries a date (some resumes
    //    list jobs with no "Experience" heading at all).
    if (isHeading(t, p) && HAS_DATE.test(t) && !isBullet(t, p)) {
      section = "experience"
      startRole(t, true)
      continue
    }

    if (section === "summary") {
      if (summaryIdx === null && t.length > 40 && !looksLikeContact(t)) { summaryIdx = idx; summaryText = t }
      else if (summaryIdx !== null && !looksLikeContact(t) && !looksLikeRoleTitle(t)) {
        if (summaryNoHeading) {
          // No-heading bulleted "summary" = highlight lines (often 10-17 of them). These
          // are the resume's best keyword real estate. Capture each as an in-place
          // editable line (routed through the skills channel, which rewrites at its own
          // [idx]) so the model can retarget it to the JD — format preserved (rewritten
          // in place, never blanked or deleted), and no keyword space wasted.
          if (t.length > 20) skills.push({ idx, text: t })
        } else if (t.length > 20 && !isBullet(t, p) && summaryOverflowIdx.length < 6) {
          // Heading-based summary with a few concatenated paragraphs — old behaviour:
          // fold into summaryText and blank the extras when the summary is consolidated.
          summaryOverflowIdx.push(idx)
          summaryText += " " + t
        }
      }
    } else if (section === "skills") {
      if (!looksLikeContact(t)) skills.push({ idx, text: t })
    } else if (section === "experience" || section === "projects") {
      // A "Company — Title | Dates" line (incl. tab-separated ones) is a role boundary,
      // NOT a bullet — this keeps the model from rewriting a company, title, or date.
      // Same whitespace-collapsed length check as looksLikeRoleTitle, and for the same
      // reason: literal-space date-alignment padding must not defeat this check.
      if (section === "experience" && !isBullet(t, p) && (looksLikeRoleTitle(t) || (HAS_DATE.test(t) && t.replace(/\s+/g, " ").trim().length <= 120))) {
        startRole(t, true)
        continue
      }
      // Only fall back to an implicit role when there's an actual bullet-length line to
      // hang it on. Some resumes put the company name on its OWN short paragraph before
      // the "Title | Dates" line (e.g. "Mckesson" \n "Sr. Engineer | Sep 2024 – Present");
      // that short company-only line is neither a role-title match (no date) nor bullet-
      // length, so it must be skipped rather than eagerly opening a role here — doing so
      // created a phantom 0-bullet role that stole the `current: true` flag from the REAL
      // first role parsed one line later (filtered out by its 0 bullets, but only after
      // already consuming "current").
      const isBulletLine = isBullet(t, p) || (t.length >= 25 && t.length <= 400)
      if (isBulletLine) {
        if (!curRole) startRole(section === "projects" ? "Projects" : "Experience", section === "experience")
        curRole!.bullets.push({ idx, text: t })
      }
    } else if (section === "other") {
      // certifications / education / awards — editable in the builder, not auto-tailored.
      if (!looksLikeContact(t)) extras.push({ idx, text: t, section: otherLabel || "Other" })
    } else if (section === null && summaryIdx === null && t.length > 120 && !looksLikeContact(t)) {
      // resume opens with a summary paragraph and no heading (but not the name/contact
      // header). Switch into the summary section so the follow-on highlight lines get
      // captured as editable (see the summaryNoHeading branch above) rather than ignored.
      summaryIdx = idx; summaryText = t; section = "summary"; summaryNoHeading = true
    }
  }

  return { header, summaryIdx, summaryText, summaryOverflowIdx, skills, roles: roles.filter(r => r.bullets.length), extras }
}

// ── Deterministic hard cap on bullets per role/project ─────────────────────────
// The model can choose WHICH lines to rewrite but applyRewrites never removes a
// paragraph on its own — so a source resume whose current role already has 19+
// bullets (several tailoring/AI passes accumulated over time) stays bloated no
// matter how well the model follows the RULES prompt's stated 10-12 cap. This runs
// AFTER the model's edits: keep every bullet the model actually rewrote (judged
// JD-relevant) first, fill remaining slots with untouched originals in their
// original order, and mark the rest to be physically dropped — plus drop any
// bullet whose FINAL text (edited or original) exactly duplicates an earlier one
// in the same role (the verbatim-repeated-bullet defect).
export function capRoleBullets(zones: Zones, edits: Edits): Set<number> {
  const editedText = new Map(
    (edits.bullets || []).filter(b => (b.text || "").trim()).map(b => [b.idx, b.text.trim()]),
  )
  const drop = new Set<number>()
  const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

  for (const role of zones.roles) {
    const cap = role.current ? 12 : 8
    const seen = new Set<string>()
    const editedIdx: number[] = []
    const untouchedIdx: number[] = []
    for (const b of role.bullets) {
      const text = editedText.get(b.idx) ?? b.text
      const key = normKey(text)
      if (seen.has(key)) { drop.add(b.idx); continue } // exact-duplicate final text
      seen.add(key)
      if (editedText.has(b.idx)) editedIdx.push(b.idx)
      else untouchedIdx.push(b.idx)
    }
    let kept = 0
    for (const idx of [...editedIdx, ...untouchedIdx]) {
      if (kept < cap) kept++
      else drop.add(idx)
    }
  }
  return drop
}

// A summary / skill / bullet is ONE paragraph: collapse stray newlines the model left
// inside the value, and add the space it sometimes drops between glued sentences
// ("environments.Proven" → "environments. Proven"). Safe for tech terms (Node.js, ASP.NET).
function normalizeEditText(s: string): string {
  return s
    .replace(/\s+/g, " ")                                // collapse any run of whitespace to one space
    .replace(/\s+([,.;:!?])/g, "$1")                     // never leave a space BEFORE punctuation
    .replace(/([a-z])([.!?])([A-Z][a-z])/g, "$1$2 $3")   // add the space the model drops between glued sentences
    .trim()                                              // no leading / trailing space
}

// ── 2) Apply the model's idx-keyed rewrites in place ──────────────────────────
// Overwrite a paragraph's text, keeping the LAST run's formatting (body-text style)
// and any original bullet glyph. Using the last run avoids inheriting bold/special
// formatting that resumes often place only on the first sentence of a paragraph.
function rewriteParaText(p: string, newText: string): string {
  const orig = paraText(p)
  const m = orig.match(BULLET_RE)
  const prefix = m ? m[0] : ""
  const body = normalizeEditText(newText.replace(BULLET_RE, ""))
  const full = prefix + body

  const tMatches = [...p.matchAll(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g)]
  if (!tMatches.length) return p

  // Write the line into the LAST run that actually carries visible text — skipping any
  // trailing empty or whitespace-only "spacer" runs. Those spacers usually sit right
  // after a <w:tab/>; dumping the whole line into one is what shoved text out of place
  // and introduced stray leading spaces / indents. We still blank every OTHER text run
  // so internal word-separator runs don't double up the spacing.
  let targetIdx = tMatches.length - 1
  for (let k = tMatches.length - 1; k >= 0; k--) {
    if (decodeXml(tMatches[k][2]).trim() !== "") { targetIdx = k; break }
  }

  let runIdx = -1
  const out = p.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (full2, open, _c, close) => {
    runIdx++
    if (runIdx === targetIdx) {
      const openTag = /xml:space=/.test(open) ? open : open.replace("<w:t", '<w:t xml:space="preserve"')
      return `${openTag}${encodeXml(full)}${close}`
    }
    return `${open}${close}` // blank every other text run (keep its run props & spacing)
  })
  return out !== p ? out : p
}

// Surgically edit the header: swap ONLY the title text (inside the "Name — Title" run)
// and the identity-tagline run. The name, phone, email, and LinkedIn runs are untouched.
function rewriteHeader(p: string, header: Header, newTitle?: string, newTagline?: string): { xml: string; changed: string[] } {
  let out = p
  const changed: string[] = []
  const title = (newTitle || "").trim()
  // Require a KNOWN current title to find-and-replace. With an empty header.title,
  // `dec.includes("")` is always true and `dec.replace("", title)` would PREPEND the
  // new title onto the whole header line ("AI DeveloperESHWAR JANJIRALA — …"). Better
  // to leave the header untouched than to corrupt it.
  // Only replace when the OLD title is a short, real title and NOT a location strip or
  // contact text. This stops the rewriter from ever matching a city in the
  // "City, ST | City, ST" relocation line and overwriting it with the job title — while
  // still working for any domain (security titles have no generic "role word").
  const titleIsSafe = !!header.title && header.title.length <= 60
    && !looksLikeLocationList(header.title) && !looksLikeContact(header.title)
  if (title && titleIsSafe && title.toLowerCase() !== header.title.toLowerCase()) {
    let done = false
    out = out.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (full, open, content, close) => {
      if (done) return full
      const dec = decodeXml(content)
      // Never touch a contact run (email/phone/LinkedIn) or a location/relocation run.
      if (looksLikeContact(dec) || looksLikeLocationList(dec)) return full
      if (dec.includes(header.title)) {
        done = true
        return `${open}${encodeXml(dec.replace(header.title, title))}${close}`
      }
      return full
    })
    if (done) changed.push("Header title updated to the target role")
  }
  const tag = (newTagline || "").trim()
  if (tag && header.tagline && tag !== header.tagline) {
    let tagDone = false
    // Single-run tagline: the whole tagline is one run — exact match and replace.
    out = out.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (full, open, content, close) => {
      if (tagDone) return full
      if (decodeXml(content).trim() === header.tagline.trim()) {
        tagDone = true
        const openTag = /xml:space=/.test(open) ? open : open.replace("<w:t", '<w:t xml:space="preserve"')
        return `${openTag}${encodeXml(tag)}${close}`
      }
      return full
    })
    if (!tagDone) {
      // Multi-run tagline: each bullet is its own run. Find the zone after the last
      // contact run, put the new tagline into the first non-blank run, blank the rest.
      const allRunMatches = [...out.matchAll(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g)]
      const lastContactIdx = allRunMatches.reduce(
        (last, m, i) => looksLikeContact(decodeXml(m[2])) ? i : last, -1
      )
      if (lastContactIdx >= 0) {
        let runIdx = -1
        let taglineWritten = false
        out = out.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (full, open, content, close) => {
          runIdx++
          if (runIdx <= lastContactIdx) return full          // before/at last contact: keep
          const text = decodeXml(content).trim()
          if (!text) return full                             // blank run: keep blank
          if (!taglineWritten) {
            taglineWritten = true; tagDone = true
            const openFixed = /xml:space=/.test(open) ? open : open.replace("<w:t", '<w:t xml:space="preserve"')
            return `${openFixed}${encodeXml(tag)}${close}`  // first tagline run → new tagline
          }
          return `${open}${close}`                          // subsequent tagline runs → blank
        })
      }
    }
    if (tagDone) changed.push("Header identity strip focused on the role")
  }
  return { xml: out, changed }
}

export async function applyRewrites(
  buffer: Buffer,
  edits: Edits,
  zones: Zones,
  opts?: { dropIdx?: Set<number> },
): Promise<{ buffer: Buffer; notes: string[] }> {
  const { zip, xml } = await loadXml(buffer)
  const notes: string[] = []

  const validSkill = new Set(zones.skills.map(s => s.idx))
  const validBullet = new Set(zones.roles.flatMap(r => r.bullets.map(b => b.idx)))
  const validExtra = new Set((zones.extras || []).map(e => e.idx))

  const rewrites = new Map<number, string>()
  const summary = (edits.summary || "").trim()
  if (summary && zones.summaryIdx !== null) {
    rewrites.set(zones.summaryIdx, summary)
    notes.push("Summary rewritten")
    // Blank any leftover concatenated-summary paragraphs now that the consolidated
    // single paragraph has been written into the first one.
    for (const idx of zones.summaryOverflowIdx || []) rewrites.set(idx, "")
    if (zones.summaryOverflowIdx?.length) notes.push("Consolidated a multi-paragraph summary into one")
  }

  let sk = 0, bl = 0
  for (const s of edits.skills || []) {
    if (validSkill.has(s.idx) && (s.text || "").trim()) { rewrites.set(s.idx, s.text.trim()); sk++ }
  }
  for (const b of edits.bullets || []) {
    if (validBullet.has(b.idx) && (b.text || "").trim()) { rewrites.set(b.idx, b.text.trim()); bl++ }
  }
  let ex = 0
  for (const e of edits.extras || []) {
    if (validExtra.has(e.idx) && (e.text || "").trim()) { rewrites.set(e.idx, e.text.trim()); ex++ }
  }
  if (sk) notes.push(`${sk} skill line(s) updated`)
  if (bl) notes.push(`${bl} bullet(s) rewritten`)
  if (ex) notes.push(`${ex} other line(s) updated`)

  // Header edits: a single-line header gets a run-level edit on its own paragraph;
  // a stacked header (title / tagline on their own paragraphs) gets those paragraphs
  // rewritten in place. Either way the name and contact runs are never touched.
  const newTitle = (edits.headline?.title || "").trim()
  const newTagline = (edits.headline?.tagline || "").trim()
  const titleIdx = zones.header?.titleIdx
  const taglineIdx = zones.header?.taglineIdx

  // Positional replace — the i-th paragraph matches zone index i exactly.
  const dropIdx = opts?.dropIdx
  let dropped = 0
  let i = -1
  const newXml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (m) => {
    i++
    if (dropIdx?.has(i)) { dropped++; return "" } // physically remove an over-cap/duplicate bullet
    if (zones.header) {
      if (i === zones.header.idx) {
        const { xml: edited, changed } = rewriteHeader(m, zones.header, edits.headline?.title, edits.headline?.tagline)
        notes.push(...changed)
        return edited
      }
      // Stacked header: rewrite the standalone title / tagline paragraph.
      // Compare case-insensitively so "Cloud Security Engineer" → "AI Developer" always triggers
      // even if the model normalizes casing. Also update when header.title wasn't parsed (empty).
      if (titleIdx !== undefined && i === titleIdx && newTitle) {
        const titleChanged = newTitle.trim().toLowerCase() !== (zones.header.title || "").trim().toLowerCase()
        if (titleChanged || !zones.header.title) {
          notes.push("Header title updated to the target role")
          return rewriteParaText(m, newTitle)
        }
      }
      if (taglineIdx !== undefined && i === taglineIdx && newTagline) {
        const taglineChanged = newTagline.trim().toLowerCase() !== (zones.header.tagline || "").trim().toLowerCase()
        if (taglineChanged || !zones.header.tagline) {
          notes.push("Header identity strip focused on the role")
          return rewriteParaText(m, newTagline)
        }
      }
    }
    const r = rewrites.get(i)
    return r !== undefined ? rewriteParaText(m, r) : m
  })
  if (dropped) notes.push(`Trimmed ${dropped} over-cap/duplicate bullet(s)`)

  zip.file("word/document.xml", newXml)
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  return { buffer: out as Buffer, notes }
}
