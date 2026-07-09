"use client"

import { useState, useEffect } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Offer {
  id: string
  company: string
  domain: string
  role: string
  location: string
  remote: "remote" | "hybrid" | "onsite"
  base: number
  bonus: number           // target annual bonus
  signing: number
  equity: number          // total equity grant $
  vestingYears: number    // typically 4
  equityCliff: number     // months before first vest
  rsu: boolean
  benefits: {
    health: number          // monthly contribution estimate
    dental: boolean
    vision: boolean
    retirement401k: number  // % match
    pto: number             // days/year
    wfhStipend: number      // annual
    learningBudget: number  // annual
    gym: number             // annual
  }
  visaSponsor: boolean
  visaType: string
  colAdjust: number       // COL adjustment factor (e.g. 0.85 = 15% cheaper city)
  notes: string
  receivedAt: string
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function newId() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function fmt(n: number, decimals = 0) {
  if (!n && n !== 0) return "—"
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: decimals })
}
function fmtK(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "k"
  return "$" + n.toLocaleString()
}

function totalYear1(o: Offer): number {
  const equityYear1 = o.vestingYears > 0 ? (o.equity / o.vestingYears) * (o.equityCliff <= 12 ? 1 : 0) : 0
  return o.base + o.bonus + o.signing + equityYear1 + benefitsValue(o)
}
function totalComp(o: Offer): number {
  return o.base + o.bonus + o.equity / Math.max(o.vestingYears, 1) + benefitsValue(o)
}
function adjustedComp(o: Offer): number { return totalComp(o) * (o.colAdjust || 1) }
function benefitsValue(o: Offer): number {
  const b = o.benefits
  return (b.health || 0) * 12 + (b.wfhStipend || 0) + (b.learningBudget || 0) + (b.gym || 0) +
    (b.dental ? 600 : 0) + (b.vision ? 200 : 0) +
    o.base * ((b.retirement401k || 0) / 100) * 0.5 // simplified employer match
}
function vestingSchedule(o: Offer): number[] {
  if (!o.equity || !o.vestingYears) return [0, 0, 0, 0]
  const annual = o.equity / o.vestingYears
  return [1, 2, 3, 4].map(yr => {
    if (o.equityCliff > yr * 12) return 0
    if (yr <= o.vestingYears) return annual
    return 0
  })
}

/* COL indices for common cities */
const COL_CITIES: { label: string; value: number }[] = [
  { label: "San Francisco, CA",  value: 0.78 },
  { label: "New York, NY",       value: 0.82 },
  { label: "Seattle, WA",        value: 0.87 },
  { label: "Austin, TX",         value: 0.95 },
  { label: "Chicago, IL",        value: 0.93 },
  { label: "Boston, MA",         value: 0.85 },
  { label: "Denver, CO",         value: 0.91 },
  { label: "Remote (US avg)",    value: 1.00 },
  { label: "Miami, FL",          value: 0.92 },
  { label: "Atlanta, GA",        value: 0.96 },
]

const EMPTY_OFFER = (): Offer => ({
  id: newId(), company: "", domain: "", role: "", location: "Remote (US avg)",
  remote: "remote", base: 0, bonus: 0, signing: 0, equity: 0, vestingYears: 4,
  equityCliff: 12, rsu: true, benefits: {
    health: 0, dental: true, vision: true, retirement401k: 4,
    pto: 15, wfhStipend: 0, learningBudget: 0, gym: 0,
  },
  visaSponsor: false, visaType: "", colAdjust: 1.0, notes: "", receivedAt: today(),
})

const SEED: Offer[] = [
  {
    id: "o1", company: "Palo Alto Networks", domain: "paloaltonetworks.com", role: "Senior Cloud Security Engineer",
    location: "San Francisco, CA", remote: "hybrid", base: 195000, bonus: 20000, signing: 25000,
    equity: 200000, vestingYears: 4, equityCliff: 12, rsu: true,
    benefits: { health: 0, dental: true, vision: true, retirement401k: 6, pto: 20, wfhStipend: 1200, learningBudget: 3000, gym: 600 },
    visaSponsor: true, visaType: "H1B", colAdjust: 0.78, notes: "Strong team, 4-day in-office policy", receivedAt: today(),
  },
  {
    id: "o2", company: "CrowdStrike", domain: "crowdstrike.com", role: "Principal Security Engineer",
    location: "Austin, TX", remote: "remote", base: 210000, bonus: 25000, signing: 15000,
    equity: 150000, vestingYears: 4, equityCliff: 12, rsu: true,
    benefits: { health: 0, dental: true, vision: true, retirement401k: 4, pto: 25, wfhStipend: 2000, learningBudget: 5000, gym: 1200 },
    visaSponsor: true, visaType: "H1B, GC", colAdjust: 0.95, notes: "Fully remote, great culture score", receivedAt: today(),
  },
]

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */
function NumberInput({ label, value, onChange, prefix = "$", suffix = "", step = 1000, note }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; step?: number; note?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e4e8ef", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        {prefix && <span style={{ padding: "0 8px", fontSize: 13, color: "#6b7a99", background: "#f8f9fc", borderRight: "1px solid #e4e8ef", height: "100%", display: "flex", alignItems: "center" }}>{prefix}</span>}
        <input type="number" value={value || ""} step={step} min={0}
          onChange={e => onChange(Number(e.target.value) || 0)}
          style={{ flex: 1, padding: "8px 10px", border: "none", outline: "none", fontSize: 13.5, color: "#1a2035", background: "transparent" }}/>
        {suffix && <span style={{ padding: "0 8px", fontSize: 12, color: "#6b7a99" }}>{suffix}</span>}
      </div>
      {note && <div style={{ fontSize: 11, color: "#aab3c5", marginTop: 3 }}>{note}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function ComparePage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Offer | null>(null)
  const [f, setF] = useState<Offer>(EMPTY_OFFER())
  const [aiRec, setAiRec]   = useState("")
  const [aiLoad, setAiLoad] = useState(false)
  const [tab, setTab]       = useState<"overview" | "equity" | "benefits" | "col">("overview")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("jd_compare_v1")
      setOffers(stored ? JSON.parse(stored) : SEED)
    } catch { setOffers(SEED) }
  }, [])
  useEffect(() => { localStorage.setItem("jd_compare_v1", JSON.stringify(offers)) }, [offers])

  function openAdd() { setEditing(null); setF(EMPTY_OFFER()); setShowForm(true) }
  function openEdit(o: Offer) { setEditing(o); setF({ ...o }); setShowForm(true) }
  function save() {
    if (!f.company.trim() || !f.base) return
    if (editing) setOffers(prev => prev.map(o => o.id === editing.id ? f : o))
    else setOffers(prev => [...prev, f])
    setShowForm(false)
  }
  function del(id: string) { setOffers(prev => prev.filter(o => o.id !== id)) }
  function setB(path: string, v: unknown) {
    const keys = path.split(".")
    setF(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      let node: Record<string, unknown> = copy
      for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]] as Record<string, unknown>
      node[keys[keys.length - 1]] = v
      return copy
    })
  }

  async function getAIRec() {
    if (!offers.length) return
    setAiLoad(true)
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    const summary = offers.map(o =>
      `${o.company} (${o.role}): base $${o.base.toLocaleString()}, bonus $${o.bonus.toLocaleString()}, equity $${o.equity.toLocaleString()} over ${o.vestingYears}yr, signing $${o.signing.toLocaleString()}, COL-adjusted total comp ~$${Math.round(adjustedComp(o)).toLocaleString()}, location: ${o.location}, remote: ${o.remote}, visa: ${o.visaSponsor ? o.visaType : "no"}, benefits value ~$${Math.round(benefitsValue(o)).toLocaleString()}/yr, notes: "${o.notes}"`
    ).join("\n")
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "offer_compare",
          instruction: "You are a career advisor helping a tech professional compare job offers. Provide a concise, direct recommendation (3-4 sentences max) on which offer to take and why, considering total comp, COL-adjusted value, visa sponsorship, equity risk, and career growth. Be specific — name the company you recommend.",
          current: summary,
          claudeKey,
        }),
      })
      const data = await res.json()
      setAiRec(data.result || data.text || data.content || "")
    } catch { setAiRec("Unable to get AI recommendation. Try again.") }
    setAiLoad(false)
  }

  /* ── ranking ── */
  const ranked = [...offers].sort((a, b) => adjustedComp(b) - adjustedComp(a))
  const best = ranked[0]
  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"]

  /* max values for bar scaling */
  const maxComp   = Math.max(...offers.map(o => totalComp(o)), 1)
  const maxAdj    = Math.max(...offers.map(o => adjustedComp(o)), 1)
  const maxBen    = Math.max(...offers.map(o => benefitsValue(o)), 1)
  const maxEquity = Math.max(...offers.map(o => o.equity), 1)

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>Offer Comparator</h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>Side-by-side breakdown of total comp, equity, and COL-adjusted value</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {offers.length >= 2 && (
            <button onClick={getAIRec} disabled={aiLoad}
              style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(29,111,196,0.07)", color: "var(--accent)", fontSize: 13.5, fontWeight: 700, border: "1.5px solid rgba(29,111,196,0.2)", cursor: "pointer" }}>
              {aiLoad ? "Thinking…" : "✨ AI Pick"}
            </button>
          )}
          <button onClick={openAdd}
            style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
            + Add Offer
          </button>
        </div>
      </div>

      {/* AI Recommendation */}
      {aiRec && (
        <div style={{ background: "rgba(29,111,196,0.04)", border: "1px solid rgba(29,111,196,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>✨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>AI Recommendation</div>
            <div style={{ fontSize: 13.5, color: "#1a2035", lineHeight: 1.65 }}>{aiRec}</div>
          </div>
          <button onClick={() => setAiRec("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#aab3c5", fontSize: 18, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {offers.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No offers to compare</div>
          <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 24 }}>Add 2+ offers to get a full breakdown</div>
          <button onClick={openAdd} style={{ padding: "10px 28px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>+ Add First Offer</button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f1f4f9", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
            {(["overview", "equity", "benefits", "col"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "6px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--accent)" : "#6b7a99",
                  boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {t === "overview" ? "📊 Overview" : t === "equity" ? "📈 Equity" : t === "benefits" ? "🎁 Benefits" : "🌍 COL Adjust"}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary cards row */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(offers.length, 4)}, 1fr)`, gap: 12 }}>
                {ranked.map((o, i) => {
                  const color = COLORS[i % COLORS.length]
                  const isBest = o.id === best?.id
                  return (
                    <div key={o.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isBest ? color + "55" : "#e4e8ef"}`, padding: "18px 20px", position: "relative", boxShadow: isBest ? `0 4px 20px ${color}18` : "none" }}>
                      {isBest && <div style={{ position: "absolute", top: -1, left: -1, right: -1, height: 3, background: color, borderRadius: "12px 12px 0 0" }}/>}
                      {isBest && <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 700, background: color + "18", color, padding: "2px 8px", borderRadius: 100 }}>🏆 Best Comp</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <img src={`https://logo.clearbit.com/${o.domain}`} width={28} height={28} style={{ borderRadius: 6, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1a2035" }}>{o.company}</div>
                          <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 1 }}>{o.remote === "remote" ? "🌐 Remote" : o.remote === "hybrid" ? "🔀 Hybrid" : "🏢 Onsite"}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: "-1px", lineHeight: 1 }}>{fmtK(o.base)}</div>
                      <div style={{ fontSize: 11.5, color: "#6b7a99", marginTop: 2, marginBottom: 12 }}>Base salary / year</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { label: "Bonus",   value: fmtK(o.bonus) },
                          { label: "Signing", value: fmtK(o.signing) },
                          { label: "Equity",  value: fmtK(o.equity) + ` / ${o.vestingYears}yr` },
                          { label: "Visa",    value: o.visaSponsor ? "✅ " + o.visaType : "❌ None" },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "#f8f9fc", borderRadius: 8, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a2035" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: "1px solid #f1f4f9" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: "#6b7a99" }}>Total Annual Comp</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color }}>~{fmtK(Math.round(totalComp(o)))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: "#6b7a99" }}>COL-Adjusted</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2035" }}>~{fmtK(Math.round(adjustedComp(o)))}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button onClick={() => openEdit(o)} style={{ flex: 1, padding: "7px", background: "transparent", border: "1px solid #e4e8ef", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#6b7a99" }}>Edit</button>
                        <button onClick={() => del(o.id)} style={{ padding: "7px 10px", background: "transparent", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12.5, cursor: "pointer", color: "#ef4444" }}>✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bar charts */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 16 }}>Total Comp vs. COL-Adjusted</div>
                {ranked.map((o, i) => {
                  const color = COLORS[i % COLORS.length]
                  const pct = (adjustedComp(o) / maxAdj) * 100
                  const pctRaw = (totalComp(o) / maxComp) * 100
                  return (
                    <div key={o.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035" }}>{o.company}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color }}>~{fmtK(Math.round(adjustedComp(o)))} adjusted</div>
                      </div>
                      {/* Raw comp bar */}
                      <div style={{ position: "relative", height: 10, background: "#f1f4f9", borderRadius: 100, marginBottom: 4, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pctRaw + "%", background: color + "44", borderRadius: 100, transition: "width .5s ease" }}/>
                      </div>
                      {/* Adjusted bar */}
                      <div style={{ position: "relative", height: 10, background: "#f1f4f9", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", background: color, borderRadius: 100, transition: "width .5s ease" }}/>
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, color: "#aab3c5" }}>░ Raw: ~{fmtK(Math.round(totalComp(o)))}</span>
                        <span style={{ fontSize: 10.5, color: "#aab3c5" }}>▓ COL-adjusted</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Year 1 vs. 4-yr timeline */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 16 }}>Compensation Timeline (4-year view)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f1f4f9" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: "#6b7a99", fontWeight: 600, fontSize: 12 }}>Company</th>
                        {["Year 1", "Year 2", "Year 3", "Year 4", "4-yr Total"].map(h => (
                          <th key={h} style={{ textAlign: "right", padding: "8px 12px", color: "#6b7a99", fontWeight: 600, fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((o, i) => {
                        const color = COLORS[i % COLORS.length]
                        const vesting = vestingSchedule(o)
                        const year1 = o.base + o.bonus + o.signing + vesting[0] + benefitsValue(o)
                        const year2 = o.base + o.bonus + vesting[1] + benefitsValue(o)
                        const year3 = o.base + o.bonus + vesting[2] + benefitsValue(o)
                        const year4 = o.base + o.bonus + vesting[3] + benefitsValue(o)
                        const total4 = year1 + year2 + year3 + year4
                        return (
                          <tr key={o.id} style={{ borderBottom: "1px solid #f8f9fc" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color }}>
                              {o.company}
                              <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 400 }}>{o.role.length > 28 ? o.role.slice(0, 25) + "…" : o.role}</div>
                            </td>
                            {[year1, year2, year3, year4].map((yr, j) => (
                              <td key={j} style={{ textAlign: "right", padding: "10px 12px", color: "#1a2035", fontWeight: 600 }}>{fmtK(Math.round(yr))}</td>
                            ))}
                            <td style={{ textAlign: "right", padding: "10px 12px", color, fontWeight: 800 }}>{fmtK(Math.round(total4))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: "#aab3c5", marginTop: 10 }}>* Includes base + bonus + vesting equity (with cliff) + signing (Year 1) + estimated benefits value</div>
              </div>
            </div>
          )}

          {/* ── EQUITY TAB ────────────────────────────────────────── */}
          {tab === "equity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 4 }}>Equity Vesting Schedule</div>
                <div style={{ fontSize: 13, color: "#6b7a99", marginBottom: 20 }}>RSUs/options vesting per year, accounting for cliff period</div>
                {ranked.map((o, i) => {
                  const color = COLORS[i % COLORS.length]
                  const vesting = vestingSchedule(o)
                  return (
                    <div key={o.id} style={{ marginBottom: 24, padding: "16px 18px", background: "#f8f9fc", borderRadius: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color }}>{o.company}</div>
                          <div style={{ fontSize: 12, color: "#6b7a99" }}>{o.rsu ? "RSU" : "Options"} · {o.vestingYears}-year vest · {o.equityCliff}-month cliff</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color }}>{fmtK(o.equity)}</div>
                          <div style={{ fontSize: 11, color: "#6b7a99" }}>Total grant</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {vesting.map((v, yr) => {
                          const pct = (v / maxEquity) * 100
                          return (
                            <div key={yr} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 6 }}>Year {yr + 1}</div>
                              <div style={{ height: 80, background: "#e4e8ef", borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", marginBottom: 6 }}>
                                <div style={{ width: "100%", height: Math.max((v / o.equity) * 100, 0) + "%", background: v > 0 ? color : "#d1d5db", borderRadius: 6, transition: "height .5s" }}/>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: v > 0 ? color : "#aab3c5" }}>{v > 0 ? fmtK(v) : "—"}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── BENEFITS TAB ──────────────────────────────────────── */}
          {tab === "benefits" && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 4 }}>Benefits Breakdown</div>
              <div style={{ fontSize: 13, color: "#6b7a99", marginBottom: 20 }}>Estimated annual dollar value of each benefit</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f1f4f9" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "#6b7a99", fontWeight: 600, fontSize: 12 }}>Benefit</th>
                      {ranked.map((o, i) => (
                        <th key={o.id} style={{ textAlign: "right", padding: "8px 12px", color: COLORS[i % COLORS.length], fontWeight: 700, fontSize: 12 }}>{o.company}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Health (emp contribution)", key: (o: Offer) => o.benefits.health > 0 ? fmt(o.benefits.health * 12) : "Covered" },
                      { label: "401k Match",                key: (o: Offer) => o.benefits.retirement401k + "%" },
                      { label: "PTO Days",                  key: (o: Offer) => o.benefits.pto + " days" },
                      { label: "WFH Stipend",               key: (o: Offer) => o.benefits.wfhStipend ? fmt(o.benefits.wfhStipend) + "/yr" : "—" },
                      { label: "Learning Budget",           key: (o: Offer) => o.benefits.learningBudget ? fmt(o.benefits.learningBudget) + "/yr" : "—" },
                      { label: "Gym / Wellness",            key: (o: Offer) => o.benefits.gym ? fmt(o.benefits.gym) + "/yr" : "—" },
                      { label: "Dental",                    key: (o: Offer) => o.benefits.dental ? "✅" : "❌" },
                      { label: "Vision",                    key: (o: Offer) => o.benefits.vision ? "✅" : "❌" },
                      { label: "Visa Sponsorship",          key: (o: Offer) => o.visaSponsor ? "✅ " + o.visaType : "❌" },
                    ].map(({ label, key }) => (
                      <tr key={label} style={{ borderBottom: "1px solid #f8f9fc" }}>
                        <td style={{ padding: "10px 12px", color: "#6b7a99", fontSize: 13 }}>{label}</td>
                        {ranked.map(o => (
                          <td key={o.id} style={{ textAlign: "right", padding: "10px 12px", color: "#1a2035", fontWeight: 600 }}>{key(o)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ background: "#f8f9fc", borderTop: "2px solid #e4e8ef" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1a2035", fontSize: 13 }}>Est. Total Benefits Value</td>
                      {ranked.map((o, i) => (
                        <td key={o.id} style={{ textAlign: "right", padding: "10px 12px", fontWeight: 800, color: COLORS[i % COLORS.length] }}>{fmtK(Math.round(benefitsValue(o)))}/yr</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COL TAB ───────────────────────────────────────────── */}
          {tab === "col" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "rgba(29,111,196,0.03)", border: "1px solid rgba(29,111,196,0.15)", borderRadius: 12, padding: "14px 18px", fontSize: 13.5, color: "#1a2035", lineHeight: 1.65 }}>
                💡 <strong>Cost of Living adjustment</strong> normalizes salaries across cities. A $200k salary in San Francisco has the same purchasing power as ~$156k in Austin. COL index = 1.00 means "Remote US average."
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 16 }}>COL-Adjusted Total Comp Ranking</div>
                {ranked.map((o, i) => {
                  const color = COLORS[i % COLORS.length]
                  const adj = adjustedComp(o)
                  const raw = totalComp(o)
                  const diff = adj - raw
                  const pct = (adj / maxAdj) * 100
                  return (
                    <div key={o.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "flex-end" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color }}>{i + 1}. {o.company}</div>
                          <div style={{ fontSize: 12, color: "#6b7a99" }}>{o.location} · COL factor: {o.colAdjust}×</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color }}>~{fmtK(Math.round(adj))}</div>
                          <div style={{ fontSize: 11.5, color: diff < 0 ? "#ef4444" : "#10b981" }}>
                            {diff < 0 ? "▼" : "▲"} {fmtK(Math.abs(Math.round(diff)))} vs raw
                          </div>
                        </div>
                      </div>
                      <div style={{ height: 12, background: "#f1f4f9", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 100, transition: "width .5s" }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e8ef", padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 14 }}>City COL Reference</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {COL_CITIES.map(c => (
                    <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8f9fc", borderRadius: 8 }}>
                      <span style={{ fontSize: 13, color: "#1a2035" }}>{c.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.value <= 0.85 ? "#ef4444" : c.value >= 0.98 ? "#10b981" : "#f59e0b" }}>{c.value}×</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ADD/EDIT FORM MODAL ─────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 20 }}>{editing ? "Edit Offer" : "Add Offer"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Company Name *</label>
                  <input value={f.company} onChange={e => setB("company", e.target.value)} placeholder="Palo Alto Networks" style={IS}/>
                </div>
                <div>
                  <label style={LS}>Domain (for logo)</label>
                  <input value={f.domain} onChange={e => setB("domain", e.target.value)} placeholder="paloaltonetworks.com" style={IS}/>
                </div>
              </div>
              <div>
                <label style={LS}>Role Title *</label>
                <input value={f.role} onChange={e => setB("role", e.target.value)} placeholder="Senior Cloud Security Engineer" style={IS}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Location</label>
                  <select value={f.location} onChange={e => {
                    const city = COL_CITIES.find(c => c.label === e.target.value)
                    setF(prev => ({ ...prev, location: e.target.value, colAdjust: city?.value || 1.0 }))
                  }} style={IS}>
                    {COL_CITIES.map(c => <option key={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Work Style</label>
                  <select value={f.remote} onChange={e => setB("remote", e.target.value)} style={IS}>
                    <option value="remote">🌐 Remote</option>
                    <option value="hybrid">🔀 Hybrid</option>
                    <option value="onsite">🏢 On-site</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", paddingTop: 4, borderTop: "1px solid #f1f4f9" }}>Compensation</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <NumberInput label="Base Salary *" value={f.base} onChange={v => setB("base", v)}/>
                <NumberInput label="Target Annual Bonus" value={f.bonus} onChange={v => setB("bonus", v)}/>
                <NumberInput label="Signing Bonus (one-time)" value={f.signing} onChange={v => setB("signing", v)}/>
                <NumberInput label="Total Equity Grant" value={f.equity} onChange={v => setB("equity", v)}/>
                <NumberInput label="Vesting Period (years)" value={f.vestingYears} onChange={v => setB("vestingYears", v)} prefix="" step={1}/>
                <NumberInput label="Cliff (months)" value={f.equityCliff} onChange={v => setB("equityCliff", v)} prefix="" step={6}/>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", paddingTop: 4, borderTop: "1px solid #f1f4f9" }}>Benefits</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <NumberInput label="Your health cost / month" value={f.benefits.health} onChange={v => setB("benefits.health", v)} note="0 = fully employer-covered"/>
                <NumberInput label="401k employer match %" value={f.benefits.retirement401k} onChange={v => setB("benefits.retirement401k", v)} prefix="" suffix="%" step={1}/>
                <NumberInput label="PTO Days" value={f.benefits.pto} onChange={v => setB("benefits.pto", v)} prefix="" suffix="days" step={1}/>
                <NumberInput label="WFH / Home Office Stipend" value={f.benefits.wfhStipend} onChange={v => setB("benefits.wfhStipend", v)}/>
                <NumberInput label="Learning / Cert Budget" value={f.benefits.learningBudget} onChange={v => setB("benefits.learningBudget", v)}/>
                <NumberInput label="Gym / Wellness" value={f.benefits.gym} onChange={v => setB("benefits.gym", v)}/>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[["dental", "Dental"], ["vision", "Vision"]].map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5, color: "#1a2035" }}>
                    <input type="checkbox" checked={f.benefits[key as keyof typeof f.benefits] as boolean}
                      onChange={e => setB(`benefits.${key}`, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: "pointer" }}/>
                    {label} included
                  </label>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", paddingTop: 4, borderTop: "1px solid #f1f4f9" }}>Visa</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5, color: "#1a2035" }}>
                  <input type="checkbox" checked={f.visaSponsor} onChange={e => setB("visaSponsor", e.target.checked)} style={{ width: 15, height: 15 }}/>
                  Sponsors visa
                </label>
                {f.visaSponsor && <input value={f.visaType} onChange={e => setB("visaType", e.target.value)} placeholder="H1B, GC..." style={{ ...IS, width: 180 }}/>}
              </div>

              <div>
                <label style={LS}>Notes</label>
                <textarea value={f.notes} onChange={e => setB("notes", e.target.value)} rows={2} placeholder="Culture, team, growth trajectory…"
                  style={{ ...IS, resize: "vertical", minHeight: 56 }}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} style={{ flex: 1, padding: "11px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editing ? "Save Changes" : "Add Offer"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 18px", background: "transparent", color: "#6b7a99", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LS: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 5 }
const IS: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" }
