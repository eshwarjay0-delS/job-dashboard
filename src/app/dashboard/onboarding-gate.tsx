"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(pathname === "/dashboard/setup")

  useEffect(() => {
    if (pathname === "/dashboard/setup") {
      setReady(true)
      return
    }

    let active = true
    setReady(false)
    fetch("/api/onboarding/status", { cache: "no-store" })
      .then(async response => {
        if (response.status === 401) {
          // Back to the page that was asked for once signed in (the sign-in page checks `next` with safeAuthNext).
          router.replace(pathname && pathname !== "/dashboard" ? `/login?next=${encodeURIComponent(pathname)}` : "/login")
          return
        }
        const body = await response.json()
        if (!active) return
        if (!response.ok) {
          // A transient status failure is not proof that an existing user needs
          // onboarding. Keep the dashboard usable and let service health recover.
          setReady(true)
          return
        }
        if (!body.complete) {
          router.replace(body.resumeTo || "/dashboard/setup")
          return
        }
        setReady(true)
      })
      .catch(() => {
        // Fail open for service availability. The server is authoritative when it
        // positively reports incomplete onboarding.
        if (active) setReady(true)
      })

    return () => { active = false }
  }, [pathname, router])

  if (!ready) {
    return <div role="status" aria-live="polite" style={{ padding: 32 }}>Checking account setup…</div>
  }

  return <>{children}</>
}
