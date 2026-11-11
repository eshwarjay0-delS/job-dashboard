"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { millisecondsUntilRefresh, shouldRefreshBeforeExpiry } from "@/lib/kompasAuthSession"
import { ensureLoginClock } from "@/lib/session-clock"
import { isAuthDisabled } from "@/lib/authDisabled"

// Renew the browser session once, shortly before the access token expires.
// Focus and visibility only look at the locally stored expiry. They do not
// call Supabase on a fixed interval, and they do not send the person to login.
export default function SessionLifetimeGuard() {
  useEffect(() => {
    if (isAuthDisabled()) return
    let active = true
    let timer = 0
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      return
    }
    const arm = (expiresAt?: number | null) => {
      window.clearTimeout(timer)
      if (!expiresAt) return
      const delay = millisecondsUntilRefresh(expiresAt, Date.now())
      if (delay == null || delay === 0) return
      timer = window.setTimeout(() => { void renew() }, delay)
    }
    const renew = () => {
      if (document.hidden) return
      supabase.auth.getSession().then(({ data }) => {
        if (!active || !data.session) return
        ensureLoginClock()
        const expiresAt = data.session.expires_at
        if (!shouldRefreshBeforeExpiry(Number(expiresAt), Date.now())) {
          arm(expiresAt)
          return
        }
        void supabase.auth.refreshSession().then(({ data: next }) => {
          if (next.session) arm(next.session.expires_at)
        }).catch(() => {})
      }).catch(() => {})
    }
    renew()
    window.addEventListener("focus", renew)
    document.addEventListener("visibilitychange", renew)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener("focus", renew)
      document.removeEventListener("visibilitychange", renew)
    }
  }, [])

  return null
}
