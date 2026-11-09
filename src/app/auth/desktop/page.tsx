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
function handoffMode(search: string) {
  return new URLSearchParams(search).get("handoff") === "start" ? "start" : ""
}
function returnPath(state: string, loopback: string, handoff: string) {
  let path = withState("/auth/desktop", state)
  if (loopback) path += (path.includes("?") ? "&" : "?") + "loopback=" + encodeURIComponent(loopback)
  if (handoff === "start") path += (path.includes("?") ? "&" : "?") + "handoff=start"
  return path
}

// A silent desktop renewal posts the short-lived bearer back to 127.0.0.1.
// Anything else is ignored so this page cannot be used as an open redirect.
function loopbackTarget(search: string) {
  const raw = new URLSearchParams(search).get("loopback") || ""
  const match = /^http:\/\/127\.0\.0\.1:(\d+)\/cb$/.exec(raw)
  if (!match) return ""
  const port = Number(match[1])
  if (!Number.isInteger(port) || String(port) !== match[1] || port < 1024 || port > 65535) return ""
  return raw
}

// The installed desktop refuses a handoff whose expiry is missing or zero, and then
// stays on the sign-in card. A real expiry is kept. Otherwise a positive placeholder
// is enough for that check; the desktop session route sets the real lifetime.
function bearerExpiresAt(session: { expires_at?: number | null }) {
  const given = Number(session && session.expires_at)
  if (Number.isFinite(given) && given > 0) return Math.floor(given)
  return 3600
}

export default function DesktopSignIn() {
  const [note, setNote] = useState("Checking the sign-in already in this browser…")
  const [continueHref, setContinueHref] = useState("")

  useEffect(() => {
    let gone = false
    const state = desktopState(window.location.search)
    const loopback = loopbackTarget(window.location.search)
    const handoff = handoffMode(window.location.search)
    const login = "/login?next=" + encodeURIComponent(returnPath(state, loopback, handoff))
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (gone) return
      const session = data.session
      if (!session?.access_token) {
        // A silent renewal must not turn into a login form over an interview.
        // The first handoff (handoff=start) is the one case that may open Google.
        if (loopback && handoff !== "start") {
          setNote("Kompas will keep the sign-in it already has.")
          return
        }
        window.location.assign(login)
        return
      }
      // Chrome's refresh token stays in this browser. It is a different family
      // from the desktop session opened at POST /api/auth/desktop-session.
      // A bearer with no refresh token does not erase a stored desktop refresh.
      // The optional refresh field is omitted here on purpose: copying Chrome's
      // refresh token would put the desktop on the family two web tabs rotate.
      const payload = JSON.stringify({ access_token: session.access_token, expires_at: bearerExpiresAt(session) })
      const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
      // Prefer the isolated MarketFit handler over the legacy kompas handler,
      // which may still belong to an older application.
      // Launch the protocol handler only once per explicit browser handoff.
      // Repeating protocol URLs can restart the executable, trigger UAC, and
      // reopen /auth/desktop even after Chrome has authenticated. A failed
      // handoff stays visible rather than silently spawning more processes.
      // A return to 127.0.0.1 continues the window that is already open.
      // Without that address, Chrome will not open the app link unless the
      // person clicks it, so the page was staying on this sentence forever.
      const handoffUrl = withState("marketfit-kompas://auth?d=" + b64, state)
      if (loopback && state) {
        const back = loopback + "?state=" + encodeURIComponent(state) + "&d=" + encodeURIComponent(b64)
        if (typeof setContinueHref === "function") setContinueHref(back)
        setNote("You are signed in. Press Continue in Kompas if the open window does not finish on its own.")
        window.location.replace(back)
        return
      }
      if (typeof setContinueHref === "function") setContinueHref(handoffUrl)
      setNote("You are signed in. Press Continue in Kompas. The open window finishes from that click.")
      window.location.href = handoffUrl
    }).catch(() => {
      if (!gone && !loopback) window.location.assign(login)
    })
    return () => { gone = true }
  }, [])

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, display: "grid", gap: 16 }}>
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>{note}</p>
        {continueHref ? (
          <a href={continueHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "0 18px", borderRadius: 999, background: "#16140f", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Continue in Kompas</a>
        ) : null}
      </div>
    </main>
  )
}
