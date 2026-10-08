"use client"

import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ADMIN_NAV, NAV_SECTIONS, NAV_ITEMS, PRIMARY_NAV } from "./_components/nav"
import { useTheme } from "../theme-provider"

const ALL_HREFS = [...NAV_ITEMS, ...ADMIN_NAV].map(i => i.href)

// Is the signed-in person an admin? Asked of the server, which is the only place that knows the list. Any failure is "no".
async function askIsAdmin(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/me", { cache: "no-store" })
    return response.ok && (await response.json()).admin === true
  } catch { return false }
}

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
  const [admin, setAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const { mode, setMode } = useTheme()
  const dark = mode === "dark"

  useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!accountOpen) return
    const close = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false)
    }
    document.addEventListener("mousedown", close)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [accountOpen])

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setAccountOpen(false)
      router.replace("/login")
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

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
      if (!user || user.is_anonymous) return
      // An admin is never sent to setup (owner, 2026-10-07: "skip onboarding for this user"), so the answer is needed before
      // the setup check below may redirect.
      const isAdmin = await askIsAdmin()
      if (!active || authRevision !== initialRevision) return
      setAdmin(isAdmin)
      if (isAdmin || window.location.pathname.startsWith("/dashboard/setup")) return
      try {
        const { data } = await supabase.from("profiles").select("profile_complete").eq("id", user.id).maybeSingle()
        if (active && authRevision === initialRevision && data?.profile_complete === false && !window.location.pathname.startsWith("/dashboard/setup")) {
          router.replace("/dashboard/setup")
        }
      } catch { /* Account setup checks must not block navigation. */ }
    }).catch(() => {})

    // The existing extension bridge also receives sign-out and account switches.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION") {
        authRevision += 1
        // Another account, or none: the link goes at once and comes back only if the server says this one is an admin too.
        const revision = authRevision
        setAdmin(false)
        if (session?.user && !session.user.is_anonymous) void askIsAdmin().then(isAdmin => { if (active && authRevision === revision) setAdmin(isAdmin) })
      }
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
    <header className="mf-mobile-home">
      <button
        type="button"
        className={`mf-menu-toggle${menuOpen ? " is-open" : ""}`}
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        aria-controls="marketfit-navigation"
        onClick={() => setMenuOpen(open => !open)}
      >
        <span /><span /><span />
      </button>
      <Link href="/dashboard" className="mf-mobile-brand">MarketFit</Link>
      <button
        type="button"
        className="mf-theme-toggle"
        onClick={() => setMode(dark ? "light" : "dark")}
        aria-label={dark ? "Switch to Paper theme" : "Switch to Night theme"}
        title={dark ? "Paper theme" : "Night theme"}
      >
        <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      </button>
      <Link
        href={signedIn ? "/dashboard/connections" : "/login?next=/dashboard"}
        className="mf-mobile-account"
      >
        {signedIn ? initials : "Sign in"}
      </Link>
    </header>
    <aside suppressHydrationWarning className={`dash-sidebar${menuOpen ? " is-open" : ""}`} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false) }} style={{
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      borderRight: "0.8px solid var(--border-strong)",
    }}>

      {/* ── Wordmark ──────────────────────────────────────────────── */}
      <div className="mf-sidebar-brand-row" style={{ padding: "18px 14px 16px 18px", flexShrink: 0, borderBottom: "0.8px solid var(--border-strong)" }}>
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
        <button
          type="button"
          className="mf-sidebar-theme-toggle"
          onClick={() => setMode(dark ? "light" : "dark")}
          aria-label={dark ? "Switch to Paper theme" : "Switch to Night theme"}
          title={dark ? "Paper theme" : "Night theme"}
        >
          <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
        </button>
      </div>

      {/* ── Main Nav ──────────────────────────────────────────────── */}
      <nav id="marketfit-navigation" aria-label="Pages" style={{ flex: 1, padding: "10px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {PRIMARY_NAV.map(item => {
          const active = isActive(item.href, pathname)
          const content = <><span className="sb-icon">{item.icon}</span><span>{item.label}</span></>
          return item.href.startsWith("/dashboard/kompas")
            ? <a key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{content}</a>
            : <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{content}</Link>
        })}
        {admin && ADMIN_NAV.map(item => {
          const active = isActive(item.href, pathname)
          return (
            <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={item.what}>
              <span className="sb-icon">{item.icon}</span><span>{item.label}</span>
            </Link>
          )
        })}
        <details className="mf-nav-more"><summary>All tools & accounts</summary>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} style={{ marginBottom: section.label ? 8 : 4 }}>
            {section.label && <div className="sb-label">{section.label}</div>}

            {section.items.map(item => {
              const active = isActive(item.href, pathname)
              const NavigationLink = item.href.startsWith("/dashboard/kompas") ? "a" : Link
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
      <div ref={accountRef} style={{ padding: "12px 14px 16px", flexShrink: 0, borderTop: "0.8px solid var(--border-strong)", position: "relative" }}>
        {signedIn && accountOpen && (
          <div role="menu" aria-label="Account menu" style={{
            position: "absolute", left: 12, right: 12, bottom: "calc(100% + 8px)", zIndex: 80,
            background: "var(--surface)", border: "0.8px solid var(--border-strong)", borderRadius: 12,
            boxShadow: "0 14px 36px rgba(0,0,0,.16)", padding: 10,
          }}>
            <div style={{ padding: "6px 8px 10px", borderBottom: "0.8px solid var(--border-strong)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {email?.split("@")[0] || "Account"}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
            </div>
            <Link role="menuitem" href="/dashboard/connections" onClick={() => setAccountOpen(false)} style={{
              display: "flex", alignItems: "center", minHeight: 42, padding: "0 8px", color: "var(--text)", textDecoration: "none", fontSize: 13,
            }}>Manage account</Link>
            <button role="menuitem" type="button" onClick={signOut} disabled={signingOut} style={{
              width: "100%", minHeight: 42, padding: "0 8px", textAlign: "left", border: 0,
              borderTop: "0.8px solid var(--border-strong)", background: "transparent", color: "var(--text)",
              font: "inherit", fontSize: 13, fontWeight: 650, cursor: signingOut ? "wait" : "pointer",
            }}>{signingOut ? "Logging out…" : "Log out"}</button>
          </div>
        )}
        <button type="button" onClick={() => signedIn ? setAccountOpen(open => !open) : router.push("/login?next=/dashboard")}
          aria-expanded={signedIn ? accountOpen : undefined} aria-haspopup={signedIn ? "menu" : undefined}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
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
            <div style={{ minHeight: 30, display: "flex", alignItems: "center", fontSize: 13, color: "var(--text)" }}>{signedIn ? "Manage my account" : "Sign in to your account"}</div>
          </div>
        </button>
      </div>
    </aside>
    </>
  )
}