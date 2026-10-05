import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { encryptSecret } from "@/lib/secretCrypto"
import { verifyGoogleOAuthState } from "@/lib/googleOAuthState"

export const runtime = "nodejs"

function redirectWith(req: NextRequest, returnTo: string, params: Record<string,string>) {
  const url = new URL(returnTo, req.nextUrl.origin)
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const rawState = req.nextUrl.searchParams.get("state")
  const oauthError = req.nextUrl.searchParams.get("error")

  let state
  try {
    if (!rawState) throw new Error("Missing OAuth state.")
    state = verifyGoogleOAuthState(rawState)
  } catch {
    return NextResponse.redirect(new URL("/dashboard/connections?google_error=invalid_state", req.url))
  }

  if (oauthError) return redirectWith(req, state.returnTo, { google_error: oauthError })
  if (!code) return redirectWith(req, state.returnTo, { google_error: "missing_code" })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state.userId) {
    return redirectWith(req, state.returnTo, { google_error: "session_mismatch" })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return redirectWith(req, state.returnTo, { google_error: "server_not_configured" })
  }

  const redirectUri = `${req.nextUrl.origin}/api/identity/google-workspace/callback`
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(20000),
  })
  const tokens = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokens.access_token) {
    return redirectWith(req, state.returnTo, { google_error: "token_exchange_failed" })
  }

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15000),
  })
  const info = await infoRes.json().catch(() => ({}))
  if (!infoRes.ok || !info.sub || !info.email) {
    return redirectWith(req, state.returnTo, { google_error: "account_verification_failed" })
  }

  const service = createServiceClient()

  // Re-connections should normally receive a refresh token because the flow uses
  // prompt=consent + access_type=offline. If Google omits it, preserve an existing
  // connection only when we can find the same subject; otherwise ask for consent again.
  let refreshToken = String(tokens.refresh_token || "")
  if (!refreshToken) {
    const { data: existing } = await service.rpc("identity_list_google_workspace_accounts", { p_user_id: user.id })
    const same = (existing || []).find((row: any) => String(row.google_email).toLowerCase() === String(info.email).toLowerCase())
    if (!same) return redirectWith(req, state.returnTo, { google_error: "refresh_token_missing" })

    const { data: stored } = await service.rpc("identity_get_google_workspace_account", {
      p_user_id: user.id,
      p_account_id: same.id,
    })
    const row = Array.isArray(stored) ? stored[0] : stored
    if (!row?.refresh_token_ciphertext) {
      return redirectWith(req, state.returnTo, { google_error: "refresh_token_missing" })
    }

    // Reuse the already-encrypted token by calling the attach RPC below with its
    // ciphertext untouched.
    const { error } = await service.rpc("identity_attach_google_workspace_account", {
      p_user_id: user.id,
      p_google_subject: String(info.sub),
      p_google_email: String(info.email),
      p_scopes: String(tokens.scope || "").split(/\s+/).filter(Boolean),
      p_refresh_token_ciphertext: String(row.refresh_token_ciphertext),
      p_gmail_enabled: true,
      p_calendar_enabled: true,
    })
    if (error) return redirectWith(req, state.returnTo, { google_error: encodeURIComponent(error.message) })
    return redirectWith(req, state.returnTo, { google: "connected", email: String(info.email) })
  }

  const { error } = await service.rpc("identity_attach_google_workspace_account", {
    p_user_id: user.id,
    p_google_subject: String(info.sub),
    p_google_email: String(info.email),
    p_scopes: String(tokens.scope || "").split(/\s+/).filter(Boolean),
    p_refresh_token_ciphertext: encryptSecret(refreshToken),
    p_gmail_enabled: true,
    p_calendar_enabled: true,
  })
  if (error) {
    const message = error.message.includes("up to 4") ? "limit_reached" :
      error.message.includes("another MarketFit account") ? "already_linked" : "save_failed"
    return redirectWith(req, state.returnTo, { google_error: message })
  }

  return redirectWith(req, state.returnTo, { google: "connected", email: String(info.email) })
}
