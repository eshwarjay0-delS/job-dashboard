"use client"

import { useEffect, useState } from "react"
import { Send, Lock } from "lucide-react"
import { Chip, Btn } from "../../_suite/ui"
import type { Mail } from "../../_suite/sample"

interface ReplyChip {
  label: string
  subject: string
  body: string
}

function categoryFor(m: Mail): string {
  if (m.needsReply === "rtr") return "RTR Request"
  if (m.needsReply === "rate") return "Rate Confirmation"
  return "Interview Request"
}

/** "Priya Raman <priya@tekblu.us>" -> "priya@tekblu.us" */
function bareEmail(fromEmail: string): string {
  const m = fromEmail.match(/<([^>]+)>/)
  return (m ? m[1] : fromEmail).trim()
}

export default function SmartReply({ mail, onSent }: { mail: Mail; onSent: () => void }) {
  const [chips, setChips] = useState<ReplyChip[] | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState("")
  const [active, setActive] = useState<number | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")

  useEffect(() => {
    let cancelled = false
    setChips(null)
    setLoadError("")
    setActive(null)
    fetch("/api/gmail/suggest-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountEmail: mail.account,
        category: categoryFor(mail),
        mail: {
          from: mail.from,
          fromEmail: mail.fromEmail,
          subject: mail.subject,
          preview: mail.preview,
          role: mail.role,
          company: mail.company,
          rate: mail.rate,
        },
      }),
    })
      .then(r => r.json().then(b => ({ ok: r.ok, body: b })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) throw new Error(body.error || "Could not load suggestions.")
        setChips(body.chips || [])
        setAccountId(typeof body.accountId === "string" ? body.accountId : null)
      })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [mail.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    const c = chips?.[i]
    if (!c) return
    setActive(i)
    setSubject(c.subject)
    setBody(c.body)
    setSendError("")
  }

  const send = async () => {
    if (!subject.trim() || !body.trim() || sending) return
    setSending(true)
    setSendError("")
    try {
      const res = await fetch("/api/gmail-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: bareEmail(mail.fromEmail), subject: subject.trim(), body: body.trim(), accountId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Send failed.")
      onSent()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        These are suggested replies. Tap one, edit anything, then approve to send.
      </div>

      {loadError && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Suggestions aren't available right now — use the reply options below.
        </div>
      )}

      {!chips && !loadError && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>⟳ Writing suggestions…</div>
      )}

      {chips && chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.map((c, i) => (
            <Chip key={c.label} label={c.label} active={active === i} onClick={() => pick(i)} />
          ))}
        </div>
      )}

      {active !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Subject
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ height: 38, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13.5, color: "var(--text)", background: "var(--surface)" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Message — edit anything before sending
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13.5, lineHeight: 1.6, color: "var(--text)", background: "var(--surface)", resize: "vertical", fontFamily: "inherit" }} />
          </label>
          {sendError && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{sendError}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <Lock size={13} /> Draft only — nothing sends until you approve.
            </span>
            <Btn onClick={send} disabled={sending || !subject.trim() || !body.trim()}>
              <Send size={14} /> {sending ? "Sending…" : "Approve & Send"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
