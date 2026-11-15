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
  const text = statements.filter(Boolean).jo¶»§q«^