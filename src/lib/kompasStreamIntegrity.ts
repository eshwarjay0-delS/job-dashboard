/**
 * Controls when provisional model text may be displayed as an interview answer.
 * The model itself has not verified source facts while tokens are arriving.
 * A final-only policy waits for the existing deterministic guards and optional
 * external fact check. It does NOT claim the final answer is independently verified.
 */
export type KompasStreamPolicy = "guarded-final" | "guarded-sentence" | "progressive"

// Speed r6 (29 Oct 2026): personal history no longer waits for the whole answer. "guarded-sentence" releases a sentence
// only after the deterministic guards (figures, place/prestige/title, unsupported employer/tool/scale claims, provider
// error text) pass on that sentence; the first failing sentence stops all further release, and the full-answer guards,
// repair and settle still run and always end in a final replace. sentenceStream:false (or KOMPAS_SENTENCE_STREAM=0)
// restores "guarded-final" exactly.
export function answerStreamPolicy(tier: number, question: string, opts: { sentenceStream?: boolean } = {}): KompasStreamPolicy {
  const held = heldPolicy(tier, question)
  if (held !== "guarded-final") return held
  const on = opts.sentenceStream ?? (typeof process === "undefined" || process.env?.KOMPAS_SENTENCE_STREAM !== "0")
  return on ? "guarded-sentence" : "guarded-final"
}

function heldPolicy(tier: number, question: string): KompasStreamPolicy {
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
  return policy === "guarded-final" || policy === "guarded-sentence" || finalText !== rawText
}

/** The JD and generated/historical context set relevance, never prove candidate history. */
export function candidateEvidenceForVerification(resume: string, originalDocuments: string): string {
  return [
    resume.trim() ? "RESUME:\n" + resume.trim() : "",
    originalDocuments.trim() ? "ORIGINAL SOURCE DOCUMENTS:\n" + originalDocuments.trim() : "",
  ].filter(Boolean).join("\n\n")
}
