"use client"

import { safeAuthNext } from "@/lib/authRedirect"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import FeatureTour from "./feature-tour"
import "./login.css"

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const next = safeAuthNext(searchParams.get("next"))
  const [loading,setLoading]=useState(false)
  const [email,setEmail]=useState("eshwarjay0@gmail.com")
  const [password,setPassword]=useState("")
  const [resetMode,setResetMode]=useState(false)
  const [error,setError]=useState<string|null>(null)

  async function signIn() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const supabase=createClient()
      const { error }=await supabase.auth.signInWithOAuth({
        provider:"google",
        options:{
          redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          scopes:"email profile",
          queryParams:{ prompt:"select_account" },
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  async function emailSignIn() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const supabase=createClient()
      const { error }=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
      if (error) throw error
      window.location.assign(next)
    } catch(e) { setError(e instanceof Error?e.message:"Unable to sign in") }
    finally { setLoading(false) }
  }

  async function sendPasswordSetup() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const supabase=createClient()
      const { error }=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{
        redirectTo:`${window.location.origin}/auth/reset-password`
      })
      if (error) throw error
      setError("If the email is registered, a password setup link has been sent. Check your inbox.")
    } catch(e) { setError(e instanceof Error?e.message:"Unable to send password setup link") }
    finally { setLoading(false) }
  }

  return (
    <main className="mf-login-shell">
      <section className="mf-login-preview" aria-label="MarketFit product preview">
        <Link href="/" className="mf-login-brand">
          <span className="mf-login-brand-mark">MF</span>
          <span>MarketFit</span>
        </Link>

        <div className="mf-login-preview-head">
          <div className="ink-eyebrow">See the mechanics before you sign in</div>
          <h1>Know what MarketFit is doing before you give it your workflow.</h1>
          <p>
            Preview the core loops first. Then sign in once, add the essentials, and use the same
            account across Resume, Kompas, Gmail + Calendar, WhatsApp and the extension.
          </p>
        </div>

        <div className="mf-login-grid">
          <article className="mf-login-card">
            <div className="mf-login-card-anim mf-login-card--resume"><i/><i/><i/></div>
            <h3>Resume</h3>
            <p>Job description in, evidence matched, tailored document and fit score out.</p>
          </article>

          <article className="mf-login-card">
            <div className="mf-login-card-anim mf-login-card--kompas">
              {Array.from({length:9}).map((_,i)=><i key={i}/>)}
            </div>
            <h3>Kompas</h3>
            <p>Question recognition, evidence retrieval, answer generation and session history in one loop.</p>
          </article>

          <article className="mf-login-card">
            <div className="mf-login-card-anim mf-login-card--channels"><i/><i/><i/></div>
            <h3>Connected channels</h3>
            <p>Gmail, Calendar, WhatsApp and the extension resolve back to one MarketFit identity.</p>
          </article>

          <article className="mf-login-card">
            <div className="mf-login-card-anim mf-login-card--usage"><i/><i/></div>
            <h3>Usage + access</h3>
            <p>Usage follows the subscription and verified channels, with two active device slots.</p>
          </article>
        </div>
      </section>

      <aside className="mf-login-panel">
        <section className="mf-login-card-main">
          <div className="ink-eyebrow">Member login</div>
          <h2>One account. Every MarketFit surface.</h2>
          <p>
            Existing members can sign in directly with email and password. New accounts are created through Google only.
          </p>

          {error && <div className="mf-login-error">{error}</div>}

          <form onSubmit={e=>{e.preventDefault();void (resetMode?sendPasswordSetup():emailSignIn())}} style={{display:"grid",gap:12,marginBottom:20}}>
            <label htmlFor="mf-email">Email address</label>
            <input id="mf-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@gmail.com" style={{padding:12,borderRadius:8,border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)"}}/>
            {!resetMode && <>
              <label htmlFor="mf-password">Password</label>
              <input id="mf-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{padding:12,borderRadius:8,border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)"}}/>
            </>}
            <button type="submit" disabled={loading} className="mf-google-button">{loading?"Please wait…":resetMode?"Send password setup link":"Sign in with email"}</button>
            <button type="button" onClick={()=>{setResetMode(!resetMode);setError(null)}} style={{background:"transparent",border:0,color:"var(--accent)",cursor:"pointer"}}>{resetMode?"Back to sign in":"Set or reset password"}</button>
          </form>
          <p style={{textAlign:"center",margin:"12px 0"}}>New to MarketFit? Register with Google</p>
          <button onClick={signIn} disabled={loading} className="mf-google-button">
            <GoogleIcon /> {loading ? "Redirecting to Google…" : "Sign up or continue with Google"}
          </button>

          <div className="mf-login-note">
            Your subscription, verified mobile number, WhatsApp identity, optional Google Workspace
            connection and extension all attach to the same MarketFit account.
          </div>

          <FeatureTour onContinue={signIn} />
        </section>
      </aside>
    </main>
  )
}

export default function LoginPage(){
  return <Suspense fallback={<div style={{minHeight:"100vh"}}/>}><LoginContent/></Suspense>
}
