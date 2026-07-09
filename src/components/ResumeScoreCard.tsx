"use client"

import { useState, useEffect } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// ResumeScoreCard
// Calls /api/score with resume text (from session storage or token preview),
// displays an ATS score ring, grade, top issues, and strengths.
//
// Props:
//   token    — tailor token (used to fetch preview HTML → extract text)
//   jd       — optional job description for JD-aware scoring
//   autoRun  — if true, scores immediately on mount (default false)
// ─────────────────────────────────────────────────────────────────────────────

interface Issue {
  severity: "critical" | "high" | "medium"
  problem: string
  fix: string
}

interface ScoreResult {
  score: number
  grade: string
  summary: string
  issues: Issue[]
  strengths: string[]
}

interface Props {
  token: string
  resumeName?: string
  jd?: string
  autoRun?: boolean
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#ca8a04",
}

const GRADE_COLOR: Record<string, string> = {
  A: "#059669",
  B: "#0d9488",
  C: "#1d4ed8",
  D: "#ea580c",
  F: "#dc2626",
}

export default function ResumeScoreCard({ token, resumeName, jd, autoRun = false }: Props) {
  const [result, setResult]   = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [expanded, setExpanded] = useState(false)

  async function runScore() {
    setLoading(true)
    setError("")
    try {
      // Get resume text from the preview HTML (strip tags) using the tailor token
      let resumeText = ""
      if (token) {
        const previewRes = await fetch(
          `/api/tailor/file?token=${encodeURIComponent(token)}&fmt=preview&name=${encodeURIComponent(resumeName || "resume")}`
        )
        if (previewRes.ok) {
          const html = await previewRes.text()
          // Strip HTML tags to get plain text
          const tmp = document.createElement("div")
          tmp.innerHTML = html
          resumeText = (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim()
        }
      }

      // Fall back to session storage
      if (!resumeText) {
        try {
          const raw = sessionStorage.getItem("careerkit_last_result")
          if (raw) {
            const r = JSON.parse(raw)
            const parts: string[] = []
            if (r.headline?.title)   parts.push(r.headline.title)
            if (r.headline?.tagline) parts.push(r.headline.tagline)
            if (r.summary)           parts.push(r.summary)
            if (Array.isArray(r.skills))  parts.push(...r.skills.map((s: { text: string }) => s.text))
            if (Array.isArray(r.bullets)) parts.push(...r.bullets.map((b: { text: string }) => b.text))
            resumeText = parts.join(" ")
          }
        } catch {}
      }

      if (!resumeText || resumeText.length < 80) {
        throw new Error("Could not read resume text for scoring.")
      }

      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jd: jd || "", claudeKey }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Score failed")
      setResult(data)
      setExpanded(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoRun && token) runScore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, token])

  const circumference = 2 * Math.PI * 36

  return (
    <div className="rounded-2xl border overflow-hidden transition-all"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4 justify-between"
        style={{ background: "var(--surface-2)", borderBottom: result ? "1px solid var(--border)" : "none" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
            🎯
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>ATS Resume Score</p>
            <p className="text-xs" style={{ color: "var(--text-soft)" }}>
              {result
                ? `${result.score}/100 · Grade ${result.grade} · ${result.issues.length} issue${result.issues.length !== 1 ? "s" : ""} found`
                : "AI-powered ATS compatibility & content quality check"}
            </p>
          </div>
        </div>

        {!result && !loading && (
          <button
            onClick={runScore}
            className="btn-accent px-4 py-2 text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
            Score Resume
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: "var(--text-soft)" }}>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Analyzing…
          </div>
        )}

        {result && (
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs flex items-center gap-1 flex-shrink-0"
            style={{ color: "var(--text-soft)" }}>
            {expanded ? "Hide" : "Show"}
            <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 text-xs" style={{ color: "#dc2626", background: "#fef2f2" }}>
          {error} — <button onClick={runScore} style={{ textDecoration: "underline" }}>Try again</button>
        </div>
      )}

      {/* Results */}
      {result && expanded && (
        <div className="p-5 space-y-5">

          {/* Score row */}
          <div className="flex items-center gap-5">
            {/* Ring */}
            <div className="relative flex-shrink-0 w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="36" fill="none" stroke="var(--border)" strokeWidth="7"/>
                <circle cx="42" cy="42" r="36" fill="none"
                  stroke={GRADE_COLOR[result.grade] || "#6366f1"} strokeWidth="7"
                  strokeDasharray={`${(result.score / 100) * circumference} ${circumference}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 1s cubic-bezier(.34,1.56,.64,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: "var(--text)", lineHeight: 1 }}>{result.score}</span>
                <span className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "var(--text-soft)" }}>/ 100</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-black" style={{ color: GRADE_COLOR[result.grade] || "#6366f1" }}>
                  {result.grade}
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {result.score >= 90 ? "Outstanding" : result.score >= 80 ? "Strong" : result.score >= 70 ? "Good" : result.score >= 60 ? "Fair" : "Needs Work"}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-soft)" }}>{result.summary}</p>
              <button onClick={runScore} className="mt-2 text-[11px] flex items-center gap-1"
                style={{ color: "var(--accent-txt)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Re-score
              </button>
            </div>
          </div>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>
                Strengths
              </p>
              <div className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex-shrink-0 text-sm">✓</span>
                    <span style={{ color: "var(--text)" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {result.issues.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>
                Issues to Fix
              </p>
              <div className="space-y-2">
                {result.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl border p-3"
                    style={{
                      borderColor: SEVERITY_COLOR[issue.severity] + "33",
                      background:  SEVERITY_COLOR[issue.severity] + "08",
                    }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{ background: SEVERITY_COLOR[issue.severity] + "20", color: SEVERITY_COLOR[issue.severity] }}>
                        {issue.severity}
                      </span>
                      <p className="text-xs font-semibold flex-1" style={{ color: "var(--text)" }}>{issue.problem}</p>
                    </div>
                    <p className="text-xs pl-0.5" style={{ color: "var(--text-soft)" }}>
                      <span style={{ color: SEVERITY_COLOR[issue.severity], fontWeight: 600 }}>Fix: </span>
                      {issue.fix}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
