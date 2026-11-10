import { contractTypes } from "../contract-jobs.ts"
import type { WorkType } from "./types"

// Work-type classification from a portal's raw employment-type string.
// Keep the crawler aligned with Apply's contract evidence taxonomy (W2, C2C,
// 1099, C2H, temporary and contract). Ambiguous W2-only and substring matches
// stay unknown; ordinary permanent/direct-hire roles remain permanent.

const PERMANENT = [/\bpermanent\b/i, /\bdirect hire\b/i, /\bdirect placement\b/i, /\bfull-?time\b/i]

export function classifyWorkType(engagement?: string, title?: string): WorkType {
  const s = `${engagement ?? ""} ${title ?? ""}`
  if (contractTypes(s).length > 0) return "contract"
  if (PERMANENT.some(re => re.test(s))) return "permanent"
  return "unknown"
}

/** Normalize a raw date-ish string to YYYY-MM-DD, or null. */
export function normalizeDate(raw?: string): string | null {
  if (!raw) return null
  const d = new Date(raw.replace(/(st|nd|rd|th),/g, ","))
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
