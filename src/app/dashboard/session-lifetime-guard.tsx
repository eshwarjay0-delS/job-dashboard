"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ensureLoginClock } from "@/lib/session-clock"

// Keep a valid browser session renewed while the dashboard is open. Never
// navigate away merely because time passed; only an explicitly revoked or
// unrenewable session may require the normal sign-in flow.
export default function SessionLifetimeGuard() {
  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      // Supabase unconfigured (demo mode): no session, nothing to renew.
      return
    }
    const renew = () => {
      if (document.hidden) return
      supabase.auth.getSession().then(({ data }) => {
        if (!active || !data.session) return
        ensureLoginClock()
        void supabase.auth.refreshSession()
      }).catch(() => {})
    }
    renew()
    window.addEventListener("focus", renew)
    document.addEventListener("visibilitychange", renew)
    const timer = window.setInterval(renew, 20 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("focus", renew)
      document.removeEventListener("visibilitychange", renew)
    }
  }, [])

  return null
}
