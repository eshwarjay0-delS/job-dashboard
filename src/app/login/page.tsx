"use client"

import { safeAuthNext } from "@/lib/authRedirect"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
  const [error,setError]=useState<string|null>(null)

  async function signIn() {
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

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"var(--surface-2,#f7f5ef)"}}>
      <section style={{width:"100%",maxWidth:430,background:"var(--surface,#fff)",border:"1px solid var(--border,#e6e2d9)",borderRadius:20,padding:32,boxShadow:"0 16px 48px rgba(20,18,12,.08)"}}>
        <Link href="/" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:10,marginBottom:28}}>
          <span style={{width:38,height:38,borderRadius:10,display:"grid",placeItems:"center",background:"var(--accent,#6b6858)",color:"#fff",fontWeight:900}}>MF</span>
          <strong style={{color:"var(--text,#161510)"}}>MarketFit</strong>
        </Link>
        <h1 style={{fontSize:30,lineHeight:1.1,letterSpacing:"-.6px",margin:"0 0 10px",color:"var(--text,#161510)"}}>One account. Every MarketFit surface.</h1>
        <p style={{fontSize:14,lineHeight:1.6,color:"var(--text-muted,#6e6b5b)",margin:"0 0 24px"}}>
          Sign in with Google. Your subscription, verified mobile number, WhatsApp, Gmail/Calendar connection and extension all attach to this identity.
        </p>
        {error && <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid #d9d3c7",fontSize:13,marginBottom:14}}>{error}</div>}
        <button onClick={signIn} disabled={loading} style={{width:"100%",minHeight:50,borderRadius:12,border:"1.5px solid #d3cdc0",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:700,cursor:loading?"wait":"pointer",opacity:loading?.7:1}}>
          <GoogleIcon /> {loading?"Redirecting to Google…":"Continue with Google"}
        </button>
        <div style={{marginTop:18,padding:"12px 14px",borderRadius:11,background:"var(--surface-2,#f7f5ef)",fontSize:12.5,lineHeight:1.55,color:"var(--text-muted,#6e6b5b)"}}>
          After sign-in, you verify one unique mobile number. That number can be linked to one WhatsApp identity, and each subscription can use up to two active devices.
        </div>
      </section>
    </main>
  )
}

export default function LoginPage(){
  return <Suspense fallback={<div style={{minHeight:"100vh"}}/>}><LoginContent/></Suspense>
}
