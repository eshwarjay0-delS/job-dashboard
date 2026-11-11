// Client-side read of the server flag. AUTH_DISABLED itself is not a
// NEXT_PUBLIC_ value, so the browser cannot see it at build time. One
// capabilities request; no polling.
export async function serverReportsAuthDisabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/kompas/capabilities", { cache: "no-store" })
    const body = res.ok ? await res.json() as { authDisabled?: unknown } : null
    return !!(body && body.authDisabled === true)
  } catch {
    return false
  }
}
