// Per-sender notify controls (Poke parity): "always" boosts a sender past the
// normal nudge bar, "never" mutes them entirely. The UI writes these to
// Supabase user_metadata via /api/gmail/notify-rules (GET/PUT). The 30-minute
// inbox worker has no user session and no service key, so it cannot read
// user_metadata — the worker-readable export at /api/gmail/notify-rules/export
// serves it only what triage needs (sender emails + mode; account addresses
// stay server-side).

export type NotifyRule = { account: string; email: string; mode: "always" | "never" }
/** The worker's view: sender email + mode only. */
export type PublicNotifyRule = { email: string; mode: "always" | "never" }

export function validNotifyRule(r: unknown): r is NotifyRule {
  if (!r || typeof r !== "object") return false
  const { account, email, mode } = r as Record<string, unknown>
  return typeof account === "string" && account.includes("@")
    && typeof email === "string" && email.includes("@")
    && (mode === "always" || mode === "never")
}

/** Strip a rule list down to what the worker needs: sender emails + mode. */
export function toPublicRules(rules: readonly NotifyRule[]): PublicNotifyRule[] {
  const seen = new Map<string, PublicNotifyRule>()
  for (const r of rules) {
    if (!validNotifyRule(r)) continue
    const email = r.email.toLowerCase()
    if (!seen.has(email)) seen.set(email, { email, mode: r.mode })
  }
  return [...seen.values()]
}

/** Merge raw rule lists from several owners into one public list. */
export function mergePublicRules(perOwner: readonly (readonly unknown[])[]): PublicNotifyRule[] {
  const all: NotifyRule[] = []
  for (const list of perOwner) for (const r of list) if (validNotifyRule(r)) all.push(r)
  return toPublicRules(all)
}

/** Does a rule's sender email cover this sender? Exact address or same domain. */
export function ruleMatchesSender(ruleEmail: string, senderEmail: string): boolean {
  const rule = ruleEmail.toLowerCase().trim(), sender = senderEmail.toLowerCase().trim()
  if (!rule || !sender) return false
  if (sender === rule) return true
  const rd = rule.split("@")[1], sd = sender.split("@")[1]
  return !!rd && !!sd && (sd === rd || sd.endsWith(`.${rd}`))
}
