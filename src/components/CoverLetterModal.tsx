"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Cover Letter Modal
// Calls /api/cover-letter with JD + optional filepath, shows generated letter,
// lets user copy or download as .txt.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  jd?: string
  filepath?: string
  resumeName?: string
  onClose: () => void
}

type Tone = "professional" | "conversational" | "technical"

const TONE_LABELS: Record<Tone, { label: string; desc: string; icon: string }> = {
  professional:   { label: "Professional", desc: "Polished, confident, formal",     icon: "👔" },
  conversational: { label: "Conversational", desc: "Warm, human, lightly casual",   icon: "💬" },
  technical:      { label: "Technical",    desc: "Tools-first, precise, outcomes",  icon: "⚙️" },
}

export default function CoverLetterModal({ jd: initialJd = "", filepath = "", resumeName = "", onClose }: Props) {
  const [jd, setJd]           = useState(initialJd)
  const [company, setCompany] = useState("")
  const [role, setRole]       = useState("")
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
        body: JSON.stringify({ jd, company, role, tone, filepath, claudeKey }),
      })
      const data = await res.json()
      if (!data.letter) throw new Error(data.error || "No letter returned")
      setLetter(data.letter)
    } catch (e) {
      setError(String(e))
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          maxHeight: "90vh",
          boxShadow: "0 24px 64px rgba(0,0,0,.3)",
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b flex-shrink-0"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>
              ✉️
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Cover Letter Generator</p>
              <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                {resumeName ? `Grounded in: ${resumeName}` : "AI-written from your resume + JD"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--surface-2)", color: "var(--text-soft)" }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Company + Role row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-soft)" }}>Company</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Stripe"
                className="w-full text-sm px-3 py-2 rounded-xl border focus:outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-soft)" }}>Role</label>
              <input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior Security Engineer"
                className="w-full text-sm px-3 py-2 rounded-xl border focus:outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
          </div>

          {/* JD */}
          {!initialJd && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-soft)" }}>
                Job Description <span style={{ color: "var(--text-soft)", fontWeight: 400 }}>(optional but makes it much better)</span>
              </label>
              <textarea
                value={jd}
                onChange={e => setJd(e.target.value)}
                placeholder="Paste the job description…"
                rows={4}
                className="w-full text-sm px-3 py-2.5 rounded-xl border focus:outline-none resize-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
          )}

          {/* Tone selector */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-soft)" }}>Tone</label>
            <div className="flex gap-2">
              {(Object.entries(TONE_LABELS) as [Tone, typeof TONE_LABELS[Tone]][]).map(([key, { label, desc, icon }]) => {
                const on = tone === key
                return (
                  <button key={key} type="button" onClick={() => setTone(key)}
                    className="flex-1 rounded-xl border px-3 py-2.5 text-left transition-all"
                    style={on
                      ? { background: "var(--accent-soft)", borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }
                      : { background: "var(--surface-2)", borderColor: "var(--border)" }}>
                    <p className="text-xs font-bold" style={{ color: on ? "var(--accent-txt)" : "var(--text)" }}>
                      {icon} {label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-soft)" }}>{desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#fef2f2", color: "#dc2626" }}>
              {error}
            </div>
          )}

          {/* Generated letter */}
          {letter && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
                  Generated Letter
                </p>
                <div className="flex gap-2">
                  <button onClick={handleCopy}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5"
                    style={{ borderColor: "var(--border)", color: copied ? "#059669" : "var(--text-soft)", background: "var(--surface-2)" }}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button onClick={handleDownload}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5"
                    style={{ borderColor: "var(--border)", color: "var(--text-soft)", background: "var(--surface-2)" }}>
                    ↓ .txt
                  </button>
                </div>
              </div>
              <div
                className="rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)", fontFamily: "Georgia, serif", lineHeight: 1.8 }}>
                {letter}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-accent flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-xl"
            style={loading ? { opacity: 0.7 } : undefined}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating…
              </>
            ) : (
              <>{letter ? "↻ Regenerate" : "✉ Generate Cover Letter"}</>
            )}
          </button>
          {letter && (
            <button onClick={handleCopy}
              className="btn-outline px-5 py-3 text-sm font-semibold rounded-xl"
              style={{ color: copied ? "#059669" : undefined }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
