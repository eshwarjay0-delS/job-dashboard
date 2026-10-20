/** Keep explicit experience ahead of potentially lengthy pasted job requirements.
 * Downstream enrichment has a bounded context; the JD is also supplied separately.
 */
export function candidateEvidenceInput(jd: string, confirmations: readonly string[]): string {
  return [
    ...(confirmations.length ? [`EXPLICIT CANDIDATE INPUT:\n${confirmations.join("\n")}`] : []),
    `ORIGINAL SUBMITTED TEXT (distinguish job requirements from candidate statements):\n${jd}`,
  ].join("\n\n")
}
