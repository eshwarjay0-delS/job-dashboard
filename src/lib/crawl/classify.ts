import type { WorkType } from "./types"

// Work-type classification from a portal's raw employment-type string.
// Contract-only is the product's identity, so 'contract' must be precise;
// anything ambiguous stays 'unknown' rather than guessing wrong.

const CONTRACT = [/contract/i, /\bC2C\b/i, /temp/i, /\b1099\b/i]
const PERMANENT = [/permanent/i, /direct hire/i, /direct placement/i, /full-?time(?!.*contract)/i]

export function classifyWorkType(engagement?: string, title?: string): WorkType {
  const s = `${engagement ?? ""} ${title ?? ""}`
  if (CONTRACT.some(re => re.test(s))) return "contract"
  if (PERMANENT.some(re => re.test(s))) return "permanent"
  return "unknown"
}

/** Normalize a raw date-ish string to YYYY-MM-DD, or null. */
export function normalizeDate(raw?: string): string | null {
  if (!raw) return null
  const d = new Date(raw.replace(/(st|nd|rd|th),/g, ","))
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
