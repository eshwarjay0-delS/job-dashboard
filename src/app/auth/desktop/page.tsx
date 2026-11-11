"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

// The desktop window does not sign in itself. Chrome already has the Google
// session. This page mints a two-minute single-use code bound to the nonce
// the desktop put in ?state=, then hands that code back. Chrome's refresh
// token stays in this browser. It is a different family from the desktop
// session opened at POST /api/auth/desktop-session. A bearer with no refresh
// token does not erase a stored desktop refresh.
//
// The page says Kompas is signed in only after the desktop has claimed the
// code. A Supabase error stays an error.

const RETURN_LABEL = "Return to Kompas"

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

function loopbackTarget(search: string) {
  const raw = new URLSearchParams(search).get("loopback") || ""
  const match = /^http:\/\/127\.0\.0\.1:(\d+)\/cb$/.exec(raw)
  if (!match) return ""
  const port = Number(match[1])
  if (!Number.isInteger(port) || String(port) !== match[1] || port < 1024 || port > 65535) return ""
  return raw
}

function armStatusPoll(tick: () => void): number {
  return setInterval(tick, 2500) as unknown as number
}

const AUTH_UNAVAILABLE = "MarketFit could not reach the sign-in service. Nothing was signed out. Return to Kompas and try again."
const AUTH_CLAIMED = "Kompas has the sign-in. You can close this tab."
const AUTH_WAITING = "Return to Kompas. This page says the desktop is signed in only after Kompas has taken the code."

export default function DesktopSignIn() {
  const [note, setNote] = useState("Checking the sign-in already in this browser…")
  const [continueHref, setContinueHref] = useState("")
  const [retryHref, setRetryHref] = useState("")

  useEffect(() => {
    let gone = false
    let timer = 0
    const state = desktopState(window.location.search)
    const loopback = loopbackTarget(window.location.search)
    const handoff = handoffMode(window.location.search)
    const login = "/login?next=" + encodeURIComponent(returnPath(state, loopback, handoff))
    if (typeof setRetryHref === "function") setRetryHref((window.location.pathname || "/auth/desktop") + window.location.search)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (gone) return
      if (error) {
        setNote(AUTH_UNAVAILABLE)
        return
      }
      const session = data.session
      if (!session?.access_token) {
        if (loopback && handoff !== "start") {
          setNote("Kompas will keep the sign-in it already has.")
          return
        }
        window.location.assign(login)
        return
      }
      if (!state) {
        setNote("Return to Kompas and start sign-in from the app.")
        return
      }
      let created = null
      try {
        const res = await fetch("/api/auth/desktop-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nonce: state }),
          cache: "no-store",
        })
        created = await res.json()
        if (!res.ok || !created || created.ok !== true || typeof created.code !== "string") {
          setNote(created && typeof created.message === "string" && created.message ? created.message : AUTH_UNAVAILABLE)
          return
        }
      } catch {
        if (!gone) setNote(AUTH_UNAVAILABLE)
        return
      }
      const code = created.code
      const handoffUrl = "marketfit-kompas://auth?code=" + code + "&state=" + state
      if (loopback) {
        const back = loopback + "?state=" + encodeURIComponent(state) + "&code=" + encodeURIComponent(code)
        if (typeof setContinueHref === "function") setContinueHref(back)
        setNote(AUTH_WAITING)
        window.location.replace(back)
      } else {
        if (typeof setContinueHref === "function") setContinueHref(handoffUrl)
        setNote(AUTH_WAITING)
        window.location.href = handoffUrl
      }
      let tries = 0
      timer = armStatusPoll(async () => {
        tries += 1
        if (tries > 48) {
          clearInterval(timer)
          if (!gone) setNote("The sign-in code expired. Return to Kompas and try again.")
          return
        }
        try {
          const res = await fetch("/api/auth/desktop-code?code=" + encodeURIComponent(code), { cache: "no-store" })
          const body = await res.json()
          if (body && body.status === "claimed") {
            clearInterval(timer)
            if (!gone) setNote(AUTH_CLAIMED)
          } else if (body && body.status === "error") {
            clearInterval(timer)
            if (!gone) setNote(body && typeof body.message === "string" && body.message ? body.message : AUTH_UNAVAILABLE)
          }
        } catch { /* the next poll while this page is open retries */ }
      })
    }).catch(() => {
      if (!gone && !loopback) window.location.assign(login)
    })
    return () => { gone = true; clearInterval(timer) }
  }, [])

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, display: "grid", gap: 16 }}>
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>{note}</p>
        {continueHref ? (
          <a href={continueHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "0 18px", borderRadius: 999, background: "#16140f", color: "#fff", fontWeight: 700, textDecoration: "none" }}>{RETURN_LABEL}</a>
        ) : null}
        {retryHref ? (
          <a href={retryHref} style={{ fontWeight: 700, color: "#16140f" }}>Try again</a>
        ) : null}
      </div>
    </main>
  )
}
