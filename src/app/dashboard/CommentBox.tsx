"use client"

// Lives in the dashboard layout, so the draft and the kept comment survive moving between pages.
// It is held in component state only: nothing is posted, stored or sent anywhere, and a reload
// clears it. Discard only ever touches the draft; the kept comment changes only on Confirm.

import { useState } from "react"

export default function CommentBox() {
  const [draft, setDraft] = useState("")
  const [kept, setKept] = useState<{ text: string; at: Date } | null>(null)

  const keptText = kept?.text ?? ""
  const canDiscard = draft.length > 0
  const canReset = draft !== keptText
  const canConfirm = draft.trim().length > 0 && draft !== keptText

  return (
    <section aria-labelledby="dash-comment-title" style={{
      marginTop: 48, paddingTop: 28, borderTop: "0.8px solid var(--border-strong)", maxWidth: 760,
    }}>
      <div className="ink-eyebrow" style={{ marginBottom: 12 }}>Comment</div>
      <h2 id="dash-comment-title" style={{ fontSize: 22, margin: "0 0 6px", color: "var(--text)" }}>
        Leave a comment on this dashboard
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
        Kept in this tab only. It is not sent anywhere, and reloading the page clears it.
      </p>

      <label htmlFor="dash-comment" style={{
        display: "block", fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 600,
        letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: 8,
      }}>Your comment</label>
      <textarea
        id="dash-comment"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={4}
        placeholder="What should change on this page?"
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical", padding: "12px 14px",
          fontFamily: "var(--font-body)", fontSize: 14.5, lineHeight: 1.6, color: "var(--text)",
          background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 12,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost" onClick={() => setDraft("")} disabled={!canDiscard}
          style={{ height: 38, padding: "0 16px", fontSize: 14 }}>
          Discard
        </button>
        <button type="button" className="btn-outline" onClick={() => setDraft(keptText)} disabled={!canReset}
          title={kept ? "Put the last confirmed comment back" : "Nothing confirmed yet, so this empties the box"}
          style={{ height: 38, padding: "0 18px", fontSize: 14 }}>
          Reset
        </button>
        <button type="button" className="btn-accent" onClick={() => setKept({ text: draft, at: new Date() })} disabled={!canConfirm}
          style={{ height: 38, padding: "0 20px", fontSize: 14 }}>
          Confirm
        </button>
        {draft !== keptText && kept && (
          <span style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--text-soft)" }}>Unsaved changes</span>
        )}
      </div>

      <div aria-live="polite" style={{ marginTop: 16 }}>
        {kept && (
          <div style={{
            padding: "14px 16px", borderRadius: 12, background: "var(--success-soft)",
            border: "1px solid var(--success-border)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
              fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 600, letterSpacing: ".12em",
              textTransform: "uppercase", color: "var(--success)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
              Kept · {kept.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>{kept.text}</p>
          </div>
        )}
      </div>
    </section>
  )
}
