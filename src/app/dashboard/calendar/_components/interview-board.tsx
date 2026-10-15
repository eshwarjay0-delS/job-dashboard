"use client"

// Every interview, kept in view until he says how it ended (GET/POST /api/gmail/interview-track).
//
// The owner, 13 Oct 2026: "it was just showcasing like one at each time ... we have to keep on following up with them
// about the next rounds ... Unless a user have selected it was rejected or completed ... it would go under the past
// interviews and no longer be tracked ... give the contact information of the recruiter ... not in a way that they feel
// ... super anxious ... like AI got you ... it can be delegated ... Just by asking the user what they wanted to do."
// So: one card for each interview with one calm sentence, who to write to, and what he can choose. Nothing here is
// called late. Sending for him is his own switch, and the exact words are shown before he says yes.

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import Link from "next/link"
import RecruiterButton from "../../_components/recruiter-button"
import type { Tracked } from "@/lib/interview-track"

type Answer = { ok: boolean; error?: string; active: Tracked[]; past: Tracked[]; due: number; canSendForYou: boolean; words: Record<string, { subject: string; body: string }> }
const PHASE: Record<string, string> = { coming: "Coming up", today: "Today", waiting: "Waiting for news", past: "Past" }
const card: CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px" }
const tag: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", whiteSpace: "nowrap" }
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 12px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", whiteSpace: "nowrap" }
const muted: CSSProperties = { fontSize: 12.5, color: "var(--text-muted)" }
const big: CSSProperties = { minHeight: 44, padding: "0 18px", fontSize: 15, display: "inline-flex", alignItems: "center", textDecoration: "none" }
const day = (at: number) => (at ? new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "")
const digits = (phone: string) => phone.replace(/ext\..*$/i, "").replace(/\D/g, "")
const mailto = (email: string) => { const at = email.lastIndexOf("@"); return at < 1 ? "#" : `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}` }
const openHref = (threadId: string) => `/dashboard/mail?open=${encodeURIComponent(threadId)}`

export default function InterviewBoard() {
  const [data, setData] = useState<Answer | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [asking, setAsking] = useState("")       // the interview whose "send for me" words are being shown
  const [showPast, setShowPast] = useState(false)
  const [showOld, setShowOld] = useState(false)

  const take = (j: Answer) => { if (j?.ok) { setData(j); setError("") } else setError(j?.error || "Your interviews could not be read just now.") }
  const load = useCallback(() => {
    fetch("/api/gmail/interview-track", { cache: "no-store" }).then(r => r.json()).then(take).catch(() => setError("Your interviews could not be read just now."))
  }, [])
  useEffect(() => { queueMicrotask(load) }, [load])

  const choose = async (id: string | string[], action: "rejected" | "completed" | "reopen" | "send_for_me" | "stop_sending") => {
    if (busy) return
    setBusy(`${action}:${Array.isArray(id) ? "all" : id}`)
    try {
      const r = await fetch("/api/gmail/interview-track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Array.isArray(id) ? { ids: id, action } : { id, action }) })
      take(await r.json())
      setAsking("")
    } catch { setError("That could not be saved just now.") } finally { setBusy("") }
  }

  if (error && !data) return <p role="status" style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>{error}</p>
  if (!data) return <p role="status" style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>Looking through your interviews…</p>
  if (!data.active.length && !data.past.length) return null
  // Long past with nothing since: set apart under one line, so what is still alive is all that is in front of him.
  const live = data.active.filter(t => !t.old), old = data.active.filter(t => t.old)

  return (
    <section aria-labelledby="interviews-heading" style={{ marginBottom: 28 }}>
      <h2 id="interviews-heading" style={{ margin: "0 0 6px", fontSize: 22, letterSpacing: "-0.02em" }}>Still going <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{live.length}</span></h2>
      <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 720 }}>
        Every interview stays here until you tell me how it ended. Nothing below is late. I say when a follow-up is a good idea, and I can send it for you.
      </p>
      {error && <p role="alert" style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 10px" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {live.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>No interview needs anything right now.</p>}
        {(showOld ? [...live, ...old] : live).map(t => {
          const name = (t.contact?.name || t.contact?.email || "them").split(/\s+/)[0]
          const words = data.words[t.id]
          const mine = !!t.forYou?.on
          return (
            <article key={t.id} style={{ ...card, borderLeft: t.action === "none" ? undefined : "4px solid var(--spot)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={tag}>{PHASE[t.phase]}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 650, overflowWrap: "anywhere" }}>{t.role}{t.company ? <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {t.company}</span> : null}</span>
                <span style={{ ...muted, whiteSpace: "nowrap" }}>{t.timeKnown ? day(t.at) : `around ${day(t.at)}`}</span>
              </div>
              <p style={{ margin: "10px 0 10px", fontSize: 15.5, fontWeight: 600, lineHeight: 1.5 }}>{t.say}</p>
              {t.forYou?.ended === "limit" && <p style={{ ...muted, margin: "0 0 8px" }}>I sent four for you and stopped. Say the word and I will carry on.</p>}

              {t.contact && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, background: "var(--surface-2)", marginBottom: 12 }}>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 650, overflowWrap: "anywhere" }}>{t.contact.name || t.contact.email}{t.contact.recruiter ? <span style={{ fontWeight: 500, color: "var(--text-muted)" }}> · your recruiter</span> : null}</div>
                    <div style={{ ...muted, overflowWrap: "anywhere" }}>{t.contact.company ? `${t.contact.company} · ` : ""}{t.contact.email}{t.contact.phones.length ? ` · ${t.contact.phones.join(" · ")}` : ""}</div>
                  </div>
                  <a href={mailto(t.contact.email)} style={pill}>Email</a>
                  {t.contact.phones.slice(0, 1).map(n => <a key={n} href={`tel:${digits(n)}`} style={pill}>Call</a>)}
                  <RecruiterButton email={t.contact.email} name={t.contact.name} onChanged={load} />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {t.threadId && <Link href={openHref(t.threadId)} className={t.action === "none" ? "btn-outline" : "btn-accent"} style={big}>{t.action === "reply" ? "Open and reply" : t.action === "follow_up" ? "Open and follow up" : "Open"}</Link>}
                {t.phase === "waiting" && t.contact && !t.contact.recruiter && !t.theyWrote && (mine
                  ? <button type="button" className="btn-outline" disabled={!!busy} onClick={() => { void choose(t.id, "stop_sending") }} style={big}>{busy === `stop_sending:${t.id}` ? "Saving…" : "Stop sending for me"}</button>
                  : <button type="button" className="btn-outline" aria-expanded={asking === t.id} onClick={() => setAsking(a => (a === t.id ? "" : t.id))} style={big}>Send one for me every week</button>)}
                <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => { void choose(t.id, "completed") }} style={{ minHeight: 44, padding: "0 12px", fontSize: 14 }}>{busy === `completed:${t.id}` ? "Saving…" : "It is finished"}</button>
                <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => { void choose(t.id, "rejected") }} style={{ minHeight: 44, padding: "0 12px", fontSize: 14 }}>{busy === `rejected:${t.id}` ? "Saving…" : "Not going ahead"}</button>
              </div>

              {asking === t.id && words && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 650 }}>This is what I will send to {name}, once a week, from {t.account}:</p>
                  <p style={{ margin: "0 0 4px", ...muted }}>Subject: {words.subject}</p>
                  <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{words.body}</p>
                  <p style={{ ...muted, margin: "0 0 10px" }}>It stops by itself when {name} answers, when you mark this finished, or after four. You can stop it at any time.</p>
                  {data.canSendForYou ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="btn-accent" disabled={!!busy} onClick={() => { void choose(t.id, "send_for_me") }} style={big}>{busy === `send_for_me:${t.id}` ? "Saving…" : "Yes, send it for me every week"}</button>
                      <button type="button" className="btn-outline" onClick={() => setAsking("")} style={big}>No, I will do it myself</button>
                    </div>
                  ) : <p style={{ margin: 0, fontSize: 14 }}>I cannot send for you yet: this site&apos;s daily job is not switched on. You can still follow up yourself with the button above.</p>}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {old.length > 0 && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ flex: "1 1 260px", fontSize: 14.5, lineHeight: 1.5 }}>{old.length} older {old.length === 1 ? "interview has" : "interviews have"} had no news for more than five weeks. I am not asking you to chase {old.length === 1 ? "it" : "them"}.</span>
          <button type="button" className="btn-outline" aria-expanded={showOld} onClick={() => setShowOld(v => !v)} style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }}>{showOld ? "Hide them" : "Show them"}</button>
          <button type="button" className="btn-outline" disabled={!!busy} onClick={() => { void choose(old.map(t => t.id), "completed") }} style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }}>{busy === "completed:all" ? "Saving…" : old.length === 1 ? "It is over" : "They are all over"}</button>
        </div>
      )}

      {data.past.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn-ghost" aria-expanded={showPast} onClick={() => setShowPast(v => !v)} style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}>
            {showPast ? "Close past interviews" : `Past interviews: ${data.past.length}`}
          </button>
          {showPast && (
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {data.past.map(t => (
                <li key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 650, overflowWrap: "anywhere" }}>{t.role}{t.company ? ` · ${t.company}` : ""}</div>
                    <div style={muted}>Interview {t.timeKnown ? "on" : "around"} {day(t.at)}. {t.say}</div>
                  </div>
                  {t.threadId && <Link href={openHref(t.threadId)} style={pill}>Open</Link>}
                  <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => { void choose(t.id, "reopen") }} style={{ minHeight: 36, padding: "0 12px", fontSize: 13.5 }}>{busy === `reopen:${t.id}` ? "Saving…" : "Follow them again"}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
