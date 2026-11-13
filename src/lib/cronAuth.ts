import { timingSafeEqual } from "node:crypto"

/** Validate a cron bearer token without leaking secret bytes or accepting short configuration. */
export function hasCronBearer(header: string | null, secret: string): boolean {
  if (secret.length < 16) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header || "")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
