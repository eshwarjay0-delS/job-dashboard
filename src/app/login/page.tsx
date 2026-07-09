"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const IMGS = {
  hero: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&h=1200&fit=crop&auto=format&q=85",
  av1:  "https://i.pravatar.cc/48?img=15",
  av2:  "https://i.pravatar.cc/48?img=29",
  av3:  "https://i.pravatar.cc/48?img=53",
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink:0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function ErrorBanner() {
  const params = useSearchParams()
  const err = params.get("error")
  if (!err) return null
  return (
    <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10,
      padding:"10px 14px", marginBottom:20, fontSize:13, color:"#dc2626" }}>
      Sign-in failed. Please try again.
    </div>
  )
}

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pro:    { label: "Pro — $49/mo",     color: "#1d6fc4", bg: "rgba(29,111,196,.08)"  },
  agency: { label: "Agency — $199/mo", color: "#7c3aed", bg: "rgba(124,58,237,.08)" },
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan") ?? ""
  const planInfo  = PLAN_LABELS[planParam] ?? null
  // After auth, go to settings#plan if a paid plan was chosen, else dashboard
  const postAuthNext = planInfo ? "/dashboard/settings%23plan" : "/dashboard/resume"

  const [googleLoading, setGoogleLoading] = useState(false)
  const [email,         setEmail]         = useState("")
  const [magicLoading,  setMagicLoading]  = useState(false)
  const [magicSent,     setMagicSent]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [showEmail,     setShowEmail]     = useState(false)
  const [isLocalhost,   setIsLocalhost]   = useState(false)
  const [demoLoading,   setDemoLoading]   = useState(false)

  // Local-dev-only demo login — a real Supabase session (anonymous auth), not a
  // fake flag, so it satisfies middleware's supabase.auth.getUser() check and
  // actually unlocks gated pages (Settings, Email, etc.) for testing. Never
  // shown outside localhost.
  useEffect(() => {
    setIsLocalhost(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  }, [])

  async function handleDemoLogin() {
    setDemoLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        setError(
          error.message.toLowerCase().includes("anonymous")
            ? "Anonymous sign-ins aren't enabled on this Supabase project yet. Turn it on: Supabase dashboard → Authentication → Providers → Anonymous Sign-Ins."
            : error.message
        )
        setDemoLoading(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(String(err))
      setDemoLoading(false)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    // Store plan in sessionStorage so settings page can pre-select it after auth
    if (planParam) { try { sessionStorage.setItem("mf_signup_plan", planParam) } catch {} }
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${postAuthNext}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      })
      if (error) { setError(error.message); setGoogleLoading(false) }
    } catch (err) {
      setError(String(err))
      setGoogleLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setMagicLoading(true)
    setError(null)
    // Store plan in sessionStorage so settings page can pre-select it after auth
    if (planParam) { try { sessionStorage.setItem("mf_signup_plan", planParam) } catch {} }
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${postAuthNext}`,
          shouldCreateUser: true,
        },
      })
      if (error) { setError(error.message); setMagicLoading(false); return }
      setMagicSent(true)
    } catch (err) {
      setError(String(err))
    }
    setMagicLoading(false)
  }

  if (magicSent) {
    return (
      <div style={{ width:"100%", maxWidth:400, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>📬</div>
        <h1 style={{ fontSize:24, fontWeight:900, color:"#1a2035", marginBottom:8 }}>Check your email</h1>
        <p style={{ fontSize:14, color:"#6b7a99", lineHeight:1.6, marginBottom:20 }}>
          We sent a magic link to <strong style={{ color:"#1a2035" }}>{email}</strong>.<br/>
          Click it to sign in — no password needed.
        </p>
        <button onClick={() => { setMagicSent(false); setEmail("") }}
          style={{ fontSize:13, color:"var(--accent)", fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
          ← Try a different email
        </button>
      </div>
    )
  }

  return (
    <div style={{ width:"100%", maxWidth:400 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#1a2035", letterSpacing:"-0.5px", lineHeight:1.15, marginBottom:8 }}>
          Welcome back 👋
        </h1>
        <p style={{ fontSize:14.5, color:"#6b7a99", lineHeight:1.5 }}>
          Sign in to your MarketFit workspace. New here? An account is created automatically.
        </p>
      </div>

      {/* Plan context banner when arriving from a pricing CTA */}
      {planInfo && (
        <div style={{
          background: planInfo.bg, border: `1px solid ${planInfo.color}30`,
          borderRadius: 10, padding: "11px 14px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
          <p style={{ fontSize: 13, color: planInfo.color, fontWeight: 600, margin: 0 }}>
            You&apos;re signing up for the <strong>{planInfo.label}</strong> plan.
            Sign in below to continue.
          </p>
        </div>
      )}

      {isLocalhost && (
        <button
          onClick={handleDemoLogin}
          disabled={demoLoading}
          style={{
            width:"100%", padding:"12px 16px", borderRadius:12, marginBottom:16,
            background:"#fffbeb", border:"1.5px dashed #f59e0b",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            fontSize:13.5, fontWeight:700, color:"#92400e",
            cursor: demoLoading ? "not-allowed" : "pointer",
            opacity: demoLoading ? .65 : 1,
          }}
        >
          🧪 {demoLoading ? "Signing in…" : "Continue as Demo (local testing only)"}
        </button>
      )}

      <Suspense fallback={null}><ErrorBanner /></Suspense>
      {error && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10,
          padding:"10px 14px", marginBottom:20, fontSize:13, color:"#dc2626" }}>
          {error}
        </div>
      )}

      {/* Google Sign-In */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        style={{
          width:"100%", padding:"14px 20px", borderRadius:12,
          background:"#ffffff", border:"1.5px solid #d0d7e3",
          display:"flex", alignItems:"center", justifyContent:"center", gap:12,
          fontSize:15, fontWeight:600, color:"#1a2035",
          cursor: googleLoading ? "not-allowed" : "pointer",
          boxShadow:"0 2px 8px rgba(0,0,0,.08)",
          transition:"all .15s",
          opacity: googleLoading ? .65 : 1,
        }}
      >
        {googleLoading ? (
          <>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
              style={{ animation:"spin 1s linear infinite", flexShrink:0 }}>
              <circle cx="12" cy="12" r="10" stroke="#d0d7e3" strokeWidth="3"/>
              <path fill="#1d6fc4" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Redirecting to Google…
          </>
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </button>

      {/* Divider */}
      <div style={{ margin:"20px 0", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1, height:1, background:"#e4e8ef" }}/>
        <span style={{ fontSize:12, color:"#9aa4bc", fontWeight:500 }}>or</span>
        <div style={{ flex:1, height:1, background:"#e4e8ef" }}/>
      </div>

      {/* Email Magic Link */}
      {!showEmail ? (
        <button
          onClick={() => setShowEmail(true)}
          style={{
            width:"100%", padding:"13px 20px", borderRadius:12,
            background:"#f4f6f9", border:"1.5px solid #e4e8ef",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            fontSize:14, fontWeight:600, color:"#6b7a99",
            cursor:"pointer", transition:"all .15s",
          }}
        >
          <span style={{ fontSize:17 }}>✉️</span>
          Continue with email (magic link)
        </button>
      ) : (
        <form onSubmit={handleMagicLink} style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            style={{
              width:"100%", padding:"13px 14px", borderRadius:11, border:"1.5px solid #d0d7e3",
              fontSize:14.5, color:"#1a2035", outline:"none", background:"#fff",
              boxSizing:"border-box",
            }}
          />
          <button
            type="submit"
            disabled={magicLoading || !email.trim()}
            style={{
              width:"100%", padding:"13px 20px", borderRadius:11,
              background: magicLoading || !email.trim() ? "color-mix(in srgb, var(--accent) 55%, white)" : "linear-gradient(145deg,var(--accent-h),var(--accent),var(--accent-h))",
              border:"none", color:"#fff", fontSize:14, fontWeight:700,
              cursor: magicLoading || !email.trim() ? "not-allowed" : "pointer",
              boxShadow:"0 4px 16px rgba(29,111,196,.25)",
            }}
          >
            {magicLoading ? "Sending…" : "Send magic link →"}
          </button>
          <button type="button" onClick={() => setShowEmail(false)}
            style={{ fontSize:12.5, color:"#9aa4bc", background:"none", border:"none", cursor:"pointer", textAlign:"center" }}>
            ← Back to Google sign-in
          </button>
        </form>
      )}

      <div style={{ background:"#f4f6f9", border:"1px solid #e4e8ef", borderRadius:10, padding:"11px 14px",
        display:"flex", gap:10, alignItems:"flex-start", marginTop:20 }}>
        <span style={{ fontSize:16, flexShrink:0 }}>🔒</span>
        <p style={{ fontSize:12, color:"#6b7a99", lineHeight:1.5, margin:0 }}>
          <strong style={{ color:"#1a2035" }}>Private by default.</strong>{" "}
          Your resumes are processed only for tailoring — never sold or shared.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:"var(--font-geist-sans, system-ui, sans-serif)" }}>

      {/* LEFT — photo panel */}
      <div className="hidden lg:block" style={{ width:"48%", position:"relative", overflow:"hidden", flexShrink:0 }}>
        <img src={IMGS.hero} alt="Professional meeting"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }}/>
        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(150deg, rgba(10,42,90,.80) 0%, rgba(29,111,196,.60) 50%, rgba(10,42,90,.85) 100%)" }}/>
        <div style={{ position:"relative", height:"100%", display:"flex", flexDirection:"column", padding:"36px 40px" }}>
          <Link href="/" style={{ display:"inline-flex", alignItems:"center", gap:10, textDecoration:"none" }}>
            <div style={{ width:36, height:36, borderRadius:9, background:"rgba(255,255,255,.18)", border:"1px solid rgba(255,255,255,.28)",
              display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:900, backdropFilter:"blur(8px)" }}>MF</div>
            <span style={{ fontSize:16, fontWeight:700, color:"#fff", letterSpacing:"-0.4px" }}>MarketFit</span>
          </Link>

          <div style={{ marginTop:"auto", marginBottom:"auto", paddingTop:40 }}>
            <h2 style={{ fontSize:36, fontWeight:900, color:"#fff", letterSpacing:"-0.8px", lineHeight:1.15, marginBottom:16, maxWidth:380 }}>
              Your career journey continues here 🌟
            </h2>
            <p style={{ color:"rgba(255,255,255,.68)", fontSize:15, lineHeight:1.6, maxWidth:360, marginBottom:32 }}>
              Pick up exactly where you left off — your resumes and tailored drafts are all waiting.
            </p>
            <div style={{ background:"rgba(255,255,255,.10)", backdropFilter:"blur(12px)",
              border:"1px solid rgba(255,255,255,.20)", borderRadius:16, padding:"18px 20px", maxWidth:360 }}>
              <p style={{ color:"rgba(255,255,255,.9)", fontSize:14, lineHeight:1.6, marginBottom:14, fontStyle:"italic" }}>
                &ldquo;I applied to 30 jobs in 2 days with MarketFit. Got 8 callbacks. The AI tailoring is genuinely magical.&rdquo;
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <img src={IMGS.av2} alt="" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover" }}/>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Marcus Lee</p>
                  <p style={{ fontSize:11.5, color:"rgba(255,255,255,.6)" }}>SWE @ Stripe · hired in 3 weeks</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex" }}>
              {[IMGS.av1, IMGS.av2, IMGS.av3].map((src, i) => (
                <img key={i} src={src} alt="" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover",
                  border:"2px solid rgba(255,255,255,.7)", marginLeft: i === 0 ? 0 : -8 }}/>
              ))}
            </div>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.65)", fontWeight:600 }}>Built for job seekers who move fast</p>
          </div>
        </div>
      </div>

      {/* RIGHT — auth form */}
      <div style={{ flex:1, backgroundColor:"#ffffff", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:"48px 32px" }}>
        <div className="lg:hidden" style={{ marginBottom:28 }}>
          <Link href="/" style={{ display:"inline-flex", alignItems:"center", gap:10, textDecoration:"none" }}>
            <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(145deg,var(--accent),var(--accent-h))",
              display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:900,
              boxShadow:"0 3px 12px rgba(29,111,196,.35)" }}>MF</div>
            <span style={{ fontSize:16, fontWeight:700, color:"#1a2035" }}>MarketFit</span>
          </Link>
        </div>
        <Suspense fallback={<div style={{ width:400, height:280, background:"#f4f6f9", borderRadius:12 }}/>}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  )
}
