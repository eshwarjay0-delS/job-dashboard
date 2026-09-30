"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { NAV_SECTIONS, NAV_ITEMS } from "./_components/nav"

const ALL_HREFS = NAV_ITEMS.map(i => i.href)

function isActive(href: string, pathname: string) {
  const matches = (h: string) => h === "/dashboard" ? pathname === h : pathname === h || pathname.startsWith(h + "/")
  if (!matches(href)) return false
  return !ALL_HREFS.some(h => h !== href && h.length > href.length && matches(h))
}

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [initials, setInitials] = useState("MF")
  const [email, setEmail] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const fullName = (user.user_metadata?.full_name as string) || user.email || ""
      const ini = fullName.split(/\s+/).filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "MF"
      setInitials(ini)
      setEmail(user.email || "")

      // Straggler catch, once per session mount (not on every nav — this component
      // stays mounted across client-side routing, so re-checking per pathname change
      // would fire a query on every page view for no benefit): a signed-in user who
      // never finished onboarding (bookmark, back button, or a session that started
      // before this redirect existed) landing anywhere under /dashboard/* gets sent
      // to finish setup — auth/callback's redirect only fires once, right after sign-in.
      if (!window.location.pathname.startsWith("/dashboard/setup")) {
        try {
          const { data } = await supabase.from("profiles").select("profile_complete").eq("id", user.id).maybeSingle()
          if (data && data.profile_complete === false && !window.location.pathname.startsWith("/dashboard/setup")) {
            router.replace("/dashboard/setup")
          }
        } catch { /* best-effort — don't block navigation on this check */ }
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Broadcast session to Chrome extension
  useEffect(() => {
    const supabase = createClient()
    function broadcast(session: unknown) {
      window.postMessage({ source: "marketfit-web", type: "MF_AUTH", session }, window.location.origin)
    }
    supabase.auth.getSession().then(({ data: { session } }) => broadcast(session)).catch(() => {})
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => broadcast(session))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <aside suppressHydrationWarning className="dash-sidebar" style={{
      position: "fixed",
      top: 0,
      left: 0,
      bottom: 0,
      width: 240,
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      zIndex: 400,
      borderRight: "0.8px solid var(--border-strong)",
    }}>

      {/* ── Wordmark ──────────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 16px", flexShrink: 0, borderBottom: "0.8px solid var(--border-strong)" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: "var(--accent)", color: "var(--bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", flexShrink: 0,
          }}>MF</div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1 }}>
              MarketFit
            </div>
            <div className="ink-label" style={{ fontSize: 11, letterSpacing: ".1em", marginTop: 5 }}>Own your next role</div>
          </div>
        </Link>
      </div>

      {/* ── Main Nav ──────────────────────────────────────────────── */}
      <nav aria-label="Pages" style={{ flex: 1, padding: "10px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} style={{ marginBottom: section.label ? 8 : 4 }}>
            {section.label && <div className="sb-label">{section.label}</div>}

            {section.items.map(item => {
              const active = isActive(item.href, pathname)
              return (
                <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined} title={item.what}>
                  <span className="sb-icon">{item.icon}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {active && <span className="sb-here">Here</span>}
                </Link>
              )
            })}
          </div>
        ))}

      </nav>

      {/* ── Account ────────────────────────────────────────── */}
      <div style={{ padding: "12px 14px 16px", flexShrink: 0, borderTop: "0.8px solid var(--border-strong)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 28, height: 28, flexShrink: 0, background: "var(--surface-2)", color: "var(--text)",
            border: "0.8px solid var(--border-strong)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 600,
          }}>{initials}</div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {email?.split("@")[0] || "Account"}
            </div>
            <div className="ink-label" style={{ fontSize: 11 }}>Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
