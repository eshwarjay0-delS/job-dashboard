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
 * narrow: the statement must explicitly attribute experience to the candidate.
 * Interrogative statements are never confirmations, even when their words match a
 * positive confirmation pattern. */
export function explicitlyConfirmsAllRequirements(statements: readonly string[]): boolean {
  const text = statements.filter(Boolean).join("\n").replace(/\s+/g, " ").toLowerCase()
  if (!text || text.includes("?") || /\b(?:except|excluding|not|never|no experience|without)\b/.test(text)) return false
  return [
    /\bi\s+(?:have|possess)\s+experience\s+(?:with|in|using)\s+(?:all|every)\s+(?:(?:of\s+)?them|(?:(?:of\s+)?(?:these|those|the|listed|required(?:\s+and\s+preferred)?|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies)))\b/,
    /\bmy\s+experience\s+(?:includes|covers)\s+(?:all|every)\s+(?:(?:of\s+)?(?:these|those|the|listed|required|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/,
    /\bi\s+(?:have|possess)\s+(?:all|every)\s+(?:listed|required|preferred)\s+(?:skills?|requirements?|tools?|technolog(?:y|ies))\b/,
  ].some(pattern => pattern.test(text))
}

/** Only explicit positive first-person assertions can expand deterministic evidence.
 * Headings such as "Confirmed skills:" and second-person wording are not candidate
 * confirmation. Split sentences without discarding terminal question marks, then
 * split ordinary contrast clauses and reject negation in each clause. */
export function confirmedCandidateStatements(statements: readonly string[]): string[] {
  return statements
    .flatMap(statement => statement.split(/[\n;]+/).flatMap(segment => segment.split(/(?<=[.!?])\s+/)))
    .flatMap(raw => {
      const line = raw.trim()
      // Do this before any clause or punctuation normalization: "I used AWS?" is
      // a question, not a first-person experience assertion.
      if (!line || line.includes("?")) return []
      // Keep the question-mark decision above, but preserve the old output shape
      // by removing only ordinary sentence-ending punctuation after that check.
      const sentence = line.replace(/[.!]+$/, "").trim()
      const hasBlanketConfirmation = /\b(?:all|every)\b/i.test(sentence) && /\b(?:them|skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/i.test(sentence)
      const hasException = /\b(?:except|excluding|but|however|not|never|without)\b/i.test(sentence)
      if (hasBlanketConfirmation && hasException) return []
      return sentence.split(/\b(?:but|however|except|excluding)\b/i).flatMap(rawClause => {
        const clause = rawClause.trim()
        if (!/^(?:i\s+(?:(?:have|possess)\b|(?:personally\s+)?(?:used|implemented|deployed|managed|tested|built|conducted|performed|worked)\b)|my\s+(?:experience|skills|background)\b)/i.test(clause)) return []
        if (/\b(?:no|not|never|without|don't|doesn't|didn't|haven't|hasn't|hadn't|can't|cannot|won't|wouldn't|shouldn't|isn't|aren't|wasn't|weren't)\b/i.test(clause)) return []
        return [clause]
      })
    })
}
