// An employer asking for Kompas not to be used in its interviews: checking the form, and keeping it for the owner.
//
// What it prevents: a request that is lost, a form that stores whatever it is sent, and a public form that fills the
// store. A request is checked field by field, kept as one small file each (no shared file to overwrite), and read only
// by the owner on /dashboard/admin/blocklist. Nothing is blocked automatically: the owner reviews each request.
// No migration is needed: requests sit in the same storage as the admin settings (src/lib/adminConfig.ts).
//
// Approved 23 Oct 2026 ("add all", competitor idea 17).

export type BlocklistStore = { put(key: string, data: string): Promise<void> }

export type BlocklistRequest = {
  company: string
  /** The employer's web address, reduced to its domain, e.g. "example.com". Empty when not given. */
  domain: string
  contactName: string
  contactEmail: string
  contactRole: string
  details: string
}

export const BLOCKLIST_PREFIX = "blocklist-requests"
export const MAX_BODY_BYTES = 8_000
const LIMITS = { company: [2, 120], contactName: [2, 100], contactRole: [0, 100], details: [0, 2000], website: [0, 200] } as const

/** Trim, drop control characters, and fold runs of spaces (keeping line breaks in the free-text field). */
function clean(value: unknown, multiline = false): string {
  if (typeof value !== "string") return ""
  // eslint-disable-next-line no-control-regex
  const text = value.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, " ")
  return (multiline ? text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : text.replace(/\s+/g, " ")).trim()
}

function domainOf(website: string): string | null {
  if (!website) return ""
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.toLowerCase().replace(/^www\./, "")
    return /^(?=.{3,200}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null
  } catch {
    return null
  }
}

export type Checked = { ok: true; value: BlocklistRequest } | { ok: false; errors: Record<string, string> }

export function checkBlocklistRequest(body: unknown): Checked {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  const company = clean(b.company)
  const website = clean(b.website)
  const contactName = clean(b.contactName)
  const contactEmail = clean(b.contactEmail).toLowerCase()
  const contactRole = clean(b.contactRole)
  const details = clean(b.details, true)

  const within = (field: keyof typeof LIMITS, value: string, label: string) => {
    const [min, max] = LIMITS[field]
    if (value.length < min) errors[field] = min > 0 && !value ? `Enter ${label}.` : `${label[0].toUpperCase()}${label.slice(1)} is too short.`
    else if (value.length > max) errors[field] = `Keep ${label} under ${max} characters.`
  }
  within("company", company, "the employer's name")
  within("contactName", contactName, "your name")
  within("contactRole", contactRole, "your role")
  within("details", details, "the details")
  within("website", website, "the web address")
  const domain = errors.website ? null : domainOf(website)
  if (domain === null && !errors.website) errors.website = "Enter a web address such as example.com."
  if (!contactEmail) errors.contactEmail = "Enter your work email."
  else if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = "Enter a valid email address."
  if (b.authorized !== true) errors.authorized = "Confirm that you may ask on the employer's behalf."

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { company, domain: domain || "", contactName, contactEmail, contactRole, details } }
}

// A light brake on one sender filling the store: at most 5 requests in 10 minutes from one network address, per server.
const WINDOW_MS = 10 * 60_000, PER_WINDOW = 5
const recent = new Map<string, number[]>()
export function underLimit(sender: string, now: number): boolean {
  const kept = (recent.get(sender) || []).filter(t => now - t < WINDOW_MS)
  if (recent.size > 5000) recent.clear()
  if (kept.length >= PER_WINDOW) { recent.set(sender, kept); return false }
  kept.push(now); recent.set(sender, kept)
  return true
}

export type Reply = { status: number; body: Record<string, unknown> }
export const RECEIVED = "Thank you. Your request has been received, and the owner will review it and reply to the email you gave."

/**
 * Handle one submission. `sender` is a one-way hash of the network address (used only for the brake, never stored).
 * A filled-in `homepage` field is the trap a form-filling robot falls into: it is answered as received and not kept.
 */
export async function submitBlocklistRequest(input: { body: unknown; sender: string; store: BlocklistStore; now?: number; id: string }): Promise<Reply> {
  const now = input.now ?? Date.now()
  const b = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : null
  if (!b) return { status: 400, body: { error: "Send the form as JSON." } }
  if (typeof b.homepage === "string" && b.homepage.trim()) return { status: 200, body: { ok: true, message: RECEIVED } }
  if (!underLimit(input.sender, now)) return { status: 429, body: { error: "Too many requests from this network. Try again in a few minutes." } }

  const checked = checkBlocklistRequest(b)
  if (!checked.ok) return { status: 400, body: { error: "Some fields need attention.", fields: checked.errors } }

  if (!/^[0-9a-f]{12,32}$/.test(input.id)) return { status: 500, body: { error: "The request could not be saved. Try again." } }
  const at = new Date(now).toISOString()
  try {
    await input.store.put(`${BLOCKLIST_PREFIX}/${at.slice(0, 10)}/${input.id}.json`, JSON.stringify({ id: input.id, receivedAt: at, status: "new", ...checked.value }))
  } catch {
    return { status: 500, body: { error: "The request could not be saved. Try again in a moment." } }
  }
  return { status: 200, body: { ok: true, message: RECEIVED } }
}
