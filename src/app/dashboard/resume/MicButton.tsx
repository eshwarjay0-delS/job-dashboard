"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Minimal typing for the browser SpeechRecognition API (Chrome/Edge).
interface SpeechRecResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecEvent { resultIndex: number; results: ArrayLike<SpeechRecResult> }
interface SpeechRec {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function MicIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3.5M8.5 21.5h7" />
    </svg>
  )
}

export default function MicButton({
  onText,
  className = "",
}: {
  onText: (chunk: string) => void
  className?: string
}) {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const recRef = useRef<SpeechRec | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec
      webkitSpeechRecognition?: new () => SpeechRec
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) { setSupported(false); return }

    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"
    rec.onresult = (e) => {
      let live = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onTextRef.current(r[0].transcript.trim())
        else live += r[0].transcript
      }
      setInterim(live)
    }
    rec.onend = () => { setListening(false); setInterim("") }
    rec.onerror = () => { setListening(false); setInterim("") }
    recRef.current = rec
    return () => { try { rec.stop() } catch { /* ignore */ } }
  }, [])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    setListening(prev => {
      if (prev) { try { rec.stop() } catch { /* ignore */ } ; return false }
      try { rec.start(); return true } catch { return false }
    })
  }, [])

  // Hotkey: Ctrl/Cmd + Shift + M
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [toggle])

  if (!supported) return null

  return (
    <div className={`relative ${className}`}>
      {listening && (
        <div className="absolute bottom-full right-0 mb-3 w-64 rounded-xl bg-gray-900 p-3 text-white shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-4 items-end gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-teal-400"
                  style={{ height: "16px", transformOrigin: "bottom", animation: `mic-bar 0.9s ease-in-out ${i * 0.12}s infinite` }}
                />
              ))}
            </span>
            <span className="text-xs font-semibold text-teal-300">Listening…</span>
            <span className="ml-auto text-[10px] text-gray-400">⌃⇧M to stop</span>
          </div>
          <p className="mt-1.5 min-h-[16px] text-xs leading-snug text-gray-300">
            {interim || "Speak now — your words appear in the box…"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        title={listening ? "Stop dictation (Ctrl+Shift+M)" : "Dictate with your voice (Ctrl+Shift+M)"}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          listening ? "scale-110 bg-red-500 text-white" : "bg-teal-600 text-white hover:scale-105 hover:bg-teal-700"
        }`}
      >
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400/50 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" style={{ animationDelay: "0.6s" }} />
          </>
        )}
        <MicIcon className="relative w-5 h-5" />
      </button>

      <style>{`@keyframes mic-bar { 0%, 100% { transform: scaleY(0.3) } 50% { transform: scaleY(1) } }`}</style>
    </div>
  )
}
