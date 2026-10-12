"use client"

import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ADMIN_NAV, NAV_TABS, NAV_ITEMS, SETTINGS_NAV } from "./_components/nav"
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

type CreditSummary = { resumesLeft: number; sessionsLeft: number; calibrated: boolean; remainingUsd: number }

function useCreditSummary() {
  const [s, setS] = useState<null | CreditSummary>(null)
  useEffect(() => {
    fetch("/api/credits/summary", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.ok) setS(j) })
      .catch(() => {})
  }, [])
  return s
}

function ExplainerPanel({ s, onClose }: { s: CreditSummary; onClose: () => void }) {
  return (
    <div onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 600, width: 260,
        borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)",
        boxShadow: "0 12px 40px rgba(32,31,25,.18)", padding: "14px 16px", textAlign: "left",
      }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>What this means</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
        <b style={{ color: "var(--text)" }}>{s.resumesLeft.toLocaleString()} resumes</b> — generations your API balances buy (${s.remainingUsd.toFixed(2)} left across keys).
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
        <b style={{ color: "var(--text)" }}>{s.sessionsLeft} sessions</b> — 1-hour interview sessions left on your gel points (1 hour = 1 session · 30 min = 0.5 session; listening is free).
      </p>
      <p style={{ fontSize: 11, color: "var(--text-soft)", margin: "0 0 10px" }}>
        {s.calibrated ? "Measured from your real generations." : "Estimate — your first generation calibrates it."}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/dashboard/admin" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Full breakdown →</Link>
        <button onClick={onClose} style={{ fontSize: 12, color: "var(--text-soft)", background: "none", border: "none", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  )
}

function CreditsPill() {
  const s = useCreditSummary()
  const [open, setOpen] = useState(false)
  if (!s) return null
  return (
    <div style={{ position: "relative", margin: "10px 14px 0" }}>
      <button onClick={() => setOpen(o => !o)} title="What do these numbers mean?"
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
          borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)",
          fontSize: 12, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", cursor: "pointer",
        }}>
        <span aria-hidden="true">◉</span>
        <span>{s.resumesLeft.toLocaleString()} resumes · {s.sessionsLeft} sessions left</span>
      </button>
      {open && <ExplainerPanel s={s} onClose={() => setOpen(false)} />}
    </div>
  )
}

function CreditsPillCompact() {
  const s = useCreditSummary()
  const [open, setOpen] = useState(false)
  if (!s) return <span />
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title="What do these numbers mean?"
        style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", padding: 0 }}>
        ◉ {s.resumesLeft > 999 ? `${(s.resumesLeft / 1000).toFixed(1)}k` : s.resumesLeft}r · {s.sessionsLeft}s
      </button>
      {open && <ExplainerPanel s={s} onClose={() => setOpen(false)} />}
    </div>
  )
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
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const toggleTab = (href: string) => setOpenTabs(open => open.includes(href) ? open.filter(h => h !== href) : [...open, href])
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
      <CreditsPillCompact />
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
      <CreditsPill />

      {/* ── Main Nav ──────────────────────────────────────────────── */}
      <nav id="marketfit-navigation" aria-label="Pages" style={{ flex: 1, padding: "10px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_TABS.map(tab => {
          const inTab = (h: string) => h === tab.href ? pathname === h : pathname === h || pathname.startsWith(h + "/")
          const tabActive = inTab(tab.href) || tab.items.some(i => inTab(i.href))
          const expanded = tabActive || openTabs.includes(tab.href)
          const TabLink = tab.href.startsWith("/dashboard/kompas") ? "a" : Link
          return (
            <div key={tab.href} style={{ marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <TabLink href={tab.href} className={`sb-link${tabActive ? " active" : ""}`} aria-current={tabActive ? "page" : undefined}
                  title={tab.what} style={{ flex: 1 }}>
                  <span className="sb-icon">{tab.icon}</span><span>{tab.label}</span>
                </TabLink>
                {tab.items.length > 0 && (
                  <button type="button" onClick={() => toggleTab(tab.href)} aria-expanded={expanded}
                    aria-label={expanded ? `Hide ${tab.label} pages` : `Show ${tab.label} pages`}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)", padding: "8px 10px", fontSize: 12 }}>
                    <span aria-hidden style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                  </button>
                )}
              </div>
              {expanded && tab.items.length > 0 && (
                <div style={{ marginLeft: 18, borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
                  {tab.items.map(item => {
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
              )}
            </div>
          )
        })}
        <div style={{ borderTop: "0.8px solid var(--border-strong)", margin: "10px 4px" }} />
        {admin && ADMIN_NAV.map(item => {
          const active = isActive(item.href, pathname)
          return (
            <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={item.what}>
              <span className="sb-icon">{item.icon}</span><span>{item.label}</span>
            </Link>
          )
        })}
        {(() => {
          const active = isActive(SETTINGS_NAV.href, pathname)
          return (
            <Link href={SETTINGS_NAV.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={SETTINGS_NAV.what}>
              <span className="sb-icon">{SETTINGS_NAV.icon}</span><span>{SETTINGS_NAV.label}</span>
            </Link>
          )
        })()}
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