// Reversible login switch. Fail-closed: AUTH_DISABLED or
// NEXT_PUBLIC_AUTH_DISABLED lifts sign-in only when the value is exactly
// "true". Unset, "false", "1", "on", "yes", or any other value keeps today's login.
//
// Machine-to-machine secrets (CRON_SECRET, WATCHDOG_CRON_SECRET,
// AUTO_REPLY_CRON_SECRET, WhatsApp, Gmail crawl verification) stay required.
// This flag only covers people signing in.
// Same address as src/lib/owner.ts PRODUCT_OWNER_EMAIL — kept here so this
// module stays a leaf and tests can import it directly.
const PRODUCT_OWNER_EMAIL = "eshwarjay0@gmail.com"

export const AUTH_DISABLED_FALLBACK_USER_ID = "00000000-0000-4000-8000-000000000001"

type Env = Record<string, string | undefined>

function readFlag(env: Env, name: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(env, name)) return undefined
  return env[name]
}

/** True when the app should not require a person to sign in. */
export function isAuthDisabled(env: Env = process.env): boolean {
  const raw = readFlag(env, "AUTH_DISABLED") ?? readFlag(env, "NEXT_PUBLIC_AUTH_DISABLED")
  return raw === "true"
}

export function isSyntheticDisabledAuthUser(user: unknown): boolean {
  if (!user || typeof user !== "object") return false
  const meta = (user as { app_metadata?: { auth_disabled_synthetic?: unknown } }).app_metadata
  return meta?.auth_disabled_synthetic === true
}

function firstWhatsAppOwnerUserId(env: Env = process.env): string {
  const items = String(env.WHATSAPP_OWNER_NUMBERS || "").split(",").map(s => s.trim()).filter(Boolean)
  for (const entry of items) {
    const userId = entry.split("=")[1]?.trim()
    if (userId) return userId
  }
  return ""
}

// Data in Supabase (Kompas account sessions, resumes, Gmail links, profiles)
// is keyed by auth.users.id. Prefer an explicit id, then the user id already
// listed beside a WhatsApp owner number. Email classifies the owner but does
// not key those rows. Candidate profiles (Houston vs Saint Louis) stay a
// separate picker; this identity does not choose one.
export function disabledOwnerUser(env: Env = process.env): { id: string; email: string } {
  const email = String(env.AUTH_DISABLED_EMAIL || env.OWNER_EMAIL || PRODUCT_OWNER_EMAIL).trim().toLowerCase()
  const id = String(env.AUTH_DISABLED_USER_ID || env.OWNER_USER_ID || "").trim()
    || firstWhatsAppOwnerUserId(env)
    || AUTH_DISABLED_FALLBACK_USER_ID
  return { id, email }
}

export function disabledOwnerAsUser(env: Env = process.env) {
  const { id, email } = disabledOwnerUser(env)
  const now = "2020-01-01T00:00:00.000Z"
  return {
    id,
    email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: now,
    confirmed_at: now,
    last_sign_in_at: now,
    created_at: now,
    updated_at: now,
    app_metadata: { provider: "env", providers: ["env"], auth_disabled_synthetic: true },
    user_metadata: {},
    identities: [] as unknown[],
    is_anonymous: false,
    phone: "",
  }
}

function ownerSession(env: Env = process.env) {
  const user = disabledOwnerAsUser(env)
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  return {
    access_token: "auth-disabled",
    refresh_token: "auth-disabled",
    token_type: "bearer",
    expires_in: 365 * 24 * 60 * 60,
    expires_at: expiresAt,
    user,
  }
}

function looksLikeAuthCookie(name: string): boolean {
  return /^(sb-.*-auth-token|sb-.*-auth-token\.\d+)$/.test(name)
}

export function hasSupabaseAuthMaterial(input?: {
  cookies?: { name: string }[]
  authorization?: string | null
}): boolean {
  if (input?.authorization && /^Bearer\s+\S+$/i.test(input.authorization)) return true
  return (input?.cookies || []).some(cookie => looksLikeAuthCookie(cookie.name))
}

type AuthClient = {
  auth: {
    getUser: (...args: unknown[]) => Promise<{ data: { user: unknown }; error: unknown }>
    getSession: (...args: unknown[]) => Promise<{ data: { session: unknown }; error: unknown }>
    getClaims?: (...args: unknown[]) => Promise<{ data: { claims: unknown }; error: unknown }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

// When login is lifted, a missing or dead session becomes the owner. A still-
// valid cookie or bearer session is kept so already-keyed rows keep loading.
// skipNetwork avoids a Supabase getUser round-trip when the request has no
// credentials at all (Hobby egress).
export function attachDisabledAuthFallback<T extends AuthClient>(
  client: T,
  options: { skipNetwork?: boolean; env?: Env } = {},
): T {
  const env = options.env || process.env
  if (!isAuthDisabled(env)) return client
  const auth = client.auth
  const originalGetUser = auth.getUser.bind(auth)
  const originalGetSession = auth.getSession.bind(auth)
  const originalGetClaims = typeof auth.getClaims === "function" ? auth.getClaims.bind(auth) : null
  const owner = () => disabledOwnerAsUser(env)
  const skipNetwork = !!options.skipNetwork

  auth.getUser = async (...args: unknown[]) => {
    if (skipNetwork && args.length === 0) return { data: { user: owner() }, error: null }
    try {
      const result = await originalGetUser(...args)
      const user = result?.data?.user as { id?: string; is_anonymous?: boolean } | null
      if (!result?.error && user?.id && !user.is_anonymous) return result
    } catch { /* fall through to the owner identity */ }
    return { data: { user: owner() }, error: null }
  }

  auth.getSession = async (...args: unknown[]) => {
    if (skipNetwork && args.length === 0) {
      return { data: { session: ownerSession(env) }, error: null }
    }
    try {
      const result = await originalGetSession(...args)
      const session = result?.data?.session as { user?: { id?: string; is_anonymous?: boolean } } | null
      if (!result?.error && session?.user?.id && !session.user.is_anonymous) return result
    } catch { /* fall through */ }
    return { data: { session: ownerSession(env) }, error: null }
  }

  if (originalGetClaims) {
    auth.getClaims = async (...args: unknown[]) => {
      if (skipNetwork && args.length === 0) {
        const user = owner()
        return { data: { claims: { sub: user.id, email: user.email, role: "authenticated", email_verified: true } }, error: null }
      }
      try {
        const result = await originalGetClaims(...args)
        const claims = result?.data?.claims as { sub?: string; is_anonymous?: boolean; role?: string } | null
        if (!result?.error && claims?.sub && claims.is_anonymous !== true && claims.role !== "anon") return result
      } catch { /* fall through */ }
      const user = owner()
      return { data: { claims: { sub: user.id, email: user.email, role: "authenticated", email_verified: true } }, error: null }
    }
  }

  return client
}
