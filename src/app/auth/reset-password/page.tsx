"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [password,setPassword]=useState("")
  const [confirm,setConfirm]=useState("")
  const [message,setMessage]=useState("Open this page from the password recovery link in your email.")
  const [ready,setReady]=useState(false)
  const [loading,setLoading]=useState(false)
  useEffect(()=>{
    const supabase=createClient()
    void supabase.auth.getSession().then(({data})=>{if(data.session)setReady(true)})
    const {data}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="PASSWORD_RECOVERY" || event==="SIGNED_IN")setReady(true)
    })
    return ()=>data.subscription.unsubscribe()
  },[])
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(password.length<12){setMessage("Use a password of at least 12 characters.");return}
    if(password!==confirm){setMessage("Passwords do not match.");return}
    setLoading(true)
    const {error}=await createClient().auth.updateUser({password})
    setLoading(false)
    setMessage(error?error.message:"Password updated. You can now sign in.")
    if(!error){setPassword("");setConfirm("")}
  }
  return <main style={{maxWidth:440,margin:"12vh auto",padding:24}}>
    <h1>Set your MarketFit password</h1>
    <p>{message}</p>
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
