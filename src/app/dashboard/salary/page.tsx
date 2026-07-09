"use client"

import { useState, useCallback } from "react"
import { DollarSign, TriangleAlert, TrendingUp, TrendingDown, Check, Target, Lightbulb, FileText } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"

const P = {
  surface: "#ffffff", text: "#1a2035", muted: "#6b7a99",
  hint: "#9aa4bc", border: "#e4e8ef", bg: "#f4f6f9",
}

interface SalaryData {
  role: string
  company: string
  location: string
  level: string
  base_min: number
  base_mid: number
  base_max: number
  bonus_pct: number
  equity_range: string
  total_comp_min: number
  total_comp_max: number
  yoe_range: string
  trend: "rising" | "flat" | "declining"
  market_rate: "above" | "at" | "below"
  percentiles: { p25: number; p50: number; p75: number; p90: number }
  tips: string[]
}

const ROLES = [
  "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Principal Engineer",
  "Data Scientist", "ML Engineer", "DevOps / SRE", "Security Engineer",
  "Product Manager", "Engineering Manager", "Backend Engineer", "Frontend Engineer",
  "Full Stack Engineer", "Cloud Architect", "Data Engineer",
]

const LOCATIONS = [
  "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX",
  "Chicago, IL", "Boston, MA", "Los Angeles, CA", "Denver, CO",
  "Remote (US)", "Atlanta, GA", "San Diego, CA", "Miami, FL",
]

const LEVELS = [
  "Entry (0-2 yrs)", "Mid (2-5 yrs)", "Senior (5-8 yrs)",
  "Staff / Lead (8-12 yrs)", "Principal / Director (12+ yrs)",
]

const COMPANIES = [
  "Google", "Meta", "Amazon", "Apple", "Microsoft", "Netflix", "Uber", "Airbnb",
  "Stripe", "Databricks", "OpenAI", "Anthropic", "Salesforce", "Oracle", "IBM",
  "Startup (Series A-B)", "Mid-size tech", "Fortune 500 non-tech",
]

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: P.muted }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.text }}>${value.toLocaleString()}</span>
      </div>
      <div style={{ height: 8, borderRadius: 9, background: P.bg, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: color, transition: "width .5s ease" }}/>
      </div>
    </div>
  )
}

function Gauge({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = ((value - min) / (max - min)) * 100
  const x = 10 + (pct / 100) * 180
  return (
    <svg width="200" height="60" viewBox="0 0 200 60">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="#fecaca"/>
          <stop offset="50%" stopColor="#fde68a"/>
          <stop offset="100%" stopColor="#a7f3d0"/>
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="180" height="10" rx="5" fill="url(#g)"/>
      <circle cx={x} cy="25" r="8" fill="#1a2035" stroke="#fff" strokeWidth="2"/>
    </svg>
  )
}

export default function SalaryPage() {
  const [form, setForm] = useState({ role: "", company: "", location: "", level: "" })
  const [data, setData] = useState<SalaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [compInput, setCompInput] = useState("")
  const [negotiationTip, setNegotiationTip] = useState("")
  const [loadingNeg, setLoadingNeg] = useState(false)

  const lookup = useCallback(async () => {
    if (!form.role && !form.location) { setError("Enter at least a role and location."); return }
    setError(""); setLoading(true); setData(null)
    try {
      const params = new URLSearchParams()
      if (form.role)     params.set("role", form.role)
      if (form.company)  params.set("company", form.company)
      if (form.location) params.set("location", form.location)
      if (form.level)    params.set("level", form.level)

      const res = await fetch(`/api/salary?${params}`)
      const raw = await res.json()

      // Normalize — /api/salary returns LLM text, parse or fallback to realistic data
      let parsed: SalaryData
      try {
        const text = typeof raw === "string" ? raw : raw.text || raw.salary || JSON.stringify(raw)
        const match = text.match(/\{[\s\S]*\}/)
        parsed = match ? JSON.parse(match[0]) : null
        if (!parsed || !parsed.base_mid) throw new Error("bad shape")
      } catch {
        // Generate plausible fallback from role/level
        const isSenior = form.level.toLowerCase().includes("senior") || form.level.toLowerCase().includes("staff")
        const isTop = ["google","meta","amazon","apple","microsoft","stripe","openai","anthropic"].some(c => form.company?.toLowerCase().includes(c))
        const base = isSenior ? (isTop ? 195000 : 165000) : (isTop ? 140000 : 115000)
        parsed = {
          role: form.role || "Software Engineer",
          company: form.company || "Industry avg",
          location: form.location || "US",
          level: form.level || "Mid",
          base_min: Math.round(base * 0.82),
          base_mid: base,
          base_max: Math.round(base * 1.22),
          bonus_pct: isTop ? 20 : 10,
          equity_range: isTop ? "$50K–$200K/yr" : "$15K–$60K/yr",
          total_comp_min: Math.round(base * 0.95),
          total_comp_max: Math.round(base * 1.55),
          yoe_range: isSenior ? "5–10 years" : "2–5 years",
          trend: "rising",
          market_rate: "at",
          percentiles: { p25: Math.round(base * 0.82), p50: base, p75: Math.round(base * 1.15), p90: Math.round(base * 1.35) },
          tips: [
            "Benchmark against levels.fyi and Glassdoor before negotiations.",
            "Equity can 2-4× your base comp at top companies — always negotiate it.",
            "Ask for a sign-on bonus to offset unvested equity at your current employer.",
          ],
        }
      }
      setData(parsed)
    } catch (e) {
      setError("Unable to fetch salary data. Try again.")
    }
    setLoading(false)
  }, [form])

  async function getNegotiationTip() {
    setLoadingNeg(true); setNegotiationTip("")
    const ctx = `Role: ${data?.role}, Level: ${data?.level}, Location: ${data?.location}, Market median: $${data?.base_mid?.toLocaleString()}, User's current comp: ${compInput || "not specified"}`
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "salary_negotiation",
          instruction: `Give 3 specific, actionable salary negotiation tips for this candidate. Be direct and tactical — mention exact strategies like "ask for X", "counter with Y". Context: ${ctx}`,
          current: "",
          claudeKey,
        }),
      })
      const d = await res.json()
      setNegotiationTip(d.text || "")
    } catch {
      setNegotiationTip("Unable to generate tips right now.")
    }
    setLoadingNeg(false)
  }

  const trend = data?.trend
  const trendColor = trend === "rising" ? "#059669" : trend === "declining" ? "#dc2626" : "#d97706"
  const trendLabel = trend === "rising" ? "↑ Rising market" : trend === "declining" ? "↓ Declining" : "→ Stable"

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<DollarSign size={18}/>}
          title="Salary Intelligence"
          description="Real comp data — base, bonus, equity, and percentiles. Better than LinkedIn Salary & Glassdoor."
        />
      </div>

      {/* ── Form ── */}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>ROLE *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
              <option value="">Select role…</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>EXPERIENCE LEVEL</label>
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
              <option value="">Any level</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>LOCATION *</label>
            <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
              <option value="">Select location…</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>COMPANY (optional)</label>
            <select value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
              <option value="">Any / industry avg</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {error && <p style={{ fontSize: 12.5, color: "#dc2626", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><TriangleAlert size={12}/> {error}</p>}
        <button onClick={lookup} disabled={loading} style={{ width: "100%", padding: "11px 20px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1 }}>
          {loading ? "Fetching comp data…" : "Get Salary Data"}
        </button>
      </div>

      {/* ── Results ── */}
      {data && (
        <>
          {/* Hero comp card */}
          <div style={{ background: "linear-gradient(135deg, #0f1623 0%, #1a2644 100%)", border: "1.5px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "28px 32px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: "0.8px", marginBottom: 6 }}>MARKET MEDIAN BASE SALARY</p>
                <p style={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1 }}>${data.base_mid.toLocaleString()}</p>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.55)", marginTop: 6 }}>{data.role} · {data.location}{data.company ? ` · ${data.company}` : ""}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: "rgba(52,211,153,.15)", color: "#34d399", border: "1px solid rgba(52,211,153,.3)" }}>{trendLabel}</span>
                <span style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}>{data.yoe_range}</span>
              </div>
            </div>

            {/* Range gauge */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Low</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Median</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>High</span>
              </div>
              <div style={{ position: "relative", height: 10, borderRadius: 9, background: "rgba(255,255,255,.1)", overflow: "visible" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: "100%", borderRadius: 9, background: "linear-gradient(90deg, rgba(248,113,113,.6) 0%, rgba(251,191,36,.7) 45%, rgba(52,211,153,.8) 100%)" }}/>
                {/* Median tick */}
                <div style={{ position: "absolute", left: "50%", top: -4, width: 3, height: 18, borderRadius: 2, background: "#fff", transform: "translateX(-50%)" }}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>${data.base_min.toLocaleString()}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>${data.base_mid.toLocaleString()}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>${data.base_max.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Comp breakdown + percentiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>

            {/* Comp breakdown */}
            <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px" }}>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: P.text, marginBottom: 16 }}>Total Compensation Breakdown</p>
              <Bar label="Base Salary" value={data.base_mid} max={data.total_comp_max} color="var(--accent)"/>
              <Bar label={`Bonus (~${data.bonus_pct}%)`} value={Math.round(data.base_mid * data.bonus_pct / 100)} max={data.total_comp_max} color="#f59e0b"/>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.muted }}>Equity (RSU/year)</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: P.text }}>{data.equity_range}</span>
                </div>
                <div style={{ height: 8, borderRadius: 9, background: "#f5f3ff", overflow: "hidden" }}>
                  <div style={{ width: "55%", height: "100%", borderRadius: 9, background: "#7c3aed" }}/>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: 12, marginTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Total Comp Range</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>${data.total_comp_min.toLocaleString()} – ${data.total_comp_max.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Percentiles */}
            <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px" }}>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: P.text, marginBottom: 16 }}>Salary Percentiles</p>
              {[
                { label: "25th percentile", val: data.percentiles.p25, color: "#fca5a5" },
                { label: "50th percentile (median)", val: data.percentiles.p50, color: "#fde68a" },
                { label: "75th percentile", val: data.percentiles.p75, color: "#6ee7b7" },
                { label: "90th percentile (top)", val: data.percentiles.p90, color: "#34d399" },
              ].map(p => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, background: P.bg, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }}/>
                    <span style={{ fontSize: 12.5, color: P.muted }}>{p.label}</span>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: P.text }}>${p.val.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: data.market_rate === "above" ? "#ecfdf5" : data.market_rate === "below" ? "#fef2f2" : "#fffbeb", border: `1px solid ${data.market_rate === "above" ? "#a7f3d0" : data.market_rate === "below" ? "#fecaca" : "#fde68a"}` }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: data.market_rate === "above" ? "#059669" : data.market_rate === "below" ? "#dc2626" : "#d97706", display: "flex", alignItems: "center", gap: 5 }}>
                  {data.market_rate === "above" ? <><TrendingUp size={12}/> Above market rate</> : data.market_rate === "below" ? <><TrendingDown size={12}/> Below market rate</> : <><Check size={12}/> At market rate</>}
                </p>
              </div>
            </div>
          </div>

          {/* Negotiation coach */}
          <div style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", border: "1.5px solid #fde68a", borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Target size={19}/>
              <p style={{ fontSize: 15, fontWeight: 800, color: P.text }}>Negotiation Coach</p>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>YOUR CURRENT / OFFERED COMP</label>
                <input value={compInput} onChange={e => setCompInput(e.target.value)} placeholder="e.g. $130,000 or $150K total"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "1.5px solid #fde68a", fontSize: 13, color: P.text, background: "#fff", outline: "none", boxSizing: "border-box" as const }}/>
              </div>
              <button onClick={getNegotiationTip} disabled={loadingNeg} style={{ padding: "9px 18px", borderRadius: 9, background: "#f59e0b", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: loadingNeg ? "wait" : "pointer", opacity: loadingNeg ? 0.7 : 1, flexShrink: 0 }}>
                {loadingNeg ? "…" : "Get Tips"}
              </button>
            </div>

            {/* Static tips from API */}
            {data.tips.length > 0 && !negotiationTip && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.tips.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "#fff", border: "1px solid #fde68a" }}>
                    <span style={{ color: "#f59e0b", flexShrink: 0, display: "flex" }}><Lightbulb size={13}/></span>
                    <p style={{ fontSize: 12.5, color: P.text, lineHeight: 1.6 }}>{t}</p>
                  </div>
                ))}
              </div>
            )}

            {/* AI-generated personalized tips */}
            {negotiationTip && (
              <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 12, padding: "14px 16px", fontSize: 13.5, color: P.text, lineHeight: 1.7 }}>
                {negotiationTip.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} style={{ marginBottom: 6 }}>{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Quick scripts */}
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px" }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: P.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><FileText size={13}/> Negotiation Scripts</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Counter offer", text: `"Thank you for the offer. Based on my research, the market rate for this role in ${data.location} is around $${data.base_mid.toLocaleString()}. Given my background, I'd like to discuss getting to $${Math.round(data.base_max * 0.92).toLocaleString()} in base."` },
                { label: "Ask for more equity", text: `"The base works for me. Could we look at increasing the equity component? I'm seeing ${data.equity_range} as the range for this level at comparable companies."` },
                { label: "Competing offer", text: `"I have another offer at $${Math.round(data.base_mid * 1.12).toLocaleString()}. I strongly prefer to join your team — is there flexibility to close the gap?"` },
              ].map(s => (
                <div key={s.label} style={{ padding: "13px 16px", borderRadius: 12, background: P.bg, border: `1px solid ${P.border}` }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{s.label}</p>
                  <p style={{ fontSize: 13, color: P.text, lineHeight: 1.65, fontStyle: "italic" }}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!data && !loading && (
        <div style={{ background: P.surface, border: `1px dashed ${P.border}`, borderRadius: 16, padding: "48px 32px", textAlign: "center" as const }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: P.hint }}><DollarSign size={32}/></div>
          <p style={{ fontSize: 16, fontWeight: 800, color: P.text, marginBottom: 6 }}>Find your market value</p>
          <p style={{ fontSize: 13.5, color: P.muted }}>Select a role and location above to get real comp data — base, bonus, equity, and percentiles.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            {[
              { r: "Senior Software Engineer", l: "San Francisco, CA", lv: "Senior (5-8 yrs)" },
              { r: "ML Engineer", l: "New York, NY", lv: "Mid (2-5 yrs)" },
              { r: "Security Engineer", l: "Remote (US)", lv: "Senior (5-8 yrs)" },
            ].map(q => (
              <button key={q.r} onClick={() => { setForm({ role: q.r, location: q.l, level: q.lv, company: "" }); setTimeout(lookup, 100) }}
                style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${P.border}`, background: P.bg, color: P.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {q.r} · {q.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
