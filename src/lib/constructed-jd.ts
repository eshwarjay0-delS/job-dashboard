// Eshwar, 6 Nov 2026: before any resume edit, two passes generate related skills,
// experiences, points, bullets, skill lines, and a summary from the job post plus
// the candidate's existing work. Those keywords are summed, and that combined text
// is the JD the tailor updates against. If measured coverage is not above 95%, one
// more generate-then-tailor pass runs. The same employers, dates, titles, bullet
// counts, lead paragraphs, and Environments lines stay. Known JD skills are written
// into those existing project bullets as natural work language, including in earlier
// roles. A labelled skills line is only the overflow a bullet cannot carry.
//
// keyword-targets and resume-quality have no imports, so the Gemini review harness
// can load this file. Do not import keywords.ts or docx from here.
import { isCertification, isQualificationOrJunk, skillLike, SOFT_SKILL } from "./keyword-targets"
import { coveragePercent } from "./resume-quality"

export const PRE_EDIT_PASSES = 2
export const JOB_POST_SKILL_LABEL = "Job-post terms"

export type RelatedPass = {
  skills: string[]
  experiences: string[]
  points: string[]
  bullets: string[]
  skillLines: string[]
  summary: string
}

export function emptyRelatedPass(): RelatedPass {
  return { skills: [], experiences: [], points: [], bullets: [], skillLines: [], summary: "" }
}

function asStrings(value: unknown, max = 32): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const text = item.replace(/\s+/g, " ").trim()
    if (text.length < 2 || text.length > 200) continue
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

/** Model JSON, or a bare keyword array, into one generation pass. Never throws. */
export function parseRelatedPass(value: unknown): RelatedPass {
  if (Array.isArray(value)) return { ...emptyRelatedPass(), skills: asStrings(value) }
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const summary = typeof row.summary === "string" ? row.summary.replace(/\s+/g, " ").trim().slice(0, 700) : ""
  return {
    skills: asStrings(row.skills),
    experiences: asStrings(row.experiences),
    points: asStrings(row.points),
    bullets: asStrings(row.bullets),
    skillLines: asStrings(row.skillLines ?? row.skill_lines),
    summary,
  }
}

const PLAIN_WORD = /^(?:with|from|this|that|have|been|were|your|their|into|over|under|using|across|within|during|after|before|about|other|these|those|each|such|than|then|them|they|will|would|could|should|where|which|while|there|here|also|only|more|most|some|same|into|onto|upon|per|via|the|and|for|job|role)$/

function acceptKeyword(term: string): boolean {
  const k = term.toLowerCase().replace(/[.,;:]+$/g, "").trim()
  if (!k || PLAIN_WORD.test(k)) return false
  if (!skillLike(k) || isCertification(k) || isQualificationOrJunk(k)) return false
  return true
}

/** Keywords from one pass: listed items, plus hyphenated or distinctive tokens inside longer lines. */
export function keywordsFromPass(pass: RelatedPass): string[] {
  const chunks = [...pass.skills, ...pass.experiences, ...pass.points, ...pass.bullets, ...pass.skillLines, pass.summary]
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const k = raw.toLowerCase().replace(/^(?:environments?|skills?|tools?|job-post terms)\s*:\s*/i, "").replace(/[.,;:]+$/g, "").trim()
    if (!acceptKeyword(k) || seen.has(k)) return
    seen.add(k)
    out.push(k)
  }
  for (const chunk of chunks) {
    for (const piece of chunk.split(/[\n•]+/)) {
      const bits = piece.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      const parts = bits.length > 1 ? bits : [piece.trim()]
      for (const part of parts) {
        push(part)
        for (const word of part.split(/\s+/)) {
          const w = word.replace(/^[^a-z0-9+#.-]+|[^a-z0-9+#.-]+$/g, "")
          if (w.includes("-") || /\d/.test(w) || w.length >= 5) push(w)
        }
      }
    }
  }
  return out
}

export function sumPassKeywords(passes: readonly RelatedPass[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const pass of passes) {
    for (const keyword of keywordsFromPass(pass)) {
      if (seen.has(keyword)) continue
      seen.add(keyword)
      out.push(keyword)
    }
  }
  return out
}

/**
 * The original job post plus the summed keyword bank. That string is the tailor's JD.
 * An empty bank leaves the job post unchanged, so a provider outage still scores the post itself.
 */
export function constructJd(jobPost: string, passes: readonly RelatedPass[]): string {
  const post = String(jobPost || "").trim()
  const bank = sumPassKeywords(passes)
  if (!bank.length) return post
  return `${post}\n${bank.join("\n")}`.trim()
}

/** True when the measured percent is not strictly above 95, so one more generate-then-tailor pass is due. */
export function coverageNeedsAnotherPass(percent: number): boolean {
  return !(Number.isFinite(percent) && percent > 95 && percent <= 100)
}

export function coverageRatioPercent(matched: number, total: number): number {
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(matched) || matched < 0) return 0
  return coveragePercent(Math.min(1, matched / total))
}

const TERM_RE = (term: string) => new RegExp(`(?<![A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i")

export function textHasTerm(text: string, term: string): boolean {
  const t = String(term || "").trim()
  if (!t) return false
  return TERM_RE(t).test(String(text || ""))
}

/**
 * A known JD term written into an existing project bullet is the representation, not a refusal.
 * A term only on the labelled skills line is overflow, also not a refusal.
 * `fabricated` is a term that arrived inside a bullet which also added an employer, a date, or contact.
 */
export function unverifiedClaims(present: readonly string[], labelled: readonly string[], fabricated: (term: string) => boolean): string[] {
  const label = new Set(labelled.map(s => s.toLowerCase()))
  const out: string[] = []
  for (const term of present) {
    if (!term) continue
    if (fabricated(term)) out.push(term)
    else if (!label.has(term.toLowerCase())) continue
  }
  return out
}

const YEAR_RE = /\b(?:19|20)\d{2}\b/g
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /(?:\+?\d[\s().-]*){10,}/g
const ORG_RE = /\b[A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,3}\s+(?:Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?)\b/g

function addedTokens(re: RegExp, before: string, after: string): boolean {
  const prev = new Set((before.match(re) || []).map(s => s.toLowerCase()))
  return (after.match(re) || []).some(s => !prev.has(s.toLowerCase()))
}

/** True when a rewrite adds an employer, a year, an email, or a phone the source line did not have. */
export function inventedExperienceFrame(before: string, after: string): boolean {
  const source = String(before || "")
  const next = String(after || "")
  if (addedTokens(YEAR_RE, source, next) || addedTokens(EMAIL_RE, source, next) || addedTokens(ORG_RE, source, next)) return true
  const digits = (text: string) => (text.match(PHONE_RE) || []).map(p => p.replace(/\D/g, "")).filter(d => d.length >= 10)
  const prev = new Set(digits(source))
  return digits(next).some(d => !prev.has(d))
}

function isEnvironmentLine(text: string): boolean {
  return /^(\s*[•\-*▪‣·]\s*)?environments?\s*:/i.test(String(text || "").trim())
}

function isRoleHeaderLine(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || t.length > 160 || /^[•\-*▪‣·]/.test(t)) return false
  return /\b(?:19|20)\d{2}\b/.test(t) && (t.includes("|") || /[—–-]/.test(t))
}

function joinNatural(terms: readonly string[]): string {
  if (terms.length <= 1) return terms[0] || ""
  if (terms.length === 2) return `${terms[0]} and ${terms[1]}`
  return `${terms.slice(0, -1).join(", ")}, and ${terms[terms.length - 1]}`
}

/** Write JD terms into one existing line. The line stays one line. No employer and no date are added. */
export function weaveTermsIntoBullet(text: string, terms: readonly string[]): string {
  const fresh: string[] = []
  for (const term of terms) {
    const t = String(term || "").trim()
    if (!t || textHasTerm(text, t) || fresh.some(f => f.toLowerCase() === t.toLowerCase())) continue
    fresh.push(t)
  }
  if (!fresh.length) return text
  let out = String(text || "").replace(/\s+$/, "")
  if (isEnvironmentLine(out)) return `${out}, ${fresh.join(", ")}`
  const verbs = ["using", "applying", "covering"]
  for (let i = 0; i < fresh.length; i += 4) {
    const clause = `${verbs[Math.min(verbs.length - 1, i / 4)] || "covering"} ${joinNatural(fresh.slice(i, i + 4))}`
    if (/[.!?]$/.test(out)) out = `${out.slice(0, -1)}, ${clause}${out.slice(-1)}`
    else out = `${out}, ${clause}`
  }
  return out
}

export type ExperienceBullet = { idx: number; text: string }

/**
 * Put every missing JD term into an existing project bullet. Roles take turns, so current
 * and previous work both carry the skill set. Bullet counts, employers, and dates stay.
 * Terms that have no project line left are returned unplaced for the labelled overflow.
 */
export function weaveExperienceRepresentation(
  roles: readonly { bullets: readonly ExperienceBullet[] }[],
  current: readonly ExperienceBullet[],
  terms: readonly string[],
): { bullets: ExperienceBullet[]; placed: string[]; unplaced: string[] } {
  const final = new Map<number, string>()
  for (const bullet of current) final.set(bullet.idx, bullet.text)
  const sourceOf = new Map<number, string>()
  const buckets = roles.map(role => role.bullets.filter(b => {
    sourceOf.set(b.idx, b.text)
    return !isEnvironmentLine(b.text) && !isRoleHeaderLine(b.text)
  }))
  const pool = buckets.filter(b => b.length)
  const targets = pool.length ? pool : roles.map(role => role.bullets.filter(b => !isRoleHeaderLine(b.text))).filter(b => b.length)
  const assigned = new Map<number, string[]>()
  const seen = new Set<string>()
  let cursor = 0
  const unplaced: string[] = []
  if (!targets.length) return { bullets: current.map(b => ({ ...b })), placed: [], unplaced: [...terms] }
  for (const term of terms) {
    const key = term.toLowerCase().trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const already = targets.some(role => role.some(b => textHasTerm(final.get(b.idx) ?? b.text, term)))
    if (already) continue
    const role = targets[cursor % targets.length]
    const bullet = role[Math.floor(cursor / targets.length) % role.length]
    const list = assigned.get(bullet.idx) || []
    list.push(term)
    assigned.set(bullet.idx, list)
    cursor++
  }
  for (const [idx, extra] of assigned) {
    const source = sourceOf.get(idx) || ""
    const base = final.get(idx) ?? source
    const next = weaveTermsIntoBullet(base, extra)
    if (inventedExperienceFrame(source || base, next)) {
      unplaced.push(...extra)
      continue
    }
    final.set(idx, next)
  }
  const bullets: ExperienceBullet[] = []
  const emitted = new Set<number>()
  for (const bullet of current) {
    emitted.add(bullet.idx)
    bullets.push({ idx: bullet.idx, text: final.get(bullet.idx) ?? bullet.text })
  }
  for (const [idx, text] of final) {
    if (emitted.has(idx)) continue
    bullets.push({ idx, text })
  }
  const placed: string[] = []
  const still: string[] = []
  const blob = [...sourceOf.entries()].map(([idx, text]) => final.get(idx) ?? text).join("\n")
  for (const term of terms) {
    if (textHasTerm(blob, term)) placed.push(term)
    else still.push(term)
  }
  return { bullets, placed, unplaced: [...new Set([...unplaced, ...still])] }
}

/** Drop bullet edits that add an employer, a date, or contact. Added bullets are not kept. */
export function dropInventedExperienceEdits<E extends { bullets?: ExperienceBullet[]; added?: unknown[] }>(
  edits: E,
  sources: readonly ExperienceBullet[],
): { edits: E; removed: number } {
  const src = new Map(sources.map(s => [s.idx, s.text]))
  let removed = 0
  const bullets = (edits.bullets || []).filter(b => {
    const before = src.get(b.idx)
    if (before === undefined) return true
    if (inventedExperienceFrame(before, b.text || "")) { removed++; return false }
    return true
  })
  const added = edits.added || []
  removed += added.length
  return { edits: { ...edits, bullets, added: [] }, removed }
}

export function splitOverflowTerms(terms: readonly string[], summaryOpen: boolean): { skills: string[]; summary: string[] } {
  const summary = summaryOpen ? terms.filter(t => SOFT_SKILL.test(t)) : []
  const summarySet = new Set(summary.map(t => t.toLowerCase()))
  return { summary, skills: terms.filter(t => !summarySet.has(t.toLowerCase())) }
}

/** Append a labelled clause to the last skills line. Existing heading text stays at the front. */
export function labelledSkillEdit(lines: { idx: number; text: string }[], shown: readonly string[]): { idx: number; text: string } | null {
  const fresh = [...new Set(shown.map(s => s.trim()).filter(Boolean))].filter(term => !lines.some(line => textHasTerm(line.text, term)))
  if (!fresh.length || !lines.length) return null
  const prose = (text: string) => /^\s*[•\-–‣▪*·]/.test(text) || (text.split(/\s+/).length > 18 && (text.match(/,/g) || []).length < 2)
  const pool = lines.filter(line => !prose(line.text))
  const target = (pool.length ? pool : lines)[pool.length ? pool.length - 1 : lines.length - 1]
  const text = target.text.replace(/\s+$/, "")
  if (/job-post terms\s*:/i.test(text)) return { idx: target.idx, text: `${text}, ${fresh.join(", ")}` }
  const sep = /[,;:]$/.test(text) ? " " : ", "
  return { idx: target.idx, text: `${text}${sep}${JOB_POST_SKILL_LABEL}: ${fresh.join(", ")}` }
}

export function strengthsSummary(summary: string, terms: readonly string[]): string {
  const base = String(summary || "").trim()
  const fresh = [...new Set(terms.map(t => t.trim()).filter(Boolean))].filter(term => !textHasTerm(base, term))
  if (!base || !fresh.length) return base
  if (/strengths\s*:/i.test(base)) return `${base.replace(/[.\s]*$/, "")}, ${fresh.join(", ")}.`
  return `${base}${/[.!?]$/.test(base) ? "" : "."} Strengths: ${fresh.join(", ")}.`
}

/** Keep an Environments line labelled when a rewrite drops the prefix. */
export function keepEnvironmentsLabel(before: string, after: string): string {
  const source = String(before || "").replace(/^\s*[•\-*▪‣]\s*/, "")
  const label = source.match(/^(environments?\s*:)/i)
  if (!label) return after
  const glyph = String(before || "").match(/^\s*([•\-*▪‣]\s*)/)?.[1] || ""
  const body = String(after || "").replace(/^\s*[•\-*▪‣]\s*/, "")
  if (/^environments?\s*:/i.test(body)) return `${glyph}${body}`.trim()
  return `${glyph}${label[1]} ${body}`.trim()
}

/**
 * A rewrite that drops a term the source bullet already stated puts that term back on the same bullet.
 * It does not add a bullet, an employer, or a date.
 */
export function restoreMentionedTerms(before: string, after: string, terms: readonly string[], spell: (term: string) => string): string {
  let out = String(after || "")
  if (!out.trim()) return out
  for (const term of terms) {
    if (!textHasTerm(before, term) || textHasTerm(out, term)) continue
    out = `${out.replace(/\s+$/, "")} (${spell(term)})`
  }
  return out
}

export type ExperienceGroup = { header: string; paragraphs: number; environments: number }

/** Employer headers and the paragraph count under each, including a lead line and an Environments line. */
export function experienceFrame(text: string): ExperienceGroup[] {
  const lines = String(text || "").split(/\n/).map(line => line.trim()).filter(Boolean)
  const start = lines.findIndex(line => /^(professional experience|work experience|experience)$/i.test(line))
  const body = start >= 0 ? lines.slice(start + 1) : lines
  const groups: ExperienceGroup[] = []
  let current: ExperienceGroup | null = null
  for (const line of body) {
    if (/^(education|certifications?|projects|awards)$/i.test(line)) break
    const header = /\b(?:19|20)\d{2}\b/.test(line) && (line.includes("|") || /[—–-]/.test(line)) && !/^[•\-*]/.test(line)
    if (header) {
      current = { header: line, paragraphs: 0, environments: 0 }
      groups.push(current)
      continue
    }
    if (!current) continue
    current.paragraphs += 1
    if (/^([•\-*]\s*)?environments?\s*:/i.test(line)) current.environments += 1
  }
  return groups
}
