"use client"

import { useState, useEffect } from "react"
import {
  Brain, Settings, Lock, Cloud, Wrench, Mic, BookOpen, Star, Save, Search,
  Lightbulb, Sparkles, Target, Ban, Check, X,
} from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"

const P = {
  surface: "#ffffff", text: "#1a2035", muted: "#6b7a99",
  hint: "#9aa4bc", border: "#e4e8ef", bg: "#f4f6f9",
}

// ── Question banks ──────────────────────────────────────────────────────────
const BANKS: Record<string, { q: string; tip: string; tags: string[] }[]> = {
  behavioral: [
    { q: "Tell me about yourself.", tip: "Use the Present-Past-Future structure: current role → what led you here → why this opportunity.", tags: ["Universal", "Opening"] },
    { q: "Tell me about a time you faced a significant challenge at work.", tip: "Use STAR: Situation, Task, Action, Result. Quantify the result.", tags: ["STAR", "Problem-solving"] },
    { q: "Describe a time you disagreed with a team member. How did you handle it?", tip: "Focus on the resolution process, not the conflict. Show empathy and compromise.", tags: ["STAR", "Teamwork"] },
    { q: "What's your greatest professional achievement?", tip: "Pick something with clear metrics. Don't be modest — this is your moment.", tags: ["STAR", "Impact"] },
    { q: "Tell me about a time you failed and what you learned from it.", tip: "Own the failure briefly, then spend 70% of your answer on the lesson and pivot.", tags: ["STAR", "Growth"] },
    { q: "How do you handle tight deadlines and competing priorities?", tip: "Describe a real scenario using a prioritization framework (Eisenhower matrix, MoSCoW, etc.).", tags: ["STAR", "Time Management"] },
    { q: "Why are you leaving your current role?", tip: "Always frame as moving toward something, never away from something. Avoid badmouthing.", tags: ["Universal", "Motivation"] },
    { q: "Where do you see yourself in 5 years?", tip: "Align your growth trajectory with the team's growth. Show ambition tempered with realism.", tags: ["Universal", "Career"] },
  ],
  technical: [
    { q: "Walk me through how you'd design a URL shortener like bit.ly.", tip: "Cover: hashing strategy, DB schema, redirect latency, analytics, rate limiting, scale to 1B URLs.", tags: ["System Design", "Scalability"] },
    { q: "Explain the difference between SQL and NoSQL databases. When would you choose each?", tip: "Mention ACID vs BASE, schema flexibility, horizontal scaling, and give concrete use cases.", tags: ["Databases", "Architecture"] },
    { q: "How does the browser render a webpage? Walk me through from URL to pixels.", tip: "DNS → TCP → HTTP → HTML parse → DOM → CSSOM → Render tree → Layout → Paint → Composite.", tags: ["Frontend", "Performance"] },
    { q: "What is Big-O notation and why does it matter?", tip: "Explain time vs space complexity. Give O(1), O(log n), O(n), O(n²) examples with real code scenarios.", tags: ["Algorithms", "Fundamentals"] },
    { q: "How would you debug a production issue with high latency?", tip: "Structured approach: metrics → logs → traces → isolate → hotfix vs root cause. Mention APM tools.", tags: ["SRE", "Debugging"] },
    { q: "Explain how REST differs from GraphQL. When would you choose one over the other?", tip: "REST: resource-oriented, stateless, caching-friendly. GraphQL: query flexibility, N+1 problem, single endpoint.", tags: ["APIs", "Architecture"] },
  ],
  security: [
    { q: "What is the OWASP Top 10? Walk me through three items.", tip: "Injections, Broken Auth, XSS are always safe bets. Give a real-world impact example for each.", tags: ["AppSec", "OWASP"] },
    { q: "Explain the difference between symmetric and asymmetric encryption.", tip: "Symmetric (AES): same key, fast. Asymmetric (RSA): public/private pair, used for key exchange. TLS uses both.", tags: ["Cryptography", "Fundamentals"] },
    { q: "How would you conduct a penetration test on a web application?", tip: "Recon → Scan → Gain access → Maintain access → Report. Mention OWASP Testing Guide, Burp Suite, methodology.", tags: ["PenTest", "AppSec"] },
    { q: "What is zero trust architecture?", tip: "Never trust, always verify. No implicit trust from network location. Every request authenticated + authorized.", tags: ["Architecture", "ZeroTrust"] },
  ],
  cloud: [
    { q: "Explain the difference between horizontal and vertical scaling.", tip: "Vertical: bigger box (limited). Horizontal: more boxes (preferred for cloud). Talk about statelessness.", tags: ["AWS", "Architecture"] },
    { q: "What is a Kubernetes pod and how does it relate to a container?", tip: "Pod is the smallest deployable unit in K8s. Can contain 1+ containers that share network namespace.", tags: ["K8s", "DevOps"] },
    { q: "How does CI/CD improve software delivery?", tip: "Automation of build/test/deploy pipeline. Faster feedback, smaller batches, lower risk per release.", tags: ["DevOps", "Process"] },
    { q: "Explain Infrastructure as Code (IaC) and its benefits.", tip: "Version-controlled, reproducible, auditable infra. Terraform, Pulumi, CDK. Compare to ClickOps.", tags: ["DevOps", "IaC"] },
  ],
  servicenow: [
    { q: "Explain the difference between a Business Rule and a Script Include.", tip: "BR runs on table events (insert/update/delete). Script Include is a reusable library called from BRs, CAs, or APIs.", tags: ["ServiceNow", "Scripting"] },
    { q: "How would you design a custom application in ServiceNow?", tip: "Scoped app: table design, roles/ACLs, UI policies, business rules, catalog item, notifications, testing in PDI.", tags: ["ServiceNow", "Architecture"] },
    { q: "What is Flow Designer and when would you use it over legacy Workflow?", tip: "Flow Designer is the modern no-code/low-code replacement. Better for ITSM flows, easier handoff to non-devs.", tags: ["ServiceNow", "ITSM"] },
    { q: "How do you troubleshoot a failing REST integration in ServiceNow?", tip: "Check outbound logs, REST message config, auth profile, response handler, sys_log for errors.", tags: ["ServiceNow", "Integration"] },
  ],
}

const CATEGORIES = [
  { id: "behavioral",  label: "Behavioral",    Icon: Brain,    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "technical",   label: "Technical",     Icon: Settings, color: "#1d6fc4", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "security",    label: "Cybersecurity", Icon: Lock,     color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "cloud",       label: "Cloud / DevOps", Icon: Cloud,   color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "servicenow",  label: "ServiceNow",    Icon: Wrench,   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
]

const STAR_STEPS = [
  { label: "S — Situation", desc: "Set the scene. Where, when, what was the context?", color: "#7c3aed" },
  { label: "T — Task",      desc: "What was your specific responsibility or challenge?", color: "#1d6fc4" },
  { label: "A — Action",    desc: "What did YOU do? Use 'I', not 'we'. Be specific.",   color: "#059669" },
  { label: "R — Result",    desc: "What was the outcome? Quantify it where possible.",  color: "#d97706" },
]

interface SavedAnswer { qIndex: number; category: string; answer: string; aiAnswer: string }

function Tag({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>{label}</span>
  )
}

export default function InterviewPrepPage() {
  const [category, setCategory]         = useState("behavioral")
  const [activeQ, setActiveQ]           = useState<number | null>(null)
  const [myAnswer, setMyAnswer]         = useState("")
  const [aiAnswer, setAiAnswer]         = useState("")
  const [loadingAI, setLoadingAI]       = useState(false)
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([])
  const [view, setView]                 = useState<"bank" | "star" | "saved">("bank")
  const [filter, setFilter]             = useState("")
  const [companyQ, setCompanyQ]         = useState("")
  const [companyRole, setCompanyRole]   = useState("")
  const [companyAns, setCompanyAns]     = useState("")
  const [loadingCompany, setLoadingCompany] = useState(false)

  const cat = CATEGORIES.find(c => c.id === category)!
  const questions = BANKS[category] || []
  const filtered  = filter
    ? questions.filter(q => q.q.toLowerCase().includes(filter.toLowerCase()) || q.tags.some(t => t.toLowerCase().includes(filter.toLowerCase())))
    : questions

  useEffect(() => {
    try {
      const s: SavedAnswer[] = JSON.parse(localStorage.getItem("jd_interview_answers") || "[]")
      setSavedAnswers(s)
    } catch {}
  }, [])

  function persist(next: SavedAnswer[]) {
    setSavedAnswers(next)
    localStorage.setItem("jd_interview_answers", JSON.stringify(next))
  }

  function saveAnswer() {
    if (activeQ === null || !myAnswer.trim()) return
    const existing = savedAnswers.findIndex(a => a.qIndex === activeQ && a.category === category)
    const entry: SavedAnswer = { qIndex: activeQ, category, answer: myAnswer, aiAnswer }
    if (existing >= 0) {
      const next = [...savedAnswers]; next[existing] = entry; persist(next)
    } else {
      persist([entry, ...savedAnswers])
    }
  }

  async function getAIAnswer() {
    if (activeQ === null) return
    const q = questions[activeQ]
    setLoadingAI(true); setAiAnswer("")
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "interview_prep",
          instruction: `Write a strong, natural-sounding model answer for this interview question (3-5 sentences, professional but conversational). Question: "${q.q}". Tip: ${q.tip}. ${myAnswer ? `User's draft answer: "${myAnswer}" — improve and expand on this.` : ""}`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      setAiAnswer(data.text || "")
    } catch {
      setAiAnswer("Unable to generate right now. Try again.")
    }
    setLoadingAI(false)
  }

  async function getCompanyAnswer() {
    if (!companyQ.trim()) return
    setLoadingCompany(true); setCompanyAns("")
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "interview_prep",
          instruction: `Answer this interview question as a strong candidate applying for ${companyRole || "a tech role"}. Be specific, confident, and use the STAR method if behavioral. 4-6 sentences. Question: "${companyQ}"`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      setCompanyAns(data.text || "")
    } catch { setCompanyAns("Unable to generate right now.") }
    setLoadingCompany(false)
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Mic size={18}/>}
          title="Interview Prep"
          description="Role-specific question banks, STAR method coach, and AI model answers — beats LinkedIn Interview Prep."
          actions={
            <div style={{ display: "flex", gap: 6 }}>
              {(["bank", "star", "saved"] as const).map(v => {
                const VIcon = v === "bank" ? BookOpen : v === "star" ? Star : Save
                return (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${view === v ? "var(--accent)" : P.border}`, background: view === v ? "#eff6ff" : P.surface, color: view === v ? "var(--accent)" : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <VIcon size={13}/> {v === "bank" ? "Question Bank" : v === "star" ? "STAR Coach" : `Saved (${savedAnswers.length})`}
                  </button>
                )
              })}
            </div>
          }
        />
      </div>

      {/* ── Question Bank view ── */}
      {view === "bank" && (
        <>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { setCategory(c.id); setActiveQ(null); setMyAnswer(""); setAiAnswer("") }}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${category === c.id ? c.color : P.border}`, background: category === c.id ? c.bg : P.surface, color: category === c.id ? c.color : P.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <c.Icon size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }}/>{c.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative" as const, marginBottom: 14 }}>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by keyword or tag…"
              style={{ width: "100%", padding: "9px 13px 9px 36px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none", boxSizing: "border-box" as const }}/>
            <Search size={14} style={{ position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)", color: P.hint }}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: activeQ !== null ? "1fr 1fr" : "1fr", gap: 14 }}>
            {/* Question list */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {filtered.map((q, i) => {
                const idx = questions.indexOf(q)
                const isActive = activeQ === idx
                return (
                  <div key={idx} onClick={() => { setActiveQ(idx); setMyAnswer(""); setAiAnswer("") }}
                    style={{ background: isActive ? "#eff6ff" : P.surface, border: `1.5px solid ${isActive ? "var(--accent)" : P.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all .15s" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 6 }}>
                      {q.tags.map(t => {
                        const c = CATEGORIES.find(x => t.toLowerCase().includes(x.id.toLowerCase())) || cat
                        return <Tag key={t} label={t} color={c.color} bg={c.bg} border={c.border}/>
                      })}
                    </div>
                    <p style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: P.text, lineHeight: 1.5 }}>{q.q}</p>
                  </div>
                )
              })}
            </div>

            {/* Answer panel */}
            {activeQ !== null && questions[activeQ] && (
              <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: P.text, lineHeight: 1.4 }}>{questions[activeQ].q}</p>

                <div style={{ padding: "10px 13px", borderRadius: 10, background: cat.bg, border: `1px solid ${cat.border}` }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: cat.color, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><Lightbulb size={11}/> Coaching Tip</p>
                  <p style={{ fontSize: 12.5, color: P.text, lineHeight: 1.55 }}>{questions[activeQ].tip}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 5 }}>YOUR ANSWER DRAFT</label>
                  <textarea value={myAnswer} onChange={e => setMyAnswer(e.target.value)} rows={5} placeholder="Type your answer here to practice, then let AI improve it…"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, outline: "none", resize: "vertical" as const, lineHeight: 1.6, boxSizing: "border-box" as const }}/>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={getAIAnswer} disabled={loadingAI}
                      style={{ flex: 1, padding: "8px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 700, border: "none", cursor: loadingAI ? "wait" : "pointer", opacity: loadingAI ? 0.7 : 1 }}>
                      {loadingAI ? "Generating…" : <><Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }}/>AI Model Answer</>}
                    </button>
                    <button onClick={saveAnswer} disabled={!myAnswer.trim()}
                      style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: !myAnswer.trim() ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Save size={12}/> Save
                    </button>
                  </div>
                </div>

                {aiAnswer && (
                  <div style={{ background: "#f8fbff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "13px 15px" }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={11}/> AI MODEL ANSWER</p>
                    <p style={{ fontSize: 13, color: P.text, lineHeight: 1.7 }}>{aiAnswer}</p>
                    <button onClick={() => navigator.clipboard.writeText(aiAnswer)}
                      style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 11.5, cursor: "pointer" }}>
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── STAR Coach view ── */}
      {view === "star" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          {/* STAR overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {STAR_STEPS.map(s => (
              <div key={s.label} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.label[0]}</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: P.text, marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 12, color: P.muted, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {/* AI question asker */}
          <div style={{ background: "linear-gradient(135deg, #f8fbff 0%, #f5f3ff 100%)", border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "20px 24px" }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Target size={15}/> Custom Question AI</p>
            <p style={{ fontSize: 13, color: P.muted, marginBottom: 14 }}>Paste any interview question and let AI generate a strong STAR-structured answer.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={companyRole} onChange={e => setCompanyRole(e.target.value)} placeholder="Target role (e.g. Senior Engineer)"
                style={{ flex: 1, padding: "8px 11px", borderRadius: 9, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: "#fff", outline: "none" }}/>
            </div>
            <textarea value={companyQ} onChange={e => setCompanyQ(e.target.value)} rows={3} placeholder="Paste your interview question here…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: "#fff", outline: "none", resize: "vertical" as const, marginBottom: 10, boxSizing: "border-box" as const }}/>
            <button onClick={getCompanyAnswer} disabled={!companyQ.trim() || loadingCompany}
              style={{ padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: loadingCompany ? "wait" : "pointer", opacity: loadingCompany ? 0.7 : 1 }}>
              {loadingCompany ? "Generating STAR answer…" : "Generate STAR Answer"}
            </button>
            {companyAns && (
              <div style={{ marginTop: 14, background: "#fff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "14px 16px", fontSize: 13.5, color: P.text, lineHeight: 1.7 }}>
                {companyAns.split("\n").filter(Boolean).map((line, i) => <p key={i} style={{ marginBottom: 6 }}>{line}</p>)}
              </div>
            )}
          </div>

          {/* Common mistakes */}
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px" }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Ban size={14}/> Common Interview Mistakes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { bad: "\"We did...\" (team credit)", good: "\"I specifically did...\"" },
                { bad: "Vague results: \"it went well\"", good: "Metrics: \"reduced time by 40%\"" },
                { bad: "Bashing previous employer", good: "Focusing on growth opportunities" },
                { bad: "Not asking questions at end", good: "Prepare 3 thoughtful questions" },
                { bad: "Rambling beyond 2 minutes", good: "Keep each answer to 90-120 sec" },
                { bad: "Memorized, robotic delivery", good: "Know the structure, improvise the words" },
              ].map((m, i) => (
                <div key={i} style={{ padding: "10px 13px", borderRadius: 10, background: P.bg, border: `1px solid ${P.border}` }}>
                  <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><X size={11}/> {m.bad}</p>
                  <p style={{ fontSize: 12, color: "#059669", display: "flex", alignItems: "center", gap: 4 }}><Check size={11}/> {m.good}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Answers view ── */}
      {view === "saved" && (
        <div>
          {savedAnswers.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: "60px 24px", color: P.muted }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Save size={30}/></div>
              <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 6 }}>No saved answers yet</p>
              <p style={{ fontSize: 13.5 }}>Practice answering questions in the Question Bank, then save your best ones here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {savedAnswers.map((a, i) => {
                const catDef = CATEGORIES.find(c => c.id === a.category) || CATEGORIES[0]
                const q = BANKS[a.category]?.[a.qIndex]
                return (
                  <div key={i} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: catDef.bg, color: catDef.color, border: `1px solid ${catDef.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}><catDef.Icon size={11}/> {catDef.label}</span>
                      <button onClick={() => persist(savedAnswers.filter((_, j) => j !== i))}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "transparent", color: P.hint, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}><X size={11}/> Remove</button>
                    </div>
                    {q && <p style={{ fontSize: 13.5, fontWeight: 700, color: P.text, marginBottom: 10 }}>{q.q}</p>}
                    <div style={{ padding: "10px 12px", borderRadius: 9, background: P.bg, border: `1px solid ${P.border}`, marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: P.hint, marginBottom: 4 }}>MY ANSWER</p>
                      <p style={{ fontSize: 13, color: P.text, lineHeight: 1.6 }}>{a.answer}</p>
                    </div>
                    {a.aiAnswer && (
                      <div style={{ padding: "10px 12px", borderRadius: 9, background: "#f8fbff", border: "1px solid #bfdbfe" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>AI ANSWER</p>
                        <p style={{ fontSize: 13, color: P.text, lineHeight: 1.6 }}>{a.aiAnswer}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
