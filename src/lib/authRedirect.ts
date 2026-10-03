// Allow only dashboard destinations after authentication, never arbitrary URLs.
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/dashboard"
  try {
    const url = new URL(value, "https://marketfit.invalid")
    if (url.origin !== "https://marketfit.invalid" ||
        !(url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/"))) return "/dashboard"
    return url.pathname + url.search + url.hash
  } catch { return "/dashboard" }
}
