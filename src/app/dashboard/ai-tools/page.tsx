"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import PageHeader from "@/components/layout/PageHeader"
import { Sparkles, Mail, Mic, BarChart3, Check, TriangleAlert } from "lucide-react"

// Lazy load inline section components (NOT the modal overlays or redirect pages).
// These render as in-page panels with their own inputs.
const CoverLetterSection = dynamic(() => import("./CoverLetterSection"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Cover Letters" />,
})
const InterviewSection = dynamic(() => import("./InterviewSection"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Interview Prep" />,
})

// ── Types ─────────────────────────────────────────────────────────────────────
type AITab = "tailor" | "cover" | "interviews" | "score"

const TABS: { id: AITab; label: string; Icon: typeof Sparkles; desc: string }[] = [
  { id: "tailor",     label: "Tailor Resume",   Icon: Sparkles,  desc: "Match your resume to any job description" },
  { id: "cover",      label: "Cover Letter",     Icon: Mail,      desc: "AI-written cover letters in seconds" },
  { id: "interviews", label: "Interview Prep",   Icon: Mic,       desc: "AI prep questions & tips for your interviews" },
  { id: "score",      label: "AI Resume Score",  Icon: BarChart3, desc: "Score and improve your resume instantly" },
]

// ── Skeleton loader ───────────────────────────────────────────────────────────
function PanelSkeleton({ label }: { label: string }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "#9aa4bc" }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: "var(--surface-2, #f4f6f9)",
        margin: "0 auto 12px", animation: "sk-pulse 1.5s ease-in-out infinite",
      }}/>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Loading {label}…</div>
    </div>
  )
}

// ── Recent tailors from localStorage ─────────────────────────────────────────
interface RecentTailor {
  token: string; resumeName: string; category: string; score: number;
  scoreBefore: number | null; jdSnippet: string; tailoredAt: number
}

function RecentTailors() {
  const [items, setItems] = useState<RecentTailor[]>([])
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("mf_recent_tailors") || localStorage.getItem("aptmatch_recent_tailors") || "[]")
      if (Array.isArray(r)) setItems(r.slice(0, 4))
    } catch {}
  }, [])
  if (!items.length) return null
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #6b7a99)", letterSpacing: ".5px", marginBottom: 10 }}>
        RECENT TAILORS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(r => (
          <div key={r.token} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e8ef)",
            borderRadius: 12, fontSize: 13,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent)", fontWeight: 800, fontSize: 13, flexShrink: 0,
            }}>
              {r.score}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--text, #1a2035)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.resumeName}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted, #6b7a99)", marginTop: 1 }}>
                {r.category} · {new Date(r.tailoredAt).toLocaleDateString()}
              </div>
            </div>
            {r.scoreBefore !== null && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: r.score > r.scoreBefore ? "var(--accent-soft)" : "var(--surface-2)",
                color: r.score > r.scoreBefore ? "var(--accent)" : "var(--text-soft)",
              }}>
                {r.score > r.scoreBefore ? "+" : ""}{r.score - (r.scoreBefore || 0)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tailor tab — launch card + recent results ─────────────────────────────────
function TailorTab() {
  const [prefill, setPrefill] = useState("")
  const [prefillRole, setPrefillRole] = useState("")
  const [prefillCompany, setPrefillCompany] = useState("")

  useEffect(() => {
    // Read prefill set by job board when user clicked "Tailor"
    const stored = sessionStorage.getItem("jd_prefill_jd") || ""
    const storedRole = sessionStorage.getItem("jd_prefill_role") || ""
    const storedCompany = sessionStorage.getItem("jd_prefill_company") || ""
    if (stored) setPrefill(stored)
    if (storedRole) setPrefillRole(storedRole)
    if (storedCompany) setPrefillCompany(storedCompany)
    // Clear once consumed
    sessionStorage.removeItem("jd_prefill_jd")
    sessionStorage.removeItem("jd_prefill_role")
    sessionStorage.removeItem("jd_prefill_company")
  }, [])

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Hero card */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-h) 0%, var(--accent) 100%)",
        borderRadius: 20, padding: "32px 36px", marginBottom: 24,
        boxShadow: "0 8px 32px color-mix(in srgb, var(--accent) 25%, transparent)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30, width: 140, height: 140,
          background: "rgba(255,255,255,.05)", borderRadius: "50%",
        }}/>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.6)",
          letterSpacing: ".5px", marginBottom: 8,
        }}>AI RESUME TAILOR</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>
          Match your resume<br/>to any job in seconds
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.7)", lineHeight: 1.6, marginBottom: 24 }}>
          Paste a job description, pick a resume from your library, and let AI rewrite it to maximize your match score — in under 90 seconds.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard/resume" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "11px 24px", borderRadius: 12,
            background: "#fff", color: "var(--accent)", textDecoration: "none",
            fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em",
            boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          }}>
            <Sparkles size={15}/> Open Tailor
          </Link>
          <Link href="/dashboard/resume" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "11px 24px", borderRadius: 12,
            background: "rgba(255,255,255,.15)", color: "#fff", textDecoration: "none",
            fontSize: 14, fontWeight: 700, border: "1px solid rgba(255,255,255,.2)",
          }}>
            Resume Library →
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e8ef)",
        borderRadius: 16, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #6b7a99)", letterSpacing: ".5px", marginBottom: 14 }}>
          HOW IT WORKS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { step: "1", title: "Paste the JD", desc: "Copy any job description from any job board" },
            { step: "2", title: "Pick a resume", desc: "Choose from your library or upload a new one" },
            { step: "3", title: "Download & apply", desc: "AI-tailored .docx ready in under 90 seconds" },
          ].map(s => (
            <div key={s.step} style={{ textAlign: "center" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, margin: "0 auto 8px",
                background: "var(--accent-soft)", color: "var(--accent-txt)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 13,
              }}>{s.step}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text, #1a2035)", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #6b7a99)", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tip from job board */}
      {prefill && (
        <div style={{
          background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Check size={16} color="var(--accent)"/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
              {prefillCompany || prefillRole
                ? `JD ready: ${[prefillRole, prefillCompany].filter(Boolean).join(" @ ")}`
                : "Job description ready"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted, #6b7a99)", marginTop: 2 }}>
              Prefilled from the job card — head to the Tailor page to run it.
            </div>
          </div>
          <Link href="/dashboard/resume" style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--accent)",
            textDecoration: "none", whiteSpace: "nowrap", padding: "6px 14px",
            background: "var(--accent-soft)", borderRadius: 8,
          }}>Open Tailor →</Link>
        </div>
      )}

      <RecentTailors />
    </div>
  )
}

// ── Score tab ─────────────────────────────────────────────────────────────────
type ScoreIssue = { severity: "critical" | "high" | "medium"; problem: string; fix: string }

function ScoreTab() {
  const [resumeText, setResumeText] = useState("")
  const [jd, setJd] = useState("")
  const [score, setScore] = useState<number | null>(null)
  const [grade, setGrade] = useState("")
  const [summary, setSummary] = useState("")
  const [issues, setIssues] = useState<ScoreIssue[]>([])
  const [strengths, setStrengths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function runScore() {
    if (!resumeText.trim()) return
    setLoading(true); setError(""); setScore(null); setIssues([]); setStrengths([]); setSummary(""); setGrade("")
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      // API expects JSON { resumeText, jd?, claudeKey? }
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: resumeText.trim(), jd: jd.trim() || undefined, claudeKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Score request failed")
      setScore(data.score ?? null)
      setGrade(data.grade || "")
      setSummary(data.summary || "")
      setIssues(Array.isArray(data.issues) ? data.issues : [])
      setStrengths(Array.isArray(data.strengths) ? data.strengths : [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const r = 44, circ = 2 * Math.PI * r
  const scoreColor = score !== null ? (score >= 80 ? "#059669" : score >= 60 ? "#1d6fc4" : score >= 40 ? "#d97706" : "#dc2626") : "#9ca3af"
  const severityColor = (s: string) => s === "critical" ? "#dc2626" : s === "high" ? "#d97706" : "#6b7a99"

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{
        background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e8ef)",
        borderRadius: 20, padding: "28px 28px",
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text, #1a2035)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={18}/> AI Resume Score
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted, #6b7a99)", marginBottom: 22, lineHeight: 1.6 }}>
          Paste your resume text and get an ATS compatibility score with specific improvement suggestions.
        </p>

        {/* Resume text input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #6b7a99)", letterSpacing: ".4px", display: "block", marginBottom: 6 }}>
            RESUME TEXT (paste from your doc)
          </label>
          <textarea
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            placeholder="Paste the full text of your resume here…"
            rows={8}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "12px 14px", borderRadius: 10, resize: "vertical",
              border: `1.5px solid ${resumeText ? "var(--accent)" : "var(--border)"}`,
              background: "var(--surface-2, #f8f9fb)", fontSize: 13,
              color: "var(--text, #1a2035)", lineHeight: 1.6,
              fontFamily: "inherit", outline: "none",
              transition: "border-color .15s",
            }}
          />
          <div style={{ fontSize: 11, color: "#9aa4bc", marginTop: 4 }}>
            Tip: In Word or Google Docs, press Ctrl+A → Ctrl+C, then paste here
          </div>
        </div>

        {/* Optional JD */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #6b7a99)", letterSpacing: ".4px", display: "block", marginBottom: 6 }}>
            JOB DESCRIPTION <span style={{ fontWeight: 400, color: "#9aa4bc" }}>(optional — improves keyword scoring)</span>
          </label>
          <textarea
            value={jd}
            onChange={e => setJd(e.target.value)}
            placeholder="Paste the job posting text…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 14px", borderRadius: 10, resize: "vertical",
              border: "1.5px solid var(--border, #e4e8ef)",
              background: "var(--surface-2, #f8f9fb)", fontSize: 13,
              color: "var(--text, #1a2035)", lineHeight: 1.6,
              fontFamily: "inherit", outline: "none",
            }}
          />
        </div>

        <button
          onClick={runScore}
          disabled={!resumeText.trim() || loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 12, border: "none",
            background: resumeText.trim() && !loading ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-h) 100%)" : "var(--border)",
            color: resumeText.trim() && !loading ? "#fff" : "#9aa4bc", fontSize: 14, fontWeight: 700,
            cursor: resumeText.trim() && !loading ? "pointer" : "not-allowed", transition: "all .15s",
          }}
        >
          {loading ? "Scoring…" : "Score My Resume"}
        </button>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 10, fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        {score !== null && (
          <div style={{ marginTop: 24 }}>
            {/* Score ring + grade */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 100, height: 100, position: "relative" }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#e4e8ef" strokeWidth={8}/>
                    <circle cx="50" cy="50" r={r} fill="none" stroke={scoreColor} strokeWidth={8}
                      strokeLinecap="round"
                      strokeDasharray={`${(score/100)*circ} ${circ}`}
                      style={{ transition: "stroke-dasharray 1s cubic-bezier(.34,1.56,.64,1)" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
                    <span style={{ fontSize: 10, color: "#9aa4bc", fontWeight: 600 }}>/100</span>
                  </div>
                </div>
                <div style={{
                  marginTop: 8, fontSize: 12, fontWeight: 800, padding: "3px 14px", borderRadius: 20,
                  background: scoreColor + "18", color: scoreColor,
                }}>
                  Grade {grade} · {score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work"}
                </div>
              </div>
              {summary && <p style={{ fontSize: 13, color: "var(--text-muted, #6b7a99)", marginTop: 12, lineHeight: 1.6 }}>{summary}</p>}
            </div>

            {strengths.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: ".5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Check size={12}/> STRENGTHS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {strengths.map((s, i) => (
                    <div key={i} style={{
                      padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe",
                      borderRadius: 8, fontSize: 13, color: "#1e3a5f", lineHeight: 1.5,
                    }}>{s}</div>
                  ))}
                </div>
              </div>
            )}

            {issues.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #6b7a99)", letterSpacing: ".5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <TriangleAlert size={12}/> ISSUES TO FIX
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {issues.map((issue, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", background: "var(--surface-2, #f8f9fb)",
                      border: `1px solid ${severityColor(issue.severity)}30`,
                      borderLeft: `3px solid ${severityColor(issue.severity)}`,
                      borderRadius: 8, fontSize: 13,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: severityColor(issue.severity) }}>{issue.severity}</span>
                      </div>
                      <div style={{ color: "var(--text, #1a2035)", lineHeight: 1.5, marginBottom: 4 }}>{issue.problem}</div>
                      <div style={{ color: "#6b7a99", fontSize: 12 }}>→ {issue.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main AI Tools page ────────────────────────────────────────────────────────
export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<AITab>("tailor")

  // Read tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as AITab
    if (["tailor", "cover", "interviews", "score"].includes(hash)) {
      setActiveTab(hash)
    }
    // Check sessionStorage for tab redirect from job cards or home page
    const validTabs = ["tailor", "cover", "interviews", "score"]
    const aiTab = sessionStorage.getItem("jd_ai_tab")
    const viewTab = sessionStorage.getItem("jd_view")
    const storedTab = (aiTab || viewTab) as AITab | null
    if (storedTab && validTabs.includes(storedTab)) {
      setActiveTab(storedTab)
    }
    sessionStorage.removeItem("jd_ai_tab")
    // Only remove jd_view if it was a valid ai-tools tab — otherwise leave it
    // intact so jobs/page.tsx can still read it for its own view-mode routing.
    if (viewTab && validTabs.includes(viewTab)) {
      sessionStorage.removeItem("jd_view")
    }
  }, [])

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Sparkles size={18}/>}
          title="AI Tools"
          description="All AI-powered features in one place — tailor, write, prep, and score."
        />
      </div>

      {/* ── Sub-tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 4, padding: "4px", borderRadius: 14,
        background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e8ef)",
        width: "fit-content", marginBottom: 28,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
                borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13.5,
                fontWeight: active ? 700 : 500, transition: "all .15s",
                background: active ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-h) 100%)" : "transparent",
                color: active ? "#fff" : "var(--text-muted, #6b7a99)",
                boxShadow: active ? "0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
              }}
            >
              <tab.Icon size={14}/>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      {activeTab === "tailor" && <TailorTab />}
      {activeTab === "cover" && <CoverLetterSection />}
      {activeTab === "interviews" && <InterviewSection />}
      {activeTab === "score" && <ScoreTab />}
    </div>
  )
}
