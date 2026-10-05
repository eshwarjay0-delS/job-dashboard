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
          router.replace("/login")
          return
        }
        const body = await response.json()
        if (!active) return
        if (!response.ok || !body.complete) {
          router.replace("/dashboard/setup")
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (active) router.replace("/dashboard/setup")
      })

    return () => { active = false }
  }, [pathname, router])

  if (!ready) {
    return <div role="status" aria-live="polite" style={{ padding: 32 }}>Checking account setup…</div>
  }

  return <>{children}</>
}
