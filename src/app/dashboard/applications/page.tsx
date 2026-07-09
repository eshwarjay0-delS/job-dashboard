"use client"

// Standalone Applications — a dense, sortable, filterable TABLE of every job
// you've applied to. Was previously a redirect into the Jobs hub's Pipeline
// tab; now a real page. Complements /dashboard/pipeline (kanban) — same
// `jd_applications_v2` data via src/lib/applications, different lens: this is
// the spreadsheet view for scanning/sorting many applications at once.

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  APP_STAGES, APP_PRIORITY, type AppItem, type AppStage,
  loadApplications, saveApplications, daysSince, isOverdue, isDueSoon,
  extractSalaryNum, exportApplicationsCSV,
} from "@/lib/applications"

type SortKey = "company" | "stage" | "salary" | "applied" | "followup"

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [q, setQ] = useState("")
  const [stageFilter, setStageFilter] = useState<"all" | AppStage>("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "applied", dir: -1 })

  useEffect(() => { setApps(loadApplications()); setMounted(true) }, [])
  useEffect(() => { if (mounted) saveApplications(apps) }, [apps, mounted])

  function setStage(id: string, stage: AppStage) { setApps(p => p.map(a => a.id === id ? { ...a, stage } : a)) }
  function remove(id: string) { setApps(p => p.filter(a => a.id !== id)) }

  const stageIndex = useMemo(() => Object.fromEntries(APP_STAGES.map((s, i) => [s.id, i])), [])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = apps.filter(a => {
      if (stageFilter !== "all" && a.stage !== stageFilter) return false
      if (needle && !(`${a.company} ${a.role} ${a.location} ${a.notes} ${a.visa}`.toLowerCase().includes(needle))) return false
      return true
    })
    const cmp: Record<SortKey, (a: AppItem, b: AppItem) => number> = {
      company:  (a, b) => a.company.localeCompare(b.company),
      stage:    (a, b) => (stageIndex[a.stage] ?? 0) - (stageIndex[b.stage] ?? 0),
      salary:   (a, b) => extractSalaryNum(a.salary) - extractSalaryNum(b.salary),
      applied:  (a, b) => new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime(),
      followup: (a, b) => new Date(a.followUpDate || "9999").getTime() - new Date(b.followUpDate || "9999").getTime(),
    }
    return [...list].sort((a, b) => cmp[sort.key](a, b) * sort.dir)
  }, [apps, q, stageFilter, sort, stageIndex])

  const counts = useMemo(() => Object.fromEntries(
    APP_STAGES.map(s => [s.id, apps.filter(a => a.stage === s.id).length])
  ) as Record<AppStage, number>, [apps])
  const active = apps.filter(a => a.stage !== "rejected").length

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "company" ? 1 : -1 })
  }
  const arrow = (key: SortKey) => sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--text-soft)", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "var(--text)", verticalAlign: "middle" }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>🗂️</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Applications</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {active} active · {apps.length} total · {counts.offer ?? 0} offer{counts.offer !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard/pipeline" style={ghostBtn}>▦ Kanban view</Link>
          <button onClick={() => exportApplicationsCSV(apps)} style={ghostBtn} disabled={!apps.length}>⬇ CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, role, notes…"
          style={{ flex: 1, minWidth: 200, padding: "9px 13px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none" }} />
        <button onClick={() => setStageFilter("all")} style={chip(stageFilter === "all")}>All ({apps.length})</button>
        {APP_STAGES.map(s => counts[s.id] > 0 && (
          <button key={s.id} onClick={() => setStageFilter(s.id)} style={chip(stageFilter === s.id, s.color)}>{s.icon} {s.label} ({counts[s.id]})</button>
        ))}
      </div>

      {!mounted ? null : apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>No applications yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>Apply from the job boards and they show up here — or add them in the Pipeline.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard/jobs" style={accentBtn}>Browse jobs →</Link>
            <Link href="/dashboard/pipeline" style={ghostBtn}>Open Pipeline</Link>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  <th style={th} onClick={() => toggleSort("company")}>Company / Role{arrow("company")}</th>
                  <th style={th} onClick={() => toggleSort("stage")}>Stage{arrow("stage")}</th>
                  <th style={th} onClick={() => toggleSort("salary")}>Salary{arrow("salary")}</th>
                  <th style={th} onClick={() => toggleSort("followup")}>Follow-up{arrow("followup")}</th>
                  <th style={th} onClick={() => toggleSort("applied")}>Applied{arrow("applied")}</th>
                  <th style={{ ...th, cursor: "default" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => {
                  const stage = APP_STAGES.find(s => s.id === a.stage)!
                  const pri = APP_PRIORITY[a.priority]
                  const overdue = isOverdue(a.followUpDate), soon = isDueSoon(a.followUpDate)
                  return (
                    <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span title={`${pri.label} priority`} style={{ width: 7, height: 7, borderRadius: "50%", background: pri.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                              {a.url && a.url !== "#" ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", textDecoration: "none" }}>{a.role || "—"}</a> : (a.role || "—")}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.company}{a.location ? ` · ${a.remote ? "🌐 " : ""}${a.location}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <select value={a.stage} onChange={e => setStage(a.id, e.target.value as AppStage)}
                          style={{ fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 20, border: `1px solid ${stage.color}44`, background: `rgba(${stage.rgb},.1)`, color: stage.color, outline: "none", cursor: "pointer" }}>
                          {APP_STAGES.map(s => <option key={s.id} value={s.id} style={{ color: "var(--text)" }}>{s.icon} {s.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, color: "var(--accent)", fontWeight: 700, fontSize: 12.5 }}>{a.salary || "—"}</td>
                      <td style={td}>
                        {a.followUpDate ? (
                          <span style={{ fontSize: 12, fontWeight: overdue ? 700 : 500, color: overdue ? "#dc2626" : soon ? "#d97706" : "var(--text-soft)" }}>
                            {overdue ? "⚠ " : soon ? "⏰ " : ""}{new Date(a.followUpDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : <span style={{ color: "var(--text-soft)" }}>—</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: "var(--text-soft)", whiteSpace: "nowrap" }}>{daysSince(a.appliedDate)}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => { if (confirm("Delete this application?")) remove(a.id) }} title="Delete"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13, fontWeight: 700 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--text-soft)", padding: "40px 0" }}>No applications match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function chip(active: boolean, color = "var(--accent)"): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    background: active ? color : "var(--surface)",
    color: active ? "#fff" : "var(--text-muted)",
    border: `1px solid ${active ? color : "var(--border)"}`,
  }
}
const accentBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, textDecoration: "none" }
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }
