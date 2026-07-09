"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"

// ─────────────────────────────────────────────────────────────────────────────
// CareerOS Copilot — floating chat widget
// Persists in bottom-right corner across all dashboard pages.
// Calls /api/copilot for AI responses.
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  ts: number
}

const STARTER_PROMPTS = [
  "Give me a tour of the app",
  "How do I tailor my resume to a job?",
  "What's included in the free plan?",
  "Tips for a technical interview tomorrow",
]

function CopilotIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

function Spin() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// Simple markdown → HTML for assistant replies
function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code style="background:var(--surface-3,#eee);padding:1px 4px;border-radius:4px;font-size:.85em">$1</code>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/((<li>.*<\/li>\n?)+)/g, '<ul style="padding-left:1.25rem;margin:.25rem 0;list-style:disc">$1</ul>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

export default function CopilotWidget() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [unread, setUnread]       = useState(0)
  const messagesEndRef             = useRef<HTMLDivElement>(null)
  const inputRef                   = useRef<HTMLTextAreaElement>(null)
  const pathname                   = usePathname()

  // Page context clue
  const pageContext = useCallback(() => {
    const map: Record<string, string> = {
      "/dashboard":              "User is on the main MarketFit dashboard",
      "/dashboard/applications": "User is on the Job Applications tracker",
      "/dashboard/analytics":    "User is on the Analytics & funnel page",
      "/dashboard/resume":       "User is on the Resume Tailor / AI Resume page",
      "/dashboard/resume/result":"User just generated a tailored resume",
      "/dashboard/jobs":         "User is browsing job listings",
      "/dashboard/settings":     "User is on Settings",
    }
    return map[pathname] || `User is on ${pathname}`
  }, [pathname])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, open, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60)
      setUnread(0)
    }
  }, [open])

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput("")

    const userMsg: Message = { role: "user", content, ts: Date.now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      let claudeKey = ""
      try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-8).map(m => ({ role: m.role, content: m.content })),
          context: pageContext(),
          claudeKey,
        }),
      })
      const data = await res.json()
      if (!data.ok || !data.reply) throw new Error(data.error || "No reply")
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }])
      if (!open) setUnread(u => u + 1)
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Something went wrong — ${String(e)}. Make sure you have an API key in Settings.`,
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-xl flex items-center justify-center transition-all"
        style={{
          width: 52, height: 52,
          background: open
            ? "var(--surface)"
            : "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #7c3aed) 100%)",
          border: open ? "1.5px solid var(--border)" : "none",
          color: open ? "var(--text-soft)" : "#fff",
          boxShadow: open ? "0 4px 16px rgba(0,0,0,.15)" : "0 6px 24px rgba(99,102,241,.5)",
        }}
        aria-label={open ? "Close Copilot" : "Open MarketFit Copilot"}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <CopilotIcon />
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "#ef4444" }}>
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 360,
            height: 520,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 24px 64px rgba(0,0,0,.25)",
          }}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #7c3aed) 100%)",
              color: "#fff",
            }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,.2)" }}>
              <CopilotIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-none">MarketFit Copilot</p>
              <p className="text-[11px] opacity-80 mt-0.5">Your AI career strategist</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[11px] opacity-70 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {isEmpty && (
              <div className="space-y-3 py-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg,var(--accent),#7c3aed)" }}>
                    <CopilotIcon />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[85%]"
                    style={{ background: "var(--surface-2)", color: "var(--text)", fontSize: 13, lineHeight: 1.55 }}>
                    Hey! I&apos;m your Copilot. I can walk you through the app — how to tailor a resume, find visa-friendly jobs, or set up alerts — and help with resume strategy, salary, and interviews. What would you like to do?
                  </div>
                </div>
                <p className="text-[11px] pl-8.5" style={{ color: "var(--text-soft)", paddingLeft: "2rem" }}>Try asking:</p>
                <div className="pl-8 space-y-1.5" style={{ paddingLeft: "2rem" }}>
                  {STARTER_PROMPTS.map(p => (
                    <button key={p} onClick={() => send(p)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-xl border transition-all"
                      style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-soft)" }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                    style={{ background: "linear-gradient(135deg,var(--accent),#7c3aed)", color: "#fff" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                    </svg>
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-2.5 max-w-[82%] text-[13px] leading-snug ${
                    msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                  }`}
                  style={msg.role === "user"
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--surface-2)", color: "var(--text)" }}
                  dangerouslySetInnerHTML={
                    msg.role === "assistant"
                      ? { __html: renderMarkdown(msg.content) }
                      : undefined
                  }
                >
                  {msg.role === "user" ? msg.content : undefined}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                  style={{ background: "linear-gradient(135deg,var(--accent),#7c3aed)", color: "#fff" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                  </svg>
                </div>
                <div className="rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "var(--surface-2)" }}>
                  <Spin />
                  <span className="text-[12px]" style={{ color: "var(--text-soft)" }}>Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 py-3 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-end gap-2 rounded-xl border px-3 py-2"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your career…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none"
                style={{
                  color: "var(--text)",
                  lineHeight: 1.5,
                  maxHeight: 80,
                  overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                style={input.trim() && !loading
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface-3, #ddd)", color: "var(--text-soft)", opacity: .5 }}
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: "var(--text-soft)" }}>
              Press Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      )}
    </>
  )
}
