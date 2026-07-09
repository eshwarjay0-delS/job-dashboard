"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// CoverLetterSection — inline cover-letter generator for the AI Tools hub.
// Same API (/api/cover-letter) the old modal used, but rendered as a page panel
// instead of an overlay. Reads job prefill (role/company/JD) from sessionStorage
// when arriving from a job card.
// ─────────────────────────────────────────────────────────────────────────────

// Read a one-shot prefill value left by a job card, then clear it so it doesn't
// leak into the next visit. Runs in a useState lazy initializer (client-only).
function consumePrefill(key: string): string {
  try {
    const v = sessionStorage.getItem(key)
    if (v) { sessionStorage.removeItem(key); return v }
  } catch {}
  return ""
}

type Tone = "professional" | "conversational" | "technical"

const TONE_LABELS: Record<Tone, { label: string; desc: string; icon: string }> = {
  professional:   { label: "Professional",   desc: "Polished, confident, formal",  icon: "👔" },
  conversational: { label: "Conversational", desc: "Warm, human, lightly casual",  icon: "💬" },
  technical:      { label: "Technical",      desc: "Tools-first, precise, outcomes", icon: "⚙️" },
}

export default function CoverLetterSection() {
  // Pre-fill from a job card if the user came via "Cover Letter" on a job.
  const [jd, setJd]           = useState(() => consumePrefill("jd_prefill_jd"))
  const [company, setCompany] = useState(() => consumePrefill("jd_prefill_company"))
  const [role, setRole]       = useState(() => consumePrefill("jd_prefill_role"))
  const [tone, setTone]       = useState<Tone>("professional")
  const [letter, setLetter]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [copied, setCopied]   = useState(false)

  async function generate() {
    if (!jd.trim() && !role.trim()) { setError("Add a job description or role title first."); return }
    setLoading(true); setError(""); setLetter("")
    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, company, role, tone, claudeKey }),
      })
      const data = await res.json()
      if (!data.letter) throw new Error(data.error || "No letter returned")
      setLetter(data.letter)
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""))
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const blob = new Blob([letter], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `Cover Letter${company ? ` — ${company}` : ""}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

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
            background: "linear-gradient(135deg,var(--accent-h),var(--accent))",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19,
          }}>✉️</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text, #1a2035)" }}>Cover Letter Generator</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted, #6b7a99)", marginTop: 1 }}>
              AI-written from your best-matching resume + the job description
            </div>
          </div>
        </div>

        {/* Company + Role */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>Company</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>Role</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Security Engineer" style={inputStyle} />
          </div>
        </div>

        {/* JD */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 6 }}>
            Job Description <span style={{ fontWeight: 400 }}>(optional, but makes it far better)</span>
          </label>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description…"
            rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Tone */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #6b7a99)", marginBottom: 8 }}>Tone</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.entries(TONE_LABELS) as [Tone, typeof TONE_LABELS[Tone]][]).map(([key, { label, desc, icon }]) => {
              const on = tone === key
              return (
                <button key={key} type="button" onClick={() => setTone(key)} style={{
                  flex: 1, textAlign: "left", padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                  background: on ? "var(--accent-soft)" : "var(--surface-2)",
                  boxShadow: on ? "0 0 0 1px var(--accent)" : "none", transition: "all .15s",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--accent-txt)" : "var(--text)" }}>{icon} {label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted, #6b7a99)", marginTop: 2 }}>{desc}</div>
                </button>
              )
            })}
          </div>
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
          background: loading ? "color-mix(in srgb, var(--accent) 55%, white)" : "linear-gradient(135deg,var(--accent),var(--accent-h))",
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {loading ? "Generating…" : letter ? "↻ Regenerate" : "✉ Generate Cover Letter"}
        </button>

        {/* Result */}
        {letter && (
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-muted, #6b7a99)" }}>
                Generated Letter
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleCopy} style={{
                  fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid var(--border, #e4e8ef)", background: "var(--surface-2, #f8f9fb)",
                  color: copied ? "var(--accent-txt)" : "var(--text-muted)",
                }}>{copied ? "✓ Copied!" : "Copy"}</button>
                <button onClick={handleDownload} style={{
                  fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid var(--border, #e4e8ef)", background: "var(--surface-2, #f8f9fb)",
                  color: "var(--text-muted, #6b7a99)",
                }}>↓ .txt</button>
              </div>
            </div>
            <div style={{
              borderRadius: 12, border: "1px solid var(--border, #e4e8ef)", background: "var(--surface-2, #f8f9fb)",
              padding: 18, fontSize: 13.5, color: "var(--text, #1a2035)", whiteSpace: "pre-wrap",
              fontFamily: "Georgia, serif", lineHeight: 1.8,
            }}>
              {letter}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
