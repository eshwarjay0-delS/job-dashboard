/** Delivery changes with the listener; technical correctness does not. */
export function audienceGuidance(audience: string, question: string): string {
  const common = "Start with a direct plain-language answer, then explain the mechanism and why it matters. Use one connected example. Define an unfamiliar term when it first becomes necessary. Do not stack product names or use an analogy instead of explaining the real mechanism."
  if (/mixed|non.?technical|does not (?:write code|code)|operations manager/i.test(question)) {
    return common + " This question explicitly includes a nontechnical listener: honor that over the selected role. Explain the practical action and consequence first, then enough implementation detail for the engineer to evaluate it. Do not assume product knowledge."
  }
  if (/^(?:hr|technical_hr|tech-hr)$/i.test(audience)) return common + " For this recruiter or technical HR listener, use everyday language and one concrete example. Avoid configuration details, versions, and acronyms unless asked."
  if (/^(?:director|lead|supervisor)$/i.test(audience)) return common + " Lead with the decision, business consequence, options and tradeoff. State what evidence would change the decision, who owns the next action, and the release or acceptance condition. Include implementation only when it explains a risk or constraint."
  return common + " For this practitioner, explain the trust boundary, implementation, failure modes and verification. Technical depth comes from causal reasoning, not a catalogue of tools or unsupported version numbers."
}

export const EVIDENCE_POLICY = "Evidence boundary: a job description states requirements, not the candidate's history. Generated prep, personas and earlier AI answers are unverified context, not evidence that an incident happened. Only claim personal work supported by original resume or source documents. For hypothetical questions use 'I would'; label assumptions and proposed tools as choices, never observations. When no supporting history exists, explain the approach without inventing a previous employer, project, metric, scan result, log entry or deployment."
