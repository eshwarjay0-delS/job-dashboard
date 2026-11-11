// One place for sign-in copy, local JWT fallback, and a single 401 retry.
// A later patch may add logout-key clearing and the sign-out route body on
// top of these names. Do not start a refresh interval here.

export const LOGOUT_STORAGE_KEYS = ["sb-access-token", "sb-refresh-token"]

/** Names logout drops. Interview records such as perfact.sessions stay. */
export const AUTH_STORAGE_KEYS = [
  "perfact.user",
  "perfact.desktopTicket",
  "perfact.authHint",
  "perfact.cloud.owner",
] as const

const SUPABASE_AUTH_KEY = /^sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?$/

export function isAuthStorageKey(name: string): boolean {
  const key = String(name || "")
  if ((AUTH_STORAGE_KEYS as readonly string[]).includes(key)) return true
  if (SUPABASE_AUTH_KEY.test(key)) return true
  if (key.startsWith("perfact.cloud.")) return true
  return false
}

export function authKeysToClear(names: readonly string[]): string[] {
  return Array.from(new Set(names.filter(isAuthStorageKey)))
}

export function authErrorMessage(kind: string): string {
  switch (kind) {
    case "login": return "We could not sign you in. Check your connection and try again."
    case "logout": return "You have been signed out on this device."
    case "refresh": return "Your session could not be renewed. Sign in again if this continues."
    case "expired": return "Your session ended. Sign in again to keep going."
    case "denied": return "You do not have access to that. Sign in with the right account, or ask the owner."
    case "network": return "The network dropped while signing in. Check your connection and try again."
    default: return "Something went wrong with sign-in. Please try again."
  }
}

/** One 401 is worth a single refresh-and-retry. A second 401, or any other status, is not. */
export function shouldRefreshAndRetry(status: number, alreadyRetried: boolean): boolean {
  return status === 401 && alreadyRetried === false
}

export const AUTH_UNAVAILABLE =
  "MarketFit could not reach the sign-in service. Nothing was signed out. Return to Kompas and try again."
export const AUTH_RETRY = "Sign-in did not finish. Return to Kompas and try again."
export const AUTH_CLAIMED = "Kompas has the sign-in. You can close this tab."
export const AUTH_WAITING =
  "Return to Kompas. This page says the desktop is signed in only after Kompas has taken the code."
export const AUTH_NONCE =
  "This sign-in does not match the Kompas window that asked for it. Return to Kompas and try again."
export const AUTH_EXPIRED = "This sign-in code expired. Return to Kompas and try again."
export const AUTH_USED = "This sign-in code was already used. Return to Kompas and try again."

export const ACCESS_REFRESH_LEAD_MS = 60_000

export function plainAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const lower = message.toLowerCase()
  if (!message) return AUTH_RETRY
  if (/egress|quota|unavailable|fetch failed|network|timeout|econnrefused|enotfound|503/.test(lower)) return AUTH_UNAVAILABLE
  if (/invalid login|invalid credentials|invalid email or password/.test(lower)) {
    return "That email or password was not accepted. Try again, or continue with Google."
  }
  return message.length > 180 ? AUTH_RETRY : message
}

export function isAuthUnreachable(error: { message?: string; status?: number; name?: string } | null | undefined): boolean {
  if (!error) return false
  const name = String(error.name || "")
  const message = String(error.message || "").toLowerCase()
  const status = Number(error.status)
  if (name === "AuthRetryableFetchError") return true
  if (status === 0 || (Number.isFinite(status) && status >= 500)) return true
  return /fetch failed|network|timeout|unreachable|econnrefused|enotfound|exceed_egress|egress quota/.test(message)
}

export function shouldRefreshBeforeExpiry(expiresAtSec: number, nowMs: number, leadMs = ACCESS_REFRESH_LEAD_MS): boolean {
  if (!Number.isFinite(expiresAtSec) || expiresAtSec <= 0) return false
  return expiresAtSec * 1000 - nowMs <= leadMs
}

export function millisecondsUntilRefresh(expiresAtSec: number, nowMs: number, leadMs = ACCESS_REFRESH_LEAD_MS): number | null {
  if (!Number.isFinite(expiresAtSec) || expiresAtSec <= 0) return null
  const delay = expiresAtSec * 1000 - leadMs - nowMs
  if (delay <= 0) return 0
  return delay
}

export async function refreshOnceOn401<T>(
  run: () => Promise<T>,
  is401: (result: T) => boolean,
  refresh: () => Promise<boolean>,
): Promise<T> {
  const first = await run()
  if (!is401(first)) return first
  const ok = await refresh()
  if (!ok) return first
  return run()
}

type Claims = Record<string, unknown> | null | undefined

export function userFromClaims(claims: Claims, nowSec = Math.floor(Date.now() / 1000)): { id: string; email: string | null; exp: number } | null {
  if (!claims) return null
  const sub = typeof claims.sub === "string" ? claims.sub : ""
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sub)) return null
  if (claims.is_anonymous === true || claims.role === "anon") return null
  const exp = Number(claims.exp)
  if (!Number.isFinite(exp) || exp <= nowSec) return null
  const email = typeof claims.email === "string" ? claims.email : null
  const confirmed = claims.email_verified === true || typeof claims.email_confirmed_at === "string"
  return { id: sub, email: confirmed ? email : null, exp }
}

type UserLike = { id?: string; email?: string | null; is_anonymous?: boolean; email_confirmed_at?: string | null }
type AuthErrorLike = { message?: string; status?: number; name?: string } | null

export type AuthClientLike = {
  auth: {
    getUser: () => Promise<{ data?: { user?: UserLike | null } | null; error?: AuthErrorLike }>
    getClaims?: () => Promise<{ data?: { claims?: Record<string, unknown> | null } | null; error?: AuthErrorLike }>
  }
}

export type ResolvedAuthUser =
  | { id: string; email: string | null; unreachable: false }
  | { id: ""; email: null; unreachable: true }

// getUser() talks to Supabase. When that call cannot reach the service, a
// still-valid access token is accepted from getClaims() (local signature
// check). A missing session, an anonymous session, or a token the service
// rejected is signed out. An outage with no verifiable token is `unreachable`
// so the page does not bounce to the login form.
export async function userFromAuthClient(client: AuthClientLike, nowSec = Math.floor(Date.now() / 1000)): Promise<ResolvedAuthUser | null> {
  let user: UserLike | null = null
  let error: AuthErrorLike = null
  try {
    const result = await client.auth.getUser()
    user = result.data?.user ?? null
    error = result.error ?? null
  } catch (err) {
    error = err instanceof Error ? err : { message: "fetch failed" }
  }
  if (!error && user?.id && !user.is_anonymous) {
    return { id: user.id, email: user.email_confirmed_at ? user.email ?? null : null, unreachable: false }
  }
  if (!isAuthUnreachable(error)) return null
  if (typeof client.auth.getClaims === "function") {
    try {
      const claimsResult = await client.auth.getClaims()
      if (!isAuthUnreachable(claimsResult.error)) {
        const local = userFromClaims(claimsResult.data?.claims, nowSec)
        if (local) return { id: local.id, email: local.email, unreachable: false }
        return null
      }
    } catch (err) {
      if (!isAuthUnreachable(err instanceof Error ? err : { message: "fetch failed" })) return null
    }
  }
  return { id: "", email: null, unreachable: true }
}
