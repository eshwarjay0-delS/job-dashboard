"use client"

// Standalone Pipeline — a real kanban board over your job applications.
// Was previously a redirect into the Jobs hub's Pipeline tab; now a full page
// at its own URL. Reads/writes the SAME `jd_applications_v2` key (via
// src/lib/applications, which uses the schema-aligned stage/appliedDate shape —
// resolving the old "schema diverged" orphan note), so it stays in sync with
// the hub tab and the Applications table view.

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  APP_STAGES, APP_PRIORITY, type AppItem, type AppStage,
  loadApplications, saveApplications, appUid, daysSince,
  isOverdue, isDueSoon, exportApplicationsCSV,
} from "@/lib/applications"

const EMPTY: Omit<AppItem, "id"> = {
  company: "", role: "", location: "", remote: false, salary: "",
  stage: "applied", appliedDate: "", followUpDate: "", notes: "", url: "", visa: "", priority: "mid",
}

export default function PipelinePage() {
  const [apps, setApps] = useState<AppItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState<AppItem | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => { setApps(loadApplications()); setMounted(true) }, [])
  useEffect(() => { if (mounted) saveApplications(apps) }, [apps, mounted])

  function move(id: string, to: AppStage) { setApps(p => p.map(a => a.id === id ? { ...a, stage: to } : a)) }
  function remove(id: string) { setApps(p => p.filter(a => a.id !== id)) }
  function upsert(item: AppItem) {
    setApps(p => p.some(a => a.id === item.id) ? p.map(a => a.id === item.id ? item : a) : [item, ...p])
  }

  const counts = useMemo(() => Object.fromEntries(
    APP_STAGES.map(s => [s.id, apps.filter(a => a.stage === s.id).length])
  ) as Record<AppStage, number>, [apps])
  const active = apps.filter(a => a.stage !== "rejected").length

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), var(--accent-h))",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
          }}>📋</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Pipeline</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {active} active · {apps.length} total · {counts.offer ?? 0} offer{counts.offer !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard/applications" style={ghostBtn}>≡ Table view</Link>
          <button onClick={() => exportApplicationsCSV(apps)} style={ghostBtn} disabled={!apps.length}>⬇ CSV</button>
          <button onClick={() => setAdding(true)} style={accentBtn}>+ Add Application</button>
        </div>
      </div>

      {/* Stage stat chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {APP_STAGES.map(s => (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 10, fontSize: 13,
            background: counts[s.id] ? `rgba(${s.rgb},.08)` : "var(--surface)",
            border: `1px solid ${counts[s.id] ? `rgba(${s.rgb},.28)` : "var(--border)"}`,
          }}>
            <span>{s.icon}</span>
            <span style={{ fontWeight: 800, color: s.color }}>{counts[s.id] ?? 0}</span>
            <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {!mounted ? null : apps.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
          {APP_STAGES.map(stage => {
            const col = apps.filter(a => a.stage === stage.id)
            return (
              <div key={stage.id} style={{ flex: "0 0 auto", width: "clamp(220px, 24vw, 280px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: stage.color }} />
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-muted)" }}>{stage.label}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                    background: col.length ? `rgba(${stage.rgb},.12)` : "var(--surface-2)",
                    color: col.length ? stage.color : "var(--text-soft)",
                  }}>{col.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.map(a => (
                    <Card key={a.id} app={a} onMove={move} onEdit={() => setEditing(a)} onDelete={remove} />
                  ))}
                  {col.length === 0 && (
                    <div style={{ borderRadius: 12, border: "2px dashed var(--border)", padding: "18px 10px", textAlign: "center", fontSize: 12, color: "var(--text-soft)" }}>
                      {stage.id === "rejected" ? "No rejections" : "Nothing here yet"}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && (
        <AppForm
          initial={editing ?? { ...EMPTY, id: appUid(), appliedDate: new Date().toISOString() }}
          isNew={!editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSave={(item) => { upsert(item); setAdding(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ app, onMove, onEdit, onDelete }: {
  app: AppItem; onMove: (id: string, to: AppStage) => void; onEdit: () => void; onDelete: (id: string) => void
}) {
  const stage = APP_STAGES.find(s => s.id === app.stage)!
  const pri = APP_PRIORITY[app.priority]
  const overdue = isOverdue(app.followUpDate)
  const dueSoon = isDueSoon(app.followUpDate)
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${stage.color}`,
      borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{app.role || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{app.company}</div>
        </div>
        <span title={`${pri.label} priority`} style={{ width: 8, height: 8, borderRadius: "50%", background: pri.color, flexShrink: 0, marginTop: 5 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: 11.5, color: "var(--text-soft)" }}>
        {app.location && <span>{app.remote ? "🌐" : "📍"} {app.location}</span>}
        {app.salary && <span style={{ color: "var(--accent)", fontWeight: 700 }}>{app.salary}</span>}
        <span style={{ marginLeft: "auto" }}>{daysSince(app.appliedDate)}</span>
      </div>
      {app.followUpDate && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, alignSelf: "flex-start",
          background: overdue ? "#fef2f2" : dueSoon ? "#fffbeb" : "#f0f9ff",
          color: overdue ? "#dc2626" : dueSoon ? "#d97706" : "#0369a1",
          border: `1px solid ${overdue ? "#fecaca" : dueSoon ? "#fde68a" : "#bae6fd"}`,
        }}>🔔 {overdue ? "Overdue " : dueSoon ? "Soon " : ""}{new Date(app.followUpDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      )}
      {app.notes && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{app.notes}</p>}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <select value={app.stage} onChange={e => onMove(app.id, e.target.value as AppStage)}
          style={{ fontSize: 11.5, padding: "4px 6px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", outline: "none", cursor: "pointer" }}>
          {APP_STAGES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
        </select>
        {app.url && app.url !== "#" && (
          <a href={app.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "var(--text-soft)", textDecoration: "none" }}>Open ↗</a>
        )}
        <button onClick={onEdit} style={{ marginLeft: "auto", fontSize: 11.5, background: "none", border: "none", cursor: "pointer", color: "var(--text-soft)", fontWeight: 600 }}>Edit</button>
        <button onClick={() => { if (confirm("Delete this application?")) onDelete(app.id) }} style={{ fontSize: 11.5, background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontWeight: 600 }}>Delete</button>
      </div>
    </div>
  )
}

// ── Add / edit modal ───────────────────────────────────────────────────────────
function AppForm({ initial, isNew, onClose, onSave }: {
  initial: AppItem; isNew: boolean; onClose: () => void; onSave: (a: AppItem) => void
}) {
  const [form, setForm] = useState<AppItem>(initial)
  const set = <K extends keyof AppItem>(k: K, v: AppItem[K]) => setForm(p => ({ ...p, [k]: v }))
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    onSave({ ...form, appliedDate: form.appliedDate || new Date().toISOString() })
  }
  const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", outline: "none", fontSize: 13, boxSizing: "border-box" }
  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--text-soft)", display: "block", marginBottom: 4 }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{ width: "100%", maxWidth: 520, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px -12px rgba(0,0,0,.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>{isNew ? "Add Application" : "Edit Application"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={label}>Company *</label><input required style={input} value={form.company} onChange={e => set("company", e.target.value)} /></div>
          <div><label style={label}>Role *</label><input required style={input} value={form.role} onChange={e => set("role", e.target.value)} /></div>
          <div><label style={label}>Location</label><input style={input} value={form.location} onChange={e => set("location", e.target.value)} /></div>
          <div><label style={label}>Salary</label><input style={input} value={form.salary} onChange={e => set("salary", e.target.value)} placeholder="$150k – $180k" /></div>
          <div><label style={label}>Stage</label>
            <select style={input} value={form.stage} onChange={e => set("stage", e.target.value as AppStage)}>
              {APP_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div><label style={label}>Priority</label>
            <select style={input} value={form.priority} onChange={e => set("priority", e.target.value as AppItem["priority"])}>
              <option value="high">High</option><option value="mid">Mid</option><option value="low">Low</option>
            </select>
          </div>
          <div><label style={label}>Visa / Work Auth</label>
            <select style={input} value={form.visa} onChange={e => set("visa", e.target.value)}>
              <option value="">Not specified</option><option>H-1B</option><option>Green Card</option><option>OPT/CPT</option><option>W2</option><option>C2C</option><option>US Citizen</option>
            </select>
          </div>
          <div><label style={label}>🔔 Follow-up date</label><input type="date" style={input} value={form.followUpDate ?? ""} onChange={e => set("followUpDate", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={label}>Job URL</label><input type="url" style={input} value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://…" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={label}>Notes</label><textarea rows={2} style={{ ...input, resize: "none" }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Recruiter, next steps…" /></div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.remote} onChange={e => set("remote", e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Remote position
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "10px" }}>Cancel</button>
          <button type="submit" style={{ ...accentBtn, flex: 1, justifyContent: "center", padding: "10px" }}>{isNew ? "Add" : "Save changes"}</button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>No applications tracked yet</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
        Applications you apply to from the job boards land here automatically — or add one manually.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onAdd} style={accentBtn}>+ Add Application</button>
        <Link href="/dashboard/jobs" style={ghostBtn}>Browse jobs →</Link>
      </div>
    </div>
  )
}

const accentBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, textDecoration: "none" }
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }
