"use client"

// The inbox's "RTR and rate" filter, and the history with one person. Both read /api/gmail/papers and /api/gmail/person,
// which read the kept mail and call no model.
//
// The owner, 13 Oct 2026: "give me a filter where we did the RTRs, rate confirmation, acknowledgement mails ... Mention
// that and if I have responded back ... whoever was in there and those numbers and contact details as well ... if I search
// his name ... the previous history of at least the subject lines and a bit of interaction of how it went."

import { useEffect, useState, type CSSProperties } from "react"
import Link from "next/link"
import RecruiterButton from "../../_components/recruiter-button"
import type { Paper, History, InThread } from "@/lib/mail-papers"

const day = (at: number) => (at ? new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "")
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 12px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", whiteSpace: "nowrap" }
const tag: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", whiteSpace: "nowrap" }
const card: CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px" }
const muted: CSSProperties = { fontSize: 12.5, color: "var(--text-muted)" }
const digits = (phone: string) => phone.replace(/ext\..*$/i, "").replace(/\D/g, "")
const mailto = (email: string) => { const at = email.lastIndexOf("@"); return at < 1 ? "#" : `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}` }
const openHref = (threadId: string) => `/dashboard/mail?open=${encodeURIComponent(threadId)}`

function Who({ p, onChanged }: { p: InThread; onChanged?: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 650, overflowWrap: "anywhere" }}>{p.name || p.email}{p.recruiter ? <span style={{ fontWeight: 500, color: "var(--text-muted)" }}> · your recruiter</span> : null}</div>
        <div style={{ ...muted, overflowWrap: "anywhere" }}>{p.company ? `${p.company} · ` : ""}{p.email}{p.phones.length ? ` · ${p.phones.join(" · ")}` : ""}{p.wrote ? "" : " · copied in, has not written"}</div>
      </div>
      <a href={mailto(p.email)} style={pill}>Email</a>
      {p.phones.slice(0, 1).map(n => <a key={n} href={`tel:${digits(n)}`} style={pill}>Call</a>)}
      <RecruiterButton email={p.email} name={p.name} onChanged={onChanged} />
    </div>
  )
}

export function Papers({ account = "", onCount }: { account?: string; onCount?: (n: number) => void }) {
  const [data, setData] = useState<{ papers: Paper[]; waiting: number; answered: number } | null>(null)
  const [error, setError] = useState("")
  const [again, setAgain] = useState(0)
  const [history, setHistory] = useState("")

  useEffect(() => {
    let on = true
    fetch(`/api/gmail/papers${account ? `?account=${encodeURIComponent(account)}` : ""}`, { cache: "no-store" }).then(r => r.json())
      .then(j => { if (!on) return; if (j?.ok) { setData(j); setError(""); onCount?.(j.papers.length) } else setError(j?.error || "Your mail could not be looked through just now.") })
      .catch(() => { if (on) setError("Your mail could not be looked through just now.") })
    return () => { on = false }
  }, [account, again, onCount])

  if (error && !data) return <p role="status" style={{ fontSize: 14, color: "var(--text-muted)" }}>{error}</p>
  if (!data) return <p role="status" style={{ fontSize: 14, color: "var(--text-muted)" }}>Looking for RTRs and rate confirmations…</p>
  if (!data.papers.length) return <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 14 }}>No RTR or rate confirmation in your mail.</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-muted)" }}>
        {data.papers.length} {data.papers.length === 1 ? "conversation carries" : "conversations carry"} an RTR or a rate confirmation. {data.waiting} not answered yet, {data.answered} answered.
      </p>
      {data.papers.map(p => (
        <article key={`${p.account}:${p.threadId}`} style={{ ...card, borderLeft: p.answered ? undefined : "4px solid var(--spot)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {p.kinds.includes("rtr") && <span style={tag}>RTR</span>}
            {p.kinds.includes("rate") && <span style={tag}>Rate confirmation</span>}
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.about}</span>
            <span style={{ ...muted, whiteSpace: "nowrap" }}>{day(p.at)}</span>
          </div>
          <p style={{ margin: "10px 0 4px", fontSize: 15.5, fontWeight: 650, lineHeight: 1.45 }}>{p.answered ? `You answered on ${day(p.answeredAt)}.` : `You have not answered yet${p.wantsAck ? ": they asked you to confirm or sign" : ""}.`}</p>
          <p style={{ margin: "0 0 4px", fontSize: 14.5, lineHeight: 1.5, color: "var(--text)", overflowWrap: "anywhere" }}>“{p.said}”</p>
          {p.form && <p style={{ ...muted, margin: "0 0 4px" }}>Form named in the mail: {p.form}</p>}
          {p.from.recruiter && <p style={{ ...muted, margin: "0 0 4px" }}>Sent through your recruiter, not by a vendor you have to pick.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0 12px" }}>
            <Who p={p.from} onChanged={() => setAgain(n => n + 1)} />
            {p.people.map(x => <Who key={x.email} p={x} onChanged={() => setAgain(n => n + 1)} />)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={openHref(p.threadId)} className={p.answered ? "btn-outline" : "btn-accent"} style={{ minHeight: 44, padding: "0 18px", fontSize: 15, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{p.answered ? "Open" : "Open and reply"}</Link>
            <button type="button" className="btn-ghost" aria-expanded={history === p.threadId} onClick={() => setHistory(h => (h === p.threadId ? "" : p.threadId))} style={{ minHeight: 44, padding: "0 12px", fontSize: 14 }}>
              {history === p.threadId ? "Close the history" : `History with ${(p.from.name || p.from.email).split(/\s+/)[0]}`}
            </button>
          </div>
          {history === p.threadId && <div style={{ marginTop: 12 }}><PersonHistory email={p.from.email} /></div>}
        </article>
      ))}
    </div>
  )
}

/** Everything exchanged with one person. Given an address it shows that person; given words, whoever they fit best. */
export function PersonHistory({ q = "", email = "" }: { q?: string; email?: string }) {
  const [h, setH] = useState<History | null>(null)
  const [picked, setPicked] = useState("")
  const asked = (email || picked) ? { email: email || picked } : { q: q.trim() }
  const key = JSON.stringify(asked)

  useEffect(() => {
    const want = JSON.parse(key) as { q?: string; email?: string }
    // Words with a search operator in them ("from:", "after:") are a search, not a name.
    if (!want.email && (!want.q || want.q.length < 3 || /[:"()]/.test(want.q))) { queueMicrotask(() => setH(null)); return }
    let on = true
    const timer = setTimeout(() => {
      fetch("/api/gmail/person", { method: "POST", headers: { "Content-Type": "application/json" }, body: key }).then(r => r.json())
        .then(j => { if (on) setH(j?.ok && j.person ? j : null) }).catch(() => { if (on) setH(null) })
    }, want.email ? 0 : 450)
    return () => { on = false; clearTimeout(timer) }
  }, [key])

  if (!h || !h.person) return null
  return (
    <section aria-label={`History with ${h.person.name || h.person.email}`} style={{ ...card, marginBottom: 14 }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>History with this person</p>
      <Who p={h.person} />
      <p style={{ margin: "10px 0 8px", fontSize: 14.5, lineHeight: 1.55 }}>{h.summary}</p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {h.conversations.slice(0, 8).map(c => (
          <li key={`${c.account}:${c.threadId}`} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", justifyContent: "space-between" }}>
              <Link href={openHref(c.threadId)} style={{ fontSize: 14.5, fontWeight: 650, color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3, overflowWrap: "anywhere" }}>{c.subject}</Link>
              <span style={{ ...muted, whiteSpace: "nowrap" }}>{day(c.startedAt)}{c.lastAt - c.startedAt > 86_400_000 ? ` to ${day(c.lastAt)}` : ""}</span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2, overflowWrap: "anywhere" }}>{c.how}</div>
          </li>
        ))}
      </ol>
      {h.conversations.length > 8 && <p style={{ ...muted, margin: "8px 0 0" }}>And {h.conversations.length - 8} earlier {h.conversations.length - 8 === 1 ? "conversation" : "conversations"}.</p>}
      {h.matches.length > 0 && !email && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <span style={muted}>Someone else?</span>
          {h.matches.map(m => <button key={m.email} type="button" onClick={() => setPicked(m.email)} style={{ ...pill, cursor: "pointer", fontWeight: 500 }}>{m.name || m.email} ({m.conversations})</button>)}
        </div>
      )}
    </section>
  )
}
