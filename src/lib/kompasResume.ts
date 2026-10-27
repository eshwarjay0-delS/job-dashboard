/**
 * Resume intelligence — ported from perfACT's copilot-api/answer.js
 * (parseRoles, resumeDigest, employerAliases). 2026-10-14.
 *
 * Why this exists: the first 4,200 characters of a long resume hold only the
 * summary and skills — the owner's experience section starts at character
 * 7,240, so a naive cut means the model never sees an employer, title or
 * date and invents them ("a large financial services organization").
 * resumeDigest() fits the resume to the question with TF-IDF weighting so
 * the model sees the RIGHT experience for THIS question.
 *
 * This complements (not replaces) the dossier: the dossier is the growing
 * store of everything; the resume digest is the fitted excerpt for this turn.
 */

export type ResumeRole = {
  at: number
  headAt: number
  org: string
  title: string
  dates: string
  current: boolean
  bullets: string[]
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+"
const ROLE_DATES = new RegExp(
  `\\b(?:${MONTH})?(?:19|20)\\d{2}\\s*(?:[–—-]|to)\\s*(?:(?:${MONTH})?(?:19|20)\\d{2}|present|current|now|till date|date)\\b`,
  "i",
)
const TITLE_WORDS =
  /\b(engineer|analyst|developer|manager|architect|lead|consultant|specialist|administrator|admin|intern|director|officer|associate|scientist|designer|tester|responsibilities|experience|summary|education)\b/i
// One parser for every common resume layout (found by self-play over 15 resumes, 2026-09-30 — all 15 failed before):
//   "Cigna Healthcare — IAM Team Lead | Texas | Sep 2023 – Present"   (employer — title | location | dates)
//   "Fifth Bank" / "Senior Security Engineer | Nov 2023 – Present"     (employer on the line above)
//   "Security Analyst, Acme | 2019 - 2021", "Title | Org | dates"       (either order)
// Section headers ("PROFESSIONAL EXPERIENCE"), locations ("Texas", "Hyderabad, IN", "Remote") and education lines are skipped.
const HEADER_LINE = /^[A-Z0-9 &/,.()'-]{4,}$/
const EDU_LINE =
  /\b(university|college|institute|school|academy|b\.?\s?tech|b\.?\s?e\.?\b|m\.?\s?s\.?\b|m\.?\s?tech|bachelor|master'?s?|ph\.?\s?d|degree|diploma)\b/i

// A place, not an employer. Measured 26 Oct 2026 (evaluation, every introduction scrambled the career): the old LOCATION_SEG
// matched any one or two capitalised words, so in "Senior Cybersecurity Engineer | Citi Bank | New York, NY" the
// employer "Citi Bank" was dropped as a location (and "CVS Health", "Charter Communications", "Accenture" with it), and
// the previous role's last bullet was taken as the employer. Only a real place shape counts: "City, ST", a state, a
// country, a well-known city, or remote/hybrid/onsite.
const US_STATES = "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia"
const COUNTRIES = "india|usa|u\\.s\\.a?|united states|united kingdom|uk|canada|australia|germany|singapore|uae|united arab emirates|ireland|netherlands|mexico|philippines|remote|hybrid|on-?site|onsite"
const CITIES = "new york city|nyc|boston|chicago|seattle|austin|dallas|houston|atlanta|denver|phoenix|san francisco|los angeles|san diego|san jose|miami|charlotte|raleigh|philadelphia|pittsburgh|detroit|minneapolis|portland|nashville|columbus|indianapolis|bangalore|bengaluru|hyderabad|chennai|pune|mumbai|delhi|new delhi|noida|gurgaon|gurugram|kolkata|london|toronto|sydney|dubai"
const PLACE = new RegExp(`^(?:${US_STATES}|${COUNTRIES}|${CITIES})$`, "i")
export function isLocationSeg(seg: string): boolean {
  const s = String(seg || "").trim().replace(/\.$/, "")
  if (!s || /\d/.test(s)) return false
  if (PLACE.test(s)) return true
  const m = s.match(/^([A-Z][A-Za-z.'-]+(?:\s[A-Z][A-Za-z.'-]+){0,2}),\s*([A-Za-z. ]{2,})$/)   // "Irving, TX", "Austin, Texas"
  return !!m && (/^[A-Z]{2}$/.test(m[2].trim()) || PLACE.test(m[2].trim()))
}

// A Word tab between the place and the dates is lost in the text: "New York, NYNOV 2024 – PRESENT", "IndiaAPR 2017".
// Measured 27 Oct 2026 on the owner's Endpoint Analyst resume: the start month fell off every role. Only a month glued to
// a two-letter code or to a lower-case letter is split, so "SUMMARY 2020" stays as written.
const GLUED_MONTH = /(?<=\b[A-Z]{2}|[a-z])((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)(\.?\s+(?:19|20)\d{2}\b)/g

function cleanLines(resume: string): string[] {
  return String(resume || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").replace(GLUED_MONTH, " $1$2").trim())
}

// Which part of "A | B" is the job title when neither or both carry a title word. "Senior Endpoint Security | Citi Bank"
// and "Endpoint Security | CVS Health" were read as employer "Senior Endpoint Security", title "Citi Bank", and every
// introduction opened "I'm a Citi Bank at Citi Bank" (live evaluation, 27 Oct 2026).
const SENIORITY = /\b(?:senior|sr\.?|junior|jr\.?|principal|staff|head|chief|vp|vice president)\b/i
const ORG_WORDS =
  /\b(?:bank|health|healthcare|inc|llc|ltd|limited|corp|corporation|company|group|communications|technologies|technology|solutions|services|systems|labs|partners|university|hospital|city of|county|state of|department|agency|government|insurance|financial|capital|airlines|consulting|networks|software|pharma|energy|holdings|bancorp)\b|&/i
const titleish = (s: string) => TITLE_WORDS.test(s) || SENIORITY.test(s)
/** "title" when `a` is the title and `b` the employer, "org" for the reverse, "" when the line alone cannot tell. */
function headerOrder(a: string, b: string): "title" | "org" | "" {
  if (titleish(a) !== titleish(b)) return titleish(a) ? "title" : "org"
  if (ORG_WORDS.test(a) !== ORG_WORDS.test(b)) return ORG_WORDS.test(b) ? "title" : "org"
  return ""
}

/** Parse every role header out of the resume's lines. */
export function parseRoles(lines: string[]): ResumeRole[] {
  const out: ResumeRole[] = []
  const unsure: { role: ResumeRole; a: string; b: string }[] = []   // one-line headers whose order the line could not tell
  const orders: string[] = []
  lines.forEach((l, i) => {
    if (l.length > 160 || !ROLE_DATES.test(l)) return
    const bare = l.replace(/^[•▪●\-*\uFFFD]\s*/, "")
    if (EDU_LINE.test(bare)) return
    let p = i - 1
    while (p >= 0 && !lines[p]) p--
    const prev = p >= 0 ? lines[p] : ""
    const dates = (bare.match(ROLE_DATES) || [""])[0]
    let segs = bare
      .replace(ROLE_DATES, "")
      .split(/\s*[|•·]\s*/)
      .map((x) => x.replace(/^[\s,–—-]+|[\s,–—-]+$/g, "").trim())
      .filter(Boolean)
    segs = segs.filter((x, k) => !(k > 0 && isLocationSeg(x) && !TITLE_WORDS.test(x)))
    const first = segs[0] || ""
    const dash = first.split(/\s+[—–]\s+|\s+-\s+/)
    let org = ""
    let title = ""
    let oneLine = true
    let pair: [string, string] | null = null
    if (dash.length >= 2) pair = [dash[0], dash.slice(1).join(" — ")]
    else if (segs.length >= 2) pair = [segs[0], segs[1]]
    if (pair) {
      const order = headerOrder(pair[0], pair[1])
      if (order) orders.push(order)
      if (order === "title") {
        title = pair[0]
        org = pair[1]
      } else {
        org = pair[0]
        title = pair[1]
      }
    } else {
      oneLine = false
      title = first
      org = HEADER_LINE.test(prev) || ROLE_DATES.test(prev) ? "" : prev
      if (org && TITLE_WORDS.test(org) && !TITLE_WORDS.test(title)) [org, title] = [title, org]
    }
    org = org
      .replace(/^[•▪●\-*\uFFFD]\s*/, "")
      .split(/\s*,\s*/)[0]
      .trim()
    const role: ResumeRole = {
      at: i,
      headAt: oneLine || !org ? i : p,
      org,
      title: title.trim(),
      dates,
      current: /present|current|now|till date/i.test(dates),
      bullets: [],
    }
    out.push(role)
    if (pair && !headerOrder(pair[0], pair[1])) unsure.push({ role, a: pair[0], b: pair[1] })
  })
  // A resume writes every header the same way round: an unclear one follows the order its other headers use.
  const titleFirst = orders.filter((o) => o === "title").length
  if (titleFirst > orders.length - titleFirst)
    for (const u of unsure) {
      u.role.title = u.a.trim()
      u.role.org = u.b.replace(/^[•▪●\-*�]\s*/, "").split(/\s*,\s*/)[0].trim()
    }
  return out
}

export type ResumeRoles = {
  employers: string[]
  current: string
  currentRole: ResumeRole | null
  list: ResumeRole[]
}

/** The resume's roles: current title + employer names, and how the call says them. */
export function resumeRoles(resume: string): ResumeRoles {
  const list = parseRoles(cleanLines(resume))
  const employers = [...new Set(list.map((r) => r.org).filter(Boolean))]
  const cur = list.find((r) => r.current) || null
  const current = cur ? `${cur.org || ""} — ${cur.title} | ${cur.dates}`.replace(/^ — /, "") : ""
  return { employers, current, currentRole: cur, list }
}

const BULLET = /^[•▪◦●\-*\u2022\uFFFD]\s*/
const ASK_STOP = new Set(
  "the and for with you your have has did what which how many much long this that there over from into about were was are can could would tell me any been our they them their give describe experience".split(
    " ",
  ),
)

/**
 * The resume for the model, within budget. TF-IDF weighted: rare words in the
 * question count more, so "CyberArk upgrade" pulls the CyberArk bullets, not
 * the generic summary. Every role is listed first (the model must know the
 * employers exist), then the bullets that match this question, then the
 * summary. A general question matches almost nothing — never leave the model
 * without the work itself: the current role's first bullets fill the gap.
 */
export function resumeDigest(resume: string, ask: string, budget = 4600, mode: 'focused' | 'career' = 'focused'): string {
  const lines = cleanLines(resume)
  const roles = parseRoles(lines).map((r) => ({ ...r, bullets: [] as string[] }))
  if (!roles.length) return String(resume).slice(0, budget)
  roles.forEach((r, k) => {
    const end = k + 1 < roles.length ? roles[k + 1].headAt : lines.length
    for (let i = r.at + 1; i < end; i++) {
      const l = lines[i]
      if (!l || /^responsibilities\b/i.test(l)) continue
      const parts = l.split(/\s+[•▪●\uFFFD]\s+/)
      parts.forEach((part, j) => {
        if (j > 0 || BULLET.test(part) || !r.bullets.length) r.bullets.push(part.replace(BULLET, ""))
        else r.bullets[r.bullets.length - 1] += " " + part // a bullet wrapped onto the next line
      })
    }
  })
  let pre = lines.slice(0, roles[0].headAt).filter(Boolean).join(" ")
  const ps = pre.search(/professional summary|summary|profile/i)
  if (ps > 0) pre = pre.slice(ps)
  pre = pre
    .replace(/\S+@\S+/g, "")
    .replace(/(\+?\d[\d\s().-]{8,}\d)/g, "")
    .replace(/\b(email|phone|mobile)\s*:\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  // A full-career introduction is not a keyword lookup. Keyword ranking can
  // promote one tool/project and quietly omit earlier roles, even though the
  // question asked for the person. Give each supported career stage source
  // space in resume order; keep fine-grained TF-IDF for scoped questions only.
  if (mode === 'career') {
    const roleMap = `ROLES (resume order, not inferred chronology): ${roles.map((r) =>
      `${r.org} — ${r.title} — ${r.dates}`).join('; ')}`
    const out = [roleMap]
    let used = roleMap.length + 900 // reserve room for the career summary
    const perRole = Math.max(1, Math.min(3, Math.floor((budget - 900) / Math.max(1, roles.length) / 260)))
    for (const r of roles) {
      const head = `${r.org} — ${r.title} (${r.dates}):`
      const bullets: string[] = []
      for (const b of r.bullets.slice(0, perRole)) {
        if (used + head.length + b.length + 20 > budget) break
        bullets.push(b)
        used += b.length + 20
      }
      if (bullets.length) out.push(`${head}\n- ${bullets.join('\n- ')}`)
    }
    out.push(`CAREER SUMMARY (source only): ${pre.slice(0, Math.max(0, Math.min(900, budget - out.join('\n').length - 40)))}`)
    return out.join('\n').slice(0, budget)
  }
  // 6-char stems: "cyberark" ≠ "cyber risk"; "upgrade" = "upgrades"
  const words = [...new Set(String(ask || "").toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g) || [])]
    .filter((w) => !ASK_STOP.has(w))
    .map((w) => w.slice(0, 6))
  const all = roles.flatMap((r) => r.bullets.map((b) => b.toLowerCase()))
  const weight: Record<string, number> = {}
  for (const w of words) weight[w] = Math.log((all.length + 1) / (1 + all.filter((b) => b.includes(w)).length))
  const score = (b: string) => {
    const t = b.toLowerCase()
    return words.reduce((n, w) => n + (t.includes(w) ? weight[w] + 0.01 : 0), 0)
  }
  const out = [`ROLES (as the resume lists them): ${roles.map((r) => `${r.org} — ${r.title} — ${r.dates}`).join("; ")}`]
  let used = out[0].length + 700 // keep room for the summary
  const current = /\b(current|currently|right now|over there|there|responsibilit|role|client|title)\b/i.test(ask)
  const picked = new Set<string>()
  if (current)
    for (const b of roles[0].bullets) {
      if (used + b.length > budget * 0.55) break
      picked.add(`0|${b}`)
      used += b.length + 30
    }
  const ranked = roles
    .flatMap((r, k) => r.bullets.map((b) => ({ k, b, s: score(b) })))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.k - b.k)
  const firsts = roles.map((_, k) => ranked.find((x) => x.k === k)).filter(Boolean) as typeof ranked
  for (const x of [...firsts, ...ranked]) {
    const key = `${x.k}|${x.b}`
    if (picked.has(key)) continue
    if (used + x.b.length + 30 > budget) continue
    picked.add(key)
    used += x.b.length + 30
  }
  // A general question ("tell me about your experience") matches almost nothing: never leave the model without the work
  // itself — the current role's first bullets, then each earlier role's lead bullet (self-play, 2026-09-30).
  if (picked.size < 4) {
    const fill: [number, string][] = [
      ...roles[0].bullets.slice(0, 5).map((b): [number, string] => [0, b]),
      ...roles
        .slice(1)
        .map((r, k): [number, string] | null => (r.bullets[0] ? [k + 1, r.bullets[0]] : null))
        .filter(Boolean as unknown as (x: [number, string] | null) => x is [number, string]),
    ]
    for (const [k, b] of fill) {
      const key = `${k}|${b}`
      if (picked.has(key) || used + b.length + 30 > budget) continue
      picked.add(key)
      used += b.length + 30
    }
  }
  roles.forEach((r, k) => {
    const mine = r.bullets.filter((b) => picked.has(`${k}|${b}`))
    if (mine.length) out.push(`${r.org} — ${r.title} (${r.dates}):\n- ${mine.join("\n- ")}`)
  })
  out.push(`SUMMARY: ${pre.slice(0, Math.max(300, budget - out.join("\n").length - 40))}`)
  return out.join("\n").slice(0, budget + 200)
}

export type EmployerAlias = { said: string; resume: string }

/**
 * "Fifth Third" (as said in the interview) = "Fifth Third Bank" (as on the
 * resume). Matches multi-word employer names said loosely in the transcript
 * so the model uses the name the interviewer just heard.
 */
export function employerAliases(employers: string[], text: string): EmployerAlias[] {
  const out: EmployerAlias[] = []
  const seen = new Set<string>()
  for (const e of employers) {
    if (TITLE_WORDS.test(e)) continue
    const toks = e
      .toLowerCase()
      .replace(/[^a-z0-9& ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
    if (toks.length < 2 || toks.length > 5) continue
    const m = String(text || "").match(new RegExp("\\b" + toks.join("(?:\\s+[a-z0-9&]+){0,2}?\\s+") + "\\b", "i"))
    if (!m) continue
    const said = m[0].replace(/\s+/g, " ").trim()
    if (said.toLowerCase() === toks.join(" ") || seen.has(said.toLowerCase())) continue // said exactly as on the resume
    seen.add(said.toLowerCase())
    out.push({ said: said.replace(/\b[a-z]/g, (c) => c.toUpperCase()), resume: e })
  }
  return out
}
