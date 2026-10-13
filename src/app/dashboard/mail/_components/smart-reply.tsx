"use client"
import TypingDots from "../../_components/typing-dots"

import { useEffect, useState } from "react"
import { Send, Lock } from "lucide-react"
import { Chip, Btn } from "../../_suite/ui"
import SmartCompose from "./smart-compose"
import type { Mail } from "../../_suite/sample"
import { readyFor, type Decision } from "@/lib/mail-habits"
import { senderName } from "@/lib/mail-reading"
import type { Phrase } from "@/lib/my-phrases"
import type { Filled } from "@/lib/mail-forms"

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
  // What the person handed over on the Follow-ups page (their usual reply, their usual nudge), in their own words.
  // It is offered first, and like every other choice here it only fills the box: it goes out on Approve & Send.
  const [usual, setUsual] = useState<ReplyChip[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState("")
  const [active, setActive] = useState<number | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  // His own words: the box can be opened with nothing in it (owner, 13 Oct 2026: "give me an option to at least write an
  // email to them in my own words"). Before, it appeared only after one of the suggested replies was tapped.
  const [own, setOwn] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  useEffect(() => {
    let on = true
    fetch("/api/gmail/phrases").then(r => r.json()).then(j => { if (on && j?.ok && Array.isArray(j.phrases)) setPhrases(j.phrases) }).catch(() => { /* the box still works without them */ })
    return () => { on = false }
  }, [])
  // Their "please fill this in" table, filled from what he has sent before (owner, 13 Oct 2026: "fill in the whole box
  // with ... the previous data that the candidate or user had kept on filling up"). It is the first reply offered.
  const [form, setForm] = useState<{ fields: Filled[]; summary: string; subject: string; body: string } | null>(null)
  const [formOn, setFormOn] = useState(false)
  useEffect(() => {
    let on = true
    setForm(null); setFormOn(false)
    fetch("/api/gmail/form-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mail.id, account: mail.account }) }).then(r => r.json())
      .then(j => { if (on && j?.ok && j.form && j.reply) setForm({ fields: j.form.fields, summary: j.form.summary, subject: j.reply.subject, body: j.reply.body }) }).catch(() => { /* the other replies are still there */ })
    return () => { on = false }
  }, [mail.id, mail.account])
  const useForm = () => {
    if (!form) return
    setFormOn(true); setOwn(false); setActive(null); setSendError("")
    setSubject(form.subject); setBody(form.body)
  }
  const writeOwn = () => {
    setOwn(true); setFormOn(false); setActive(null); setSendError("")
    setSubject(s => s || (/^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`))
    setBody("")
  }

  useEffect(() => {
    let cancelled = false
    setChips(null)
    setUsual([])
    setLoadError("")
    setActive(null)
    fetch("/api/gmail/habits?saved=1")
      .then(r => r.json())
      .then((j: { ok?: boolean; decisions?: Decision[] }) => {
        if (cancelled || !j?.ok || !j.decisions?.length) return
        const ready = readyFor(j.decisions, {
          ask: mail.needsReply, yourTurn: mail.yourTurn ?? !!mail.needsReply, lastMine: mail.lastMine,
          quietDays: mail.ts ? (Date.now() - mail.ts) / 86_400_000 : 0, toName: senderName(mail.fromEmail) || mail.from,
        })
        const subject = /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`
        setUsual(ready.map(r => ({ label: r.label, subject, body: r.body })))
        setActive(a => (a === null ? a : a + ready.length))   // a choice already tapped keeps its place when these arrive in front
      })
      .catch(() => { /* the ordinary suggestions below are still there */ })
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

  const choices = [...usual, ...(chips || [])]
  const pick = (i: number) => {
    const c = choices[i]
    if (!c) return
    setActive(i)
    setOwn(false)
    setFormOn(false)
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
        Write in your own words, or tap a suggested reply and edit it. Nothing is sent until you approve it.
      </div>

      {loadError && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Suggestions aren't available right now — use the reply options below.
        </div>
      )}

      {!chips && !loadError && (
        <div><TypingDots label="Writing suggestions…" size={8} /></div>
      )}

      {form && (
        <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
          <p style={{ margin: "0 0 8px", fontSize: 14.5, fontWeight: 650, lineHeight: 1.5 }}>{form.summary}</p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, auto) 1fr", gap: "4px 14px", fontSize: 13.5 }}>
            {form.fields.map(f => (
              <span key={f.label} style={{ display: "contents" }}>
                <span style={{ color: "var(--text-muted)" }}>{f.label}</span>
                <span style={{ fontWeight: f.value ? 600 : 400, color: f.value ? "var(--text)" : "var(--text-muted)", overflowWrap: "anywhere" }}>{f.value || (f.sensitive ? "yours to type" : "not known yet")}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {form && <Chip label="Fill in their form" active={formOn} onClick={useForm} />}
        <Chip label="Write my own" active={own} onClick={writeOwn} />
        {choices.map((c, i) => (
          <Chip key={c.label} label={c.label} active={!own && !formOn && active === i} onClick={() => pick(i)} />
        ))}
      </div>

      {(own || formOn || active !== null) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Subject
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ height: 38, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13.5, color: "var(--text)", background: "var(--surface)" }} />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            <span>Message</span>
            <SmartCompose
              value={body}
              onChange={setBody}
              rows={own ? 9 : 12}
              context={{ to: mail.from, subject, role: mail.role }}
              phrases={phrases}
            />
          </div>
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
