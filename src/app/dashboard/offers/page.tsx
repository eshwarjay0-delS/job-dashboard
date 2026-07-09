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

interface Offer {
  id: string
  company: string
  domain: string
  role: string
  base: number
  bonus: number
  equity: number
  rsu: number
  visaSponsor: boolean
  visaType: string
  location: string
  remote: boolean
  startDate: string
  deadline: string
  status: "pending" | "negotiating" | "accepted" | "declined"
  notes: string
  receivedAt: string
}

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`
}

function tc(o: Offer) { return o.base + o.bonus + o.equity }

const STATUS = {
  pending:     { label: "Pending Decision", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  negotiating: { label: "Negotiating",      color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  accepted:    { label: "Accepted ✓",       color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  declined:    { label: "Declined",         color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

const DEFAULTS: Offer[] = [
  {
    id: "o1", company: "Palo Alto Networks", domain: "paloaltonetworks.com",
    role: "Senior Cloud Security Engineer",
    base: 195000, bonus: 30000, equity: 50000, rsu: 200000,
    visaSponsor: true, visaType: "H-1B Transfer",
    location: "Santa Clara, CA", remote: true, startDate: "2025-08-15",
    deadline: "2025-07-20", status: "pending", notes: "Strong comp, great team. Ask for $205k base.",
    receivedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "o2", company: "Stripe", domain: "stripe.com",
    role: "Staff Security Engineer – AppSec",
    base: 215000, bonus: 25000, equity: 75000, rsu: 300000,
    visaSponsor: true, visaType: "H-1B Transfer",
    location: "San Francisco, CA", remote: true, startDate: "2025-09-01",
    deadline: "2025-07-25", status: "negotiating", notes: "Countered with $225k base. Waiting on response.",
    receivedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
]

function CompanyLogo({ domain, name, size = 42 }: { domain: string; name: string; size?: number }) {
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

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>(DEFAULTS)
  const [selected, setSelected] = useState<string | null>("o1")
  const [tips, setTips] = useState<string[]>([])
  const [loadingTips, setLoadingTips] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newOffer, setNewOffer] = useState<Partial<Offer>>({ status: "pending", visaSponsor: true, remote: true })

  useEffect(() => {
    try {
      const stored: Offer[] = JSON.parse(localStorage.getItem("jd_offers") || "[]")
      if (stored.length) setOffers(stored)
    } catch {}
  }, [])

  function persist(next: Offer[]) {
    setOffers(next)
    localStorage.setItem("jd_offers", JSON.stringify(next))
  }

  function updateStatus(id: string, status: Offer["status"]) {
    persist(offers.map(o => o.id === id ? { ...o, status } : o))
  }

  async function loadNegotiationTips(offer: Offer) {
    setLoadingTips(true)
    setTips([])
    try {
      const res = await fetch(`/api/salary?role=${encodeURIComponent(offer.role)}&company=${encodeURIComponent(offer.company)}&location=${encodeURIComponent(offer.location)}`)
      const data = await res.json()
      if (data.negotiation_tips?.length) setTips(data.negotiation_tips)
      else throw new Error("none")
    } catch {
      setTips([
        `Counter with ${fmt(Math.round(offer.base * 1.08 / 5000) * 5000)} — 8% above offer is standard for this level.`,
        "Ask for front-loaded RSU vesting (1/3 in year 1 instead of standard 1/4 cliff).",
        "Negotiate a $25–35k sign-on bonus if base is fixed, to bridge to the first annual bonus.",
        offer.visaSponsor ? "H-1B transfer is confirmed — you can negotiate from a position of strength since they're already sponsoring." : "Get visa sponsorship in writing before signing.",
        "Request a 30-day start date extension if you need more time to compare offers.",
      ])
    }
    setLoadingTips(false)
  }

  const selectedOffer = offers.find(o => o.id === selected)

  // Days until deadline
  function daysLeft(deadline: string): number {
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  }

  function addOffer() {
    const o: Offer = {
      id: `o${Date.now()}`,
      company: newOffer.company || "Company",
      domain: (newOffer.company || "company").toLowerCase().replace(/\s+/g, "") + ".com",
      role: newOffer.role || "Role",
      base: Number(newOffer.base) || 0,
      bonus: Number(newOffer.bonus) || 0,
      equity: Number(newOffer.equity) || 0,
      rsu: Number(newOffer.rsu) || 0,
      visaSponsor: newOffer.visaSponsor ?? true,
      visaType: newOffer.visaType || "TBD",
      location: newOffer.location || "Remote",
      remote: newOffer.remote ?? true,
      startDate: newOffer.startDate || "",
      deadline: newOffer.deadline || "",
      status: "pending",
      notes: newOffer.notes || "",
      receivedAt: new Date().toISOString(),
    }
    persist([o, ...offers])
    setSelected(o.id)
    setShowAddForm(false)
    setNewOffer({ status: "pending", visaSponsor: true, remote: true })
  }

  const pending = offers.filter(o => o.status === "pending" || o.status === "negotiating")

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: "-0.4px", marginBottom: 4 }}>🏆 Offer Management</h1>
          <p style={{ fontSize: 13.5, color: P.muted }}>Compare offers, track deadlines, and get AI negotiation coaching.</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          + Add Offer
        </button>
      </div>

      {/* ── Add form ── */}
      {showAddForm && (
        <div style={{ background: P.surface, border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "22px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 16 }}>Add New Offer</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Company", key: "company", type: "text" },
              { label: "Role", key: "role", type: "text" },
              { label: "Base Salary ($)", key: "base", type: "number" },
              { label: "Annual Bonus ($)", key: "bonus", type: "number" },
              { label: "Annual Equity ($)", key: "equity", type: "number" },
              { label: "Location", key: "location", type: "text" },
              { label: "Offer Deadline", key: "deadline", type: "date" },
              { label: "Start Date", key: "startDate", type: "date" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={(newOffer[f.key as keyof typeof newOffer] as string) || ""}
                  onChange={e => setNewOffer(prev => ({ ...prev, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                  style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" }}/>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={addOffer} style={{ padding: "8px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Save Offer</button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Deadline alert for pending offers ── */}
      {pending.map(o => {
        const d = daysLeft(o.deadline)
        if (!o.deadline || d > 7) return null
        return (
          <div key={o.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <p style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
              <strong>{o.company}</strong> offer deadline in <strong>{d} day{d !== 1 ? "s" : ""}</strong> — {d <= 2 ? "respond now!" : "don't forget to follow up."}
            </p>
          </div>
        )
      })}

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left: Offer list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {offers.map(o => {
            const s = STATUS[o.status]
            const isSelected = o.id === selected
            const d = o.deadline ? daysLeft(o.deadline) : null
            return (
              <div key={o.id} onClick={() => setSelected(o.id)} style={{ cursor: "pointer", background: P.surface, border: `2px solid ${isSelected ? "var(--accent)" : P.border}`, borderRadius: 14, padding: "14px 16px", boxShadow: isSelected ? "0 4px 16px rgba(29,111,196,.14)" : "0 1px 4px rgba(26,32,53,.04)", transition: "all .15s" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <CompanyLogo domain={o.domain} name={o.company} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.role}</p>
                    <p style={{ fontSize: 12, color: P.muted }}>{o.company}</p>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: P.text, letterSpacing: "-0.5px" }}>{fmt(tc(o))}<span style={{ fontSize: 11, fontWeight: 500, color: P.hint }}>  TC</span></p>
                    <p style={{ fontSize: 11.5, color: P.muted }}>{fmt(o.base)} base + {fmt(o.bonus)} bonus</p>
                  </div>
                  <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                </div>
                {d !== null && d <= 7 && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12, color: d <= 2 ? "#dc2626" : "#d97706", fontWeight: 700 }}>⏰ {d}d left to respond</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Compare all CTA */}
          {offers.length >= 2 && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1558a0", marginBottom: 8 }}>Compare All Offers</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(offers.length, 3)}, 1fr)`, gap: 8 }}>
                {offers.slice(0, 3).map(o => (
                  <div key={o.id} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: P.muted, marginBottom: 2 }}>{o.company.split(" ")[0]}</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: P.text }}>{fmt(tc(o))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Detail ── */}
        {selectedOffer ? (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <CompanyLogo domain={selectedOffer.domain} name={selectedOffer.company} size={52} />
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: P.text, letterSpacing: "-0.3px", marginBottom: 4 }}>{selectedOffer.role}</h2>
                <p style={{ fontSize: 13.5, color: P.muted }}>{selectedOffer.company} · {selectedOffer.remote ? "Remote" : selectedOffer.location}</p>
              </div>
            </div>

            {/* ── Comp breakdown ── */}
            <div style={{ background: "#f4f6f9", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: P.hint, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Compensation</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "Base Salary",   value: fmt(selectedOffer.base),   color: "#1558a0" },
                  { label: "Annual Bonus",  value: fmt(selectedOffer.bonus),  color: "#7c3aed" },
                  { label: "Annual Equity", value: fmt(selectedOffer.equity), color: "#059669" },
                  { label: "RSU Grant",     value: fmt(selectedOffer.rsu),    color: "#d97706" },
                ].map(c => (
                  <div key={c.label} style={{ background: P.surface, borderRadius: 10, padding: "12px 14px", border: `1px solid ${P.border}` }}>
                    <p style={{ fontSize: 11, color: P.hint, marginBottom: 4 }}>{c.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: c.color, letterSpacing: "-0.5px" }}>{c.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-h))", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Total Compensation</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{fmt(tc(selectedOffer))}</span>
              </div>
            </div>

            {/* ── Details ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Visa Sponsorship", value: selectedOffer.visaSponsor ? `✓ ${selectedOffer.visaType}` : "Not sponsored", color: selectedOffer.visaSponsor ? "#059669" : "#dc2626" },
                { label: "Start Date",        value: selectedOffer.startDate || "TBD",       color: P.text },
                { label: "Response Deadline", value: selectedOffer.deadline || "TBD",        color: selectedOffer.deadline && daysLeft(selectedOffer.deadline) <= 3 ? "#dc2626" : P.text },
                { label: "Location",          value: selectedOffer.remote ? "Remote ✓" : selectedOffer.location, color: P.text },
              ].map(d => (
                <div key={d.label} style={{ background: P.bg, borderRadius: 9, padding: "10px 13px" }}>
                  <p style={{ fontSize: 11, color: P.hint, marginBottom: 3 }}>{d.label}</p>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: d.color }}>{d.value}</p>
                </div>
              ))}
            </div>

            {/* ── Notes ── */}
            {selectedOffer.notes && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>📝 Notes</p>
                <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>{selectedOffer.notes}</p>
              </div>
            )}

            {/* ── AI Negotiation tips ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: P.text }}>✨ AI Negotiation Coaching</p>
                <button onClick={() => loadNegotiationTips(selectedOffer)} disabled={loadingTips} style={{ padding: "6px 14px", borderRadius: 8, background: "#eff6ff", color: "#1558a0", border: "1px solid #bfdbfe", fontSize: 12, fontWeight: 700, cursor: loadingTips ? "not-allowed" : "pointer", opacity: loadingTips ? 0.7 : 1 }}>
                  {loadingTips ? "Loading…" : tips.length ? "Refresh" : "Get Tips"}
                </button>
              </div>
              {tips.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tips.map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "10px 13px" }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
                      <p style={{ fontSize: 13, color: "#4c1d95", lineHeight: 1.5 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              )}
              {tips.length === 0 && !loadingTips && (
                <div style={{ background: P.bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: P.hint }}>Click "Get Tips" for AI-powered negotiation talking points tailored to this role and company.</p>
                </div>
              )}
            </div>

            {/* ── Status actions ── */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 18, borderTop: `1px solid ${P.border}` }}>
              {selectedOffer.status !== "accepted" && selectedOffer.status !== "declined" && (
                <>
                  <button onClick={() => updateStatus(selectedOffer.id, "negotiating")} style={{ padding: "8px 18px", borderRadius: 9, background: "#eff6ff", color: "#1558a0", border: "1px solid #bfdbfe", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Counter Offer</button>
                  <button onClick={() => updateStatus(selectedOffer.id, "accepted")} style={{ padding: "8px 18px", borderRadius: 9, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Accept</button>
                  <button onClick={() => updateStatus(selectedOffer.id, "declined")} style={{ padding: "8px 16px", borderRadius: 9, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Decline</button>
                </>
              )}
              {(selectedOffer.status === "accepted" || selectedOffer.status === "declined") && (
                <button onClick={() => updateStatus(selectedOffer.id, "pending")} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Reopen</button>
              )}
              <Link href="/dashboard/ai-tools" style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 9, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>✨ Draft Counter Email</Link>
            </div>
          </div>
        ) : (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "64px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8 }}>Select an offer to view details</p>
            <p style={{ fontSize: 13, color: P.muted }}>Track, compare, and negotiate your offers in one place.</p>
          </div>
        )}
      </div>
    </div>
  )
}
