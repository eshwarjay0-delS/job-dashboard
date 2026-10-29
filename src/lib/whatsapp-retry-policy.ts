/** Bounded exponential retry for a failed WhatsApp resume rewrite. */
export function retryDelayMs(attempts: number): number {
  return Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(7, Math.max(0, attempts - 1)))
}
