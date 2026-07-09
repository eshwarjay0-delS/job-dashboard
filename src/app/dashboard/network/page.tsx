"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Handshake, TriangleAlert, Link2, FileText, Sparkles, X, Check } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"

const P = {
  surface: "#ffffff",
  text:    "#1a2035",
  muted:   "#6b7a99",
  hint:    "#9aa4bc",
  border:  "#e4e8ef",
  bg:      "#f4f6f9",
}

interface Contact {
  id: string
  name: string
  title: string
  company: string
  domain: string
  email: string
  linkedIn: string
  type: "recruiter" | "referral" | "connection" | "hiring_manager"
  status: "reached_out" | "replied" | "intro_done" | "warm" | "cold"
  lastContact: string
  notes: string
  jobLinked?: string
}

const TYPE_META = {
  recruiter:      { label: "Recruiter",      color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  referral:       { label: "Referral",       color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  connection:     { label: "Connection",     color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  hiring_manager: { label: "Hiring Manager", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
}

const STATUS_META = {
  reached_out: { label: "Reached Out", color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  replied:     { label: "Replied ✓",   color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  intro_done:  { label: "Intro Done",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  warm:        { label: "Warm",        color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  cold:        { label: "Cold",        color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

const DEFAULTS: Contact[] = [
  { id: "c1", name: "Sarah Chen",   title: "Senior Technical Recruiter", company: "Palo Alto Networks", domain: "paloaltonetworks.com", email: "s.chen@panw.com",  linkedIn: "linkedin.com/in/sarahchen",  type: "recruiter", status: "replied",     lastContact: new Date(Date.now() - 1 * 86400000).toISOString(), notes: "Reached out about Cloud Security role. Very responsive.", jobLinked: "Senior Cloud Security Engineer" },
  { id: "c2", name: "Alex Torres",  title: "Engineering Manager",         company: "CrowdStrike",        domain: "crowdstrike.com",       email: "a.torres@cs.com",  linkedIn: "linkedin.com/in/alextorres", type: "hiring_manager", status: "reached_out", lastContact: new Date(Date.now() - 2 * 86400000).toISOString(), notes: "Met at security conference. Hiring for DevSecOps team.", jobLinked: "DevSecOps Engineer" },
  { id: "c3", name: "Priya Sharma", title: "Senior Data Engineer",        company: "Databricks",         domain: "databricks.com",        email: "p.sharma@db.com",  linkedIn: "linkedin.com/in/priyasharma", type: "referral",  status: "warm",       lastContact: new Date(Date.now() - 5 * 86400000).toISOString(), notes: "Former colleague. Offered to refer for open Data Eng role." },
  { id: "c4", name: "James Park",   title: "Technical Recruiter",         company: "Stripe",             domain: "stripe.com",            email: "j.park@stripe.com",linkedIn: "linkedin.com/in/jamespark",  type: "recruiter", status: "intro_done", lastContact: new Date(Date.now() - 7 * 86400000).toISOString(), notes: "Intro call done. Moving to hiring manager interview.", jobLinked: "Staff Security Engineer" },
]

function Avatar({ seed, name, size = 40 }: { seed: number; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2)
  const colors = ["#1d6fc4","#7c3aed","#059669","#d97706","#dc2626"]
  const bg = colors[seed % colors.length]
  if (err) return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
  return <img src={`https://i.pravatar.cc/${size * 2}?img=${seed}`} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}/>
}

function timeAgo(iso: string) {
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  const d = Math.floor(hrs / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function NetworkPage() {
  const [contacts, setContacts] = useState<Contact[]>(DEFAULTS)
  const [filter, setFilter] = useState<Contact["type"] | "all">("all")
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [newContact, setNewContact] = useState<Partial<Contact>>({ type: "recruiter", status: "cold" })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [composeDraft, setComposeDraft] = useState<Record<string, string>>({})
  const [loadingDraft, setLoadingDraft] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored: Contact[] = JSON.parse(localStorage.getItem("jd_contacts") || "[]")
      if (stored.length) setContacts(stored)
    } catch {}
  }, [])

  function persist(next: Contact[]) {
    setContacts(next)
    localStorage.setItem("jd_contacts", JSON.stringify(next))
  }

  function updateStatus(id: string, status: Contact["status"]) {
    persist(contacts.map(c => c.id === id ? { ...c, status, lastContact: new Date().toISOString() } : c))
  }

  function removeContact(id: string) {
    persist(contacts.filter(c => c.id !== id))
  }

  function addContact() {
    const c: Contact = {
      id: `c-${Date.now()}`,
      name: newContact.name || "New Contact",
      title: newContact.title || "",
      company: newContact.company || "",
      domain: (newContact.company || "company").toLowerCase().replace(/\s+/g, "") + ".com",
      email: newContact.email || "",
      linkedIn: newContact.linkedIn || "",
      type: newContact.type as Contact["type"] || "recruiter",
      status: "cold",
      lastContact: new Date().toISOString(),
      notes: newContact.notes || "",
    }
    persist([c, ...contacts])
    setShowAdd(false)
    setNewContact({ type: "recruiter", status: "cold" })
  }

  async function generateOutreach(c: Contact) {
    setLoadingDraft(c.id)
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "message",
          instruction: `Write a short (4-5 lines), warm LinkedIn outreach message to ${c.name}, ${c.title} at ${c.company}. Be professional, mention interest in their company's security team (or relevant role). Do not use generic openers. Do not use my name as placeholder.`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      if (data.text) setComposeDraft(prev => ({ ...prev, [c.id]: data.text }))
    } catch {
      setComposeDraft(prev => ({ ...prev, [c.id]: `Hi ${c.name},\n\nI came across your profile and noticed your work at ${c.company}. I'd love to connect and learn more about opportunities on your team.\n\nBest,` }))
    }
    setLoadingDraft(null)
  }

  const filtered = contacts.filter(c => {
    if (filter !== "all" && c.type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    }
    return true
  })

  const warm = contacts.filter(c => c.status === "replied" || c.status === "intro_done" || c.status === "warm")
  const needFollowUp = contacts.filter(c => c.status === "reached_out" && (Date.now() - new Date(c.lastContact).getTime()) > 5 * 86400000)

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Handshake size={18}/>}
          title="Network"
          description={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {contacts.length} contacts · {warm.length} warm leads
              {needFollowUp.length > 0 && <> · <TriangleAlert size={11}/> {needFollowUp.length} need follow-up</>}
            </span>
          }
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/dashboard/companies" style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 12.5, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Link2 size={13}/> Company Intel
              </Link>
              <button onClick={() => setShowAdd(!showAdd)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>+ Add Contact</button>
            </div>
          }
        />
      </div>

      {/* ── Follow-up nudge ── */}
      {needFollowUp.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>⏰</span>
          <p style={{ fontSize: 13, color: "#92400e" }}>
            <strong>{needFollowUp.map(c => c.name).join(", ")}</strong> — no reply in 5+ days. Time to follow up!
          </p>
        </div>
      )}

      {/* ── Add form ── */}
      {showAdd && (
        <div style={{ background: P.surface, border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "22px 24px", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 16 }}>Add Contact</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Full Name",  key: "name",     type: "text" },
              { label: "Job Title",  key: "title",    type: "text" },
              { label: "Company",    key: "company",  type: "text" },
              { label: "Email",      key: "email",    type: "email" },
              { label: "LinkedIn URL", key: "linkedIn", type: "text" },
              { label: "Notes",      key: "notes",    type: "text" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={(newContact[f.key as keyof Contact] as string) || ""}
                  onChange={e => setNewContact(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {(["recruiter","referral","connection","hiring_manager"] as const).map(t => (
              <button key={t} onClick={() => setNewContact(p => ({ ...p, type: t }))} style={{ padding: "4px 11px", borderRadius: 20, border: `1.5px solid ${newContact.type === t ? "var(--accent)" : P.border}`, background: newContact.type === t ? "#eff6ff" : "transparent", color: newContact.type === t ? "var(--accent)" : P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={addContact} style={{ padding: "8px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Add Contact</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Filters + search ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.hint, pointerEvents: "none" }} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
            style={{ width: "100%", paddingLeft: 28, padding: "7px 10px 7px 28px", borderRadius: 9, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none", boxSizing: "border-box" }}/>
        </div>
        {([["all","All"], ["recruiter","Recruiters"], ["referral","Referrals"], ["hiring_manager","Hiring Managers"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${filter === k ? "var(--accent)" : P.border}`, background: filter === k ? "var(--accent)" : P.surface, color: filter === k ? "#fff" : P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* ── Contact list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((c, i) => {
          const t = TYPE_META[c.type]
          const s = STATUS_META[c.status]
          const isExpanded = expandedId === c.id
          const draft = composeDraft[c.id]
          return (
            <div key={c.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Avatar seed={i + 10} name={c.name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: P.text }}>{c.name}</p>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>{t.label}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: P.hint }}>{timeAgo(c.lastContact)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: P.muted, marginBottom: 6 }}>{c.title} at {c.company}</p>
                  {c.jobLinked && <p style={{ fontSize: 12, color: "#1558a0", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Link2 size={11}/> {c.jobLinked}</p>}
                  {c.notes && <p style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.5, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><FileText size={11} style={{ marginTop: 3, flexShrink: 0 }}/> {c.notes}</p>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => { setExpandedId(isExpanded ? null : c.id); if (!isExpanded && !draft) generateOutreach(c) }}
                      style={{ padding: "5px 12px", borderRadius: 8, background: "#eff6ff", color: "#1558a0", border: "1px solid #bfdbfe", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Sparkles size={12}/> {loadingDraft === c.id ? "Drafting…" : "AI Message"}
                    </button>
                    {c.status === "reached_out" && (
                      <button onClick={() => updateStatus(c.id, "replied")} style={{ padding: "5px 12px", borderRadius: 8, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={12}/> Got Reply</button>
                    )}
                    {c.status === "replied" && (
                      <button onClick={() => updateStatus(c.id, "intro_done")} style={{ padding: "5px 12px", borderRadius: 8, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Intro Done</button>
                    )}
                    {c.linkedIn && (
                      <a href={`https://${c.linkedIn}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 11px", borderRadius: 8, background: "#0077b5", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>LinkedIn</a>
                    )}
                    <button onClick={() => removeContact(c.id)} style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, cursor: "pointer", display: "flex", alignItems: "center" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#dc2626" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.hint }}
                    ><X size={12}/></button>
                  </div>
                </div>
              </div>

              {/* AI Draft panel */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${P.border}`, padding: "14px 20px", background: "#f8fbff" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: P.hint, marginBottom: 8 }}>AI-DRAFTED OUTREACH MESSAGE</p>
                  {loadingDraft === c.id ? (
                    <p style={{ fontSize: 13, color: P.muted }}>Generating personalized message…</p>
                  ) : draft ? (
                    <>
                      <textarea value={draft} onChange={e => setComposeDraft(prev => ({ ...prev, [c.id]: e.target.value }))} rows={5}
                        style={{ width: "100%", borderRadius: 9, border: "1px solid #bfdbfe", padding: "10px 12px", fontSize: 13, color: P.text, lineHeight: 1.6, resize: "none", outline: "none", background: "#fff", boxSizing: "border-box" }}/>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => { if (c.linkedIn) window.open(`https://${c.linkedIn}`, "_blank") }} style={{ padding: "6px 14px", borderRadius: 8, background: "#0077b5", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Open LinkedIn →</button>
                        <button onClick={() => generateOutreach(c)} style={{ padding: "6px 12px", borderRadius: 8, background: "#eff6ff", color: "#1558a0", border: "1px solid #bfdbfe", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Regenerate</button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: P.hint }}><Handshake size={36}/></div>
          <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 8 }}>{search ? "No contacts found" : "Build your network"}</p>
          <p style={{ fontSize: 13.5, color: P.muted, marginBottom: 20 }}>Track recruiters, referrals, and hiring managers you connect with.</p>
          <button onClick={() => setShowAdd(true)} style={{ display: "inline-flex", gap: 6, padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>+ Add First Contact</button>
        </div>
      )}
    </div>
  )
}
