import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Gmail OAuth callback
// After the user grants gmail.readonly permission, Supabase exchanges the code
// and stores provider_token + provider_refresh_token on the session.
// We save the refresh_token to the profiles table so subsequent syncs
// (after the access token expires) can use it server-side.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Google sends ?error=access_denied (&error_description=...) when the user
  // declines consent OR when gmail.readonly is blocked (unverified/restricted
  // scope, user not a test user). Surface that instead of a generic failure.
  const oauthError = searchParams.get("error")
  const oauthErrorDesc = searchParams.get("error_description")
  // Return the user to where they started (e.g. the Pipeline gate). Only allow
  // internal paths — never an external URL — to avoid an open-redirect.
  const ret = searchParams.get("return") || "/dashboard/email"
  const safeRet = ret.startsWith("/") && !ret.startsWith("//") ? ret : "/dashboard/email"
  const withFlag = (flag: string, reason?: string) => {
    const sep = safeRet.includes("?") ? "&" : "?"
    const base = `${origin}${safeRet}${sep}gmail=${flag}`
    return reason ? `${base}&reason=${encodeURIComponent(reason.slice(0, 140))}` : base
  }

  // 1. Google rejected the grant before we ever got a code.
  if (oauthError) {
    console.error("[auth/callback/gmail] OAuth error from Google:", oauthError, oauthErrorDesc)
    return NextResponse.redirect(withFlag("error", oauthErrorDesc || oauthError))
  }

  // 2. No code AND no error → the redirect URL almost certainly isn't in
  //    Supabase's allow-list, so Supabase dropped us here without params.
  if (!code) {
    console.error("[auth/callback/gmail] No code and no error in callback URL")
    return NextResponse.redirect(
      withFlag("error", "No authorization code. Add this exact URL to Supabase → Auth → URL Configuration → Redirect URLs.")
    )
  }

  // 3. Exchange the code for a session.
  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.session) {
    console.error("[auth/callback/gmail] exchangeCodeForSession failed:", error?.message)
    return NextResponse.redirect(withFlag("error", error?.message || "Could not complete sign-in."))
  }

  const user = data.session.user
  const refreshToken = data.session.provider_refresh_token

  // Persist refresh token to profiles so we can refresh after expiry. If Google
  // didn't return one (no access_type=offline, or a re-consent without prompt),
  // sync still works for ~1hr on the live provider_token but won't survive expiry.
  if (refreshToken) {
    try {
      await supabase.from("profiles").update({
        gmail_refresh_token: refreshToken,
        gmail_connected_at: new Date().toISOString(),
      }).eq("id", user.id)
    } catch {
      // profiles table might not have gmail columns yet — non-fatal
    }
  } else {
    console.warn("[auth/callback/gmail] No provider_refresh_token returned; sync limited to the live access token.")
  }

  // Redirect back to where the user started, with the success flag so that
  // page can set mf_gmail_connected and lift the blur gate.
  return NextResponse.redirect(withFlag("connected"))
}
