import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"

type OAuthState = {
  userId: string
  returnTo: string
  nonce: string
  exp: number
}

function key() {
  const value =
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error("Google OAuth state signing is not configured.")
  return value
}

function safeReturnTo(value: string | null | undefined) {
  const candidate = String(value || "/dashboard/connections")
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/dashboard/connections"
  return candidate
}

export function createGoogleOAuthState(userId: string, returnTo?: string) {
  const payload: OAuthState = {
    userId,
    returnTo: safeReturnTo(returnTo),
    nonce: randomBytes(18).toString("base64url"),
    exp: Date.now() + 10 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", key()).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyGoogleOAuthState(value: string): OAuthState {
  const [encoded, supplied] = String(value || "").split(".")
  if (!encoded || !supplied) throw new Error("Invalid Google OAuth state.")

  const expected = createHmac("sha256", key()).update(encoded).digest()
  const suppliedBytes = Buffer.from(supplied, "base64url")
  if (suppliedBytes.length !== expected.length || !timingSafeEqual(suppliedBytes, expected)) {
    throw new Error("Invalid Google OAuth state.")
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState
  if (!payload.userId || !payload.exp || payload.exp < Date.now()) throw new Error("Google OAuth state expired.")
  payload.returnTo = safeReturnTo(payload.returnTo)
  return payload
}
