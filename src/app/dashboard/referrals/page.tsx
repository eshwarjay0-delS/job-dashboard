"use client"

import { useState, useEffect } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type Relationship = "ex_colleague" | "alum" | "friend" | "linkedin" | "cold" | "recruiter"
type Status = "identified" | "reached_out" | "chatted" | "asked" | "referred" | "followed_up" | "closed"

interface Contact {
  id: string
  name: string
  company: string
  title: string
  linkedin?: string
  email?: string
  relationship: Relationship
  status: Status
  targetRole?: string
  lastContactDate?: string
  followUpDate?: string
  notes: string
  createdAt: string
}

/* ═══════════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════════ */
const RELATIONSHIP_INFO: Record<Relationship, { label: string; color: string; bg: string; icon: string }> = {
  ex_colleague: { label: "Ex-Colleague", color: "#1d6fc4", bg: "rgba(29,111,196,0.08)",  icon: "🤝" },
  alum:         { label: "Alumni",       color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  icon: "🎓" },
  friend:       { label: "Friend",       color: "#10b981", bg: "rgba(16,185,129,0.08)",  icon: "👋" },
  linkedin:     { label: "LinkedIn 1st", color: "#0ea5e9", bg: "rgba(14,165,233,0.08)",  icon: "💼" },
  cold:         { label: "Cold Reach",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: "📨" },
  recruiter:    { label: "Recruiter",    color: "#ec4899", bg: "rgba(236,72,153,0.08)",  icon: "📞" },
}

const STATUS_INFO: Record<Status, { label: string; color: string; bg: string; step: number; icon: string }> = {
  identified:  { label: "Identified",   color: "#6b7a99", bg: "#f1f4f9",              step: 0, icon: "○" },
  reached_out: { label: "Reached Out",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)", step: 1, icon: "📨" },
  chatted:     { label: "Had Chat",     color: "#3b82f6", bg: "rgba(59,130,246,0.1)", step: 2, icon: "💬" },
  asked:       { label: "Asked for Ref",color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", step: 3, icon: "🙏" },
  referred:    { label: "Referred! 🎉", color: "#10b981", bg: "rgba(16,185,129,0.1)", step: 4, icon: "✅" },
  followed_up: { label: "Following Up", color: "#0ea5e9", bg: "rgba(14,165,233,0.1)", step: 3, icon: "🔄" },
  closed:      { label: "Closed",       color: "#9ca3af", bg: "#f9fafb",              step: 5, icon: "✕" },
}

const STATUS_FLOW: Status[] = ["identified", "reached_out", "chatted", "asked", "referred", "followed_up", "closed"]

const TEMPLATE_MESSAGES: Record<Relationship, string> = {
  ex_colleague: "Hi [Name], hope you're well! I'm exploring opportunities at [Company] and thought of you. Would love to catch up and hear about your experience there — open to a quick 15-min call?",
  alum:         "Hi [Name], fellow [School] alum here! I'm very interested in [Company] and came across your profile. Would you be open to a quick chat about your experience there?",
  friend:       "Hey [Name]! I'm actively looking at [Company] for [role]. You've been there a while — any chance you'd be willing to pass along my resume to the team?",
  linkedin:     "Hi [Name], I came across your profile while researching [Company]. I'm a [title] with [X] years of experience and am very interested in joining the team. Would you be open to a brief virtual coffee?",
  cold:         "Hi [Name], I found your profile through LinkedIn while researching [Company]. I have a background in [domain] and am genuinely excited about [Company]'s work on [specific product/mission]. Would you be open to a quick 10-minute call?",
  recruiter:    "Hi [Name], I saw you're recruiting for [role] at [Company]. I have [X] years of experience in [domain] and am actively exploring new opportunities. I'd love to connect — are you available for a quick call?",
}

function newId() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) }

const SEED_CONTACTS: Contact[] = [
  {
    id: "c1", name: "Sarah Chen", company: "Palo Alto Networks", title: "Senior Cloud Security Engineer",
    linkedin: "https://linkedin.com/in/sarahchen", relationship: "ex_colleague", status: "chatted",
    targetRole: "Cloud Security Engineer", lastContactDate: new Date(Date.now() - 3*86400000).toISOString().slice(0,10),
    followUpDate: new Date(Date.now() + 4*86400000).toISOString().slice(0,10),
    notes: "Met at Cigna. She moved to PAN 2 years ago. Very helpful — said team is hiring aggressively.",
    createdAt: new Date(Date.now() - 7*86400000).toISOString(),
  },
  {
    id: "c2", name: "Marcus Reid", company: "CrowdStrike", title: "Engineering Manager – DevSecOps",
    linkedin: "https://linkedin.com/in/marcusreid", relationship: "alum", status: "reached_out",
    targetRole: "DevSecOps Engineer", lastContactDate: new Date(Date.now() - 5*86400000).toISOString().slice(0,10),
    notes: "SLU CS alum, class of 2020. Sent InMail 5 days ago — no reply yet.",
    createdAt: new Date(Date.now() - 5*86400000).toISOString(),
  },
]

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function ReferralsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [view, setView]         = useState<"board" | "list">("board")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Contact | null>(null)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [templateRel, setTemplateRel] = useState<Relationship>("ex_colleague")
  const [showTemplate, setShowTemplate] = useState(false)
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all")
  const [search, setSearch]     = useState("")

  // Form state
  const [f, setF] = useState({
    name: "", company: "", title: "", linkedin: "", email: "",
    relationship: "ex_colleague" as Relationship, status: "identified" as Status,
    targetRole: "", lastContactDate: today(), followUpDate: "", notes: "",
  })

  /* persist */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("jd_referrals_v1")
      setContacts(stored ? JSON.parse(stored) : SEED_CONTACTS)
    } catch { setContacts(SEED_CONTACTS) }
  }, [])
  useEffect(() => { localStorage.setItem("jd_referrals_v1", JSON.stringify(contacts)) }, [contacts])

  function openAdd() {
    setEditing(null)
    setF({ name: "", company: "", title: "", linkedin: "", email: "", relationship: "ex_colleague", status: "identified", targetRole: "", lastContactDate: today(), followUpDate: "", notes: "" })
    setShowForm(true)
  }
  function openEdit(c: Contact) {
    setEditing(c)
    setF({ name: c.name, company: c.company, title: c.title, linkedin: c.linkedin || "", email: c.email || "", relationship: c.relationship, status: c.status, targetRole: c.targetRole || "", lastContactDate: c.lastContactDate || today(), followUpDate: c.followUpDate || "", notes: c.notes })
    setShowForm(true)
    setSelected(null)
  }
  function save() {
    if (!f.name.trim() || !f.company.trim()) return
    if (editing) {
      setContacts(prev => prev.map(c => c.id === editing.id ? { ...c, ...f } : c))
    } else {
      setContacts(prev => [...prev, { id: newId(), ...f, createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
  }
  function del(id: string) { setContacts(prev => prev.filter(c => c.id !== id)); setSelected(null) }
  function advanceStatus(c: Contact) {
    const idx = STATUS_FLOW.indexOf(c.status)
    if (idx < STATUS_FLOW.length - 2) {
      const next = STATUS_FLOW[idx + 1]
      setContacts(prev => prev.map(x => x.id === c.id ? { ...x, status: next, lastContactDate: today() } : x))
      setSelected(prev => prev?.id === c.id ? { ...prev, status: next, lastContactDate: today() } : prev)
    }
  }

  /* computed */
  const followUpSoon = contacts.filter(c => c.followUpDate && daysUntil(c.followUpDate) <= 2 && daysUntil(c.followUpDate) >= 0)
  const referred = contacts.filter(c => c.status === "referred").length
  const active   = contacts.filter(c => !["closed"].includes(c.status)).length
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
    const matchStatus = filterStatus === "all" || c.status === filterStatus
    return matchSearch && matchStatus
  })

  // Board columns
  const BOARD_COLS: { status: Status; label: string }[] = [
    { status: "identified",  label: "Identified" },
    { status: "reached_out", label: "Reached Out" },
    { status: "chatted",     label: "Had Chat" },
    { status: "asked",       label: "Asked for Ref" },
    { status: "referred",    label: "Referred 🎉" },
  ]

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>Referral Tracker</h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>Warm introductions land 4× more interviews — track every connection</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTemplate(true)}
            style={{ padding: "9px 16px", borderRadius: 9, background: "#fff", color: "#1a2035", fontSize: 13.5, fontWeight: 600, border: "1.5px solid #e4e8ef", cursor: "pointer" }}>
            📝 Message Templates
          </button>
          <button onClick={openAdd}
            style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
            + Add Contact
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Tracked",    value: contacts.length, color: "#1d6fc4", sub: "contacts" },
          { label: "Active",           value: active,          color: "#f59e0b", sub: "in pipeline" },
          { label: "Referred",         value: referred,        color: "#10b981", sub: "success!" },
          { label: "Follow Up Soon",   value: followUpSoon.length, color: "#ef4444", sub: "in ≤2 days" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a2035", marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: "#6b7a99" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Follow-up alerts */}
      {followUpSoon.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>Follow-up due:</span>
          {followUpSoon.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 100, padding: "3px 10px", cursor: "pointer" }}>
              {c.name} @ {c.company} ({daysUntil(c.followUpDate!)}d)
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or company…"
          style={{ padding: "8px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035", minWidth: 220, background: "#fff" }}/>
        <div style={{ display: "flex", gap: 4, background: "#f1f4f9", borderRadius: 8, padding: 3 }}>
          {(["board", "list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: view === v ? "#fff" : "transparent", color: view === v ? "var(--accent)" : "#6b7a99", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {v === "board" ? "🗂 Board" : "☰ List"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: 4 }}>
          {(["all", ...STATUS_FLOW.slice(0, 5)] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s as Status | "all")}
              style={{ padding: "5px 11px", borderRadius: 100, fontSize: 12, fontWeight: 600, border: "1px solid",
                borderColor: filterStatus === s ? "var(--accent)" : "#e4e8ef",
                background: filterStatus === s ? "rgba(29,111,196,0.07)" : "#fff",
                color: filterStatus === s ? "var(--accent)" : "#6b7a99", cursor: "pointer" }}>
              {s === "all" ? "All" : STATUS_INFO[s as Status].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BOARD VIEW ──────────────────────────────────────────────── */}
      {view === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, overflowX: "auto", minWidth: 0 }}>
          {BOARD_COLS.map(col => {
            const colContacts = filtered.filter(c => c.status === col.status)
            const si = STATUS_INFO[col.status]
            return (
              <div key={col.status}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: si.color }}>{si.icon} {col.label}</span>
                  <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 100, background: si.bg, color: si.color, fontWeight: 700 }}>{colContacts.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                  {colContacts.map(c => (
                    <div key={c.id} onClick={() => setSelected(c)}
                      style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 10, padding: "12px 13px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(29,111,196,0.1)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e4e8ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "#6b7a99", marginBottom: 6 }}>{c.company}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 100, background: RELATIONSHIP_INFO[c.relationship].bg, color: RELATIONSHIP_INFO[c.relationship].color, fontWeight: 600 }}>
                          {RELATIONSHIP_INFO[c.relationship].icon} {RELATIONSHIP_INFO[c.relationship].label}
                        </span>
                      </div>
                      {c.followUpDate && daysUntil(c.followUpDate) <= 3 && daysUntil(c.followUpDate) >= 0 && (
                        <div style={{ fontSize: 10.5, color: "#ef4444", marginTop: 4, fontWeight: 700 }}>⏰ Follow up {daysUntil(c.followUpDate) === 0 ? "today" : `in ${daysUntil(c.followUpDate)}d`}</div>
                      )}
                    </div>
                  ))}
                  {colContacts.length === 0 && (
                    <div style={{ textAlign: "center", padding: "16px 8px", color: "#aab3c5", fontSize: 12, borderRadius: 8, border: "1.5px dashed #e4e8ef" }}>
                      Drop a contact here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────── */}
      {view === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "48px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No contacts yet</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 20 }}>Add a warm contact to track your referral pipeline</div>
              <button onClick={openAdd} style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>+ Add First Contact</button>
            </div>
          ) : filtered.map(c => {
            const si = STATUS_INFO[c.status]
            const ri = RELATIONSHIP_INFO[c.relationship]
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#e4e8ef"}>
                {/* Avatar */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: ri.bg, border: `1.5px solid ${ri.color}33`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {ri.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1a2035" }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: "#6b7a99" }}>{c.title} · {c.company}</div>
                </div>
                {c.targetRole && <div style={{ fontSize: 12, color: "#6b7a99", background: "#f1f4f9", padding: "3px 9px", borderRadius: 100 }}>{c.targetRole}</div>}
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: si.bg, color: si.color, whiteSpace: "nowrap" }}>{si.label}</span>
                {c.lastContactDate && <span style={{ fontSize: 11.5, color: "#aab3c5", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtDate(c.lastContactDate)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── DETAIL DRAWER ───────────────────────────────────────────── */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300 }}/>
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(440px, 95vw)", background: "#fff", borderLeft: "1px solid #e4e8ef", zIndex: 400, overflowY: "auto", padding: "24px" }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7a99" }}>✕</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: RELATIONSHIP_INFO[selected.relationship].bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1.5px solid ${RELATIONSHIP_INFO[selected.relationship].color}33` }}>
                {RELATIONSHIP_INFO[selected.relationship].icon}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1a2035" }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "#6b7a99" }}>{selected.title} · {selected.company}</div>
              </div>
            </div>

            {/* Status pipeline */}
            <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Pipeline Status</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {STATUS_FLOW.slice(0, 5).map((s, i) => {
                  const si = STATUS_INFO[s]
                  const isCurrent = selected.status === s
                  const isPast = STATUS_INFO[selected.status].step > si.step
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
                        background: isCurrent ? si.bg : isPast ? "rgba(16,185,129,0.08)" : "#f1f4f9",
                        color: isCurrent ? si.color : isPast ? "#10b981" : "#aab3c5",
                        border: `1px solid ${isCurrent ? si.color + "44" : "transparent"}` }}>
                        {isPast ? "✓" : si.icon} {si.label}
                      </span>
                      {i < 4 && <span style={{ color: "#d1d5db", fontSize: 12 }}>›</span>}
                    </div>
                  )
                })}
              </div>
              {selected.status !== "referred" && selected.status !== "closed" && (
                <button onClick={() => advanceStatus(selected)}
                  style={{ marginTop: 10, width: "100%", padding: "8px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  → Move to: {STATUS_INFO[STATUS_FLOW[STATUS_FLOW.indexOf(selected.status) + 1]]?.label || "Next"}
                </button>
              )}
            </div>

            {/* Info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Relationship",   value: RELATIONSHIP_INFO[selected.relationship].label },
                { label: "Target Role",    value: selected.targetRole || "—" },
                { label: "Last Contact",   value: selected.lastContactDate ? fmtDate(selected.lastContactDate) : "—" },
                { label: "Follow Up",      value: selected.followUpDate ? fmtDate(selected.followUpDate) : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "#f8f9fc", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13.5, color: "#1a2035", fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {selected.linkedin && (
                <a href={selected.linkedin} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "rgba(29,111,196,0.06)", border: "1px solid rgba(29,111,196,0.2)", borderRadius: 8, fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                  💼 LinkedIn
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "#f8f9fc", border: "1px solid #e4e8ef", borderRadius: 8, fontSize: 13, color: "#1a2035", fontWeight: 600, textDecoration: "none" }}>
                  ✉ Email
                </a>
              )}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13.5, color: "#1a2035", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.notes}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openEdit(selected)} style={{ flex: 1, padding: "10px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}>Edit Contact</button>
              <button onClick={() => del(selected.id)} style={{ padding: "10px 14px", background: "transparent", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 9, cursor: "pointer", fontSize: 13.5 }}>Delete</button>
            </div>
          </div>
        </>
      )}

      {/* ── ADD/EDIT FORM MODAL ─────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 20 }}>{editing ? "Edit Contact" : "Add Contact"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={LS}>Name *</label><input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Full name" style={IS}/></div>
                <div><label style={LS}>Company *</label><input value={f.company} onChange={e => setF(p => ({ ...p, company: e.target.value }))} placeholder="Company name" style={IS}/></div>
              </div>
              <div><label style={LS}>Their Title</label><input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Senior Engineer" style={IS}/></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Relationship</label>
                  <select value={f.relationship} onChange={e => setF(p => ({ ...p, relationship: e.target.value as Relationship }))} style={IS}>
                    {Object.entries(RELATIONSHIP_INFO).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Status</label>
                  <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value as Status }))} style={IS}>
                    {STATUS_FLOW.slice(0, 6).map(s => <option key={s} value={s}>{STATUS_INFO[s].icon} {STATUS_INFO[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={LS}>Target Role at Their Company</label><input value={f.targetRole} onChange={e => setF(p => ({ ...p, targetRole: e.target.value }))} placeholder="e.g., Cloud Security Engineer" style={IS}/></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={LS}>LinkedIn URL</label><input value={f.linkedin} onChange={e => setF(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." style={IS}/></div>
                <div><label style={LS}>Email (optional)</label><input value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="name@company.com" style={IS}/></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={LS}>Last Contact Date</label><input type="date" value={f.lastContactDate} onChange={e => setF(p => ({ ...p, lastContactDate: e.target.value }))} style={IS}/></div>
                <div><label style={LS}>Follow-up Reminder</label><input type="date" value={f.followUpDate} onChange={e => setF(p => ({ ...p, followUpDate: e.target.value }))} style={IS}/></div>
              </div>
              <div>
                <label style={LS}>Notes</label>
                <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} placeholder="Conversation notes, mutual connections, next steps…" rows={3}
                  style={{ ...IS, resize: "vertical", minHeight: 72 }}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} style={{ flex: 1, padding: "11px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editing ? "Save Changes" : "Add Contact"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 18px", background: "transparent", color: "#6b7a99", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MESSAGE TEMPLATES MODAL ─────────────────────────────────── */}
      {showTemplate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTemplate(false) }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035" }}>📝 Outreach Templates</div>
              <button onClick={() => setShowTemplate(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7a99" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(RELATIONSHIP_INFO).map(([k, v]) => (
                <button key={k} onClick={() => setTemplateRel(k as Relationship)}
                  style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, border: "1.5px solid",
                    borderColor: templateRel === k ? v.color : "#e4e8ef", background: templateRel === k ? v.bg : "#fff", color: templateRel === k ? v.color : "#6b7a99", cursor: "pointer" }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "16px", fontSize: 13.5, color: "#1a2035", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit", border: "1px solid #e4e8ef" }}>
              {TEMPLATE_MESSAGES[templateRel]}
            </div>
            <p style={{ fontSize: 12, color: "#6b7a99", marginTop: 10 }}>Replace [Name], [Company], [role], [domain] with actual details before sending.</p>
            <button onClick={() => { navigator.clipboard?.writeText(TEMPLATE_MESSAGES[templateRel]).catch(() => {}) }}
              style={{ marginTop: 10, padding: "9px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              📋 Copy Template
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const LS: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 5 }
const IS: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" }
