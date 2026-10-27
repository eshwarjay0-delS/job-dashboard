"use client"

import { safeAuthNext } from "@/lib/authRedirect"
import { stampLoginClock } from "@/lib/session-clock"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Check } from "lucide-react"
import MarketFitLoginStory from "./marketfit-login-story"

const field = "h-11 w-full rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-[15px] text-[var(--text)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]"

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
  const [email,setEmail]=useState("")
  const [password,setPassword]=useState("")
  const [resetMode,setResetMode]=useState(false)
  const [emailOpen,setEmailOpen]=useState(false)
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
    if(!["eshwarjay05@gmail.com","janjiaarya@gmail.com","tryguessup@gmail.com"].includes(email.trim().toLowerCase())){setError("Password login is not enabled for this account.");return}
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const supabase=createClient()
      const { error }=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
      if (error) throw error
      stampLoginClock()
      window.location.assign(["janjiaarya@gmail.com","tryguessup@gmail.com"].includes(email.trim().toLowerCase()) ? "/dashboard/resume" : next)
    } catch(e) { setError(e instanceof Error?e.message:"Unable to sign in") }
    finally { setLoading(false) }
  }

  async function sendPasswordSetup() {
    if(!["eshwarjay05@gmail.com","janjiaarya@gmail.com","tryguessup@gmail.com"].includes(email.trim().toLowerCase())){setError("Password login is not enabled for this account.");return}
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

  // The look (design system 2, 14 Oct 2026): the sign-in page people already know. A calm brand panel on one side; on the
  // other one card, with Google first (how almost everyone signs in), and email and password one tap away for the
  // accounts that have it. How signing in works is unchanged.
  return (
    <main className="grid min-h-dvh bg-[var(--bg)] lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface-2)] lg:grid lg:grid-rows-[auto_minmax(300px,1fr)_auto_auto] lg:gap-y-4 lg:p-8 xl:p-12" aria-label="About MarketFit">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_16%,transparent),transparent)]" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--accent)] font-display text-[13px] font-bold text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.18)]">MF</span>
          <span className="font-display text-[20px] font-bold tracking-[-0.01em] text-[var(--text)]">MarketFit</span>
        </Link>
        <div className="relative flex min-h-[300px] w-full items-stretch justify-stretch py-2"><MarketFitLoginStory /></div>
        <div className="relative max-w-md pb-4">
          <h1 className="font-display text-[40px] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--text)]">A calmer job search starts here.</h1>
          <ul className="mt-8 space-y-4">
            {[
              "Your own resume, fitted to each job in about a minute",
              "Your years and titles kept exactly as you wrote them",
              "Recruiter mail and interviews, in one place",
            ].map(line => (
              <li key={line} className="flex items-start gap-3 text-[16px] leading-[1.55] text-[var(--text-muted)]">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface))]"><Check size={14} className="text-[var(--accent)]" /></span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[13px] text-[var(--text-soft)]">© 2026 MarketFit · <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link> · <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link></p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--accent)] font-display text-[13px] font-bold text-[var(--bg)]">MF</span>
            <span className="font-display text-[20px] font-bold text-[var(--text)]">MarketFit</span>
          </Link>
          <div className="mb-5 lg:hidden"><MarketFitLoginStory compact /></div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
            <h2 className="text-[26px] font-bold tracking-[-0.02em] text-[var(--text)]">Sign in</h2>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--text-muted)]">New here? The same button creates your account. Your first tailored resume is free.</p>

            {error && <div role="alert" className="mt-5 rounded-[10px] border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[14px] text-[var(--danger)]">{error}</div>}

            <button type="button" onClick={signIn} disabled={loading}
              className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] text-[15.5px] font-semibold text-[var(--text)] shadow-[0_1px_2px_rgba(25,20,10,.06)] transition-[border-color,box-shadow,transform] hover:border-[var(--text-soft)] hover:shadow-[var(--shadow-card-hover)] active:scale-[.99] disabled:cursor-wait disabled:opacity-60">
              <GoogleIcon /> {loading ? "Opening Google…" : "Continue with Google"}
            </button>

            <div className="my-6 flex items-center gap-3 text-[13px] text-[var(--text-soft)]"><span className="h-px flex-1 bg-[var(--border)]" />or<span className="h-px flex-1 bg-[var(--border)]" /></div>

            {!emailOpen ? (
              <button type="button" onClick={() => setEmailOpen(true)} className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] text-[15px] font-semibold text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
                Sign in with email and password
              </button>
            ) : (
              <form onSubmit={e => { e.preventDefault(); void (resetMode ? sendPasswordSetup() : emailSignIn()) }} className="grid gap-3">
                <label htmlFor="mf-email" className="text-[14px] font-semibold text-[var(--text)]">Email</label>
                <input id="mf-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className={field} />
                {!resetMode && <>
                  <label htmlFor="mf-password" className="mt-1 text-[14px] font-semibold text-[var(--text)]">Password</label>
                  <input id="mf-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={field} />
                </>}
                <button type="submit" disabled={loading} className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.14)] transition-colors hover:bg-[var(--accent-h)] disabled:cursor-wait disabled:opacity-60">
                  {loading ? "Please wait…" : resetMode ? "Send a link to set a password" : "Sign in"}
                </button>
                <button type="button" onClick={() => { setResetMode(!resetMode); setError(null) }} className="cursor-pointer text-[14px] font-semibold text-[var(--accent)] hover:underline">
                  {resetMode ? "Back to sign in" : "Set or reset a password"}
                </button>
                <p className="text-[13px] leading-[1.5] text-[var(--text-soft)]">Email and password is open to accounts that have it turned on. Everyone else continues with Google.</p>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-[13px] leading-[1.6] text-[var(--text-soft)]">By continuing you agree to the <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link> and the <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy policy</Link>.</p>
        </div>
      </section>
    </main>
  )
}

export default function LoginPage(){
  return <Suspense fallback={<div style={{minHeight:"100vh"}}/>}><LoginContent/></Suspense>
}
