import { safeAuthNext } from "./authRedirect";

// One server-side auth decision for every page route, shared by middleware.
// Returns the redirect target, or null to serve the page as requested.
// hasUser must come from a verified getUser(), never from a raw cookie value:
// a cookie can name a user whose token already died, and an anonymous session
// is not a sign-in (same rule as the API boundary in lib/authBoundary).
export function authGateRedirect(pathname: string, search: string, nextParam: string | null, hasUser: boolean): string | null {
  if (pathname === "/" && hasUser) return "/dashboard"
  if (pathname === "/login" && hasUser) return safeAuthNext(nextParam)
  if ((pathname === "/dashboard" || pathname.startsWith("/dashboard/")) && !hasUser) {
    return "/login?next=" + encodeURIComponent(pathname + search)
  }
  return null
}
