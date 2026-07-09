"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// InterviewPrepPanel
// Slide-in panel that generates AI-powered interview prep for a specific
// interview (company + role + type). Calls /api/prep.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  company: string
  role: string
  interviewType: string
  interviewDate?: string
  notes?: string
  onClose: () => void
}

interface PrepResult {
  questions:      string[]
  tips:           string[]
  starPrompts:    string[]
  whatToResearch: string[]
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  phone:     { label: "Phone Screen",    icon: "📞", color: "#6366f1" },
  video:     { label: "Video Call",      icon: "🎥", color: "#0ea5e9" },
  technical: { label: "Technical Round", icon: "💻", color: "#8b5cf6" },
  onsite:    { label: "On-site",         icon: "🏢", color: "#f59e0b" },
  final:     { label: "Final Round",     icon: "🎯", color: "#10b981" },
}

const SECTION_CONFIG = [
  {
    key: "questions" as const,
    label: "Likely Questions",
    icon: "❓",
    color: "#6366f1",
    bg: "rgba(99,102,241,.06)",
    border: "rgba(99,102,241,.2)",
    desc: "Expected for this round at this company",
  },
  {
    key: "starPrompts" as const,
    label: "STAR Stories to Prepare",
    icon: "⭐",
    color: "#f59e0b",
    bg: "rgba(245,158,11,.06)",
    border: "rgba(245,158,11,.2)",
    desc: "Situation–Task–Action–Result frameworks tailored to this role",
  },
  {
    key: "tips" as const,
    label: "Tactical Prep Tips",
    icon: "⚡",
    color: "#10b981",
    bg: "rgba(16,185,129,.06)",
    border: "rgba(16,185,129,.2)",
    desc: "Specific to this company and interview type",
  },
  {
    key: "whatToResearch" as const,
    label: "What to Research",
    icon: "🔍",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,.06)",
    border: "rgba(14,165,233,.2)",
    desc: "Look these up before the interview",
  },
]

function Spin() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

export default function InterviewPrepPanel({ company, role, interviewType, interviewDate, notes, onClose }: Props) {
  const [result, setResult]   = useState<PrepResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const typeInfo = TYPE_LABELS[interviewType] || { label: interviewType, icon: "📋", color: "#6b7a99" }

  async function generate() {
    setLoading(true)
    setError("")
    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, interviewType, notes, claudeKey }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Prep failed")
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalItems = result
    ? result.questions.length + result.starPrompts.length + result.tips.length + result.whatToResearch.length
    : 0
  const doneCount = checked.size

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 z-50 h-full flex flex-col"
        style={{
          width: "min(480px, 100vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 48px rgba(0,0,0,.2)",
          animation: "slideInRight .25s cubic-bezier(.34,1.2,.64,1)",
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: typeInfo.color + "15", border: `1.5px solid ${typeInfo.color}30` }}>
                {typeInfo.icon}
              </div>
              <div>
                <p className="font-bold text-sm leading-snug" style={{ color: "var(--text)" }}>
                  {typeInfo.label} Prep
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>
                  {company} · {role}
                  {interviewDate && ` · ${new Date(interviewDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--surface-2)", color: "var(--text-soft)", border: "1px solid var(--border)" }}>
              ✕
            </button>
          </div>

          {/* Progress bar when result is shown */}
          {result && totalItems > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold" style={{ color: "var(--text-soft)" }}>Prep progress</p>
                <p className="text-[11px] font-bold" style={{ color: doneCount === totalItems ? "#059669" : "var(--accent-txt)" }}>
                  {doneCount}/{totalItems} done
                </p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(doneCount / totalItems) * 100}%`,
                    background: doneCount === totalItems
                      ? "linear-gradient(90deg, #059669, #10b981)"
                      : "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #7c3aed))",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: typeInfo.color + "12", border: `1.5px solid ${typeInfo.color}25` }}>
                {typeInfo.icon}
              </div>
              <div>
                <p className="font-bold" style={{ color: "var(--text)" }}>Ready to prep?</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-soft)" }}>
                  AI will generate likely questions, STAR prompts, tactical tips, and what to research — specific to {company} and this role.
                </p>
              </div>
              {error && (
                <div className="w-full rounded-xl px-4 py-3 text-xs text-left" style={{ background: "#fef2f2", color: "#dc2626" }}>
                  {error}
                </div>
              )}
              <button onClick={generate} className="btn-accent px-6 py-3 text-sm font-bold flex items-center gap-2 rounded-xl">
                ✨ Generate Prep Guide
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Spin />
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>Generating your prep guide…</p>
            </div>
          )}

          {result && (
            <div className="p-5 space-y-5">
              {SECTION_CONFIG.map(sec => {
                const items = result[sec.key]
                if (!items.length) return null
                return (
                  <div key={sec.key}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{sec.icon}</span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: sec.color }}>{sec.label}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>{sec.desc}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, i) => {
                        const id = `${sec.key}-${i}`
                        const done = checked.has(id)
                        return (
                          <button
                            key={i}
                            onClick={() => toggle(id)}
                            className="w-full text-left px-3.5 py-3 rounded-xl border flex items-start gap-3 transition-all"
                            style={{
                              background: done ? sec.bg : "var(--surface-2)",
                              borderColor: done ? sec.border : "var(--border)",
                              opacity: done ? 0.7 : 1,
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all"
                              style={{
                                borderColor: done ? sec.color : "var(--border)",
                                background:  done ? sec.color : "transparent",
                              }}
                            >
                              {done && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="1.5 6 4.5 9 10.5 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <p className="text-xs leading-relaxed flex-1"
                              style={{ color: "var(--text)", textDecoration: done ? "line-through" : "none" }}>
                              {item}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Regenerate */}
              <button onClick={generate}
                className="w-full py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text-soft)", background: "var(--surface-2)" }}>
                ↻ Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
