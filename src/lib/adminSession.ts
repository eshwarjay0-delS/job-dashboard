import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"

export const ADMIN_SESSION_SECONDS = 8 * 60 * 60
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ""

export function makeAdminToken(now = Date.now()): string {
  const key = secret()
  if (!key) throw new Error("Admin session secret is not configured")
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS
  const payload = `v2.${expires}.${randomBytes(24).toString("hex")}`
  return `${payload}.${createHmac("sha256", key).update(payload).digest("hex")}`
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret()
  if (!key || !token || token.length > 180) return false
  const parts = token.split(".")
  if (parts.length !== 4 || parts[0] !== "v2" || !/^\d{10,12}$/.test(parts[1]) ||
      !/^[a-f0-9]{48}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false
  const expires = Number(parts[1]), seconds = Math.floor(now / 1000)
  if (expires <= seconds || expires > seconds + ADMIN_SESSION_SECONDS) return false
  const expected = createHmac("sha256", key).update(parts.slice(0, 3).join(".")).digest()
  const supplied = Buffer.from(parts[3], "hex")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
