"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Signup and login are the same flow with Google OAuth.
// Redirect /signup → /login, preserving any query params (e.g. ?plan=pro).
export default function SignUpPage() {
  const router = useRouter()
  useEffect(() => {
    // Forward search params so plan context (e.g. ?plan=pro) reaches /login
    const search = window.location.search
    router.replace(`/login${search}`)
  }, [router])
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"#f4f6f9", fontFamily:"system-ui, sans-serif" }}>
      <p style={{ color:"#6b7a99", fontSize:14 }}>Redirecting…</p>
    </div>
  )
}
