"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  IllustTailor,
  IllustExtension,
  IllustJobSearch,
  IllustTracker,
  IllustAnalytics,
  IllustGmail,
} from "@/components/Illustrations"
import { getH1BScore } from "@/lib/h1b"
import { connectGmail } from "@/lib/google-auth"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import {
  Globe, MapPin, DollarSign, X, Phone, PartyPopper, Send, Handshake, Laptop,
  Sparkles, FileText, Zap, Target, Bookmark, BarChart3, Mail, ClipboardList,
} from "lucide-react"

// This page's colors used to be literal hex — an exact copy of the light-theme
// values in globals.css, but copied instead of referenced. Since every
// consumer below reads through this P object rather than a hardcoded string,
// the page never re-rendered for dark mode (or any of the 6 accent palettes) —
// it was permanently stuck on the light-theme snapshot these hex codes were
// taken from. Pointing every entry at the real CSS custom property (same
// values in light mode, correct values everywhere else) fixes that for the
// whole page with no call-site changes. borderStrong and the six category-
// color objects (rtr/reply/remote/intv/assess/follow) are dead code — 0
// references anywhere in this file — left as-is, not worth touching here.
const P = {
  bg:           "var(--surface-2)",
  surface:      "var(--surface)",
  surfaceAlt:   "var(--surface-2)",
  text:         "var(--text)",
  muted:        "var(--text-muted)",
  hint:         "var(--text-soft)",
  border:       "var(--border)",
  borderStrong: "#d0d7e3",
  // Category colors (unused — see note above)
  rtr:    { text: "#d97706", bg: "#fffbeb",  border: "#fde68a",  dot: "#f59e0b" },
  reply:  { text: "#dc2626", bg: "#fef2f2",  border: "#fecaca",  dot: "#f87171" },
  remote: { text: "#1d6fc4", bg: "#eff6ff",  border: "#bfdbfe",  dot: "#3b82f6" },
  intv:   { text: "#0ea5e9", bg: "#f0f9ff",  border: "#bae6fd",  dot: "#38bdf8" },
  assess: { text: "#7c3aed", bg: "#f5f3ff",  border: "#ddd6fe",  dot: "#8b5cf6" },
  follow: { text: "#0369a1", bg: "#f0f9ff",  border: "#bae6fd",  dot: "#38bdf8" },
  accent: { text: "var(--accent)", bg: "var(--accent-soft)", border: "var(--accent-border)" },
}

// ── Company logo (Clearbit API — real logos) ──────────────────────────────────
function CompanyLogo({ domain, name, size = 44 }: { domain: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1d6fc4","#7c3aed","#1d6fc4","#d97706","#dc2626","#0ea5e9","#6366f1","#ea580c"]
  const bg = colors[name.charCodeAt(0) % colors.length]
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.26, background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 800, fontSize: size * 0.38, userSelect: "none",
        boxShadow: `0 3px 10px ${bg}55`,
      }}>{initials}</div>
    )
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      onError={() => setErr(true)}
      style={{
        width: size, height: size, borderRadius: size * 0.26, objectFit: "contain",
        background: "#fff", border: "1px solid #e4e8ef", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,.08)", padding: 4,
      }}
    />
  )
}

// ── Recruiter avatar (pravatar — realistic profile photos) ────────────────────
function Avatar({ seed, name, size = 36 }: { seed: number; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2)
  const colors = ["#1d6fc4","#7c3aed","#1d6fc4","#d97706","#0ea5e9","#dc2626"]
  const bg = colors[seed % colors.length]
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: size * 0.36, fontWeight: 700,
      }}>{initials}</div>
    )
  }
  return (
    <img
      src={`https://i.pravatar.cc/${size * 2}?img=${seed}`}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  )
}

// ── Match ring (Jobright-style per-job AI match indicator) ───────────────────
function MatchRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#1d4ed8" : pct >= 40 ? "#d97706" : "#9ca3af"
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }} title={`${pct}% match with your profile`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e4e8ef" strokeWidth={4.5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={`${(pct/100)*circ} ${circ}`}
          style={{ transition: "stroke-dasharray .8s cubic-bezier(.34,1.56,.64,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: size * 0.19, color: "#9ca3af", lineHeight: 1 }}>%</span>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 2)   return "just now"
    if (mins < 60)  return `${mins} minutes ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`
    const days = Math.floor(hrs / 24)
    if (days < 7)   return `${days} ${days === 1 ? "day" : "days"} ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 5)  return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`
    const months = Math.floor(days / 30)
    return `${months} ${months === 1 ? "month" : "months"} ago`
  } catch { return "Recently" }
}

function computeMatchPct(title: string, desc: string, keywords: string[]): number {
  if (!keywords.length) return 0
  const text = (title + " " + desc).toLowerCase()
  return Math.round(keywords.filter(k => text.includes(k.toLowerCase())).length / keywords.length * 100)
}

// ── Data ─────────────────────────────────────────────────────────────────────
// Fallback jobs shown while the live /api/jobs response loads
interface LiveJob {
  id: string; title: string; company: string; domain?: string
  location: string; remote: boolean; salary: string | null
  posted: string; description?: string; workAuth: string[]; url: string; source?: string
}
const JOBS: LiveJob[] = [
  { id:"j1",  title:"Cloud Security Engineer",       company:"Palo Alto Networks", domain:"paloaltonetworks.com", location:"Santa Clara, CA", remote:true,  salary:"$175k–$230k", posted:"2h ago",  workAuth:["h1b","w2"],                        url:"https://www.paloaltonetworks.com/company/careers" },
  { id:"j2",  title:"Senior Software Engineer",       company:"Stripe",             domain:"stripe.com",           location:"San Francisco, CA",remote:true,  salary:"$180k–$240k", posted:"Today",   workAuth:["h1b","w2"],                        url:"https://stripe.com/jobs" },
  { id:"j3",  title:"Machine Learning Engineer",      company:"Meta",               domain:"meta.com",             location:"Menlo Park, CA",   remote:true,  salary:"$200k–$280k", posted:"Today",   workAuth:["h1b","green_card","w2"],           url:"https://metacareers.com" },
  { id:"j4",  title:"DevSecOps Engineer",             company:"CrowdStrike",        domain:"crowdstrike.com",      location:"Austin, TX",        remote:true,  salary:"$150k–$200k", posted:"1d ago",  workAuth:["h1b","c2c","w2"],                  url:"https://crowdstrike.com/careers" },
  { id:"j5",  title:"Staff Data Engineer",            company:"Databricks",         domain:"databricks.com",       location:"San Francisco, CA",remote:true,  salary:"$160k–$220k", posted:"Today",   workAuth:["opt_cpt","h1b","green_card","w2"], url:"https://databricks.com/company/careers" },
  { id:"j6",  title:"Full Stack Engineer",            company:"Vercel",             domain:"vercel.com",           location:"Remote",            remote:true,  salary:"$140k–$185k", posted:"2d ago",  workAuth:["h1b","w2"],                        url:"https://vercel.com/careers" },
  { id:"j7",  title:"Senior Data Scientist",          company:"Airbnb",             domain:"airbnb.com",           location:"San Francisco, CA",remote:false, salary:"$160k–$210k", posted:"3d ago",  workAuth:["opt_cpt","w2"],                    url:"https://careers.airbnb.com" },
  { id:"j8",  title:"Platform Engineer",              company:"Salesforce",         domain:"salesforce.com",       location:"San Francisco, CA",remote:true,  salary:"$190k–$260k", posted:"1w ago",  workAuth:["h1b","green_card","w2"],           url:"https://salesforce.com/company/careers" },
  { id:"j9",  title:"Cloud Solutions Architect",      company:"IBM",                domain:"ibm.com",              location:"Remote",            remote:true,  salary:"$140k–$200k", posted:"4d ago",  workAuth:["h1b","c2c","w2"],                  url:"https://ibm.com/employment" },
]

// Work-auth badge palette — the filter competitors charge for, we give for free
const WORK_AUTH_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  h1b:            { label:"H-1B",        color:"#1d6fc4", bg:"#eff6ff", border:"#bfdbfe" },
  opt_cpt:        { label:"OPT/CPT",     color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
  w2:             { label:"W2",           color:"#1558a0", bg:"#dbeafe", border:"#93c5fd" },
  c2c:            { label:"C2C",          color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
  green_card:     { label:"Green Card",   color:"#0ea5e9", bg:"#f0f9ff", border:"#bae6fd" },
  no_sponsorship: { label:"No Sponsor",   color:"#dc2626", bg:"#fef2f2", border:"#fecaca" },
}

const MESSAGES = [
  { id:"m1", from:"Sarah Chen",   company:"Palo Alto Networks",domain:"paloaltonetworks.com", role:"Cloud Security Engineer", text:"Hi Alex, I wanted to follow up on your application — very impressed with your background.", time:"10:32 AM", seed:44, unread:true  },
  { id:"m2", from:"Alex Torres",  company:"CrowdStrike",       domain:"crowdstrike.com",       role:"DevSecOps Engineer",       text:"Your Kubernetes experience caught my eye. Would you be open to a quick intro call?",           time:"Yesterday",seed:15, unread:true  },
  { id:"m3", from:"Priya Sharma", company:"Databricks",        domain:"databricks.com",        role:"Senior Data Engineer",     text:"Great conversation last week! The team is ready to move forward with next steps.",             time:"Mon",      seed:64, unread:false },
]

const CAT_CONFIG: Record<string, { label: string; icon: string; color: keyof typeof P }> = {
  remote: { label:"Remote",     icon:"🌐", color:"remote" },
  intv:   { label:"Interview",  icon:"📞", color:"intv"   },
  assess: { label:"Assessment", icon:"🧪", color:"assess" },
  follow: { label:"Follow-up",  icon:"⏳", color:"follow" },
  rtr:    { label:"RTR",        icon:"📋", color:"rtr"    },
  reply:  { label:"Reply",      icon:"⚡", color:"reply"  },
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function Icon({ d, size = 16, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d}/></svg>
}

// ── Features Carousel ────────────────────────────────────────────────────────
const FEATURES = [
  {
    badge: "✦ Core Feature",
    badgeColor: "#1d6fc4",
    badgeBg: "#eff6ff",
    badgeBorder: "#bfdbfe",
    headline: "Tailor any resume in 12 seconds",
    sub: "Paste a job description and MarketFit rewrites your best-matching resume — every keyword, bullet, and ATS requirement — in under 12 seconds.",
    cta: "Tailor my resume →",
    href: "/dashboard/resume",
    accent: "#1d6fc4",
    img: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=900&h=600&fit=crop&q=85",
    imgAlt: "Person reviewing and editing a resume on a laptop",
    stats: [{ v:"12s", l:"Avg tailor time" }, { v:"94%", l:"Keyword match" }, { v:"3×", l:"More callbacks" }],
    Illustration: IllustTailor,
  },
  {
    badge: "⚡ Chrome Extension",
    badgeColor: "#1d6fc4",
    badgeBg: "#eff6ff",
    badgeBorder: "#bfdbfe",
    headline: "Auto-fill any job form in one click",
    sub: "The MarketFit Chrome Extension detects Greenhouse, Lever, Workday, Workable, Rippling and 10+ other ATS forms — and fills your name, email, visa status and resume data instantly.",
    cta: "Get the extension →",
    href: "#",
    accent: "#1d6fc4",
    img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&h=600&fit=crop&q=85",
    imgAlt: "Modern laptop showing a job application form",
    stats: [{ v:"14+", l:"ATS platforms" }, { v:"1-click", l:"Form fill" }, { v:"0s", l:"Manual typing" }],
    Illustration: IllustExtension,
  },
  {
    badge: "🌐 Job Search",
    badgeColor: "#7c3aed",
    badgeBg: "#f5f3ff",
    badgeBorder: "#ddd6fe",
    headline: "Find jobs that sponsor your visa",
    sub: "Filter thousands of live jobs by H-1B, OPT/CPT, Green Card, W2, or C2C. No more applying to roles that won't sponsor.",
    cta: "Browse live jobs →",
    href: "/dashboard",
    accent: "#7c3aed",
    img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=600&fit=crop&q=85",
    imgAlt: "Team of professionals browsing job listings together",
    stats: [{ v:"H-1B", l:"Sponsor filter" }, { v:"OPT", l:"& CPT filter" }, { v:"Live", l:"Real-time jobs" }],
    Illustration: IllustJobSearch,
  },
  {
    badge: "📋 Job Tracker",
    badgeColor: "#d97706",
    badgeBg: "#fffbeb",
    badgeBorder: "#fde68a",
    headline: "Track every application, end to end",
    sub: "Kanban pipeline from Applied to Offer. Log salary, visa type, recruiter name, and notes — never lose track of an opportunity again.",
    cta: "Open tracker →",
    href: "/dashboard/jobs",
    hrefSession: "pipeline",
    accent: "#d97706",
    img: "https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=900&h=600&fit=crop&q=85",
    imgAlt: "Kanban board with sticky notes for project tracking",
    stats: [{ v:"6", l:"Pipeline stages" }, { v:"Kanban", l:"& list views" }, { v:"Local", l:"Private data" }],
    Illustration: IllustTracker,
  },
  {
    badge: "📊 Analytics",
    badgeColor: "#0ea5e9",
    badgeBg: "#f0f9ff",
    badgeBorder: "#bae6fd",
    headline: "Know which resumes get callbacks",
    sub: "Response rate by resume category, weekly volume trends, and conversion funnel from application to offer — data that sharpens your strategy.",
    cta: "View analytics →",
    href: "/dashboard/jobs",
    hrefSession: "analytics",
    accent: "#0ea5e9",
    img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=600&fit=crop&q=85",
    imgAlt: "Analytics dashboard with charts showing career metrics",
    stats: [{ v:"100%", l:"Response rate" }, { v:"Weekly", l:"Trend charts" }, { v:"Funnel", l:"Stage insight" }],
    Illustration: IllustAnalytics,
  },
  {
    badge: "📧 Gmail",
    badgeColor: "#dc2626",
    badgeBg: "#fef2f2",
    badgeBorder: "#fecaca",
    headline: "Never miss a recruiter email",
    sub: "Connect Gmail and MarketFit surfaces every recruiter message, tracks your replies, and drafts AI responses — so you always reply first.",
    cta: "Connect Gmail →",
    href: "#",
    accent: "#dc2626",
    img: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=900&h=600&fit=crop&q=85",
    imgAlt: "Professional checking email on a modern device",
    stats: [{ v:"AI", l:"Reply drafts" }, { v:"Auto", l:"Track replies" }, { v:"Instant", l:"Alerts" }],
    Illustration: IllustGmail,
  },
]

function FeaturesCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = FEATURES.length

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive(i => (i + 1) % total), 5000)
    return () => clearInterval(t)
  }, [paused, total])

  const f = FEATURES[active]

  return (
    <div
      style={{ borderRadius: 22, overflow: "hidden", position: "relative", border: `1px solid ${P.border}`, boxShadow: "0 2px 16px rgba(26,32,53,.07)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Two-column layout: image left, content right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 340 }}>

        {/* Illustration / Image panel */}
        <div style={{ position: "relative", overflow: "hidden", background: "#e4e8ef" }}>
          {f.Illustration ? (
            <f.Illustration style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}/>
          ) : (
            <img
              key={f.img}
              src={f.img}
              alt={f.imgAlt}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                display: "block", transition: "opacity .4s",
              }}
            />
          )}

          {/* Slide counter badge */}
          <div style={{
            position: "absolute", bottom: 16, left: 16,
            background: "rgba(0,0,0,.38)", backdropFilter: "blur(8px)",
            borderRadius: 20, padding: "4px 12px",
            fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: ".3px",
          }}>
            {active + 1} / {total}
          </div>
        </div>

        {/* Content panel */}
        <div style={{ background: P.surface, padding: "40px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18,
            padding: "4px 13px", borderRadius: 999, width: "fit-content",
            background: f.badgeBg, border: `1px solid ${f.badgeBorder}`,
            fontSize: 11.5, fontWeight: 700, color: f.badgeColor, letterSpacing: ".3px",
          }}>
            {f.badge}
          </div>

          {/* Headline */}
          <h2 style={{ fontSize: 24, fontWeight: 900, color: P.text, letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 12 }}>
            {f.headline}
          </h2>

          {/* Description */}
          <p style={{ fontSize: 13.5, color: P.muted, lineHeight: 1.65, marginBottom: 24, maxWidth: 380 }}>
            {f.sub}
          </p>

          {/* Mini stats row */}
          <div style={{ display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap" }}>
            {f.stats.map(s => (
              <div key={s.l}>
                <p style={{ fontSize: 16, fontWeight: 900, color: f.accent, lineHeight: 1, letterSpacing: "-0.5px" }}>{s.v}</p>
                <p style={{ fontSize: 10.5, color: P.hint, fontWeight: 600, marginTop: 2 }}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link href={f.href} onClick={() => { if ((f as {hrefSession?:string}).hrefSession) try { sessionStorage.setItem("jd_view", (f as {hrefSession?:string}).hrefSession!) } catch {} }} style={{
            display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content",
            padding: "10px 22px", borderRadius: 10, fontSize: 13.5, fontWeight: 700,
            color: "#fff", textDecoration: "none",
            background: `linear-gradient(135deg, ${f.accent}dd 0%, ${f.accent} 100%)`,
            boxShadow: `0 4px 14px ${f.accent}44`,
          }}>
            {f.cta}
          </Link>
        </div>
      </div>

      {/* ── Bottom controls bar ── */}
      <div style={{
        background: P.surface, borderTop: `1px solid ${P.border}`,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {FEATURES.map((feat, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 22 : 7,
                height: 7, borderRadius: 4,
                background: i === active ? f.accent : P.border,
                border: "none", cursor: "pointer", padding: 0,
                transition: "width .25s, background .25s",
              }}
            />
          ))}
        </div>

        {/* Feature label pills */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {FEATURES.map((feat, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                padding: "4px 11px", borderRadius: 20, border: "1px solid",
                borderColor: i === active ? feat.badgeBorder : P.border,
                background: i === active ? feat.badgeBg : "transparent",
                color: i === active ? feat.badgeColor : P.hint,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                transition: "all .2s", whiteSpace: "nowrap",
              }}
            >
              {feat.badge.split(" ").slice(1).join(" ")}
            </button>
          ))}
        </div>

        {/* Prev / Next */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "←", delta: -1 },
            { label: "→", delta: 1  },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => setActive(i => (i + btn.delta + total) % total)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: `1px solid ${P.border}`, background: P.surface,
                color: P.text, fontSize: 14, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = f.accent; el.style.background = f.badgeBg }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = P.border; el.style.background = P.surface }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Unified Power Card (Tailor + Autofill) ───────────────────────────────────
function PowerCard() {
  const [jd, setJd] = useState("")
  const [url, setUrl] = useState("")

  const FIELD_STYLE = (active: boolean): React.CSSProperties => ({
    width: "100%", resize: "none", borderRadius: 10, fontSize: 13, lineHeight: 1.6,
    color: P.text, padding: "11px 13px", outline: "none", fontFamily: "inherit",
    border: `1.5px solid ${active ? "#bfdbfe" : P.border}`,
    background: active ? "#f8fbff" : "#f9fafb",
    transition: "border-color .15s, background .15s", boxSizing: "border-box" as const,
  })

  return (
    <div style={{
      position: "relative", borderRadius: 20, overflow: "hidden",
      border: "1px solid #bfdbfe",
      boxShadow: "0 8px 40px -8px rgba(29,111,196,.18), 0 2px 8px rgba(29,111,196,.07)",
    }}>
      {/* shared background */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#eff6ff 0%,#f0f9ff 40%,#f5f3ff 100%)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:360, height:360, borderRadius:"50%", background:"rgba(29,111,196,.04)", top:-140, right:0, pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:"rgba(124,58,237,.03)", bottom:-80, left:120, pointerEvents:"none" }}/>

      <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns:"1fr 1px 1fr", gap:0 }}>

        {/* ── LEFT: Tailor Resume ── */}
        <div style={{ padding:"32px 36px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px",
            background:"rgba(29,111,196,.10)", border:"1px solid rgba(29,111,196,.20)",
            borderRadius:999, marginBottom:14 }}>
            <span style={{ fontSize:13 }}>✦</span>
            <span style={{ fontSize:11.5, fontWeight:700, color:"#1558a0", letterSpacing:".3px" }}>Tailor Resume · ⚡ 12 sec</span>
          </div>
          <h2 style={{ fontSize:21, fontWeight:900, color:P.text, letterSpacing:"-0.5px", lineHeight:1.2, marginBottom:8 }}>
            Tailor your resume<br/>
            <span style={{ color:"#1d6fc4" }}>to any JD instantly.</span>
          </h2>
          <p style={{ fontSize:13, color:P.muted, lineHeight:1.6, marginBottom:18 }}>
            Paste a job description — MarketFit rewrites your best-matching resume in seconds, every keyword and bullet perfectly aligned.
          </p>

          <div style={{ background:"#ffffff", border:`1px solid ${P.border}`, borderRadius:14, padding:"18px", boxShadow:"0 2px 12px rgba(29,111,196,.07)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,var(--accent),var(--accent-h))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>✦</div>
              <span style={{ fontSize:12.5, fontWeight:700, color:P.text }}>Paste a job description</span>
            </div>
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder={"Paste any JD here — LinkedIn, Indeed, Greenhouse…\n\ne.g. \"We're hiring a Senior Cloud Engineer with 5+ years of AWS…\""}
              rows={5}
              style={FIELD_STYLE(!!jd)}
              onFocus={e => { e.currentTarget.style.borderColor="#1d6fc4"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(29,111,196,.10)" }}
              onBlur={e => { e.currentTarget.style.borderColor=jd ? "#bfdbfe" : P.border; e.currentTarget.style.boxShadow="none" }}
            />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, gap:8 }}>
              <span style={{ fontSize:11, color:P.hint }}>{jd.length > 0 ? `${jd.length} chars · ready` : "No JD yet"}</span>
              <Link href="/dashboard/resume"
                onClick={() => jd.trim() && sessionStorage.setItem("jd_prefill", jd.trim())}
                style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  padding:"9px 20px", borderRadius:9, fontSize:13, fontWeight:700,
                  color:"#fff", textDecoration:"none", whiteSpace:"nowrap",
                  background: jd.trim() ? "linear-gradient(135deg,var(--accent),var(--accent-h))" : "#c5d4e8",
                  boxShadow: jd.trim() ? "0 4px 14px rgba(29,111,196,.28)" : "none",
                  transition:"all .2s",
                }}>
                {jd.trim() ? "⚡ Tailor Now" : "Open Tailor →"}
              </Link>
            </div>
          </div>

          <div style={{ display:"flex", gap:18, marginTop:18, flexWrap:"wrap" }}>
            {[{v:"12s",l:"Tailor time",i:"⚡"},{v:"94%",l:"Avg match",i:"🎯"},{v:"3×",l:"More callbacks",i:"📞"}].map(s=>(
              <div key={s.l}>
                <p style={{ fontSize:18, fontWeight:900, color:"#1d6fc4", lineHeight:1 }}>{s.i} {s.v}</p>
                <p style={{ fontSize:10.5, color:P.hint, fontWeight:600, marginTop:2 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* divider */}
        <div style={{ background:`linear-gradient(180deg,transparent,${P.border} 20%,${P.border} 80%,transparent)` }}/>

        {/* ── RIGHT: Auto-fill Extension ── */}
        <div style={{ padding:"32px 36px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px",
            background:"rgba(29,111,196,.10)", border:"1px solid rgba(29,111,196,.22)",
            borderRadius:999, marginBottom:14 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#1d6fc4", animation:"pulse 2s infinite" }}/>
            <span style={{ fontSize:11.5, fontWeight:700, color:"#1558a0", letterSpacing:".3px" }}>Chrome Extension · Auto-fill</span>
          </div>
          <h2 style={{ fontSize:21, fontWeight:900, color:P.text, letterSpacing:"-0.5px", lineHeight:1.2, marginBottom:8 }}>
            Auto-fill any job form<br/>
            <span style={{ color:"#1d6fc4" }}>in seconds, not minutes.</span>
          </h2>
          <p style={{ fontSize:13, color:P.muted, lineHeight:1.6, marginBottom:18 }}>
            MarketFit detects Greenhouse, Lever, Workday, Workable, Rippling and 10+ other ATS forms — fills your name, email, visa status, and tailored resume in one click.
          </p>

          {/* Mini browser mockup */}
          <div style={{ background:"#ffffff", border:`1px solid ${P.border}`, borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(29,111,196,.07)", marginBottom:18 }}>
            {/* Browser bar */}
            <div style={{ background:P.bg, padding:"8px 12px", display:"flex", alignItems:"center", gap:5, borderBottom:`1px solid ${P.border}` }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#f87171" }}/>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#fbbf24" }}/>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#60a5fa" }}/>
              <div style={{ flex:1, background:"#fff", borderRadius:4, padding:"3px 8px", fontSize:9, color:P.hint, border:`1px solid ${P.border}` }}>
                careers.greenhouse.io/apply
              </div>
              {/* Extension badge */}
              <div style={{ display:"flex", alignItems:"center", gap:4, background:"#1d6fc4", borderRadius:5, padding:"2px 7px" }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:"#60a5fa" }}/>
                <span style={{ fontSize:7.5, color:"#fff", fontWeight:700 }}>CK</span>
              </div>
            </div>
            {/* Form fields */}
            <div style={{ padding:"12px 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { label:"First Name", value:"Alex",              ok:true },
                { label:"Last Name",  value:"Johnson",           ok:true },
                { label:"Email",      value:"alex.j@email.com",  ok:true },
                { label:"Work Auth",  value:"H-1B Transfer",     ok:true },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ fontSize:8, color:P.hint, marginBottom:2, fontWeight:600 }}>{f.label}</p>
                  <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:5, padding:"4px 7px", fontSize:8.5, color:P.text, fontWeight:600, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    {f.value}
                    {f.ok && <span style={{ width:9, height:9, borderRadius:"50%", background:"#1d6fc4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:5.5, color:"#fff", fontWeight:700, flexShrink:0 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* Match bar */}
            <div style={{ margin:"0 14px 12px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:7, padding:"7px 10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:8.5, color:"#1d6fc4", fontWeight:700 }}>Resume match · Cloud Security Eng</span>
                <span style={{ fontSize:9, color:"#1d6fc4", fontWeight:800 }}>94%</span>
              </div>
              <div style={{ height:3, background:"#dbeafe", borderRadius:2 }}>
                <div style={{ height:3, width:"94%", background:"linear-gradient(90deg,var(--accent),color-mix(in srgb, var(--accent) 55%, white))", borderRadius:2 }}/>
              </div>
            </div>
            <div style={{ margin:"0 14px 12px", background:"linear-gradient(135deg,var(--accent),var(--accent-h))", borderRadius:7, padding:"7px", textAlign:"center", fontSize:9, color:"#fff", fontWeight:800 }}>
              ⚡ Auto-filled 6 fields · Click to apply
            </div>
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:18 }}>
            {["Greenhouse","Lever","Workday","Workable","Rippling","iCIMS","Taleo","BambooHR","Ashby","LinkedIn"].map(p => (
              <span key={p} style={{ padding:"3px 10px", borderRadius:20, background:"rgba(29,111,196,.08)", border:"1px solid rgba(29,111,196,.18)", fontSize:11, fontWeight:600, color:"#1558a0" }}>{p}</span>
            ))}
          </div>
          <a href="/dashboard/settings" style={{
            display:"inline-flex", alignItems:"center", gap:8, padding:"10px 22px",
            background:"linear-gradient(135deg,var(--accent),var(--accent-h))", color:"#fff",
            borderRadius:10, fontSize:13.5, fontWeight:800, textDecoration:"none",
            boxShadow:"0 4px 14px rgba(29,111,196,.28)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Get Extension — Free
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Gmail connect banner + feature chips ──────────────────────────────────────
function GmailBanner() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("gmail") === "connected") {
        localStorage.setItem("mf_gmail_connected", "1")
        window.history.replaceState({}, "", window.location.pathname)
      }
      setConnected(!!localStorage.getItem("mf_gmail_connected"))
    } catch {}
  }, [])

  async function handleConnect() {
    try {
      await connectGmail()
      // OAuth will redirect away; on return the callback sets mf_gmail_connected
    } catch {
      // Supabase not configured — demo mode
      try { localStorage.setItem("mf_gmail_connected", "1") } catch {}
      setConnected(true)
    }
  }

  return (
    <div style={{ background:"#ffffff", border:`1px solid ${P.border}`, borderRadius:16,
      padding:"20px 28px", boxShadow:"0 1px 3px rgba(26,32,53,.05)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>

        {/* Left: Gmail CTA */}
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"#fef2f2", border:"1px solid #fecaca",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>📧</div>
          <div>
            <p style={{ fontSize:14, fontWeight:800, color:P.text, marginBottom:2 }}>
              {connected ? "✅ Gmail connected" : "Connect Gmail to track recruiter emails"}
            </p>
            <p style={{ fontSize:12, color:P.muted }}>
              {connected
                ? "Emails synced · Smart alerts active · Applications auto-tracked"
                : "Auto-detect recruiter replies, interview invites, and application updates."}
            </p>
          </div>
        </div>

        {/* Right: connect button or status */}
        {!connected ? (
          <button onClick={handleConnect} style={{
            display:"inline-flex", alignItems:"center", gap:8,
            padding:"9px 20px", borderRadius:9, fontSize:13, fontWeight:700,
            color:"#fff", background:"linear-gradient(135deg,#ea4335,#c5221f)",
            border:"none", cursor:"pointer", flexShrink:0,
            boxShadow:"0 3px 12px rgba(234,67,53,.28)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect width="20" height="16" x="2" y="4" rx="2" stroke="#fff" strokeWidth="2"/><path d="m2 7 10 7 10-7" stroke="#fff" strokeWidth="2"/></svg>
            Connect Gmail
          </button>
        ) : (
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
            borderRadius:9, background:"#eff6ff", border:"1px solid #bfdbfe",
            fontSize:13, fontWeight:700, color:"#1d6fc4" }}>
            ✓ Connected
          </span>
        )}
      </div>

      {/* Feature chips */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:16, paddingTop:16, borderTop:`1px solid ${P.border}` }}>
        {[
          { icon:"📧", label:"Gmail sync",         desc:"Recruiter emails auto-detected",   color:"#fef2f2", border:"#fecaca", text:"#b91c1c" },
          { icon:"🔔", label:"Smart alerts",        desc:"Reply · Interview · Offer alerts", color:"#fffbeb", border:"#fde68a", text:"#92400e" },
          { icon:"📱", label:"Push notifications",  desc:"Never miss a recruiter reply",     color:"#eff6ff", border:"#bfdbfe", text:"#1558a0" },
          { icon:"🔗", label:"Auto-track apps",     desc:"Applied jobs logged automatically",color:"#eff6ff", border:"#bfdbfe", text:"#1558a0" },
          { icon:"📊", label:"Response analytics",  desc:"Open rates, reply rates tracked",  color:"#f5f3ff", border:"#ddd6fe", text:"#6d28d9" },
          { icon:"🤖", label:"AI email drafts",     desc:"Reply to recruiters with 1 click", color:"#fff7ed", border:"#fed7aa", text:"#c2410c" },
        ].map(chip => (
          <div key={chip.label} style={{
            display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
            borderRadius:10, background:chip.color, border:`1px solid ${chip.border}`,
          }}>
            <span style={{ fontSize:14 }}>{chip.icon}</span>
            <div>
              <p style={{ fontSize:11.5, fontWeight:700, color:chip.text, lineHeight:1 }}>{chip.label}</p>
              <p style={{ fontSize:10.5, color:P.muted, marginTop:1 }}>{chip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


type DashJob = { id:string; title:string; company:string; domain:string; location:string; remote:boolean; salary:string|null; description:string; workAuth:string[]; url:string; source?:string; posted:string; catKey:keyof typeof CAT_CONFIG }

function normalizeStaticJobs(): DashJob[] {
  return JOBS.map(j => ({
    id: j.id, title: j.title, company: j.company,
    domain: j.domain ?? (j.company.toLowerCase().replace(/\s+/g,"") + ".com"),
    location: j.location, remote: j.remote, salary: j.salary,
    description: j.description ?? "", workAuth: j.workAuth, url: j.url, posted: j.posted,
    catKey: (j.workAuth.includes("h1b") ? "remote" : "follow") as keyof typeof CAT_CONFIG,
  }))
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [firstName, setFirstName] = useState("")
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [userKw, setUserKw] = useState<string[]>([])
  const [liveJobs, setLiveJobs] = useState<DashJob[] | null>(null)
  const [stats, setStats] = useState([
    { label:"Saved Jobs",  value:0,  icon:"🔖", ...P.accent  },
    { label:"Applied",     value:0,  icon:"📨", ...P.assess  },
    { label:"Interviews",  value:0,  icon:"📞", ...P.intv    },
    { label:"Offers",      value:0,  icon:"🎉", ...P.rtr     },
  ])

  const [jobQuery, setJobQuery] = useState("")
  const [jobFilter, setJobFilter] = useState("all")
  const [jobsLive, setJobsLive] = useState(false)
  const [notInterested, setNotInterested] = useState<Set<string>>(new Set())
  const [recentApps, setRecentApps] = useState<Array<{id:string;company:string;role:string;stage:string;appliedDate:string;salary:string;visa:string}>>([])
  const [overdueCount, setOverdueCount] = useState(0)

  const loadLiveJobs = useCallback(async (q = "") => {
    try {
      const res = await fetchJobsApi(`/api/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      const data = await res.json()
      if (Array.isArray(data.jobs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized: DashJob[] = data.jobs.slice(0, 9).map((j: any) => ({
          id: String(j.id), title: String(j.title), company: String(j.company),
          domain: String(j.company).toLowerCase().replace(/\s+/g,"") + ".com",
          location: String(j.location || ""), remote: Boolean(j.remote),
          salary: j.salary ? String(j.salary) : null,
          description: String(j.description || ""),
          workAuth: Array.isArray(j.workAuth) ? j.workAuth as string[] : [],
          url: String(j.url || "#"), source: j.source ? String(j.source) : undefined,
          posted: String(j.posted || ""), catKey: "remote" as keyof typeof CAT_CONFIG,
        }))
        setLiveJobs(normalized)
        setJobsLive(!!data.live)
      }
    } catch { /* keep static jobs as fallback */ }
  }, [])

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(({ profile }) => {
        const name = profile?.full_name as string | undefined
        if (name) setFirstName(name.split(/\s+/)[0])
      })
      .catch(() => {})
    try { setSaved(new Set(JSON.parse(localStorage.getItem("jd_saved_ids") || "[]"))) } catch {}
    try { setNotInterested(new Set(JSON.parse(localStorage.getItem("jd_not_interested") || "[]"))) } catch {}
    try {
      const rawApps: Array<{id:string;company:string;role:string;stage:string;appliedDate:string;salary:string;visa:string;followUpDate?:string}> = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      const sorted = [...rawApps].sort((a,b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())
      setRecentApps(sorted.slice(0,5))
      const today = new Date(new Date().toDateString())
      setOverdueCount(rawApps.filter(a => a.followUpDate && new Date(a.followUpDate) < today).length)
      const apps: Array<{stage:string}> = rawApps
      const savedJobs: unknown[] = JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]")
      setStats([
        { label:"Saved Jobs",  value: savedJobs.length,  icon:"🔖", ...P.accent },
        { label:"Applied",     value: apps.length,        icon:"📨", ...P.assess },
        { label:"Interviews",  value: apps.filter(a => a.stage === "interview").length, icon:"📞", ...P.intv },
        { label:"Offers",      value: apps.filter(a => a.stage === "offer").length,     icon:"🎉", ...P.rtr  },
      ])
    } catch {}
    // Load user keywords for match rings
    try {
      const r = JSON.parse(sessionStorage.getItem("careerkit_last_result") || "{}")
      if (Array.isArray(r.matched_on) && r.matched_on.length) { setUserKw(r.matched_on); return }
    } catch {}
    try {
      const p = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      if (p.skills) setUserKw(String(p.skills).split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 30))
    } catch {}
    void loadLiveJobs("")
  }, [loadLiveJobs])

  function toggleSave(job: DashJob) {
    setSaved(prev => {
      const next = new Set(prev)
      const adding = !next.has(job.id)
      adding ? next.add(job.id) : next.delete(job.id)
      localStorage.setItem("jd_saved_ids", JSON.stringify([...next]))
      // Also keep jd_saved_jobs in sync so the Saved Jobs page can display them
      try {
        const existing = JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]")
        const filtered = existing.filter((j: {id:string}) => j.id !== job.id)
        const updated = adding ? [{ ...job, savedAt: new Date().toISOString(), status: "interested", notes: "" }, ...filtered] : filtered
        localStorage.setItem("jd_saved_jobs", JSON.stringify(updated))
      } catch {}
      return next
    })
  }

  const hour   = new Date().getHours()
  const day    = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>

      {/* ── HERO ROW ── greeting + date + CTA ──────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-h) 0%, var(--accent) 65%, color-mix(in srgb, var(--accent) 70%, #fff) 100%)",
        borderRadius: 20,
        padding: "36px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 48px -12px color-mix(in srgb, var(--accent) 50%, transparent), 0 6px 16px -6px color-mix(in srgb, var(--accent) 30%, transparent)",
      }}>
        {/* decorative orbs */}
        <div style={{ position:"absolute", width:260, height:260, borderRadius:"50%", background:"rgba(255,255,255,.05)", top:-80, right:160, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,.04)", bottom:-60, right:40, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 55% 80% at 90% 50%, rgba(120,190,255,.15) 0%, transparent 65%)", pointerEvents:"none" }}/>

        <div style={{ position:"relative", zIndex:1 }}>
          <p style={{ color:"rgba(255,255,255,.65)", fontSize:13, fontWeight:500, marginBottom:6, letterSpacing:.3 }}>{day}</p>
          <h1 style={{ color:"#fff", fontSize:30, fontWeight:800, letterSpacing:"-0.5px", lineHeight:1.15, marginBottom:8 }}>
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p style={{ color:"rgba(255,255,255,.72)", fontSize:14.5, lineHeight:1.5, maxWidth:460 }}>
            Your AI-powered job search assistant.{stats[1].value > 0
              ? ` ${stats[1].value} applications tracked across your pipeline.`
              : " Start applying and track your progress here."}
          </p>
          <div style={{ display:"flex", gap:10, marginTop:20, flexWrap:"wrap" }}>
            <Link href="/dashboard/resume" style={{
              display:"inline-flex", alignItems:"center", gap:7, padding:"9px 20px",
              background:"#fff", color:"var(--accent-h)", borderRadius:9, fontSize:13, fontWeight:700,
              textDecoration:"none", boxShadow:"0 3px 14px rgba(0,0,0,.18)",
            }}>✦ Tailor My Resume</Link>
            <Link href="/dashboard/resume?tab=builder" style={{
              display:"inline-flex", alignItems:"center", gap:7, padding:"9px 20px",
              background:"rgba(255,255,255,.18)", color:"#fff", borderRadius:9, fontSize:13, fontWeight:600,
              textDecoration:"none", border:"1px solid rgba(255,255,255,.35)",
              backdropFilter:"blur(8px)",
            }}>📄 Build Resume</Link>
            <Link href="/dashboard/jobs" onClick={() => { try { sessionStorage.setItem("jd_view", "pipeline") } catch {} }} style={{
              display:"inline-flex", alignItems:"center", gap:7, padding:"9px 20px",
              background:"rgba(255,255,255,.10)", color:"rgba(255,255,255,.85)", borderRadius:9, fontSize:13, fontWeight:600,
              textDecoration:"none", border:"1px solid rgba(255,255,255,.20)",
            }}>View Pipeline →</Link>
          </div>
        </div>

        {/* Mini stats pill row inside hero */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", position:"relative", zIndex:1 }}>
          {[
            { v: String(stats[1].value || "0"), label:"Applied",    color:"rgba(255,255,255,.9)"  },
            { v: String(stats[2].value || "0"), label:"Interviews", color:"#93c5fd"               },
            { v: String(stats[3].value || "0"), label:"Offers",     color:"#fde68a"               },
          ].map(s => (
            <div key={s.label} style={{
              background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
              borderRadius:12, padding:"14px 20px", textAlign:"center", minWidth:80,
              backdropFilter:"blur(8px)",
            }}>
              <p style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1, letterSpacing:"-1px" }}>{s.v}</p>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.65)", marginTop:4, fontWeight:600 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT: Job Board (left main) + Sidebar (right) ── */}
      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 352px", gap:22, alignItems:"start" }}>

        {/* ── LEFT: Live Job Board (the main feed) ── */}
        <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:20, overflow:"hidden", boxShadow:"0 1px 3px rgba(26,32,53,.05)" }}>
          {/* ── Header: title + real-time search + filter chips ── */}
          <div style={{ padding:"18px 20px 0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:11 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <h2 style={{ fontSize:16, fontWeight:800, color:P.text, letterSpacing:"-0.3px" }}>Job Feed</h2>
                {jobsLive
                  ? <span style={{ padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:700, background:"#eff6ff", color:"#1d6fc4", border:"1px solid #bfdbfe" }}>● Live</span>
                  : <span style={{ padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:600, background:P.surfaceAlt, color:P.hint, border:`1px solid ${P.border}` }}>Sample</span>}
              </div>
              <Link href="/dashboard/jobs" style={{ fontSize:12.5, color:"#1d6fc4", fontWeight:600, textDecoration:"none" }}>Browse All →</Link>
            </div>
            <div style={{ position:"relative", marginBottom:11 }}>
              <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:P.hint, pointerEvents:"none" }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={jobQuery} onChange={e => setJobQuery(e.target.value)} placeholder="Search by title, company, or keyword…"
                style={{ width:"100%", paddingLeft:30, paddingRight:jobQuery?30:12, paddingTop:8, paddingBottom:8, borderRadius:9, border:`1px solid ${P.border}`, fontSize:13, color:P.text, background:P.surfaceAlt, outline:"none", boxSizing:"border-box" as const, transition:"border-color .15s, background .15s" }}
                onFocus={e => { e.currentTarget.style.borderColor="#93c5fd"; e.currentTarget.style.background="#f8fbff" }}
                onBlur={e => { e.currentTarget.style.borderColor=P.border; e.currentTarget.style.background=P.surfaceAlt }}
              />
              {jobQuery && <button onClick={() => setJobQuery("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", border:"none", background:"none", cursor:"pointer", color:P.hint, padding:2, display:"flex" }}><X size={13}/></button>}
            </div>
            <div style={{ display:"flex", gap:8, paddingBottom:12, alignItems:"center" }}>
              <select value={jobFilter} onChange={e => setJobFilter(e.target.value as "all"|"remote"|"h1b"|"gc"|"salary")}
                style={{ padding:"6px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
                  background: jobFilter !== "all" ? P.accent.bg : P.surfaceAlt,
                  color: jobFilter !== "all" ? P.accent.text : P.muted,
                  border: `1.5px solid ${jobFilter !== "all" ? P.accent.border : P.border}`,
                  flex:"0 0 auto",
                }}>
                <option value="all">All Jobs</option>
                <option value="remote">Remote only</option>
                <option value="h1b">H-1B Likely</option>
                <option value="gc">GC / Citizen</option>
                <option value="salary">Salary Listed</option>
              </select>
              {(jobFilter !== "all") && (
                <button onClick={() => setJobFilter("all")} style={{ padding:"4px 8px", borderRadius:7, border:"none", background:"#fee2e2", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:3 }}><X size={10}/> Clear</button>
              )}
            </div>
          </div>

          {/* ── JobRight-style vertical scrollable feed ── */}
          {(() => {
            const allJobs: DashJob[] = liveJobs ?? normalizeStaticJobs()
            let displayJobs = allJobs.filter(j => !notInterested.has(j.id))
            if (jobFilter === "remote") displayJobs = displayJobs.filter(j => j.remote)
            if (jobFilter === "h1b")    displayJobs = displayJobs.filter(j => getH1BScore(j.company).status === "likely")
            if (jobFilter === "gc")     displayJobs = displayJobs.filter(j => j.workAuth.some((k: string) => k.startsWith("gc") || k === "citizen"))
            if (jobFilter === "salary") displayJobs = displayJobs.filter(j => !!j.salary)
            if (jobQuery.trim()) {
              const q = jobQuery.toLowerCase()
              displayJobs = displayJobs.filter(j =>
                j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.description||"").toLowerCase().includes(q)
              )
            }
            return (
              <div style={{ maxHeight:"74vh", overflowY:"auto", overflowX:"hidden", borderTop:`1px solid ${P.border}` }}>
                {displayJobs.length === 0 && (
                  <div style={{ padding:"48px 20px", textAlign:"center" }}>
                    <p style={{ fontSize:14, color:P.muted, marginBottom:12 }}>No jobs match your filters.</p>
                    <button onClick={() => { setJobFilter("all"); setJobQuery("") }} style={{ padding:"7px 16px", borderRadius:9, fontSize:12.5, fontWeight:700, background:P.accent.bg, color:P.accent.text, border:`1px solid ${P.accent.border}`, cursor:"pointer" }}>Clear filters</button>
                  </div>
                )}
                {displayJobs.map(job => {
                  const match = computeMatchPct(job.title, job.description, userKw)
                  const isSaved = saved.has(job.id)
                  const h1b = getH1BScore(job.company)
                  return (
                    <div key={job.id}
                      style={{ borderBottom:`1px solid ${P.border}`, background:P.surface, transition:"background .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#f8f9fb" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background=P.surface }}
                    >
                      <div style={{ display:"flex", gap:13, padding:"15px 20px", alignItems:"flex-start" }}>
                        <div style={{ flexShrink:0, marginTop:2 }}><CompanyLogo domain={job.domain} name={job.company} size={42} /></div>
                        {/* Main info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <span style={{ fontSize:11, color:P.hint }}>{timeAgo(job.posted)}</span>
                            {job.source && job.source !== "sample" && <span style={{ fontSize:10.5, color:"#0369a1", background:"#f0f9ff", padding:"1px 6px", borderRadius:10, fontWeight:600, border:"1px solid #bae6fd" }}>via {job.source}</span>}
                          </div>
                          <a href={job.url && job.url !== "#" ? job.url : undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
                            <h3 style={{ fontWeight:700, fontSize:14.5, color:P.text, lineHeight:1.3, marginBottom:2 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#1d6fc4" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=P.text }}
                            >{job.title}</h3>
                          </a>
                          <p style={{ fontSize:13, color:P.muted, fontWeight:500, marginBottom:7 }}>{job.company}</p>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 14px", fontSize:12, color:P.muted, marginBottom:8 }}>
                            {job.location && <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><MapPin size={11}/> {job.location}</span>}
                            {job.remote && <span style={{ color:"#1d6fc4", fontWeight:600, display:"inline-flex", alignItems:"center", gap:3 }}><Globe size={11}/> Remote</span>}
                            {job.salary && <span style={{ color:"#1d6fc4", fontWeight:700, display:"inline-flex", alignItems:"center", gap:3 }}><DollarSign size={11}/> {job.salary}</span>}
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                            <span title={h1b.reason} style={{ padding:"2px 8px", borderRadius:6, fontSize:10.5, fontWeight:700, background:h1b.bg, color:h1b.color, border:`1px solid ${h1b.border}`, cursor:"help", display:"inline-flex", alignItems:"center", gap:5 }}>
                              <span style={{ width:6, height:6, borderRadius:"50%", background:"currentColor", flexShrink:0 }}/> {h1b.label}
                            </span>
                            {job.workAuth.slice(0,3).map(key => {
                              const b = WORK_AUTH_BADGES[key]; if (!b) return null
                              return <span key={key} style={{ padding:"2px 8px", borderRadius:6, fontSize:10.5, fontWeight:700, background:b.bg, color:b.color, border:`1px solid ${b.border}` }}>{b.label}</span>
                            })}
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <Link href="/dashboard/ai-tools"
                              onClick={() => { try { const t=job.title+" at "+job.company+"\n\n"+(job.description||""); sessionStorage.setItem("jd_ai_tab","cover"); sessionStorage.setItem("jd_prefill_jd",t); sessionStorage.setItem("jd_prefill_role",job.title); sessionStorage.setItem("jd_prefill_company",job.company) } catch {} }}
                              style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 11px", background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1558a0", borderRadius:7, fontSize:11.5, fontWeight:700, textDecoration:"none" }}>
                              <Sparkles size={12}/> Nexus AI
                            </Link>
                            <Link href="/dashboard/resume"
                              onClick={() => { try { const t=job.title+" at "+job.company+"\n\n"+(job.description||""); sessionStorage.setItem("jd_prefill",t); sessionStorage.setItem("jd_prefill_jd",t); sessionStorage.setItem("jd_prefill_role",job.title); sessionStorage.setItem("jd_prefill_company",job.company) } catch {} }}
                              style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 11px", background:"#f5f3ff", border:"1px solid #ddd6fe", color:"#6d28d9", borderRadius:7, fontSize:11.5, fontWeight:700, textDecoration:"none" }}>
                              <FileText size={12}/> Tailor
                            </Link>
                            <button onClick={() => setNotInterested(prev => { const n=new Set(prev); n.add(job.id); localStorage.setItem("jd_not_interested",JSON.stringify([...n])); return n })}
                              style={{ marginLeft:"auto", padding:"4px 9px", borderRadius:7, border:"none", fontSize:11, fontWeight:600, color:P.hint, background:"transparent", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:3 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#dc2626" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=P.hint }}
                            ><X size={11}/> Hide</button>
                          </div>
                        </div>

                        {/* Match ring + bookmark (right column) */}
                        <div style={{ flexShrink:0, display:"flex", flexDirection:"column" as const, alignItems:"center", gap:8, paddingTop:2 }}>
                          {userKw.length > 0 && <MatchRing pct={match} size={52} />}
                          <button onClick={e => { e.stopPropagation(); toggleSave(job) }} style={{
                            padding:"6px", borderRadius:8, border:`1px solid ${isSaved?"#bfdbfe":P.border}`, cursor:"pointer",
                            color:isSaved?"#1d6fc4":P.hint, background:isSaved?P.accent.bg:"transparent", transition:"all .15s",
                          }}>
                            <svg width="16" height="16" fill={isSaved?"currentColor":"none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div style={{ padding:"12px 20px", borderTop:`1px solid ${P.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontSize:11.5, color:P.hint, display:"inline-flex", alignItems:"center", gap:5 }}>
              {jobsLive && <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", flexShrink:0 }}/>}
              {jobsLive ? "Live from The Muse" : "Sample data · live jobs load on page open"}
            </p>
            <Link href="/dashboard/jobs" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 20px", background:"linear-gradient(135deg,var(--accent),var(--accent-h))", color:"#fff", borderRadius:9, fontSize:13, fontWeight:700, textDecoration:"none", boxShadow:"0 3px 10px color-mix(in srgb, var(--accent) 30%, transparent)" }}>Browse All Jobs →</Link>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: Stats + Recent Activity ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Compact 2×2 stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {stats.map((s, i) => {
              const StatIcon = [Bookmark, Send, Phone, PartyPopper][i] ?? Target
              return (
              <div key={s.label} style={{
                background: P.surface, border:`1px solid ${P.border}`, borderRadius:14,
                padding:"16px 18px", position:"relative", overflow:"hidden",
                boxShadow:"0 1px 3px rgba(26,32,53,.05)",
                transition:"box-shadow .2s, transform .2s, border-color .2s",
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow=`0 0 0 1px ${s.border}, 0 8px 24px -6px rgba(29,111,196,.18)`; el.style.transform="translateY(-2px)"; el.style.borderColor=s.border }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow="0 1px 3px rgba(26,32,53,.05)"; el.style.transform=""; el.style.borderColor=P.border }}
              >
                <div style={{ position:"absolute", top:0, left:0, right:0, height:3, borderRadius:"14px 14px 0 0", background:`linear-gradient(90deg, ${"dot" in s ? s.dot : s.text} 0%, transparent 100%)`, opacity:.7 }}/>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                  <div>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:".5px", color:P.hint, marginBottom:4 }}>{s.label}</p>
                    <p style={{ fontSize:28, fontWeight:800, color:P.text, lineHeight:1, letterSpacing:"-1px" }}>{s.value}</p>
                    <p style={{ fontSize:10, color:s.text, fontWeight:600, marginTop:4 }}>
                      {i===0 ? "Shortlisted" : i===1 ? (s.value ? "Active" : "Start applying") : i===2 ? (s.value ? "Active" : "None yet") : (s.value ? "Negotiate!" : "Keep going!")}
                    </p>
                  </div>
                  <div style={{ width:34, height:34, borderRadius:9, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:s.text }}><StatIcon size={17}/></div>
                </div>
              </div>
              )
            })}
          </div>

          {/* Recent Activity */}
          <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:20, overflow:"hidden", boxShadow:"0 1px 3px rgba(26,32,53,.05)" }}>
            <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${P.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <h3 style={{ fontSize:14, fontWeight:700, color:P.text, letterSpacing:"-0.2px" }}>Recent Activity</h3>
                <p style={{ fontSize:11.5, color:P.muted, marginTop:1 }}>
                  {recentApps.length > 0
                    ? `${recentApps.length} application${recentApps.length!==1?"s":""}${overdueCount>0?` · ${overdueCount} overdue`:""}`
                    : "No applications yet"}
                </p>
              </div>
              <Link href="/dashboard/jobs" onClick={()=>{try{sessionStorage.setItem("jd_view","pipeline")}catch{}}} style={{ fontSize:12, color:"#1d6fc4", fontWeight:600, textDecoration:"none" }}>Pipeline →</Link>
            </div>
            {recentApps.length === 0 ? (
              <div style={{ padding:"24px 20px", textAlign:"center" }}>
                <p style={{ fontSize:12.5, color:P.muted }}>Track applications via Pipeline or the "Track" button on job cards.</p>
                <Link href="/dashboard/jobs" style={{ display:"inline-block", marginTop:10, padding:"7px 16px", borderRadius:9, fontSize:12, fontWeight:700, background:P.accent.bg, color:P.accent.text, border:`1px solid ${P.accent.border}`, textDecoration:"none" }}>Browse Jobs →</Link>
              </div>
            ) : (
              <>
                <div>
                  {recentApps.map((a, i) => {
                    const SC: Record<string,{color:string;bg:string;Icon:typeof Send}> = {
                      applied:   {color:"#1d6fc4",bg:"#eff6ff",Icon:Send},
                      screening: {color:"#d97706",bg:"#fffbeb",Icon:Phone},
                      interview: {color:"#1d6fc4",bg:"#eff6ff",Icon:Handshake},
                      technical: {color:"#7c3aed",bg:"#f5f3ff",Icon:Laptop},
                      offer:     {color:"#0369a1",bg:"#f0f9ff",Icon:PartyPopper},
                      rejected:  {color:"#dc2626",bg:"#fef2f2",Icon:X},
                    }
                    const sc = SC[a.stage] ?? SC.applied
                    const AVT = ["#1d6fc4","#7c3aed","#1d6fc4","#d97706","#dc2626","#0ea5e9"]
                    const avatarBg = AVT[a.company.charCodeAt(0) % AVT.length]
                    const daysAgo = Math.floor((Date.now()-new Date(a.appliedDate).getTime())/86400000)
                    const timeLabel = daysAgo===0?"Today":daysAgo===1?"Yesterday":`${daysAgo}d ago`
                    return (
                      <div key={a.id} style={{
                        padding:"11px 20px", borderBottom:i<recentApps.length-1?`1px solid ${P.border}`:"none",
                        display:"flex", gap:10, alignItems:"center", transition:"background .15s", cursor:"pointer",
                      }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb"}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=""}}
                        onClick={()=>{try{sessionStorage.setItem("jd_view","pipeline")}catch{};window.location.href="/dashboard/jobs"}}
                      >
                        <div style={{ width:32,height:32,borderRadius:8,background:avatarBg,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13 }}>{a.company[0]}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontWeight:700,fontSize:12.5,color:P.text,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis" }}>{a.role}</p>
                          <p style={{ fontSize:11.5,color:P.muted }}>{a.company}</p>
                        </div>
                        <div style={{ display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:3,flexShrink:0 }}>
                          <span style={{ fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:sc.bg,color:sc.color,display:"inline-flex",alignItems:"center",gap:4 }}><sc.Icon size={10}/> {a.stage.charAt(0).toUpperCase()+a.stage.slice(1)}</span>
                          <span style={{ fontSize:10.5,color:P.hint }}>{timeLabel}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:"11px 20px" }}>
                  <Link href="/dashboard/jobs" onClick={()=>{try{sessionStorage.setItem("jd_view","pipeline")}catch{}}} style={{
                    display:"block",textAlign:"center",padding:"8px",
                    background:P.accent.bg,color:P.accent.text,borderRadius:9,fontSize:12.5,fontWeight:700,
                    textDecoration:"none",border:`1px solid ${P.accent.border}`,
                  }}>View full pipeline →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── POWER CARD + GMAIL BANNER (full width below grid) ───────────── */}
      <PowerCard />
      <GmailBanner />

      {/* ── QUICK ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
        {[
          { Icon:Sparkles,      label:"Tailor Resume",    href:"/dashboard/resume",              color:P.accent,  desc:"AI-powered tailoring", session: null },
          { Icon:FileText,      label:"Build Resume",     href:"/dashboard/resume?tab=builder",  color:P.accent,  desc:"ATS resume builder",   session: null },
          { Icon:BarChart3,     label:"View Analytics",   href:"/dashboard/jobs",                color:P.assess,  desc:"Pipeline stats",       session: "analytics" },
          { Icon:Mail,          label:"Cover Letters",    href:"/dashboard/ai-tools",            color:P.intv,    desc:"AI-generated letters", session: "cover" },
          { Icon:ClipboardList, label:"Job Tracker",      href:"/dashboard/jobs",                color:P.rtr,     desc:"Kanban pipeline",      session: "pipeline" },
        ].map(q => (
          <Link key={q.label} href={q.href}
            onClick={() => { if (q.session) try { sessionStorage.setItem("jd_view", q.session) } catch {} }}
            style={{
              background:P.surface, border:`1px solid ${P.border}`, borderRadius:16,
              padding:"20px 22px", textDecoration:"none", display:"block",
              transition:"box-shadow .2s, transform .2s, border-color .2s",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow=`0 0 0 1px ${q.color.border}, 0 10px 28px -8px rgba(29,111,196,.18)`; el.style.transform="translateY(-3px)"; el.style.borderColor=q.color.border }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow=""; el.style.transform=""; el.style.borderColor=P.border }}
          >
            <div style={{ width:44, height:44, borderRadius:12, background:q.color.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12, color:q.color.text }}><q.Icon size={21}/></div>
            <p style={{ fontSize:14, fontWeight:700, color:P.text, marginBottom:3 }}>{q.label}</p>
            <p style={{ fontSize:12, color:P.muted }}>{q.desc}</p>
          </Link>
        ))}
      </div>

      {/* placeholder anchor — replaced content below was: hidden promo + old job board */}
      <div style={{ display:"none" }}><div style={{
          background:"linear-gradient(135deg, #0d4a8a 0%, #1558a0 30%, #1d6fc4 60%, #2483e0 85%, #3b9fe8 100%)",
          borderRadius:20, padding:"36px 36px 36px 40px",
          display:"flex", alignItems:"center", gap:32,
          position:"relative", overflow:"hidden",
          boxShadow:"0 20px 60px -12px rgba(21,88,160,.52), 0 8px 20px -8px rgba(29,111,196,.38)",
          color:"#fff",
        }}>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 60% 90% at 88% 50%, rgba(120,190,255,.20) 0%, transparent 65%)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,.05)", top:-70, left:-50, pointerEvents:"none" }}/>

          <div style={{ flex:1, position:"relative", zIndex:1 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:"rgba(255,255,255,.15)", borderRadius:20, border:"1px solid rgba(255,255,255,.22)", fontSize:11, fontWeight:700, marginBottom:14, backdropFilter:"blur(4px)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#60a5fa", display:"inline-block" }}/>
              AI Auto-fill Active
            </div>
            <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.4px", lineHeight:1.2, marginBottom:10 }}>
              Fill job applications<br/>in seconds, not minutes
            </h2>
            <p style={{ fontSize:13.5, color:"rgba(255,255,255,.78)", lineHeight:1.6, marginBottom:20, maxWidth:320 }}>
              MarketFit's Chrome Extension detects job forms and auto-fills your name, email, visa status, and resume match — instantly.
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:22 }}>
              {["Greenhouse","Lever","Workday","Workable","Rippling"].map(p => (
                <span key={p} style={{ padding:"4px 11px", borderRadius:20, background:"rgba(255,255,255,.13)", border:"1px solid rgba(255,255,255,.22)", fontSize:11.5, fontWeight:600, color:"#fff", backdropFilter:"blur(4px)" }}>{p}</span>
              ))}
            </div>
            <a href="/dashboard/settings" style={{
              display:"inline-flex", alignItems:"center", gap:8, padding:"10px 24px",
              background:"#fff", color:"#1558a0", borderRadius:10, fontSize:13.5, fontWeight:800,
              textDecoration:"none", boxShadow:"0 4px 14px rgba(0,0,0,.20)", letterSpacing:"-0.2px",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Get Extension — Free
            </a>
          </div>

          {/* Browser mockup */}
          <div style={{ flexShrink:0, position:"relative", zIndex:1 }}>
            <div style={{
              width:220, background:"#fff", borderRadius:12, overflow:"hidden",
              boxShadow:"0 20px 50px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.20)",
            }}>
              {/* Browser chrome */}
              <div style={{ background:"#f4f6f9", padding:"8px 10px", display:"flex", alignItems:"center", gap:5, borderBottom:"1px solid #e4e8ef" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:"#f87171" }}/>
                <div style={{ width:7, height:7, borderRadius:"50%", background:"#fbbf24" }}/>
                <div style={{ width:7, height:7, borderRadius:"50%", background:"#60a5fa" }}/>
                <div style={{ flex:1, background:"#fff", borderRadius:4, padding:"3px 8px", fontSize:8, color:"#9aa4bc", border:"1px solid #e4e8ef" }}>careers.greenhouse.io</div>
              </div>
              {/* Form */}
              <div style={{ padding:"12px 12px 8px" }}>
                <p style={{ fontSize:7.5, color:P.hint, marginBottom:3 }}>First Name</p>
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:4, padding:"4px 7px", fontSize:8, color:P.text, fontWeight:600, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  Alex
                  <span style={{ width:10, height:10, borderRadius:"50%", background:"#1d6fc4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"#fff", fontWeight:700 }}>✓</span>
                </div>
                <p style={{ fontSize:7.5, color:P.hint, marginBottom:3 }}>Email</p>
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:4, padding:"4px 7px", fontSize:8, color:P.text, fontWeight:600, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  alex.j@email.com
                  <span style={{ width:10, height:10, borderRadius:"50%", background:"#1d6fc4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"#fff", fontWeight:700 }}>✓</span>
                </div>
                <p style={{ fontSize:7.5, color:P.hint, marginBottom:3 }}>Work Auth</p>
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:4, padding:"4px 7px", fontSize:8, color:P.text, fontWeight:600, marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  H-1B Transfer
                  <span style={{ width:10, height:10, borderRadius:"50%", background:"#1d6fc4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"#fff", fontWeight:700 }}>✓</span>
                </div>
                {/* Match bar */}
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"6px 8px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:7.5, color:"#1d6fc4", fontWeight:700 }}>Resume match</span>
                    <span style={{ fontSize:8.5, color:"#1d6fc4", fontWeight:800 }}>92%</span>
                  </div>
                  <div style={{ height:3, background:"#dbeafe", borderRadius:2 }}>
                    <div style={{ height:3, width:"92%", background:"#1d6fc4", borderRadius:2 }}/>
                  </div>
                </div>
                {/* CTA */}
                <div style={{ background:"linear-gradient(135deg,var(--accent),var(--accent-h))", borderRadius:6, padding:"6px", textAlign:"center", fontSize:8.5, color:"#fff", fontWeight:800 }}>
                  ⚡ Auto-fill Now
                </div>
              </div>
            </div>
            {/* Pulse ring */}
            <div style={{ position:"absolute", top:-6, right:-6, width:16, height:16 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#60a5fa" }}/>
              <div style={{ position:"absolute", inset:-3, borderRadius:"50%", background:"rgba(52,211,153,.35)", animation:"pulse 2s ease-in-out infinite" }}/>
            </div>
          </div>
        </div></div>{/* end hidden old promo */}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity:.5; transform:scale(1); }
          50% { opacity:0; transform:scale(1.8); }
        }
      `}</style>
    </div>
  )
}
