import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }

/**
 * POST /api/auth/desktop-session/issue
 * An authenticated web session authorizes ONE native sign-in. Supabase Auth
 * mints a separate, one-use magic-link proof; its token hash is handed to the
 * installed Windows app via the existing one-use native callback nonce.
 * Browser refresh tokens are never copied into the device session.
 */
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE })
  const limit = checkRateLimit("kompas-device-grant:" + user.id, { max: 4, windowMs: 60_000 })
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: NO_STORE })
  try {
    const admin = createServiceClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email })
    const token_hash = data?.properties?.hashed_token
    // Never let a source email select a different account. The user's verified
    // authenticated ID must equal the account Supabase selected for the link.
    if (error || data?.user?.id !== user.id || typeof token_hash !== "string" ||
        !/^[a-f0-9]{64}$/.test(token_hash))
      return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE })
    return NextResponse.json({ ok: true, token_hash }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE })
  }
}
