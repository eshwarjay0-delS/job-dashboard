"use client"

import { useState, useEffect } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type Difficulty = "easy" | "medium" | "hard"
type Status     = "unsolved" | "attempted" | "solved"
type Category   = "DSA" | "System Design" | "Security/CTF" | "SQL" | "Behavioral"

interface Problem {
  id: string
  title: string
  category: Category
  difficulty: Difficulty
  status: Status
  notes: string
  source?: string        // e.g. "LeetCode #217", "HackTheBox"
  solvedAt?: string
  attemptedAt?: string
  timeToSolve?: number  // minutes
  tags: string[]
}

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const DIFF_META: Record<Difficulty, { label: string; color: string; bg: string }> = {
  easy:   { label: "Easy",   color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  hard:   { label: "Hard",   color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string; icon: string }> = {
  unsolved:  { label: "Unsolved",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: "○" },
  attempted: { label: "Attempted", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: "◑" },
  solved:    { label: "Solved",    color: "#10b981", bg: "rgba(16,185,129,0.1)",  icon: "✓" },
}

const CAT_META: Record<Category, { icon: string; color: string; desc: string }> = {
  "DSA":           { icon: "🔢", color: "#8b5cf6", desc: "Data structures, algorithms, LeetCode"       },
  "System Design": { icon: "🏗️", color: "#1d6fc4", desc: "Scalable systems, architecture patterns"     },
  "Security/CTF":  { icon: "🔐", color: "#ef4444", desc: "Offensive security, CTF challenges, pentesting" },
  "SQL":           { icon: "🗄️", color: "#10b981", desc: "Queries, optimization, database design"        },
  "Behavioral":    { icon: "🧠", color: "#f59e0b", desc: "STAR stories, leadership, conflict resolution"  },
}

const CATEGORIES: Category[] = ["DSA", "System Design", "Security/CTF", "SQL", "Behavioral"]

/* Seed problem bank */
const SEED_PROBLEMS: Omit<Problem, "id" | "notes" | "solvedAt" | "attemptedAt">[] = [
  // DSA
  { title: "Two Sum",                        category: "DSA",           difficulty: "easy",   status: "unsolved", tags: ["arrays", "hash map"],          source: "LeetCode #1"  },
  { title: "Valid Parentheses",              category: "DSA",           difficulty: "easy",   status: "unsolved", tags: ["stack", "string"],             source: "LeetCode #20" },
  { title: "Merge Two Sorted Lists",         category: "DSA",           difficulty: "easy",   status: "unsolved", tags: ["linked list"],                  source: "LeetCode #21" },
  { title: "Longest Substring Without Repeating", category: "DSA",     difficulty: "medium", status: "unsolved", tags: ["sliding window", "hash map"],   source: "LeetCode #3"  },
  { title: "3Sum",                           category: "DSA",           difficulty: "medium", status: "unsolved", tags: ["two pointers", "sorting"],      source: "LeetCode #15" },
  { title: "Binary Tree Level Order Traversal", category: "DSA",       difficulty: "medium", status: "unsolved", tags: ["BFS", "tree"],                  source: "LeetCode #102"},
  { title: "Word Search",                    category: "DSA",           difficulty: "medium", status: "unsolved", tags: ["backtracking", "DFS"],          source: "LeetCode #79" },
  { title: "Merge K Sorted Lists",           category: "DSA",           difficulty: "hard",   status: "unsolved", tags: ["heap", "linked list"],          source: "LeetCode #23" },
  { title: "Median of Two Sorted Arrays",    category: "DSA",           difficulty: "hard",   status: "unsolved", tags: ["binary search", "divide & conquer"], source: "LeetCode #4" },
  // System Design
  { title: "Design a URL Shortener (TinyURL)", category: "System Design", difficulty: "medium", status: "unsolved", tags: ["hashing", "NoSQL", "cache"],   source: "System Design" },
  { title: "Design Twitter Feed",             category: "System Design", difficulty: "hard",   status: "unsolved", tags: ["fanout", "CDN", "sharding"],    source: "System Design" },
  { title: "Design a Rate Limiter",           category: "System Design", difficulty: "medium", status: "unsolved", tags: ["sliding window", "Redis"],      source: "System Design" },
  { title: "Design a Distributed Cache",      category: "System Design", difficulty: "hard",   status: "unsolved", tags: ["consistent hashing", "TTL"],    source: "System Design" },
  { title: "Design Notification System",      category: "System Design", difficulty: "medium", status: "unsolved", tags: ["pub/sub", "queues", "push/pull"], source: "System Design"},
  // Security/CTF
  { title: "SQL Injection Basics",           category: "Security/CTF",  difficulty: "easy",   status: "unsolved", tags: ["OWASP", "SQLi", "web"],          source: "TryHackMe"   },
  { title: "Buffer Overflow Exploitation",    category: "Security/CTF",  difficulty: "hard",   status: "unsolved", tags: ["binary exploitation", "OSCP"],   source: "HackTheBox"  },
  { title: "XSS Reflected/Stored",           category: "Security/CTF",  difficulty: "easy",   status: "unsolved", tags: ["OWASP Top 10", "DOM"],           source: "PortSwigger" },
  { title: "SAST: Identify SSRF Vulnerability", category: "Security/CTF", difficulty: "medium", status: "unsolved", tags: ["AppSec", "SSRF", "code review"], source: "AppSec" },
  { title: "Privilege Escalation Linux",     category: "Security/CTF",  difficulty: "medium", status: "unsolved", tags: ["Linux", "SUID", "cron"],         source: "HackTheBox"  },
  { title: "Reverse Shell via Command Injection", category: "Security/CTF", difficulty: "medium", status: "unsolved", tags: ["RCE", "bash", "web"],         source: "TryHackMe"  },
  // SQL
  { title: "Rank Employees by Salary (DENSE_RANK)", category: "SQL",   difficulty: "medium", status: "unsolved", tags: ["window functions", "ranking"],    source: "LeetCode SQL" },
  { title: "Find Customers Who Never Order",  category: "SQL",           difficulty: "easy",   status: "unsolved", tags: ["LEFT JOIN", "NULL check"],       source: "LeetCode #183"},
  { title: "Department Top 3 Salaries",       category: "SQL",           difficulty: "hard",   status: "unsolved", tags: ["subquery", "GROUP BY"],          source: "LeetCode #185"},
  { title: "Consecutive Available Seats",     category: "SQL",           difficulty: "medium", status: "unsolved", tags: ["self-join", "sequence"],         source: "LeetCode #603"},
  // Behavioral
  { title: "Tell me about yourself",          category: "Behavioral",    difficulty: "easy",   status: "unsolved", tags: ["elevator pitch", "STAR"],        source: "Universal"   },
  { title: "Greatest weakness",               category: "Behavioral",    difficulty: "medium", status: "unsolved", tags: ["self-awareness", "growth"],      source: "Universal"   },
  { title: "Conflict with a coworker",        category: "Behavioral",    difficulty: "medium", status: "unsolved", tags: ["leadership", "communication"],   source: "STAR"        },
  { title: "Why do you want to leave?",       category: "Behavioral",    difficulty: "medium", status: "unsolved", tags: ["honesty", "diplomacy"],          source: "Universal"   },
  { title: "Most challenging project",        category: "Behavioral",    difficulty: "hard",   status: "unsolved", tags: ["technical depth", "STAR"],       source: "STAR"        },
]

function newId() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }

function makeProblems(): Problem[] {
  return SEED_PROBLEMS.map(p => ({
    ...p, id: newId(), notes: "", solvedAt: undefined, attemptedAt: undefined, timeToSolve: undefined,
  }))
}

function getStreak(problems: Problem[]): number {
  const solved = problems.filter(p => p.solvedAt).sort((a, b) => b.solvedAt!.localeCompare(a.solvedAt!))
  if (!solved.length) return 0
  let streak = 0
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  for (const p of solved) {
    const d = new Date(p.solvedAt!); d.setHours(0, 0, 0, 0)
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000)
    if (diff <= 1) { streak++; cursor = d } else break
  }
  return streak
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function TechPrepPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [activeTab, setActiveTab]   = useState<Category | "All">("All")
  const [filterDiff, setFilterDiff] = useState<Difficulty | "all">("all")
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Problem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newProblem, setNewProblem] = useState<Partial<Problem>>({ category: "DSA", difficulty: "medium", status: "unsolved", tags: [] })

  useEffect(() => {
    try {
      const s = localStorage.getItem("jd_tech_prep_v1")
      if (s) setProblems(JSON.parse(s))
      else {
        const seed = makeProblems()
        setProblems(seed)
        localStorage.setItem("jd_tech_prep_v1", JSON.stringify(seed))
      }
    } catch {
      const seed = makeProblems()
      setProblems(seed)
    }
  }, [])

  function persist(next: Problem[]) {
    setProblems(next)
    localStorage.setItem("jd_tech_prep_v1", JSON.stringify(next))
  }

  function cycleStatus(id: string) {
    const order: Status[] = ["unsolved", "attempted", "solved"]
    const next = problems.map(p => {
      if (p.id !== id) return p
      const nextStatus = order[(order.indexOf(p.status) + 1) % 3]
      return {
        ...p,
        status: nextStatus,
        solvedAt:    nextStatus === "solved"    ? today() : p.solvedAt,
        attemptedAt: nextStatus === "attempted" ? today() : p.attemptedAt,
      }
    })
    persist(next)
  }

  function saveEdit() {
    if (!editing) return
    persist(problems.map(p => p.id === editing.id ? editing : p))
    setEditing(null)
  }

  function addProblem() {
    if (!newProblem.title?.trim()) return
    const p: Problem = {
      id: newId(),
      title: newProblem.title!,
      category: newProblem.category as Category || "DSA",
      difficulty: newProblem.difficulty as Difficulty || "medium",
      status: "unsolved",
      notes: newProblem.notes || "",
      source: newProblem.source || "",
      tags: (typeof newProblem.tags === "string"
        ? (newProblem.tags as unknown as string).split(",").map((t: string) => t.trim()).filter(Boolean)
        : newProblem.tags || []) as string[],
    }
    persist([...problems, p])
    setNewProblem({ category: "DSA", difficulty: "medium", status: "unsolved", tags: [] })
    setShowAdd(false)
  }

  function deleteProblem(id: string) {
    persist(problems.filter(p => p.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  /* Filtered list */
  const filtered = problems.filter(p => {
    if (activeTab !== "All" && p.category !== activeTab) return false
    if (filterDiff !== "all" && p.difficulty !== filterDiff) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.tags.join(" ").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  /* Stats */
  const solved   = problems.filter(p => p.status === "solved").length
  const attempted = problems.filter(p => p.status === "attempted").length
  const streak   = getStreak(problems)
  const todaySolved = problems.filter(p => p.solvedAt === today()).length

  /* Per-category solved counts */
  const catStats = CATEGORIES.reduce((acc, cat) => {
    const catP = problems.filter(p => p.category === cat)
    acc[cat] = { total: catP.length, solved: catP.filter(p => p.status === "solved").length }
    return acc
  }, {} as Record<Category, { total: number; solved: number }>)

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1040, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>Technical Prep Tracker</h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>DSA · System Design · Security/CTF · SQL · Behavioral — track your practice, build your streak</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}>
          + Add Problem
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Solved",    value: solved,      sub: `of ${problems.length} total`,      color: "#10b981" },
          { label: "Attempted", value: attempted,   sub: "in progress",                      color: "#f59e0b" },
          { label: "🔥 Streak",  value: streak,      sub: streak === 1 ? "day" : "days",     color: "#ef4444" },
          { label: "Today",     value: todaySolved,  sub: "solved today",                    color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, letterSpacing: "-0.5px" }}>{s.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a2035", marginBottom: 1 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "#aab3c5" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Category progress bars */}
      <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", marginBottom: 12 }}>Progress by Category</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {CATEGORIES.map(cat => {
            const meta = CAT_META[cat]
            const s    = catStats[cat]
            const pct  = s.total > 0 ? Math.round(s.solved / s.total * 100) : 0
            return (
              <button key={cat} onClick={() => setActiveTab(cat === activeTab ? "All" : cat)}
                style={{ textAlign: "left", background: activeTab === cat ? `${meta.color}10` : "#f8f9fc", border: `1.5px solid ${activeTab === cat ? meta.color + "40" : "#f1f4f9"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{meta.icon}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>{cat}</div>
                <div style={{ height: 5, background: "#e4e8ef", borderRadius: 100, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: pct + "%", background: meta.color, borderRadius: 100 }}/>
                </div>
                <div style={{ fontSize: 10.5, color: "#6b7a99" }}>{s.solved}/{s.total}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search problems or tags…"
          style={{ padding: "8px 12px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13, flex: "1 1 200px", outline: "none", color: "#1a2035" }}/>
        {(["all", "easy", "medium", "hard"] as const).map(d => (
          <button key={d} onClick={() => setFilterDiff(d)}
            style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid",
              borderColor: filterDiff === d ? (d === "all" ? "var(--accent)" : DIFF_META[d]?.color || "var(--accent)") : "#e4e8ef",
              background: filterDiff === d ? (d === "all" ? "rgba(29,111,196,0.08)" : DIFF_META[d]?.bg || "rgba(29,111,196,0.08)") : "#fff",
              color: filterDiff === d ? (d === "all" ? "var(--accent)" : DIFF_META[d]?.color || "var(--accent)") : "#6b7a99" }}>
            {d === "all" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
        {(["all", "unsolved", "attempted", "solved"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid",
              borderColor: filterStatus === s ? "var(--accent)" : "#e4e8ef",
              background: filterStatus === s ? "rgba(29,111,196,0.08)" : "#fff",
              color: filterStatus === s ? "var(--accent)" : "#6b7a99" }}>
            {s === "all" ? "All Status" : STATUS_META[s].label}
          </button>
        ))}
        {(activeTab !== "All" || filterDiff !== "all" || filterStatus !== "all" || search) && (
          <button onClick={() => { setActiveTab("All"); setFilterDiff("all"); setFilterStatus("all"); setSearch("") }}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, color: "#ef4444", border: "1px solid #fecaca", background: "#fff", cursor: "pointer" }}>
            Clear
          </button>
        )}
        <span style={{ fontSize: 12.5, color: "#aab3c5", marginLeft: "auto" }}>{filtered.length} problems</span>
      </div>

      {/* Problem List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, color: "#aab3c5" }}>
            No problems match your filters
          </div>
        )}
        {filtered.map(p => {
          const diff   = DIFF_META[p.difficulty]
          const status = STATUS_META[p.status]
          const cat    = CAT_META[p.category]
          return (
            <div key={p.id} style={{
              background: "#fff",
              border: `1px solid ${p.status === "solved" ? "#bbf7d0" : p.status === "attempted" ? "#fde68a" : "#e4e8ef"}`,
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}>
              {/* Status toggle */}
              <button onClick={() => cycleStatus(p.id)} title={`Mark as ${p.status === "solved" ? "unsolved" : p.status === "unsolved" ? "attempted" : "solved"}`}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0, marginTop: 1,
                  background: status.bg, color: status.color, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {status.icon}
              </button>

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, textDecoration: p.status === "solved" ? "line-through" : "none", color: p.status === "solved" ? "#94a3b8" : "#1a2035" }}>
                    {p.title}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: diff.bg, color: diff.color, fontWeight: 700 }}>
                    {diff.label}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: `${cat.color}12`, color: cat.color, fontWeight: 600 }}>
                    {cat.icon} {p.category}
                  </span>
                  {p.source && <span style={{ fontSize: 11, color: "#aab3c5" }}>{p.source}</span>}
                </div>
                {p.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {p.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: "1px 7px", background: "#f1f5f9", borderRadius: 100, color: "#64748b" }}>{t}</span>
                    ))}
                  </div>
                )}
                {p.notes && (
                  <div style={{ fontSize: 12, color: "#6b7a99", marginTop: 5, fontStyle: "italic", borderLeft: "2px solid #e4e8ef", paddingLeft: 8 }}>
                    {p.notes}
                  </div>
                )}
                {(p.solvedAt || p.attemptedAt) && (
                  <div style={{ fontSize: 11, color: "#aab3c5", marginTop: 4 }}>
                    {p.solvedAt ? `Solved ${p.solvedAt}` : p.attemptedAt ? `Attempted ${p.attemptedAt}` : ""}
                    {p.timeToSolve ? ` · ${p.timeToSolve}m` : ""}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <button onClick={() => setEditing({ ...p })}
                  style={{ padding: "5px 10px", background: "transparent", border: "1px solid #e4e8ef", borderRadius: 7, fontSize: 12, color: "#6b7a99", cursor: "pointer" }}>
                  Edit
                </button>
                <button onClick={() => deleteProblem(p.id)}
                  style={{ padding: "5px 10px", background: "transparent", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#ef4444", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── EDIT DRAWER ──────────────────────────────────────────────── */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div style={{ width: "min(460px, 95vw)", background: "#fff", height: "100%", overflow: "auto", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f4f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1a2035" }}>Edit Problem</div>
              <button onClick={() => setEditing(null)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7a99" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={LS}>Title</label>
                <input value={editing.title} onChange={e => setEditing(p => p ? { ...p, title: e.target.value } : p)} style={IS}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Category</label>
                  <select value={editing.category} onChange={e => setEditing(p => p ? { ...p, category: e.target.value as Category } : p)} style={IS}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Difficulty</label>
                  <select value={editing.difficulty} onChange={e => setEditing(p => p ? { ...p, difficulty: e.target.value as Difficulty } : p)} style={IS}>
                    {(["easy", "medium", "hard"] as Difficulty[]).map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Status</label>
                  <select value={editing.status} onChange={e => setEditing(p => p ? { ...p, status: e.target.value as Status } : p)} style={IS}>
                    {(["unsolved", "attempted", "solved"] as Status[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Time to Solve (min)</label>
                  <input type="number" value={editing.timeToSolve || ""} onChange={e => setEditing(p => p ? { ...p, timeToSolve: parseInt(e.target.value) || undefined } : p)} style={IS} placeholder="e.g. 25"/>
                </div>
              </div>
              <div>
                <label style={LS}>Source / Platform</label>
                <input value={editing.source || ""} onChange={e => setEditing(p => p ? { ...p, source: e.target.value } : p)} placeholder="LeetCode #42, HackTheBox, etc." style={IS}/>
              </div>
              <div>
                <label style={LS}>Tags (comma-separated)</label>
                <input value={editing.tags.join(", ")} onChange={e => setEditing(p => p ? { ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } : p)} placeholder="arrays, hash map, greedy" style={IS}/>
              </div>
              <div>
                <label style={LS}>Notes / Approach</label>
                <textarea value={editing.notes} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : p)}
                  rows={5} placeholder="Key insight, your approach, where you got stuck…"
                  style={{ ...IS, resize: "vertical" }}/>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f4f9", display: "flex", gap: 10 }}>
              <button onClick={saveEdit} style={{ flex: 1, padding: "10px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>
                Save
              </button>
              <button onClick={() => { deleteProblem(editing.id); setEditing(null) }} style={{ padding: "10px 16px", background: "transparent", border: "1px solid #fecaca", borderRadius: 9, color: "#ef4444", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MODAL ──────────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", marginBottom: 16 }}>Add Problem</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={LS}>Title *</label>
                <input value={newProblem.title || ""} onChange={e => setNewProblem(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Two Sum" style={IS}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={LS}>Category</label>
                  <select value={newProblem.category} onChange={e => setNewProblem(p => ({ ...p, category: e.target.value as Category }))} style={IS}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Difficulty</label>
                  <select value={newProblem.difficulty} onChange={e => setNewProblem(p => ({ ...p, difficulty: e.target.value as Difficulty }))} style={IS}>
                    {["easy", "medium", "hard"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Source</label>
                  <input value={newProblem.source || ""} onChange={e => setNewProblem(p => ({ ...p, source: e.target.value }))} placeholder="LeetCode #1" style={IS}/>
                </div>
              </div>
              <div>
                <label style={LS}>Tags</label>
                <input value={typeof newProblem.tags === "string" ? newProblem.tags : (newProblem.tags || []).join(", ")}
                  onChange={e => setNewProblem(p => ({ ...p, tags: e.target.value as unknown as string[] }))}
                  placeholder="arrays, two pointers, etc." style={IS}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={addProblem} disabled={!newProblem.title?.trim()}
                style={{ flex: 1, padding: "10px", background: newProblem.title?.trim() ? "var(--accent)" : "#e4e8ef", color: newProblem.title?.trim() ? "#fff" : "#aab3c5", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>
                Add Problem
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ padding: "10px 16px", background: "transparent", border: "1.5px solid #e4e8ef", borderRadius: 9, cursor: "pointer", color: "#6b7a99" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LS: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#6b7a99", display: "block", marginBottom: 5 }
const IS: React.CSSProperties = { width: "100%", padding: "8px 11px", border: "1.5px solid #e4e8ef", borderRadius: 8, fontSize: 13, outline: "none", color: "#1a2035", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" }
