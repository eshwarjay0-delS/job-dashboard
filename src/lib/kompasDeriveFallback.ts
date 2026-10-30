// Gap B2 (30 Oct 2026, owner: questions "passed fully as if it never heard"): when the question-detection model call
// failed or timed out, the derive endpoint answered { noQuestion: true } and the page said "Listening for the next
// question", so a real question was silently passed over. Now a failed call is retried once with a short timeout, and if
// that fails too the question is formed locally from what the interviewer said. Only an explicit NO_QUESTION from the
// model, or nothing heard at all, is still "no question". Logistics is stripped later by the answer path as before.
import { latestInterviewerAsk } from "./kompasInterviewPrecision.ts"

const LABEL = /^\s*(?:You(?: \((?:typed|earlier)\))?|Them(?: \(earlier\))?):\s*/i

/** The interviewer's latest ask, formed without a model. "" only when nothing usable was heard. */
export function localDeriveFallback(heard: string): string {
  try {
    const lines = String(heard || "").split("\n").map((l) => l.trim()).filter(Boolean)
    const them = lines.filter((l) => /^\s*Them\b/i.test(l))
    const pool = (them.length ? them : lines).slice(-4).map((l) => l.replace(LABEL, "").trim()).filter(Boolean)
    const joined = pool.join(" ").replace(/\s+/g, " ").trim()
    if (!joined) return ""
    const ask = String(latestInterviewerAsk(joined) || joined).trim()
    return ask.slice(-600).trim()
  } catch {
    return String(heard || "").replace(/^\s*(?:You|Them)[^:\n]{0,12}:\s*/gim, " ").replace(/\s+/g, " ").trim().slice(-600)
  }
}

export type DeriveOutcome = { derived: string; derivedBy?: string } | { noQuestion: true }

/**
 * Model derive with one retry and a local fallback. `callModel(timeoutMs)` resolves to the model's text or throws.
 * Timeouts are kept under the page's 30 s derive watchdog (12 s + 6 s).
 */
export async function deriveWithFallback(
  callModel: (timeoutMs: number) => Promise<string>,
  heard: string,
  timeouts: [number, number] = [12000, 6000],
): Promise<DeriveOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const derived = String((await callModel(timeouts[attempt])) || "").trim()
      if (!derived || /^NO_QUESTION/i.test(derived)) return { noQuestion: true }
      return { derived }
    } catch { /* retry once, then fall back */ }
  }
  const local = localDeriveFallback(heard)
  return local ? { derived: local, derivedBy: "fallback" } : { noQuestion: true }
}
