// Eshwar, 6 Nov 2026: before any resume edit, two passes generate related skills,
// experiences, points, bullets, skill lines, and a summary from the job post plus
// the candidate's existing work. Those keywords are summed, and that combined text
// is the JD the tailor updates against. If measured coverage is not above 95%, one
// more generate-then-tailor pass runs. Experience rows stay as they are. Terms that
// do not fit a role go on the summary and a labelled skills line.
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
 * A term that is only on the labelled skills line or the summary strengths line is not an
 * experience claim. A term that landed in an experience bullet still blocks delivery.
 */
export function unverifiedClaims(present: readonly string[], labelled: readonly string[], inExperience: (term: string) => boolean): string[] {
  const label = new Set(labelled.map(s => s.toLowerCase()))
  const out: string[] = []
  for (const term of present) {
    if (!term) continue
    if (inExperience(term) || !label.has(term.toLowerCase())) out.push(term)
  }
  return out
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
