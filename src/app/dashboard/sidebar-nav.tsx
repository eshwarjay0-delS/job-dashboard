"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, type CSSProperties } from "react"
import { createClient } from "@/lib/supabase/client"

// ── Icons ──────────────────────────────────────────────────────────────────────
const I = {
  home: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  star: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/></svg>,
  bookmark: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg>,
  bell: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>,
  chart: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>,
  trophy: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/></svg>,
  sparkle: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>,
  doc: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>,
  mail: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>,
  people: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
  chat: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg>,
  activity: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>,
  rocket: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.819m2.562-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg>,
  cog: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  shield: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>,
  bolt: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>,
}

// ── Nav structure ──────────────────────────────────────────────────────────────
// coming: true shows a "Soon" badge and keeps the link but marks it visually
type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
  coming?: boolean
  badge?: string
  sub?: { href: string; label: string; coming?: boolean }[]
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/dashboard",       label: "Home",        icon: I.home,  exact: true },
      { href: "/dashboard/brief", label: "Daily Brief", icon: I.activity, badge: "New" },
    ],
  },
  {
    label: "Discover",
    items: [
      {
        href: "/dashboard/recommended",
        label: "Recommended",
        icon: I.star,
      },
      {
        href: "/dashboard/jobs",
        label: "Jobs & Apply",
        icon: I.search,
        sub: [
          { href: "/dashboard/contracts", label: "Contract Board" },
          { href: "/dashboard/jobs-ft",   label: "Full-Time Board" },
          { href: "/dashboard/companies", label: "Company Intel 🏢" },
        ],
      },
      { href: "/dashboard/saved",  label: "Saved Jobs",  icon: I.bookmark },
      { href: "/dashboard/alerts", label: "Job Alerts",  icon: I.bell     },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/dashboard/applications", label: "Pipeline",        icon: I.chart   },
      { href: "/dashboard/offers",       label: "Offers",          icon: I.trophy  },
      { href: "/dashboard/compare",      label: "Offer Comparator",icon: I.chart, badge: "New" },
    ],
  },
  {
    label: "AI & Resume",
    items: [
      { href: "/dashboard/copilot",        label: "Career Copilot",   icon: I.bolt, badge: "AI" },
      { href: "/dashboard/ai-tools",       label: "AI Tools",         icon: I.sparkle },
      { href: "/dashboard/cover-letters",  label: "Cover Letters",    icon: I.mail    },
      { href: "/dashboard/interviews",     label: "Interview Prep",   icon: I.chat    },
      { href: "/dashboard/mock-interview", label: "Mock Interview",   icon: I.chat, badge: "AI" },
      { href: "/dashboard/roadmap",       label: "Career Roadmap",   icon: I.rocket, badge: "New" },
      { href: "/dashboard/technical-prep",label: "Tech Prep Tracker",icon: I.bolt, badge: "New" },
      {
        href: "/dashboard/resume",
        label: "My Resume",
        icon: I.doc,
        sub: [
          { href: "/dashboard/documents",       label: "Documents" },
          { href: "/dashboard/resume/builder",  label: "Builder"   },
        ],
      },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/dashboard/referrals", label: "Referral CRM",  icon: I.people, badge: "New" },
      { href: "/dashboard/network",   label: "Network",       icon: I.people },
      { href: "/dashboard/messages",  label: "Messages",      icon: I.chat   },
      { href: "/dashboard/email",     label: "Emails",        icon: I.mail    },
      { href: "/dashboard/auto-reply", label: "Auto Reply",   icon: I.mail, badge: "New" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/activity",  label: "Activity",           icon: I.activity },
      { href: "/dashboard/profile",   label: "Career Profile",     icon: I.chart    },
      { href: "/dashboard/skills",    label: "Skills & Learning",  icon: I.bolt     },
      { href: "/dashboard/salary",    label: "Salary Intel",       icon: I.trophy   },
      { href: "/dashboard/visa",      label: "Visa & Immigration", icon: I.shield   },
      { href: "/dashboard/marketing", label: "Showcase",           icon: I.rocket, badge: "New" },
    ],
  },
]

function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href
  if (href === "/dashboard") return pathname === "/dashboard"
  const base = href.split("?")[0]
  return pathname === base || pathname.startsWith(base + "/")
}

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [initials, setInitials] = useState("MF")
  const [email, setEmail] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  // Track expandable sections open state
  const jobsOnPath = pathname.startsWith("/dashboard/jobs") || pathname.startsWith("/dashboard/contracts") || pathname.startsWith("/dashboard/companies")
  const resumeOnPath = pathname.startsWith("/dashboard/resume")
  const [expandedJobs, setExpandedJobs] = useState(jobsOnPath)
  const [expandedResume, setExpandedResume] = useState(resumeOnPath)

  useEffect(() => { if (jobsOnPath)   setExpandedJobs(true)   }, [jobsOnPath])
  useEffect(() => { if (resumeOnPath) setExpandedResume(true) }, [resumeOnPath])

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("mf_admin_auth") === "1")
  }, [])

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

  const linkStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 10px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: active ? 650 : 450,
    color: active ? "#fff" : "rgba(255,255,255,.52)",
    background: active ? "color-mix(in srgb, var(--accent) 52%, transparent)" : "transparent",
    transition: "all .13s",
    letterSpacing: "-0.01em",
    boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,.08)" : "none",
    textDecoration: "none",
    width: "100%",
  })

  return (
    <aside suppressHydrationWarning className="dash-sidebar" style={{
      position: "fixed",
      top: 0,
      left: 0,
      bottom: 0,
      width: 220,
      background: "#0f1623",
      display: "flex",
      flexDirection: "column",
      zIndex: 400,
      borderRight: "1px solid rgba(255,255,255,.07)",
    }}>

      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 14px 14px", flexShrink: 0 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(145deg, var(--accent) 0%, var(--accent-h) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: "-0.5px",
            boxShadow: "0 3px 12px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.2)",
            flexShrink: 0,
          }}>MF</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
              MarketFit
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.35)", fontWeight: 500, letterSpacing: "0.3px" }}>
              Own Your Next Role
            </div>
          </div>
        </a>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 12px 4px" }} />

      {/* ── Main Nav ──────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_SECTIONS.map((section, si) => {
          const isJobsSection = section.label === "Discover"
          return (
            <div key={si} style={{ marginBottom: section.label ? 6 : 2 }}>
              {/* Section label */}
              {section.label && (
                <div style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.28)",
                  padding: "8px 10px 3px",
                }}>
                  {section.label}
                </div>
              )}

              {section.items.map(item => {
                const active = isActive(item.href, pathname, item.exact)
                const hasSub = Array.isArray(item.sub) && item.sub.length > 0
                const subActive = hasSub && item.sub!.some(s => pathname.startsWith(s.href.split("?")[0]))
                const parentActive = active || subActive

                const isJobsItem   = item.href === "/dashboard/jobs"
                const isResumeItem = item.href === "/dashboard/resume"
                const showSub = hasSub && (
                  isJobsItem   ? expandedJobs :
                  isResumeItem ? expandedResume :
                  parentActive
                )

                return (
                  <div key={item.href} style={{ marginBottom: 1 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <a
                        href={item.href}
                        style={{ ...linkStyle(parentActive), flex: 1 }}
                        onMouseEnter={e => {
                          if (!parentActive) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.07)"
                            ;(e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.82)"
                          }
                        }}
                        onMouseLeave={e => {
                          if (!parentActive) {
                            (e.currentTarget as HTMLElement).style.background = "transparent"
                            ;(e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.52)"
                          }
                        }}
                      >
                        <span style={{ opacity: parentActive ? 1 : 0.65, flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>

                        {/* "New" badge */}
                        {item.badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 20,
                            background: "rgba(250,204,21,.15)", color: "#fbbf24",
                            border: "1px solid rgba(251,191,36,.25)", flexShrink: 0,
                          }}>{item.badge}</span>
                        )}

                        {/* "Soon" badge */}
                        {item.coming && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 20,
                            background: "rgba(148,163,184,.12)", color: "rgba(148,163,184,.7)",
                            border: "1px solid rgba(148,163,184,.18)", flexShrink: 0,
                          }}>Soon</span>
                        )}
                      </a>

                      {/* Expand/collapse chevron for items with sub-items */}
                      {hasSub && (
                        <button
                          onClick={() => {
                            if (isJobsItem)   setExpandedJobs(e => !e)
                            if (isResumeItem) setExpandedResume(e => !e)
                          }}
                          style={{
                            flexShrink: 0, width: 26, height: 30, border: "none", cursor: "pointer",
                            background: "transparent", color: parentActive ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.28)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: 7, transition: "all .13s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.75)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = parentActive ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.28)" }}
                          title={showSub ? "Collapse" : "Expand"}
                        >
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{
                            transform: showSub ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform .2s ease",
                          }}>
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Sub-items */}
                    {showSub && (
                      <div style={{ paddingLeft: 12, marginTop: 1, marginBottom: 3 }}>
                        {item.sub!.map(sub => {
                          const subPath = sub.href.split("?")[0]
                          const subIsActive = pathname === subPath || pathname.startsWith(subPath + "/")
                          return (
                            <a
                              key={sub.href}
                              href={sub.href}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "5px 9px", borderRadius: 7, marginBottom: 1,
                                textDecoration: "none", fontSize: 12,
                                fontWeight: subIsActive ? 600 : 400,
                                color: subIsActive ? "#bfdbfe" : "rgba(255,255,255,.38)",
                                background: subIsActive ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
                                transition: "all .13s",
                                borderLeft: `2px solid ${subIsActive ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "rgba(255,255,255,.08)"}`,
                              }}
                              onMouseEnter={e => {
                                if (!subIsActive) {
                                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.65)"
                                  ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"
                                }
                              }}
                              onMouseLeave={e => {
                                if (!subIsActive) {
                                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.38)"
                                  ;(e.currentTarget as HTMLElement).style.background = "transparent"
                                }
                              }}
                            >
                              {sub.label}
                              {sub.coming && (
                                <span style={{
                                  marginLeft: "auto", fontSize: 8.5, fontWeight: 600, padding: "1px 4px", borderRadius: 20,
                                  background: "rgba(148,163,184,.1)", color: "rgba(148,163,184,.6)",
                                  border: "1px solid rgba(148,163,184,.16)",
                                }}>Soon</span>
                              )}
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* ── Admin (only when session flag set) ──────────────────── */}
        {isAdmin && (
          <div style={{ marginTop: 2 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "rgba(255,255,255,.28)",
              padding: "8px 10px 3px",
            }}>Admin</div>
            <a
              href="/dashboard/admin"
              style={linkStyle(isActive("/dashboard/admin", pathname))}
              onMouseEnter={e => { if (!isActive("/dashboard/admin", pathname)) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.82)" } }}
              onMouseLeave={e => { if (!isActive("/dashboard/admin", pathname)) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.52)" } }}
            >
              <span style={{ opacity: 0.75 }}>{I.shield}</span>
              Admin
            </a>
          </div>
        )}
      </nav>

      <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 12px 4px" }} />

      {/* ── Settings ──────────────────────────────────────────────── */}
      <div style={{ padding: "2px 8px 6px" }}>
        <a
          href="/dashboard/settings"
          style={linkStyle(isActive("/dashboard/settings", pathname))}
          onMouseEnter={e => { if (!isActive("/dashboard/settings", pathname)) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.82)" } }}
          onMouseLeave={e => { if (!isActive("/dashboard/settings", pathname)) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.52)" } }}
        >
          <span style={{ opacity: isActive("/dashboard/settings", pathname) ? 1 : 0.65 }}>{I.cog}</span>
          Settings
        </a>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 12px" }} />

      {/* ── User + Upgrade ────────────────────────────────────────── */}
      <div style={{ padding: "10px 10px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-h) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10.5, fontWeight: 800,
            boxShadow: "0 0 0 2px rgba(255,255,255,.14)",
          }}>{initials}</div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.88)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {email?.split("@")[0] || "Account"}
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.32)", fontWeight: 500 }}>Free Plan</div>
          </div>
        </div>
        <button
          onClick={() => { window.location.href = "/dashboard/settings#plan" }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            width: "100%", padding: "7px 0", borderRadius: 9, cursor: "pointer", border: "none",
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-h) 100%)",
            color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
            boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 42%, transparent), inset 0 1px 0 rgba(255,255,255,.18)",
          }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>
          </svg>
          Upgrade to Pro
        </button>
      </div>
    </aside>
  )
}
