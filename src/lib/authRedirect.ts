// Allow only dashboard destinations after authentication, never arbitrary URLs.
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/dashboard"
  try {
    const url = new URL(value, "https://marketfit.invalid")
    if (url.origin !== "https://marketfit.invalid") return "/dashboard"
    // The desktop app returns here after Google sign-in in Chrome, then hands the session to Kompas. The state the
    // desktop opened it with comes back too, or the desktop refuses the sign-in; no other query survives.
    if (url.pathname === "/auth/desktop") {
      const state = url.searchParams.get("state") || ""
      return /^[A-Za-z0-9_-]{20,128}$/.test(state) ? "/auth/desktop?state=" + state : "/auth/desktop"
    }
    if (!(url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/"))) return "/dashboard"
    return url.pathname + url.search + url.hash
  } catch { return "/dashboard" }
}
