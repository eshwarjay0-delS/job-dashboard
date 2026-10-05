import { createClient } from "@/lib/supabase/client"

// ── Simple Google sign-in (identity only) ────────────────────────────────────
// Just asks for the user's name + email. No Drive permission, no scary consent.
// This is what the login and signup pages use.
export async function signInWithGoogle(next = "/dashboard/resume") {
  const supabase = createClient()
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "email profile",
    },
  })
}

// ── Drive connect (upgrade path, from Settings only) ─────────────────────────
// Asks for drive.file scope so CareerKit can save resumes to the user's Drive.
// access_type=offline + prompt=consent ensures we get a refresh token.
// Only called when the user explicitly clicks "Connect Google Drive" in Settings.
export const GOOGLE_DRIVE_SCOPES =
  "email profile https://www.googleapis.com/auth/drive.file"

export async function connectGoogleDrive() {
  const supabase = createClient()
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback/drive`,
      scopes: GOOGLE_DRIVE_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  })
}

// ── Gmail connect ─────────────────────────────────────────────────────────────
// Requests gmail.readonly scope so CareerOS can scan for job emails.
// access_type=offline + prompt=consent ensures we get a refresh token.
// After the OAuth flow completes, the Supabase session will have provider_token
// (access token) and provider_refresh_token. These are passed to /api/gmail-sync.
export const GOOGLE_WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ")

// Optional second consent after MarketFit login. This intentionally does NOT
// use Supabase OAuth because a secondary Google account must not replace the
// user's MarketFit authentication session. The server runs a standard Google
// authorization-code flow and stores the grant against the existing MarketFit user.
export async function connectGoogleWorkspace(returnPath = "/dashboard/setup") {
  const target = `/api/identity/google-workspace/start?return=${encodeURIComponent(returnPath)}`
  window.location.assign(target)
  return { data: null, error: null }
}

export const connectGmail = connectGoogleWorkspace

// Legacy export kept so any existing import doesn't break during the transition.
export const signInWithGoogleDrive = signInWithGoogle