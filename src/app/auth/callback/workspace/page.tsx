"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function WorkspaceCallback() {
  const router = useRouter()
  const params = useSearchParams()
  const [error,setError]=useState("")

  useEffect(()=>{
    let cancelled=false
    async function run(){
      const code=params.get("code")
      const returnTo=params.get("return") || "/dashboard/setup"
      if(!code) throw new Error("Google authorization code was missing.")
      const supabase=createClient()
      const { data, error }=await supabase.auth.exchangeCodeForSession(code)
      if(error || !data.session) throw error || new Error("Google session exchange failed.")
      const accessToken=data.session.provider_token
      const refreshToken=data.session.provider_refresh_token
      const res=await fetch("/api/identity/google-workspace/connect",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({accessToken,refreshToken}),
      })
      const body=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(body.error || "Could not save Google Workspace connection.")
      if(!cancelled) router.replace(returnTo)
    }
    run().catch(e=>{ if(!cancelled) setError(String(e instanceof Error?e.message:e)) })
    return()=>{cancelled=true}
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  if(error) return <div style={{maxWidth:520,margin:"100px auto",padding:24}}>Google connection failed: {error}</div>
  return <div style={{maxWidth:520,margin:"100px auto",padding:24}}>Connecting Gmail and Calendar…</div>
}

export default function Page(){
  return <Suspense fallback={<div/>}><WorkspaceCallback/></Suspense>
}
