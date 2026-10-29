// Repair bookkeeping, kept pure so it is tested without a model. The service (kompasAnswerService.repairStructure)
// calls the rewrite; this file decides whether a rewrite is kept and reports what happened, so a repair that landed
// and was later cut is visible in the done event instead of hiding behind "repaired: 0".

export type RepairStatus = "not-needed" | "no-key" | "landed" | "partial" | "discarded" | "failed"

export interface RepairOutcome {
  status: RepairStatus
  attempts: number
  missing: string[]
  stillMissing: string[]
  // Set after the answer is settled (voice repair, fact-check, ceiling trim): did the fixed items stay fixed?
  survived?: boolean
  lostAfterSettle?: string[]
}

/**
 * Keep a rewrite when it fixes at least one core item (structure or a named term) and breaks no core item that
 * was fine before. With no core items, the same rule runs on the advisory items. Returns how many were fixed.
 */
export function judgeRewrite(coreBefore: string[], coreAfter: string[], allBefore: string[], allAfter: string[]): number {
  const before = coreBefore.length ? coreBefore : allBefore
  const after = coreBefore.length ? coreAfter : allAfter
  if (!after.every((item) => before.includes(item))) return 0
  return Math.max(0, before.length - after.length)
}

export function statusFor(fixed: number, total: number, remaining: number): RepairStatus {
  if (!fixed) return "discarded"
  return remaining > 0 && fixed < total ? "partial" : "landed"
}

/** After settling: items the repair had fixed that are missing again in the answer the candidate actually sees. */
export function lostAfterSettle(outcome: RepairOutcome, finalMissing: string[]): string[] {
  if (outcome.status !== "landed" && outcome.status !== "partial") return []
  const fixed = outcome.missing.filter((item) => !outcome.stillMissing.includes(item))
  return fixed.filter((item) => finalMissing.includes(item))
}

export function repairLogLine(outcome: RepairOutcome, question: string): string {
  const q = String(question || "").slice(0, 80)
  const lost = outcome.lostAfterSettle?.length ? ` lost-after-settle=${outcome.lostAfterSettle.length}` : ""
  return `[kompas repair] ${outcome.status} attempts=${outcome.attempts} missing=${outcome.missing.length} still=${outcome.stillMissing.length}${lost} q="${q}"`
}
