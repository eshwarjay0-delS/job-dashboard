export type NotifyRule = { account: string; email: string; mode: "always" | "never" }
export type WorkerNotifyOwner = { ownerId: string; rules: NotifyRule[] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validNotifyRule(value: unknown): value is NotifyRule {
  if (!value || typeof value !== "object") return false
  const rule = value as Record<string, unknown>
  return typeof rule.account === "string" && EMAIL.test(rule.account)
    && typeof rule.email === "string" && EMAIL.test(rule.email)
    && (rule.mode === "always" || rule.mode === "never")
}

/** Keep the worker's view grouped by owner and receiving inbox. Never merge
 * identical sender addresses across accounts or owners. */
export function toWorkerNotifyOwner(ownerId: string, value: unknown): WorkerNotifyOwner | null {
  if (!ownerId || ownerId.length > 128 || !Array.isArray(value)) return null
  const byInboxAndSender = new Map<string, NotifyRule>()
  for (const item of value) {
    if (!validNotifyRule(item)) continue
    const account = item.account.trim().toLowerCase()
    const email = item.email.trim().toLowerCase()
    if (!EMAIL.test(account) || !EMAIL.test(email)) continue
    byInboxAndSender.set(`${account}\u0000${email}`, { account, email, mode: item.mode })
  }
  return byInboxAndSender.size ? { ownerId, rules: [...byInboxAndSender.values()] } : null
}

/** Does a rule's sender email cover this sender? Exact address or same domain. */
export function ruleMatchesSender(ruleEmail: string, senderEmail: string): boolean {
  const rule = ruleEmail.toLowerCase().trim(), sender = senderEmail.toLowerCase().trim()
  if (!rule || !sender) return false
  if (sender === rule) return true
  const rd = rule.split("@")[1], sd = sender.split("@")[1]
  return !!rd && !!sd && (sd === rd || sd.endsWith(`.${rd}`))
}
