"use client"

import { useState, useEffect, useRef } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Question {
  id: string
  text: string
  category: string
  difficulty: "easy" | "medium" | "hard"
  tip: string
  tags: string[]
}

interface STARScore {
  situation: number   // 0–25
  task: number        // 0–25
  action: number      // 0–25
  result: number      // 0–25
  total: number       // 0–100
  grade: "A" | "B" | "C" | "D" | "F"
  feedback: string
  strengths: string[]
  improvements: string[]
}

interface SessionEntry {
  questionId: string
  questionText: string
  category: string
  answer: string
  score: STARScore
  ts: number
}

/* ═══════════════════════════════════════════════════════════════════
   QUESTION BANK
   ═══════════════════════════════════════════════════════════════════ */
const QUESTIONS: Question[] = [
  // Behavioral
  { id: "b1", text: "Tell me about a time you faced a significant challenge at work and how you handled it.", category: "Behavioral", difficulty: "medium", tip: "Use STAR. Quantify the result — numbers make it real.", tags: ["STAR", "Problem-solving"] },
  { id: "b2", text: "Describe a situation where you had to work with a difficult team member. How did you resolve it?", category: "Behavioral", difficulty: "medium", tip: "Focus on resolution and empathy, not the conflict itself.", tags: ["STAR", "Teamwork"] },
  { id: "b3", text: "Tell me about your greatest professional achievement.", category: "Behavioral", difficulty: "easy", tip: "Be specific. Pick something with a clear, measurable impact.", tags: ["STAR", "Impact"] },
  { id: "b4", text: "Describe a time you failed and what you learned from it.", category: "Behavioral", difficulty: "medium", tip: "Own the failure in 2 sentences. Spend the rest on the lesson.", tags: ["STAR", "Growth"] },
  { id: "b5", text: "Tell me about a time you had to deliver results under a very tight deadline.", category: "Behavioral", difficulty: "hard", tip: "Show prioritization logic. Name the tradeoff you made.", tags: ["STAR", "Time Management"] },
  { id: "b6", text: "Describe a situation where you had to influence others without direct authority.", category: "Behavioral", difficulty: "hard", tip: "Name your stakeholders, your approach, and the measurable outcome.", tags: ["STAR", "Leadership"] },
  { id: "b7", text: "Tell me about a time you proactively identified and fixed a problem before it became critical.", category: "Behavioral", difficulty: "medium", tip: "This is a leadership signal. Quantify the potential impact you avoided.", tags: ["STAR", "Initiative"] },
  { id: "b8", text: "Describe a time when you disagreed with your manager's decision. What did you do?", category: "Behavioral", difficulty: "hard", tip: "Show you can disagree respectfully and commit to the outcome.", tags: ["STAR", "Conflict", "Professionalism"] },
  // Technical / Security
  { id: "t1", text: "Walk me through how you'd respond to a ransomware incident in a corporate environment.", category: "Security", difficulty: "hard", tip: "Cover: detection, isolation, communication, recovery, post-mortem. Name specific tools.", tags: ["Incident Response", "Technical"] },
  { id: "t2", text: "Explain the difference between authentication and authorization. Give a real-world example of each.", category: "Technical", difficulty: "easy", tip: "AuthN = who are you. AuthZ = what can you do. Use a concrete system example.", tags: ["Security", "IAM"] },
  { id: "t3", text: "How would you perform a penetration test on a web application? Walk me through your methodology.", category: "Security", difficulty: "hard", tip: "OWASP methodology: recon → scanning → exploitation → post-exploit → reporting.", tags: ["PenTest", "AppSec"] },
  { id: "t4", text: "What is the CIA triad and how does it apply to a real security decision you've made?", category: "Security", difficulty: "easy", tip: "Don't just define it — apply it to a specific architectural or policy decision.", tags: ["Security Fundamentals"] },
  { id: "t5", text: "Explain how zero-trust architecture differs from a perimeter-based security model.", category: "Security", difficulty: "medium", tip: "'Never trust, always verify.' Cover identity, micro-segmentation, device posture.", tags: ["Architecture", "Zero Trust"] },
  { id: "t6", text: "How would you design a SIEM alerting strategy to reduce alert fatigue without missing real threats?", category: "Security", difficulty: "hard", tip: "Cover: tuning baselines, severity tiering, correlation rules, feedback loops with SOC analysts.", tags: ["SIEM", "SOC", "Detection Engineering"] },
  // System Design
  { id: "s1", text: "Design a job application tracking system that handles 1 million users with real-time status updates.", category: "System Design", difficulty: "hard", tip: "Cover: data model, WebSockets/SSE for real-time, read/write scaling, search indexing.", tags: ["System Design", "Scalability"] },
  { id: "s2", text: "How would you design a notification system that sends emails, push alerts, and SMS across 10M users?", category: "System Design", difficulty: "hard", tip: "Queue-based architecture (SQS/Kafka), idempotency, retry/DLQ, rate limiting per channel.", tags: ["System Design", "Distributed Systems"] },
  // Role-specific
  { id: "r1", text: "Why do you want to transition to this role specifically, and what unique value do you bring?", category: "Role Fit", difficulty: "easy", tip: "Be specific about this company, this team, this problem space. Generic answers fail here.", tags: ["Motivation", "Role Fit"] },
  { id: "r2", text: "Where do you see your career in 3–5 years, and how does this role fit into that trajectory?", category: "Role Fit", difficulty: "medium", tip: "Align your ambition with the team's growth. Avoid 'your job' as the answer.", tags: ["Career", "Motivation"] },
  { id: "r3", text: "What's a technical skill you've been actively improving in the past 6 months and why?", category: "Role Fit", difficulty: "easy", tip: "Be specific about what, how, and measurable progress. Vague answers are red flags.", tags: ["Growth", "Technical"] },
]

const CATEGORIES = ["All", ...Array.from(new Set(QUESTIONS.map(q => q.category)))]
const DIFFICULTY_COLOR = { easy: "#10b981", medium: "#f59e0b", hard: "#ef4444" }
const GRADE_COLOR: Record<string, string> = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" }

function gradeFromScore(total: number): "A" | "B" | "C" | "D" | "F" {
  if (total >= 85) return "A"
  if (total >= 70) return "B"
  if (total >= 55) return "C"
  if (total >= 40) return "D"
  return "F"
}

function readinessLabel(avg: number): { label: string; color: string; desc: string } {
  if (avg >= 85) return { label: "Interview Ready", color: "#10b981", desc: "Your answers are consistently strong. Go get that offer." }
  if (avg >= 70) return { label: "Getting There",   color: "#3b82f6", desc: "Solid foundation. Focus on adding metrics to your results." }
  if (avg >= 55) return { label: "Needs Practice",  color: "#f59e0b", desc: "Good instincts but answers lack specificity and quantification." }
  return              { label: "Keep Practicing",   color: "#ef4444", desc: "Structure your answers with STAR. Practice out loud daily." }
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function MockInterviewPage() {
  const [category, setCategory]   = useState("All")
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all")
  const [current, setCurrent]     = useState<Question | null>(null)
  const [answer, setAnswer]       = useState("")
  const [wordCount, setWordCount] = useState(0)
  const [scoring, setScoring]     = useState(false)
  const [score, setScore]         = useState<STARScore | null>(null)
  const [session, setSession]     = useState<SessionEntry[]>([])
  const [view, setView]           = useState<"practice" | "history">("practice")
  const [showTip, setShowTip]     = useState(false)
  const [timer, setTimer]         = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem("jd_mock_interview_v1")
      if (s) setSession(JSON.parse(s))
    } catch {}
  }, [])

  useEffect(() => {
    if (session.length > 0) localStorage.setItem("jd_mock_interview_v1", JSON.stringify(session.slice(-50)))
  }, [session])

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  function fmtTimer(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  }

  function pickQuestion() {
    const pool = QUESTIONS.filter(q => {
      const catMatch = category === "All" || q.category === category
      const diffMatch = difficulty === "all" || q.difficulty === difficulty
      return catMatch && diffMatch
    })
    if (!pool.length) return
    const q = pool[Math.floor(Math.random() * pool.length)]
    setCurrent(q)
    setAnswer("")
    setWordCount(0)
    setScore(null)
    setShowTip(false)
    setTimer(0)
    setTimerRunning(true)
  }

  function handleAnswerChange(v: string) {
    setAnswer(v)
    setWordCount(v.trim().split(/\s+/).filter(Boolean).length)
  }

  async function submitAnswer() {
    if (!current || !answer.trim() || answer.trim().split(/\s+/).length < 20) return
    setTimerRunning(false)
    setScoring(true)

    // Build STAR-evaluation prompt
    const prompt = `You are an expert interview coach. Evaluate this answer to a behavioral/technical interview question using the STAR framework. Score each component out of 25 and provide specific, actionable feedback.

QUESTION: "${current.text}"
CATEGORY: ${current.category}
ANSWER: "${answer}"
TIME TAKEN: ${fmtTimer(timer)}

Respond ONLY with a valid JSON object in exactly this format (no markdown, no explanation outside JSON):
{
  "situation": <0-25 integer>,
  "task": <0-25 integer>,
  "action": <0-25 integer>,
  "result": <0-25 integer>,
  "feedback": "<2-3 sentence overall assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific improvement 1>", "<specific improvement 2>"]
}

Scoring guide:
- situation (0-25): Is the context clear? Does the interviewer know when/where/what?
- task (0-25): Is the candidate's specific responsibility defined?
- action (0-25): Are the steps specific, personal (I not we), and detailed?
- result (0-25): Is there a measurable outcome? Numbers, percentages, time saved?

Be honest and specific. Vague answers with no metrics should score 8-14 on result. Generic answers without specific situation/task context should score 8-14 there.`

    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "mock_interview_score",
          instruction: prompt,
          current: answer,
        }),
      })
      const data = await res.json()
      const raw = data.result || data.text || data.content || ""

      // Parse JSON from response
      let parsed: Omit<STARScore, "total" | "grade">
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch?.[0] || raw)
      } catch {
        // Fallback scoring if parse fails
        const wc = answer.trim().split(/\s+/).length
        const base = Math.min(Math.round(wc / 3), 18)
        parsed = {
          situation: base, task: base - 2, action: base + 2, result: Math.max(base - 4, 5),
          feedback: "Your answer shows relevant experience. Focus on adding specific metrics to your results.",
          strengths: ["Relevant experience mentioned", "Clear communication style"],
          improvements: ["Add specific numbers or percentages to quantify results", "Make your individual contribution more explicit"],
        }
      }

      const total = (parsed.situation || 0) + (parsed.task || 0) + (parsed.action || 0) + (parsed.result || 0)
      const finalScore: STARScore = {
        ...parsed,
        total,
        grade: gradeFromScore(total),
      }
      setScore(finalScore)

      // Add to session
      const entry: SessionEntry = {
        questionId: current.id,
        questionText: current.text,
        category: current.category,
        answer,
        score: finalScore,
        ts: Date.now(),
      }
      setSession(prev => [entry, ...prev])
    } catch {
      setScore({
        situation: 15, task: 14, action: 16, result: 12, total: 57,
        grade: "C",
        feedback: "Unable to score right now — please try again.",
        strengths: [],
        improvements: [],
      })
    }
    setScoring(false)
  }

  /* Session stats */
  const avgScore = session.length > 0 ? Math.round(session.reduce((a, e) => a + e.score.total, 0) / session.length) : 0
  const readiness = readinessLabel(avgScore)

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.4px", marginBottom: 4 }}>AI Mock Interview</h1>
          <p style={{ fontSize: 13.5, color: "#6b7a99" }}>Practice STAR answers · Get instant AI scoring · Track readiness</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f1f4f9", borderRadius: 10, padding: 4 }}>
          {(["practice", "history"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "6px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: view === v ? "#fff" : "transparent", color: view === v ? "var(--accent)" : "#6b7a99",
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {v === "practice" ? "🎤 Practice" : `📋 History (${session.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRACTICE VIEW ─────────────────────────────────────────── */}
      {view === "practice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Readiness bar (shown after first answer) */}
          {session.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Session Readiness</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: readiness.color, letterSpacing: "-1px" }}>{avgScore}</span>
                  <span style={{ fontSize: 13, color: "#6b7a99" }}>/ 100 avg · {session.length} answered</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: "#f1f4f9", borderRadius: 100, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: avgScore + "%", background: readiness.color, borderRadius: 100, transition: "width .6s ease" }}/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: readiness.color }}>{readiness.label}</span>
                  <span style={{ fontSize: 12, color: "#aab3c5" }}>{readiness.desc}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7a99", marginBottom: 6 }}>Category</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)}
                      style={{ padding: "5px 11px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, border: "1.5px solid",
                        borderColor: category === c ? "var(--accent)" : "#e4e8ef",
                        background: category === c ? "rgba(29,111,196,0.07)" : "#fff",
                        color: category === c ? "var(--accent)" : "#6b7a99", cursor: "pointer" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7a99", marginBottom: 6 }}>Difficulty</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", "easy", "medium", "hard"] as const).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      style={{ padding: "5px 11px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, border: "1.5px solid",
                        borderColor: difficulty === d ? (d === "all" ? "var(--accent)" : DIFFICULTY_COLOR[d as keyof typeof DIFFICULTY_COLOR]) : "#e4e8ef",
                        background: difficulty === d ? (d === "all" ? "rgba(29,111,196,0.07)" : DIFFICULTY_COLOR[d as keyof typeof DIFFICULTY_COLOR] + "15") : "#fff",
                        color: difficulty === d ? (d === "all" ? "var(--accent)" : DIFFICULTY_COLOR[d as keyof typeof DIFFICULTY_COLOR]) : "#6b7a99", cursor: "pointer" }}>
                      {d === "all" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={pickQuestion}
                style={{ marginLeft: "auto", padding: "9px 22px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
                {current ? "↻ New Question" : "Start Practice →"}
              </button>
            </div>
          </div>

          {/* Question card */}
          {current && (
            <div style={{ background: "#fff", border: "1.5px solid rgba(29,111,196,0.2)", borderRadius: 14, padding: "24px 28px", boxShadow: "0 4px 20px rgba(29,111,196,0.06)" }}>
              {/* Question header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "rgba(29,111,196,0.07)", color: "var(--accent)" }}>{current.category}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                    background: DIFFICULTY_COLOR[current.difficulty] + "15",
                    color: DIFFICULTY_COLOR[current.difficulty] }}>
                    {current.difficulty}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Timer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, fontWeight: 700, color: timer > 120 ? "#ef4444" : "#6b7a99", background: "#f8f9fc", padding: "5px 12px", borderRadius: 8 }}>
                    ⏱ {fmtTimer(timer)}
                  </div>
                  <button onClick={() => setShowTip(!showTip)}
                    style={{ padding: "5px 12px", fontSize: 12.5, fontWeight: 600, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, cursor: "pointer" }}>
                    💡 {showTip ? "Hide" : "Show"} Tip
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a2035", lineHeight: 1.5, marginBottom: showTip ? 12 : 20 }}>
                "{current.text}"
              </div>

              {showTip && (
                <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13.5, color: "#92400e", lineHeight: 1.6 }}>
                  💡 <strong>Coach tip:</strong> {current.tip}
                </div>
              )}

              {/* STAR reminder */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { letter: "S", label: "Situation", desc: "Set the context" },
                  { letter: "T", label: "Task",      desc: "Your specific role" },
                  { letter: "A", label: "Action",    desc: "What YOU did (not 'we')" },
                  { letter: "R", label: "Result",    desc: "Measurable outcome" },
                ].map(s => (
                  <div key={s.letter} style={{ background: "#f8f9fc", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "var(--accent)", marginBottom: 2 }}>{s.letter}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1a2035" }}>{s.label}</div>
                    <div style={{ fontSize: 10.5, color: "#6b7a99" }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              {/* Answer textarea */}
              <div style={{ position: "relative" }}>
                <textarea
                  value={answer}
                  onChange={e => handleAnswerChange(e.target.value)}
                  placeholder="Type your answer here… Start with the situation: when was this, at which company, what was the context? Then describe your specific task, the actions you personally took (use 'I', not 'we'), and finally a quantified result."
                  rows={8}
                  style={{ width: "100%", padding: "14px 16px", border: "1.5px solid #e4e8ef", borderRadius: 10, fontSize: 14, color: "#1a2035", lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", minHeight: 160 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: wordCount < 50 ? "#aab3c5" : wordCount < 80 ? "#f59e0b" : "#10b981" }}>
                    {wordCount} words {wordCount < 50 ? "· aim for 80–150" : wordCount < 80 ? "· almost there" : "· good length"}
                  </span>
                  <button onClick={submitAnswer} disabled={scoring || wordCount < 20}
                    style={{ padding: "10px 24px", background: wordCount >= 20 ? "var(--accent)" : "#e4e8ef", color: wordCount >= 20 ? "#fff" : "#aab3c5", border: "none", borderRadius: 9, fontWeight: 700, cursor: wordCount >= 20 ? "pointer" : "default", fontSize: 14, transition: "all .15s" }}>
                    {scoring ? "Scoring…" : "✨ Get AI Score"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Score card */}
          {score && !scoring && (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "24px 28px", animation: "fadeIn .3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Your Score</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 52, fontWeight: 900, color: GRADE_COLOR[score.grade], letterSpacing: "-2px", lineHeight: 1 }}>{score.grade}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: GRADE_COLOR[score.grade] }}>{score.total}/100</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button onClick={pickQuestion}
                    style={{ padding: "9px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}>
                    Next Question →
                  </button>
                </div>
              </div>

              {/* STAR breakdown bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Situation", key: "situation", value: score.situation },
                  { label: "Task",      key: "task",      value: score.task      },
                  { label: "Action",    key: "action",    value: score.action    },
                  { label: "Result",    key: "result",    value: score.result    },
                ].map(({ label, value }) => {
                  const pct = (value / 25) * 100
                  const color = pct >= 80 ? "#10b981" : pct >= 56 ? "#3b82f6" : pct >= 40 ? "#f59e0b" : "#ef4444"
                  return (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color, marginBottom: 4 }}>{value}<span style={{ fontSize: 13, fontWeight: 600, color: "#aab3c5" }}>/25</span></div>
                      <div style={{ height: 6, background: "#f1f4f9", borderRadius: 100, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 100, transition: "width .6s ease" }}/>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7a99" }}>{label}</div>
                    </div>
                  )
                })}
              </div>

              {/* Feedback */}
              <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>AI Feedback</div>
                <div style={{ fontSize: 13.5, color: "#1a2035", lineHeight: 1.65 }}>{score.feedback}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {score.strengths.length > 0 && (
                  <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>✓ Strengths</div>
                    {score.strengths.map((s, i) => <div key={i} style={{ fontSize: 13, color: "#065f46", lineHeight: 1.55, marginBottom: 4 }}>• {s}</div>)}
                  </div>
                )}
                {score.improvements.length > 0 && (
                  <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>↑ Improvements</div>
                    {score.improvements.map((s, i) => <div key={i} style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.55, marginBottom: 4 }}>• {s}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!current && (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🎤</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>Ready to practice?</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99", marginBottom: 8, maxWidth: 420, margin: "0 auto 24px" }}>
                Pick a category and difficulty, then hit "Start Practice." Answer the question using the STAR format and get instant AI scoring with specific feedback.
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
                {["Behavioral", "Security", "Technical", "System Design"].map(c => (
                  <button key={c} onClick={() => { setCategory(c); setTimeout(pickQuestion, 50) }}
                    style={{ padding: "8px 18px", borderRadius: 9, background: "rgba(29,111,196,0.07)", color: "var(--accent)", border: "1px solid rgba(29,111,196,0.2)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY VIEW ──────────────────────────────────────────── */}
      {view === "history" && (
        <div>
          {session.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 14, padding: "48px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2035", marginBottom: 6 }}>No practice sessions yet</div>
              <div style={{ fontSize: 13.5, color: "#6b7a99" }}>Answer your first question to see your history here</div>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Questions Answered", value: session.length, color: "var(--accent)" },
                  { label: "Avg Score", value: avgScore + "/100", color: readiness.color },
                  { label: "Best Score", value: Math.max(...session.map(e => e.score.total)) + "/100", color: "#10b981" },
                  { label: "Readiness", value: readiness.label, color: readiness.color },
                ].map(s => (
                  <div key={s.label} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: s.label === "Readiness" ? 13 : 20, fontWeight: 900, color: s.color, letterSpacing: s.label === "Readiness" ? 0 : "-0.5px" }}>{s.value}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7a99", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Score trend by category */}
              <div style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", marginBottom: 12 }}>Score by Category</div>
                {Array.from(new Set(session.map(e => e.category))).map(cat => {
                  const catEntries = session.filter(e => e.category === cat)
                  const catAvg = Math.round(catEntries.reduce((a, e) => a + e.score.total, 0) / catEntries.length)
                  const color = catAvg >= 80 ? "#10b981" : catAvg >= 60 ? "#3b82f6" : "#f59e0b"
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2035" }}>{cat}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{catAvg}/100 ({catEntries.length} answers)</span>
                      </div>
                      <div style={{ height: 8, background: "#f1f4f9", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: catAvg + "%", background: color, borderRadius: 100 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Individual entries */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {session.map((entry, i) => {
                  const color = GRADE_COLOR[entry.score.grade]
                  return (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e4e8ef", borderRadius: 12, padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2035", marginBottom: 4, lineHeight: 1.4 }}>{entry.questionText}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 100, background: "rgba(29,111,196,0.07)", color: "var(--accent)", fontWeight: 600 }}>{entry.category}</span>
                            <span style={{ fontSize: 11.5, color: "#aab3c5" }}>{new Date(entry.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color }}>{entry.score.grade}</div>
                          <div style={{ fontSize: 11.5, color: "#aab3c5" }}>{entry.score.total}/100</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        {[["S", entry.score.situation], ["T", entry.score.task], ["A", entry.score.action], ["R", entry.score.result]].map(([l, v]) => (
                          <div key={l as string} style={{ textAlign: "center", background: "#f8f9fc", borderRadius: 6, padding: "4px 0" }}>
                            <div style={{ fontSize: 10, color: "#aab3c5", fontWeight: 700 }}>{l as string}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2035" }}>{v as number}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button onClick={() => { setSession([]); localStorage.removeItem("jd_mock_interview_v1") }}
                style={{ marginTop: 12, padding: "8px 16px", background: "transparent", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Clear History
              </button>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
