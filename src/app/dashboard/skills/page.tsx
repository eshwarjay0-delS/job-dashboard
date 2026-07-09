"use client"

import { useState, useEffect } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type Proficiency = "beginner" | "intermediate" | "advanced" | "expert"
type CertStatus  = "planned" | "in_progress" | "completed"

interface Skill {
  id: string
  name: string
  category: string
  proficiency: Proficiency
  marketDemand: number   // 1–100
  yearsExp: number
  lastUsed: string       // ISO date
  note?: string
}

interface Cert {
  id: string
  name: string
  provider: string
  status: CertStatus
  targetDate?: string
  completedDate?: string
  credlyUrl?: string
  skillIds: string[]
}

interface Goal {
  id: string
  title: string
  targetDate: string
  done: boolean
  linkedSkill?: string
}

/* ═══════════════════════════════════════════════════════════════════
   SEED DATA
   ═══════════════════════════════════════════════════════════════════ */
const SKILL_CATEGORIES = [
  "Cloud & Infra", "Security", "Languages", "DevOps", "Data & AI",
  "Frontend", "Backend", "ServiceNow", "Networking", "Soft Skills",
]

const DEMAND_ROLES: { role: string; skills: string[] }[] = [
  { role: "Cloud Security Engineer", skills: ["AWS", "Azure", "Terraform", "SIEM", "Zero Trust", "IAM"] },
  { role: "Full Stack Developer",    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "REST APIs"] },
  { role: "DevOps / SRE",            skills: ["Kubernetes", "Terraform", "CI/CD", "Prometheus", "AWS", "Python"] },
  { role: "Data Scientist",          skills: ["Python", "PyTorch", "SQL", "Spark", "MLflow", "Tableau"] },
  { role: "ServiceNow Developer",    skills: ["ServiceNow", "ITSM", "JavaScript", "REST APIs", "GlideScript", "Jelly"] },
]

const PROFICIENCY_INFO: Record<Proficiency, { label: string; color: string; bg: string; pct: number }> = {
  beginner:     { label: "Beginner",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  pct: 25  },
  intermediate: { label: "Intermediate", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  pct: 50  },
  advanced:     { label: "Advanced",     color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  pct: 75  },
  expert:       { label: "Expert",       color: "#10b981", bg: "rgba(16,185,129,0.1)",  pct: 100 },
}

const CERT_STATUS_INFO: Record<CertStatus, { label: string; color: string; bg: string; icon: string }> = {
  planned:     { label: "Planned",     color: "#6b7a99", bg: "rgba(107,122,153,0.1)", icon: "○" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: "◐" },
  completed:   { label: "Completed",   color: "#10b981", bg: "rgba(16,185,129,0.1)",  icon: "✓" },
}

function newId() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function SkillsPage() {
  const [view, setView]           = useState<"skills" | "certs" | "goals" | "market">("skills")
  const [skills, setSkills]       = useState<Skill[]>([])
  const [certs, setCerts]         = useState<Cert[]>([])
  const [goals, setGoals]         = useState<Goal[]>([])
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [editCert, setEditCert]   = useState<Cert | null>(null)
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [showCertForm, setShowCertForm]   = useState(false)
  const [showGoalForm, setShowGoalForm]   = useState(false)
  const [catFilter, setCatFilter] = useState("All")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAdvice, setAiAdvice]   = useState("")
  const [roleTarget, setRoleTarget] = useState(DEMAND_ROLES[0].role)
  const [goalText, setGoalText]     = useState("")
  const [goalDate, setGoalDate]     = useState("")

  // form state for skill
  const [sf, setSf] = useState({ name: "", category: "Cloud & Infra", proficiency: "intermediate" as Proficiency, yearsExp: 1, marketDemand: 70, lastUsed: today(), note: "" })
  // form state for cert
  const [cf, setCf] = useState({ name: "", provider: "", status: "planned" as CertStatus, targetDate: "", completedDate: "", credlyUrl: "" })

  /* persist */
  useEffect(() => {
    try {
      const s = localStorage.getItem("jd_skills_v1"); if (s) setSkills(JSON.parse(s))
      const c = localStorage.getItem("jd_certs_v1");  if (c) setCerts(JSON.parse(c))
      const g = localStorage.getItem("jd_goals_v1");  if (g) setGoals(JSON.parse(g))
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { localStorage.setItem("jd_skills_v1", JSON.stringify(skills)) }, [skills])
  useEffect(() => { localStorage.setItem("jd_certs_v1",  JSON.stringify(certs))  }, [certs])
  useEffect(() => { localStorage.setItem("jd_goals_v1",  JSON.stringify(goals))  }, [goals])

  /* skill CRUD */
  function saveSkill() {
    if (!sf.name.trim()) return
    if (editSkill) {
      setSkills(prev => prev.map(s => s.id === editSkill.id ? { ...s, ...sf } : s))
      setEditSkill(null)
    } else {
      setSkills(prev => [...prev, { id: newId(), ...sf }])
    }
    setSf({ name: "", category: "Cloud & Infra", proficiency: "intermediate", yearsExp: 1, marketDemand: 70, lastUsed: today(), note: "" })
    setShowSkillForm(false)
  }
  function openEditSkill(sk: Skill) {
    setSf({ name: sk.name, category: sk.category, proficiency: sk.proficiency, yearsExp: sk.yearsExp, marketDemand: sk.marketDemand, lastUsed: sk.lastUsed, note: sk.note || "" })
    setEditSkill(sk)
    setShowSkillForm(true)
  }
  function deleteSkill(id: string) { setSkills(prev => prev.filter(s => s.id !== id)) }

  /* cert CRUD */
  function saveCert() {
    if (!cf.name.trim()) return
    if (editCert) {
      setCerts(prev => prev.map(c => c.id === editCert.id ? { ...c, ...cf, skillIds: c.skillIds } : c))
      setEditCert(null)
    } else {
      setCerts(prev => [...prev, { id: newId(), ...cf, skillIds: [] }])
    }
    setCf({ name: "", provider: "", status: "planned", targetDate: "", completedDate: "", credlyUrl: "" })
    setShowCertForm(false)
  }
  function openEditCert(c: Cert) {
    setCf({ name: c.name, provider: c.provider, status: c.status, targetDate: c.targetDate || "", completedDate: c.completedDate || "", credlyUrl: c.credlyUrl || "" })
    setEditCert(c)
    setShowCertForm(true)
  }
  function deleteCert(id: string) { setCerts(prev => prev.filter(c => c.id !== id)) }

  /* goals */
  function addGoal() {
    if (!goalText.trim() || !goalDate) return
    setGoals(prev => [...prev, { id: newId(), title: goalText, targetDate: goalDate, done: false }])
    setGoalText(""); setGoalDate(""); setShowGoalForm(false)
  }
  function toggleGoal(id: string) { setGoals(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g)) }
  function deleteGoal(id: string) { setGoals(prev => prev.filter(g => g.id !== id)) }

  /* AI gap analysis */
  async function runGapAnalysis() {
    setAiLoading(true); setAiAdvice("")
    const targetSkills = DEMAND_ROLES.find(r => r.role === roleTarget)?.skills || []
    const mySkills = skills.map(s => s.name)
    const missing = targetSkills.filter(t => !mySkills.some(m => m.toLowerCase().includes(t.toLowerCase())))
    const instruction = `Target role: "${roleTarget}". Skills the user has: ${mySkills.join(", ") || "none"}. Required skills for the role: ${targetSkills.join(", ")}. Missing skills: ${missing.join(", ") || "none"}. Give a brief (150 words max) skills gap analysis with top 3 action items. Be direct and specific.`
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "skills_gap", instruction, current: "", claudeKey }) })
      const data = await res.json()
      setAiAdvice(data.result || data.text || data.content || "No advice generated.")
    } catch { setAiAdvice("Failed to generate analysis. Please try again.") }
    setAiLoading(false)
  }

  /* computed */
  const categories = ["All", ...SKILL_CATEGORIES.filter(c => skills.some(s => s.category === c))]
  const filtered = catFilter === "All" ? skills : skills.filter(s => s.category === catFilter)
  const avgDemand = skills.length ? Math.round(skills.reduce((a, s) => a + s.marketDemand, 0) / skills.length) : 0
  const expertCount = skills.filter(s => s.proficiency === "expert").length
  const completedCerts = certs.filter(c => c.status === "completed").length
  const pendingGoals = goals.filter(g => !g.done).length
  const targetRoleSkills = DEMAND_ROLES.find(r => r.role === roleTarget)?.skills || []
  const mySkillNames = skills.map(s => s.name.toLowerCase())
  const matchedSkills = targetRoleSkills.filter(t => mySkillNames.some(m => m.includes(t.toLowerCase())))
  const matchPct = targetRoleSkills.length ? Math.round((matchedSkills.length / targetRoleSkills.length) * 100) : 0

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>
            Skills & Learning
          </h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>Track proficiency, certifications, and career goals</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view === "skills" && (
            <button onClick={() => { setEditSkill(null); setSf({ name: "", category: "Cloud & Infra", proficiency: "intermediate", yearsExp: 1, marketDemand: 70, lastUsed: today(), note: "" }); setShowSkillForm(true) }}
              style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              + Add Skill
            </button>
          )}
          {view === "certs" && (
            <button onClick={() => { setEditCert(null); setCf({ name: "", provider: "", status: "planned", targetDate: "", completedDate: "", credlyUrl: "" }); setShowCertForm(true) }}
              style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
              + Add Cert
            </button>
          )}
          {view === "goals" && (
            <button onClick={() => setShowGoalForm(true)}
              style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
              + Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Skills Tracked",   value: skills.length,    sub: `${expertCount} expert`,      color: "#1d6fc4" },
          { label: "Certs Earned",     value: completedCerts,   sub: `${certs.length} total`,      color: "#10b981" },
          { label: "Avg Market Demand",value: `${avgDemand}%`,  sub: "across your stack",          color: "#8b5cf6" },
          { label: "Open Goals",       value: pendingGoals,     sub: `${goals.length} total`,      color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a2035", marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: "#6b7a99", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f1f4f9", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["skills", "certs", "goals", "market"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer",
              background: view === v ? "#fff" : "transparent",
              color: view === v ? "var(--accent)" : "#6b7a99",
              boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all .15s" }}>
            {v === "skills" ? "Skill Inventory" : v === "certs" ? "Certifications" : v === "goals" ? "Learning Goals" : "Market Fit"}
          </button>
        ))}
      </div>

      {/* ── SKILLS VIEW ─────────────────────────────────────────────── */}
      {view === "skills" && (
        <div>
          {/* Category filters */}
          {skills.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 500, border: "1.5px solid",
                    borderColor: catFilter === c ? "var(--accent)" : "#e4e8ef",
                    background: catFilter === c ? "rgba(29,111,196,0.07)" : "#fff",
                    color: catFilter === c ? "var(--accent)" : "#6b7a99", cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No skills yet</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 20 }}>Add your first skill to start tracking your tech stack and proficiency</div>
              <button onClick={() => setShowSkillForm(true)}
                style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                + Add First Skill
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {filtered.map(sk => {
                const pi = PROFICIENCY_INFO[sk.proficiency]
                return (
                  <div key={sk.id} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "18px 20px", position: "relative" }}>
                    {/* Top row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2035", marginBottom: 3 }}>{sk.name}</div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "#f1f4f9", color: "#6b7a99", fontWeight: 500 }}>{sk.category}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEditSkill(sk)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7a99", fontSize: 13 }}>✎</button>
                        <button onClick={() => deleteSkill(sk.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
                      </div>
                    </div>

                    {/* Proficiency bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: pi.color, background: pi.bg, padding: "2px 8px", borderRadius: 100 }}>{pi.label}</span>
                        <span style={{ fontSize: 11.5, color: "#6b7a99" }}>{sk.yearsExp}yr exp</span>
                      </div>
                      <div style={{ height: 5, background: "#f1f4f9", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pi.pct}%`, background: pi.color, borderRadius: 10, transition: "width .6s ease" }}/>
                      </div>
                    </div>

                    {/* Market demand */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11.5, color: "#6b7a99" }}>Market demand</span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: sk.marketDemand >= 70 ? "#10b981" : sk.marketDemand >= 40 ? "#f59e0b" : "#ef4444" }}>{sk.marketDemand}%</span>
                      </div>
                      <div style={{ height: 4, background: "#f1f4f9", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${sk.marketDemand}%`, borderRadius: 10, transition: "width .6s ease",
                          background: sk.marketDemand >= 70 ? "#10b981" : sk.marketDemand >= 40 ? "#f59e0b" : "#ef4444" }}/>
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: "#aab3c5" }}>Last used: {fmtDate(sk.lastUsed)}</div>
                    {sk.note && <div style={{ fontSize: 12, color: "#6b7a99", marginTop: 6, fontStyle: "italic" }}>{sk.note}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CERTS VIEW ──────────────────────────────────────────────── */}
      {view === "certs" && (
        <div>
          {certs.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No certifications yet</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 20 }}>Track certifications you've earned, are studying for, or plan to pursue</div>
              <button onClick={() => setShowCertForm(true)}
                style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                + Add First Cert
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(["completed", "in_progress", "planned"] as CertStatus[]).map(status => {
                const group = certs.filter(c => c.status === status)
                if (!group.length) return null
                const si = CERT_STATUS_INFO[status]
                return (
                  <div key={status}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: si.color, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>
                      {si.icon} {si.label} ({group.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                      {group.map(c => {
                        const daysLeft = c.targetDate && c.status !== "completed" ? daysUntil(c.targetDate) : null
                        return (
                          <div key={c.id} style={{ background: "#fff", border: `1.5px solid ${daysLeft !== null && daysLeft < 14 ? "#fecaca" : "#e4e8ef"}`, borderRadius: 12, padding: "16px 18px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1a2035", marginBottom: 2 }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: "#6b7a99" }}>{c.provider}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 100, background: si.bg, color: si.color, fontWeight: 600 }}>{si.label}</span>
                                <button onClick={() => openEditCert(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7a99", fontSize: 12 }}>✎</button>
                                <button onClick={() => deleteCert(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}>✕</button>
                              </div>
                            </div>
                            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                              {c.status === "completed" && c.completedDate && (
                                <span style={{ fontSize: 11.5, color: "#6b7a99" }}>Earned: {fmtDate(c.completedDate)}</span>
                              )}
                              {c.targetDate && c.status !== "completed" && (
                                <span style={{ fontSize: 11.5, color: daysLeft !== null && daysLeft < 14 ? "#ef4444" : "#6b7a99", fontWeight: daysLeft !== null && daysLeft < 14 ? 700 : 400 }}>
                                  {daysLeft !== null && daysLeft < 0 ? "⚠ Overdue" : daysLeft !== null && daysLeft < 14 ? `⚠ ${daysLeft}d left` : `Target: ${fmtDate(c.targetDate)}`}
                                </span>
                              )}
                              {c.credlyUrl && (
                                <a href={c.credlyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}>View Badge →</a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── GOALS VIEW ──────────────────────────────────────────────── */}
      {view === "goals" && (
        <div>
          {showGoalForm && (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 14 }}>New Learning Goal</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={goalText} onChange={e => setGoalText(e.target.value)} placeholder="e.g., Complete AWS Solutions Architect course"
                  style={{ flex: 2, minWidth: 200, padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035" }}/>
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035" }}/>
                <button onClick={addGoal} style={{ padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}>Add</button>
                <button onClick={() => setShowGoalForm(false)} style={{ padding: "9px 14px", background: "transparent", color: "#6b7a99", border: "1px solid #e4e8ef", borderRadius: 8, cursor: "pointer", fontSize: 13.5 }}>Cancel</button>
              </div>
            </div>
          )}

          {goals.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No goals yet</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 20 }}>Set learning goals with target dates to stay on track</div>
              <button onClick={() => setShowGoalForm(true)}
                style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                + Add First Goal
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.sort((a, b) => Number(a.done) - Number(b.done)).map(g => {
                const days = !g.done ? daysUntil(g.targetDate) : null
                const overdue = days !== null && days < 0
                return (
                  <div key={g.id} style={{ background: "#fff", border: `1.5px solid ${overdue ? "#fecaca" : g.done ? "#dcfce7" : "#e4e8ef"}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <button onClick={() => toggleGoal(g.id)}
                      style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${g.done ? "#10b981" : "#d1d5db"}`, background: g.done ? "#10b981" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
                      {g.done ? "✓" : ""}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: g.done ? "#6b7a99" : "#1a2035", textDecoration: g.done ? "line-through" : "none" }}>{g.title}</div>
                      <div style={{ fontSize: 12, color: overdue ? "#ef4444" : "#6b7a99", marginTop: 2 }}>
                        {g.done ? "Completed" : overdue ? `⚠ Overdue — was due ${fmtDate(g.targetDate)}` : `Due ${fmtDate(g.targetDate)}${days !== null ? ` (${days}d)` : ""}`}
                      </div>
                    </div>
                    <button onClick={() => deleteGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MARKET FIT VIEW ─────────────────────────────────────────── */}
      {view === "market" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Role match card */}
          <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 16 }}>Role Match Analysis</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 6 }}>Target Role</label>
              <select value={roleTarget} onChange={e => { setRoleTarget(e.target.value); setAiAdvice("") }}
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035", background: "#fff" }}>
                {DEMAND_ROLES.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
              </select>
            </div>

            {/* Match circle */}
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <div style={{ position: "relative", display: "inline-block", width: 120, height: 120 }}>
                <svg viewBox="0 0 120 120" width="120" height="120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f4f9" strokeWidth="10"/>
                  <circle cx="60" cy="60" r="52" fill="none"
                    stroke={matchPct >= 70 ? "#10b981" : matchPct >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(matchPct / 100) * 326.7} 326.7`}
                    transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray .8s ease" }}/>
                  <text x="60" y="55" textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: "#1a2035", fontFamily: "var(--font-sans)" }}>{matchPct}%</text>
                  <text x="60" y="72" textAnchor="middle" style={{ fontSize: 10, fill: "#6b7a99" }}>MATCH</text>
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#6b7a99", marginTop: 8 }}>
                {matchedSkills.length}/{targetRoleSkills.length} required skills covered
              </div>
            </div>

            {/* Skill checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {targetRoleSkills.map(t => {
                const have = mySkillNames.some(m => m.includes(t.toLowerCase()))
                return (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: have ? "#10b981" : "#ef4444" }}>{have ? "✓" : "✗"}</span>
                    <span style={{ fontSize: 13.5, color: have ? "#1a2035" : "#6b7a99" }}>{t}</span>
                    {!have && <span style={{ marginLeft: "auto", fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.08)", padding: "2px 7px", borderRadius: 100, fontWeight: 600 }}>Missing</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI gap analysis */}
          <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2035", marginBottom: 8 }}>AI Skills Gap Analysis</div>
            <div style={{ fontSize: 13, color: "#6b7a99", marginBottom: 16 }}>Get personalized advice on what to learn next to land your target role faster.</div>
            <button onClick={runGapAnalysis} disabled={aiLoading}
              style={{ width: "100%", padding: "11px", background: aiLoading ? "#f1f4f9" : "var(--accent)", color: aiLoading ? "#6b7a99" : "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: aiLoading ? "default" : "pointer", marginBottom: 16 }}>
              {aiLoading ? "Analyzing…" : "⚡ Run Gap Analysis"}
            </button>

            {aiAdvice ? (
              <div style={{ background: "rgba(29,111,196,0.04)", border: "1px solid rgba(29,111,196,0.12)", borderRadius: 10, padding: "16px", fontSize: 13.5, color: "#1a2035", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {aiAdvice}
              </div>
            ) : (
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                <div style={{ fontSize: 13, color: "#6b7a99" }}>Claude will analyze the gap between your current skills and the target role requirements</div>
              </div>
            )}

            {/* Top in-demand skills */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a2035", marginBottom: 10 }}>🔥 Trending in {roleTarget}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {targetRoleSkills.map(t => {
                  const have = mySkillNames.some(m => m.includes(t.toLowerCase()))
                  return (
                    <span key={t} style={{ padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                      background: have ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.07)",
                      color: have ? "#10b981" : "#ef4444",
                      border: `1px solid ${have ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)"}` }}>
                      {t} {have ? "✓" : "+"}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SKILL FORM MODAL ────────────────────────────────────────── */}
      {showSkillForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowSkillForm(false); setEditSkill(null) } }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 20 }}>{editSkill ? "Edit Skill" : "Add Skill"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Skill Name *</label>
                <input value={sf.name} onChange={e => setSf(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Kubernetes"
                  style={inputStyle}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={sf.category} onChange={e => setSf(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                    {SKILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Proficiency</label>
                  <select value={sf.proficiency} onChange={e => setSf(p => ({ ...p, proficiency: e.target.value as Proficiency }))} style={inputStyle}>
                    {(["beginner", "intermediate", "advanced", "expert"] as Proficiency[]).map(p => (
                      <option key={p} value={p}>{PROFICIENCY_INFO[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Years Exp</label>
                  <input type="number" min={0} max={30} value={sf.yearsExp} onChange={e => setSf(p => ({ ...p, yearsExp: Number(e.target.value) }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Market Demand %</label>
                  <input type="number" min={1} max={100} value={sf.marketDemand} onChange={e => setSf(p => ({ ...p, marketDemand: Number(e.target.value) }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Last Used</label>
                  <input type="date" value={sf.lastUsed} onChange={e => setSf(p => ({ ...p, lastUsed: e.target.value }))} style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Note (optional)</label>
                <input value={sf.note} onChange={e => setSf(p => ({ ...p, note: e.target.value }))} placeholder="e.g., Used in production at Cigna"
                  style={inputStyle}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={saveSkill} style={{ flex: 1, padding: "11px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editSkill ? "Save Changes" : "Add Skill"}
              </button>
              <button onClick={() => { setShowSkillForm(false); setEditSkill(null) }} style={{ padding: "11px 20px", background: "transparent", color: "#6b7a99", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CERT FORM MODAL ─────────────────────────────────────────── */}
      {showCertForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCertForm(false); setEditCert(null) } }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 20 }}>{editCert ? "Edit Certification" : "Add Certification"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Certification Name *</label>
                <input value={cf.name} onChange={e => setCf(p => ({ ...p, name: e.target.value }))} placeholder="e.g., AWS Solutions Architect"
                  style={inputStyle}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Provider</label>
                  <input value={cf.provider} onChange={e => setCf(p => ({ ...p, provider: e.target.value }))} placeholder="e.g., Amazon, CompTIA" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={cf.status} onChange={e => setCf(p => ({ ...p, status: e.target.value as CertStatus }))} style={inputStyle}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              {cf.status !== "completed" && (
                <div>
                  <label style={labelStyle}>Target Date</label>
                  <input type="date" value={cf.targetDate} onChange={e => setCf(p => ({ ...p, targetDate: e.target.value }))} style={inputStyle}/>
                </div>
              )}
              {cf.status === "completed" && (
                <div>
                  <label style={labelStyle}>Completed Date</label>
                  <input type="date" value={cf.completedDate} onChange={e => setCf(p => ({ ...p, completedDate: e.target.value }))} style={inputStyle}/>
                </div>
              )}
              <div>
                <label style={labelStyle}>Credly / Badge URL (optional)</label>
                <input value={cf.credlyUrl} onChange={e => setCf(p => ({ ...p, credlyUrl: e.target.value }))} placeholder="https://www.credly.com/badges/..." style={inputStyle}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={saveCert} style={{ flex: 1, padding: "11px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editCert ? "Save Changes" : "Add Certification"}
              </button>
              <button onClick={() => { setShowCertForm(false); setEditCert(null) }} style={{ padding: "11px 20px", background: "transparent", color: "#6b7a99", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Shared form styles ─────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 5,
}
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #e4e8ef",
  borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035",
  background: "#fff", boxSizing: "border-box",
}
