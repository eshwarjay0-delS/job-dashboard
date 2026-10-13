"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, X, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react"
import { tapBuzz, sendBuzz, arriveBuzz } from "@/lib/haptics"
import { speak, stopSpeaking, canSpeak, isSpeaking } from "@/lib/speak"
import { Markdown } from "@/lib/markdown"

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Anything wrong I should know about?",
  "Find me Amit Singh's number",
  "Which submissions need a follow-up?",
]

/* ── Floating agent: the strategist, everywhere ───────────────────────────
   A chat bubble on every dashboard page — as interactive as a real
   conversation, with voice input and haptic taps. Same brain as /dashboard/agent. */

export default function FloatingAgent() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [unread, setUnread] = useState(0)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recogRef = useRef<any>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, busy, open])
  useEffect(() => () => { try { recogRef.current?.stop() } catch { /* noop */ } stopSpeaking() }, [])

  // Unread watchdog alerts nudge the bubble.
  useEffect(() => {
    fetch("/api/agent/notifications", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j.ok && j.unread > 0) { setUnread(j.unread); arriveBuzz() } })
      .catch(() => {})
  }, [])

  function toggle() {
    tapBuzz()
    stopSpeaking()
    setSpeakingIdx(null)
    setOpen(o => {
      if (!o) setUnread(0)
      return !o
    })
  }

  function toggleSpeak(idx: number, text: string) {
    if (speakingIdx === idx && isSpeaking()) {
      stopSpeaking()
      setSpeakingIdx(null)
      return
    }
    tapBuzz()
    stopSpeaking()
    if (speak(text)) {
      setSpeakingIdx(idx)
      // Clear the indicator when speech ends.
      const check = setInterval(() => {
        if (!isSpeaking()) { setSpeakingIdx(null); clearInterval(check) }
      }, 500)
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    stopListening()
    setInput("")
    sendBuzz()
    const next = [...messages, { role: "user" as const, content }]
    setMessages(next)
    setBusy(true)
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const j = await r.json()
      setMessages([...next, { role: "assistant" as const, content: j.reply || j.error || "Something went wrong." }])
      arriveBuzz()
    } catch {
      setMessages([...next, { role: "assistant" as const, content: "Couldn't reach the agent. Try again." }])
    } finally {
      setBusy(false)
    }
  }

  function speechSupported(): boolean {
    return typeof window !== "undefined" &&
      (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window))
  }

  function stopListening() {
    try { recogRef.current?.stop() } catch { /* noop */ }
    setListening(false)
  }

  function toggleListening() {
    if (listening) { stopListening(); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    tapBuzz()
    const recog = new SR()
    recogRef.current = recog
    recog.lang = "en-US"
    recog.interimResults = true
    let finalText = ""
    recog.onresult = (e: any) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + " "
        else interim += t
      }
      setInput((finalText + interim).trim())
    }
    recog.onend = () => {
      setListening(false)
      const said = finalText.trim()
      if (said) {
        // Spoken like a conversation — send it straight in.
        setTimeout(() => send(said), 250)
      }
    }
    recog.onerror = () => setListening(false)
    try {
      recog.start()
      setListening(true)
    } catch { setListening(false) }
  }

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={toggle}
          aria-label="Open the MFit Agent"
          style={{
            position: "fixed", right: 18, bottom: 18, zIndex: 60,
            width: 58, height: 58, borderRadius: 999, border: "none", cursor: "pointer",
            background: "var(--accent)", color: "#fff",
            display: "grid", placeItems: "center",
            boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          }}
        >
          <Bot size={26} />
          {unread > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4, minWidth: 22, height: 22,
              borderRadius: 999, background: "#b3541e", color: "#fff",
              fontSize: 11.5, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 5px",
            }}>
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <section
          aria-label="MFit Agent chat"
          style={{
            position: "fixed", right: 16, bottom: 16, zIndex: 60,
            width: "min(384px, calc(100vw - 32px))",
            height: "min(600px, calc(100dvh - 110px))",
            background: "var(--surface)", border: "1px solid var(--border-strong)",
            borderRadius: 20, boxShadow: "0 18px 60px rgba(0,0,0,0.32)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <header style={{
            display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
            borderBottom: "1px solid var(--border)", flex: "none",
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 999, background: "var(--accent)",
              color: "#fff", display: "grid", placeItems: "center", flex: "none",
            }}>
              <Bot size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 750 }}>MFit Agent</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {listening ? "Listening — speak now" : "Your job-hunt strategist"}
              </div>
            </div>
            <button onClick={toggle} aria-label="Close chat"
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8, color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </header>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: "0 0 10px", lineHeight: 1.55 }}>
                  Ask me anything about your hunt — roles, vendors, interviews. I read your inbox to answer.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => void send(s)} disabled={busy}
                      style={{
                        border: "1px solid var(--border-strong)", background: "var(--surface-2)",
                        borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 650,
                        cursor: "pointer", color: "var(--text)",
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%", padding: "9px 13px", borderRadius: 14,
                background: m.role === "user" ? "#2f6f6a" : "var(--surface-2)",
                color: m.role === "user" ? "#fff" : "var(--text)",
                fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-line",
              }}>
                {/* A reply is Markdown: a table is drawn as a table, a list as a list (src/lib/markdown.ts). What the person
                    typed themselves is shown as they typed it. */}
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                {m.role === "assistant" && canSpeak() && (
                  <button
                    onClick={() => toggleSpeak(i, m.content)}
                    aria-label={speakingIdx === i ? "Stop reading aloud" : "Read this aloud"}
                    title="Read aloud"
                    style={{
                      display: "inline-grid", placeItems: "center", verticalAlign: "middle",
                      marginLeft: 8, width: 26, height: 26, borderRadius: 999,
                      border: "1px solid var(--border)", background: "var(--surface)",
                      color: speakingIdx === i ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {speakingIdx === i ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                )}
              </div>
            ))}
            {busy && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Thinking through your threads…</div>}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)", flex: "none", alignItems: "center" }}>
            {speechSupported() && (
              <button
                onClick={toggleListening}
                aria-label={listening ? "Stop listening" : "Speak instead of typing"}
                title="Speak"
                style={{
                  width: 44, height: 44, borderRadius: 999, border: "1px solid var(--border-strong)",
                  background: listening ? "#b3541e" : "var(--surface-2)", color: listening ? "#fff" : "var(--text)",
                  display: "grid", placeItems: "center", cursor: "pointer", flex: "none",
                  animation: listening ? "agent-pulse 1.4s ease-in-out infinite" : "none",
                }}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void send() }}
              placeholder={listening ? "Listening…" : "Ask anything…"}
              aria-label="Message the agent"
              style={{
                flex: 1, minHeight: 44, borderRadius: 999, border: "1px solid var(--border-strong)",
                padding: "0 16px", fontSize: 14, background: "var(--surface)", color: "var(--text)", minWidth: 0,
              }}
            />
            <button onClick={() => void send()} disabled={busy || !input.trim()} aria-label="Send"
              style={{
                width: 44, height: 44, borderRadius: 999, border: "none", cursor: "pointer", flex: "none",
                background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center",
                opacity: busy || !input.trim() ? 0.45 : 1,
              }}>
              <Send size={17} />
            </button>
          </div>
          <style>{`@keyframes agent-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }`}</style>
        </section>
      )}
    </>
  )
}
