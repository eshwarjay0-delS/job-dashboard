"use client"

import { useState, useEffect, useRef, useCallback } from "react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  ts: number
}

interface UserContext {
  name?: string
  title?: string
  skills?: string
  yearsExp?: string | number
  location?: string
  workAuth?: string
  email?: string
  applications?: number
  offers?: number
  savedJobs?: number
  certs?: string
  targetRoles?: string
  visas?: string
}

/* ═══════════════════════════════════════════════════════════════════
   QUICK CHIPS
   ═══════════════════════════════════════════════════════════════════ */
const CHIP_GROUPS = [
  {
    label: "Job Search",
    chips: [
      "What roles should I target based on my profile?",
      "How do I stand out in a crowded job market?",
      "Should I apply to startups or enterprise companies?",
      "What's the best time of year to job hunt?",
    ],
  },
  {
    label: "Salary & Negotiation",
    chips: [
      "How do I negotiate a higher offer?",
      "What's a fair salary for my experience level?",
      "Should I give a number first in negotiations?",
      "How do I handle a competing offer?",
    ],
  },
  {
    label: "Interviews",
    chips: [
      "Give me a STAR story for conflict resolution",
      "How do I answer 'What's your greatest weakness?'",
      "What questions should I ask the interviewer?",
      "How do I prepare for a system design interview?",
    ],
  },
  {
    label: "Visa & Work Auth",
    chips: [
      "What's the H-1B lottery timeline for FY2026?",
      "How does OPT STEM extension work?",
      "Which companies are known H-1B sponsors?",
      "What's the difference between C2C and W2?",
    ],
  },
  {
    label: "Resume & Skills",
    chips: [
      "What's wrong with a resume that uses 'Having X years…'?",
      "How do I quantify my accomplishments without exact numbers?",
      "What skills are most in demand right now?",
      "Should I tailor my resume for every job?",
    ],
  },
]

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function newId() { return Math.random().toString(36).slice(2, 9) }

function buildSystemContext(ctx: UserContext): string {
  const parts: string[] = [
    "You are MarketFit's AI Career Copilot — a knowledgeable, direct, and empathetic career advisor.",
    "You help users with job searching, salary negotiation, interview preparation, resume optimization, visa/work authorization questions, and career strategy.",
    "Be specific, actionable, and concise. Use bullet points where helpful. Never be generic — tailor advice to what you know about this user.",
    "",
    "## User Profile",
  ]
  if (ctx.name)        parts.push(`Name: ${ctx.name}`)
  if (ctx.title)       parts.push(`Current/Target Title: ${ctx.title}`)
  if (ctx.yearsExp)    parts.push(`Years of Experience: ${ctx.yearsExp}`)
  if (ctx.location)    parts.push(`Location: ${ctx.location}`)
  if (ctx.workAuth)    parts.push(`Work Authorization: ${ctx.workAuth}`)
  if (ctx.skills)      parts.push(`Skills: ${ctx.skills}`)
  if (ctx.targetRoles) parts.push(`Target Roles: ${ctx.targetRoles}`)
  if (ctx.certs)       parts.push(`Certifications: ${ctx.certs}`)
  if (ctx.applications !== undefined) parts.push(`Active applications: ${ctx.applications}`)
  if (ctx.offers !== undefined)       parts.push(`Offers received: ${ctx.offers}`)
  if (ctx.savedJobs !== undefined)    parts.push(`Saved jobs: ${ctx.savedJobs}`)
  if (ctx.visas)       parts.push(`Visa tracking: ${ctx.visas}`)
  parts.push("", "Keep responses focused and under 350 words unless the user explicitly asks for more detail.")
  return parts.join("\n")
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function CopilotPage() {
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState("")
  const [loading, setLoading]       = useState(false)
  const [ctx, setCtx]               = useState<UserContext>({})
  const [activeGroup, setActiveGroup] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  /* load user context from localStorage */
  useEffect(() => {
    try {
      const profile   = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      const apps      = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      const offers    = JSON.parse(localStorage.getItem("jd_offers") || "[]")
      const saved     = JSON.parse(localStorage.getItem("jd_saved_ids") || "[]")
      const certs     = JSON.parse(localStorage.getItem("jd_certs_v1") || "[]")
      const skills    = JSON.parse(localStorage.getItem("jd_skills_v1") || "[]")
      const visas     = JSON.parse(localStorage.getItem("jd_visas") || "[]")
      setCtx({
        name:         profile.full_name || profile.name,
        title:        profile.title,
        yearsExp:     profile.yearsExp,
        location:     profile.location,
        workAuth:     profile.workAuth || profile.work_auth,
        email:        profile.email,
        skills:       (Array.isArray(profile.skills) ? profile.skills.join(", ") : profile.skills) ||
                      skills.map((s: { name: string }) => s.name).join(", "),
        targetRoles:  Array.isArray(profile.targetRoles) ? profile.targetRoles.join(", ") : profile.targetRoles,
        certs:        certs.filter((c: { status: string }) => c.status === "completed").map((c: { name: string }) => c.name).join(", "),
        applications: apps.length,
        offers:       offers.length,
        savedJobs:    saved.length,
        visas:        visas.map((v: { type: string; status: string }) => `${v.type} (${v.status})`).join(", "),
      })
    } catch { /* ignore */ }
  }, [])

  /* load persisted chat */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("jd_copilot_history")
      if (stored) setMessages(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  /* persist chat */
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem("jd_copilot_history", JSON.stringify(messages.slice(-60))) } catch { /* ignore */ }
    }
  }, [messages])

  /* auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput("")

    const userMsg: Message = { id: newId(), role: "user", content: trimmed, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
      const history = [...messages.slice(-12), userMsg]
      const systemPrompt = buildSystemContext(ctx)
      const conversationStr = history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
      const finalPrompt = `${systemPrompt}\n\n## Conversation\n${conversationStr}\n\nAssistant:`

      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "career_copilot",
          instruction: trimmed,
          current: finalPrompt,
          claudeKey,
        }),
      })

      const data = await res.json()
      const reply = data.result || data.text || data.content || "I couldn't generate a response. Please try again."

      setMessages(prev => [...prev, { id: newId(), role: "assistant", content: reply, ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, { id: newId(), role: "assistant", content: "Sorry — I hit an error reaching the API. Please try again.", ts: Date.now() }])
    }

    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [messages, ctx, loading])

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  function clearHistory() {
    setMessages([])
    try { localStorage.removeItem("jd_copilot_history") } catch { /* ignore */ }
  }

  const hasProfile = !!(ctx.name || ctx.title || ctx.skills)
  const firstName  = ctx.name?.split(" ")[0] || "there"

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1d6fc4, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.3px", margin: 0 }}>Career Copilot</h1>
              <p style={{ fontSize: 12, color: "#6b7a99", margin: 0 }}>AI advisor · knows your profile, apps & skills</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearHistory} style={{ fontSize: 12, color: "#6b7a99", background: "transparent", border: "1px solid #e4e8ef", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
              Clear chat
            </button>
          )}
        </div>

        {/* Context pill */}
        {hasProfile && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, marginBottom: 4, flexWrap: "wrap" }}>
            {ctx.name && <ContextPill label={ctx.name} icon="👤"/>}
            {ctx.title && <ContextPill label={ctx.title} icon="💼"/>}
            {ctx.workAuth && <ContextPill label={ctx.workAuth} icon="🛂"/>}
            {ctx.applications !== undefined && <ContextPill label={`${ctx.applications} apps`} icon="📋"/>}
            {ctx.offers !== undefined && ctx.offers > 0 && <ContextPill label={`${ctx.offers} offer${ctx.offers > 1 ? "s" : ""}`} icon="🎉"/>}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 0 8px" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>⚡</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2035", marginBottom: 6, letterSpacing: "-0.3px" }}>
              Hey {firstName}, what can I help with?
            </div>
            <div style={{ fontSize: 14, color: "#6b7a99", maxWidth: 440, lineHeight: 1.6, marginBottom: 28 }}>
              I know your profile, skills, and application history.
              Ask me anything about your job search, interviews, salary, or visa status.
            </div>

            {/* Chip groups */}
            <div style={{ width: "100%", maxWidth: 680 }}>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
                {CHIP_GROUPS.map((g, i) => (
                  <button key={g.label} onClick={() => setActiveGroup(i)}
                    style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, border: "1.5px solid",
                      borderColor: activeGroup === i ? "var(--accent)" : "#e4e8ef",
                      background: activeGroup === i ? "rgba(29,111,196,0.07)" : "#fff",
                      color: activeGroup === i ? "var(--accent)" : "#6b7a99", cursor: "pointer" }}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CHIP_GROUPS[activeGroup].chips.map(chip => (
                  <button key={chip} onClick={() => send(chip)}
                    style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e4e8ef", borderRadius: 10, fontSize: 13, color: "#1a2035", cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "border-color .15s, box-shadow .15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(29,111,196,0.1)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e4e8ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: msg.role === "user" ? "linear-gradient(135deg, #1d6fc4, #3b82f6)" : "linear-gradient(135deg, #1d6fc4, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: msg.role === "user" ? 13 : 15, color: "#fff", fontWeight: 800,
            }}>
              {msg.role === "user" ? (ctx.name?.charAt(0) || "U") : "⚡"}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: "74%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user" ? "linear-gradient(135deg, #1d6fc4, #3b82f6)" : "#fff",
              color: msg.role === "user" ? "#fff" : "#1a2035",
              fontSize: 14, lineHeight: 1.65,
              boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.07)" : "0 2px 10px rgba(29,111,196,0.25)",
              border: msg.role === "assistant" ? "1px solid #e4e8ef" : "none",
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
              <div style={{ fontSize: 10.5, opacity: .5, marginTop: 6, textAlign: "right" }}>
                {new Date(msg.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #1d6fc4, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>⚡</div>
            <div style={{ padding: "12px 16px", background: "#fff", border: "1px solid #e4e8ef", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <ThinkingDots/>
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Quick chips row (after first message) */}
      {messages.length > 0 && (
        <div style={{ padding: "4px 24px 0", flexShrink: 0, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 6, paddingBottom: 4 }}>
            {["What's my next step?", "Help me prep for interviews", "Review my job search strategy", "Salary negotiation tips", "H-1B timeline"].map(chip => (
              <button key={chip} onClick={() => send(chip)} disabled={loading}
                style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, border: "1px solid #e4e8ef", background: "#fff", color: "#6b7a99", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "border-color .15s" }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e4e8ef" }}>
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: "12px 24px 20px", flexShrink: 0, background: "#f4f6f9" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#fff", border: "1.5px solid #e4e8ef", borderRadius: 14, padding: "10px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "border-color .2s" }}
          onFocusCapture={e => e.currentTarget.style.borderColor = "var(--accent)"}
          onBlurCapture={e => e.currentTarget.style.borderColor = "#e4e8ef"}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your job search, salary, interviews, or visa…"
            rows={1}
            disabled={loading}
            style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 14, color: "#1a2035", background: "transparent", lineHeight: 1.5, maxHeight: 120, overflowY: "auto", fontFamily: "inherit" }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = "auto"
              t.style.height = Math.min(t.scrollHeight, 120) + "px"
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, transition: "background .2s",
              background: input.trim() && !loading ? "linear-gradient(135deg, #1d6fc4, #3b82f6)" : "#f1f4f9",
              color: input.trim() && !loading ? "#fff" : "#aab3c5" }}>
            ↑
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#aab3c5", textAlign: "center", marginTop: 6 }}>
          Shift+Enter for new line · Enter to send · Powered by Claude
        </div>
      </div>
    </div>
  )
}

/* ── Small reusable components ──────────────────────────────────── */
function ContextPill({ label, icon }: { label: string; icon: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(29,111,196,0.06)", border: "1px solid rgba(29,111,196,0.15)", borderRadius: 100, fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}>
      {icon} {label}
    </span>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", height: 20 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", opacity: 0.5, animation: `dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}/>
      ))}
      <style>{`@keyframes dot-bounce { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-6px);opacity:1} }`}</style>
    </div>
  )
}
