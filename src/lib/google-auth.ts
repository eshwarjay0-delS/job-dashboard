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
export const GMAIL_SCOPES =
  "email profile https://www.googleapis.com/auth/gmail.readonly"

// `returnPath` lets the caller send the user back to where they clicked Connect
// (e.g. the Pipeline gate) instead of always landing on /dashboard/email.
export async function connectGmail(returnPath?: string) {
  const supabase = createClient()
  const cb = `${window.location.origin}/auth/callback/gmail` +
    (returnPath ? `?return=${encodeURIComponent(returnPath)}` : "")
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: cb,
      scopes: GMAIL_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  })
}

// Legacy export kept so any existing import doesn't break during the transition.
export const signInWithGoogleDrive = signInWithGoogle
