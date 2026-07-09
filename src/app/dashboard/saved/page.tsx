"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getH1BScore } from "@/lib/h1b"

const P = {
  surface: "#ffffff",
  text:    "#1a2035",
  muted:   "#6b7a99",
  hint:    "#9aa4bc",
  border:  "#e4e8ef",
}

interface SavedJob {
  id: string
  title: string
  company: string
  domain: string
  location: string
  remote: boolean
  salary: string | null
  workAuth: string[]
  url: string
  posted: string
  description: string
  savedAt: string
  notes?: string
  status: "saved" | "applied" | "interviewing" | "passed"
}

const DEFAULT_SAVED: SavedJob[] = [
  {
    id: "s1", title: "Senior Cloud Security Engineer", company: "Palo Alto Networks",
    domain: "paloaltonetworks.com", location: "Santa Clara, CA", remote: true,
    salary: "$175k–$230k", workAuth: ["h1b", "w2"],
    url: "https://paloaltonetworks.com/careers",
    posted: new Date(Date.now() - 2 * 3600000).toISOString(),
    description: "5+ years cloud security, AWS/Azure, SIEM, threat modeling.",
    savedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    notes: "Great match — strong H-1B sponsor history",
    status: "saved",
  },
  {
    id: "s2", title: "Staff Security Engineer – AppSec", company: "Stripe",
    domain: "stripe.com", location: "San Francisco, CA", remote: true,
    salary: "$200k–$270k", workAuth: ["h1b", "green_card", "w2"],
    url: "https://stripe.com/jobs",
    posted: new Date(Date.now() - 86400000).toISOString(),
    description: "SAST, DAST, SCA, Burp Suite, threat modeling, secure SDLC.",
    savedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    notes: "",
    status: "applied",
  },
]

const STATUS_CONFIG = {
  saved:       { label: "Saved",        color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  applied:     { label: "Applied",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  interviewing:{ label: "Interviewing", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  passed:      { label: "Passed",       color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function CompanyLogo({ domain, name, size = 40 }: { domain: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1d6fc4","#7c3aed","#d97706","#dc2626","#0ea5e9"]
  const bg = colors[name.charCodeAt(0) % colors.length]
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.38 }}>{initials}</div>
  )
  return (
    <img src={`https://logo.clearbit.com/${domain}`} alt={name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: size * 0.26, objectFit: "contain", background: "#fff", border: "1px solid #e4e8ef", flexShrink: 0, padding: 4 }}/>
  )
}

export default function SavedPage() {
  const [jobs, setJobs] = useState<SavedJob[]>([])
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [sortBy, setSortBy] = useState<"saved" | "match" | "salary">("saved")
  const [filterStatus, setFilterStatus] = useState<"all" | SavedJob["status"]>("all")
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Load from localStorage — real saved jobs from job board
    try {
      const raw = JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]") as SavedJob[]
      // Show real saved jobs if any; otherwise render defaults as UI-only samples
      // (do NOT seed DEFAULT_SAVED into localStorage — that pollutes jd_saved_jobs
      // with fake entries that the job board can't distinguish from real saves)
      setJobs(raw.length > 0 ? raw : DEFAULT_SAVED)
    } catch {
      setJobs(DEFAULT_SAVED)
    }
  }, [])

  function persist(next: SavedJob[]) {
    setJobs(next)
    // Only write real saves back; don't persist if the list is still just defaults
    const isStillDefaults = next.length === DEFAULT_SAVED.length &&
      next.every((j, i) => j.id === DEFAULT_SAVED[i]?.id)
    if (!isStillDefaults) localStorage.setItem("jd_saved_jobs", JSON.stringify(next))
  }

  function unsave(id: string) {
    persist(jobs.filter(j => j.id !== id))
    // Keep jd_saved_ids in sync — job board reads saved state from this key,
    // so removing here without clearing jd_saved_ids left stale bookmarks active.
    try {
      const ids: string[] = JSON.parse(localStorage.getItem("jd_saved_ids") || "[]")
      localStorage.setItem("jd_saved_ids", JSON.stringify(ids.filter(i => i !== id)))
    } catch {}
  }

  function updateStatus(id: string, status: SavedJob["status"]) {
    persist(jobs.map(j => j.id === id ? { ...j, status } : j))
    // If applied, also push to pipeline + applied-ids set (keeps job board badge in sync)
    if (status === "applied") {
      try {
        const job = jobs.find(j => j.id === id)
        if (job) {
          const apps = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
          const exists = apps.find((a: { id: string }) => a.id === id)
          if (!exists) {
            apps.push({ id, company: job.company, role: job.title, stage: "applied", appliedDate: new Date().toISOString().split("T")[0], salary: job.salary || "", visa: (job.workAuth[0] || "").toUpperCase(), notes: job.notes || "", url: job.url, location: job.location, remote: job.remote })
            localStorage.setItem("jd_applications_v2", JSON.stringify(apps))
          }
          // Also sync jd_applied_ids so the job board shows the Applied badge
          const appliedIds: string[] = JSON.parse(localStorage.getItem("jd_applied_ids") || "[]")
          if (!appliedIds.includes(id)) {
            localStorage.setItem("jd_applied_ids", JSON.stringify([...appliedIds, id]))
          }
        }
      } catch {}
    }
  }

  function saveNotes(id: string) {
    persist(jobs.map(j => j.id === id ? { ...j, notes: noteText } : j))
    setEditingNotes(null)
  }

  function toggleCompare(id: string) {
    setCompareSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  const sorted = [...jobs]
    .filter(j => filterStatus === "all" || j.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "saved") return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      if (sortBy === "salary") {
        const sa = parseInt((a.salary || "0").replace(/\D/g, "")) || 0
        const sb = parseInt((b.salary || "0").replace(/\D/g, "")) || 0
        return sb - sa
      }
      return 0
    })

  const compareJobs = jobs.filter(j => compareSelected.has(j.id))

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: "-0.4px", marginBottom: 4 }}>🔖 Saved Jobs</h1>
          <p style={{ fontSize: 13.5, color: P.muted }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""} saved · Bookmark roles to revisit</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCompareMode(!compareMode)} style={{ padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${compareMode ? "var(--accent)" : P.border}`, background: compareMode ? "#eff6ff" : P.surface, color: compareMode ? "var(--accent)" : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {compareMode ? `Compare (${compareSelected.size}/3)` : "⚖ Compare"}
          </button>
          <Link href="/dashboard/jobs" style={{ padding: "8px 16px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Browse More →</Link>
        </div>
      </div>

      {/* ── Filters + sort ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "saved", "applied", "interviewing"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${filterStatus === s ? "var(--accent)" : P.border}`,
              background: filterStatus === s ? "var(--accent)" : P.surface,
              color: filterStatus === s ? "#fff" : P.muted,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{s === "all" ? "All" : STATUS_CONFIG[s].label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: P.hint }}>Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 12, color: P.text, background: P.surface, cursor: "pointer", outline: "none" }}>
            <option value="saved">Date saved</option>
            <option value="salary">Salary (high)</option>
          </select>
        </div>
      </div>

      {/* ── Compare panel ── */}
      {compareMode && compareSelected.size >= 2 && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1558a0", marginBottom: 12 }}>⚖ Side-by-Side Comparison</p>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${compareJobs.length}, 1fr)`, gap: 12 }}>
            {compareJobs.map(j => (
              <div key={j.id} style={{ background: P.surface, borderRadius: 10, padding: "14px 16px", border: "1px solid #bfdbfe" }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: P.text, marginBottom: 4 }}>{j.title}</p>
                <p style={{ fontSize: 12, color: P.muted, marginBottom: 8 }}>{j.company}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: P.hint }}>Salary</span>
                    <span style={{ fontWeight: 700, color: j.salary ? P.text : P.hint }}>{j.salary || "Not listed"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: P.hint }}>Location</span>
                    <span style={{ fontWeight: 600, color: P.text }}>{j.remote ? "Remote" : j.location.split(",")[0]}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: P.hint }}>H-1B</span>
                    <span style={{ fontWeight: 700, color: getH1BScore(j.company).color }}>{getH1BScore(j.company).label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔖</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 8 }}>No saved jobs yet</p>
          <p style={{ fontSize: 13.5, color: P.muted, marginBottom: 20 }}>Bookmark roles from the job board to revisit them here.</p>
          <Link href="/dashboard/jobs" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Browse Jobs →</Link>
        </div>
      )}

      {/* ── Job cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(job => {
          const h1b = getH1BScore(job.company)
          const s = STATUS_CONFIG[job.status]
          const isSelected = compareSelected.has(job.id)
          return (
            <div key={job.id} style={{ background: P.surface, border: `1.5px solid ${isSelected ? "var(--accent)" : P.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 4px rgba(26,32,53,.05)" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {compareMode && (
                  <input type="checkbox" checked={isSelected} onChange={() => toggleCompare(job.id)}
                    disabled={!isSelected && compareSelected.size >= 3}
                    style={{ marginTop: 12, cursor: "pointer", accentColor: "var(--accent)" }}/>
                )}
                <CompanyLogo domain={job.domain} name={job.company} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: P.text }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.text }}
                      >{job.title}</span>
                    </a>
                    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: P.hint, marginLeft: "auto" }}>Saved {timeAgo(job.savedAt)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: P.muted, marginBottom: 6 }}>{job.company} · {job.location}{job.salary ? ` · ${job.salary}` : ""}{job.remote ? " · Remote" : ""}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: h1b.bg, color: h1b.color, border: `1px solid ${h1b.border}` }}>{h1b.label}</span>
                    {job.workAuth.slice(0, 3).map(k => {
                      const c: Record<string, { label: string; color: string; bg: string; border: string }> = { h1b: { label: "H-1B", color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" }, w2: { label: "W2", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" }, c2c: { label: "C2C", color: "#92400e", bg: "#fffbeb", border: "#fde68a" }, green_card: { label: "Green Card", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" } }
                      const b = c[k]; if (!b) return null
                      return <span key={k} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>{b.label}</span>
                    })}
                  </div>

                  {/* Notes */}
                  {editingNotes === job.id ? (
                    <div style={{ marginBottom: 10 }}>
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add notes about this role…"
                        style={{ width: "100%", borderRadius: 8, border: "1.5px solid #bfdbfe", padding: "7px 10px", fontSize: 12.5, color: P.text, resize: "none", outline: "none", background: "#f8fbff", boxSizing: "border-box" }}/>
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <button onClick={() => saveNotes(job.id)} style={{ padding: "5px 12px", borderRadius: 7, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingNotes(null)} style={{ padding: "5px 10px", borderRadius: 7, background: "transparent", color: P.muted, fontSize: 12, border: `1px solid ${P.border}`, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : job.notes ? (
                    <div style={{ marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <p style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.5, flex: 1, background: "#f8f9fb", padding: "6px 10px", borderRadius: 7, border: `1px solid ${P.border}` }}>📝 {job.notes}</p>
                      <button onClick={() => { setEditingNotes(job.id); setNoteText(job.notes || "") }} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent", color: P.hint, fontSize: 11, cursor: "pointer" }}>Edit</button>
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {job.status === "saved" && (
                      <button onClick={() => updateStatus(job.id, "applied")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 12.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
                        ✓ Mark Applied
                      </button>
                    )}
                    {job.status === "applied" && (
                      <button onClick={() => updateStatus(job.id, "interviewing")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: "#ecfdf5", color: "#059669", fontSize: 12.5, fontWeight: 700, border: "1px solid #a7f3d0", cursor: "pointer" }}>
                        📞 Got Interview
                      </button>
                    )}
                    <Link href="/dashboard/resume"
                      onClick={() => { try {
                        const jdText = job.title + " at " + job.company + "\n\n" + job.description
                        sessionStorage.setItem("jd_prefill", jdText)
                        sessionStorage.setItem("jd_prefill_jd", job.description || jdText)
                        sessionStorage.setItem("jd_prefill_role", job.title || "")
                        sessionStorage.setItem("jd_prefill_company", job.company || "")
                      } catch {} }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "#f5f3ff", color: "#6d28d9", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid #ddd6fe" }}>
                      Tailor
                    </Link>
                    {!job.notes && editingNotes !== job.id && (
                      <button onClick={() => { setEditingNotes(job.id); setNoteText("") }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Note</button>
                    )}
                    <button onClick={() => unsave(job.id)} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#dc2626" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.hint }}
                    >✕ Remove</button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
