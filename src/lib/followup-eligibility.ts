/** Pure review eligibility. A due result never grants permission to send. */
export function followupEligibility(input: {
  account: string; thread: string; now: number; dueAt: number;
  enabled: boolean; ignored: boolean; stopOnReply: boolean;
  lastSentAt: number; lastInboundAt?: number;
  observedAccount: string; observedThread: string;
  occurrence: string; completedOccurrences: readonly string[];
}): 'blocked' | 'stopped' | 'duplicate' | 'waiting' | 'due' {
  const account = input.account.trim().toLowerCase()
  if (!account || !input.thread || !input.occurrence || !input.enabled || input.ignored
    || account !== input.observedAccount.trim().toLowerCase() || input.thread !== input.observedThread
    || ![input.now, input.dueAt, input.lastSentAt].every(n => Number.isFinite(n) && n >= 0)
    || input.lastSentAt <= 0 || input.dueAt < input.lastSentAt || input.lastSentAt > input.now
    || (input.lastInboundAt !== undefined && (!Number.isFinite(input.lastInboundAt) || input.lastInboundAt < 0 || input.lastInboundAt > input.now))) return 'blocked'
  if (input.stopOnReply && input.lastInboundAt !== undefined && input.lastInboundAt >= input.lastSentAt) return 'stopped'
  if (input.completedOccurrences.includes(input.occurrence)) return 'duplicate'
  return input.now < input.dueAt ? 'waiting' : 'due'
}

/**
 * Review-only observation for one follow-up radar item. The radar route calls
 * this so the review surface shows a helper-verified verdict instead of trusting
 * the route's inclusion rule alone. REVIEW ONLY: a 'due' verdict never grants
 * permission to send, schedule, or claim anything.
 *
 * Input meanings, stated exactly so no later reader mistakes review for
 * permission: enabled is true because the item is included in the review set,
 * NOT because follow-up sending is enabled for the thread; ignored is false
 * because ignore-filtered threads are excluded upstream before this runs;
 * dueAt is the route's own explicit review threshold (sentAt + minWaitDays),
 * never derived from a free-text automation plan (plans carry no dueAt or
 * occurrence fields, so they must not silently become schedules);
 * occurrence names the exact outbound message under review; completed
 * occurrences are empty because no claim store exists yet, so 'duplicate'
 * cannot fire until atomic claims land. That limit is intentional and
 * recorded, not hidden.
 */
export function radarReviewObservation(input: {
  account: string; threadId: string; sentAt: number;
  lastInboundAt?: number; minWaitDays: number; now: number;
}): {
  eligibility: 'blocked' | 'stopped' | 'duplicate' | 'waiting' | 'due';
  dueAt: number; lastSentAt: number; lastInboundAt: number | null; occurrence: string;
} {
  const dueAt = input.sentAt + Math.max(0, input.minWaitDays) * 86_400_000
  const occurrence = `radar:${input.threadId}:${input.sentAt}`
  const eligibility = followupEligibility({
    account: input.account,
    thread: input.threadId,
    now: input.now,
    dueAt,
    enabled: true,
    ignored: false,
    stopOnReply: true,
    lastSentAt: input.sentAt,
    lastInboundAt: input.lastInboundAt,
    observedAccount: input.account,
    observedThread: input.threadId,
    occurrence,
    completedOccurrences: [],
  })
  return {
    eligibility,
    dueAt,
    lastSentAt: input.sentAt,
    lastInboundAt: input.lastInboundAt ?? null,
    occurrence,
  }
}
