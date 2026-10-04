"use client"

import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { NAV_SECTIONS, NAV_ITEMS, PRIMARY_NAV } from "./_components/nav"

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
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let authRevision = 0

    function updateAccount(user: User | null) {
      if (!active) return
      const account = user && !user.is_anonymous ? user : null
      setSignedIn(Boolean(account))
      setEmail(account?.email || "")
      const name = typeof account?.user_metadata?.full_name === "string"
        ? account.user_metadata.full_name : account?.email || ""
      setInitials(name.split(/\s+/).filter(Boolean).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || "MF")
    }

    const initialRevision = authRevision
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      // A later sign-out or account switch must win over this initial request.
      if (!active || authRevision !== initialRevision) return
      updateAccount(user)
      if (!user || user.is_anonymous || window.location.pathname.startsWith("/dashboard/setup")) return
      try {
        const { data } = await supabase.from("profiles").select("profile_complete").eq("id", user.id).maybeSingle()
        if (active && authRevision === initialRevision && data?.profile_complete === false && !window.location.pathname.startsWith("/dashboard/setup")) {
          router.replace("/dashboard/setup")
        }
      } catch { /* Account setup checks must not block navigation. */ }
    }).catch(() => {})

    // The existing extension bridge also receives sign-out and account switches.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION") authRevision += 1
      updateAccount(session?.user || null)
      if (active) window.postMessage({ source: "marketfit-web", type: "MF_AUTH", session: session?.user.is_anonymous ? null : session }, window.location.origin)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [router])

  return (
    <>
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
        {PRIMARY_NAV.map(item => {
          const active = isActive(item.href, pathname)
          const content = <><span className="sb-icon">{item.icon}</span><span>{item.label}</span></>
          return item.href === "/dashboard/kompas"
            ? <a key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{content}</a>
            : <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{content}</Link>
        })}
        <details className="mf-nav-more"><summary>All tools & accounts</summary>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} style={{ marginBottom: section.label ? 8 : 4 }}>
            {section.label && <div className="sb-label">{section.label}</div>}

            {section.items.map(item => {
              const active = isActive(item.href, pathname)
              const NavigationLink = item.href === "/dashboard/kompas" ? "a" : Link
              return (
                <NavigationLink key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined} title={item.what}>
                  <span className="sb-icon">{item.icon}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {active && <span className="sb-here">Here</span>}
                </NavigationLink>
              )
            })}
          </div>
        ))}
        </details>

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
            <Link href={signedIn ? "/dashboard/connections" : "/login?next=/dashboard"} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 13, color: "var(--text)", textUnderlineOffset: 4 }}>{signedIn ? "Manage my accounts" : "Sign in to your account"}</Link>
          </div>
        </div>
      </div>
    </aside>
    <header className="mf-mobile-home">
      <Link href="/dashboard">MarketFit · Home</Link>
      <nav aria-label="Main tools">
        <Link href="/dashboard/resume">Resume</Link>
        <Link href="/dashboard/email">Job emails</Link>
        <a href="/dashboard/kompas">Practice</a>
        <Link href={signedIn ? "/dashboard/connections" : "/login?next=/dashboard"}>{signedIn ? "Accounts" : "Sign in"}</Link>
      </nav>
    </header>
    </>
  )
}
