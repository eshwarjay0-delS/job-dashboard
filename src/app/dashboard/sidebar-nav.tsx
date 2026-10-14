"use client"

import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { ADMIN_NAV, NAV_TABS, NAV_ITEMS, SETTINGS_NAV } from "./_components/nav"
import { useTheme } from "../theme-provider"
import { ChevronRight, Moon, Sun } from "lucide-react"
import { forgetGmailData } from "@/lib/use-gmail-data"
import { forgetSetupDone } from "./onboarding-gate"

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

type CreditSummary = { resumesLeft: number; sessionsLeft: number; points: number; source: "personal-credits" }

let creditAsk: Promise<CreditSummary | null> | null = null
function askCredits(): Promise<CreditSummary | null> {
  creditAsk ??= fetch("/api/credits/summary", { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && j.ok ? (j as CreditSummary) : null))
    .catch(() => null)
    .finally(() => { setTimeout(() => { creditAsk = null }, 60_000) })
  return creditAsk
}

function useCreditSummary() {
  const [s, setS] = useState<null | CreditSummary>(null)
  useEffect(() => {
    let active = true
    void askCredits().then(j => { if (active && j) setS(j) })
    return () => { active = false }
  }, [])
  return s
}

/** Pinned overlay: renders into document.body via portal so no ancestor
 *  stacking context can trap or clip it. Anchored under the pill button,
 *  clamped inside the viewport. Backdrop tap or Escape closes it. */
function ExplainerPanel({ s, onClose, anchor, align = "left" }: {
  s: CreditSummary; onClose: () => void; anchor: HTMLElement | null; align?: "left" | "right"
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    const place = () => {
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const w = Math.min(300, window.innerWidth - 24)
      let left = align === "right" ? r.right - w : r.left
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12))
      setPos({ top: Math.min(r.bottom + 8, window.innerHeight - 40), left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("keydown", esc)
    }
  }, [anchor, align, onClose])
  if (typeof document === "undefined" || !pos) return null
  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 9990, background: "transparent", cursor: "default" }} />
      <div role="dialog" aria-label="What these numbers mean" onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9991,
          width: 300, maxWidth: "calc(100vw - 24px)",
          borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)",
          boxShadow: "0 16px 48px rgba(32,31,25,.25)", padding: "14px 16px", textAlign: "left",
        }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>What this means</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
          <b style={{ color: "var(--text)" }}>{s.resumesLeft.toLocaleString()} resumes</b> available from your credit balance.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
          <b style={{ color: "var(--text)" }}>{s.sessionsLeft} sessions</b> available from your credit balance. One session represents one hour.
        </p>
        <p style={{ fontSize: 11, color: "var(--text-soft)", margin: "0 0 10px" }}>
          Both counts use the same {s.points} points. Using one reduces what remains for the other.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>1 resume = 0.25 points</span>
          <button onClick={onClose} style={{ fontSize: 12, color: "var(--text-soft)", background: "none", border: "none", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </>,
    document.body
  )
}

function CreditsPill() {
  const s = useCreditSummary()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  if (!s) return null
  return (
    <div style={{ margin: "10px 14px 0" }}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} title="What do these numbers mean?"
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
          borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)",
          fontSize: 12, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", cursor: "pointer",
        }}>
        <span aria-hidden="true">◉</span>
        <span>{s.resumesLeft.toLocaleString()} resumes · {s.sessionsLeft} sessions left</span>
      </button>
      {open && <ExplainerPanel s={s} onClose={() => setOpen(false)} anchor={btnRef.current} align="left" />}
    </div>
  )
}

function CreditsPillCompact() {
  const s = useCreditSummary()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  if (!s) return <span />
  return (
    <div>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} title="What do these numbers mean?"
        style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", padding: 0 }}>
        ◉ {s.resumesLeft > 999 ? `${(s.resumesLeft / 1000).toFixed(1)}k` : s.resumesLeft}r · {s.sessionsLeft}s
      </button>
      {open && <ExplainerPanel s={s} onClose={() => setOpen(false)} anchor={btnRef.current} align="right" />}
    </div>
  )
}

export default function SidebarNav({ resumeOnly = false }: { resumeOnly?: boolean }) {
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
  const toggleRef = useRef<HTMLButtonElement>(null)   // the menu button on a narrow window
  const drawerRef = useRef<HTMLElement>(null)         // the menu itself, a drawer on a narrow window
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
      // The mail kept for instant pages, and that their setup is done, belong to this person: they go at sign-out.
      forgetGmailData()
      forgetSetupDone()
      await supabase.auth.signOut()
      setAccountOpen(false)
      router.replace("/login")
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  // Closing the drawer from inside it (Escape, or the dimmed page) puts the keyboard back on the menu button. Left alone,
  // the link that had it is hidden with the drawer and the keyboard is dropped at the top of the document.
  const closeMenu = useCallback(() => {
    const el = document.activeElement as HTMLElement | null
    const inside = !!el && (!!drawerRef.current?.contains(el) || el.classList.contains("mf-nav-scrim"))
    setMenuOpen(false)
    if (inside) toggleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu()
    }
    // While the drawer is open the page under the dimming cannot be reached with Tab or read out by a screen reader.
    const page = document.getElementById("dashboard-content")
    page?.setAttribute("inert", "")
    // The drawer exists only on a narrow window. Widened past it, the menu is the fixed rail again: the drawer is closed,
    // so the page is never left unreachable behind a drawer that is no longer one.
    const wide = window.matchMedia("(min-width: 1025px)")
    const onWide = () => { if (wide.matches) setMenuOpen(false) }
    wide.addEventListener("change", onWide)
    window.addEventListener("keydown", onKey)
    return () => {
      page?.removeAttribute("inert")
      wide.removeEventListener("change", onWide)
      window.removeEventListener("keydown", onKey)
    }
  }, [menuOpen, closeMenu])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let authRevision = 0
    // Who is signed in, as last seen. Supabase also reports a refreshed session (on tab focus, on token refresh) for the
    // same person; that is not a change, so the Admin link is not hidden and re-asked for it (it was: five asks in nine
    // seconds on the owner's account, 14 Oct 2026, the link blinking each time).
    let knownUserId: string | null | undefined = undefined

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
      knownUserId = user && !user.is_anonymous ? user.id : null
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
      const id = session?.user && !session.user.is_anonymous ? session.user.id : null
      if (event !== "INITIAL_SESSION" && id !== knownUserId) {
        knownUserId = id
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
        ref={toggleRef}
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
        {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      </button>
      <Link
        href={signedIn ? "/dashboard/connections" : "/login?next=/dashboard"}
        className="mf-mobile-account"
      >
        {signedIn ? initials : "Sign in"}
      </Link>
    </header>
    {menuOpen && <button type="button" className="mf-nav-scrim" aria-label="Close navigation" tabIndex={-1} onClick={closeMenu} />}
    <aside ref={drawerRef} suppressHydrationWarning className={`dash-sidebar${menuOpen ? " is-open" : ""}`} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false) }} style={{
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid var(--border)",
    }}>

      {/* ── Wordmark ──────────────────────────────────────────────── */}
      <div className="mf-sidebar-brand-row" style={{ padding: "18px 14px 14px 18px", flexShrink: 0 }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: "var(--accent)", color: "var(--bg)",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(25,20,10,.18)",
            fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", flexShrink: 0,
          }}>MF</div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1 }}>
              MarketFit
            </div>
            <div className="ink-label" style={{ fontSize: 12, marginTop: 4 }}>Own your next role</div>
          </div>
        </Link>
        <button
          type="button"
          className="mf-sidebar-theme-toggle"
          onClick={() => setMode(dark ? "light" : "dark")}
          aria-label={dark ? "Switch to Paper theme" : "Switch to Night theme"}
          title={dark ? "Paper theme" : "Night theme"}
        >
          {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
      </div>
      {!resumeOnly && <CreditsPill />}

      {/* ── Main Nav ──────────────────────────────────────────────── */}
      <nav id="marketfit-navigation" aria-label="Pages" style={{ flex: 1, padding: "10px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_TABS.filter(tab => !resumeOnly || tab.href === "/dashboard/resume").map(tab => {
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
                    className="sb-chevron">
                    <ChevronRight size={16} aria-hidden="true" style={{ transform: expanded ? "rotate(90deg)" : "none" }} />
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
        <div style={{ borderTop: "1px solid var(--border)", margin: "10px 4px" }} />
        {!resumeOnly && admin && ADMIN_NAV.map(item => {
          const active = isActive(item.href, pathname)
          return (
            <Link key={item.href} href={item.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={item.what}>
              <span className="sb-icon">{item.icon}</span><span>{item.label}</span>
            </Link>
          )
        })}
        {!resumeOnly && (() => {
          const active = isActive(SETTINGS_NAV.href, pathname)
          return (
            <Link href={SETTINGS_NAV.href} className={`sb-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={SETTINGS_NAV.what}>
              <span className="sb-icon">{SETTINGS_NAV.icon}</span><span>{SETTINGS_NAV.label}</span>
            </Link>
          )
        })()}
      </nav>

      {/* ── Account ────────────────────────────────────────── */}
      <div ref={accountRef} style={{ padding: "12px 14px 16px", flexShrink: 0, borderTop: "1px solid var(--border)", position: "relative" }}>
        {signedIn && accountOpen && (
          <div role="menu" aria-label="Account menu" style={{
            position: "absolute", left: 12, right: 12, bottom: "calc(100% + 8px)", zIndex: 80,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "var(--shadow-pop)", padding: 8,
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
            width: 32, height: 32, flexShrink: 0, borderRadius: 999, background: "color-mix(in srgb, var(--accent) 16%, var(--surface))", color: "var(--text)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700,
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