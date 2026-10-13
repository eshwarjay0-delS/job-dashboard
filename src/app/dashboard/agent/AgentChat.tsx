"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { sendBuzz, arriveBuzz } from "@/lib/haptics"
import { speak, stopSpeaking, canSpeak, isSpeaking } from "@/lib/speak"
import { Markdown } from "@/lib/markdown"

interface Msg { role: "user" | "assistant"; content: string }
interface Note { id: string; type: string; title: string; body: string; link: string | null; read: boolean; created_at: string }

const SUGGESTIONS = [
  "Anything wrong I should know about?",
  "Which of my submissions need a follow-up this week?",
  "Check for duplicate submissions on the same role",
  "Any interviews with no follow-up?",
]

export default function AgentChat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [unread, setUnread] = useState(0)
  const [watchdogMsg, setWatchdogMsg] = useState("")
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, busy])
  useEffect(() => { void loadNotes() }, [])

  async function loadNotes() {
    try {
      const r = await fetch("/api/agent/notifications", { cache: "no-store" })
      const j = await r.json()
      if (j.ok) { setNotes(j.notifications); setUnread(j.unread) }
    } catch { /* notifications table may not exist yet */ }
  }

  async function markAllRead() {
    try {
      await fetch("/api/agent/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      setNotes(ns => ns.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput("")
    sendBuzz()
    const next = [...messages, { role: "user" as const, content }]
    setMessages(next)
    setBusy(true)
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const j = await r.json()
      setMessages([...next, { role: "assistant" as const, content: j.reply || j.error || "Something went wrong." }])
      arriveBuzz()
    } catch {
      setMessages([...next, { role: "assistant" as const, content: "Couldn't reach the agent. Try again." }])
    } finally {
      setBusy(false)
      void loadNotes()
    }
  }

  async function runWatchdog() {
    setWatchdogMsg("Checking…")
    try {
      const r = await fetch("/api/agent/watchdog", { method: "POST" })
      const j = await r.json()
      setWatchdogMsg(j.ok
        ? `Checked ${j.checked} threads — ${j.notified} new alert${j.notified === 1 ? "" : "s"}.`
        : (j.error || "Check failed."))
      void loadNotes()
    } catch {
      setWatchdogMsg("Check failed.")
    }
  }

  function toggleSpeak(idx: number, text: string) {
    if (speakingIdx === idx && isSpeaking()) { stopSpeaking(); setSpeakingIdx(null); return }
    stopSpeaking()
    if (speak(text)) {
      setSpeakingIdx(idx)
      const check = setInterval(() => { if (!isSpeaking()) { setSpeakingIdx(null); clearInterval(check) } }, 500)
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, maxWidth: 980 }}>
      <div>
        <div className="ink-label">MFit Agent</div>
        <h1 style={{ margin: "4px 0 8px" }}>Your job-hunt strategist</h1>
        <p style={{ color: "var(--muted)", margin: "0 0 4px", maxWidth: 640 }}>
          Ask about any role, vendor, or submission. The agent pulls every related thread,
          maps the full vendor chain, checks your history — then gives you one precise call.
          It drafts, never sends.
        </p>
      </div>

      {notes.length > 0 && (
        <section style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16, background: "var(--surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong>Watchdog alerts{unread > 0 ? ` (${unread} new)` : ""}</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-outline" style={{ minHeight: 36, fontSize: 13 }} onClick={() => void runWatchdog()}>
                Check now
              </button>
              {unread > 0 && (
                <button className="btn-outline" style={{ minHeight: 36, fontSize: 13 }} onClick={() => void markAllRead()}>
                  Mark all read
                </button>
              )}
            </div>
          </div>
          {watchdogMsg && <p style={{ fontSize: 13, color: "var(--muted)" }}>{watchdogMsg}</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {notes.slice(0, 6).map(n => (
              <div key={n.id} style={{
                borderLeft: `3px solid ${n.read ? "var(--border)" : "#b3541e"}`,
                padding: "8px 12px", background: n.read ? "transparent" : "var(--surface)",
                borderRadius: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "pre-line", marginTop: 4 }}>{n.body}</div>
                <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", display: "flex", flexDirection: "column", minHeight: 480 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, maxHeight: 560 }}>
          {messages.length === 0 && (
            <div>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
                Try one of these, or just ask in your own words:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="btn-outline" style={{ minHeight: 38, fontSize: 13 }}
                    onClick={() => void send(s)} disabled={busy}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%", padding: "10px 14px", borderRadius: 14,
              background: m.role === "user" ? "#2f6f6a" : "var(--surface-2)",
              color: m.role === "user" ? "#fff" : "var(--text)",
              fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-line",
            }}>
              {/* A reply is Markdown: a table is drawn as a table, a list as a list (src/lib/markdown.ts). What the person
                  typed themselves is shown as they typed it. */}
              {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              {m.role === "assistant" && canSpeak() && (
                <button onClick={() => toggleSpeak(i, m.content)}
                  aria-label={speakingIdx === i ? "Stop reading aloud" : "Read this aloud"}
                  style={{
                    display: "inline-grid", placeItems: "center", verticalAlign: "middle",
                    marginLeft: 8, width: 26, height: 26, borderRadius: 999,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: speakingIdx === i ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                  }}>
                  {speakingIdx === i ? "🔇" : "🔊"}
                </button>
              )}
            </div>
          ))}
          {busy && <div style={{ fontSize: 13, color: "var(--hint)" }}>Thinking through your threads…</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void send() }}
            placeholder="Ask about a role, vendor, or submission…"
            style={{ flex: 1, minHeight: 44, borderRadius: 999, border: "1px solid var(--border)", padding: "0 18px", fontSize: 14 }}
          />
          <button className="btn-accent" style={{ minHeight: 44, padding: "0 22px", borderRadius: 999, fontWeight: 700 }}
            onClick={() => void send()} disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </section>

      <p style={{ fontSize: 12.5, color: "var(--hint)", margin: 0 }}>
        The agent reads your connected Gmail accounts to analyze threads. It can create drafts
        for you to review — it never sends email on its own. <Link href="/dashboard/mail">Open your inbox →</Link>
      </p>
    </div>
  )
}
