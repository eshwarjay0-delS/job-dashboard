// The login clock — owner rule, 20 Oct 2026: a sign-in lasts 3 days.
// Silent token refresh keeps the session alive inside that window, but when
// the app is opened during the FINAL 24 hours the user is sent to the login
// page to authenticate again and start a fresh 3 days, instead of the
// session lapsing mid-use later. The stamp lives in localStorage so the web
// dashboard and the Kompas client (same origin) read the same clock; the
// Supabase project time-box set in the dashboard is the server-side cap
// behind it.

export const LOGIN_CLOCK_KEY = "mf_login_at";
export const LOGIN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
export const REAUTH_AFTER_MS = LOGIN_TTL_MS - 24 * 60 * 60 * 1000; // final 24h

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

export function reauthDue(now: number = Date.now()): boolean {
  const start = loginClockStart();
  return start > 0 && now - start >= REAUTH_AFTER_MS;
}
