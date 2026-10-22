// Login timestamp retained for diagnostics. It is not an expiry policy: the
// browser and desktop rotate their refresh session silently until the server
// says that session was revoked or can no longer be renewed.

export const LOGIN_CLOCK_KEY = "mf_login_at";
export const MINIMUM_EXPECTED_SESSION_MS = 3 * 24 * 60 * 60 * 1000;

export function stampLoginClock(now: number = Date.now()): void {
  try {
    localStorage.setItem(LOGIN_CLOCK_KEY, String(now));
  } catch {
    // Storage unavailable (private mode, embedded webview): the server-side
    // session cap still applies; the pre-expiry redirect just cannot run.
  }
}

export function loginClockStart(): number {
  try {
    const v = parseInt(localStorage.getItem(LOGIN_CLOCK_KEY) || "", 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function clearLoginClock(): void {
  try {
    localStorage.removeItem(LOGIN_CLOCK_KEY);
  } catch {
    // Nothing to clear against.
  }
}

// First sight of a live session starts the clock (covers sign-in paths that
// never pass through the auth callback, e.g. a restored desktop session).
export function ensureLoginClock(now: number = Date.now()): number {
  const start = loginClockStart();
  if (start) return start;
  stampLoginClock(now);
  return now;
}
