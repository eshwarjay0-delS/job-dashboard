"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"

// Once the server has said this person's setup is complete, it stays complete: moving between pages shows the page at
// once. Before 14 Oct 2026 every move blanked the page to "Checking account setup…" and asked the server again (about
// half a second each time, measured on the owner's account). Kept for the open tab only; forgotten on sign-out.
const DONE_KEY = "mf:setup-complete"
let setupDone = false
const noChanges = () => () => {}
function knownDone(): boolean {
  if (setupDone) return true
  try { return (setupDone = sessionStorage.getItem(DONE_KEY) === "1") } catch { return false }
}
function rememberDone(): void {
  setupDone = true
  try { sessionStorage.setItem(DONE_KEY, "1") } catch { /* storage unavailable: asked once per page load instead */ }
}
/** Signing out forgets it, so the next person on this tab is checked. */
export function forgetSetupDone(): void {
  setupDone = false
  try { sessionStorage.removeItem(DONE_KEY) } catch { /* nothing was kept */ }
}

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const done = useSyncExternalStore(noChanges, knownDone, () => false)
  const [checked, setChecked] = useState(false)
  const ready = pathname === "/dashboard/setup" || done || checked

  useEffect(() => {
    if (pathname === "/dashboard/setup" || knownDone()) return

    let active = true
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
          setChecked(true)
          return
        }
        if (!body.complete) {
          router.replace(body.resumeTo || "/dashboard/setup")
          return
        }
        rememberDone()
        setChecked(true)
      })
      .catch(() => {
        // Fail open for service availability. The server is authoritative when it
        // positively reports incomplete onboarding.
        if (active) setChecked(true)
      })

    return () => { active = false }
  }, [pathname, router])

  if (!ready) {
    return <div role="status" aria-live="polite" style={{ padding: 32 }}>Checking account setup…</div>
  }

  return <>{children}</>
}
