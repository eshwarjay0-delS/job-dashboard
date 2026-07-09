"use client"

import { useState, useEffect } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// MatchBreakdown — visual match score breakdown with donut + skill bars
// Props: jd (job description), profile (candidate data), loading (boolean)
// ─────────────────────────────────────────────────────────────────────────────

interface BreakdownData {
  total: number
  breakdown: { skills: number; experience: number; education: number; location: number }
  matchedSkills: string[]
  missingSkills: string[]
  aliasesUsed: string[]
  requiredSkills: string[]
  meta: { yearsRequired: number; educationRequired: string; locationRequired: string; seniority: string }
}

interface MatchBreakdownProps {
  jd: string
  profile?: {
    skills?: string[] | string
    yearsExp?: number | string
    location?: string
    education?: string
  }
  preloaded?: BreakdownData | null
}

const CATEGORIES = [
  { key: "skills",     label: "Skills Match",   weight: "45%", color: "#1d6fc4", rgb: "29,111,196" },
  { key: "experience", label: "Experience",      weight: "30%", color: "#7c3aed", rgb: "124,58,237" },
  { key: "education",  label: "Education",       weight: "15%", color: "#0d9488", rgb: "13,148,136" },
  { key: "location",   label: "Location",        weight: "10%", color: "#d97706", rgb: "217,119,6"  },
] as const

function DonutChart({ total, breakdown }: { total: number; breakdown: Record<string, number> }) {
  const size = 120
  const strokeW = 12
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r

  const colors = { skills: "#1d6fc4", experience: "#7c3aed", education: "#0d9488", location: "#d97706" }
  const weights = { skills: 0.45, experience: 0.30, education: 0.15, location: 0.10 }

  let offset = 0
  const segments = CATEGORIES.map(cat => {
    const pct = ((breakdown[cat.key] || 0) / 100) * weights[cat.key]
    const len = pct * circ
    const seg = { key: cat.key, color: colors[cat.key], dashArray: `${len} ${circ}`, dashOffset: -offset }
    offset += len
    return seg
  })

  const grade = total >= 90 ? "A" : total >= 80 ? "B" : total >= 70 ? "C" : total >= 60 ? "D" : "F"
  const gradeColor = total >= 80 ? "#059669" : total >= 65 ? "#1d4ed8" : total >= 50 ? "#d97706" : "#dc2626"

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
        {/* Segments */}
        {segments.map(seg => (
          <circle key={seg.key} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeW} strokeLinecap="round"
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            style={{ transition: "stroke-dasharray 1s cubic-bezier(.34,1.56,.64,1)" }}
          />
        ))}
      </svg>
      {/* Center label */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: gradeColor, lineHeight: 1, letterSpacing: "-1px" }}>{total}</span>
        <span style={{ fontSize: 10, color: "#9aa4bc", lineHeight: 1, marginTop: 1 }}>/ 100</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: gradeColor, marginTop: 2 }}>{grade}</span>
      </div>
    </div>
  )
}

function ScoreBar({ value, color, rgb }: { value: number; color: string; rgb: string }) {
  return (
    <div style={{ position: "relative", height: 5, background: `rgba(${rgb},.12)`, borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${value}%`, background: `linear-gradient(90deg, rgba(${rgb},.7), ${color})`,
        borderRadius: 3, transition: "width 1s cubic-bezier(.34,1.56,.64,1)",
      }} />
    </div>
  )
}

export default function MatchBreakdown({ jd, profile, preloaded }: MatchBreakdownProps) {
  const [data, setData] = useState<BreakdownData | null>(preloaded || null)
  const [loading, setLoading] = useState(!preloaded && !!jd)
  const [error, setError] = useState("")

  useEffect(() => {
    if (preloaded) { setData(preloaded); setLoading(false); return }
    if (!jd || jd.length < 50) { setLoading(false); return }

    setLoading(true)
    setError("")

    const profileSkills = Array.isArray(profile?.skills)
      ? profile.skills
      : typeof profile?.skills === "string"
      ? profile.skills.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      : []

    let key = ""
    try { key = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}

    fetch("/api/match-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jd,
        profile: {
          skills: profileSkills,
          yearsExp: profile?.yearsExp || 0,
          location: profile?.location || "",
          education: profile?.education || "",
        },
        claudeKey: key,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jd])

  if (loading) return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "#9aa4bc" }}>
      <div style={{ fontSize: 24, marginBottom: 8, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7a99" }}>Analyzing your fit…</p>
      <p style={{ fontSize: 11.5, marginTop: 4 }}>Extracting JD requirements · Comparing to your profile</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ padding: "24px 20px", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "#dc2626" }}>Could not compute breakdown.</p>
      <p style={{ fontSize: 11.5, color: "#9aa4bc", marginTop: 4 }}>Add an API key in Settings to enable AI scoring.</p>
    </div>
  )

  if (!data) return (
    <div style={{ padding: "24px 20px", textAlign: "center", color: "#9aa4bc", fontSize: 13 }}>
      No job description available for analysis.
    </div>
  )

  const { total, breakdown, matchedSkills, missingSkills, aliasesUsed, meta } = data

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Donut + summary */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <DonutChart total={total} breakdown={breakdown} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#9aa4bc", marginBottom: 10 }}>
            Score Breakdown
          </p>
          {CATEGORIES.map(cat => (
            <div key={cat.key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#374151" }}>
                  {cat.label}
                  <span style={{ fontSize: 10, color: "#9aa4bc", marginLeft: 5 }}>({cat.weight})</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: cat.color }}>{breakdown[cat.key]}%</span>
              </div>
              <ScoreBar value={breakdown[cat.key]} color={cat.color} rgb={cat.rgb} />
            </div>
          ))}
        </div>
      </div>

      {/* Meta info */}
      {meta && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          padding: "10px 12px", borderRadius: 10,
          background: "#f8f9fb", border: "1px solid #e4e8ef",
        }}>
          {[
            { label: "Seniority", value: meta.seniority || "Not specified" },
            { label: "Experience", value: meta.yearsRequired ? `${meta.yearsRequired}+ yrs` : "Not specified" },
            { label: "Education", value: meta.educationRequired || "Not specified" },
            { label: "Location", value: meta.locationRequired || "Flexible" },
          ].map(item => (
            <div key={item.label} style={{ textAlign: "center", flex: "1 1 70px" }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#9aa4bc" }}>{item.label}</p>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", marginTop: 1, textTransform: "capitalize" }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aliases used */}
      {aliasesUsed.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-txt)", marginBottom: 4 }}>Skill aliases matched:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {aliasesUsed.map(a => (
              <span key={a} style={{ padding: "2px 7px", borderRadius: 20, background: "var(--accent-soft)", color: "var(--accent-txt)", fontSize: 10, fontWeight: 600 }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Matched skills */}
      {matchedSkills.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#059669", marginBottom: 8 }}>
            ✓ {matchedSkills.length} Skills Matched
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {matchedSkills.map(s => (
              <span key={s} style={{
                padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d",
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Missing skills */}
      {missingSkills.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#dc2626", marginBottom: 8 }}>
            ✗ {missingSkills.length} Skills Missing
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {missingSkills.map(s => (
              <span key={s} style={{
                padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
              }}>{s}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#9aa4bc", marginTop: 8 }}>
            💡 Ask Nexus AI to suggest how to address these gaps.
          </p>
        </div>
      )}
    </div>
  )
}
