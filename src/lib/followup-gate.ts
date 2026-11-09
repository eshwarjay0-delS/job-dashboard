import { claimFollowupOccurrence, getFollowupClaim, type FollowupClaimStore } from './followup-claims.ts'
import { followupEligibility } from './followup-eligibility.ts'

/**
 * Account-scoped due/stop evaluation with atomic occurrence claiming — the
 * single gate an executor must pass before any execution. A 'due' result
 * with claimed true reserves one (user, account, thread, occurrence)
 * exactly once; it never sends, schedules, or executes anything — no
 * executor exists — and a claim alone authorizes nothing. Every other
 * verdict leaves the claim store untouched.
 *
 * Order of checks, each fail-closed:
 * 1. Explicit schedule required. A plan without an explicit dueAt and
 *    occurrence is not executable: free-text instructions (for example
 *    "twice weekly") must never silently become a schedule.
 * 2. Pure eligibility on verified account-scoped observations (exact
 *    account and thread, stop on inbound reply, invalid or future
 *    evidence rejected). Anything but 'due' stops here with no claim
 *    written.
 * 3. Live claim read: an existing claim for this occurrence is a
 *    duplicate, not a second execution.
 * 4. Atomic claim through the store putIfAbsent primitive. Exactly one
 *    caller wins; a lost race is a duplicate, never a second execution.
 * A claim-store failure anywhere blocks the gate: when claim state cannot
 * be verified, the gate refuses rather than risking a double execution.
 */

export type FollowupGateVerdict = 'blocked' | 'stopped' | 'duplicate' | 'waiting' | 'due'

export type FollowupGateReason = 'no-explicit-schedule' | 'claim-store-unavailable' | null

export type FollowupGateResult = {
  verdict: FollowupGateVerdict
  claimed: boolean
  claimedAt: number | null
  reason: FollowupGateReason
}

export async function evaluateFollowupGate(
  store: FollowupClaimStore,
  input: {
    userId: string
    account: string
    observedAccount: string
    thread: string
    observedThread: string
    now: number
    dueAt: number | null | undefined
    occurrence: string | null | undefined
    enabled: boolean
    ignored: boolean
    stopOnReply: boolean
    lastSentAt: number
    lastInboundAt?: number
  },
): Promise<FollowupGateResult> {
  const unclaimed = (
    verdict: FollowupGateVerdict,
    claimedAt: number | null = null,
    reason: FollowupGateReason = null,
  ): FollowupGateResult => ({ verdict, claimed: false, claimedAt, reason })
  if (input.dueAt === null || input.dueAt === undefined || !Number.isFinite(input.dueAt) || !input.occurrence) {
    return unclaimed('blocked', null, 'no-explicit-schedule')
  }
  const verdict = followupEligibility({
    account: input.account,
    thread: input.thread,
    now: input.now,
    dueAt: input.dueAt,
    enabled: input.enabled,
    ignored: input.ignored,
    stopOnReply: input.stopOnReply,
    lastSentAt: input.lastSentAt,
    lastInboundAt: input.lastInboundAt,
    observedAccount: input.observedAccount,
    observedThread: input.observedThread,
    occurrence: input.occurrence,
    completedOccurrences: [],
  })
  if (verdict !== 'due') return unclaimed(verdict)
  try {
    const existing = await getFollowupClaim(store, {
      userId: input.userId,
      account: input.account,
      thread: input.thread,
      occurrence: input.occurrence,
    })
    if (existing) return unclaimed('duplicate', existing.claimedAt)
    const won = await claimFollowupOccurrence(store, {
      userId: input.userId,
      account: input.account,
      thread: input.thread,
      occurrence: input.occurrence,
      now: input.now,
    })
    if (won) return { verdict: 'due', claimed: true, claimedAt: input.now, reason: null }
    const winner = await getFollowupClaim(store, {
      userId: input.userId,
      account: input.account,
      thread: input.thread,
      occurrence: input.occurrence,
    }).catch(() => null)
    return unclaimed('duplicate', winner ? winner.claimedAt : null)
  } catch {
    return unclaimed('blocked', null, 'claim-store-unavailable')
  }
}
