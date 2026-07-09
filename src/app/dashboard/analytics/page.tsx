"use client"

// Standalone Analytics — real metrics computed from your job-search activity.
// Was previously a redirect into the Jobs hub's Analytics tab; now a full page.
// Everything is derived live from the SAME `jd_applications_v2` data (via
// src/lib/applications) plus saved-jobs count, so it always reflects your real
// pipeline. No chart library — pure CSS bars/rings.

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { APP_STAGES, type AppItem, type AppStage, loadApplications } from "@/lib/applications"

export default function AnalyticsPage() {
  const [apps, setApps] = useState<AppItem[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setApps(loadApplications())
    try {
      const s = JSON.parse(localStorage.getItem("jd_saved_ids") || "[]")
      setSavedCount(Array.isArray(s) ? s.length : 0)
    } catch {}
    setMounted(true)
  }, [])

  const m = useMemo(() => {
    const total = apps.length
    const counts = Object.fromEntries(APP_STAGES.map(s => [s.id, apps.filter(a => a.stage === s.id).length])) as Record<AppStage, number>
    // "Responded" = anything past the initial "applied" stage (incl. rejected — a rejection is still a response)
    const responded = apps.filter(a => a.stage !== "applied").length
    const interviewed = apps.filter(a => ["interview", "technical", "offer"].includes(a.stage)).length
    const offers = counts.offer ?? 0
    const rejected = counts.rejected ?? 0
    const active = apps.filter(a => a.stage !== "rejected").length
    const pct = (n: number) => total ? Math.round((n / total) * 100) : 0
    return { total, counts, responded, interviewed, offers, rejected, active,
      responseRate: pct(responded), interviewRate: pct(interviewed), offerRate: pct(offers) }
  }, [apps])

  // Applications over the last 8 weeks
  const weekly = useMemo(() => {
    const now = Date.now(), wk = 7 * 86400000
    const buckets = Array.from({ length: 8 }, (_, i) => ({ label: i === 0 ? "This wk" : `${i}w`, count: 0 }))
    for (const a of apps) {
      const t = new Date(a.appliedDate).getTime()
      if (Number.isNaN(t)) continue
      const idx = Math.floor((now - t) / wk)
      if (idx >= 0 && idx < 8) buckets[idx].count++
    }
    return buckets.reverse() // oldest → newest for L-to-R reading
  }, [apps])

  const topCompanies = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of apps) map.set(a.company, (map.get(a.company) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [apps])

  // Funnel: applied → responded → interviewed → offer
  const funnel = [
    { label: "Applied",     n: m.total,       color: "#1d6fc4" },
    { label: "Responded",   n: m.responded,   color: "#d97706" },
    { label: "Interviewed", n: m.interviewed, color: "#7c3aed" },
    { label: "Offer",       n: m.offers,      color: "#059669" },
  ]
  const funnelMax = Math.max(1, m.total)

  return (
    <div className="max-w-5xl mx-auto">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>📊</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Analytics</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>How your job search is performing — live from your pipeline.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/dashboard/pipeline" style={ghostBtn}>▦ Pipeline</Link>
          <Link href="/dashboard/applications" style={ghostBtn}>≡ Applications</Link>
        </div>
      </div>

      {!mounted ? null : m.total === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>No data yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>Track a few applications and your funnel, response rate, and trends appear here.</p>
          <Link href="/dashboard/jobs" style={accentBtn}>Browse jobs →</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Kpi label="Total applied" value={m.total} sub={`${m.active} active`} />
            <Kpi label="Response rate" value={`${m.responseRate}%`} sub={`${m.responded} responded`} accent="#d97706" />
            <Kpi label="Interview rate" value={`${m.interviewRate}%`} sub={`${m.interviewed} interviews`} accent="#7c3aed" />
            <Kpi label="Offer rate" value={`${m.offerRate}%`} sub={`${m.offers} offer${m.offers !== 1 ? "s" : ""}`} accent="#059669" />
            <Kpi label="Saved jobs" value={savedCount} sub="not yet applied" accent="#0ea5e9" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* Funnel */}
            <Panel title="Conversion funnel">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {funnel.map((f, i) => {
                  const prev = i === 0 ? f.n : funnel[i - 1].n
                  const conv = prev ? Math.round((f.n / prev) * 100) : 0
                  return (
                    <div key={f.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{f.label}</span>
                        <span style={{ color: "var(--text-soft)" }}>{f.n}{i > 0 && <span style={{ marginLeft: 6, color: f.color, fontWeight: 700 }}>{conv}%</span>}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(2, (f.n / funnelMax) * 100)}%`, background: f.color, borderRadius: 6, transition: "width .5s" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            {/* Stage distribution */}
            <Panel title="By stage">
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {APP_STAGES.map(s => {
                  const n = m.counts[s.id] ?? 0
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 92, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{s.icon} {s.label}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${m.total ? (n / m.total) * 100 : 0}%`, background: s.color, borderRadius: 6, transition: "width .5s" }} />
                      </div>
                      <span style={{ width: 24, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{n}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>

          {/* Weekly trend */}
          <Panel title="Applications — last 8 weeks">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingTop: 8 }}>
              {weekly.map((w, i) => {
                const max = Math.max(1, ...weekly.map(x => x.count))
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{w.count || ""}</span>
                    <div style={{ width: "100%", maxWidth: 40, height: `${(w.count / max) * 100}%`, minHeight: w.count ? 4 : 0, background: "var(--accent)", borderRadius: "6px 6px 0 0", transition: "height .5s" }} />
                    <span style={{ fontSize: 10.5, color: "var(--text-soft)" }}>{w.label}</span>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Top companies */}
          {topCompanies.length > 0 && (
            <Panel title="Most-applied companies">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topCompanies.map(([name, n]) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(n / topCompanies[0][1]) * 100}%`, background: "var(--accent)", borderRadius: 5 }} />
                    </div>
                    <span style={{ width: 22, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{n}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, accent = "var(--accent)" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--text-soft)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", margin: "0 0 14px" }}>{title}</h2>
      {children}
    </div>
  )
}

const accentBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, textDecoration: "none" }
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }
