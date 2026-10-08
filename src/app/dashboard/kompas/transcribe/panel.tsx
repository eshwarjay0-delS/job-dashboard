"use client"

// Transcribe, one of the two things Kompas Flow does (the other is ../flow/dictate.tsx; ../flow/page.tsx holds them both).
// Owner, 2026-10-07: "Kompas flow and transcribe in the kompas section in job dashboard"; 2026-10-08: "Combine kompas flow
// and transcribe to be in one page."
//
// A person turns a talk they are in, or a recording they have, into text with times, and keeps it on their own device.
//
// It starts by asking who is speaking, every time: "Only me" or "Other people too" (the owner, 2026-10-08: "Just keep it as
// only me and other people involved"). There is no transcript to record into until startSession()
// (src/lib/kompasTranscript.ts) has that answer, and the microphone and the file picker are reachable only from a transcript
// answered for in this visit. Beside the second answer the page says that everyone in it should know it is being recorded.
// While the microphone is on, a "Recording" line with a clock is on the screen the whole time: nothing listens in the
// background.
//
// When other people are in it, each line is given a speaker. The person can let the page learn their own voice first (they
// read a short passage; a voice print is worked out on this device and kept on this device), and then their lines say
// "You". Everyone else is "Speaker 1", "Speaker 2"... told apart by voice inside this transcript only. Every such label is a
// best guess from the sound and is drawn as one: a tap changes it, and what the person set is never changed back.
//
// What else this page takes care not to do: drop a part that could not be read (it stays in the transcript as a marked gap,
// and can be tried again while its sound is still in memory), let an answer for an earlier transcript land in a newer one,
// leave the microphone on after any way out, or keep the sound itself: only the text is kept, and only on this device.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import PageIntro from "../../_components/page-intro"
import { Card, Chip, Meta } from "../../_suite/ui"
import {
  appendSegment, asMarkdown, asPlainText, clockAt, hasOthers, lengthMs, nameSpeaker, replaceSegment, setSpeaker, speakerLabel, speakersHeard,
  startSession, transcriptLines, withClean, withSpeakers, wordCount,
  type Consent, type Layer, type Session,
} from "@/lib/kompasTranscript"
import { MAX_OTHERS, VOICE_RATE, YOU, readVoiceprint, speakersOf, voiceprintOf, type Voiceprint } from "@/lib/kompasVoice"
import { MAX_FILE_BYTES, MAX_MINUTES, decode, partsOf, samplesOf, wavPart, type DecodeProblem } from "./audio"
import { deleteSession, forgetVoice, listSessions, loadVoice, saveSession, saveVoice, type Kept } from "./store"

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
  { consent: "others", label: "Other people too", more: "A meeting or a call. Everyone in it should know it is being recorded." },
]
// What the person reads aloud so the page can learn their voice: about twelve seconds, ordinary words, said the usual way.
const PASSAGE = "Hello, this is my voice. I am reading this so that Kompas can tell me apart from the other people in a meeting. I will speak the way I usually do, not too fast and not too slow, for about ten seconds."
const LEARN_SECONDS = 20
/** Voiced hundredths of a second a reading must hold to be worth keeping: about four seconds of actual speech. */
const LEARN_LEAST = 400

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
type Phase = "idle" | "starting" | "recording" | "sending" | "file" | "tidying" | "learning"
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const wait = (seconds: number) => new Promise(resolve => window.setTimeout(resolve, seconds * 1000))

type Stretch = { start: number; end: number; text: string }
type Heard = { ok: true; text: string; stretches: Stretch[] } | { ok: false; code: string }

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
    if (response.ok) {
      const stretches: Stretch[] = (Array.isArray(body.segments) ? body.segments : []).filter((x: Stretch) => x && typeof x.text === "string" && Number.isFinite(x.start) && Number.isFinite(x.end))
      return { ok: true, text: String(body.text || ""), stretches }
    }
    // Silence is not a failure: a part in which nobody spoke simply has no words.
    if (body.code === "empty") return { ok: true, text: "", stretches: [] }
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

// `onBusy`: tells the page the microphone is on or a transcript is being worked on, so the other mode cannot be opened
// (and a second microphone started) in the middle of it.
export default function Transcribe({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [who, setWho] = useState<Consent | null>(null)
  const [title, setTitle] = useState("")
  // The person's own voice print, when this device has one, and the day it was saved.
  const [voice, setVoice] = useState<{ print: Voiceprint; savedAt: number } | null>(null)
  const [learnSeconds, setLearnSeconds] = useState(0)
  const [learnSaid, setLearnSaid] = useState("")
  const [picking, setPicking] = useState<string | null>(null)     // the line whose speaker is being chosen
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  // Is the microphone on? Kept apart from `phase` on purpose: the Recording line and the Stop button are drawn from this and
  // nothing else, so nothing the page is busy with can hide a microphone that is live (found in review, 2026-10-08).
  const [mic, setMic] = useState(false)
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
  const closing = useRef(false)                      // Stop was pressed and the last part has not been collected yet
  // What the page is busy with, readable at once by every handler. Every change goes through go(), so a handler never acts on
  // a value from an earlier drawing of the page: two things cannot both believe the page is idle.
  const phaseRef = useRef<Phase>("idle")
  const go = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next) }, [])
  const at = useCallback((): Phase => phaseRef.current, [])   // asked through a function: go() changes it between two lines of one handler
  const hintRef = useRef("")
  const fileInput = useRef<HTMLInputElement>(null)
  const answeredRef = useRef<string | null>(null)
  const voiceRef = useRef<Voiceprint | null>(null)
  // The voice print of each line of the open transcript. Memory only: other people's voices are never written anywhere.
  const prints = useRef(new Map<string, Voiceprint | null>())
  const learner = useRef<{ stream: MediaStream; recorder: MediaRecorder; tick: number; end: number } | null>(null)

  useEffect(() => { onBusy(phase !== "idle" || mic) }, [phase, mic, onBusy])
  useEffect(() => { void loadVoice().then(kept => { const print = kept ? readVoiceprint(kept.print) : null; if (kept && print) { voiceRef.current = print; setVoice({ print, savedAt: kept.savedAt }) } }) }, [])

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

  // Who said each line, worked out from the prints in memory and whatever the person has set. Only for a transcript with
  // other people in it, and only while its prints are in memory (one opened from the list keeps the speakers it was saved with).
  const relabel = useCallback((s: Session): Session => {
    if (!hasOthers(s) || prints.current.size === 0) return s
    const said = s.segments.filter(x => !x.failed).map(x => ({ id: x.id, print: prints.current.get(x.id) ?? null, ...(x.by === "you" && x.speaker ? { set: x.speaker } : {}) }))
    return withSpeakers(s, speakersOf(said, voiceRef.current))
  }, [])

  const release = useCallback(() => {
    const now = live.current
    live.current = null
    if (!now) return
    now.on = false
    window.clearTimeout(now.rotate); window.clearInterval(now.tick)
    now.stream.getTracks().forEach(track => track.stop())
    setMic(false)
  }, [])
  useEffect(() => () => { const now = live.current; if (now?.recorder && now.recorder.state !== "inactive") { now.recorder.onstop = null; try { now.recorder.stop() } catch { /* already stopped */ } } release(); closing.current = false; current.current = null }, [release])

  // Back to idle only when the microphone is off, the last part has been collected and nothing is still on its way.
  const settle = useCallback(() => { if (!live.current && !closing.current && pending.current === 0 && at() === "sending") go("idle") }, [go])

  // The lines of one part. With other people in the transcript, a part becomes one line for each stretch the recogniser
  // marked, and each stretch's voice print is worked out here, on the device, from the sound of that stretch.
  const linesOf = useCallback(async (part: { id: string; blob: Blob; startMs: number; endMs: number; samples?: Float32Array }, heard: { text: string; stretches: Stretch[] }, others: boolean) => {
    const whole = [{ id: part.id, startMs: part.startMs, endMs: part.endMs, raw: heard.text }]
    if (!others || heard.stretches.length === 0) return whole
    const sound = part.samples ?? (await samplesOf(part.blob))
    return heard.stretches.map((stretch, i) => {
      const id = `${part.id}.${i}`
      if (sound) prints.current.set(id, voiceprintOf(sound.subarray(Math.max(0, Math.floor(stretch.start * VOICE_RATE)), Math.min(sound.length, Math.ceil(stretch.end * VOICE_RATE)))))
      return { id, startMs: part.startMs + Math.round(stretch.start * 1000), endMs: Math.min(part.endMs, part.startMs + Math.round(stretch.end * 1000)), raw: stretch.text }
    })
  }, [])

  const sendPart = useCallback(async (part: { id: string; blob: Blob; startMs: number; endMs: number; samples?: Float32Array }, forId: string) => {
    pending.current++
    const heard = await hear(part.blob, hintRef.current, () => current.current?.id === forId)
    const lines = heard.ok && current.current?.id === forId ? await linesOf(part, heard, hasOthers(current.current)) : []
    pending.current--
    if (heard.ok) { sounds.current.delete(part.id); put(s => relabel(lines.reduce((now, line) => appendSegment(now, line), s)), forId) }
    else {
      sounds.current.set(part.id, part.blob)
      if (current.current?.id === forId) { setRetryable([...sounds.current.keys()]); setError(problem(heard.code)) }
      put(s => appendSegment(s, { id: part.id, startMs: part.startMs, endMs: part.endMs, raw: "", failed: true }), forId)
    }
    settle()
  }, [linesOf, put, relabel, settle])

  // ── who is speaking ──────────────────────────────────────────────────────────
  const begin = () => {
    if (!who) return
    const started = startSession({ id: newId(), title, startedAt: Date.now(), consent: who })
    if (!started.ok) return
    setError(""); setNotKept(false); setLayer("raw"); setCopied(""); setRetryable([]); sounds.current.clear(); prints.current.clear(); setPicking(null)
    current.current = started.session
    answeredRef.current = started.session.id; setAnswered(started.session.id)
    setSession(started.session)
  }

  // ── record now ───────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const now = live.current
    if (!now) return
    now.on = false
    window.clearTimeout(now.rotate); window.clearInterval(now.tick)
    const last = now.recorder
    go("sending")
    if (!last || last.state === "inactive") { release(); settle(); return }
    // The recorder is closed FIRST and the microphone is let go once it has closed. Some browsers end a recorder the moment
    // its tracks stop, before its last part can be collected: the last twenty seconds would be lost and the page would read
    // idle with a part still unsent (found in review, 2026-10-08). The recorder's own onstop runs before `done` and sends
    // that part, so it is counted as on its way before the page is allowed to settle.
    closing.current = true
    const done = () => { if (!closing.current) return; closing.current = false; release(); settle() }
    last.addEventListener("stop", done, { once: true })
    window.setTimeout(done, 3000)                  // a recorder that never says it stopped still gives the microphone back
    try { last.stop() } catch { done() }
  }, [go, release, settle])

  const record = useCallback(async () => {
    const open = current.current
    // No answer for this transcript in this visit, no microphone. And never while anything else is going on: from the next
    // line the page is "starting", so a file or a tidy cannot begin while the browser is still asking for the microphone.
    if (!open || answeredRef.current !== open.id || starting.current || live.current || at() !== "idle") return
    starting.current = true
    go("starting"); setError("")
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser cannot record sound. Try a current version of Chrome, Edge, Safari or Firefox."); return }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
      catch (e) {
        setError((e as DOMException)?.name === "NotFoundError" ? "No microphone was found. Plug one in, or check that it is turned on." : "The microphone is blocked for this site. Allow it from the lock icon in the address bar, then press Record now again.")
        return
      }
      if (current.current?.id !== open.id) return
      const sound = stream
      const type = TYPES.find(t => MediaRecorder.isTypeSupported(t))
      // A transcript that already has parts is continued after its last one.
      const offset = lengthMs(open)
      const began = Date.now()
      const state = { stream: sound, recorder: null as MediaRecorder | null, rotate: 0, tick: 0, began, on: true }
      // A recorder that breaks mid-way ends the recording in the open: what was recorded is kept and sent, the microphone is
      // let go, and the person is told.
      const broke = () => {
        if (live.current !== state) return
        const last = state.recorder
        setError("The recording stopped unexpectedly. What was recorded so far is kept.")
        go("sending"); release()
        try { if (last && last.state !== "inactive") last.stop() } catch { /* already stopped */ }
        settle()
      }
      // Each part is a whole file by itself: a new recorder is started on the same microphone before the old one is closed,
      // so no sound falls between two parts.
      const part = () => {
        const recorder = new MediaRecorder(sound, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
        const chunks: Blob[] = []
        const startMs = offset + (Date.now() - began)
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" })
          void sendPart({ id: newId(), blob, startMs, endMs: offset + (Date.now() - began) }, open.id)
        }
        recorder.onerror = broke
        recorder.start()
        state.recorder = recorder
        state.rotate = window.setTimeout(() => {
          if (!state.on) return
          try { part(); if (recorder.state !== "inactive") recorder.stop() } catch { broke() }
        }, PART_MS)
      }
      live.current = state
      setMic(true)
      part()
      state.tick = window.setInterval(() => setSeconds(Math.floor((offset + Date.now() - began) / 1000)), 500)
      setSeconds(Math.floor(offset / 1000)); go("recording")
    } catch {
      // The recorder could not be made or started.
      setError("The recording could not start. Try again.")
      release()
    } finally {
      starting.current = false
      // The microphone was opened but no recording holds it: it is let go here, whatever went wrong above.
      if (!live.current) { stream?.getTracks().forEach(track => track.stop()); if (at() === "starting" || at() === "recording") go("idle") }
    }
  }, [go, release, sendPart, settle])

  // ── choose a recording ───────────────────────────────────────────────────────
  const readFile = useCallback(async (file: File) => {
    const open = current.current
    if (!open || answeredRef.current !== open.id || starting.current || live.current || at() !== "idle") return
    setError(""); go("file"); setProgress("Opening the recording…")
    const opened = await decode(file)
    if (current.current?.id !== open.id) return
    if (!opened.ok) { setError(FILE_PROBLEM[opened.because]); if (at() === "file") go("idle"); setProgress(""); return }
    const offset = lengthMs(open)
    const parts = partsOf(opened.audio.samples.length)
    for (let i = 0; i < parts.length; i++) {
      if (current.current?.id !== open.id) return
      setProgress(`Part ${i + 1} of ${parts.length}`)
      const p = parts[i]
      await sendPart({ id: newId(), blob: wavPart(opened.audio.samples, p.from, p.to), startMs: offset + p.startMs, endMs: offset + p.endMs, samples: opened.audio.samples.subarray(p.from, p.to) }, open.id)
    }
    if (current.current?.id === open.id) { if (at() === "file") go("idle"); setProgress("") }
  }, [go, sendPart])

  const again = useCallback(async (id: string) => {
    const open = current.current, blob = sounds.current.get(id)
    if (!open || !blob) return
    setError("")
    const heard = await hear(blob, hintRef.current, () => current.current?.id === open.id)
    if (current.current?.id !== open.id) return
    if (!heard.ok) { setError(problem(heard.code)); return }
    sounds.current.delete(id); setRetryable([...sounds.current.keys()])
    const gap = open.segments.find(x => x.id === id)
    const lines = gap && hasOthers(open) ? await linesOf({ id, blob, startMs: gap.startMs, endMs: gap.endMs }, heard, true) : []
    if (current.current?.id !== open.id) return
    // A part that turns out to hold no words is no longer a gap: it is taken out. With other people in the transcript the
    // gap gives way to one line for each stretch that was heard in it.
    put(s => {
      if (!heard.text.trim()) return { ...s, segments: s.segments.filter(x => x.id !== id) }
      if (lines.length < 2) return relabel(replaceSegment(s, id, heard.text))
      return relabel(lines.reduce((now, line) => appendSegment(now, line), { ...s, segments: s.segments.filter(x => x.id !== id) }))
    }, open.id)
  }, [linesOf, put, relabel])

  // ── learning the person's own voice ──────────────────────────────────────────
  // Their own voice, at their own press, before any transcript: they read a passage, a print is worked out on this device,
  // and the recording is dropped. The microphone is on only while "Reading" is on the screen.
  const stopLearning = useCallback(() => { const now = learner.current; if (now && now.recorder.state !== "inactive") now.recorder.stop() }, [])
  const endLearning = useCallback(() => {
    const now = learner.current
    learner.current = null
    if (!now) return
    window.clearInterval(now.tick); window.clearTimeout(now.end)
    now.stream.getTracks().forEach(track => track.stop())
    setMic(false)
  }, [])
  const learn = useCallback(async () => {
    if (starting.current || live.current || learner.current || at() !== "idle") return
    starting.current = true
    go("learning"); setLearnSaid(""); setError("")
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setLearnSaid("This browser cannot record sound. Try a current version of Chrome, Edge, Safari or Firefox."); return }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
      catch (e) {
        setLearnSaid((e as DOMException)?.name === "NotFoundError" ? "No microphone was found. Plug one in, or check that it is turned on." : "The microphone is blocked for this site. Allow it from the lock icon in the address bar, then press the button again.")
        return
      }
      const sound = stream
      const type = TYPES.find(t => MediaRecorder.isTypeSupported(t))
      const recorder = new MediaRecorder(sound, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 64000 })
      const chunks: Blob[] = []
      const began = Date.now()
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      recorder.onstop = () => {
        endLearning()
        void (async () => {
          const samples = await samplesOf(new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }))
          const print = samples ? voiceprintOf(samples) : null
          if (!print || print.frames < LEARN_LEAST) setLearnSaid("That was too short or too quiet to learn your voice from. Read the whole passage, a little closer to the microphone.")
          else {
            const now = Date.now()
            voiceRef.current = print; setVoice({ print, savedAt: now })
            setLearnSaid((await saveVoice(print, now)) ? "Your voice is saved on this device. Your lines will say You." : "Your voice is known for now, but this browser would not keep it: you will be asked again next time.")
          }
          if (at() === "learning") go("idle")
        })()
      }
      recorder.onerror = () => { endLearning(); setLearnSaid("The recording stopped unexpectedly. Try again."); if (at() === "learning") go("idle") }
      learner.current = {
        stream: sound, recorder,
        tick: window.setInterval(() => setLearnSeconds(Math.floor((Date.now() - began) / 1000)), 250),
        end: window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop() }, LEARN_SECONDS * 1000),
      }
      setLearnSeconds(0); setMic(true)
      recorder.start()
    } catch {
      setLearnSaid("The recording could not start. Try again.")
      endLearning()
    } finally {
      starting.current = false
      if (!learner.current) { stream?.getTracks().forEach(track => track.stop()); if (at() === "learning") go("idle") }
    }
  }, [endLearning, go])
  const forget = useCallback(async () => { await forgetVoice(); voiceRef.current = null; setVoice(null); setLearnSaid("Your voice print is removed from this device.") }, [])
  useEffect(() => () => { const now = learner.current; if (now) { now.recorder.onstop = null; try { if (now.recorder.state !== "inactive") now.recorder.stop() } catch { /* already stopped */ } } endLearning() }, [endLearning])

  // The person says who said a line. Theirs from then on, and the rest of the transcript learns from it.
  const say = useCallback((lineId: string, speaker: string) => { const open = current.current; if (open) put(s => relabel(setSpeaker(s, lineId, speaker)), open.id); setPicking(null) }, [put, relabel])

  // ── tidy ─────────────────────────────────────────────────────────────────────
  const tidy = useCallback(async () => {
    const open = current.current
    if (!open || starting.current || live.current || at() !== "idle") return
    const todo = open.segments.filter(s => !s.failed && !s.clean && s.raw)
    if (!todo.length) { setLayer("clean"); return }
    go("tidying"); setError("")
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
    if (at() === "tidying") go("idle")
    setLayer("clean")
    setProgress(leftRaw ? `${leftRaw} ${leftRaw === 1 ? "part was" : "parts were"} left as said, because tidying would have changed the words or was not available.` : "")
  }, [go, put])

  const lines = session ? transcriptLines(session, layer) : []
  // The speakers a line can be given: You, everyone heard so far, and one more for a voice that has no name yet.
  const heard = session ? speakersHeard(session) : []
  const fresh = (() => { for (let n = 1; n <= MAX_OTHERS; n++) if (!heard.includes(`s${n}`)) return `s${n}`; return null })()
  const hasText = lines.some(l => l.text)
  const busy = phase !== "idle"
  const copyAll = async () => { if (!session) return; try { await navigator.clipboard.writeText(asPlainText(session, layer)); setCopied("yes") } catch { setCopied("no") } window.setTimeout(() => setCopied(""), 2400) }
  const leave = () => { if (busy || mic) return; release(); current.current = null; answeredRef.current = null; setAnswered(null); setSession(null); setWho(null); setTitle(""); go("idle"); setProgress(""); setError(""); setRenaming(false); sounds.current.clear(); prints.current.clear(); setPicking(null); setRetryable([]) }
  const openKept = (k: Kept) => { if (busy || mic) return; const { updatedAt: _dropped, ...s } = k; void _dropped; release(); answeredRef.current = null; setAnswered(null); current.current = s; setSession(s); setLayer(s.segments.some(x => x.clean) ? "clean" : "raw"); setError(""); setProgress(""); setNotKept(false); sounds.current.clear(); prints.current.clear(); setPicking(null); setRetryable([]); window.scrollTo({ top: 0, behavior: "smooth" }) }
  const fileName = (ext: string) => `${(session?.title || "transcript").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "transcript"}.${ext}`

  const action = !session ? { label: "Start a transcript", href: "#who" }
    : mic ? { label: "Stop", onClick: stopRecording }
    : busy ? { label: "Working…", onClick: () => {} }
    : hasText ? { label: copied === "yes" ? "Copied" : "Copy all", onClick: () => void copyAll() }
    : answered === session.id ? { label: "Record now", onClick: () => void record() }
    : { label: "Start a transcript", onClick: () => leave() }

  return (
    <div style={{ maxWidth: 820 }}>
      <PageIntro page="/dashboard/kompas/flow" what="Turn a talk or a recording into text with times, once everyone in it knows." action={action} />

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
                <button key={option.consent} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setWho(option.consent)}
                  style={{ textAlign: "left", padding: "14px 16px", minHeight: 56, cursor: "pointer", borderRadius: "var(--radius-lg)", background: on ? "var(--surface-2)" : "var(--bg)", border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, color: "var(--text)" }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{option.label}</span>
                  {option.more && <span style={{ display: "block", fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{option.more}</span>}
                </button>
              )
            })}
          </div>
          {who === "others" && (
            <div style={{ marginTop: 14, padding: "16px 18px", borderRadius: "var(--radius-lg)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Meta>Which voice is yours?</Meta>
              {phase === "learning" && mic ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <span aria-hidden style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Listening to you read <span style={{ ...NUM, color: "var(--text-muted)", fontWeight: 500 }}>{clockAt(learnSeconds * 1000)}</span></span>
                  </div>
                  <p style={{ fontSize: 17.5, lineHeight: 1.6, color: "var(--text)", margin: "12px 0 0" }}>{PASSAGE}</p>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn-outline" style={QUIET} onClick={stopLearning}>I have read it</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ ...SMALL, fontSize: 15.5, marginTop: 8 }}>
                    {voice
                      ? `Your voice is saved on this device (${new Date(voice.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}). Your lines will say You. Not you, or a new microphone? Read it again.`
                      : "Is this your first time here? We would not know which voice is yours in the meeting. Read a short passage aloud once, and your lines will say You."}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button type="button" className="btn-outline" style={QUIET} disabled={busy} onClick={() => void learn()}>{voice ? "Read it again" : "Recognize my voice"}</button>
                    {voice && <button type="button" className="btn-ghost" style={QUIET} disabled={busy} onClick={() => void forget()}>Forget my voice</button>}
                  </div>
                </>
              )}
              <p role="status" aria-live="polite" style={{ ...SMALL, marginTop: 10, minHeight: learnSaid || phase === "learning" ? 22 : 0, color: "var(--text)" }}>{phase === "learning" && !mic ? "One moment…" : learnSaid}</p>
              <p style={{ ...SMALL, marginTop: 6 }}>Your voice print stays on this device, and the reading itself is not kept. Other people are told apart by voice inside the transcript only: their voices are never saved. You can skip this: every speaker is then numbered, and you can mark which one is you.</p>
            </div>
          )}
          <label htmlFor="transcript-title" style={{ display: "block", marginTop: 18 }}><Meta>A name for it</Meta></label>
          <input id="transcript-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Optional, like Team call on Tuesday" style={{ ...FIELD, marginTop: 8 }} />
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn-outline" style={QUIET} disabled={!who || busy} onClick={begin}>Continue</button>
          </div>
        </Card>
      ) : (
        <>
          {mic && phase !== "learning" && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Recording <span style={{ ...NUM, color: "var(--text-muted)", fontWeight: 500 }}>{clockAt(seconds * 1000)}</span></span>
              </div>
              <p style={{ ...SMALL, marginTop: 8 }}>The microphone is on until you press Stop. The words arrive every 20 seconds.</p>
            </Card>
          )}
          <p role="status" aria-live="polite" style={{ ...SMALL, minHeight: progress || phase === "sending" || phase === "starting" ? 24 : 0, marginBottom: progress || phase === "sending" || phase === "starting" ? 12 : 0 }}>{phase === "sending" ? "Writing down the last part…" : phase === "starting" ? "Waiting for the microphone…" : progress}</p>
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
                {lines.some(l => l.who) && <p style={{ ...SMALL, marginTop: 12 }}>Who said each line is worked out from the sound and can be wrong. A name with a dashed edge is a guess: tap it to change it.</p>}
                <div style={{ marginTop: 14 }}>
                  {lines.map(line => (
                    <div key={line.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      <span style={{ ...NUM, fontSize: 13.5, color: "var(--text-soft)", paddingTop: 3 }}>{line.clock}</span>
                      {line.failed ? (
                        <span style={{ fontSize: 15.5, color: "var(--warning)" }}>
                          This part could not be read.{" "}
                          {retryable.includes(line.id) && <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: "0 10px", fontSize: 14.5 }} onClick={() => void again(line.id)}>Try this part again</button>}
                        </span>
                      ) : (
                        <span style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--text)", overflowWrap: "anywhere" }}>
                          {line.who && (
                            <button type="button" aria-expanded={picking === line.id} title={line.guessed ? "Worked out from the sound. Tap to change." : "Set by you. Tap to change."}
                              onClick={() => setPicking(picking === line.id ? null : line.id)}
                              style={{
                                marginRight: 8, padding: "1px 10px", minHeight: 26, borderRadius: 100, cursor: "pointer", fontFamily: "var(--font-label)", fontSize: 12.5, fontWeight: 600, verticalAlign: "1px",
                                background: line.speaker === YOU ? "var(--accent)" : "var(--surface-2)", color: line.speaker === YOU ? "var(--bg)" : "var(--text-muted)",
                                border: `1px ${line.guessed ? "dashed" : "solid"} ${line.speaker === YOU ? "var(--accent)" : "var(--border-strong)"}`,
                              }}>{line.who}</button>
                          )}
                          {line.text}
                          {picking === line.id && (
                            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {[YOU, ...heard.filter(id => id !== YOU), ...(fresh ? [fresh] : [])].map(id => (
                                <button key={id} type="button" className="btn-ghost" style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }} onClick={() => say(line.id, id)}>{id === fresh ? "Someone new" : speakerLabel(session, id)}</button>
                              ))}
                              {line.speaker && line.speaker !== YOU && (
                                <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }}
                                  onClick={() => { const name = window.prompt(`A name for ${speakerLabel(session, line.speaker)} in this transcript`, session.names?.[line.speaker] ?? ""); if (name !== null) put(now => nameSpeaker(now, line.speaker, name), session.id); setPicking(null) }}>Name this speaker</button>
                              )}
                            </span>
                          )}
                        </span>
                      )}
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
        <p style={{ ...SMALL, margin: "4px 0 16px" }}>Transcripts stay on this device, and so does your voice print if you saved one. MarketFit keeps no sound and no text.</p>
        {kept.length === 0 ? <Card><p style={SMALL}>None yet. A transcript is kept here as soon as it has its first words.</p></Card> : (
          <div style={{ display: "grid", gap: 12 }}>
            {kept.map(k => (
              <Card key={k.id} style={{ padding: 16 }}>
                <div style={{ fontSize: 16.5, fontWeight: 600, color: "var(--text)", overflowWrap: "anywhere" }}>{k.title}</div>
                <Meta style={{ marginTop: 6 }}>{new Date(k.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {clockAt(lengthMs(k))} long · {wordCount(k, "raw").toLocaleString("en-US")} words</Meta>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" className="btn-outline" style={QUIET} disabled={busy || mic || session?.id === k.id} onClick={() => openKept(k)}>{session?.id === k.id ? "Open now" : "Open"}</button>
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
