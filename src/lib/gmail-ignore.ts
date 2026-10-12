export interface IgnoreRule { account: string; kind: "sender" | "domain" | "thread"; value: string; action?: "ignore" | "allow" }
const SHARED = new Set(["gmail.com", "google.com", "outlook.com", "hotmail.com", "yahoo.com", "live.com", "microsoft.com", "teams.microsoft.com", "zoom.us"])
export function validIgnoreRule(value: unknown): value is IgnoreRule {
  if (!value || typeof value !== "object") return false
  const r = value as IgnoreRule
  if (typeof r.account !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.account) || typeof r.value !== "string" || r.value.length > 254) return false
  if (r.action !== undefined && r.action !== "ignore" && r.action !== "allow") return false
  if (r.kind === "sender") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.value)
  if (r.kind === "domain") return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(r.value) && !SHARED.has(r.value)
  return r.kind === "thread" && /^[a-zA-Z0-9_-]{1,100}$/.test(r.value)
}
export function ignoreReason(item: { account: string; id: string; fromEmail: string; subject?: string; preview?: string; stage?: string }, rules: IgnoreRule[]): string | null {
  const sender = item.fromEmail.toLowerCase()
  const rule = [...rules].sort((a,b) => Number(b.kind === "thread") - Number(a.kind === "thread")).find(r => r.account === item.account.toLowerCase() && (r.kind === "thread" ? r.value === item.id : r.kind === "sender" ? sender === r.value : sender.split("@")[1] === r.value))
  if (rule?.action === "allow") return null
  if (rule) return `Your ${rule.kind} rule: ${rule.value}`
  // Automatic noise filter never hides application stages or asks to alter Gmail.
  if (["invite", "rtr", "rate", "applied", "offer", "rejected", "followup"].includes(item.stage || "")) return null
  const text = `${item.subject || ""} ${item.preview || ""}`
  if (/interview|screening|right to represent|\bRTR\b|submitted|submission|candidate|resume|profile|application|cancelled|canceled/i.test(text)) return null
  if (/unsubscribe/i.test(text) && /newsletter|webinar|training sale|limited.time offer|buy now/i.test(text)) return "Automatic: promotional mailing with unsubscribe text"
  return null
}
