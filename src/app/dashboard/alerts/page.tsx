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

interface Alert {
  id: string
  name: string
  keywords: string
  visaTypes: string[]
  location: string
  remote: boolean
  salaryMin: number
  frequency: "realtime" | "daily" | "weekly"
  active: boolean
  createdAt: string
  lastTriggered?: string
  matchCount: number
}

const VISA_OPTIONS = [
  { key: "h1b",      label: "H-1B" },
  { key: "opt_cpt",  label: "OPT/CPT" },
  { key: "green_card",label: "Green Card" },
  { key: "w2",       label: "W2" },
  { key: "c2c",      label: "C2C" },
]

const FREQ_META = {
  realtime: { label: "Real-time",  desc: "As jobs post", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  daily:    { label: "Daily",      desc: "9 AM digest",  color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  weekly:   { label: "Weekly",     desc: "Monday digest",color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
}

const DEFAULT_ALERTS: Alert[] = [
  {
    id: "a1", name: "Security Engineer (Remote)", keywords: "security engineer, AppSec, cloud security",
    visaTypes: ["h1b", "green_card"], location: "Remote", remote: true, salaryMin: 140000,
    frequency: "daily", active: true,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    lastTriggered: new Date(Date.now() - 8 * 3600000).toISOString(),
    matchCount: 12,
  },
  {
    id: "a2", name: "ServiceNow Developer", keywords: "ServiceNow, ITSM, FlowDesigner",
    visaTypes: ["h1b", "c2c"], location: "Remote", remote: true, salaryMin: 120000,
    frequency: "daily", active: true,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    lastTriggered: new Date(Date.now() - 24 * 3600000).toISOString(),
    matchCount: 5,
  },
  {
    id: "a3", name: "OT/ICS Security", keywords: "OT security, ICS, SCADA, NERC CIP",
    visaTypes: ["h1b", "w2"], location: "United States", remote: false, salaryMin: 130000,
    frequency: "weekly", active: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    matchCount: 3,
  },
]

function timeAgo(iso?: string) {
  if (!iso) return "Never"
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(DEFAULT_ALERTS)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({
    visaTypes: ["h1b"], frequency: "daily", active: true, remote: true, salaryMin: 120000,
  })

  useEffect(() => {
    try {
      const stored: Alert[] = JSON.parse(localStorage.getItem("jd_alerts") || "[]")
      if (stored.length) setAlerts(stored)
    } catch {}
  }, [])

  function persist(next: Alert[]) {
    setAlerts(next)
    localStorage.setItem("jd_alerts", JSON.stringify(next))
  }

  function toggle(id: string) {
    persist(alerts.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  function deleteAlert(id: string) {
    persist(alerts.filter(a => a.id !== id))
  }

  function createAlert() {
    const a: Alert = {
      id: `alert-${Date.now()}`,
      name: newAlert.name || newAlert.keywords?.split(",")[0]?.trim() || "New Alert",
      keywords: newAlert.keywords || "",
      visaTypes: newAlert.visaTypes || ["h1b"],
      location: newAlert.location || "Remote",
      remote: newAlert.remote ?? true,
      salaryMin: Number(newAlert.salaryMin) || 0,
      frequency: newAlert.frequency as Alert["frequency"] || "daily",
      active: true,
      createdAt: new Date().toISOString(),
      matchCount: 0,
    }
    persist([a, ...alerts])
    setShowNewForm(false)
    setNewAlert({ visaTypes: ["h1b"], frequency: "daily", active: true, remote: true, salaryMin: 120000 })
  }

  function toggleVisa(key: string) {
    setNewAlert(prev => {
      const list = prev.visaTypes || []
      return { ...prev, visaTypes: list.includes(key) ? list.filter(k => k !== key) : [...list, key] }
    })
  }

  const active = alerts.filter(a => a.active)
  const inactive = alerts.filter(a => !a.active)

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: "-0.4px", marginBottom: 4 }}>🔔 Job Alerts</h1>
          <p style={{ fontSize: 13.5, color: P.muted }}>
            {active.length} active alert{active.length !== 1 ? "s" : ""} — get notified when matching jobs post.
          </p>
        </div>
        <button onClick={() => setShowNewForm(!showNewForm)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          + Create Alert
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active Alerts",   value: active.length,                               icon: "🔔", color: "#1558a0", bg: "#eff6ff" },
          { label: "Jobs Found Today", value: active.reduce((n, a) => n + (a.matchCount || 0), 0), icon: "✦",  color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Last Triggered",   value: timeAgo(active.sort((a,b) => new Date(b.lastTriggered||0).getTime() - new Date(a.lastTriggered||0).getTime())[0]?.lastTriggered), icon: "⏱", color: "#059669", bg: "#ecfdf5" },
        ].map(s => (
          <div key={s.label} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 18px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>{String(s.value)}</p>
              <p style={{ fontSize: 11.5, color: P.hint }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── New Alert Form ── */}
      {showNewForm && (
        <div style={{ background: P.surface, border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "22px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 18 }}>Create New Alert</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Alert Name</label>
              <input value={newAlert.name || ""} onChange={e => setNewAlert(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Security Engineer Remote" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Keywords (comma-separated)</label>
              <input value={newAlert.keywords || ""} onChange={e => setNewAlert(p => ({ ...p, keywords: e.target.value }))}
                placeholder="security engineer, AppSec, cloud security" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Visa Type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {VISA_OPTIONS.map(v => {
                  const sel = (newAlert.visaTypes || []).includes(v.key)
                  return (
                    <button key={v.key} onClick={() => toggleVisa(v.key)} style={{ padding: "4px 12px", borderRadius: 20, border: `1.5px solid ${sel ? "var(--accent)" : P.border}`, background: sel ? "#eff6ff" : "transparent", color: sel ? "var(--accent)" : P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {v.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Frequency</label>
              <select value={newAlert.frequency || "daily"} onChange={e => setNewAlert(p => ({ ...p, frequency: e.target.value as Alert["frequency"] }))} style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", cursor: "pointer" }}>
                <option value="realtime">Real-time</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Min Salary ($)</label>
              <input type="number" value={newAlert.salaryMin || ""} onChange={e => setNewAlert(p => ({ ...p, salaryMin: Number(e.target.value) }))}
                placeholder="120000" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 5 }}>Location</label>
              <input value={newAlert.location || ""} onChange={e => setNewAlert(p => ({ ...p, location: e.target.value }))}
                placeholder="Remote, New York, United States" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={createAlert} style={{ padding: "8px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Create Alert</button>
            <button onClick={() => setShowNewForm(false)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Active Alerts ── */}
      {active.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: P.hint, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Active ({active.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {active.map(a => {
              const f = FREQ_META[a.frequency]
              return (
                <div key={a.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 14.5, fontWeight: 700, color: P.text }}>{a.name}</p>
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: f.bg, color: f.color, border: `1px solid ${f.border}` }}>{f.label}</span>
                      {a.matchCount > 0 && (
                        <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                          {a.matchCount} matches
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: P.muted, flexWrap: "wrap" }}>
                      <span>🔑 {a.keywords}</span>
                      {a.visaTypes.length > 0 && <span>🛂 {a.visaTypes.join(", ")}</span>}
                      {a.salaryMin > 0 && <span>💰 ${(a.salaryMin / 1000).toFixed(0)}k+</span>}
                      {a.lastTriggered && <span>⏱ Last: {timeAgo(a.lastTriggered)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {a.matchCount > 0 && (
                      <Link href="/dashboard/jobs" style={{ padding: "6px 13px", borderRadius: 8, background: "#eff6ff", color: "#1558a0", fontSize: 12, fontWeight: 700, textDecoration: "none", border: "1px solid #bfdbfe" }}>
                        View Jobs →
                      </Link>
                    )}
                    <button onClick={() => toggle(a.id)} style={{ padding: "6px 13px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, border: "1px solid #fecaca", cursor: "pointer" }}>Pause</button>
                    <button onClick={() => deleteAlert(a.id)} style={{ padding: "5px 8px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, fontSize: 12, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#dc2626" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.hint }}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Paused alerts ── */}
      {inactive.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: P.hint, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Paused ({inactive.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {inactive.map(a => (
              <div key={a.id} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.7 }}>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: P.muted }}>{a.name}</p>
                  <p style={{ fontSize: 12, color: P.hint }}>{a.keywords}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => toggle(a.id)} style={{ padding: "6px 13px", borderRadius: 8, background: P.surface, color: "var(--accent)", fontSize: 12, fontWeight: 700, border: "1px solid var(--accent)", cursor: "pointer" }}>Resume</button>
                  <button onClick={() => deleteAlert(a.id)} style={{ padding: "5px 8px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {alerts.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔔</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 8 }}>No alerts yet</p>
          <p style={{ fontSize: 13.5, color: P.muted, marginBottom: 20 }}>Create an alert to get notified when matching jobs post.</p>
          <button onClick={() => setShowNewForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>+ Create First Alert</button>
        </div>
      )}

      {/* ── Pro upgrade tip ── */}
      <div style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", border: "1px solid #bfdbfe", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 3 }}>🔔 Real-time alerts available on Pro</p>
          <p style={{ fontSize: 12.5, color: P.muted }}>Free plan gets daily digests. Upgrade to Pro for instant push notifications and Slack/email delivery.</p>
        </div>
        <Link href="/dashboard/settings#plan" style={{ padding: "8px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>Upgrade to Pro →</Link>
      </div>
    </div>
  )
}
