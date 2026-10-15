import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createGoogleOAuthState } from "@/lib/googleOAuthState"

export const runtime = "nodejs"

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard/connections", req.url))

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL("/dashboard/connections?google_error=server_not_configured", req.url))
  }

  const returnTo = req.nextUrl.searchParams.get("return") || "/dashboard/connections"
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/identity/google-workspace/callback`
  const state = createGoogleOAuthState(user.id, returnTo)

  // Smart prompt: first account gets full consent; accounts 2-4 just get the
  // account picker. Google still shows permissions once per NEW account (their
  // rule), but we skip the redundant re-consent theater after the user already
  // trusts the app.
  let prompt = "consent select_account"
  try {
    const { data: existing } = await supabase.rpc("identity_list_google_workspace_accounts", { p_user_id: user.id })
    if (existing && existing.length > 0) prompt = "select_account"
  } catch {
    // If the count check fails, fall back to full consent — safe default.
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt,
    state,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
