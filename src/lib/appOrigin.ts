/**
 * Public site origin for this deployment.
 * Set NEXT_PUBLIC_APP_URL (or APP_URL) to the canonical https origin so the
 * same build can run on Vercel or a parallel host such as Oracle + Cloudflare Tunnel.
 * Optional comma-separated ALLOWED_ORIGINS / KOMPAS_ALLOWED_ORIGINS lists extra
 * browser origins (desktop, tunnel hostname) that may call the API.
 */
export const VERCEL_CANONICAL_ORIGIN = "https://job-dashboard-fawn.vercel.app"

type Env = NodeJS.Dict<string | undefined>

function originOf(value: string): string | "" {
  const text = String(value || "").trim()
  if (!text) return ""
  try {
    const url = new URL(text)
    if (url.protocol !== "https:" && url.protocol !== "http:") return ""
    if (url.username || url.password) return ""
    if (!url.hostname) return ""
    return url.origin
  } catch {
    return ""
  }
}

/** Configured public origin, or "" when unset / invalid. */
export function configuredAppOrigin(env: Env = process.env): string {
  return originOf(env.NEXT_PUBLIC_APP_URL || env.APP_URL || env.KOMPAS_PUBLIC_ORIGIN || "")
}

/**
 * Origin to put in outbound links and user-agents.
 * Prefer the configured env, then the request's own origin, then the historical Vercel default.
 */
export function appOrigin(requestOrigin?: string | null, env: Env = process.env): string {
  return configuredAppOrigin(env) || originOf(requestOrigin || "") || VERCEL_CANONICAL_ORIGIN
}

export function allowedOrigins(env: Env = process.env): string[] {
  const found = new Set<string>()
  const configured = configuredAppOrigin(env)
  if (configured) found.add(configured)
  const listed = `${env.ALLOWED_ORIGINS || ""},${env.KOMPAS_ALLOWED_ORIGINS || ""}`
  for (const part of listed.split(",")) {
    const origin = originOf(part)
    if (origin) found.add(origin)
  }
  return [...found]
}

export function isAllowedOrigin(origin: string, requestUrl?: string | null, env: Env = process.env): boolean {
  const candidate = originOf(origin)
  if (!candidate) return !String(origin || "").trim()
  if (requestUrl) {
    const own = originOf(requestUrl)
    if (own && candidate === own) return true
  }
  return allowedOrigins(env).includes(candidate)
}
