"use client"

import { useState } from "react"
import type { TranscriptRevision } from "@/lib/kompasTranscript"

/** Deliberate edits stay separate from RAW and retain the before/after evidence. */
export default function RevisionEditor({ text, revisions = [], disabled, onSave }: {
  text: string; revisions?: TranscriptRevision[]; disabled?: boolean
  onSave: (text: string, reason: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [reason, setReason] = useState("Recognition error")
  const field = { width: "100%", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text)", background: "var(--surface)", fontSize: 15 }
  return <div style={{ marginTop: 10, fontSize: 14 }}>
    {!editing ? <button type="button" className="btn-ghost" disabled={disabled} onClick={() => { setDraft(text); setEditing(true) }}>Correct or rewrite</button> : <div>
      <label>Rewritten by you<textarea aria-label="Your revised wording" value={draft} maxLength={20000} onChange={e => setDraft(e.target.value)} rows={4} style={field} /></label>
      <label>What went wrong?<select aria-label="Reason for revision" value={reason} onChange={e => setReason(e.target.value)} style={field}>
        {["Recognition error", "Technical word or name", "Unnecessary rewriting", "Meaning was unclear", "Improve wording"].map(r => <option key={r}>{r}</option>)}
      </select></label>
      <p style={{ color: "var(--text-muted)", margin: "8px 0" }}>Your original words stay unchanged. This is your edit, not an AI rewrite or an automatic learning update.</p>
      <button type="button" className="btn-outline" disabled={disabled || !draft.trim() || draft.trim() === text} onClick={() => { onSave(draft, reason); setEditing(false) }}>Save revision</button>
      <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
    </div>}
    {revisions.length > 0 && <details style={{ marginTop: 8 }}><summary>What went wrong · {revisions.length} {revisions.length === 1 ? "revision" : "revisions"}</summary>
      {revisions.map((r, i) => <div key={`${r.at}-${i}`} style={{ padding: "8px 0", borderTop: "1px solid var(--border)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        <strong>{r.reason}</strong> · {new Date(r.at).toLocaleString()}<div>Before: {r.before}</div><div>Your revision: {r.after}</div>
      </div>)}
    </details>}
  </div>
}
