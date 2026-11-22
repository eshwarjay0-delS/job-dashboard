/** Keep explicit experience ahead of potentially lengthy pasted job requirements.
 * Downstream enrichment has a bounded context; the JD is also supplied separately.
 */
export function candidateEvidenceInput(jd: string, confirmations: readonly string[]): string {
  return [
    ...(confirmations.length ? [`EXPLICIT CANDIDATE INPUT:\n${confirmations.join("\n")}`] : []),
    "SOURCE-FACT CONFLICT RULES:",
    "- Treat the uploaded resume as candidate-provided evidence, not proof that every statement is current or accurate.",
    "- If explicit candidate input conflicts with resume education, employment dates, employer, tenure or credential status, do not merge, average or silently choose; mark the fact unresolved and request correction before using it.",
    "- A credential described as pursuing, in progress, planned or studying for is not earned.",
    "- Job-description requirements, including years of experience and preferred credentials or tools, are never candidate evidence.",
    `ORIGINAL SUBMITTED TEXT (distinguish job requirements from candidate statements):\n${jd}`,
  ].join("\n\n")
}

/** A blanket confirmation can support the complete supplied requirement set, but a
 * formatting instruction such as "add all keywords" cannot. Keep this deliberately
 * narrow: the statement must explicitly attribute experience to the candidate. */
export function explicitlyConfirmsAllRequirements(statements: readonly string[]): boolean {
  const text = statements.filter(Boolean).join("\n").replace(/\s+/g, " ").toLowerCase()
  if (!text || /\b(?:except|excluding|not|never|no experience|without)\b/.test(text)) return false
  return [
    /\b(?:i|you)\s+(?:have|possess)\s+experience\s+(?:with|in|using)\s+(?:all|every)\s+(?:(?:of\s+)?them|(?:(?:of\s+)?(?:these|those|the|listed|required(?:\s+and\s+preferred)?|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies)))\b/,
    /\bmy\s+experience\s+(?:includes|covers)\s+(?:all|every)\s+(?:(?:of\s+)?(?:these|those|the|listed|required|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/,
    /\b(?:i|you)\s+(?:have|possess)\s+(?:all|every)\s+(?:listed|required|preferred)\s+(?:skills?|requirements?|tools?|technolog(?:y|ies))\b/,
  ].some(pattern => pattern.test(text))
}

/** Only explicit candidate assertions can expand skills/profile evidence. This parser
 * does not attribute a general statement to an employer, project, date or metric. Naming a
 * tool in an editing instruction, a question or a negation is not confirmation. */
export function confirmedCandidateStatements(statements: readonly string[]): string[] {
  return statements.flatMap(statement => statement.split(/[\n;]+|[.!?](?=\s|$)/)).flatMap(raw => {
    const line = raw.trim()
    if (!/^(?:i\s+(?:(?:have|possess)\b|(?:personally\s+)?(?:used|implemented|deployed|managed|tested|built|conducted|performed|worked)\b)|my\s+(?:experience|skills|background)\b|(?:confirmed experience|confirmed skills)\s*:)/i.test(line)) return []
    if (/^i\s+(?:have|possess)\s+(?:no|not|never)\b/i.test(line)) return []
    const positive = line.split(/\b(?:except|excluding|but|however|not|never|without)\b/i)[0].trim()
    return positive ? [positive] : []
  })
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
 * bullet under the same employer supports. A term found in another employer's source
 * bullets is not transferable. Whole-bullet restoration keeps the factual source intact. */
export function restoreUnsupportedRoleEdits<T extends { idx: number; text: string }>(
  edits: readonly T[],
  roles: readonly { bullets: readonly { idx: number; text: string }[] }[],
  terms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
): { edits: T[]; reverted: number; blockedTerms: string[] } {
  const sourceByIdx = new Map<number, string>()
  const allowedByIdx = new Map<number, ReadonlySet<string>>()
  for (const role of roles) {
    const allowed = cover(role.bullets.map(b => b.text).join("\n"), terms)
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


/** Return only the missing JD terms supported by each role's own original bullets. */
export function roleScopedMissingTerms(
  roles: readonly { bullets: readonly { idx: number; text: string }[] }[],
  current: readonly { idx: number; text: string }[],
  requiredTerms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
): { roleIndex: number; terms: string[] }[] {
  const currentByIdx = new Map(current.map(b => [b.idx, b.text]))
  return roles.flatMap((role, roleIndex) => {
    const sourceText = role.bullets.map(b => b.text).join("\n")
    const currentText = role.bullets.map(b => currentByIdx.get(b.idx) || b.text).join("\n")
    const sourceTerms = cover(sourceText, requiredTerms)
    const currentTerms = cover(currentText, requiredTerms)
    const terms = missingRoleEvidenceTerms(sourceTerms, currentTerms, requiredTerms)
    return terms.length ? [{ roleIndex, terms }] : []
  })
}
