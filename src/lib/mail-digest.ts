import { interviewThreadKey } from "./interview-mail-link.ts"
import type { NotifyRule } from "./notify-rules.ts"

export type DigestMailIdentity = { account: string; id: string; fromEmail: string }
export type DigestRadarIdentity = { account: string; threadId: string; daysWaiting: number }

/** Stable identity for a sender preference within one receiving inbox. */
export function notifyRuleKey(account: string, email: string): string {
  return `${account.trim().toLowerCase()}:${email.trim().toLowerCase()}`
}

/** The digest UI must apply a mute only to the inbox where the user set it. */
export function isDigestSenderMuted(rules: readonly NotifyRule[], mail: DigestMailIdentity): boolean {
  if (!mail.account.trim() || !mail.fromEmail.trim()) return false
  const key = notifyRuleKey(mail.account, mail.fromEmail)
  return rules.some(rule => rule.mode === "never" && notifyRuleKey(rule.account, rule.email) === key)
}

/** Toggle one account/sender pair without changing the same sender in another inbox. */
export function toggleDigestSenderMute(rules: readonly NotifyRule[], account: string, email: string): NotifyRule[] {
  const normalizedAccount = account.trim().toLowerCase()
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedAccount || !normalizedEmail) return [...rules]
  const key = notifyRuleKey(normalizedAccount, normalizedEmail)
  const currentlyMuted = rules.some(rule => rule.mode === "never" && notifyRuleKey(rule.account, rule.email) === key)
  const retained = rules.filter(rule => notifyRuleKey(rule.account, rule.email) !== key)
  return currentlyMuted
    ? retained
    : [...retained, { account: normalizedAccount, email: normalizedEmail, mode: "never" }]
}

/** Radar entries are per inbox; a provider thread ID alone is not a global key. */
export function waitingDaysForDigestMail(radar: readonly DigestRadarIdentity[], mail: { account: string; id: string }): number {
  const key = interviewThreadKey(mail.account, mail.id)
  return radar.find(row => interviewThreadKey(row.account, row.threadId) === key)?.daysWaiting ?? 0
}
