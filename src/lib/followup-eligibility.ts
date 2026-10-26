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
    || input.lastSentAt > input.now
    || (input.lastInboundAt !== undefined && (!Number.isFinite(input.lastInboundAt) || input.lastInboundAt < 0 || input.lastInboundAt > input.now))) return 'blocked'
  if (input.stopOnReply && input.lastInboundAt !== undefined && input.lastInboundAt >= input.lastSentAt) return 'stopped'
  if (input.completedOccurrences.includes(input.occurrence)) return 'duplicate'
  return input.now < input.dueAt ? 'waiting' : 'due'
}
