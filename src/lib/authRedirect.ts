// The desktop loopback is only this computer. Anything else is dropped so the
// sign-in page cannot be turned into an open redirect.
function desktopLoopback(value: string): string {
  const match = /^http:\/\/127\.0\.0\.1:(\d+)\/cb$/.exec(value)
  if (!match) return ""
  const port = Number(match[1])
  if (!Number.isInteger(port) || String(port) !== match[1] || port < 1024 || port > 65535) return ""
  return value
}

// Allow only dashboard destinations after authentication, never arbitrary URLs.
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/dashboard"
  try {
    const url = new URL(value, "https://marketfit.invalid")
    if (url.origin !== "https://marketfit.invalid") return "/dashboard"
    // The desktop app returns here after Google sign-in in Chrome, then hands the session to Kompas. The state the
    // desktop opened it with comes back too, or the desktop refuses the sign-in. The loopback address comes back
    // only when it is 127.0.0.1. No other query survives.
    if (url.pathname === "/auth/desktop") {
      const state = url.searchParams.get("state") || ""
      const params = new URLSearchParams()
      if (/^[A-Za-z0-9_-]{20,128}$/.test(state)) params.set("state", state)
      const loop = desktopLoopback(url.searchParams.get("loopback") || "")
      if (loop) params.set("loopback", loop)
      if (url.searchParams.get("handoff") === "start") params.set("handoff", "start")
      const query = params.toString()
      return query ? "/auth/desktop?" + query : "/auth/desktop"
    }
    if (url.pathname === "/kompas" || url.pathname === "/kompas/" || url.pathname === "/kompas/index.html") {
      return "/kompas/index.html"
    }
    if (!(url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/"))) return "/dashboard"
    return url.pathname + url.search + url.hash
  } catch { return "/dashboard" }
}

// When login is off, never send the owner into admin or the desktop Chrome
// handoff. Admin stays behind a real session; the desktop does not sign in.
export function safeDisabledAuthNext(value: string | null | undefined): string {
  const next = safeAuthNext(value)
  if (next === "/auth/desktop" || next.startsWith("/auth/desktop?")) return "/dashboard"
  if (next === "/dashboard/admin" || next.startsWith("/dashboard/admin/")) return "/dashboard"
  return next
}

