"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [password,setPassword]=useState("")
  const [confirm,setConfirm]=useState("")
  const [message,setMessage]=useState("Open this page from the password recovery link in your email.")
  const [ready,setReady]=useState(false)
  const [accountEmail,setAccountEmail]=useState("")
  const [loading,setLoading]=useState(false)
  useEffect(()=>{
    const supabase=createClient()
    void (async()=>{
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setMessage("This setup link is invalid or expired. Request a new link."); return }
        window.history.replaceState({}, "", window.location.pathname)
      }
      const {data}=await supabase.auth.getUser()
      if(data.user) setAccountEmail(data.user.email||"")
      if(data.user && ["eshwarjay05@gmail.com","janjiaarya@gmail.com","tryguessup@gmail.com"].includes((data.user.email||"").toLowerCase())) setReady(true)
      else setMessage("Sign in with an approved account to set a password.")
    })()
    const {data}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="PASSWORD_RECOVERY" || event==="SIGNED_IN") void supabase.auth.getUser().then(({data})=>{if(data.user && ["eshwarjay05@gmail.com","janjiaarya@gmail.com","tryguessup@gmail.com"].includes((data.user.email||"").toLowerCase())) setReady(true)})
    })
    return ()=>data.subscription.unsubscribe()
  },[])
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(password.length<12){setMessage("Use a password of at least 12 characters.");return}
    if(password!==confirm){setMessage("Passwords do not match.");return}
    setLoading(true)
    const client=createClient()
    const {data:identity}=await client.auth.getUser()
    if(!identity.user || !["eshwarjay05@gmail.com","janjiaarya@gmail.com","tryguessup@gmail.com"].includes((identity.user.email||"").toLowerCase())) {setLoading(false);setMessage("Not an approved account.");return}
    const {error}=await client.auth.updateUser({password})
    setLoading(false)
    setMessage(error?error.message:"Password updated. You can now sign in.")
    if(!error){setPassword("");setConfirm("")}
  }
  return <main style={{maxWidth:440,margin:"12vh auto",padding:24}}>
    <h1>Set your MarketFit password</h1>
    <p>{message}</p>
    {accountEmail && <p>Signed in as: <strong>{accountEmail}</strong></p>}
    {ready && <form onSubmit={save} style={{display:"grid",gap:12}}>
      <label htmlFor="new-pass">New password</label>
      <input id="new-pass" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/>
      <label htmlFor="confirm-pass">Confirm password</label>
      <input id="confirm-pass" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
      <button disabled={loading} type="submit">{loading?"Saving…":"Save password"}</button>
    </form>}
    <p><Link href="/login">Return to login</Link></p>
  </main>
}
