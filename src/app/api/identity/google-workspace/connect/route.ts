import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { encryptSecret } from "@/lib/secretCrypto"

export const runtime = "nodejs"

const WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const accessToken = String(body.accessToken || "")
  const refreshToken = String(body.refreshToken || "")
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Google did not return an offline refresh token. Reconnect and approve access." }, { status: 400 })
  }

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  })
  const info = await infoRes.json().catch(() => ({}))
  if (!infoRes.ok || !info.sub || !info.email) {
    return NextResponse.json({ error: "Could not verify the connected Google account." }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.rpc("identity_attach_google_workspace", {
    p_user_id: user.id,
    p_google_subject: String(info.sub),
    p_google_email: String(info.email),
    p_scopes: WORKSPACE_SCOPES,
    p_refresh_token_ciphertext: encryptSecret(refreshToken),
    p_gmail_enabled: true,
    p_calendar_enabled: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, email: info.email })
}
