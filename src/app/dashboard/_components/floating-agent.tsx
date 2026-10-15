"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Sparkles, X, Mic, MicOff, ArrowUp, Volume2, VolumeX } from "lucide-react"
import { tapBuzz, sendBuzz, arriveBuzz } from "@/lib/haptics"
import { speak, stopSpeaking, canSpeak, isSpeaking } from "@/lib/speak"
import { Markdown } from "@/lib/markdown"
import { useFirstName } from "@/lib/use-first-name"
import TypingDots from "./typing-dots"

interface Msg { role: "user" | "assistant"; content: string }

// What to ask first, by the page the person is on. The agent reads job mail, submissions and contacts (its tools in
// src/app/api/agent/_tools.ts), so every starter is a question it can answer from those. No real person's name is
// shown here: a starter once read "Find me Amit Singh's number" for everyone.
const STARTERS: { on: string[]; ask: string[] }[] = [
  { on: ["/dashboard/mail", "/dashboard/tracker", "/dashboard/workflows", "/dashboard/connections"],
    ask: ["Who is waiting on a reply from me?", "Which submissions need a follow-up?", "Any duplicate submissions on one role?"] },
  { on: ["/dashboard/calendar", "/dashboard/kompas"],
    ask: ["When is my next interview?", "Which interviews have no follow-up yet?", "What did the recruiter say about my next interview?"] },
  { on: ["/dashboard/resume", "/dashboard/documents"],
    ask: ["Which roles am I sent for most?", "Which companies replied this week?", "Anything wrong I should know about?"] },
]
const FIRST = ["What should I do first today?", "Anything wrong I should know about?", "Which submissions need a follow-up?"]

function startersFor(path: string): string[] {
  return STARTERS.find(s => s.on.some(p => path === p || path.startsWith(p + "/")))?.ask ?? FIRST
}

/* ── Floating agent: the strategist, everywhere ───────────────────────────
   A chat on every dashboard page, as live as a real conversation: it says hello by name, offers questions that fit the
   page, shows it is writing, and can listen and read aloud. Same brain as /dashboard/agent.
   The look (design system 2, 14 Oct 2026): "the chat should be engaging, not a dull bot". */

export default function FloatingAgent() {
  const path = usePathname() || ""
  const name = useFirstName()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [unread, setUnread] = useState(0)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recogRef = useRef<any>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [messages, busy, open])
  useEffect(() => () => { try { recogRef.current?.stop() } catch { /* noop */ } stopSpeaking() }, [])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // Unread watchdog alerts nudge the bubble.
  useEffect(() => {
    fetch("/api/agent/notifications", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j.ok && j.unread > 0) { setUnread(j.unread); arriveBuzz() } })
      .catch(() => {})
  }, [])

  // Escape closes the chat, as every pop-up window does.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") toggle() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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
      setMessages([...next, { role: "assistant" as const, content: j.reply || j.error || "Something went wrong on my side. Ask me again in a moment." }])
      arriveBuzz()
    } catch {
      setMessages([...next, { role: "assistant" as const, content: "I couldn't reach my side of the app just now. Check your connection and ask again." }])
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

  const status = listening ? "Listening, speak now" : busy ? "Writing…" : "Reads your job mail"

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button type="button" onClick={toggle} className="mf-agent-launch" aria-label="Ask MFit">
          <Sparkles size={20} aria-hidden="true" />
          <span className="mf-agent-launch-text">Ask MFit</span>
          {unread > 0 && <span className="mf-agent-badge" aria-label={`${unread} new`}>{unread}</span>}
        </button>
      )}

      {/* Panel */}
      {open && (
        <section aria-label="MFit Agent chat" className="mf-agent-panel">
          <header className="mf-agent-head">
            <span className="mf-agent-avatar"><Sparkles size={17} aria-hidden="true" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mf-agent-name">MFit Agent</div>
              <div className="mf-agent-status"><span className={`mf-agent-dot${listening ? " is-listening" : ""}`} aria-hidden="true" />{status}</div>
            </div>
            <button type="button" onClick={toggle} aria-label="Close chat" className="mf-agent-icon-btn">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="mf-agent-body" aria-live="polite">
            <div className="mf-agent-msg is-agent">
              <p style={{ margin: 0 }}>
                Hi{name ? ` ${name}` : ""}! I read your job mail, so I can tell you who is waiting on you, what needs a
                follow-up and when your next interview is.
              </p>
            </div>
            {messages.length === 0 && (
              <div className="mf-agent-starters">
                <span>Try asking</span>
                {startersFor(path).map(s => (
                  <button type="button" key={s} onClick={() => void send(s)} disabled={busy}>{s}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`mf-agent-msg ${m.role === "user" ? "is-user" : "is-agent"}`}>
                {/* A reply is Markdown: a table is drawn as a table, a list as a list (src/lib/markdown.ts). What the person
                    typed themselves is shown as they typed it. */}
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                {m.role === "assistant" && canSpeak() && (
                  <button type="button" onClick={() => toggleSpeak(i, m.content)} className="mf-agent-speak"
                    aria-label={speakingIdx === i ? "Stop reading aloud" : "Read this aloud"} title="Read aloud">
                    {speakingIdx === i ? <VolumeX size={13} aria-hidden="true" /> : <Volume2 size={13} aria-hidden="true" />}
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="mf-agent-msg is-agent is-typing" role="status" aria-label="MFit Agent is writing"><TypingDots size={6} /></div>}
            <div ref={bottomRef} />
          </div>

          <form className="mf-agent-compose" onSubmit={e => { e.preventDefault(); void send() }}>
            {speechSupported() && (
              <button type="button" onClick={toggleListening} className={`mf-agent-icon-btn mf-agent-mic${listening ? " is-on" : ""}`}
                aria-label={listening ? "Stop listening" : "Speak instead of typing"} title="Speak">
                {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask about your job search…"}
              aria-label="Message the agent"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="mf-agent-send">
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  )
}
