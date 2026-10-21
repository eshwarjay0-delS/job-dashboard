"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { clearLoginClock, ensureLoginClock, reauthDue } from "@/lib/session-clock"

// Owner rule, 20 Oct 2026: a login lasts 3 days. On every dashboard open,
// if the login clock is inside its final 24 hours, send the user to the
// login page to authenticate again and start a fresh 3 days — never let
// the session lapse mid-use. Silent refresh handles everything before
// that window, so this fires at most once per 3-day cycle.
export default function SessionLifetimeGuard() {
  const pathname = usePathname()

  useEffect(() => {
    let active = true
    try {
      createClient()
        .auth.getSession()
        .then(({ data }) => {
          if (!active || !data.session) return
          ensureLoginClock()
          if (reauthDue()) {
            clearLoginClock()
            const next = window.location.pathname + window.location.search
            window.location.assign(`/login?next=${encodeURIComponent(next)}`)
          }
        })
        .catch(() => {})
    } catch {
      // Supabase unconfigured (demo mode): no session, nothing to guard.
    }
    return () => {
      active = false
    }
  }, [pathname])

  return null
}
