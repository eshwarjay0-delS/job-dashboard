// Safety net when AUTH_DISABLED is on and the request is the synthetic owner
// (no real session). In-memory per-IP + global token buckets; best-effort on
// Vercel because each instance has its own memory and cold starts reset it.
// No cron, poll, KV, or paid rate-limit service.
import type { NextRequest } from "next/server"
import { hasSupabaseAuthMaterial, isAuthDisabled } from "./authDisabled"
import { verifyAdminToken } from "./adminSession"
import { clientIp } from "./rateLimit"

export const SYNTHETIC_READ_PAGE_SIZE = 20

export const SYNTHETIC_OWNER_LIMITS = {
  answer: {
    ip: { max: 30, windowMs: 60_000 },
    global: { max: 300, windowMs: 3_600_000 },
  },
  transcribe: {
    ip: { max: 60, windowMs: 60_000 },
  },
  screen: {
    ip: { max: 30, windowMs: 60_000 },
    global: { max: 300, windowMs: 3_600_000 },
  },
  tailor: {
    ip: { max: 10, windowMs: 3_600_000 },
  },
  "account-sessions": {
    ip: { max: 30, windowMs: 60_000 },
    global: { max: 300, windowMs: 3_600_000 },
  },
  "resume-write": {
    ip: { max: 20, windowMs: 60_000 },
    global: { max: 100, windowMs: 3_600_000 },
  },
} as const

export type SyntheticOwnerLimitRoute = keyof typeof SYNTHETIC_OWNER_LIMITS

type Bucket = { tokens: number; updatedAt: number }
const tokenBuckets = new Map<string, Bucket>()

export function takeTokenBucket(
  key: string,
  capacity: number,
  windowMs: number,
  tokens = 1,
  now = Date.now(),
): { ok: boolean; retryAfterSec?: number } {
  if (tokenBuckets.size > 4000) {
    for (const [name, bucket] of tokenBuckets) {
      if (now - bucket.updatedAt > 2 * 3_600_000) tokenBuckets.delete(name)
    }
  }
  const refillPerMs = capacity / windowMs
  let bucket = tokenBuckets.get(key)
  if (!bucket) {
    bucket = { tokens: capacity, updatedAt: now }
    tokenBuckets.set(key, bucket)
  } else {
    bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs)
    bucket.updatedAt = now
  }
  if (bucket.tokens < tokens) {
    const need = (tokens - bucket.tokens) / refillPerMs
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(need / 1000)) }
  }
  bucket.tokens -= tokens
  return { ok: true }
}

export function resetSyntheticOwnerBuckets() {
  tokenBuckets.clear()
}

export function isSyntheticAuthIdentity(user: { synthetic?: boolean } | null | undefined): boolean {
  return !!user?.synthetic
}

export function isUnauthenticatedSyntheticOwnerRequest(
  request: NextRequest,
  user?: { synthetic?: boolean } | null,
): boolean {
  if (typeof isAuthDisabled === "function" && !isAuthDisabled()) return false
  if (user && user.synthetic === false) return false
  if (verifyAdminToken(request.cookies.get("mf_admin")?.value)) return false
  if (user?.synthetic) return true
  if (hasSupabaseAuthMaterial({
    cookies: request.cookies.getAll(),
    authorization: request.headers.get("authorization"),
  })) {
    // A present cookie/bearer is still synthetic if getUser fell back.
    return !!user?.synthetic
  }
  return isAuthDisabled()
}

const ROUTE_LABEL: Record<SyntheticOwnerLimitRoute, string> = {
  answer: "answer",
  transcribe: "transcription",
  screen: "screen",
  tailor: "tailor",
  "account-sessions": "session sync",
  "resume-write": "resume write",
}

export function rejectIfSyntheticOwnerLimited(
  request: NextRequest,
  route: SyntheticOwnerLimitRoute,
  user?: { synthetic?: boolean } | null,
): Response | null {
  if (!isUnauthenticatedSyntheticOwnerRequest(request, user)) return null
  const limits = SYNTHETIC_OWNER_LIMITS[route]
  const ip = clientIp(request) || "unknown"
  const ipLimit = takeTokenBucket(`syn-ip:${route}:${ip}`, limits.ip.max, limits.ip.windowMs)
  const globalLimit = "global" in limits && limits.global
    ? takeTokenBucket(`syn-global:${route}`, limits.global.max, limits.global.windowMs)
    : { ok: true as const }
  if (ipLimit.ok && globalLimit.ok) return null
  const retryAfterSec = Math.max(ipLimit.retryAfterSec || 1, globalLimit.retryAfterSec || 1)
  const parts = [
    `This unauthenticated login-off instance has reached its ${ROUTE_LABEL[route]} limit.`,
    `Wait ${retryAfterSec} second${retryAfterSec === 1 ? "" : "s"}, or sign in.`,
    `(${limits.ip.max} per ${limits.ip.windowMs === 60_000 ? "minute" : "hour"} per IP` +
      ("global" in limits && limits.global
        ? `; ${limits.global.max} per hour across this instance.)`
        : ".)"),
  ]
  return Response.json(
    { error: parts.join(" "), code: "RATE_LIMITED", retryAfterSec },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSec),
      },
    },
  )
}

export function syntheticReadPageSize(
  request: NextRequest,
  user: { synthetic?: boolean } | null | undefined,
  fallback: number,
): number {
  if (!isUnauthenticatedSyntheticOwnerRequest(request, user)) return fallback
  return Math.min(fallback, SYNTHETIC_READ_PAGE_SIZE)
}

export function capListForSyntheticOwner<T>(
  request: NextRequest,
  user: { synthetic?: boolean } | null | undefined,
  items: T[],
): T[] {
  if (!isUnauthenticatedSyntheticOwnerRequest(request, user)) return items
  return items.slice(0, SYNTHETIC_READ_PAGE_SIZE)
}

// Avoid dumping a full interview transcript or long history on an open instance.
export function capSessionPayloadForSyntheticOwner(
  request: NextRequest,
  user: { synthetic?: boolean } | null | undefined,
  session: unknown,
): unknown {
  if (!isUnauthenticatedSyntheticOwnerRequest(request, user)) return session
  if (!session || typeof session !== "object" || Array.isArray(session)) return session
  const next = { ...(session as Record<string, unknown>) }
  if (Array.isArray(next.transcripts)) next.transcripts = next.transcripts.slice(-5)
  if (Array.isArray(next.history)) next.history = next.history.slice(-5)
  return next
}
