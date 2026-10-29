import { createHash } from 'node:crypto'

/**
 * Atomic follow-up occurrence claims. A claim reserves one
 * (user, account, thread, occurrence) exactly once. It is a guard, not a
 * permission: claiming an occurrence never sends, schedules, or executes
 * anything — no executor exists — and a claim alone authorizes nothing.
 * The storage primitive is the blob's putIfAbsent (filesystem wx flag,
 * S3 IfNoneMatch "*"), so two concurrent claims for the same occurrence
 * cannot both succeed. The caller supplies only the minimal blob surface
 * it needs, which keeps this unit-testable without storage.
 */

export type FollowupClaimStore = {
  putIfAbsent(key: string, data: string): Promise<boolean>
  getText(key: string): Promise<string | null>
}

export type FollowupClaim = {
  userId: string; account: string; thread: string; occurrence: string
  claimedAt: number; status: 'claimed'
}

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_')

export function followupClaimKey(userId: string, account: string, thread: string, occurrence: string): string {
  const id = createHash('sha256').update(`${account.toLowerCase()}\n${thread}\n${occurrence}`).digest('hex')
  return `mail/followup-claims/${safe(userId)}/${id}.json`
}

/** Returns true only when this call created the claim. False means it already exists. */
export async function claimFollowupOccurrence(
  store: FollowupClaimStore,
  input: { userId: string; account: string; thread: string; occurrence: string; now: number },
): Promise<boolean> {
  const claim: FollowupClaim = {
    userId: input.userId,
    account: input.account.toLowerCase(),
    thread: input.thread,
    occurrence: input.occurrence,
    claimedAt: input.now,
    status: 'claimed',
  }
  return store.putIfAbsent(
    followupClaimKey(input.userId, input.account, input.thread, input.occurrence),
    JSON.stringify(claim),
  )
}

/** Review read: the claim for one occurrence, or null when nothing is claimed. */
export async function getFollowupClaim(
  store: FollowupClaimStore,
  input: { userId: string; account: string; thread: string; occurrence: string },
): Promise<FollowupClaim | null> {
  const raw = await store.getText(followupClaimKey(input.userId, input.account, input.thread, input.occurrence))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FollowupClaim
    if (parsed.status !== 'claimed' || parsed.thread !== input.thread || parsed.occurrence !== input.occurrence) return null
    return parsed
  } catch {
    return null
  }
}
