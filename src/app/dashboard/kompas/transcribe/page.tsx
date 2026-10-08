"use client"

// Kompas Transcribe (owner, 2026-10-07: "Kompas flow and transcribe in the kompas section in job dashboard").
//
// A person turns a talk they are in, or a recording they have, into text with times, and keeps it on their own device.
//
// It is consent-first, and that is in the code, not only in the words: there is no transcript to record into until
// startSession() (src/lib/kompasTranscript.ts) has accepted the answer to "Who is speaking?", and it refuses when other
// people in the recording have not been told. The microphone and the file picker are reachable only from an accepted
// session. While the microphone is on, a "Recording" line with a clock is on the screen the whole time: nothing here listens
// in the background.
//
// What else this page takes care not to do: drop a part that could not be read (it stays in the transcript as a marked gap,
// and can be tried again while its sound is still in memory), let an answer for an earlier transcript land in a newer one,
// leave the microphone on after any way out, or keep the sound itself: only the text is kept, and only on this device.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import PageIntro from "../../_components/page-intro"
import { Card, Chip, Meta } from "../../_suite/ui"
import {
  appendSegment, asMarkdown, asPlainText, clockAt, lengthMs, replaceSegment, startSession, transcriptLines, withClean, wordCount,
  type Consent, type Layer, type Session,
} from "@/lib/kompasTranscript"
import { MAX_FILE_BYTES, MAX_MINUTES, decode, partsOf, wavPart, type DecodeProblem } from "./audio"
import { deleteSession, listSessions, saveSession, type Kept } from "./store"
import { useOwnDocument } from "../_mic"

const PART_MS = 20_000
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
const WAITS = [5, 10, 20]

const SMALL: CSSProperties = { fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }
const H2: CSSProperties = { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)", margin: 0 }
const FIELD: CSSProperties = { width: "100%", minHeight: 44, padding: "0 12px", fontSize: 15, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)" }
const QUIET: CSSProperties = { minHeight: 44, padding: "0 16px", fontSize: 15 }
const NUM: CSSProperties = { fontFamily: "var(--font-num)", fontVariantNumeric: "tabular-nums" }

const WHO: { consent: Consent; label: string; more: string }[] = [
  { consent: "only-me", label: "Only me", more: "Notes to yourself, practice, a voice memo." },
  { consent: "others-told", label: "Other people too, and they know it is being recorded", more: "A meeting or a call where you have told everyone." },
  { consent: "others-not-told", label: "Other people who have not been told", more: "" },
]

function problem(code: string | undefined): string {
  if (code === "signed-out") return "You have been signed out. Sign in again, then come back: your transcript so far is kept."
  if (code === "too-large") return "A part was too large to send."
  if (code === "bad-audio") return "A part of the sound could not be read."
  if (code === "busy") return "The service was too busy for a part, even after waiting."
  if (code === "unavailable") return "Speech to text is not available right now. Parts that could not be read are marked; try them again in a minute."
  return "A part could not be sent. Check your connection."
}
const FILE_PROBLEM: Record<DecodeProblem, string> = {
  "too-big": `That file is over ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB, which is more than a browser can open safely. Use a shorter or smaller recording, or Record now.`,
  "too-long": `That recording is longer than ${MAX_MINUTES} minutes. Cut it into shorter pieces and transcribe them one at a time.`,
  "cannot-read": "This browser could not open that file. The kinds that work are mp3, m4a, wav, webm and ogg.",
  "no-support": "This browser cannot open sound files. Try a current version of Chrome, Edge, Safari or Firefox.",
}
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const wait = (seconds: number) => new Promise(resolve => window.setTimeout(resolve, seconds * 1000))

type Heard = { ok: true; text: string } | { ok: false; code: string }

// One part to the server. A busy answer is waited out and tried again, three times at most; anything else comes straight back.
async function hear(blob: Blob, hint: string, stillWanted: () => boolean): Promise<Heard> {
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch("/api/kompas/speech", {
        method: "POST", body: blob,
        headers: { "content-type": "application/octet-stream", "x-audio-mime": blob.type || "audio/webm", "x-speech-for": "transcribe", ...(hint ? { "x-speech-hint": encodeURIComponent(hint) } : {}) },
      })
    } catch { return { ok: false, code: "network" } }
    const body = await response.json().catch(() => ({}))
    if (response.ok) return { ok: true, text: String(body.text || "") }
    // Silence is not a failure: a part in which nobody spoke simply has no words.
    if (body.code === "empty") return { ok: true, text: "" }
    if (body.code !== "busy" || attempt >= WAITS.length || !stillWanted()) return { ok: false, code: String(body.code || "unavailable") }
    await wait(Math.min(60, Number(response.headers.get("retry-after")) || WAITS[attempt]))
  }
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement("a")
  a.href = url; a.download = name
  document.body.append(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function TranscribePage() {
  const [who, setWho] = useState<Consent | null>(null)
  const [title, setTitle] = useState("")
  const [refused, setRefused] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<"idle" | "recording" | "sending" | "file" | "tidying">("idle")
  const [seconds, setSeconds] = useState(0)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [notKept, setNotKept] = useState(false)
  const [layer, setLayer] = useState<Layer>("raw")
  const [hint, setHint] = useState("")
  const [copied, setCopied] = useState<"" | "yes" | "no">("")
  const [kept, setKept] = useState<Kept[]>([])
  const [retryable, setRetryable] = useState<string[]>([])
  const [renaming, setRenaming] = useState(false)
  // "Who is speaking?" is answered for the recording about to be made. A transcript opened from the list was answered for
  // on another day, for other sound: it can be read, tidied and saved, but nothing more is recorded into it.
  const [answered, setAnswered] = useState<string | null>(null)

  const current = useRef<Session | null>(null)      // the truth while parts arrive out of step with rendering
  const live = useRef<{ stream: MediaStream; recorder: MediaRecorder | null; rotate: number; tick: number; began: number; on: boolean } | null>(null)
  const sounds = useRef(new Map<string, Blob>())    // the sound of parts that failed, so they can be tried again; memory only
  const pending = useRef(0)
  const starting = useRef(false)
  const hintRef = useRef("")
  const fileInput = useRef<HTMLInputElement>(null)
  const answeredRef = useRef<string | null>(null)

  useOwnDocument()

  const refreshKept = useCallback(async () => setKept(await listSessions()), [])
  useEffect(() => { void refreshKept() }, [refreshKept])

  // Every change to the transcript goes through here: the screen, the ref and the device's store stay in step.
  const put = useCallback((change: (s: Session) => Session, forId: string) => {
    const now = current.current
    if (!now || now.id !== forId) return            // an answer for a transcript that is no longer the open one
    const next = change(now)
    current.current = next
    setSession(next)
    if (next.segments.length) void saveSession(next, Date.now()).then(ok => { setNotKept(!ok); if (ok) void refreshKept() })
  }, [refreshKept])

  const release = useCallback(() => {
    const now = live.current
    live.current = null
    if (!now) return
    now.on = false
    window.clearTimeout(now.rotate); window.clearInterval(now.tick)
    now.stream.getTracks().forEach(track => track.stop())
  }, [])
  useEffect(() => () => { const now = live.current; if (now?.recorder && now.recorder.state !== "inactive") { now.recorder.onstop = null; try { now.recorder.stop() } catch { /* already stopped */ } } release(); current.current = null }, [release])

  const sendPart = useCallback(async (part: { id: string; blob: Blob; startMs: number; endMs: number }, forId: string) => {
    pending.current++
    const heard = await hear(part.blob, hintRef.current, () => current.current?.id === forId)
    pending.current--
    if (heard.ok) { sounds.current.delete(part.id); put(s => appendSegment(s, { id: part.id, startMs: part.startMs, endMs: part.endMs, raw: heard.text }), forId) }
    else {
      sounds.current.set(part.id, part.blob)
      if (current.current?.id === forId) { setRetryable([...sounds.current.keys()]); setError(problem(heard.code)) }
      put(s => appendSegment(s, { id: part.id, startMs: part.startMs, endMs: part.endMs, raw: "", failed: true }), forId)
    }
    if (current.current?.id === forId && !live.current && pending.current === 0) setPhase(p => (p === "sending" ? "idle" : p))
  }, [put])

  // ── who is speaking ──────────────────────────────────────────────────────────
  const begin = () => {
    if (!who) return
    const started = startSession({ id: newId(), title, startedAt: Date.now(), consent: who })
    if (!started.ok) { setRefused(true); return }
    setRefused(false); setError(""); setNotKept(false); setLayer("raw"); setCopied(""); setRetryable([]); sounds.current.clear()
    current.current = started.session
    answeredRef.current = started.session.id; setAnswered(started.session.id)
    setSession(started.session)
  }

  // ── record now ───────────────────────────────────────────────────────────────
  const record = useCallback(async () => {
    const open = current.current
    if (!open || answeredRef.current !== open.id || starting.current || live.current) return      // no answer for this transcript in this visit, no microphone
    starting.current = true
    setError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser cannot record sound. Try a current version of Chrome, Edge, Safari or Firefox."); return }
      let stream: MediaStream
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
      catch (e) {
        setError((e as DOMException)?.name === "NotFoundError" ? "No microphone was found. Plug one in, or check that it is turned on." : "The microphone is blocked for this site. Allow it from the lock icon in the address bar, then press Record now again.")
        return
      }
      if (current.current?.id !== open.id) { stream.getTracks().forEach(t => t.stop()); return }
      const type = TYPES.find(t => MediaRecorder.isTypeSupported(t))
      // A transcript that already has parts is continued after its last one.
      const offset = lengthMs(open)
      const began = Date.now()
      const state = { stream, recorder: null as MediaRecorder | null, rotate: 0, tick: 0, began, on: true }
      live.current = state

      // Each part is a whole file by itself: a new recorder is started on the same microphone before the old one is closed,
      // so no sound falls between two parts.
      const part = () => {
        const recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
        const chunks: Blob[] = []
        const startMs = offset + (Date.now() - began)
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" })
          void sendPart({ id: newId(), blob, startMs, endMs: offset + (Date.now() - began) }, open.id)
        }
        recorder.start()
        state.recorder = recorder
        state.rotate = window.setTimeout(() => { if (!state.on) return; const old = recorder; part(); if (old.state !== "inactive") old.stop() }, PART_MS)
      }
      part()
      state.tick = window.setInterval(() => setSeconds(Math.floor((offset + Date.now() - began) / 1000)), 500)
      setSeconds(Math.floor(offset / 1000)); setPhase("recording")
    } finally { starting.current = false }
  }, [sendPart])

  const stopRecording = useCallback(() => {
    const now = live.current
    if (!now) return
    const last = now.recorder
    release()
    setPhase("sending")
    if (last && last.state !== "inactive") last.stop()          // its onstop sends the last part
    else if (pending.current === 0) setPhase("idle")
  }, [release])

  // ── choose a recording ───────────────────────────────────────────────────────
  const readFile = useCallback(async (file: File) => {
    const open = current.current
    if (!open || answeredRef.current !== open.id || phase !== "idle") return
    setError(""); setPhase("file"); setProgress("Opening the recording…")
    const opened = await decode(file)
    if (current.current?.id !== open.id) return
    if (!opened.ok) { setError(FILE_PROBLEM[opened.because]); setPhase("idle"); setProgress(""); return }
    const offset = lengthMs(open)
    const parts = partsOf(opened.audio.samples.length)
    for (let i = 0; i < parts.length; i++) {
      if (current.current?.id !== open.id) return
      setProgress(`Part ${i + 1} of ${parts.length}`)
      const p = parts[i]
      await sendPart({ id: newId(), blob: wavPart(opened.audio.samples, p.from, p.to), startMs: offset + p.startMs, endMs: offset + p.endMs }, open.id)
    }
    if (current.current?.id === open.id) { setPhase("idle"); setProgress("") }
  }, [phase, sendPart])

  const again = useCallback(async (id: string) => {
    const open = current.current, blob = sounds.current.get(id)
    if (!open || !blob) return
    setError("")
    const heard = await hear(blob, hintRef.current, () => current.current?.id === open.id)
    if (current.current?.id !== open.id) return
    if (!heard.ok) { setError(problem(heard.code)); return }
    sounds.current.delete(id); setRetryable([...sounds.current.keys()])
    // A part that turns out to hold no words is no longer a gap: it is taken out.
    put(s => (heard.text.trim() ? replaceSegment(s, id, heard.text) : { ...s, segments: s.segments.filter(x => x.id !== id) }), open.id)
  }, [put])

  // ── tidy ─────────────────────────────────────────────────────────────────────
  const tidy = useCallback(async () => {
    const open = current.current
    if (!open || phase !== "idle") return
    const todo = open.segments.filter(s => !s.failed && !s.clean && s.raw)
    if (!todo.length) { setLayer("clean"); return }
    setPhase("tidying"); setError("")
    let leftRaw = 0
    for (let i = 0; i < todo.length; i++) {
      if (current.current?.id !== open.id) return
      setProgress(`Tidying ${i + 1} of ${todo.length}`)
      try {
        const response = await fetch("/api/kompas/tidy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: todo[i].raw, for: "transcribe" }) })
        const answer = await response.json().catch(() => ({}))
        if (response.ok && answer.kept === "clean" && typeof answer.tidy === "string") put(s => withClean(s, todo[i].id, answer.tidy), open.id)
        else { leftRaw++; if (response.status === 401) { setError(problem("signed-out")); break } }
      } catch { leftRaw++ }
    }
    if (current.current?.id !== open.id) return
    setPhase("idle"); setLayer("clean")
    setProgress(leftRaw ? `${leftRaw} ${leftRaw === 1 ? "part was" : "parts were"} left as said, because tidying would have changed the words or was not available.` : "")
  }, [phase, put])

  const lines = session ? transcriptLines(session, layer) : []
  const hasText = lines.some(l => l.text)
  const busy = phase !== "idle"
  const copyAll = async () => { if (!session) return; try { await navigator.clipboard.writeText(asPlainText(session, layer)); setCopied("yes") } catch { setCopied("no") } window.setTimeout(() => setCopied(""), 2400) }
  const leave = () => { if (busy) return; current.current = null; answeredRef.current = null; setAnswered(null); setSession(null); setWho(null); setTitle(""); setPhase("idle"); setProgress(""); setError(""); setRenaming(false); sounds.current.clear(); setRetryable([]) }
  const openKept = (k: Kept) => { const { updatedAt: _dropped, ...s } = k; void _dropped; answeredRef.current = null; setAnswered(null); current.current = s; setSession(s); setLayer(s.segments.some(x => x.clean) ? "clean" : "raw"); setError(""); setProgress(""); setNotKept(false); sounds.current.clear(); setRetryable([]); window.scrollTo({ top: 0, behavior: "smooth" }) }
  const fileName = (ext: string) => `${(session?.title || "transcript").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "transcript"}.${ext}`

  const action = !session ? { label: "Start a transcript", href: "#who" }
    : phase === "recording" ? { label: "Stop", onClick: stopRecording }
    : busy ? { label: "Working…", onClick: () => {} }
    : hasText ? { label: copied === "yes" ? "Copied" : "Copy all", onClick: () => void copyAll() }
    : answered === session.id ? { label: "Record now", onClick: () => void record() }
    : { label: "Start a transcript", onClick: () => leave() }

  return (
    <div style={{ maxWidth: 820 }}>
      <PageIntro page="/dashboard/kompas/transcribe" action={action} />

      {error && <div role="alert" style={{ marginBottom: 16, padding: "14px 18px", borderRadius: "var(--radius-lg)", background: "var(--danger-soft)", border: "1px solid var(--danger-border)", color: "var(--text)", fontSize: 15, lineHeight: 1.55 }}>{error}</div>}
      {copied === "no" && <p role="alert" style={{ ...SMALL, color: "var(--danger)", marginBottom: 12 }}>The browser would not copy it. Use Download instead.</p>}

      {!session ? (
        <Card id="who">
          <h2 style={H2}>Who is speaking?</h2>
          <p style={{ ...SMALL, margin: "4px 0 16px" }}>Asked every time, before anything is recorded.</p>
          <div role="radiogroup" aria-label="Who is speaking" style={{ display: "grid", gap: 10 }}>
            {WHO.map(option => {
              const on = who === option.consent
              return (
                <button key={option.consent} type="button" role="radio" aria-checked={on} onClick={() => { setWho(option.consent); setRefused(false) }}
                  style={{ textAlign: "left", padding: "14px 16px", minHeight: 56, cursor: "pointer", borderRadius: "var(--radius-lg)", background: on ? "var(--surface-2)" : "var(--bg)", border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, color: "var(--text)" }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{option.label}</span>
                  {option.more && <span style={{ display: "block", fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{option.more}</span>}
                </button>
              )
            })}
          </div>
          {refused && (
            <div role="alert" style={{ marginTop: 14, padding: "14px 18px", borderRadius: "var(--radius-lg)", background: "var(--warning-soft)", border: "1px solid var(--warning-border)", color: "var(--text)", fontSize: 15, lineHeight: 1.55 }}>
              Transcribe will not start. Tell everyone who will be heard that it is being recorded, then come back and choose the second answer.
            </div>
          )}
          <label htmlFor="transcript-title" style={{ display: "block", marginTop: 18 }}><Meta>A name for it</Meta></label>
          <input id="transcript-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Optional, like Team call on Tuesday" style={{ ...FIELD, marginTop: 8 }} />
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn-outline" style={QUIET} disabled={!who} onClick={begin}>Continue</button>
          </div>
        </Card>
      ) : (
        <>
          {phase === "recording" && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Recording <span style={{ ...NUM, color: "var(--text-muted)", fontWeight: 500 }}>{clockAt(seconds * 1000)}</span></span>
              </div>
              <p style={{ ...SMALL, marginTop: 8 }}>The microphone is on until you press Stop. The words arrive every 20 seconds.</p>
            </Card>
          )}
          <p role="status" aria-live="polite" style={{ ...SMALL, minHeight: progress || phase === "sending" ? 24 : 0, marginBottom: progress || phase === "sending" ? 12 : 0 }}>{phase === "sending" ? "Writing down the last part…" : progress}</p>
          {notKept && <p role="status" style={{ ...SMALL, marginBottom: 12, color: "var(--warning)" }}>This browser would not keep the transcript, so it lives only in this tab. Copy or download it before you leave.</p>}

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              {renaming ? (
                <input autoFocus defaultValue={session.title} maxLength={120} aria-label="Name of this transcript" style={{ ...FIELD, maxWidth: 420 }}
                  onBlur={e => { const name = e.target.value.trim(); if (name) put(s => ({ ...s, title: name }), session.id); setRenaming(false) }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false) }} />
              ) : <h2 style={{ ...H2, overflowWrap: "anywhere" }}>{session.title}</h2>}
              <Meta style={{ marginTop: 8 }}>{clockAt(lengthMs(session))} long · {wordCount(session, layer).toLocaleString("en-US")} words</Meta>
            </div>

            {session.segments.length === 0 ? (
              <div style={{ marginTop: 16 }}>
                <p style={{ ...SMALL, fontSize: 16 }}>Press <strong style={{ color: "var(--text)" }}>Record now</strong> to use the microphone, or choose a recording you already have.</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button type="button" className="btn-outline" style={QUIET} disabled={busy} onClick={() => fileInput.current?.click()}>Choose a recording</button>
                  <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={leave}>Back</button>
                </div>
                <p style={{ ...SMALL, marginTop: 12 }}>mp3, m4a, wav, webm or ogg, up to {MAX_MINUTES} minutes.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  <Chip label="As said" active={layer === "raw"} onClick={() => setLayer("raw")} />
                  <Chip label="Tidied" active={layer === "clean"} disabled={!session.segments.some(s => s.clean)} onClick={() => setLayer("clean")} />
                </div>
                <div style={{ marginTop: 14 }}>
                  {lines.map(line => (
                    <div key={line.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      <span style={{ ...NUM, fontSize: 13.5, color: "var(--text-soft)", paddingTop: 3 }}>{line.clock}</span>
                      {line.failed ? (
                        <span style={{ fontSize: 15.5, color: "var(--warning)" }}>
                          This part could not be read.{" "}
                          {retryable.includes(line.id) && <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: "0 10px", fontSize: 14.5 }} onClick={() => void again(line.id)}>Try this part again</button>}
                        </span>
                      ) : <span style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--text)", overflowWrap: "anywhere" }}>{line.text}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                  <button type="button" className="btn-outline" style={QUIET} disabled={busy || !hasText} onClick={() => void tidy()}>Tidy the text</button>
                  {answered === session.id && <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={() => void record()}>Record more</button>}
                  {answered === session.id && <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={() => fileInput.current?.click()}>Add a recording</button>}
                  <button type="button" className="btn-ghost" style={QUIET} disabled={!hasText} onClick={() => download(fileName("md"), asMarkdown(session, layer), "text/markdown")}>Download .md</button>
                  <button type="button" className="btn-ghost" style={QUIET} disabled={!hasText} onClick={() => download(fileName("txt"), asPlainText(session, layer), "text/plain")}>Download .txt</button>
                  <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={() => setRenaming(true)}>Rename</button>
                  <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={leave}>Start another</button>
                </div>
              </>
            )}
            {answered === session.id && <input ref={fileInput} type="file" accept="audio/*,video/mp4,video/webm" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void readFile(f) }} />}
          </Card>

          <section style={{ marginTop: 24 }}>
            <label htmlFor="transcribe-hint"><Meta>Words to listen for</Meta></label>
            <input id="transcribe-hint" value={hint} maxLength={400} placeholder="Names and unusual words that will be said" onChange={e => { const v = e.target.value.slice(0, 400); setHint(v); hintRef.current = v }} style={{ ...FIELD, marginTop: 8 }} />
            <p style={{ ...SMALL, marginTop: 8 }}>Optional. It helps unusual names and technical words come out right.</p>
          </section>
        </>
      )}

      <section style={{ marginTop: 40 }}>
        <h2 style={H2}>Your transcripts</h2>
        <p style={{ ...SMALL, margin: "4px 0 16px" }}>Transcripts stay on this device. MarketFit keeps no sound and no text.</p>
        {kept.length === 0 ? <Card><p style={SMALL}>None yet. A transcript is kept here as soon as it has its first words.</p></Card> : (
          <div style={{ display: "grid", gap: 12 }}>
            {kept.map(k => (
              <Card key={k.id} style={{ padding: 16 }}>
                <div style={{ fontSize: 16.5, fontWeight: 600, color: "var(--text)", overflowWrap: "anywhere" }}>{k.title}</div>
                <Meta style={{ marginTop: 6 }}>{new Date(k.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {clockAt(lengthMs(k))} long · {wordCount(k, "raw").toLocaleString("en-US")} words</Meta>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" className="btn-outline" style={QUIET} disabled={busy || session?.id === k.id} onClick={() => openKept(k)}>{session?.id === k.id ? "Open now" : "Open"}</button>
                  <button type="button" className="btn-ghost" style={QUIET} disabled={session?.id === k.id}
                    onClick={() => { if (window.confirm(`Delete "${k.title}" from this device? It cannot be brought back.`)) void deleteSession(k.id).then(refreshKept) }}>Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
