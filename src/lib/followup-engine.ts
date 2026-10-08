// ── Follow-up engine ────────────────────────────────────────────────────────
// Encodes the user's exact follow-up discipline:
// - Recency: only threads with activity in the last 48h
// - Interview threads: weekly follow-up, never marked no-response
// - Escalation: 7 days no response → still email; ~10 days → call list
// - Marketing firms (TekBlu, CloudQuestIT, TeksolveIT): NEVER targets
// - Consent-before-send: this engine only DRAFTS, never sends.

import { isMarketingFirmDomain } from "./email-classifier"

// ── The user's exact follow-up template (Oct 7, 2026 — do not paraphrase) ────
export const FOLLOWUP_TEMPLATE = `Hello {name}, I hope your day was going well. I'm reaching out to follow up on {context}. Everything went really well, and I'm pretty sure I had made an impression. I'm looking forward to the next update on our next steps on this submission. Do let me know once you have an update. Thank you. Any updates on this position that we have submitted. Please keep me informed at 646-820-3671. Regards, Eshwar`

export const REACHOUT_TEMPLATE = `Here's my updated resume. And my Linkedin: https://www.linkedin.com/in/jayy-eshwar/
Work authorization: Green Card (GC) Holder.
Please do call me at 646-820-3671 to discuss further about the rate and next steps.

Thanks & Best Regards,
Eshwar`

export function buildFollowupEmail(opts: {
  recruiterFirstName: string
  roleName: string
  hadInterview: boolean
}): { subject: string; body: string } {
  const context = opts.hadInterview
    ? "the interview yesterday"
    : `our submission for the ${opts.roleName} role`
  return {
    subject: `Follow-up: ${opts.roleName}`,
    body: FOLLOWUP_TEMPLATE.replace("{name}", opts.recruiterFirstName).replace(
      "{context}",
      context,
    ),
  }
}

// ── Thread state ────────────────────────────────────────────────────────────

export interface FollowupThread {
  threadId: string
  vendor: string
  vendorDomain: string
  jobTitle: string
  lastActivityAt: Date
  lastFollowupAt: Date | null
  followupCount: number
  hasInterview: boolean
  lastMessageFromUser: boolean
}

export type FollowupDecision =
  | { action: "skip"; reason: string }
  | { action: "draft_followup"; email: { subject: string; body: string } }
  | { action: "escalate_call"; reason: string }

const MS_PER_DAY = 86_400_000

/**
 * Decide what to do with a thread right now.
 * @param unfollowedDomains extra user-unfollowed domains (marketing firms always excluded)
 */
export function decideFollowup(
  thread: FollowupThread,
  unfollowedDomains: string[] = [],
  now: Date = new Date(),
): FollowupDecision {
  // 1. Marketing firms: never targets. Hard exclusion.
  if (isMarketingFirmDomain(thread.vendorDomain)) {
    return { action: "skip", reason: "marketing firm — never a follow-up target" }
  }
  const lower = unfollowedDomains.map(d => d.toLowerCase())
  if (lower.includes(thread.vendorDomain.toLowerCase())) {
    return { action: "skip", reason: "unfollowed domain" }
  }

  // 2. Recency rule: only threads with activity in the last 48h (unless interview)
  const hoursSinceActivity =
    (now.getTime() - thread.lastActivityAt.getTime()) / 3_600_000
  if (!thread.hasInterview && hoursSinceActivity > 48) {
    return { action: "skip", reason: "stale — no activity in 48h" }
  }

  // 3. Don't follow up if the last message was already from the user
  if (thread.lastMessageFromUser) {
    return { action: "skip", reason: "awaiting recruiter reply" }
  }

  // 4. Escalation ladder
  const daysSinceActivity =
    (now.getTime() - thread.lastActivityAt.getTime()) / MS_PER_DAY
  const daysSinceFollowup = thread.lastFollowupAt
    ? (now.getTime() - thread.lastFollowupAt.getTime()) / MS_PER_DAY
    : Infinity

  // ~10 days with no response after a follow-up → call list
  if (thread.followupCount > 0 && daysSinceFollowup >= 10) {
    return {
      action: "escalate_call",
      reason: `${Math.round(daysSinceFollowup)} days since last follow-up with no response`,
    }
  }

  // ~7 days since activity (or last follow-up) → draft another follow-up
  const referenceDays = thread.lastFollowupAt ? daysSinceFollowup : daysSinceActivity
  if (referenceDays >= 7) {
    const firstName = thread.vendor.split(" ")[0] || "there"
    return {
      action: "draft_followup",
      email: buildFollowupEmail({
        recruiterFirstName: firstName,
        roleName: thread.jobTitle || "the role",
        hadInterview: thread.hasInterview,
      }),
    }
  }

  // 5. Interview threads get weekly follow-ups without fail
  if (thread.hasInterview && referenceDays >= 7) {
    const firstName = thread.vendor.split(" ")[0] || "there"
    return {
      action: "draft_followup",
      email: buildFollowupEmail({
        recruiterFirstName: firstName,
        roleName: thread.jobTitle || "the role",
        hadInterview: true,
      }),
    }
  }

  return { action: "skip", reason: "too soon since last touch" }
}

/** Threads that currently need a follow-up draft, sorted by urgency. */
export function threadsNeedingFollowup(
  threads: FollowupThread[],
  unfollowedDomains: string[] = [],
  now: Date = new Date(),
): Array<FollowupThread & { email: { subject: string; body: string } }> {
  const out: Array<FollowupThread & { email: { subject: string; body: string } }> = []
  for (const t of threads) {
    const d = decideFollowup(t, unfollowedDomains, now)
    if (d.action === "draft_followup") out.push({ ...t, email: d.email })
  }
  // Most stale first
  out.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
  return out
}

/** Threads that have escalated to the call list. */
export function threadsForCallList(
  threads: FollowupThread[],
  unfollowedDomains: string[] = [],
  now: Date = new Date(),
): FollowupThread[] {
  return threads.filter(
    t => decideFollowup(t, unfollowedDomains, now).action === "escalate_call",
  )
}
