"use client"

import { useState, useEffect } from "react"

// ── SalaryInsights ─────────────────────────────────────────────────────────────
// Fetches salary data for a given role/company/location and renders a compact card.
// Props: role, company, location — any can be omitted.
// ─────────────────────────────────────────────────────────────────────────────

interface SalaryData {
  base: { low: number; mid: number; high: number }
  bonus: { low: number; mid: number; high: number }
  equity_annual: { low: number; mid: number; high: number }
  tc: { low: number; mid: number; high: number }
  level_note: string
  data_sources: string[]
  negotiation_tips: string[]
  market_note: string
  h1b_note: string
  fallback?: boolean
}

function fmt(n: number) {
  if (!n) return "—"
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n.toLocaleString()}`
}

function RangeBar({ low, mid, high, color }: { low: number; mid: number; high: number; color: string }) {
  const total = high || 1
  const lowPct = (low / total) * 100
  const midPct = ((mid - low) / total) * 100
  const highPct = ((high - mid) / total) * 100
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, overflow: "hidden", background: "#f1f5f9", display: "flex" }}>
        <div style={{ width: `${lowPct}%`, background: "#e2e8f0" }} />
        <div style={{ width: `${midPct}%`, background: color, opacity: 0.7 }} />
        <div style={{ width: `${highPct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function SalaryInsights({
  role, company, location,
}: {
  role: string; company?: string; location?: string
}) {
  const [data, setData] = useState<SalaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [fetched, setFetched] = useState(false)

  async function load() {
    if (fetched) return
    setLoading(true)
    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
      const params = new URLSearchParams({ role })
      if (company) params.set("company", company)
      if (location) params.set("location", location)
      const res = await fetch(`/api/salary?${params}`, {
        headers: claudeKey ? { "x-claude-key": claudeKey } : {},
      })
      const d = await res.json()
      setData(d)
      setFetched(true)
    } catch { /* salary data is a nice-to-have */ }
    setLoading(false)
  }

  function handleToggle() {
    if (!open && !fetched) load()
    setOpen(v => !v)
  }

  return (
    <div style={{ borderRadius: 12, border: "1px solid #e4e8ef", overflow: "hidden", background: "#fff" }}>
      <button
        onClick={handleToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", lineHeight: 1.2 }}>Salary Intelligence</p>
            <p style={{ fontSize: 11, color: "#6b7a99", lineHeight: 1.2 }}>
              {data ? `${fmt(data.tc.low)} – ${fmt(data.tc.high)} TC` : "Market range for this role"}
            </p>
          </div>
        </div>
        <div style={{
          fontSize: 12, color: open ? "var(--accent)" : "var(--text-soft)",
          transform: open ? "rotate(180deg)" : "none", transition: "transform .2s",
        }}>▾</div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#9aa4bc", fontSize: 12 }}>
              <div style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 6 }}>⟳</div>
              <p>Loading salary data…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
            </div>
          ) : data ? (
            <>
              {/* TC banner */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10,
                background: "linear-gradient(135deg,#eff6ff,#f5f3ff)",
                border: "1px solid #bfdbfe",
              }}>
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#6b7a99" }}>Total Comp</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)", letterSpacing: "-1px" }}>
                    {fmt(data.tc.mid)} <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7a99" }}>/ yr</span>
                  </p>
                  <p style={{ fontSize: 11, color: "#9aa4bc" }}>{fmt(data.tc.low)} – {fmt(data.tc.high)} range</p>
                </div>
                {data.level_note && (
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "var(--accent-soft)", color: "var(--accent-txt)", border: "1px solid var(--accent-border)", fontWeight: 600 }}>
                      {data.level_note}
                    </span>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              {[
                { label: "Base Salary",    d: data.base,          color: "var(--accent)" },
                { label: "Annual Bonus",   d: data.bonus,         color: "#16a34a" },
                { label: "Equity (Annual)",d: data.equity_annual, color: "#7c3aed" },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#374151" }}>{row.label}</span>
                    <span style={{ fontSize: 11.5, color: row.color, fontWeight: 700 }}>
                      {fmt(row.d.low)} – {fmt(row.d.high)}
                    </span>
                  </div>
                  <RangeBar low={row.d.low} mid={row.d.mid} high={row.d.high} color={row.color} />
                </div>
              ))}

              {/* H1B note */}
              {data.h1b_note && (
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "var(--accent-soft)", border: "1px solid var(--accent-border)", fontSize: 11.5, color: "var(--accent-txt)" }}>
                  🛂 {data.h1b_note}
                </div>
              )}

              {/* Negotiation tips */}
              {data.negotiation_tips?.length > 0 && (
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#9aa4bc", marginBottom: 6 }}>Negotiation Tips</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.negotiation_tips.map((tip, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11.5, color: "#374151" }}>
                        <span style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Market note */}
              {data.market_note && (
                <p style={{ fontSize: 11, color: "#6b7a99", borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                  📈 {data.market_note}
                </p>
              )}

              {/* Sources */}
              {data.data_sources?.length > 0 && (
                <p style={{ fontSize: 10, color: "#9aa4bc" }}>
                  Sources: {data.data_sources.join(", ")}
                  {data.fallback ? " · Estimated ranges" : ""}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: "#9aa4bc", textAlign: "center", padding: "8px 0" }}>
              Could not load salary data. Add an API key in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
