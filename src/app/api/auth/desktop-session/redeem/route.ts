import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }

/** A one-time OTP creates a separate native session family with its own refresh
 * token. It never accepts the user's email or user ID from the desktop.
 */
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 200)
    return NextResponse.json({ ok: false }, { status: 413, headers: NO_STORE })
  const ip = request.headers.get("x-real-ip") || "unknown"
  const limit = checkRateLimit("kompas-device-redeem:" + ip, { max: 20, windowMs: 60_000 })
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: NO_STORE })
  const payload = await request.json().catch(() => null)
  const token_hash = payload && typeof payload === "object" ? (payload as Record<string, unknown>).token_hash : null
  if (typeof token_hash !== "string" || !/^[a-f0-9]{64}$/.test(token_hash))
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE })
  try {
    const client = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.verifyOtp({ type: "magiclink", token_hash })
    const s = data.session
    if (error || !s || !s.user?.id || s.user.is_anonymous ||
        !s.refresh_token || !s.access_token || !s.expires_at)
      return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE })
    return NextResponse.json({
      ok: true, userId: s.user.id,
      access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE })
  }
}
