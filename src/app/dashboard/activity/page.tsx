"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const P = {
  surface: "#ffffff",
  text:    "#1a2035",
  muted:   "#6b7a99",
  hint:    "#9aa4bc",
  border:  "#e4e8ef",
  bg:      "#f4f6f9",
}

interface ActivityEvent {
  id: string
  type: "applied" | "tailored" | "email" | "interview" | "offer" | "saved" | "viewed" | "alert" | "ai"
  title: string
  detail: string
  time: string // ISO
  href?: string
  icon: string
  color: string
  bg: string
  border: string
}

const TYPE_META: Record<ActivityEvent["type"], { icon: string; color: string; bg: string; border: string }> = {
  applied:   { icon: "📨", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  tailored:  { icon: "✦",  color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  email:     { icon: "📧", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  interview: { icon: "📞", color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
  offer:     { icon: "🏆", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  saved:     { icon: "🔖", color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  viewed:    { icon: "👁",  color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  alert:     { icon: "🔔", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  ai:        { icon: "✨", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
}

function buildEventsFromStorage(): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const now = Date.now()

  // Applications
  try {
    const apps: Array<{ id: string; company: string; role: string; stage: string; appliedDate: string }> =
      JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
    apps.slice(0, 10).forEach(a => {
      const m = TYPE_META["applied"]
      events.push({
        id: `app-${a.id}`,
        type: "applied",
        title: `Applied to ${a.role}`,
        detail: `${a.company} — Stage: ${a.stage}`,
        time: new Date(a.appliedDate).toISOString(),
        href: "/dashboard/jobs",
        ...m,
      })
    })
  } catch {}

  // Saved jobs
  try {
    const saved: Array<{ id: string; title: string; company: string; savedAt: string }> =
      JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]")
    saved.slice(0, 6).forEach(s => {
      const m = TYPE_META["saved"]
      events.push({
        id: `saved-${s.id}`,
        type: "saved",
        title: `Saved ${s.title}`,
        detail: s.company,
        time: s.savedAt || new Date(now - 2 * 3600000).toISOString(),
        href: "/dashboard/saved",
        ...m,
      })
    })
  } catch {}

  // Tailing sessions from sessionStorage
  try {
    const last = sessionStorage.getItem("careerkit_last_result")
    if (last) {
      const r = JSON.parse(last)
      const m = TYPE_META["tailored"]
      events.push({
        id: "tailor-last",
        type: "tailored",
        title: "Resume tailored",
        detail: r.filename ? `${r.filename} — AI-optimized` : "AI resume tailoring session",
        time: new Date(now - 45 * 60000).toISOString(),
        href: "/dashboard/resume",
        ...m,
      })
    }
  } catch {}

  // Sort by time descending
  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return events
}

// Seed events to show when no real data exists
const SEED_EVENTS: ActivityEvent[] = [
  { id: "seed1", type: "applied",   title: "Applied to Senior Cloud Security Engineer", detail: "Palo Alto Networks — Stage: Applied",    time: new Date(Date.now() - 2 * 3600000).toISOString(),   href: "/dashboard/jobs",   ...TYPE_META["applied"]   },
  { id: "seed2", type: "tailored",  title: "Resume tailored for Stripe AppSec role",    detail: "94% keyword match — ATS score: A",        time: new Date(Date.now() - 5 * 3600000).toISOString(),   href: "/dashboard/resume", ...TYPE_META["tailored"]  },
  { id: "seed3", type: "email",     title: "Recruiter email detected",                  detail: "Sarah Chen @ Palo Alto Networks — replied",  time: new Date(Date.now() - 8 * 3600000).toISOString(),   href: "/dashboard/email",  ...TYPE_META["email"]    },
  { id: "seed4", type: "saved",     title: "Saved Staff Security Engineer",             detail: "Stripe · $200k–$270k",                    time: new Date(Date.now() - 1 * 86400000).toISOString(),  href: "/dashboard/saved",  ...TYPE_META["saved"]    },
  { id: "seed5", type: "interview", title: "Interview scheduled",                       detail: "CrowdStrike — Video · Thursday 2pm",       time: new Date(Date.now() - 2 * 86400000).toISOString(),  href: "/dashboard/jobs",   ...TYPE_META["interview"] },
  { id: "seed6", type: "ai",        title: "AI cover letter generated",                 detail: "For DevSecOps Engineer @ CrowdStrike",    time: new Date(Date.now() - 2 * 86400000).toISOString(),  href: "/dashboard/ai-tools",...TYPE_META["ai"]        },
  { id: "seed7", type: "applied",   title: "Applied to ServiceNow Developer",           detail: "Deloitte — Stage: Applied",               time: new Date(Date.now() - 3 * 86400000).toISOString(),  href: "/dashboard/jobs",   ...TYPE_META["applied"]   },
  { id: "seed8", type: "alert",     title: "Job alert triggered",                       detail: "12 new H-1B matching jobs found",          time: new Date(Date.now() - 4 * 86400000).toISOString(),  href: "/dashboard/alerts", ...TYPE_META["alert"]     },
  { id: "seed9", type: "tailored",  title: "Resume tailored for Databricks role",       detail: "Staff Data Engineer — 89% keyword match", time: new Date(Date.now() - 5 * 86400000).toISOString(),  href: "/dashboard/resume", ...TYPE_META["tailored"]  },
  { id: "seed10",type: "email",     title: "Follow-up reminder sent",                   detail: "To Alex Torres @ CrowdStrike",            time: new Date(Date.now() - 6 * 86400000).toISOString(),  href: "/dashboard/email",  ...TYPE_META["email"]    },
  { id: "seed11",type: "offer",     title: "Offer received",                            detail: "Cigna · $158k base + equity",             time: new Date(Date.now() - 7 * 86400000).toISOString(),  href: "/dashboard/offers", ...TYPE_META["offer"]     },
  { id: "seed12",type: "saved",     title: "Saved GRC Security Analyst",               detail: "Morgan Stanley · $120k–$160k",            time: new Date(Date.now() - 8 * 86400000).toISOString(),  href: "/dashboard/saved",  ...TYPE_META["saved"]    },
]

function timeLabel(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 2) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch { return "Recently" }
}

function groupByDate(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups: Record<string, ActivityEvent[]> = {}
  events.forEach(e => {
    const d = new Date(e.time)
    const today = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const label =
      d >= today ? "Today" :
      d >= yesterday ? "Yesterday" :
      d >= new Date(today.getTime() - 6 * 86400000) ? "This Week" :
      new Date(e.time).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    if (!groups[label]) groups[label] = []
    groups[label].push(e)
  })
  const ORDER = ["Today", "Yesterday", "This Week"]
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return 0
  }).map(([label, evts]) => ({ label, events: evts }))
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>(SEED_EVENTS)
  const [filter, setFilter] = useState<ActivityEvent["type"] | "all">("all")
  const [hasRealData, setHasRealData] = useState(false)

  useEffect(() => {
    const real = buildEventsFromStorage()
    if (real.length > 0) {
      setEvents([...real, ...SEED_EVENTS.slice(real.length)])
      setHasRealData(true)
    }
  }, [])

  const filtered = events.filter(e => filter === "all" || e.type === filter)
  const groups = groupByDate(filtered)

  const counts: Partial<Record<ActivityEvent["type"], number>> = {}
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1 })

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: "-0.4px", marginBottom: 4 }}>⚡ Activity Feed</h1>
          <p style={{ fontSize: 13.5, color: P.muted }}>
            Your full job search timeline — applications, emails, AI actions, and milestones.
            {!hasRealData && <span style={{ color: "#d97706" }}> · Showing example data</span>}
          </p>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Applications", count: counts["applied"] || 0, icon: "📨", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
          { label: "Tailored",     count: counts["tailored"] || 0,icon: "✦",  color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Emails",       count: counts["email"] || 0,   icon: "📧", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
          { label: "Interviews",   count: counts["interview"] || 0,icon: "📞",color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
        ].map(s => (
          <div key={s.label} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: P.text, letterSpacing: "-1px" }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {([
          { k: "all",       l: "All" },
          { k: "applied",   l: "📨 Applied" },
          { k: "tailored",  l: "✦ Tailored" },
          { k: "email",     l: "📧 Emails" },
          { k: "interview", l: "📞 Interviews" },
          { k: "saved",     l: "🔖 Saved" },
          { k: "ai",        l: "✨ AI" },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${filter === f.k ? "var(--accent)" : P.border}`,
            background: filter === f.k ? "var(--accent)" : P.surface,
            color: filter === f.k ? "#fff" : P.muted,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{f.l}</button>
        ))}
      </div>

      {/* ── Timeline ── */}
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.hint, textTransform: "uppercase", letterSpacing: ".06em" }}>{group.label}</span>
            <div style={{ flex: 1, height: 1, background: P.border }}/>
            <span style={{ fontSize: 11, color: P.hint }}>{group.events.length} events</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.events.map(ev => (
              <div key={ev.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* Timeline dot + line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.color, flexShrink: 0 }}/>
                </div>

                {/* Card */}
                <div style={{ flex: 1, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: ev.bg, border: `1px solid ${ev.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {ev.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: P.text, marginBottom: 2 }}>{ev.title}</p>
                    <p style={{ fontSize: 12, color: P.muted }}>{ev.detail}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11.5, color: P.hint }}>{timeLabel(ev.time)}</span>
                    {ev.href && (
                      <Link href={ev.href} style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>View →</Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 8 }}>No activity yet</p>
          <p style={{ fontSize: 13.5, color: P.muted, marginBottom: 20 }}>Start applying to jobs and your activity will appear here.</p>
          <Link href="/dashboard/jobs" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Browse Jobs →</Link>
        </div>
      )}
    </div>
  )
}
