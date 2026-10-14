"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

// The desktop window does not sign in itself. Chrome already has the Google session, so this page
// reads that session and hands it to the installed Kompas app. A missing session goes through the
// normal sign-in page and comes back here.
export default function DesktopSignIn() {
  const [note, setNote] = useState("Checking the sign-in already in this browser…")

  useEffect(() => {
    let gone = false
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (gone) return
      const session = data.session
      if (!session?.access_token) {
        window.location.assign("/login?next=/auth/desktop")
        return
      }
      const cookies = document.cookie.split(";").map(part => part.trim()).filter(part => /auth-token/i.test(part)).map(part => {
        const at = part.indexOf("=")
        return { name: decodeURIComponent(part.slice(0, at)), value: decodeURIComponent(part.slice(at + 1)) }
      }).filter(c => c.name && c.value)
      const payload = JSON.stringify({ access_token: session.access_token, cookies })
      const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
      setNote("Chrome is signed in. Allow the browser to open Kompas.")
      window.location.href = "kompas://auth?d=" + b64
    }).catch(() => {
      if (!gone) window.location.assign("/login?next=/auth/desktop")
    })
    return () => { gone = true }
  }, [])

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ maxWidth: 420, fontSize: 18, lineHeight: 1.5 }}>{note}</p>
    </main>
  )
}
