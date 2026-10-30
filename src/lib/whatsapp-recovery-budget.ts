/** Reserve enough of Vercel's 300-second function window to persist the
 * recovery outcome and finish the Meta upload after tailoring. The recovery
 * route can spend time listing legacy sessions before it starts the model.
 * Never use a full 240-second tailoring budget after a long bootstrap. */
export const RECOVERY_ROUTE_LIMIT_MS = 300_000
export const RECOVERY_FINISH_RESERVE_MS = 45_000
export const RECOVERY_MIN_TAILOR_MS = 35_000

export function recoveryTailorBudget(startedAt: number, now = Date.now(), requestedMs = 240_000): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now) || !Number.isFinite(requestedMs)) return 0
  const remaining = RECOVERY_ROUTE_LIMIT_MS - Math.max(0, now - startedAt) - RECOVERY_FINISH_RESERVE_MS
  return Math.max(0, Math.floor(Math.min(requestedMs, remaining)))
}
