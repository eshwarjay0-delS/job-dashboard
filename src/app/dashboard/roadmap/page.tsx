"use client"

import { useState, useEffect } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Milestone {
  id: string
  week: number
  title: string
  tasks: Task[]
  category: "skills" | "networking" | "applications" | "prep" | "branding"
}

interface Task {
  id: string
  text: string
  done: boolean
  dueDate?: string
}

interface Roadmap {
  id: string
  targetRole: string
  targetCompany: string
  currentRole: string
  biggestGap: string
  timeline: 30 | 60 | 90
  visaStatus: string
  milestones: Milestone[]
  createdAt: string
  lastUpdated: string
}

type TimelineOption = 30 | 60 | 90

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const CAT_META: Record<Milestone["category"], { label: string; color: string; bg: string; icon: string }> = {
  skills:       { label: "Skills",        color: "#8b5cf6", bg: "rgba(139,92,246,0.08)",  icon: "🧠" },
  networking:   { label: "Networking",    color: "#10b981", bg: "rgba(16,185,129,0.08)",  icon: "🤝" },
  applications: { label: "Applications", color: "#1d6fc4", bg: "rgba(29,111,196,0.08)",  icon: "📤" },
  prep:         { label: "Interview Prep",color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: "🎤" },
  branding:     { label: "Branding",      color: "#ec4899", bg: "rgba(236,72,153,0.08)", icon: "✨" },
}

function newId() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function addDays(n: number) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10) }

/* Pre-built templates for instant value before AI generates */
function buildTemplate(role: string, timeline: TimelineOption, gap: string): Milestone[] {
  const weeks = timeline === 30 ? 4 : timeline === 60 ? 8 : 12
  const isSecurityRole = /security|soc|pentest|appsec|cissp|devops/i.test(role)
  const isSnowRole     = /servicenow|snow/i.test(role)
  const isSWE          = /engineer|developer|full.?stack|backend|frontend/i.test(role)

  const milestones: Milestone[] = []

  // Week 1: Foundation
  milestones.push({
    id: newId(), week: 1,
    title: "Foundation & Gap Analysis",
    category: "skills",
    tasks: [
      { id: newId(), text: "Audit your resume against 5 target job descriptions — highlight every missing keyword", done: false, dueDate: addDays(5) },
      { id: newId(), text: `Update LinkedIn headline to include "${role}" and target keywords`, done: false, dueDate: addDays(3) },
      { id: newId(), text: "Identify your 3 biggest skill gaps and create a learning plan for each", done: false, dueDate: addDays(7) },
      { id: newId(), text: "Set up job alerts on LinkedIn, Indeed, and Dice for your target role", done: false, dueDate: addDays(2) },
    ],
  })

  // Week 2: Skills
  milestones.push({
    id: newId(), week: 2,
    title: "Skill Building Sprint",
    category: "skills",
    tasks: [
      { id: newId(), text: isSecurityRole
        ? "Complete one TryHackMe/HackTheBox room relevant to your target role"
        : isSnowRole
        ? "Complete ServiceNow PDI setup and build a practice automation flow"
        : "Build one portfolio project showcasing your primary tech stack", done: false, dueDate: addDays(14) },
      { id: newId(), text: gap ? `Address your stated gap: ${gap} — find a course, tutorial, or project` : "Enroll in one targeted online course (Coursera, Udemy, A Cloud Guru)", done: false, dueDate: addDays(10) },
      { id: newId(), text: "Spend 1 hour daily on targeted skill practice (coding challenges, labs, or reading)", done: false, dueDate: addDays(14) },
    ],
  })

  // Week 3: Networking
  milestones.push({
    id: newId(), week: 3,
    title: "Network Activation",
    category: "networking",
    tasks: [
      { id: newId(), text: "Identify 10 target companies and 2 contacts at each on LinkedIn", done: false, dueDate: addDays(18) },
      { id: newId(), text: "Send 5 personalized connection requests to people in your target role", done: false, dueDate: addDays(16) },
      { id: newId(), text: "Reach out to 2 ex-colleagues at target companies for a virtual coffee chat", done: false, dueDate: addDays(20) },
      { id: newId(), text: "Join 2 relevant Slack communities or Discord servers in your field", done: false, dueDate: addDays(21) },
    ],
  })

  // Week 4: Applications
  milestones.push({
    id: newId(), week: 4,
    title: "Application Blitz",
    category: "applications",
    tasks: [
      { id: newId(), text: "Tailor your resume for each application — minimum 3 applications this week", done: false, dueDate: addDays(28) },
      { id: newId(), text: "Write a reusable cover letter template and customize for each role", done: false, dueDate: addDays(25) },
      { id: newId(), text: "Apply to 2 reach companies, 2 target companies, and 1 safety company", done: false, dueDate: addDays(28) },
      { id: newId(), text: "Log every application in your pipeline tracker with salary, visa type, and recruiter info", done: false, dueDate: addDays(28) },
    ],
  })

  if (timeline >= 60) {
    milestones.push({
      id: newId(), week: 5,
      title: "Interview Preparation",
      category: "prep",
      tasks: [
        { id: newId(), text: "Practice 10 behavioral questions using STAR format — record yourself", done: false, dueDate: addDays(35) },
        { id: newId(), text: isSecurityRole
          ? "Study common security interview topics: threat modeling, IR processes, MITRE ATT&CK"
          : isSWE
          ? "Solve 15 LeetCode problems (5 Easy, 7 Medium, 3 Hard) in your primary language"
          : "Practice 3 technical scenarios with a peer or using AI mock interview", done: false, dueDate: addDays(38) },
        { id: newId(), text: "Research your top 5 target companies: recent news, tech stack, culture notes", done: false, dueDate: addDays(35) },
      ],
    })

    milestones.push({
      id: newId(), week: 6,
      title: "Brand & Visibility Boost",
      category: "branding",
      tasks: [
        { id: newId(), text: "Publish a technical post on LinkedIn — share something you've learned recently", done: false, dueDate: addDays(42) },
        { id: newId(), text: "Update GitHub/portfolio with your latest projects and add README files", done: false, dueDate: addDays(40) },
        { id: newId(), text: "Request 2 LinkedIn recommendations from ex-colleagues or managers", done: false, dueDate: addDays(42) },
      ],
    })

    milestones.push({
      id: newId(), week: 7,
      title: "Accelerate Applications",
      category: "applications",
      tasks: [
        { id: newId(), text: "Follow up on applications older than 14 days — email the recruiter", done: false, dueDate: addDays(46) },
        { id: newId(), text: "Target 5 more applications this week, prioritizing H1B/GC sponsors", done: false, dueDate: addDays(49) },
        { id: newId(), text: "Attend 1 virtual meetup or networking event in your field", done: false, dueDate: addDays(49) },
      ],
    })

    milestones.push({
      id: newId(), week: 8,
      title: "Mid-Point Review",
      category: "skills",
      tasks: [
        { id: newId(), text: "Review your application response rate — adjust resume if below 15%", done: false, dueDate: addDays(56) },
        { id: newId(), text: "Complete a mock technical interview with a peer or via Pramp/Interviewing.io", done: false, dueDate: addDays(54) },
        { id: newId(), text: "Update your target company list based on which are responding", done: false, dueDate: addDays(56) },
      ],
    })
  }

  if (timeline === 90) {
    milestones.push({
      id: newId(), week: 9,
      title: "Deep Technical Prep",
      category: "prep",
      tasks: [
        { id: newId(), text: "Complete 1 end-to-end system design exercise (design Uber, design Twitter)", done: false, dueDate: addDays(63) },
        { id: newId(), text: "Study salary negotiation — research P75 market rate for your target role", done: false, dueDate: addDays(63) },
        { id: newId(), text: isSecurityRole
          ? "Attempt one CTF challenge or complete a security certification module"
          : "Build or contribute to an open-source project in your target tech stack", done: false, dueDate: addDays(65) },
      ],
    })

    milestones.push({
      id: newId(), week: 10,
      title: "Network Follow-Up Wave",
      category: "networking",
      tasks: [
        { id: newId(), text: "Follow up with all networking contacts from weeks 3–7", done: false, dueDate: addDays(70) },
        { id: newId(), text: "Ask 3 warm contacts for a referral — have your tailored resume ready", done: false, dueDate: addDays(70) },
        { id: newId(), text: "Connect with 2 hiring managers directly at your top target companies", done: false, dueDate: addDays(72) },
      ],
    })

    milestones.push({
      id: newId(), week: 11,
      title: "Offer Readiness",
      category: "prep",
      tasks: [
        { id: newId(), text: "Prepare your negotiation script — know your BATNA (best alternative)", done: false, dueDate: addDays(77) },
        { id: newId(), text: "Research benefits benchmarks for your target companies", done: false, dueDate: addDays(77) },
        { id: newId(), text: "Do 2 final mock interviews focusing on 'tell me about yourself' and closing questions", done: false, dueDate: addDays(79) },
      ],
    })

    milestones.push({
      id: newId(), week: 12,
      title: "Final Push",
      category: "applications",
      tasks: [
        { id: newId(), text: "Apply to 10 additional roles in your final week — maximize pipeline breadth", done: false, dueDate: addDays(84) },
        { id: newId(), text: "Review and close out stale applications — email every recruiter who hasn't responded", done: false, dueDate: addDays(84) },
        { id: newId(), text: "Celebrate wins: count interviews secured, skills gained, connections made", done: false, dueDate: addDays(90) },
      ],
    })
  }

  return milestones.slice(0, weeks)
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [active, setActive]     = useState<Roadmap | null>(null)
  const [showNew, setShowNew]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiEnhanced, setAiEnhanced] = useState(false)

  // New roadmap form
  const [form, setForm] = useState({
    targetRole: "", targetCompany: "", currentRole: "",
    biggestGap: "", timeline: 90 as TimelineOption, visaStatus: "H1B",
  })

  useEffect(() => {
    try {
      const s = localStorage.getItem("jd_roadmaps_v1")
      if (s) {
        const parsed: Roadmap[] = JSON.parse(s)
        setRoadmaps(parsed)
        if (parsed.length) setActive(parsed[0])
      }
    } catch {}
  }, [])

  function persist(next: Roadmap[]) {
    setRoadmaps(next)
    localStorage.setItem("jd_roadmaps_v1", JSON.stringify(next))
  }

  async function generateRoadmap() {
    if (!form.targetRole.trim()) return
    setGenerating(true)

    // Always build template immediately for instant value
    const milestones = buildTemplate(form.targetRole, form.timeline, form.biggestGap)
    const base: Roadmap = {
      id: newId(),
      targetRole: form.targetRole,
      targetCompany: form.targetCompany,
      currentRole: form.currentRole,
      biggestGap: form.biggestGap,
      timeline: form.timeline,
      visaStatus: form.visaStatus,
      milestones,
      createdAt: today(),
      lastUpdated: today(),
    }

    // Try to enhance with AI
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "career_roadmap",
          instruction: `You are a career coach. Add 2-3 highly specific, actionable tasks for a ${form.timeline}-day roadmap for someone targeting "${form.targetRole}"${form.targetCompany ? ` at ${form.targetCompany}` : ""}. Their current role: "${form.currentRole || "not specified"}". Biggest skill gap: "${form.biggestGap || "not specified"}". Visa status: ${form.visaStatus}. Return ONLY a JSON array of task strings (no markdown, just the array): ["task 1", "task 2", "task 3"]`,
          current: form.targetRole,
        }),
      })
      const data = await res.json()
      const raw = data.result || data.text || data.content || ""
      const match = raw.match(/\[[\s\S]*?\]/)
      if (match) {
        const extra: string[] = JSON.parse(match[0])
        if (Array.isArray(extra) && extra.length > 0) {
          // Add AI tasks to week 1
          base.milestones[0].tasks = [
            ...base.milestones[0].tasks,
            ...extra.slice(0, 3).map(t => ({ id: newId(), text: t, done: false })),
          ]
          setAiEnhanced(true)
        }
      }
    } catch { /* use template only */ }

    const next = [base, ...roadmaps]
    persist(next)
    setActive(base)
    setShowNew(false)
    setGenerating(false)
    setForm({ targetRole: "", targetCompany: "", currentRole: "", biggestGap: "", timeline: 90, visaStatus: "H1B" })
  }

  function toggleTask(milestoneId: string, taskId: string) {
    if (!active) return
    const updated = {
      ...active,
      lastUpdated: today(),
      milestones: active.milestones.map(m =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
          : m
      ),
    }
    setActive(updated)
    persist(roadmaps.map(r => r.id === updated.id ? updated : r))
  }

  function deleteRoadmap(id: string) {
    const next = roadmaps.filter(r => r.id !== id)
    persist(next)
    setActive(next[0] || null)
  }

  /* Stats */
  const totalTasks   = active?.milestones.flatMap(m => m.tasks).length || 0
  const doneTasks    = active?.milestones.flatMap(m => m.tasks).filter(t => t.done).length || 0
  const pct          = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const currentWeek  = active ? Math.max(1, Math.ceil((Date.now() - new Date(active.createdAt).getTime()) / (7 * 86400000))) : 1
  const elapsedDays  = active ? Math.floor((Date.now() - new Date(active.createdAt).getTime()) / 86400000) : 0

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>Career Roadmap</h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>AI-generated 30/60/90-day action plans · Track milestones · Land your target role</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {roadmaps.length > 1 && (
            <select value={active?.id || ""} onChange={e => setActive(roadmaps.find(r => r.id === e.target.value) || null)}
              style={{ padding: "8px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, color: "#1a2035", background: "#fff", outline: "none" }}>
              {roadmaps.map(r => <option key={r.id} value={r.id}>{r.targetRole} ({r.timeline}d)</option>)}
            </select>
          )}
          <button onClick={() => setShowNew(true)}
            style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
            + New Roadmap
          </button>
        </div>
      </div>

      {/* No roadmap yet */}
      {!active && !showNew && (
        <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 16, padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🗺️</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1a2035", marginBottom: 8 }}>Build your 90-day career plan</div>
          <div style={{ fontSize: 14, color: "#6b7a99", maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.65 }}>
            Tell the AI your target role and where you are now. Get a week-by-week action plan with specific tasks for skills, networking, applications, and interview prep.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 540, margin: "0 auto 32px" }}>
            {[
              { icon: "🧠", label: "Skill roadmap", desc: "Know exactly what to learn and in what order" },
              { icon: "🤝", label: "Network plan", desc: "Who to reach out to and when" },
              { icon: "📊", label: "Progress tracking", desc: "Check off tasks as you complete them" },
            ].map(f => (
              <div key={f.label} style={{ background: "#f8f9fc", borderRadius: 10, padding: "14px 12px" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a2035", marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 11.5, color: "#6b7a99" }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ padding: "12px 32px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
            Create My Roadmap →
          </button>
        </div>
      )}

      {/* Active roadmap */}
      {active && (
        <>
          {/* Overview bar */}
          <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#1a2035", marginBottom: 2 }}>
                  {active.targetRole}
                  {active.targetCompany && <span style={{ fontSize: 14, fontWeight: 600, color: "#6b7a99" }}> at {active.targetCompany}</span>}
                </div>
                <div style={{ fontSize: 13, color: "#6b7a99" }}>
                  {active.timeline}-day plan · Day {elapsedDays} · Week {currentWeek} of {Math.ceil(active.timeline / 7)}
                  {active.visaStatus && <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", background: "#eff6ff", color: "var(--accent)", borderRadius: 100, fontWeight: 600 }}>{active.visaStatus}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: pct >= 75 ? "#10b981" : pct >= 40 ? "var(--accent)" : "#f59e0b", letterSpacing: "-0.5px" }}>{pct}%</div>
                  <div style={{ fontSize: 11.5, color: "#aab3c5" }}>{doneTasks}/{totalTasks} tasks</div>
                </div>
                <button onClick={() => deleteRoadmap(active.id)}
                  style={{ padding: "6px 10px", background: "transparent", border: "1px solid #fecaca", borderRadius: 7, color: "#ef4444", cursor: "pointer", fontSize: 12 }}>
                  Delete
                </button>
              </div>
            </div>
            <div style={{ height: 10, background: "#f1f4f9", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: pct >= 75 ? "#10b981" : "var(--accent)", borderRadius: 100, transition: "width .5s ease" }}/>
            </div>

            {/* Category breakdown */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {Object.entries(CAT_META).map(([key, meta]) => {
                const catMilestones = active.milestones.filter(m => m.category === key)
                if (!catMilestones.length) return null
                const catTasks = catMilestones.flatMap(m => m.tasks)
                const catDone  = catTasks.filter(t => t.done).length
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: meta.bg, borderRadius: 100 }}>
                    <span style={{ fontSize: 12 }}>{meta.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: meta.color + "99" }}>{catDone}/{catTasks.length}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Milestones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {active.milestones.map(milestone => {
              const meta      = CAT_META[milestone.category]
              const donePct   = milestone.tasks.length > 0 ? Math.round(milestone.tasks.filter(t => t.done).length / milestone.tasks.length * 100) : 0
              const isCurrent = milestone.week === currentWeek
              const isPast    = milestone.week < currentWeek
              return (
                <div key={milestone.id} style={{
                  background: "#fff",
                  border: `1.5px solid ${isCurrent ? meta.color + "44" : "#e4e8ef"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: isCurrent ? `0 4px 16px ${meta.color}10` : "none",
                }}>
                  {/* Week header */}
                  <div style={{ padding: "14px 20px", background: isCurrent ? meta.bg : "#fff", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f1f4f9" }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#1a2035" }}>Week {milestone.week}: {milestone.title}</span>
                        {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: meta.color, color: "#fff", borderRadius: 100 }}>This week</span>}
                        {isPast && donePct === 100 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 100 }}>✓ Complete</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7a99", marginTop: 2 }}>{meta.label} · {milestone.tasks.filter(t => t.done).length}/{milestone.tasks.length} tasks done</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 48, height: 6, background: "#f1f4f9", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: donePct + "%", background: meta.color, borderRadius: 100 }}/>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color }}>{donePct}%</span>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {milestone.tasks.map(task => (
                      <label key={task.id}
                        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "6px 0" }}>
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleTask(milestone.id, task.id)}
                          style={{ marginTop: 2, width: 16, height: 16, accentColor: meta.color, flexShrink: 0, cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: 13.5, color: task.done ? "#aab3c5" : "#1a2035", lineHeight: 1.5,
                            textDecoration: task.done ? "line-through" : "none",
                          }}>
                            {task.text}
                          </span>
                          {task.dueDate && !task.done && (
                            <div style={{ fontSize: 11, color: "#aab3c5", marginTop: 2 }}>
                              Due {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── NEW ROADMAP MODAL ───────────────────────────────────────── */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !generating) setShowNew(false) }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 4 }}>Create Career Roadmap</div>
            <div style={{ fontSize: 13, color: "#6b7a99", marginBottom: 20 }}>The more detail you give, the more personalized your plan</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={LS}>Target Role *</label>
                <input value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))}
                  placeholder="Senior Cloud Security Engineer" style={IS}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Target Company (optional)</label>
                  <input value={form.targetCompany} onChange={e => setForm(p => ({ ...p, targetCompany: e.target.value }))}
                    placeholder="Palo Alto Networks" style={IS}/>
                </div>
                <div>
                  <label style={LS}>Your Current Role</label>
                  <input value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))}
                    placeholder="Security Analyst" style={IS}/>
                </div>
              </div>
              <div>
                <label style={LS}>Biggest Skill Gap (be specific)</label>
                <input value={form.biggestGap} onChange={e => setForm(p => ({ ...p, biggestGap: e.target.value }))}
                  placeholder="e.g. cloud security (Azure), no hands-on ICS/OT experience" style={IS}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Visa Status</label>
                  <select value={form.visaStatus} onChange={e => setForm(p => ({ ...p, visaStatus: e.target.value }))} style={IS}>
                    {["H1B", "OPT/CPT", "Green Card", "US Citizen", "TN Visa", "Other"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Timeline</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([30, 60, 90] as TimelineOption[]).map(t => (
                      <button key={t} onClick={() => setForm(p => ({ ...p, timeline: t }))}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 700, fontSize: 13.5, border: "1.5px solid",
                          borderColor: form.timeline === t ? "var(--accent)" : "#e4e8ef",
                          background: form.timeline === t ? "rgba(29,111,196,0.07)" : "#fff",
                          color: form.timeline === t ? "var(--accent)" : "#6b7a99", cursor: "pointer" }}>
                        {t}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={generateRoadmap} disabled={!form.targetRole.trim() || generating}
                style={{ flex: 1, padding: "12px", background: form.targetRole.trim() ? "var(--accent)" : "#e4e8ef", color: form.targetRole.trim() ? "#fff" : "#aab3c5", border: "none", borderRadius: 9, fontWeight: 700, cursor: form.targetRole.trim() ? "pointer" : "default", fontSize: 14 }}>
                {generating ? "Generating your plan…" : "✨ Generate My Roadmap"}
              </button>
              <button onClick={() => setShowNew(false)} disabled={generating}
                style={{ padding: "12px 18px", background: "transparent", color: "#6b7a99", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LS: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 5 }
const IS: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13.5, outline: "none", color: "#1a2035", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" }
