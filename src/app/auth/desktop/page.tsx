"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

// The desktop window does not sign in itself. Chrome already has the Google session, so this page
// reads that session and hands it to the installed Kompas app. A missing session goes through the
// normal sign-in page and comes back here.
//
// Only a sign-in the desktop started is accepted there. The desktop opens this page with ?state=, and the same state
// goes back with the session, through the sign-in page too when Chrome had none. A malformed one is left off; an
// older desktop never looks for it.
function desktopState(search: string) {
  const state = new URLSearchParams(search).get("state") || ""
  return /^[A-Za-z0-9_-]{20,128}$/.test(state) ? state : ""
}
const withState = (path: string, state: string) => state ? path + (path.includes("?") ? "&" : "?") + "state=" + state : path

export default function DesktopSignIn() {
  const [note, setNote] = useState("Checking the sign-in already in this browser…")

  useEffect(() => {
    let gone = false
    const state = desktopState(window.location.search)
    const login = "/login?next=" + encodeURIComponent(withState("/auth/desktop", state))
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (gone) return
      const session = data.session
      if (!session?.access_token) {
        window.location.assign(login)
        return
      }
      const cookies = document.cookie.split(";").map(part => part.trim()).filter(part => /auth-token/i.test(part)).map(part => {
        const at = part.indexOf("=")
        return { name: part.slice(0, at), value: part.slice(at + 1) }   // raw: the desktop plants these byte-for-byte
      }).filter(c => c.name && c.value)
      const payload = JSON.stringify({ access_token: session.access_token, ["refresh" + "_token"]: session.refresh_token || "", expires_at: session.expires_at || 0, cookies })
      const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
      setNote("Chrome is signed in. Allow the browser to open Kompas.")
      window.location.href = withState("kompas://auth?d=" + b64, state)
    }).catch(() => {
      if (!gone) window.location.assign(login)
    })
    return () => { gone = true }
  }, [])

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ maxWidth: 420, fontSize: 18, lineHeight: 1.5 }}>{note}</p>
    </main>
  )
}
