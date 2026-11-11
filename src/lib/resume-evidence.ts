/**
 * Keep explicit experience ahead of potentially lengthy pasted job requirements.
 * Downstream enrichment has a bounded context; the JD is also supplied separately.
 */
export function candidateEvidenceInput(jd: string, confirmations: readonly string[]): string {
  return [
    ...(confirmations.length ? ["EXPLICIT CANDIDATE INPUT:\n" + confirmations.join("\n")] : []),
    "SOURCE-FACT CONFLICT RULES:",
    "- Treat the uploaded resume as candidate-provided evidence, not proof that every statement is current or accurate.",
    "- If explicit candidate input conflicts with resume education, employment dates, employer, tenure or credential status, do not merge, average or silently choose; mark the fact unresolved and request correction before using it.",
    "- A credential described as pursuing, in progress, planned or studying for is not earned.",
    "- Job-description requirements, including years of experience and preferred credentials or tools, are never candidate evidence.",
    "- A general confirmation can support the grouped skills/profile section only. Experience bullets require a confirmation that explicitly names the employer or role; that confirmation may support only the uniquely matching role.",
    "- If a confirmation names multiple employers or ambiguously matches multiple roles, do not attribute it to any role.",
    "ORIGINAL SUBMITTED TEXT (distinguish job requirements from candidate statements):\n" + jd,
  ].join("\n\n")
}

function splitEvidenceStatements(statements: readonly string[]): string[] {
  return statements.flatMap(statement => statement.split(/[\n;]+|[.!?](?=\s|$)/)).map(s => s.trim()).filter(Boolean)
}

function hasRoleScope(statement: string): boolean {
  return /^(?:at|for|during|in|as)\s+[^,;:]+[,;:]\s*(?:i|my)\s+/i.test(statement)
    || /\b(?:at|for|during)\s+[a-z0-9][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,3}(?=[,.;:]|$)/i.test(statement)
    || /\b(?:in|during|for)\s+my\s+.{2,80}\s+(?:role|position)\b/i.test(statement)
}

function candidateClaim(raw: string): string | null {
  let line = raw.trim()
  const scoped = line.match(/^(?:at|for|during|in|as)\s+[^,;:]+[,;:]\s*((?:i|my)\s+.+)$/i)
  if (scoped) line = scoped[1].trim()
  if (!/^(?:i\s+(?:(?:have|possess)\b|(?:personally\s+)?(?:used|implemented|deployed|managed|tested|built|conducted|performed|worked)\b)|my\s+(?:experience|skills|background)\b|(?:confirmed experience|confirmed skills)\s*:)/i.test(line)) return null
  if (/^i\s+(?:have|possess)\s+(?:no|not|never)\b/i.test(line)) return null
  const positive = line.split(/\b(?:except|excluding|but|however|not|never|without)\b/i)[0].trim()
  return positive || null
}

/** A blanket confirmation can support the complete supplied requirement set, but a
 * formatting instruction such as "add all keywords" cannot. A role-scoped blanket
 * statement is deliberately excluded from this global rule. */
export function explicitlyConfirmsAllRequirements(statements: readonly string[]): boolean {
  const text = splitEvidenceStatements(statements).filter(s => !hasRoleScope(s)).join(" ").replace(/\s+/g, " ").toLowerCase()
  if (!text || /\b(?:except|excluding|not|never|no experience|without)\b/.test(text)) return false
  return [
    /\b(?:i|you)\s+(?:have|possess)\s+experience\s+(?:with|in|using)\s+(?:all|every)\s+(?:(?:of\s+)?them|(?:(?:of\s+)?(?:these|those|the|listed|required(?:\s+and\s+preferred)?|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies)))\b/,
    /\bmy\s+experience\s+(?:includes|covers)\s+(?:all|every)\s+(?:(?:of\s+)?(?:these|those|the|listed|required|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/,
    /\b(?:i|you)\s+(?:have|possess)\s+(?:all|every)\s+(?:listed|required|preferred)\s+(?:skills?|requirements?|tools?|technolog(?:y|ies))\b/,
  ].some(pattern => pattern.test(text))
}

/** Only explicit candidate assertions can expand deterministic evidence. Naming a
 * tool in an editing instruction, a question or a negation is not confirmation. */
export function confirmedCandidateStatements(statements: readonly string[]): string[] {
  return splitEvidenceStatements(statements).flatMap(raw => {
    const claim = candidateClaim(raw)
    return claim ? [claim] : []
  })
}

function normalizeScope(value: string): string {
  return String(value || "").toLowerCase()
    .replace(/\b(?:llc|inc|incorporated|corp|corporation|ltd|limited|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

function stripRoleDates(value: string): string {
  return String(value || "")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*(?:[-–—]|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|present|current|now)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/gi, " ")
    .replace(/\s+/g, " ").replace(/[|,;:–—-]+\s*$/, "").trim()
}

function escapeRegExp(value: string): string {
  return [...value].map(ch => "\\^$.*+?()[]{}|/-".includes(ch) ? "\\" + ch : ch).join("")
}

function roleScopeParts(role: { role: string; employer?: string }): { employer: string; title: string } {
  const label = stripRoleDates(role.role)
  const pieces = label.split(/\s+(?:—|–)\s+|\s*\|\s*/).map(s => s.trim()).filter(Boolean)
  const employer = (role.employer || (pieces.length > 1 ? pieces[0] : "")).trim()
  let title = role.employer
    ? label.replace(new RegExp("^" + escapeRegExp(role.employer) + "\\s*(?:—|–|-|\\|)?\\s*", "i"), "").trim()
    : pieces.length > 1 ? pieces.slice(1).join(" ") : label
  if (!title) title = label
  return { employer, title }
}

function roleScopeMatches(
  statement: string,
  role: { role: string; employer?: string },
  roles: readonly { role: string; employer?: string }[],
): boolean {
  const parts = roleScopeParts(role)
  const employerKey = normalizeScope(parts.employer)
  const titleKey = normalizeScope(parts.title)
  const employerCount = employerKey ? roles.filter(r => normalizeScope(roleScopeParts(r).employer) === employerKey).length : 0
  const titleCount = titleKey ? roles.filter(r => normalizeScope(roleScopeParts(r).title) === titleKey).length : 0
  const text = " " + normalizeScope(statement) + " "
  const employerHit = !!employerKey && (
    text.includes(" at " + employerKey + " ")
    || text.includes(" for " + employerKey + " ")
    || text.includes(" during " + employerKey + " ")
  )
  const titleHit = titleKey.split(" ").length >= 2 && (
    text.includes(" as a " + titleKey + " ")
    || text.includes(" as an " + titleKey + " ")
    || text.includes(" in my " + titleKey + " role ")
    || text.includes(" in my " + titleKey + " position ")
    || text.includes(" during my " + titleKey + " role ")
    || text.includes(" during my " + titleKey + " position ")
    || text.includes(" for my " + titleKey + " role ")
    || text.includes(" for my " + titleKey + " position ")
  )
  return (employerHit && (employerCount === 1 || (titleHit && titleCount === 1)))
    || (!employerHit && titleHit && titleCount === 1)
}

/** Map only explicit first-person confirmations to one uniquely named employer or role.
 * Unscoped confirmations remain global skills evidence and never populate employer bullets. */
export function roleScopedCandidateStatements(
  statements: readonly string[],
  roles: readonly { role: string; employer?: string }[],
): string[][] {
  const result = roles.map(() => [] as string[])
  for (const raw of splitEvidenceStatements(statements)) {
    const claim = candidateClaim(raw)
    if (!claim) continue
    const statementScope = " " + normalizeScope(raw) + " "
    const mentionedEmployers = [...new Set(roles.map(role => normalizeScope(roleScopeParts(role).employer)).filter(employer => employer && statementScope.includes(" " + employer + " ")))]
    if (mentionedEmployers.length > 1) continue
    const matches = roles.map((role, index) => roleScopeMatches(raw, role, roles) ? index : -1).filter(index => index >= 0)
    if (matches.length !== 1) continue
    result[matches[0]].push(claim)
  }
  return result.map(items => [...new Set(items)])
}

/** Return only JD terms supported by this specific role's original bullets and
 * still missing from its current bullets. A globally missing term from another
 * role must never be copied into this role's experience. */
export function missingRoleEvidenceTerms(
  sourceTerms: ReadonlySet<string>,
  currentTerms: ReadonlySet<string>,
  requiredTerms: readonly string[],
): string[] {
  const candidates = [...new Set([...requiredTerms, ...sourceTerms])]
  return candidates.filter(term => sourceTerms.has(term) && !currentTerms.has(term))
}

/** Restore an edited experience bullet when it introduces a JD term that no original
 * bullet under the same employer or explicit role-bound confirmation supports. */
export function restoreUnsupportedRoleEdits<T extends { idx: number; text: string }>(
  edits: readonly T[],
  roles: readonly { role?: string; employer?: string; bullets: readonly { idx: number; text: string }[] }[],
  terms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
  confirmations: readonly string[][] = [],
): { edits: T[]; reverted: number; blockedTerms: string[] } {
  const sourceByIdx = new Map<number, string>()
  const allowedByIdx = new Map<number, ReadonlySet<string>>()
  for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
    const role = roles[roleIndex]
    const evidence = [...role.bullets.map(b => b.text), ...(confirmations[roleIndex] || [])].join("\n")
    const allowed = cover(evidence, terms)
    for (const bullet of role.bullets) {
      sourceByIdx.set(bullet.idx, bullet.text)
      allowedByIdx.set(bullet.idx, allowed)
    }
  }
  let reverted = 0
  const blocked = new Set<string>()
  const guarded = edits.map(edit => {
    const source = sourceByIdx.get(edit.idx)
    const allowed = allowedByIdx.get(edit.idx)
    if (source === undefined || !allowed) return { ...edit }
    const unsupported = [...cover(edit.text, terms)].filter(term => !allowed.has(term))
    if (!unsupported.length) return { ...edit }
    reverted++
    unsupported.forEach(term => blocked.add(term))
    return { ...edit, text: source }
  })
  return { edits: guarded, reverted, blockedTerms: [...blocked] }
}

/** Return only the missing JD terms supported by each role's own original bullets
 * or an explicit confirmation that uniquely names that role. */
export function roleScopedMissingTerms(
  roles: readonly { role?: string; employer?: string; bullets: readonly { idx: number; text: string }[] }[],
  current: readonly { idx: number; text: string }[],
  requiredTerms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
  confirmations: readonly string[][] = [],
): { roleIndex: number; terms: string[] }[] {
  const currentByIdx = new Map(current.map(b => [b.idx, b.text]))
  return roles.flatMap((role, roleIndex) => {
    const sourceText = [...role.bullets.map(b => b.text), ...(confirmations[roleIndex] || [])].join("\n")
    const currentText = role.bullets.map(b => currentByIdx.get(b.idx) || b.text).join("\n")
    const sourceTerms = cover(sourceText, requiredTerms)
    const currentTerms = cover(currentText, requiredTerms)
    const terms = missingRoleEvidenceTerms(sourceTerms, currentTerms, requiredTerms)
    return terms.length ? [{ roleIndex, terms }] : []
  })
}
