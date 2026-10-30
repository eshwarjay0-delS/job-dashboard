/* eslint-disable @typescript-eslint/no-explicit-any */
// planSkillsLine: replaces the "I did not send a file ... not in your resume" refusal.
// Every job-post term the resume lacks (after junk filtering) goes onto ONE labelled skills line.
// Never into experience bullets. Name/contact/dates are never touched (checked by roundTripGuard).
import { buildKeywordReport, normTerm } from './resume-keyword-report.ts'
import { checkRoundTrip } from './resume-round-trip-guard.ts'

export const JOB_POST_LABEL = 'Job-post terms'

// Words of a job post that are not skills: work status, clearance, degree, benefits, place, rank, filler.
const STATUS = new Set(['gc', 'ead', 'gc ead', 'h1', 'h1b', 'h 1b', 'h 1', 'opt', 'cpt', 'stem opt', 'tn', 'l1', 'l2', 'h4', 'h4 ead',
  'usc', 'us citizen', 'citizen', 'green card', 'w2', 'c2c', 'corp to corp', '1099', 'ts', 'sci', 'ts sci', 'secret', 'top secret',
  'poly', 'public trust', 'clearance', 'security clearance', 'visa', 'sponsorship'])
const FILLER = new Set(['candidates', 'candidate', 'applicants', 'applicant', 'experience', 'years', 'year', 'team', 'teams', 'role',
  'position', 'job', 'ability', 'strong', 'excellent', 'required', 'preferred', 'plus', 'must', 'responsibilities', 'requirements',
  'qualifications', 'skills', 'knowledge', 'work', 'company', 'client', 'we', 'you', 'our'])
const PLACE = new Set(['remote', 'hybrid', 'onsite', 'on site', 'usa', 'us', 'united states'])
const RANK = new Set(['senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'manager', 'director', 'intern', 'head', 'vp'])
const BENEFIT = /\b(?:medical|dental|vision|401 ?k|pto|paid time off|holidays?|wellness|tuition|equal opportunity|benefits?)\b/
const DEGREE = /\b(?:degree|bachelor s?|master s?|bs|ba|bsc|ms|msc|mba|phd|diploma|ged)\b/
const CLEARANCE = /\b(?:clearance|citizen\w*|visa|sponsorship|green card|polygraph)\b/
// Tokens the round-trip guard would read as a date, phone, email or link: never written onto a resume.
const GUARD_TOKEN = /\b(?:19|20)\d{2}\b|\d{3}[\s.-]?\d{3,4}|@|https?:\/\/|www\.|\.com\b/i

const STATUS_COMPACT = new Set([...STATUS].map(x => x.replace(/ /g, '')))
const PAY = /[$€£₹]\s?\d|\b\d+\s?k\b|\/\s?(?:hr|hour|yr|year)\b|\bper (?:hour|annum|year)\b|\bsalary\b/i
const WORKPLACE = /^(?:remote|hybrid|on ?site|in office)\b.*\b(?:in|from|at|days?|weeks?|us|usa|office|only|first)\b|^(?:remote|hybrid|on ?site)\s*(?:\d|$)/
const AUTH = /\bauthori[sz](?:ed|ation) to work\b|\bwork authori[sz]ation\b|\bright to work\b/
/** A term that would trip the round-trip guard (date, phone, email, link). Never written, named in the caption. */
export const isGuardUnsafe = (term: unknown): boolean => GUARD_TOKEN.test(String(term ?? ''))
export const cleanTerm = (t: unknown): string => (typeof t === 'string' || typeof t === 'number') ? String(t).replace(/[\s\u00a0]+/g, ' ').trim() : ''

export function isJunkTerm(term: unknown): boolean {
  const raw = cleanTerm(term)
  const n = normTerm(raw)
  if (!n || n.length < 2) return true
  if (GUARD_TOKEN.test(raw)) return true
  if (STATUS_COMPACT.has(n.replace(/ /g, '')) || PAY.test(raw) || WORKPLACE.test(n) || AUTH.test(n)) return true
  if (/\d/.test(n) && /\b(?:years?|yrs?|months?|weeks?|days?|hours?|fy)\b|^\d+\s|^fy/.test(n)) return true
  if (/^\d+$/.test(n)) return true
  if (STATUS.has(n) || FILLER.has(n) || PLACE.has(n) || RANK.has(n)) return true
  if (BENEFIT.test(n) || DEGREE.test(n) || CLEARANCE.test(n)) return true
  return n.split(' ').every(w => FILLER.has(w) || RANK.has(w))
}


/**
 * Policy switches. Each of Eshwar's two open questions is ONE value here.
 *  enabled          false = old behavior: refuse ("unverified_jd_terms") when any kept term is missing.
 *  labelInFile      Q1. false (default) = label only in the WhatsApp caption; terms join the last skills line.
 *                       true = write a separate "Job-post terms: ..." line in the Skills section.
 *  addSkillsSection Q2. false (default) = never add a section to a resume with no Skills heading
 *                       terms are listed in the caption. true = add the labelled line before Experience.
 *  captionUnplaced  true = a file whose terms could not be placed (locked / no section) is still sent,
 *                       with the terms listed in the caption. false = hold it.
 *  maxTermsPerLine  cap per labelled line; longer lists split into several labelled lines (all terms land).
 */
export type SkillsPolicy = { enabled: boolean, labelInFile: boolean, addSkillsSection: boolean, captionUnplaced: boolean, maxTermsPerLine: number }
export const DEFAULT_POLICY: Readonly<SkillsPolicy> = Object.freeze({
  enabled: true, labelInFile: false, addSkillsSection: false, captionUnplaced: true, maxTermsPerLine: 25,
})

const SKILL_NAMES = 'skills|technical skills|core skills|key skills|core competencies|competencies|technologies|technical proficiencies|proficiencies|tech(?:nical)? stack|tools|skills\\s*(?:&|and)\\s*(?:tools|technologies|abilities)|areas of expertise'
const EXP_NAMES = 'experience|work experience|professional experience|relevant experience|employment|employment history|work history|career history|professional history'
const HEADING = new RegExp(`^(?:summary|profile|professional summary|objective|${SKILL_NAMES}|${EXP_NAMES}|education|certifications?|projects|awards|publications|languages|interests|references|volunteer\\w*)\\s*:?\\s*$`, 'i')
const SKILLS_HEADING = new RegExp(`^(?:${SKILL_NAMES})\\s*:?\\s*$`, 'i')
// "Skills: Python, SQL" on one line (heading + content). 'tools' alone is excluded: "Tools: Jira" inside a role is not a section.
const SKILLS_INLINE = new RegExp(`^(?:${SKILL_NAMES.replace('|tools|', '|')})\\s*:\\s*\\S`, 'i')
const EXPERIENCE_HEADING = new RegExp(`^(?:${EXP_NAMES})\\s*:?\\s*$`, 'i')
const BULLET = /^\s*(?:[•\-*▪‣◦●–—]|\d+[.)])\s+/

type Section = { start: number, end: number, last: number, inline?: boolean }
function section(lines: string[], headingRe: RegExp, { stopAtBlank = false } = {}): Section | null {
  const s = lines.findIndex(l => headingRe.test(l.trim()))
  if (s < 0) return null
  let end = s, last = s; // end = last line before the next heading; last = last non-blank content line
  for (let i = s + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (HEADING.test(t) || SKILLS_INLINE.test(t) && headingRe !== SKILLS_HEADING && !lines[i - 1].trim()) break; // inline skills after a blank = new section
    if (!t && stopAtBlank && last > s) break
    end = i; if (t) last = i
  }
  return { start: s, end, last }
}
// Skills section: a heading line + content up to the first blank line, or one inline "Skills: a, b" line.
function skillsSection(lines: string[]): Section | null {
  const h = section(lines, SKILLS_HEADING, { stopAtBlank: true })
  // inline line counts as a section only when it starts a block (first line or after a blank), not "Technologies: Java" under a role
  const iInline = lines.findIndex((l, i) => SKILLS_INLINE.test(l.trim()) && (i === 0 || !lines[i - 1].trim()))
  if (h && (iInline < 0 || h.start < iInline)) return h
  if (iInline < 0) return null
  let last = iInline; // continuation lines directly under an inline skills line
  for (let i = iInline + 1; i < lines.length; i++) { const t = lines[i].trim(); if (!t || HEADING.test(t) || BULLET.test(lines[i])) break; last = i; }
  return { start: iInline, end: last, last, inline: true }
}
const hasSkillsSection = (text: unknown) => !!skillsSection(String(text ?? '').split('\n'))
const chunk = <T,>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; }

function captionFor({ placed, unplaced, reason, labelInFile, guardUnsafe = [] }:
  { placed: string[], unplaced: string[], reason: string, labelInFile: boolean, guardUnsafe?: string[] }): string {
  const parts: string[] = []
  if (placed.length) parts.push(`Added to your skills from the job post${labelInFile ? ` (labelled "${JOB_POST_LABEL}")` : ''}: ${placed.join(', ')}. Check you can speak to each.`)
  if (unplaced.length) {
    const why = reason === 'skills_locked' ? 'you asked me not to edit your skills' : 'your resume has no skills section'
    parts.push(`Not added to the file because ${why}: ${unplaced.join(', ')}. Add any you can speak to.`)
  }
  if (guardUnsafe.length) parts.push(`Not written into the file because it would read as a date or contact detail: ${guardUnsafe.join(', ')}. Add it yourself if it applies.`)
  return parts.join('\n')
}

/**
 * @param {object} a
 * @param {string[]} a.jobTerms       terms from the job post (incl. a "known JD" the user built)
 * @param {string}   a.resumeText     text the terms are checked against (source, or the reverted draft)
 * @param {string[]} [a.supportedTerms] the candidate's own words
 * @param {boolean}  [a.skillsLocked] skills section must not be edited
 * @param {string}   [a.sourceText]   original resume for the round-trip guard (defaults to resumeText)
 * @param {string}   [a.exportedText] the file that would be sent (defaults to applySkillsPlan output)
 * @param {object}   [a.options]      overrides DEFAULT_POLICY
 * @returns plan: {send, reason, blockedBy, addedTerms, unplacedTerms, fromCandidateWords, fromJobPostOnly,
 *                 skillsLine, skillsLines, placement, caption, filteredOut, guardProblems, report, policy}
 */
export type SkillsPlanArgs = { jobTerms?: unknown, resumeText?: string, supportedTerms?: string[], skillsLocked?: boolean,
  sourceText?: string, exportedText?: string, options?: Partial<SkillsPolicy> | null }
export function planSkillsLine({ jobTerms = [], resumeText = '', supportedTerms = [], skillsLocked = false,
  sourceText, exportedText, options = {} }: SkillsPlanArgs = {}): any {
  const policy = { ...DEFAULT_POLICY, ...(options ?? {}) }
  const filteredOut: string[] = [], kept: string[] = []
  for (const t of (Array.isArray(jobTerms) ? jobTerms : []) as unknown[]) {
    const c = cleanTerm(t)
    if (!c) continue
    ;(isJunkTerm(c) ? filteredOut : kept).push(c)
  }
  const hayN = ` ${normTerm(resumeText)} `
  const guardUnsafeTerms = policy.enabled ? [...new Map(filteredOut.filter(t => isGuardUnsafe(t) && !/@|https?:|www\./i.test(t) && !hayN.includes(` ${normTerm(t)} `)).map(t => [normTerm(t), t])).values()] : []
  const report = buildKeywordReport({ jobTerms: kept, resumeText, supportedTerms })
  const gap = new Set([...report.supportedGap, ...report.unsupportedGap].map(normTerm))
  const seen = new Set<string>()
  const gapTerms = kept.filter(t => { const n = normTerm(t); if (!gap.has(n) || seen.has(n)) return false; seen.add(n); return true; })
  const sup = new Set(report.supportedGap.map(normTerm))

  let reason: string, placement: string, placed: string[] = [], unplaced: string[] = []
  if (!policy.enabled) {
    reason = gapTerms.length ? 'unverified_jd_terms' : 'nothing_missing'; placement = 'none'
  } else if (!gapTerms.length) {
    reason = 'nothing_missing'; placement = 'none'
  } else if (skillsLocked) {
    reason = 'skills_locked'; placement = 'none'; unplaced = gapTerms
  } else if (!hasSkillsSection(resumeText) && !policy.addSkillsSection) {
    reason = 'no_skills_section'; placement = 'none'; unplaced = gapTerms
  } else {
    reason = 'placed'; placed = gapTerms
    placement = !hasSkillsSection(resumeText) ? 'new_line_before_experience' : policy.labelInFile ? 'labelled_line' : 'append_last_skills_line'
  }
  const per = Math.max(1, policy.maxTermsPerLine | 0 || 25)
  const skillsLines = gapTerms.length ? chunk(gapTerms, per).map(c => `${JOB_POST_LABEL}: ${c.join(', ')}`) : []
  const plan: any = {
    send: true, reason, blockedBy: null, placement,
    addedTerms: placed, unplacedTerms: unplaced,
    fromCandidateWords: placed.filter(t => sup.has(normTerm(t))),
    fromJobPostOnly: placed.filter(t => !sup.has(normTerm(t))),
    skillsLine: skillsLines[0] ?? null, skillsLines,
    filteredOut, guardUnsafeTerms, guardProblems: [], report, policy,
  }
  plan.caption = policy.enabled ? captionFor({ placed, unplaced, reason, labelInFile: policy.labelInFile, guardUnsafe: guardUnsafeTerms }) : ''

  if (!policy.enabled && gapTerms.length) { plan.send = false; plan.blockedBy = 'policy'; return plan; }
  const file = exportedText ?? applySkillsPlan(resumeText, plan)
  const rt = checkRoundTrip(sourceText ?? resumeText, file)
  if (!rt.ok) { plan.send = false; plan.blockedBy = 'round_trip'; plan.guardProblems = rt.problems; return plan; }
  if (unplaced.length && !policy.captionUnplaced) { plan.send = false; plan.blockedBy = 'policy'; }
  return plan
}

/** Writes the plan into the text. Only the Skills section changes; every other line stays byte-for-byte. */
export function applySkillsPlan(resumeText: unknown, plan: any): string {
  const text = String(resumeText ?? '')
  if (!plan || !plan.addedTerms?.length || plan.placement === 'none' || plan.send === false && plan.blockedBy === 'policy') return text
  const lines = text.split('\n')
  const sk = skillsSection(lines)
  const per = Math.max(1, plan.policy?.maxTermsPerLine | 0 || 25)
  const labelled = chunk(plan.addedTerms, per).map(c => `${JOB_POST_LABEL}: ${c.join(', ')}`)
  if (sk) {
    if (plan.placement === 'append_last_skills_line' && (sk.last > sk.start || sk.inline)) {
      const l = lines[sk.last].replace(/\s+$/, '')
      const sep = /[,;:]$/.test(l) ? ' ' : ', '
      lines[sk.last] = l + sep + plan.addedTerms.join(', ') + lines[sk.last].slice(l.length)
      return lines.join('\n')
    }
    lines.splice(sk.last + 1, 0, ...labelled)
    return lines.join('\n')
  }
  // No Skills section (only when addSkillsSection is on): before Experience, never inside a role.
  const e = lines.findIndex(l => EXPERIENCE_HEADING.test(l.trim()))
  if (e >= 0) { lines.splice(e, 0, ...labelled, ''); return lines.join('\n'); }
  const tail = lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
  lines.splice(tail, 0, ...labelled)
  return lines.join('\n')
}

const tokens = (s: string) => new Set(normTerm(s.replace(BULLET, '')).split(' ').filter(Boolean))
function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0
  let n = 0; for (const x of A) if (B.has(x)) n++
  return n / (A.size + B.size - n)
}
const mentions = (line: string, t: string) => ` ${normTerm(line)} `.includes(` ${normTerm(t)} `)

/**
 * Bullet revert: an experience bullet in the writer's draft that contains a job-post-only term (not in the
 * source, not backed by the candidate's words) goes back to its source text; a brand-new bullet is dropped.
 * Bullets that don't carry such a term keep the writer's edit.
 */
export type RevertedBullet = { from: string, to: string | null, terms: string[] }
export function revertBullets(sourceText: unknown, draftText: unknown, terms: string[]): { text: string, reverted: RevertedBullet[] } {
  const src = String(sourceText ?? '').split('\n'), out = String(draftText ?? '').split('\n')
  const reverted: RevertedBullet[] = []
  if (!terms.length) return { text: out.join('\n'), reverted }
  // Experience range; if no experience heading is recognised, every bullet outside the Skills section counts.
  const range = (lines: string[]) => {
    const e = section(lines, EXPERIENCE_HEADING)
    if (e) return (i: number) => i > e.start && i <= e.end
    const sk = skillsSection(lines)
    return (i: number) => !sk || i < sk.start || i > sk.end
  }
  const inS = range(src), inD = range(out)
  const srcBullets = src.filter((l, i) => inS(i) && BULLET.test(l))
  const srcSet = new Set(srcBullets)
  const used = new Set<number>()
  const dIdx = out.map((l, i) => i).filter(i => inD(i) && BULLET.test(out[i]))
  const sameCount = dIdx.length === srcBullets.length
  const drop: number[] = []
  dIdx.forEach((i, k) => {
    const line = out[i]
    const hit = terms.filter(t => mentions(line, t))
    if (!hit.length || srcSet.has(line)) return
    // best textual match first (handles reordered bullets); position only as a fallback
    let best = -1, bs = 0.3
    srcBullets.forEach((b, j) => { if (used.has(j)) return; const sc = similarity(line, b); if (sc > bs) { bs = sc; best = j; } })
    if (best < 0 && sameCount && !used.has(k)) best = k
    if (best >= 0 && hit.every(t => !mentions(srcBullets[best], t))) {
      used.add(best); out[i] = srcBullets[best]; reverted.push({ from: line, to: srcBullets[best], terms: hit })
    } else { drop.push(i); reverted.push({ from: line, to: null, terms: hit }); }
  })
  for (const i of drop.sort((a, b) => b - a)) out.splice(i, 1);
  return { text: out.join('\n'), reverted }
}

/**
 * Full send decision for one tailored file.
 * 1. Revert writer bullets that carry job-post-only terms.  2. If skills are locked, the Skills section is
 * restored to the source's.  3. Plan + apply the skills line.  4. Round-trip guard vs the source.
 */
export type DeliverArgs = { jobTerms?: unknown, sourceText?: string, draftText?: string, supportedTerms?: string[], skillsLocked?: boolean, options?: Partial<SkillsPolicy> | null }
export function deliver({ jobTerms = [], sourceText = '', draftText, supportedTerms = [], skillsLocked = false, options = {} }: DeliverArgs = {}): any {
  const policy = { ...DEFAULT_POLICY, ...(options ?? {}) }
  const draft = draftText ?? sourceText
  const kept = ((Array.isArray(jobTerms) ? jobTerms : []) as unknown[]).map(cleanTerm).filter(t => t && !isJunkTerm(t))
  const srcReport = buildKeywordReport({ jobTerms: kept, resumeText: sourceText, supportedTerms })
  let { text, reverted } = revertBullets(sourceText, draft, srcReport.unsupportedGap)
  if (skillsLocked) text = restoreSkills(sourceText, text)
  const plan = planSkillsLine({ jobTerms, resumeText: text, supportedTerms, skillsLocked, sourceText, options: policy })
  const final = plan.send || plan.blockedBy !== 'policy' ? applySkillsPlan(text, plan) : text
  return { send: plan.send, reason: plan.reason, blockedBy: plan.blockedBy, text: final, caption: plan.caption,
    revertedBullets: reverted, guardProblems: plan.guardProblems, plan }
}

function restoreSkills(sourceText: string, text: string): string {
  const src = String(sourceText).split('\n'), out = String(text).split('\n')
  const s = skillsSection(src), d = skillsSection(out)
  if (!s || !d) return text
  out.splice(d.start, d.end - d.start + 1, ...src.slice(s.start, s.end + 1))
  return out.join('\n')
}
