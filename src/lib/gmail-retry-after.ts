/**
 * Convert the response's Retry-After header into a safe whole-second wait.
 * A valid server delay is never shortened. A syntactically valid numeric
 * value too large for JavaScript's safe integer range becomes a conservative
 * hold sentinel; the caller must not schedule an early retry for it.
 * @param {string | null} value
 * @param {number} fallbackSeconds
 * @param {number} [nowMs]
 * @returns {number}
 */
export function gmailRetryDelaySeconds(value: string | null, fallbackSeconds: number, nowMs = Date.now()): number {
  const fallback = Number.isFinite(fallbackSeconds) && fallbackSeconds > 0
    ? Math.max(1, Math.ceil(fallbackSeconds))
    : 15

  if (typeof value !== "string" || !value.trim()) return fallback
  const header = value.trim()

  // RFC Retry-After delta-seconds form.
  if (/^\d+$/.test(header)) {
    const seconds = Number(header)
    if (!Number.isSafeInteger(seconds)) return Number.MAX_SAFE_INTEGER
    return Math.max(fallback, seconds)
  }

  // RFC HTTP-date form. Round up so the client never retries early.
  const retryAt = Date.parse(header)
  if (!Number.isFinite(retryAt)) return fallback
  return Math.max(fallback, Math.ceil((retryAt - nowMs) / 1000))
}

/** A single automatic browser wait is capped at 24 hours. Longer server
 * delays are preserved as a hold, not shortened to a timer that fires early.
 */
export const MAX_AUTOMATIC_GMAIL_RETRY_MS = 24 * 60 * 60 * 1000

export function gmailRetryAutoWaitMs(seconds: number): number | null {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null
  const milliseconds = seconds * 1000
  return Number.isSafeInteger(milliseconds) && milliseconds <= MAX_AUTOMATIC_GMAIL_RETRY_MS
    ? milliseconds
    : null
}

export function gmailRetryWaitLabel(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 365 * 24 * 60 * 60) return "an unusually long period"
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`
  if (seconds < 60 * 60) {
    const minutes = Math.ceil(seconds / 60)
    return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`
  }
  if (seconds < 24 * 60 * 60) {
    const hours = Math.ceil(seconds / (60 * 60))
    return `about ${hours} ${hours === 1 ? "hour" : "hours"}`
  }
  const days = Math.floor(seconds / (24 * 60 * 60))
  const remainder = seconds % (24 * 60 * 60)
  return remainder === 0
    ? `${days} ${days === 1 ? "day" : "days"}`
    : `more than ${days} ${days === 1 ? "day" : "days"}`
}
