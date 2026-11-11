import { NextResponse, type NextRequest } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { createDesktopAuthCode, desktopAuthCodeStatus, pollDesktopAuthCode } from "@/lib/desktopAuthCode"
import { supabaseAuthCodeStore } from "@/lib/desktopAuthCodeStore"
import { AUTH_UNAVAILABLE } from "@/lib/kompasAuthSession"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

// POST creates a two-minute code for the nonce the desktop issued.
// GET ?nonce= is the desktop poll. GET ?code= is the website status.
// Neither path says the desktop is signed in. Claiming happens at exchange.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "auth_required", message: "Sign in on the website, then return to Kompas." },
      { status: 401, headers: noStore },
    )
  }
  const limit = checkRateLimit("desktop-auth-code:" + user.id, { max: 10, windowMs: 10 * 60_000 })
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many sign-in attempts. Wait a minute, then return to Kompas and try again." },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec ?? 60) } },
    )
  }
  let body: unknown
  try { body = await request.json() } catch { body = null }
  const nonce = body && typeof body === "object" && !Array.isArray(body) ? (body as { nonce?: unknown }).nonce : ""
  if (typeof nonce !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_nonce", message: "Return to Kompas and start sign-in from the app." },
      { status: 400, headers: noStore },
    )
  }
  try {
    const result = await createDesktopAuthCode(supabaseAuthCodeStore(), { nonce, userId: user.id, email: user.email })
    return NextResponse.json(result.body, { status: result.status, headers: noStore })
  } catch {
    return NextResponse.json(
      { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
      { status: 503, headers: noStore },
    )
  }
}

export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get("nonce") || ""
  const code = request.nextUrl.searchParams.get("code") || ""
  try {
    const store = supabaseAuthCodeStore()
    if (nonce) {
      const result = await pollDesktopAuthCode(store, nonce)
      return NextResponse.json(result.body, { status: result.status, headers: noStore })
    }
    if (code) {
      const result = await desktopAuthCodeStatus(store, code)
      return NextResponse.json(result.body, { status: result.status, headers: noStore })
    }
  } catch {
    return NextResponse.json(
      { ok: false, status: "error", message: AUTH_UNAVAILABLE },
      { status: 503, headers: noStore },
    )
  }
  return NextResponse.json(
    { ok: false, status: "error", message: "Return to Kompas and start sign-in from the app." },
    { status: 400, headers: noStore },
  )
}
