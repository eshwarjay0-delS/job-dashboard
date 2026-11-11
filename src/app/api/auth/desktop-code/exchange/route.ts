import { NextResponse, type NextRequest } from "next/server"
import { exchangeDesktopAuthCode } from "@/lib/desktopAuthCode"
import { supabaseAuthCodeStore } from "@/lib/desktopAuthCodeStore"
import { desktopAuthPort, type DesktopAuthPort } from "@/lib/desktopSession"
import { supabaseDesktopAuth } from "@/lib/desktopSessionSupabase"
import { AUTH_UNAVAILABLE } from "@/lib/kompasAuthSession"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

// The desktop sends the code from the deep link, or the code it polled, plus
// the nonce it issued. One success mints a desktop session. A second call,
// a wrong nonce, an expired code, or a Supabase error does not say success.
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { body = null }
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as { code?: unknown; nonce?: unknown } : {}
  const code = typeof record.code === "string" ? record.code : ""
  const nonce = typeof record.nonce === "string" ? record.nonce : ""
  const limit = checkRateLimit("desktop-auth-exchange:" + nonce.slice(0, 16), { max: 30, windowMs: 2 * 60_000 })
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many sign-in attempts. Return to Kompas and try again." },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec ?? 60) } },
    )
  }
  const port: DesktopAuthPort = desktopAuthPort(supabaseDesktopAuth)
  try {
    const result = await exchangeDesktopAuthCode(supabaseAuthCodeStore(), { code, nonce }, async (pending) => {
      if (!pending.email) {
        return { session: null, unavailable: false, message: "This account has no confirmed email, so Kompas cannot open a desktop session. Return to Kompas and try again." }
      }
      const minted = await port.mintIndependentSession({ id: pending.userId, email: pending.email })
      if (minted.session) {
        return {
          session: {
            accessToken: minted.session.accessToken,
            refreshToken: minted.session.refreshToken,
            expiresAt: minted.session.expiresAt,
            userId: minted.session.userId || pending.userId,
          },
        }
      }
      const unavailable = minted.error?.code === "issuer_unavailable"
      return {
        session: null,
        unavailable,
        message: unavailable ? AUTH_UNAVAILABLE : "Kompas could not open a desktop session. Return to Kompas and try again.",
      }
    })
    return NextResponse.json(result.body, { status: result.status, headers: noStore })
  } catch {
    return NextResponse.json(
      { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
      { status: 503, headers: noStore },
    )
  }
}
