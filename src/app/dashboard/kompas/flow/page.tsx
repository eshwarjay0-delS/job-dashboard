"use client"

// Kompas Flow (owner, 2026-10-07: "Kompas flow and transcribe in the kompas section in job dashboard").
//
// Press one button, speak, press it again, and get clean text to paste anywhere. The person can always see their own words
// exactly as said beside the tidied version: the tidied one is shown first only when the server's guard found it still says
// what they said (src/lib/kompasTranscript.ts).
//
// What this page takes care not to do: leave the microphone on (every way out of a recording stops the tracks, so the
// browser's microphone light goes off), let a slow answer from an earlier recording land in a newer one, or keep anything a
// person said anywhere but their own browser. The recording itself is dropped the moment its text arrives.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import PageIntro from "../../_components/page-intro"
import { Card, Chip, Meta } from "../../_suite/ui"
import { flowResult, type Layer } from "@/lib/kompasTranscript"
import { useOwnDocument } from "../_mic"

type Result = { raw: string; clean: string | null; kept: Layer }
type Past = { id: string; at: number; raw: string; clean: string | null; kept: Layer }

const MAX_SECONDS = 90
// Kompas Flow for Android (owner, 2026-10-08: "Just like how we would get a desktop version. while starting kompas flow it
// download apk version of the app"). Built from android-flow/ in the Kompas repository by its own workflow and copied here;
// small enough to live in git, unlike the desktop app. It is an icon that opens this page in the phone's browser, so the
// sign-in and the microphone are the browser's, exactly as here.
const FLOW_APK = "/apps/Kompas-Flow.apk"
const HISTORY_KEY = "mf_flow_history"
const HINT_KEY = "mf_flow_hint"
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]

const SMALL: CSSProperties = { fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }
const SAID: CSSProperties = { fontSize: 19, lineHeight: 1.6, color: "var(--text)", margin: "14px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
const FIELD: CSSProperties = {
  width: "100%", minHeight: 44, padding: "0 12px", fontSize: 15, color: "var(--text)",
  background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)",
}
const QUIET: CSSProperties = { minHeight: 44, padding: "0 16px", fontSize: 15 }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
const read = <T,>(key: string, otherwise: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : otherwise } catch { return otherwise } }
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage is blocked: the page works without it */ } }

function problem(code: string | undefined, retryAfter: string | null): string {
  if (code === "signed-out") return "You have been signed out. Sign in again, then come back here."
  if (code === "too-large") return "That was too long to send in one piece. Try a shorter stretch."
  if (code === "empty") return "I did not hear anything. Try again, a little closer to the microphone."
  if (code === "bad-audio") return "That recording could not be read. Try again."
  if (code === "busy") return `Too many at once. Try again in ${Math.max(1, Number(retryAfter) || 30)} seconds.`
  return "Speech to text is not available right now. Try again in a minute."
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export default function FlowPage() {
  const [phase, setPhase] = useState<"idle" | "recording" | "working">("idle")
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [layer, setLayer] = useState<Layer>("raw")
  const [note, setNote] = useState("")
  const [cut, setCut] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")
  const [hint, setHint] = useState("")
  const [past, setPast] = useState<Past[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [onAndroid, setOnAndroid] = useState(false)

  // What a recording holds while it runs. Kept in refs: stopping must work from a timer, a key press and an unmount alike.
  const live = useRef<{ stream: MediaStream; recorder: MediaRecorder; context: AudioContext | null; frame: number; tick: number } | null>(null)
  const starting = useRef(false)
  const run = useRef(0)          // which dictation an answer belongs to: a later Start makes earlier answers stale
  const hintRef = useRef("")

  useOwnDocument()
  useEffect(() => { const h = read<string>(HINT_KEY, ""); setHint(h); hintRef.current = h; setPast(read<Past[]>(HISTORY_KEY, [])); setOnAndroid(/Android/i.test(navigator.userAgent)) }, [])

  // Every way out of a recording goes through here, so the microphone is always let go.
  const release = useCallback(() => {
    const now = live.current
    live.current = null
    if (!now) return
    window.clearInterval(now.tick)
    cancelAnimationFrame(now.frame)
    now.stream.getTracks().forEach(track => track.stop())
    void now.context?.close().catch(() => {})
    setLevel(0)
  }, [])

  const toText = useCallback(async (blob: Blob, mine: number) => {
    setPhase("working"); setStatus("Writing down what you said…")
    try {
      const heard = await fetch("/api/kompas/speech", {
        method: "POST", body: blob,
        headers: { "content-type": "application/octet-stream", "x-audio-mime": blob.type || "audio/webm", "x-speech-for": "flow", ...(hintRef.current ? { "x-speech-hint": encodeURIComponent(hintRef.current) } : {}) },
      })
      if (run.current !== mine) return
      const body = await heard.json().catch(() => ({}))
      if (run.current !== mine) return
      if (!heard.ok) { setError(problem(body.code, heard.headers.get("retry-after"))); setStatus(""); setPhase("idle"); return }
      const raw = String(body.text || "").trim()
      if (!raw) { setError(problem("empty", null)); setStatus(""); setPhase("idle"); return }

      // Their own words are on the screen at once; the tidied wording joins them when it arrives.
      setResult({ raw, clean: null, kept: "raw" }); setLayer("raw"); setStatus("Tidying…")
      let clean: string | null = null, said = ""
      try {
        const tidied = await fetch("/api/kompas/tidy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: raw, for: "flow" }) })
        const answer = await tidied.json().catch(() => ({}))
        if (tidied.ok && answer.kept === "clean" && typeof answer.tidy === "string") clean = answer.tidy
        else said = typeof answer.note === "string" ? answer.note : "Tidying is not available right now, so your own words are shown."
      } catch { said = "Tidying is not available right now, so your own words are shown." }
      if (run.current !== mine) return
      const made = flowResult(raw, clean)
      setResult(made); setLayer(made.kept); setNote(made.kept === "raw" ? said || "The tidied text changed what was said, so your own words are shown." : "")
      setPast(before => { const next = [{ id: `${Date.now()}-${mine}`, at: Date.now(), ...made }, ...before].slice(0, 20); write(HISTORY_KEY, next); return next })
      setStatus(""); setPhase("idle")
    } catch {
      if (run.current !== mine) return
      setError("That could not be sent. Check your connection and try again."); setStatus(""); setPhase("idle")
    }
  }, [])

  const stop = useCallback(() => {
    const now = live.current
    if (!now || now.recorder.state === "inactive") return
    now.recorder.stop()            // its onstop sends what was recorded and lets the microphone go
  }, [])

  const start = useCallback(async () => {
    if (starting.current || live.current) return
    starting.current = true
    const mine = ++run.current
    setError(""); setNote(""); setCut(false); setCopied(""); setResult(null); setSeconds(0)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser cannot record sound. Try a current version of Chrome, Edge, Safari or Firefox."); return }
      let stream: MediaStream
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
      catch (e) {
        const name = (e as DOMException)?.name
        setError(name === "NotFoundError" ? "No microphone was found. Plug one in, or check that it is turned on." : "The microphone is blocked for this site. Allow it from the lock icon in the address bar, then press Start speaking again.")
        return
      }
      if (run.current !== mine) { stream.getTracks().forEach(t => t.stop()); return }
      const type = TYPES.find(t => MediaRecorder.isTypeSupported(t))
      const recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
      const parts: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
      recorder.onstop = () => {
        release()
        const blob = new Blob(parts, { type: recorder.mimeType || type || "audio/webm" })
        parts.length = 0
        if (run.current === mine) void toText(blob, mine)
      }
      recorder.onerror = () => { release(); if (run.current === mine) { setError("The recording stopped unexpectedly. Try again."); setPhase("idle") } }

      // A small picture of the voice, so the person can see they are being heard. It is optional: no meter is not an error.
      let context: AudioContext | null = null, frame = 0
      try {
        context = new AudioContext()
        const analyser = context.createAnalyser(); analyser.fftSize = 512
        context.createMediaStreamSource(stream).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        const draw = () => {
          analyser.getByteTimeDomainData(samples)
          let peak = 0
          for (const v of samples) peak = Math.max(peak, Math.abs(v - 128))
          setLevel(Math.min(1, peak / 64))
          if (live.current) live.current.frame = requestAnimationFrame(draw)
        }
        frame = requestAnimationFrame(draw)
      } catch { context = null }

      const began = Date.now()
      const tick = window.setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000)
        setSeconds(s)
        if (s >= MAX_SECONDS) { setCut(true); stop() }
      }, 250)
      live.current = { stream, recorder, context, frame, tick }
      recorder.start()
      setPhase("recording"); setStatus("")
    } finally { starting.current = false }
  }, [release, stop, toText])

  // Leaving the page lets the microphone go and makes any answer still on its way stale.
  useEffect(() => () => { run.current++; const now = live.current; if (now && now.recorder.state !== "inactive") { now.recorder.onstop = null; try { now.recorder.stop() } catch { /* already stopped */ } } release() }, [release])

  const press = useCallback(() => { if (phase === "recording") stop(); else if (phase === "idle") void start() }, [phase, start, stop])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(el.tagName))) return
      e.preventDefault(); press()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [press])

  const shown = result ? (layer === "clean" && result.clean ? result.clean : result.raw) : ""
  const doCopy = async (text: string, id: string) => { setCopied((await copy(text)) ? id : `${id}:failed`); window.setTimeout(() => setCopied(c => (c.startsWith(id) ? "" : c)), 2200) }
  const forget = (id: string) => setPast(before => { const next = before.filter(p => p.id !== id); write(HISTORY_KEY, next); return next })

  // The offer of the Android app. On an Android phone it sits at the top, where a person starting Flow sees it; anywhere
  // else it is a quiet card further down, for someone who wants to send the file to their phone.
  const app = (
    <Card style={{ marginBottom: 16 }}>
      <Meta>Kompas Flow for Android</Meta>
      <p style={{ ...SMALL, fontSize: 15.5, marginTop: 8 }}>{onAndroid ? "Put Kompas Flow on your home screen. One tap and you are here, ready to speak." : "On an Android phone? The app puts Kompas Flow on its home screen: one tap and you are ready to speak."}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <a href={FLOW_APK} download="Kompas-Flow.apk" className="btn-outline" style={{ ...QUIET, display: "inline-flex", alignItems: "center", textDecoration: "none" }} title="Download Kompas-Flow.apk, the Android app">Download for Android</a>
      </div>
      <p style={{ ...SMALL, marginTop: 10 }}>It is not in the Play Store yet, so your phone will ask you to allow installing from your browser. It needs Android 8 or later. It opens this page in your browser, so you sign in and allow the microphone the same way as here.</p>
    </Card>
  )

  return (
    <div style={{ maxWidth: 760 }}>
      <PageIntro page="/dashboard/kompas/flow"
        action={{ label: phase === "recording" ? "Stop" : phase === "working" ? "Working…" : "Start speaking", onClick: press }}
        sample="Or press the space bar to start and stop." />

      {onAndroid && phase === "idle" && !result && app}

      {phase === "recording" && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Listening <span style={{ fontFamily: "var(--font-num)", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", fontWeight: 500 }}>{clock(seconds)}</span></div>
              <div aria-hidden style={{ height: 8, marginTop: 8, borderRadius: 100, background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round(level * 100)}%`, height: "100%", background: "var(--accent)", transition: "width 80ms linear" }} />
              </div>
            </div>
          </div>
        </Card>
      )}

      <p role="status" aria-live="polite" style={{ ...SMALL, minHeight: status ? 24 : 0, marginBottom: status ? 12 : 0 }}>{status}</p>
      {error && <div role="alert" style={{ marginBottom: 16, padding: "14px 18px", borderRadius: "var(--radius-lg)", background: "var(--danger-soft)", border: "1px solid var(--danger-border)", color: "var(--text)", fontSize: 15, lineHeight: 1.55 }}>{error}</div>}

      {result ? (
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Tidied" active={layer === "clean"} disabled={!result.clean} onClick={() => setLayer("clean")} />
            <Chip label="As you said it" active={layer === "raw"} onClick={() => setLayer("raw")} />
          </div>
          <p style={SAID}>{shown}</p>
          {note && <p style={{ ...SMALL, marginTop: 12 }}>{note}</p>}
          {cut && <p style={{ ...SMALL, marginTop: 12 }}>Stopped at {MAX_SECONDS} seconds, the longest one dictation can be. Press Speak again to go on.</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button type="button" className="btn-outline" style={QUIET} onClick={() => void doCopy(shown, "now")}>{copied === "now" ? "Copied" : "Copy"}</button>
            <button type="button" className="btn-ghost" style={QUIET} disabled={phase !== "idle"} onClick={() => void start()}>Speak again</button>
            {copied === "now:failed" && <span role="alert" style={{ ...SMALL, color: "var(--danger)" }}>The browser would not copy it. Select the text and copy it yourself.</span>}
          </div>
        </Card>
      ) : phase === "idle" && !error ? (
        <Card><p style={{ ...SMALL, fontSize: 16 }}>Press <strong style={{ color: "var(--text)" }}>Start speaking</strong>, say what you want written, and press <strong style={{ color: "var(--text)" }}>Stop</strong>. Your words appear here, tidied, ready to copy.</p></Card>
      ) : null}

      <section style={{ marginTop: 32 }}>
        <label htmlFor="flow-hint"><Meta>Words to listen for</Meta></label>
        <input id="flow-hint" value={hint} maxLength={400} placeholder="Names and unusual words, like Kubernetes, Priyanka, Terraform"
          onChange={e => { const v = e.target.value.slice(0, 400); setHint(v); hintRef.current = v; write(HINT_KEY, v) }}
          style={{ ...FIELD, marginTop: 8 }} />
        <p style={{ ...SMALL, marginTop: 8 }}>Optional. It helps unusual names and technical words come out right.</p>
      </section>

      {!onAndroid && <section style={{ marginTop: 32 }}>{app}</section>}

      <section style={{ marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)", margin: 0 }}>Earlier</h2>
          {past.length > 0 && <button type="button" className="btn-ghost" style={QUIET} onClick={() => { if (window.confirm("Remove everything you dictated earlier from this browser?")) { setPast([]); write(HISTORY_KEY, []) } }}>Remove all</button>}
        </div>
        <p style={{ ...SMALL, margin: "4px 0 16px" }}>Kept only in this browser. MarketFit keeps nothing you say.</p>
        {past.length === 0 ? <Card><p style={SMALL}>Nothing yet. What you dictate will be listed here.</p></Card> : (
          <div style={{ display: "grid", gap: 12 }}>
            {past.map(p => {
              const text = p.kept === "clean" && p.clean ? p.clean : p.raw
              const wide = open === p.id
              return (
                <Card key={p.id} style={{ padding: 16 }}>
                  <Meta>{new Date(p.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {p.kept === "clean" ? "tidied" : "as said"}</Meta>
                  <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--text)", margin: "8px 0 0", overflowWrap: "anywhere", whiteSpace: wide ? "pre-wrap" : "normal", ...(wide ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{text}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button type="button" className="btn-outline" style={QUIET} onClick={() => void doCopy(text, p.id)}>{copied === p.id ? "Copied" : "Copy"}</button>
                    <button type="button" className="btn-ghost" style={QUIET} aria-expanded={wide} onClick={() => setOpen(wide ? null : p.id)}>{wide ? "Show less" : "Show all"}</button>
                    <button type="button" className="btn-ghost" style={QUIET} onClick={() => forget(p.id)}>Remove</button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
