"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Check } from "lucide-react"

interface GrammarIssue { quote: string; suggestion: string; reason: string }

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  context?: { to?: string; subject?: string; role?: string }
  placeholder?: string
}

/**
 * SmartCompose — the textarea that types with you.
 * - Ghost-text completion: pause after a word and the next few words appear
 *   faintly ahead of your cursor. Tab (or tap) accepts them.
 * - Grammar fixes: as you type, real issues surface as tappable fix chips.
 */
export default function SmartCompose({ value, onChange, rows = 12, context, placeholder }: Props) {
  const [ghost, setGhost] = useState("")
  const [issues, setIssues] = useState<GrammarIssue[]>([])
  const [checking, setChecking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proofTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReq = useRef(0)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Clear stale suggestions the moment he types over them.
  function handleChange(v: string) {
    setGhost("")
    onChange(v)

    if (timer.current) clearTimeout(timer.current)
    if (proofTimer.current) clearTimeout(proofTimer.current)

    // Completion: only when he just finished a word and there's substance.
    const trimmed = v.trimEnd()
    if (v.endsWith(" ") && trimmed.length > 24 && !/[.!?]\s*$/.test(trimmed)) {
      timer.current = setTimeout(() => void fetchCompletion(v), 700)
    }
    // Proofread: debounced, only on real drafts.
    if (trimmed.length > 60) {
      proofTimer.current = setTimeout(() => void fetchProofread(v), 1600)
    } else {
      setIssues([])
    }
  }

  async function fetchCompletion(v: string) {
    const id = ++lastReq.current
    try {
      const res = await fetch("/api/gmail/writing-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "complete", text: v, context: context || {} }),
      })
      const body = await res.json().catch(() => ({}))
      if (id !== lastReq.current) return // a newer keystroke won
      const c = String(body.completion || "").trim()
      // Don't ghost what's already there.
      setGhost(c && !v.endsWith(c) ? c : "")
    } catch { /* completions are a bonus, never an error */ }
  }

  async function fetchProofread(v: string) {
    setChecking(true)
    try {
      const res = await fetch("/api/gmail/writing-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "proofread", text: v }),
      })
      const body = await res.json().catch(() => ({}))
      const list = Array.isArray(body.issues) ? body.issues : []
      // Keep only issues whose quote is still in the text.
      setIssues(list.filter((i: GrammarIssue) => i.quote && v.includes(i.quote)).slice(0, 4))
    } catch { /* proofread is a bonus, never an error */ }
    finally { setChecking(false) }
  }

  function acceptGhost() {
    if (!ghost) return
    const sep = value.endsWith(" ") || ghost.startsWith(" ") ? "" : " "
    onChange(value + sep + ghost + " ")
    setGhost("")
    taRef.current?.focus()
  }

  function applyFix(i: number) {
    const issue = issues[i]
    if (!issue) return
    onChange(value.replace(issue.quote, issue.suggestion))
    setIssues(is => is.filter((_, j) => j !== i))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab" && ghost) {
      e.preventDefault()
      acceptGhost()
    }
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (proofTimer.current) clearTimeout(proofTimer.current)
  }, [])

  const box: React.CSSProperties = {
    padding: 10, fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit",
    whiteSpace: "pre-wrap", overflowWrap: "break-word",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        {/* Ghost layer: invisible typed text + visible faint completion */}
        <div aria-hidden="true" style={{ ...box, position: "absolute", inset: 0, pointerEvents: "none", color: "transparent" }}>
          {value}<span style={{ color: "var(--text-soft)", opacity: 0.75 }}>{ghost}</span>
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            ...box, position: "relative", width: "100%", display: "block",
            borderRadius: 10, border: "1px solid var(--border-strong)",
            color: "var(--text)", background: "transparent",
            caretColor: "var(--text)", resize: "vertical",
          }}
        />
      </div>

      {ghost && (
        <button
          type="button"
          onClick={acceptGhost}
          style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12.5, fontWeight: 650, color: "var(--accent-txt)",
            background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
            borderRadius: 999, padding: "6px 12px", cursor: "pointer",
          }}
        >
          <Sparkles size={13} /> Tab to accept: “{ghost.length > 48 ? ghost.slice(0, 48) + "…" : ghost}”
        </button>
      )}

      {(issues.length > 0 || checking) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {checking && issues.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Checking…</span>
          )}
          {issues.map((issue, i) => (
            <button
              key={`${issue.quote}-${i}`}
              type="button"
              onClick={() => applyFix(i)}
              title={issue.reason}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
                background: "var(--surface-2)", border: "1px solid var(--border-strong)",
                borderRadius: 999, padding: "6px 12px", cursor: "pointer", color: "var(--text)",
              }}
            >
              <span style={{ textDecoration: "line-through", opacity: 0.65 }}>{issue.quote}</span>
              <span>→</span>
              <strong>{issue.suggestion}</strong>
              <Check size={13} style={{ color: "var(--success)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
