"use client"

// Kompas Flow: one page for both things a person does with their voice here (the owner, 2026-10-08: "Combine kompas flow
// and transcribe to be in one page", and "cut distractions and confusions for the users").
//
// There were two pages and two entries in the menu, and a person had to know beforehand which one they wanted. Now there is
// one, with the choice written at the top in plain words: Dictate (speak for a moment, get text to paste) or Transcribe (a
// meeting, a call or a recording, with times and who said what). The old address of Transcribe still works and lands here
// with Transcribe showing.
//
// What this page takes care not to do:
//   - lose what a person was in the middle of. Both modes stay alive while the other is on screen, so looking at the other
//     one does not throw away a result, a transcript or a half-typed name.
//   - run two microphones. While one mode is recording or working, the other cannot be opened; the page says why.
//   - let a key meant for one mode act on the other: the space bar starts a dictation only while Dictate is the one showing.

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import Dictate from "./dictate"
import Transcribe from "../transcribe/panel"
import { useOwnDocument } from "../_mic"

type Mode = "dictate" | "transcribe"
const MODES: { id: Mode; label: string; more: string }[] = [
  { id: "dictate", label: "Dictate", more: "Speak for a moment and get clean text to paste." },
  { id: "transcribe", label: "Transcribe", more: "A meeting, a call or a recording, with times and who spoke." },
]

const SMALL: CSSProperties = { fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }

export default function FlowPage() {
  const [mode, setMode] = useState<Mode>("dictate")
  // Which mode has the microphone or is working, if either.
  const [busy, setBusy] = useState<Mode | null>(null)

  useOwnDocument()
  // The old Transcribe address, and a reload while Transcribe is showing, open Transcribe.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "transcribe") setMode("transcribe") }, [])

  const dictating = useCallback((on: boolean) => setBusy(now => (on ? "dictate" : now === "dictate" ? null : now)), [])
  const transcribing = useCallback((on: boolean) => setBusy(now => (on ? "transcribe" : now === "transcribe" ? null : now)), [])

  const choose = (next: Mode) => {
    if (next === mode || (busy && busy !== next)) return
    setMode(next)
    try { window.history.replaceState(null, "", next === "transcribe" ? `${window.location.pathname}?mode=transcribe` : window.location.pathname) } catch { /* the address is a convenience; the page works without it */ }
  }
  const held = busy && busy === mode ? MODES.find(m => m.id !== mode) : null

  return (
    <div style={{ maxWidth: 820 }}>
      <div role="tablist" aria-label="What do you want to do?" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: held ? 8 : 28 }}>
        {MODES.map(option => {
          const on = mode === option.id
          const locked = Boolean(busy && busy !== option.id)
          return (
            <button key={option.id} type="button" role="tab" id={`flow-tab-${option.id}`} aria-selected={on} aria-controls={`flow-${option.id}`} disabled={locked} onClick={() => choose(option.id)}
              style={{ textAlign: "left", padding: "12px 16px", minHeight: 60, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1, borderRadius: "var(--radius-lg)", background: on ? "var(--surface-2)" : "var(--surface)", border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, color: "var(--text)" }}>
              <span style={{ display: "block", fontSize: 16.5, fontWeight: 700 }}>{option.label}</span>
              <span style={{ display: "block", fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{option.more}</span>
            </button>
          )
        })}
      </div>
      {held && <p role="status" style={{ ...SMALL, marginBottom: 20 }}>{held.label} opens when this one has finished.</p>}

      <div role="tabpanel" id="flow-dictate" aria-labelledby="flow-tab-dictate" style={{ display: mode === "dictate" ? "block" : "none" }}>
        <Dictate active={mode === "dictate"} onBusy={dictating} />
      </div>
      <div role="tabpanel" id="flow-transcribe" aria-labelledby="flow-tab-transcribe" style={{ display: mode === "transcribe" ? "block" : "none" }}>
        <Transcribe onBusy={transcribing} />
      </div>
    </div>
  )
}
