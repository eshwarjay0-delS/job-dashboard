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

// A silent desktop renewal posts the short-lived bearer back to 127.0.0.1.
// Anything else is ignored so this page cannot be used as an open redirect.
function loopbackTarget(search: string) {
  const raw = new URLSearchParams(search).get("loopback") || ""
  try {
    const url = new URL(raw)
    const port = Number(url.port)
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/cb") return ""
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return ""
    return url.origin + "/cb"
  } catch {
    return ""
  }
}

export default function DesktopSignIn() {
  const [note, setNote] = useState("Checking the sign-in already in this browser…")

  useEffect(() => {
    let gone = false
    const state = desktopState(window.location.search)
    const loopback = loopbackTarget(window.location.search)
    const login = "/login?next=" + encodeURIComponent(withState("/auth/desktop", state))
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (gone) return
      const session = data.session
      if (!session?.access_token) {
        // A silent renewal must not turn into a login form over an interview.
        if (loopback) {
          setNote("Kompas will keep the sign-in it already has.")
          return
        }
        window.location.assign(login)
        return
      }
      // Never duplicate Chrome's rotating refresh-token family in Electron.
      // The native app receives a short-lived bearer only after the callback
      // passes its own one-use state and validates that bearer server-side.
      const payload = JSON.stringify({ access_token: session.access_token, expires_at: session.expires_at || 0 })
      const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
      // Prefer the isolated MarketFit handler over the legacy kompas handler,
      // which may still belong to an older application.
      // Launch the protocol handler only once per explicit browser handoff.
      // Repeating protocol URLs can restart the executable, trigger UAC, and
      // reopen /auth/desktop even after Chrome has authenticated. A failed
      // handoff stays visible rather than silently spawning more processes.
      setNote("Opening Kompas…")
      if (loopback && state) {
        const back = new URL(loopback)
        back.searchParams.set("state", state)
        back.searchParams.set("d", b64)
        window.location.replace(back.toString())
        return
      }
      window.location.href = withState("marketfit-kompas://auth?d=" + b64, state)
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
