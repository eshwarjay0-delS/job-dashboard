"use client"

// Auth callback — client-side handler covering ALL Supabase auth flows:
//
//  1. PKCE  → ?code=CODE
//     Used by Google OAuth. With @supabase/ssr the code verifier lives in a
//     cookie, so exchangeCodeForSession works here in the browser; the browser
//     client then writes the session cookies the server middleware reads.
//
//  2. OTP   → ?token_hash=HASH&type=email
//     Standard Supabase magic links (signInWithOtp). No code verifier needed.
//
//  3. Implicit → #access_token=TOKEN (hash fragment)
//     Older Supabase configs. Hash is invisible to the server.
//
// One client handler covers every link shape Supabase might send, which a
// server route (only ?code=) cannot. Also upserts the profile row after auth.

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function CallbackHandler() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function handle() {
      const supabase   = createClient()
      const code       = searchParams.get("code")
      const token_hash = searchParams.get("token_hash")
      const type       = (searchParams.get("type") ?? "email") as
                         "email" | "recovery" | "invite" | "magiclink"
      const next       = searchParams.get("next") ?? "/dashboard/resume"

      // ── 1. PKCE flow ────────────────────────────────────────────────────
      if (code) {
        const { data, error: err } = await supabase.auth.exchangeCodeForSession(code)
        if (!err && data.session) {
          const complete = await afterAuth(supabase, data.session.user.id, data.session.user.email)
          if (!cancelled) router.replace(complete ? next : "/dashboard/setup")
          return
        }
        console.warn("[auth/callback] exchangeCodeForSession failed:", err?.message)
        // Fall through to token_hash or error
      }

      // ── 2. OTP / token_hash flow ─────────────────────────────────────────
      if (token_hash) {
        const { data, error: err } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!err && data.session) {
          const complete = await afterAuth(supabase, data.session.user.id, data.session.user.email)
          if (!cancelled) router.replace(complete ? next : "/dashboard/setup")
          return
        }
        console.warn("[auth/callback] verifyOtp failed:", err?.message)
        if (!cancelled) setError(err?.message ?? "Link verification failed")
        return
      }

      // ── 3. Hash fragment / implicit flow ─────────────────────────────────
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        // Supabase's browser client picks up the hash automatically
        const { data, error: err } = await supabase.auth.getSession()
        if (!err && data.session) {
          const complete = await afterAuth(supabase, data.session.user.id, data.session.user.email)
          if (!cancelled) router.replace(complete ? next : "/dashboard/setup")
          return
        }
        // Give the auth listener a moment to process
        await new Promise(r => setTimeout(r, 800))
        const { data: d2, error: e2 } = await supabase.auth.getSession()
        if (!e2 && d2.session) {
          const complete = await afterAuth(supabase, d2.session.user.id, d2.session.user.email)
          if (!cancelled) router.replace(complete ? next : "/dashboard/setup")
          return
        }
        if (!cancelled) setError(e2?.message ?? "Could not read session from link")
        return
      }

      // ── No usable params ─────────────────────────────────────────────────
      // Most likely the Supabase redirect URL allowlist rejected the redirect
      // and sent the user to the site root instead of /auth/callback.
      if (!cancelled) {
        setError(
          "No authentication parameters found. " +
          "The link may have expired, or the callback URL may not be in your " +
          "Supabase allowed redirect URLs. Add http://localhost:3000/auth/callback " +
          "(and your production URL) in Supabase → Auth → URL Configuration."
        )
      }
    }

    handle()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f4f6f9", padding: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 36px",
          boxShadow: "0 4px 24px rgba(26,32,53,.1)", maxWidth: 440, width: "100%", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a2035", marginBottom: 10 }}>
            Sign-in link failed
          </h2>
          <p style={{ fontSize: 13, color: "#6b7a99", lineHeight: 1.65, marginBottom: 20 }}>
            {error}
          </p>
          <p style={{ fontSize: 12, color: "#9aa4bc", lineHeight: 1.5, marginBottom: 24 }}>
            Magic links are single-use and expire after 1 hour. Request a new one below.
          </p>
          <a href="/login" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(145deg,var(--accent),var(--accent-h))", color: "#fff",
            textDecoration: "none", fontSize: 14, fontWeight: 700,
            boxShadow: "0 4px 16px rgba(29,111,196,.3)",
          }}>
            ← Back to sign-in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f4f6f9",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "36px 40px",
        boxShadow: "0 4px 24px rgba(26,32,53,.1)", textAlign: "center",
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
          style={{ animation: "spin 1s linear infinite", marginBottom: 16 }}>
          <circle cx="12" cy="12" r="10" stroke="#e4e8ef" strokeWidth="3"/>
          <path fill="#1d6fc4" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#1a2035", margin: 0 }}>
          Signing you in…
        </p>
        <p style={{ fontSize: 13, color: "#9aa4bc", marginTop: 8 }}>
          You&apos;ll be redirected automatically.
        </p>
      </div>
    </div>
  )
}

// ── Post-auth tasks ─────────────────────────────────────────────────────────
// Upserts the profile row (fire-and-forget-safe — onConflict never overwrites
// existing fields with nulls) and reports whether onboarding is done, so the
// caller can route first-time / incomplete-profile users into the setup wizard
// instead of straight into the dashboard. The user-resumes directory is created
// automatically on first GET /api/user-resumes call.
async function afterAuth(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email?: string,
): Promise<boolean> {
  try {
    await supabase.from("profiles").upsert(
      { id: userId, email: email ?? null },
      { onConflict: "id", ignoreDuplicates: false },
    )
  } catch { /* non-critical */ }
  try {
    const { data } = await supabase.from("profiles").select("profile_complete").eq("id", userId).maybeSingle()
    return !!data?.profile_complete
  } catch {
    return true // can't tell — don't trap the user in a redirect loop over a read failure
  }
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#f4f6f9", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <p style={{ color: "#9aa4bc" }}>Verifying…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
