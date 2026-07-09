"use client"

import { useState, useRef, useEffect } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// NexusPanel — job-context AI assistant panel
// Props: job, profile, matchScore, h1bStatus, apiKeys
// ─────────────────────────────────────────────────────────────────────────────

interface Job {
  id: string; title: string; company: string; location: string; remote: boolean
  salary: string | null; posted: string; description: string
  workAuth: string[]; url: string; source: string
}

interface Profile {
  name?: string; skills?: string[] | string; yearsExp?: number | string
  workAuth?: string; education?: string; targetRoles?: string[]
}

interface Message {
  role: "user" | "assistant"
  content: string
}

interface NexusPanelProps {
  job: Job
  profile: Profile
  matchScore: number
  h1bStatus?: "likely" | "possible" | "unknown"
  claudeKey?: string
}

const PRESET_COMMANDS = [
  { icon: "📊", label: "Why is my score this %?", prompt: "Explain my match score breakdown for this job — what's contributing to it and what's missing?" },
  { icon: "🎯", label: "What skills am I missing?", prompt: "What skills from this job description am I missing, and how critical are they?" },
  { icon: "✉️", label: "Write my cover letter", prompt: "Write a tailored cover letter for this role at this company. Keep it professional, specific, and under 3 paragraphs." },
  { icon: "🎤", label: "Prep me for interviews", prompt: "Generate 10 likely interview questions for this role, including 3 technical questions specific to the JD skills." },
  { icon: "📄", label: "Tailor my resume bullets", prompt: "Suggest 5 specific resume bullet improvements I should make to match this job's requirements." },
  { icon: "🛂", label: "Is this H1B friendly?", prompt: "Explain the H1B sponsorship situation for this job and company — what do I need to know?" },
]

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:.82em;font-family:monospace">$1</code>')
    .replace(/^### (.+)$/gm, '<p style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a99;margin:10px 0 4px">$1</p>')
    .replace(/^## (.+)$/gm, '<p style="font-weight:700;font-size:13px;color:#1a2035;margin:10px 0 4px">$1</p>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:3px 0">$1</li>')
    .replace(/((<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="padding-left:1.2rem;margin:.3rem 0;list-style:disc">$1</ul>')
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>")
}

export default function NexusPanel({ job, profile, matchScore, h1bStatus = "unknown", claudeKey }: NexusPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput("")

    const userMsg: Message = { role: "user", content }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      let key = claudeKey || ""
      try { key = key || JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}

      const res = await fetch("/api/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: {
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            workAuth: job.workAuth,
            salary: job.salary,
            posted: job.posted,
          },
          profile: {
            name: profile.name,
            skills: profile.skills,
            yearsExp: profile.yearsExp,
            workAuth: profile.workAuth,
            education: profile.education,
            targetRoles: profile.targetRoles,
          },
          matchScore,
          h1bStatus,
          messages: next.slice(-10).map(m => ({ role: m.role, content: m.content })),
          claudeKey: key,
        }),
      })
      const data = await res.json()
      if (!data.ok || !data.reply) throw new Error(data.error || "No reply")
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Something went wrong — ${String(e)}. Make sure you have an API key in Settings.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Header chip */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid #e4e8ef",
        background: "linear-gradient(135deg,#f8fbff,#f5f3ff)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: "linear-gradient(135deg,#2483e0,#7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#fff",
        }}>✦</div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1a2035", lineHeight: 1.2 }}>Nexus AI</p>
          <p style={{ fontSize: 10.5, color: "#6b7a99", lineHeight: 1.2 }}>
            Knows this job · your profile · {matchScore}% match
          </p>
        </div>
        <div style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a" }}>Context loaded</span>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {isEmpty && (
          <div>
            {/* Welcome */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                background: "linear-gradient(135deg,#2483e0,#7c3aed)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
              }}>✦</div>
              <div style={{
                background: "#f8f9fb", border: "1px solid #e4e8ef", borderRadius: "12px 12px 12px 3px",
                padding: "10px 12px", maxWidth: "90%", fontSize: 12.5, lineHeight: 1.55, color: "#374151",
              }}>
                I&apos;m Nexus — your AI assistant for <strong>{job.title}</strong> at <strong>{job.company}</strong>.
                I know your full profile, this JD, and your {matchScore}% match score.
                What would you like to know?
              </div>
            </div>

            {/* Preset commands */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {PRESET_COMMANDS.map(cmd => (
                <button
                  key={cmd.label}
                  onClick={() => send(cmd.prompt)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 11px",
                    background: "#fff", border: "1px solid #e4e8ef", borderRadius: 9,
                    cursor: "pointer", textAlign: "left", transition: "border-color .15s, background .15s",
                    fontSize: 12, color: "#374151", fontWeight: 500,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#bfdbfe"; el.style.background = "#f8fbff" }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#e4e8ef"; el.style.background = "#fff" }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{cmd.icon}</span>
                  <span>{cmd.label}</span>
                  <span style={{ marginLeft: "auto", color: "#9aa4bc", fontSize: 10 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginBottom: 2,
                background: "linear-gradient(135deg,#2483e0,#7c3aed)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9,
              }}>✦</div>
            )}
            <div
              style={msg.role === "user" ? {
                background: "var(--accent)", color: "#fff",
                borderRadius: "12px 12px 3px 12px",
                padding: "8px 12px", maxWidth: "82%", fontSize: 12.5, lineHeight: 1.5,
              } : {
                background: "#f8f9fb", border: "1px solid #e4e8ef", color: "#374151",
                borderRadius: "12px 12px 12px 3px",
                padding: "10px 12px", maxWidth: "88%", fontSize: 12.5, lineHeight: 1.55,
              }}
              dangerouslySetInnerHTML={msg.role === "assistant"
                ? { __html: renderMarkdown(msg.content) }
                : undefined
              }
            >
              {msg.role === "user" ? msg.content : undefined}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#2483e0,#7c3aed)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9,
            }}>✦</div>
            <div style={{
              background: "#f8f9fb", border: "1px solid #e4e8ef", borderRadius: "12px 12px 12px 3px",
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <div style={{
                display: "flex", gap: 3, alignItems: "center",
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%", background: "var(--accent)",
                    animation: `nexusPulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11.5, color: "#6b7a99" }}>Nexus is thinking…</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid #e4e8ef",
        background: "#fff", flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 7,
          border: "1.5px solid #e4e8ef", borderRadius: 10, padding: "7px 10px",
          background: "#f8f9fb", transition: "border-color .15s",
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "#bfdbfe" }}
          onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e4e8ef" }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this job, your fit, cover letter…"
            rows={1}
            style={{
              flex: 1, resize: "none", background: "transparent", border: "none",
              outline: "none", fontSize: 12.5, lineHeight: 1.5, color: "#1a2035",
              fontFamily: "inherit", maxHeight: 70, overflowY: "auto",
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
              background: input.trim() && !loading ? "var(--accent)" : "var(--border)",
              color: input.trim() && !loading ? "#fff" : "#9aa4bc",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 9.5, color: "#9aa4bc", textAlign: "center", marginTop: 4 }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>

      <style>{`
        @keyframes nexusPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: .4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
