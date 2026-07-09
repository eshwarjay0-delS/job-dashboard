// ─────────────────────────────────────────────────────────────────────────────
// Resume-quality rules — the 10 CLAUDE.md defects, as pure, dependency-free
// validators + safe fixers.
//
// Used by THREE surfaces so they all agree on "what good looks like":
//   1. Tailor post-process (claude.ts) — auto-fix the safe text rules on AI output.
//   2. Builder live warnings (ResumeBuilder) — flag issues as the user types.
//   3. Round-trip testing scorecard (TODO.md) — deterministic pass/fail per run.
//
// NO imports, NO DOM, NO Node APIs — pure functions only, so it runs anywhere and
// is trivially unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = "error" | "warn"
export interface RuleIssue { rule: string; severity: Severity; message: string }

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length
const capitalizeFirst = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Public word counter — shared by the builder's page estimate so it can't drift. */
export function countWords(text: string): number {
  return wordCount(text)
}

// ── Rule 1 — Ban the "Having …" opener (the #1 AI fingerprint) ────────────────
export function hasHavingOpener(summary: string): boolean {
  return /^\s*having\b/i.test(summary || "")
}

/**
 * Rewrite a "Having X years …" opener into a clean "<Title> with X years …" form,
 * conservatively. Never produces broken English: if it can't confidently rewrite,
 * it falls back to simply dropping the leading "Having " and re-capitalizing.
 */
export function fixHavingOpener(
  summary: string,
  opts: { title?: string; years?: string } = {},
): string {
  const s = (summary || "").trim()
  if (!hasHavingOpener(s)) return s

  // Pattern: "Having 8 years of experience in cloud security, <rest>"
  const m = s.match(/^having\s+(\d+\+?)\s+years?\s+(?:of\s+)?(?:experience|exp)\b[^,.]*[,.]?\s*(.*)$/i)
  if (m) {
    const years = (opts.years || m[1]).replace(/\+$/, "")
    const rest = capitalizeFirst(m[2].trim())
    const lead = opts.title
      ? `${opts.title} with ${years}+ years of experience.`
      : `Professional with ${years}+ years of experience.`
    return rest ? `${lead} ${rest}` : lead
  }

  // Fallback: drop the leading "Having " and re-capitalize the remainder.
  const dropped = s.replace(/^having\s+/i, "")
  return capitalizeFirst(dropped)
}

// ── Rule 2 — Summary = ONE paragraph, ≤ 80 words ──────────────────────────────
export function summaryWordCount(summary: string): number {
  return wordCount(summary || "")
}

export function summaryIsConcatenated(summary: string): boolean {
  // Tell-tale concat artifacts: a period glued to the next capital with no space,
  // or multiple paragraph breaks (the spec's "environments.Proven" bug).
  return /[a-z]\.[A-Z]/.test(summary || "") || /\n\s*\n/.test(summary || "")
}

/** Trim a too-long summary to the last full sentence that fits within `max` words. */
export function clampSummary(summary: string, max = 80): string {
  const s = (summary || "").replace(/\s*\n\s*/g, " ").replace(/([a-z])\.([A-Z])/g, "$1. $2").trim()
  if (wordCount(s) <= max) return s
  const sentences = s.match(/[^.!?]+[.!?]+/g) || [s]
  let out = ""
  for (const sent of sentences) {
    if (wordCount((out + " " + sent).trim()) > max) break
    out = (out + " " + sent).trim()
  }
  // If even the first sentence is over the limit, hard-cut at the word boundary.
  if (!out) out = s.split(/\s+/).slice(0, max).join(" ")
  return out
}

// ── Rule 4 — Every bullet carries a quantifier ────────────────────────────────
export function bulletHasMetric(bullet: string): boolean {
  const b = bullet || ""
  // A digit, percentage, money, multiplier (3x), or magnitude word counts as a metric.
  return /\d/.test(b) || /%|\$/.test(b) || /\b\d+\s*x\b/i.test(b) ||
    /\b(thousand|million|billion|hundreds?|dozens?)\b/i.test(b)
}

// ── Rule 5 — Lead with strong action verbs (no weak/passive openers) ───────────
const WEAK_OPENER = /^\s*(responsible for|responsible|worked on|worked|helped|assisted|involved in|involved|participated in|participated|part of|member of|duties included|duties|tasked with|tasked|in charge of)\b/i

/** True if a bullet opens with a weak/passive verb recruiters discount. */
export function bulletHasWeakOpener(bullet: string): boolean {
  return WEAK_OPENER.test(bullet || "")
}

// ── Rule 3 — 4–6 bullets per job ──────────────────────────────────────────────
export function bulletCountStatus(n: number): "ok" | "low" | "high" {
  if (n > 6) return "high"
  if (n < 4) return "low"
  return "ok"
}

// ── Rule 9 — No duplicate skills across categories ────────────────────────────
/** Returns each skill token (case-insensitive) that appears in more than one group. */
export function findDuplicateSkills(skillGroups: { skills: string }[]): string[] {
  const seen = new Map<string, number>()
  for (const g of skillGroups || []) {
    for (const raw of (g.skills || "").split(",")) {
      const tok = raw.trim().toLowerCase()
      if (!tok) continue
      seen.set(tok, (seen.get(tok) || 0) + 1)
    }
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([tok]) => tok)
}

// ── Rule 10 — No standalone "Environment:" trailer ────────────────────────────
export function isEnvironmentTrailer(line: string): boolean {
  return /^\s*environment\s*:/i.test(line || "")
}

export function stripEnvironmentTrailer(lines: string[]): string[] {
  return (lines || []).filter(l => !isEnvironmentTrailer(l))
}

// ── Rule 8 — One canonical email per candidate ────────────────────────────────
export function emailsConsistent(emails: string[]): boolean {
  const uniq = new Set((emails || []).map(e => e.trim().toLowerCase()).filter(Boolean))
  return uniq.size <= 1
}

// ── Rule 7 — Section order: certs before experience for security roles ─────────
export function sectionOrderOk(order: string[], isSecurityRole: boolean): boolean {
  if (!isSecurityRole) return true
  const norm = (order || []).map(s => s.toLowerCase())
  const certs = norm.findIndex(s => s.includes("cert"))
  const exp = norm.findIndex(s => s.includes("experience") || s.includes("employment"))
  if (certs === -1 || exp === -1) return true // can't judge → don't fail
  return certs < exp
}

export function isSecurityRole(title: string): boolean {
  return /\b(security|appsec|infosec|soc|grc|pentest|cyber|ot security|devsecops)\b/i.test(title || "")
}

// ── Aggregate validators (read-only) — power the scorecard + builder warnings ──
export function validateSummary(summary: string): RuleIssue[] {
  const issues: RuleIssue[] = []
  if (!summary?.trim()) return issues
  if (hasHavingOpener(summary))
    issues.push({ rule: "having-opener", severity: "error", message: 'Summary starts with "Having" — the #1 AI fingerprint. Lead with the role + years instead.' })
  const wc = summaryWordCount(summary)
  if (wc > 80)
    issues.push({ rule: "summary-length", severity: "warn", message: `Summary is ${wc} words (limit 80). Tighten to one focused paragraph.` })
  if (summaryIsConcatenated(summary))
    issues.push({ rule: "summary-concat", severity: "error", message: "Summary looks concatenated from multiple passes (missing space after a period, or multiple paragraphs)." })
  return issues
}

export function validateBullet(bullet: string): RuleIssue[] {
  const issues: RuleIssue[] = []
  if (!bullet?.trim()) return issues
  if (!bulletHasMetric(bullet))
    issues.push({ rule: "bullet-metric", severity: "warn", message: "Bullet has no number/metric — add scope or a result (e.g. count, %, time)." })
  if (bulletHasWeakOpener(bullet))
    issues.push({ rule: "weak-verb", severity: "warn", message: 'Bullet opens with a weak verb ("Responsible/Worked/Helped…") — lead with a strong action verb (Built, Led, Reduced, Automated).' })
  if (isEnvironmentTrailer(bullet))
    issues.push({ rule: "environment-trailer", severity: "error", message: 'Standalone "Environment:" line — fold tools into a real bullet instead.' })
  return issues
}

export function validateJob(bullets: string[]): RuleIssue[] {
  const issues: RuleIssue[] = []
  const status = bulletCountStatus((bullets || []).filter(b => b?.trim()).length)
  if (status === "high")
    issues.push({ rule: "bullet-count", severity: "warn", message: "More than 6 bullets — recruiters stop reading after 6. Trim to the 6 strongest." })
  if (status === "low")
    issues.push({ rule: "bullet-count", severity: "warn", message: "Fewer than 4 bullets — add 1–2 strong, metric-bearing points." })
  return issues
}
