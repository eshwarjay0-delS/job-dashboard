// ── Lightweight in-memory IP rate limiting ───────────────────────────────────
// For unauthenticated routes that call a paid LLM/API with the SERVER's own key
// (no per-user quota to lean on). In-memory = resets on restart/redeploy, which
// is fine for a single-instance deploy; swap for Redis/Upstash before scaling to
// multiple instances.

const buckets = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const rec = buckets.get(key)
  if (!rec || now - rec.windowStart >= opts.windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { ok: true }
  }
  if (rec.count >= opts.max) {
    return { ok: false, retryAfterSec: Math.ceil((opts.windowMs - (now - rec.windowStart)) / 1000) }
  }
  rec.count++
  return { ok: true }
}

export function clientIp(request: Request): string {
  const h = request.headers
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown"
}
