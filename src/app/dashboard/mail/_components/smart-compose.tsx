"use client"

// The box a reply is typed in. It offers the person's own earlier sentences as they type, in a small grid that floats
// under the message, and puts the grammar right when G is pressed.
//
// The owner, 13 Oct 2026: "if I'm typing something that was already been filled out many, many times, just on the drop
// down ... as a grid UI, just how Gmail view the suggestions. Once you click on that suggestion, it would just come out
// to the message that you are typing, and it would also auto-correct as a Grammarly ... people then hit G, and that
// would just correct the grammar, and the suggestion would just be a floating window that would pop [at the] bottom of
// the message that I'm trying to type. If not, they can type whatever they wish."
//
// WHAT IT NO LONGER DOES. Until that day this box asked a model for the next few words after every word typed, and for
// a proofread after every pause. Nothing is asked of a model while typing now: what is offered is found here, among
// sentences he has himself written more than once (src/lib/my-phrases.ts). A model is asked once, when G is pressed.

import { useMemo, useRef, useState, type CSSProperties } from "react"
import { applyPhrase, suggestPhrases, type Phrase } from "@/lib/my-phrases"

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  context?: { to?: string; subject?: string; role?: string }
  placeholder?: string
  /** The person's own sentences, most used first (GET /api/gmail/phrases). */
  phrases?: Phrase[]
}

const option: CSSProperties = { textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13.5, lineHeight: 1.45, cursor: "pointer", overflowWrap: "anywhere" }

export default function SmartCompose({ value, onChange, rows = 12, placeholder, phrases = [] }: Props) {
  const [closedFor, setClosedFor] = useState<string | null>(null)   // the text the grid was dismissed on: it comes back with the next letter
  const [fixing, setFixing] = useState(false)
  const [said, setSaid] = useState("")
  const [undo, setUndo] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const found = useMemo(() => suggestPhrases(phrases, value), [phrases, value])
  const offered = closedFor === value ? [] : found

  function take(p: Phrase) {
    onChange(applyPhrase(value, p.text))
    setSaid(""); setUndo(null)
    taRef.current?.focus()
  }

  async function fixGrammar() {
    if (fixing || !value.trim()) return
    setFixing(true); setSaid("")
    const before = value
    try {
      const res = await fetch("/api/gmail/polish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: before }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setSaid(j.error || "The grammar could not be checked just now."); return }
      if (j.text === before) { setSaid(j.note || "Nothing to fix."); setUndo(null); return }
      onChange(String(j.text))
      setUndo(before)
      setSaid(j.note ? `Fixed what I could. ${j.note}` : "Grammar fixed.")
    } catch { setSaid("The grammar could not be checked just now.") }
    finally { setFixing(false); taRef.current?.focus() }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // A plain G is a letter of the message, so the key is Alt+G; the button beside the box does the same.
    if (e.altKey && e.key.toLowerCase() === "g") { e.preventDefault(); void fixGrammar(); return }
    if (e.key === "Escape" && offered.length) { e.preventDefault(); setClosedFor(value); return }
    // Tab takes the first sentence offered, as it does in Gmail.
    if (e.key === "Tab" && !e.shiftKey && offered.length) { e.preventDefault(); take(offered[0]) }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <textarea
          ref={taRef}
          value={value}
          onChange={e => { setUndo(null); setSaid(""); onChange(e.target.value) }}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder || "Write your reply in your own words."}
          spellCheck
          aria-label="Your reply"
          aria-controls="reply-own-sentences"
          style={{ padding: "10px 52px 10px 10px", fontSize: 14.5, lineHeight: 1.6, fontFamily: "inherit", width: "100%", display: "block", borderRadius: 10, border: "1px solid var(--border-strong)", color: "var(--text)", background: "var(--surface)", resize: "vertical" }}
        />
        <button type="button" onClick={() => { void fixGrammar() }} disabled={fixing || !value.trim()} title="Fix the grammar (Alt+G)" aria-label="Fix the grammar"
          style={{ position: "absolute", right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--text)", fontSize: 15, fontWeight: 800, cursor: fixing || !value.trim() ? "default" : "pointer", opacity: !value.trim() ? 0.5 : 1 }}>
          {fixing ? "…" : "G"}
        </button>

        {/* His own sentences that fit what he is typing: a small grid that floats under the message. */}
        {offered.length > 0 && (
          <div id="reply-own-sentences" role="listbox" aria-label="Sentences you have written before"
            style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 30, padding: 10, borderRadius: 14, border: "1px solid var(--border-strong)", background: "var(--bg)", boxShadow: "0 14px 34px rgba(12,11,8,.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>You have written this before. Press one to use it (Tab takes the first).</span>
              <button type="button" onClick={() => setClosedFor(value)} style={{ border: 0, background: "none", color: "var(--text-muted)", fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 8 }}>
              {offered.map(p => (
                <button key={p.text} type="button" role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => take(p)} style={option}>
                  {p.text} <span style={{ color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>· written {p.count} times</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div role="status" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minHeight: 20, fontSize: 12.5, color: "var(--text-muted)" }}>
        {said && <span>{said}</span>}
        {undo !== null && <button type="button" onClick={() => { onChange(undo); setUndo(null); setSaid("Put back as you wrote it.") }} style={{ border: 0, background: "none", color: "var(--text)", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>Undo</button>}
        {!said && <span>Press G to fix the grammar. Sentences you have written before appear under the box as you type.</span>}
      </div>
    </div>
  )
}
