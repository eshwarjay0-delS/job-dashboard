import { interviewThreadKey } from "./interview-mail-link.ts"
import type { NotifyRule } from "./notify-rules.ts"

export type DigestMailIdentity = { account: string; id: string; fromEmail: string }
export type DigestRadarIdentity = { account: string; threadId: string; daysWaiting: number }

const normalizeIdentity = (value: string) => String(value || "").trim().toLowerCase()

/** Stable identity for a sender preference within one receiving inbox. */
export function notifyRuleKey(account: string, email: string): string {
  const inbox = normalizeIdentity(account)
  const sender = normalizeIdentity(email)
  return inbox.includes("@") && sender.includes("@") ? `${inbox}:${sender}` : ""
}

/** The digest UI applies a mute only to the inbox where the user set it. */
export function isDigestSenderMuted(rules: readonly NotifyRule[], mail: DigestMailIdentity): boolean {
  const key = notifyRuleKey(mail.account, mail.fromEmail)
  return !!key && rules.some(rule => rule.mode === "never" && notifyRuleKey(rule.account, rule.email) === key)
}

/** Toggle one account/sender pair without changing the same sender in another inbox. */
export function toggleDigestSenderMute(rules: readonly NotifyRule[], account: string, email: string): NotifyRule[] {
  const normalizedAccount = normalizeIdentity(account)
  const normalizedEmail = normalizeIdentity(email)
  const key = notifyRuleKey(normalizedAccount, normalizedEmail)
  if (!key) return [...rules]
  const currentlyMuted = rules.some(rule => rule.mode === "never" && notifyRuleKey(rule.account, rule.email) === key)
  const retained = rules.filter(rule => notifyRuleKey(rule.account, rule.email) !== key)
  return currentlyMuted
    ? retained
    : [...retained, { account: normalizedAccount, email: normalizedEmail, mode: "never" as const }]
}

/** Radar entries are per inbox; a provider thread ID alone is not a global key. */
export function waitingDaysForDigestMail(radar: readonly DigestRadarIdentity[], mail: { account: string; id: string }): number {
  const key = interviewThreadKey(normalizeIdentity(mail.account), mail.id)
  return radar.find(row => interviewThreadKey(normalizeIdentity(row.account), row.threadId) === key)?.daysWaiting ?? 0
}
