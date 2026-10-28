/**
 * Controls when provisional model text may be displayed as an interview answer.
 * The model itself has not verified source facts while tokens are arriving.
 * A final-only policy waits for the existing deterministic guards and optional
 * external fact check. It does NOT claim the final answer is independently verified.
 */
export type KompasStreamPolicy = "guarded-final" | "progressive"

export function answerStreamPolicy(tier: number, question: string): KompasStreamPolicy {
  // T0: career, T1: personal story, T3: follow-up on earlier project, T4: direct
  // personal background. Do not let a candidate read an invented event or metric
  // from an unreviewed delta before the final grounding pass can remove it.
  if (tier === 0 || tier === 1 || tier === 3 || tier === 4) return "guarded-final"
  // Some T2 queries are explicitly asking for a personal achievement but fall
  // outside the classifier's narrow experience patterns.
  if (/\b(?:what (?:did|have) you (?:personally )?(?:do|achieve|deliver)|your (?:biggest|greatest|most significant) (?:achievement|impact)|tell me about (?:your|a time you)|what (?:can|would) you bring to (?:our|the) team|what (?:can|would) you bring (?:to|here)|(?:current|past|previous) experience (?:that|you)|highlight (?:for me )?anything|what sets you apart)\b/i.test(question)) return "guarded-final"
  return "progressive"
}

export function releaseProvisionalDelta(policy: KompasStreamPolicy): boolean {
  return policy === "progressive"
}

export function mustEmitFinalReplacement(policy: KompasStreamPolicy, finalText: string, rawText: string): boolean {
  return policy === "guarded-final" || finalText !== rawText
}

/** The JD and generated/historical context set relevance, never prove candidate history. */
export function candidateEvidenceForVerification(resume: string, originalDocuments: string): string {
  return [
    resume.trim() ? "RESUME:\n" + resume.trim() : "",
    originalDocuments.trim() ? "ORIGINAL SOURCE DOCUMENTS:\n" + originalDocuments.trim() : "",
  ].filter(Boolean).join("\n\n")
}
