"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// InterviewSection — inline interview-prep generator for the AI Tools hub.
// Same API (/api/prep) the old slide-in panel used, rendered as a page panel.
// Reads job prefill (role/company) from sessionStorage when arriving from a job.
// ─────────────────────────────────────────────────────────────────────────────

// Read a one-shot prefill value left by a job card, then clear it. Runs in a
// useState lazy initializer (client-only).
function consumePrefill(key: string): string {
  try {
    const v = sessionStorage.getItem(key)
    if (v) { sessionStorage.removeItem(key); return v }
  } catch {}
  return ""
}

type InterviewType = "phone" | "video" | "technical" | "onsite" | "final"

const TYPE_LABELS: Record<InterviewType, { label: string; icon: string }> = {
  phone:     { label: "Phone Screen",    icon: "📞" },
  video:     { label: "Video Call",      icon: "🎥" },
  technical: { label: "Technical Round", icon: "💻" },
  onsite:    { label: "On-site",         icon: "🏢" },
  final:     { label: "Final Round",     icon: "🎯" },
}

interface PrepResult {
  questions: string[]; tips: string[]; starPrompts: string[]; whatToResearch: string[]
}

const SECTIONS = [
  { key: "questions"      as const, label: "Likely Questions",          icon: "❓", color: "#6366f1", desc: "Expected for this round at this company" },
  { key: "starPrompts"    as const, label: "STAR Stories to Prepare",   icon: "⭐", color: "#f59e0b", desc: "Situation–Task–Action–Result frameworks for this role" },
  { key: "tips"           as const, label: "Tactical Prep Tips",        icon: "⚡", color: "#3b82f6", desc: "Specific to this company and interview type" },
  { key: "whatToResearch" as const, label: "What to Research",          icon: "🔍", color: "#0ea5e9", desc: "Look these up before the interview" },
]

export default function InterviewSection() {
  const [company, setCompany]   = useState(() => consumePrefill("jd_prefill_company"))
  const [role, setRole]         = useState(() => consumePrefill("jd_prefill_role"))
  const [type, setType]         = useState<InterviewType>("video")
  const [notes, setNotes]       = useState("")
  const [result, setResult]     = useState<PrepResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [checked, setChecked]   = useState<Set<string>>(new Set())

  async function generate() {
    if (!company.trim() && !role.trim()) { setError("Add a company or role first."); return }
    setLoading(true); setError(""); setResult(null); setChecked(new Set())
    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, interviewType: type, notes, claudeKey }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Prep failed")
      setResult(data)
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""))
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const totalItems = result ? result.questions.length + result.starPrompts.length + result.tips.length + result.whatToResearch.length : 0

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border, #e4e8ef)", background: "var(--surface-2, #f8f9fb)",
    color: "var(--text, #1a2035)", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{
        background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e8ef)",
        borderRadius: 20, padding: "26px 28px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19,
          }}>🎤</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text, #1a2035)" }}>Interview Prep</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted, #6b7a99)", marginTop: 1 }}>
              AI-generated questions, STAR prompts, tips & research — specific to the company and round
            </div>
          </div>
        </div>

        {/* Company + Role */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>Company</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. CrowdStrike" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>Role</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. DevSecOps Engineer" style={inputStyle} />
          </div>
        </div>

        {/* Interview type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 8 }}>Interview Type</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(Object.entries(TYPE_LABELS) as [InterviewType, typeof TYPE_LABELS[InterviewType]][]).map(([key, { label, icon }]) => {
              const on = type === key
              return (
                <button key={key} type="button" onClick={() => setType(key)} style={{
                  padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${on ? "#7c3aed" : "var(--border, #e4e8ef)"}`,
                  background: on ? "rgba(124,58,237,.07)" : "var(--surface-2, #f8f9fb)",
                  color: on ? "#6d28d9" : "var(--text-muted, #6b7a99)", transition: "all .15s",
                }}>{icon} {label}</button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>
            Notes <span style={{ fontWeight: 400 }}>(optional — anything you know about the round)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 45 min with the hiring manager, focus on Kubernetes…"
            rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, fontSize: 12.5,
            background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.2)", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* Generate */}
        <button onClick={generate} disabled={loading} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none",
          background: loading ? "#c4abe9" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        }}>
          {loading ? "Generating prep guide…" : result ? "↻ Regenerate" : "✨ Generate Prep Guide"}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 22 }}>
            {totalItems > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)" }}>Prep progress</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: checked.size === totalItems ? "var(--success)" : "var(--accent)" }}>
                    {checked.size}/{totalItems} done
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "var(--border, #e4e8ef)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(checked.size / totalItems) * 100}%`, borderRadius: 4,
                    background: checked.size === totalItems ? "linear-gradient(90deg,var(--success),var(--accent))" : "linear-gradient(90deg,#7c3aed,var(--accent))",
                    transition: "width .4s" }}/>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {SECTIONS.map(sec => {
                const items = result[sec.key]
                if (!items.length) return null
                return (
                  <div key={sec.key}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 15 }}>{sec.icon}</span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: sec.color }}>{sec.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted, #6b7a99)" }}>{sec.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {items.map((item, i) => {
                        const id = `${sec.key}-${i}`
                        const done = checked.has(id)
                        return (
                          <button key={i} onClick={() => toggle(id)} style={{
                            width: "100%", textAlign: "left", padding: "10px 13px", borderRadius: 10, cursor: "pointer",
                            display: "flex", alignItems: "flex-start", gap: 11, transition: "all .15s",
                            border: `1px solid ${done ? sec.color + "40" : "var(--border, #e4e8ef)"}`,
                            background: done ? sec.color + "10" : "var(--surface-2, #f8f9fb)", opacity: done ? 0.75 : 1,
                          }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: `2px solid ${done ? sec.color : "var(--border, #d0d7e3)"}`,
                              background: done ? sec.color : "transparent",
                            }}>
                              {done && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="1.5 6 4.5 9 10.5 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </span>
                            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text, #1a2035)", textDecoration: done ? "line-through" : "none" }}>
                              {item}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
