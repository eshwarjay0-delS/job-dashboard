// A tailored resume used to go out with every rewrite the tailor made, unseen: the result page showed a flat before/after
// list, and the download and the apply copy always carried all of it. A line the person would not stand behind (a reworded
// duty, a JD term they never used) went to an employer under their name. Approved 23 Oct 2026 (owner: "add all"; behaviour
// seen at Tsenta, a diff before sending, and Enhancv, changes applied only when accepted): before a tailored resume is
// downloaded or used, the person sees what changed against the original, role by role and in the skills lines, keeps or
// undoes each change, and the file carries only what they kept.
//
// The same run showed a second blind spot (seen at LastRound AI): nobody could see what the tailor had READ. A job the
// parser merged into the one above it, or a role line with no dates, silently shapes every rewrite. parsedSource() is that
// reading, in the parser's own terms, with the slips worth checking named.
//
// Pure on purpose (no file, network or model): the change list is computed from two resume versions, so a test can hold
// it exactly, and the edit set that carries only the accepted changes is computed here, not in the page.
import type { Edits, Zones } from "./docx"

export type VersionLine = { idx?: number; key?: string; text: string }
/** One version of a resume, as far as tailoring can change it. */
export type ResumeVersion = {
  title: string
  tagline: string
  summary: string
  skills: VersionLine[]
  roles: { role: string; lines: VersionLine[] }[]
}
export type ChangeKind = "added" | "changed" | "removed"
export type ChangeArea = "title" | "tagline" | "summary" | "skills" | "role"
/** A job-description term a change brings into the resume, with the JD line it comes from when one is found. */
export type RequirementHit = { term: string; jd?: string }
export interface ResumeChange {
  id: string
  kind: ChangeKind
  area: ChangeArea
  role?: string
  roleIndex?: number
  before: string
  after: string
  /** JD terms the new line carries that the old one did not: the requirement this change answers, where known. */
  answers: RequirementHit[]
  /** Of those, the ones the original resume and the person's own statements never mention: keep only if true. */
  notInOriginal: string[]
  /** Figures in the new line that appear nowhere in the original resume: a number the tailor must not invent. */
  newNumbers: string[]
}
export type Covers = (text: string, terms: string[]) => Iterable<string>

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// Letter/number lookarounds, not \b: \b is ASCII-only and fires inside "C++" or a non-Latin word.
const termRe = (term: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.toLowerCase())}(?![\\p{L}\\p{N}])`, "u")
/** Case-insensitive whole-term match. The tailor passes its own matcher (coveredJdKeywords); this is the fallback. */
export const plainCovers: Covers = (text, terms) => {
  const low = (text || "").toLowerCase()
  return terms.filter(t => t.trim() && termRe(t.trim()).test(low))
}

/** The original as the parser read it. */
export function versionOfZones(z: Zones): ResumeVersion {
  return {
    title: z.header?.title || "",
    tagline: z.header?.tagline || "",
    summary: z.summaryText || "",
    skills: z.skills.map(s => ({ idx: s.idx, text: s.text })),
    roles: z.roles.map(r => ({ role: r.role, lines: r.bullets.map(b => ({ idx: b.idx, text: b.text })) })),
  }
}

/**
 * The resume once `edits` are applied, following applyRewrites in docx.ts: an edit lands only on a line the parser found,
 * a new bullet joins the role whose line it follows, and a dropped paragraph (one-page condense) is gone.
 */
export function versionAfterEdits(z: Zones, edits: Edits, dropped: Iterable<number> = []): ResumeVersion {
  const drop = new Set(dropped)
  const skill = new Map((edits.skills || []).filter(s => norm(s.text)).map(s => [s.idx, norm(s.text)] as [number, string]))
  const bullet = new Map((edits.bullets || []).filter(b => norm(b.text)).map(b => [b.idx, norm(b.text)] as [number, string]))
  const roleOf = new Map<number, number>()
  z.roles.forEach((r, i) => r.bullets.forEach(b => roleOf.set(b.idx, i)))
  const added = z.roles.map(() => [] as VersionLine[])
  ;(edits.added || []).forEach((a, k) => {
    const i = roleOf.get(a.after)
    if (i !== undefined && norm(a.text)) added[i].push({ key: `added:${k}`, text: norm(a.text) })
  })
  const title = norm(edits.headline?.title || "")
  const tagline = norm(edits.headline?.tagline || "")
  const summary = norm(edits.summary || "")
  return {
    title: z.header && title ? title : z.header?.title || "",
    tagline: z.header && tagline ? tagline : z.header?.tagline || "",
    summary: z.summaryIdx !== null && summary ? summary : z.summaryText || "",
    skills: z.skills.filter(s => !drop.has(s.idx)).map(s => ({ idx: s.idx, text: skill.get(s.idx) ?? s.text })),
    roles: z.roles.map((r, i) => ({
      role: r.role,
      lines: [...r.bullets.filter(b => !drop.has(b.idx)).map(b => ({ idx: b.idx, text: bullet.get(b.idx) ?? b.text })), ...added[i]],
    })),
  }
}

function wholeText(v: ResumeVersion): string {
  return [v.title, v.tagline, v.summary, ...v.skills.map(s => s.text), ...v.roles.flatMap(r => [r.role, ...r.lines.map(l => l.text)])].join("\n")
}

// A figure standing on its own ("40%", "$2M", "12", "10+"), not the digit inside a name such as S3, AZ-500 or 5G.
const NUMBER_RE = /(?<![\p{L}\p{N}.\-/])\$?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|\+|[kKmMbB](?!\p{L})|x(?!\p{L})))?(?![\p{L}\p{N}])/gu
const numbersIn = (s: string) => [...new Set((s.match(NUMBER_RE) || []).map(n => n.replace(/\s+/g, "").replace(/,/g, "").toLowerCase()))]

/** The JD sentence a term comes from, so "answers Splunk" can say which requirement asked for it. */
function jdLineFor(jd: string, term: string): string | undefined {
  if (!jd) return undefined
  const re = termRe(term)
  const line = jd.split(/\n+|(?<=[.;!?])\s+/).map(norm).find(s => s && re.test(s.toLowerCase()))
  return line ? (line.length > 180 ? `${line.slice(0, 177)}...` : line) : undefined
}

/**
 * Every line that differs between two versions of a resume: added, changed or removed, in the header, the summary, the
 * skills lines and each role. Lines are paired by their paragraph index when both carry one (the tailor never moves a
 * paragraph), else by identical text, so an unchanged line is never reported.
 */
export function resumeChanges(before: ResumeVersion, after: ResumeVersion, opts: {
  requirements?: string[]; jd?: string; evidence?: string; covers?: Covers
} = {}): ResumeChange[] {
  const reqs = [...new Set((opts.requirements || []).map(r => r.trim()).filter(Boolean))]
  const covers = (text: string) => new Set(reqs.length ? opts.covers ? opts.covers(text, reqs) : plainCovers(text, reqs) : [])
  const original = [wholeText(before), opts.evidence || ""].join("\n")
  const known = covers(original)
  const originalNumbers = new Set(numbersIn(original))
  const out: ResumeChange[] = []
  const push = (c: Omit<ResumeChange, "answers" | "notInOriginal" | "newNumbers">) => {
    const was = covers(c.before)
    const answers = c.kind === "removed" ? [] : [...covers(c.after)].filter(t => !was.has(t))
    out.push({
      ...c,
      answers: answers.map(term => {
        const jd = jdLineFor(opts.jd || "", term)
        return jd ? { term, jd } : { term }
      }),
      notInOriginal: answers.filter(t => !known.has(t)),
      newNumbers: c.kind === "removed" ? [] : numbersIn(c.after).filter(n => !originalNumbers.has(n)),
    })
  }
  const single = (area: "title" | "tagline" | "summary", b: string, a: string) => {
    if (norm(b) === norm(a)) return
    push({ id: area, area, kind: !norm(b) ? "added" : !norm(a) ? "removed" : "changed", before: norm(b), after: norm(a) })
  }
  single("title", before.title, after.title)
  single("tagline", before.tagline, after.tagline)
  single("summary", before.summary, after.summary)

  const lines = (b: VersionLine[], a: VersionLine[], prefix: string, scope: Pick<ResumeChange, "area" | "role" | "roleIndex">) => {
    const afterIdx = new Map(a.filter(l => l.idx !== undefined).map(l => [l.idx as number, l]))
    const freeAfter = a.filter(l => l.idx === undefined)
    const usedFree = new Set<VersionLine>()
    let n = 0
    for (const l of b) {
      if (l.idx !== undefined && afterIdx.has(l.idx)) {
        const now = afterIdx.get(l.idx)!
        afterIdx.delete(l.idx)
        if (norm(now.text) !== norm(l.text)) push({ id: `${prefix}:${l.idx}`, kind: "changed", ...scope, before: norm(l.text), after: norm(now.text) })
        continue
      }
      const same = freeAfter.find(f => !usedFree.has(f) && norm(f.text) === norm(l.text))
      if (same) { usedFree.add(same); continue }
      push({ id: l.idx !== undefined ? `${prefix}:${l.idx}` : `${prefix}:${scope.roleIndex ?? "s"}:removed:${n++}`, kind: "removed", ...scope, before: norm(l.text), after: "" })
    }
    for (const l of a) {
      if (l.idx !== undefined ? !afterIdx.has(l.idx) : usedFree.has(l)) continue
      push({ id: l.key || (l.idx !== undefined ? `${prefix}:${l.idx}` : `${prefix}:${scope.roleIndex ?? "s"}:added:${n++}`), kind: "added", ...scope, before: "", after: norm(l.text) })
    }
  }
  lines(before.skills, after.skills, "skill", { area: "skills" })

  // Roles pair by their own line (employer, title, dates), then by position: the tailor never edits a role line.
  const usedAfter = new Set<number>()
  const pairOf = before.roles.map((r, i) => {
    let j = after.roles.findIndex((x, k) => !usedAfter.has(k) && norm(x.role) === norm(r.role))
    if (j < 0 && i < after.roles.length && !usedAfter.has(i)) j = i
    if (j >= 0) usedAfter.add(j)
    return j
  })
  before.roles.forEach((r, i) => {
    const j = pairOf[i]
    lines(r.lines, j >= 0 ? after.roles[j].lines : [], "bullet", { area: "role", role: norm(r.role), roleIndex: i })
  })
  after.roles.forEach((r, j) => {
    if (!usedAfter.has(j)) lines([], r.lines, "bullet", { area: "role", role: norm(r.role), roleIndex: before.roles.length + j })
  })
  return out
}

/**
 * The tailor's edits cut down to the changes the person kept. A change not kept leaves the original line exactly as it was
 * (its paragraph is not rewritten at all); a kept removal is the only way a paragraph is dropped.
 */
export function acceptedEdits(edits: Edits, changes: ResumeChange[], accepted: Iterable<string>, dropped: Iterable<number> = []): { edits: Edits; dropIdx: number[] } {
  const byId = new Map(changes.map(c => [c.id, c]))
  const kept = new Set([...accepted].filter(id => byId.has(id)))
  const keeps = (id: string, kind: ChangeKind) => kept.has(id) && byId.get(id)!.kind === kind
  const head = (id: "title" | "tagline") => kept.has(id) && byId.get(id)!.kind !== "removed" ? edits.headline?.[id] || "" : ""
  return {
    edits: {
      headline: { title: head("title"), tagline: head("tagline") },
      summary: keeps("summary", "changed") || keeps("summary", "added") ? edits.summary || "" : "",
      skills: (edits.skills || []).filter(s => keeps(`skill:${s.idx}`, "changed")),
      bullets: (edits.bullets || []).filter(b => keeps(`bullet:${b.idx}`, "changed")),
      extras: [],
      added: (edits.added || []).filter((_, k) => keeps(`added:${k}`, "added")),
    },
    dropIdx: [...new Set(dropped)].filter(i => keeps(`bullet:${i}`, "removed") || keeps(`skill:${i}`, "removed")),
  }
}

// ── What the tailor read ───────────────────────────────────────────────────────────────────────────────────────────
export type ParsedRole = { role: string; dates: string; months: number | null; current: boolean; bullets: string[] }
export interface ParsedSource {
  header: { name: string; title: string; tagline: string } | null
  summary: string
  skills: string[]
  roles: ParsedRole[]
  other: { section: string; lines: string[] }[]
  /** The plain text extracted from the file, which the keyword checks read. Capped so a result stays small. */
  text: string
  /** Parsing slips worth checking before trusting the result, in plain words. */
  warnings: string[]
}

const DATE_SPAN = /(?:[A-Za-z]{3,9}\.?\s+)?(?:\d{1,2}\/)?(?:19|20)\d{2}\s*(?:[–—-]|to)\s*(?:(?:[A-Za-z]{3,9}\.?\s+)?(?:\d{1,2}\/)?(?:19|20)\d{2}|present|current|now|till date|date)/i
const ONE_DATE = /(?:[A-Za-z]{3,9}\.?\s+)?(?:\d{1,2}\/)?(?:19|20)\d{2}/
export const TEXT_CAP = 30000

/** Dates as they stand on a role line, e.g. "Jul 2023 – Present". Empty when the parser found none. */
export function datesOf(roleLine: string): string {
  const t = norm(roleLine)
  return norm((t.match(DATE_SPAN) || t.match(ONE_DATE) || [""])[0])
}

/**
 * The resume as the parser read it: header, summary, skills lines, each role with its dates and lines, and the sections
 * tailoring does not touch. `spanOf` is docx.ts's roleSpanMonths (passed in so this module stays free of file code).
 */
export function parsedSource(z: Zones, text: string, spanOf?: (role: string) => number | null): ParsedSource {
  const warnings: string[] = []
  const roles: ParsedRole[] = z.roles.map(r => ({
    role: norm(r.role), dates: datesOf(r.role), months: spanOf ? spanOf(r.role) : null, current: !!r.current, bullets: r.bullets.map(b => norm(b.text)),
  }))
  if (!z.header) warnings.push("Your name and contact line was not recognised, so the header title was not tailored.")
  if (!norm(z.summaryText)) warnings.push("No summary paragraph was found, so the summary was not tailored.")
  if (!z.skills.length) warnings.push("No skills section was found, so no skills line was tailored.")
  if (!roles.length) warnings.push("No jobs were found under an experience heading, so no role was tailored.")
  for (const r of roles) {
    const name = r.role.length > 70 ? `${r.role.slice(0, 67)}...` : r.role
    if (/^(experience|projects)$/i.test(r.role)) warnings.push(`${r.bullets.length} line(s) were read with no job title above them (filed under "${r.role}").`)
    else if (!r.dates) warnings.push(`"${name}": no dates were found on this job line. Check it is really where a job starts.`)
    if (r.bullets.length === 1) warnings.push(`"${name}": only one line was read under this job, so the tailor treats it as a stray line.`)
    for (const b of r.bullets) {
      if (DATE_SPAN.test(b) && b.length <= 160) warnings.push(`"${b.length > 80 ? `${b.slice(0, 77)}...` : b}" was read as a line of "${name}", but it carries dates. It may be a separate job the parser merged into the one above.`)
    }
  }
  const other: ParsedSource["other"] = []
  for (const e of z.extras || []) {
    const last = other[other.length - 1]
    if (last && last.section === e.section) last.lines.push(norm(e.text))
    else other.push({ section: e.section, lines: [norm(e.text)] })
  }
  const plain = (text || "").trim()
  return {
    header: z.header ? { name: norm(z.header.name), title: norm(z.header.title), tagline: norm(z.header.tagline) } : null,
    summary: norm(z.summaryText),
    skills: z.skills.map(s => norm(s.text)),
    roles,
    other,
    text: plain.length > TEXT_CAP ? `${plain.slice(0, TEXT_CAP)}\n[... cut at ${TEXT_CAP} characters]` : plain,
    warnings,
  }
}

/** What the result page shows before download: the reading, the change list, and the paragraphs a one-page condense dropped. */
export interface TailorReview { source: ParsedSource; changes: ResumeChange[]; dropped: number[] }

export function tailorReview(o: {
  zones: Zones; text: string; edits: Edits; dropped?: number[]; requirements?: string[]; jd?: string; evidence?: string
  covers?: Covers; spanOf?: (role: string) => number | null
}): TailorReview {
  const dropped = [...new Set(o.dropped || [])]
  return {
    source: parsedSource(o.zones, o.text, o.spanOf),
    changes: resumeChanges(versionOfZones(o.zones), versionAfterEdits(o.zones, o.edits, dropped), {
      requirements: o.requirements, jd: o.jd, evidence: o.evidence, covers: o.covers,
    }),
    dropped,
  }
}
