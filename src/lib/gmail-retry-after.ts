/**
 * Convert the response's Retry-After header into a safe whole-second wait.
 * The fallback remains bounded by the caller's existing retry schedule; a
 * valid server delay is never shortened. The function is stateless so each
 * account/page response controls only its own retry.
 * @param {string | null} value
 * @param {number} fallbackSeconds
 * @param {number} [nowMs]
 * @returns {number}
 */
export function gmailRetryDelaySeconds(value, fallbackSeconds, nowMs = Date.now()) {
  const fallback = Number.isFinite(fallbackSeconds) && fallbackSeconds > 0
    ? Math.max(1, Math.ceil(fallbackSeconds))
    : 15

  if (typeof value !== "string" || !value.trim()) return fallback
  const header = value.trim()

  // RFC Retry-After delta-seconds form.
  if (/^\\d+$/.test(header)) {
    const seconds = Number(header)
    return Number.isSafeInteger(seconds) ? Math.max(fallback, seconds) : fallback
  }

  // RFC HTTP-date form. Round up so the client never retries early.
  const retryAt = Date.parse(header)
  if (!Number.isFinite(retryAt)) return fallback
  return Math.max(fallback, Math.ceil((retryAt - nowMs) / 1000))
}
