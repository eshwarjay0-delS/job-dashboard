"use client"

// A submission row's follow-up control: the Interviews tab's asking/armed
// panels, pointed at one submission chain (7 Nov 2026, owner ask). Same
// buttons, same words-in-view-before-yes, same ring-day ticks, same Send now.
// Send now goes out at once and is never blocked by the four-count; the
// weekly send switches on only with the "Yes, send it for me every week"
// tap. Nothing here auto-sends: every send is his tap, or the daily job on
// a switch he turned on himself.

import { useState, type CSSProperties } from "react"
import { dayList, DEFAULT_DAYS, type Tracked } from "@/lib/interview-track"
import { submissionSendNowBlockReason } from "@/lib/submission-track"
import { DayTicks } from "../../calendar/_components/interview-board"

// Board sends go from jayeshwar44 (28 Oct 2026): follow-ups send from
// jayeshwar44, not eshwarjay05.
const FROM = "jayeshwar44@gmail.com"

const muted: CSSProperties = { fontSize: 12.5, color: "var(--text-muted)" }
const big: CSSProperties = { minHeight: 44, padding: "0 18px", fontSize: 15, display: "inline-flex", alignItems: "center", textDecoration: "none" }
const dayTime = (at: number) => (at ? new Date(at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "")

export default function SubmissionFollowUp({ target, words, canSendForYou, onChanged }: {
  target: Tracked
  words?: { subject: string; body: string }
  canSendForYou: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [asking, setAsking] = useState(false)
  const [askDays, setAskDays] = useState<number[]>([...DEFAULT_DAYS])
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState("")
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")

  // No follow-up control when there is nothing to follow up: the submission
  // is closed, the recruiter wrote last, there is no outside contact, or the
  // contact is one of his own recruiters. The row's View button still reads
  // "Open and follow up" when there is something to do (a reply to read).
  if (target.phase !== "waiting" || !target.contact || target.contact.recruiter || target.theyWrote) return null
  const name = (target.contact?.name || target.contact?.email || "them").split(/\s+/)[0]
  const mine = !!target.forYou?.on
  const sendBlock = submissionSendNowBlockReason({ terminal: null, contact: target.contact, theyWrote: target.theyWrote })
  const busyFor = busy !== ""

  const choose = async (action: "send_for_me" | "stop_sending" | "save_words" | "set_days" | "send_now", customWords?: { subject: string; body: string }, days?: number[]): Promise<boolean> => {
    if (busyFor) return false
    setBusy(`${action}:${target.id}`)
    try {
      const payload: Record<string, unknown> = { id: target.id, action }
      if (customWords && (action === "send_for_me" || action === "save_words" || action === "send_now")) { payload.subject = customWords.subject; payload.body = customWords.body }
      if (days !== undefined) payload.days = days
      const r = await fetch("/api/gmail/submission-track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60_000) })
      const j = await r.json() as { ok: boolean; error?: string; skipped?: boolean }
      // A failed tap must never claim a send, and must never close the panel the person was working in:
      // the error line is the whole answer until the tap really goes out.
      if (!j?.ok) { setError(j?.error || "That could not be saved just now."); return false }
      setError("")
      onChanged()
      setAsking(false)
      setAskDays([...DEFAULT_DAYS])
      setEditing(false)
      if (action === "send_now") {
        setToast(j.skipped ? "Already sent a moment ago — nothing sent twice." : `Sent to ${name}.`)
        setTimeout(() => setToast(""), 4000)
      }
      return true
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "TimeoutError"
      setError(timedOut && action === "send_now" ? "That is taking longer than usual. It may still go out, so check Sent before tapping again." : "That could not be saved just now.")
      return false
    } finally { setBusy("") }
  }

  // Ticks save behind the tap and repaint from the fresh read, so the ticks never lie.
  const toggleDay = async (d: number) => {
    const current = target.forYou?.days || DEFAULT_DAYS
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d].sort((a, b) => a - b)
    const ok = await choose("set_days", undefined, next)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else onChanged()
  }

  const startEdit = (subject: string, body: string) => {
    setEditing(true)
    setEditSubject(subject)
    setEditBody(body)
  }

  return (
    <div>
      {target.forYou?.ended === "limit" && <p style={{ ...muted, margin: "0 0 8px" }}>I sent four for you and stopped. Say the word and I will carry on.</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        {mine
          ? <button type="button" className="btn-outline" disabled={busyFor} onClick={() => { void choose("stop_sending") }} style={big}>{busy === `stop_sending:${target.id}` ? "Saving…" : "Stop sending for me"}</button>
          : <button type="button" className="btn-outline" aria-expanded={asking} onClick={() => { setAsking(a => !a); setAskDays(target.forYou?.days?.length ? [...target.forYou.days] : [...DEFAULT_DAYS]) }} style={big}>Follow up</button>}
      </div>
      {error && <p role="alert" style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "8px 0 0" }}>{error}</p>}

      {/* The sending panel folds shut on its header tap; the ring days stay in view at the top right. */}
      {mine && words && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", margin: "0 0 8px" }}>
            <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)} style={{ background: "none", border: "none", padding: 0, fontSize: 14, fontWeight: 650, color: "var(--text)", cursor: "pointer", textAlign: "left" }}>
              {collapsed ? "▸" : "▾"} What I send to {name}{target.forYou?.days?.length ? `, on ${dayList(target.forYou.days)}` : ", once a week"}, from {FROM}:
            </button>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={muted}>Ring on, once a week:</span>
              <DayTicks days={target.forYou?.days || DEFAULT_DAYS} disabled={busyFor} onToggle={d => toggleDay(d)} />
              {saved && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Saved</span>}
            </span>
          </div>
          {!collapsed && (<>
          <div style={{ display: "flex", gap: 8, margin: "0 0 10px" }}>
            <button type="button" className={history ? "btn-outline" : "btn-accent"} onClick={() => setHistory(false)} style={{ minHeight: 32, padding: "4px 12px", fontSize: 13 }}>Message</button>
            <button type="button" className={history ? "btn-accent" : "btn-outline"} onClick={() => { setHistory(true); setEditing(false) }} style={{ minHeight: 32, padding: "4px 12px", fontSize: 13 }}>History</button>
          </div>
          {editing ? (
            <>
              <label style={{ display: "block", margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>Subject
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)} maxLength={200}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
              </label>
              <label style={{ display: "block", margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)" }}>Message
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} maxLength={2000} rows={8}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, lineHeight: 1.6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical" }} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn-accent" disabled={busyFor}
                  onClick={() => { void choose("save_words", { subject: editSubject, body: editBody }) }} style={big}>
                  {busy === `save_words:${target.id}` ? "Saving…" : "Save words"}
                </button>
                <button type="button" className="btn-outline" disabled={busyFor || !!sendBlock}
                  onClick={() => { void choose("send_now", { subject: editSubject, body: editBody }) }} style={big}>
                  {busy === `send_now:${target.id}` ? "Sending…" : "Send edited now"}
                </button>
                {sendBlock ? <p style={{ ...muted, margin: 0, alignSelf: "center" }}>{sendBlock}</p> : null}
                <button type="button" className="btn-outline" onClick={() => setEditing(false)} style={big}>Cancel edit</button>
              </div>
            </>
          ) : history ? (
            <>
              {target.forYou?.sentAt?.length ? (
                <>
                  <p style={{ ...muted, margin: "0 0 8px" }}>Last sent {dayTime(target.forYou.sentAt[target.forYou.sentAt.length - 1])}.</p>
                  <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>
                    {[...target.forYou.sentAt].reverse().map(at => <li key={at}>{dayTime(at)}</li>)}
                  </ul>
                </>
              ) : (
                <p style={{ ...muted, margin: "0 0 10px" }}>Nothing sent from MarketFit yet.</p>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 4px", ...muted }}>Subject: {words.subject}</p>
              <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{words.body}</p>
              {target.forYou?.sentAt?.length ? <p style={{ ...muted, margin: "0 0 10px" }}>Last sent {dayTime(target.forYou.sentAt[target.forYou.sentAt.length - 1])}.</p> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="btn-accent" disabled={busyFor || !!sendBlock}
                  onClick={() => { void choose("send_now") }} style={big}>
                  {busy === `send_now:${target.id}` ? "Sending…" : "Send now"}
                </button>
                {sendBlock ? <p style={{ ...muted, margin: 0 }}>{sendBlock}</p> : null}
                <button type="button" className="btn-outline" onClick={() => startEdit(words.subject, words.body)} style={big}>Edit</button>
              </div>
              <p style={{ ...muted, margin: "10px 0 0" }}>Send now goes out at once. It does not count toward the four automatic sends. The automatic send rings only on the ticked days; untick them all and it rings Monday and Thursday, once a week.</p>
            </>
          )}
          </>)}
        </div>
      )}

      {asking && words && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", margin: "0 0 8px" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>This is what I will send to {name}, once a week, from {FROM}:</p>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={muted}>Ring on, once a week:</span>
              <DayTicks days={askDays} onToggle={d => setAskDays(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort((a, b) => a - b))} />
            </span>
          </div>
          {editing ? (
            <>
              <label style={{ display: "block", margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>Subject
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)} maxLength={200}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
              </label>
              <label style={{ display: "block", margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)" }}>Message
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} maxLength={2000} rows={8}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, lineHeight: 1.6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical" }} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn-outline" onClick={() => setEditing(false)} style={big}>Cancel edit</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 4px", ...muted }}>Subject: {words.subject}</p>
              <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{words.body}</p>
            </>
          )}
          <p style={{ ...muted, margin: "0 0 10px" }}>It stops by itself when {name} answers, or after four. You can stop it at any time.</p>

          {canSendForYou ? (
            <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="btn-accent" disabled={busyFor}
                onClick={() => { void choose("send_for_me", editing ? { subject: editSubject, body: editBody } : undefined, askDays.length ? askDays : undefined) }} style={big}>
                {busy === `send_for_me:${target.id}` ? "Saving…" : editing ? "Yes, send my edited version every week" : "Yes, send it for me every week"}
              </button>
              <button type="button" className="btn-outline" disabled={busyFor || !!sendBlock}
                onClick={() => { void choose("send_now", editing ? { subject: editSubject, body: editBody } : undefined) }} style={big}>
                {busy === `send_now:${target.id}` ? "Sending…" : editing ? "Send edited now" : "Send now"}
              </button>
              {sendBlock ? <p style={{ ...muted, margin: 0 }}>{sendBlock}</p> : null}
              {!editing && (
                <button type="button" className="btn-outline" onClick={() => startEdit(words.subject, words.body)} style={big}>Edit</button>
              )}
              <button type="button" className="btn-outline" onClick={() => { setAsking(false); setEditing(false) }} style={big}>No, I will do it myself</button>
            </div>
            <p style={{ ...muted, margin: "10px 0 0" }}>Send now sends this message once only. It does not switch on the weekly send.</p>
            </>
          ) : <p style={{ margin: 0, fontSize: 14 }}>I cannot send for you yet: this site&apos;s daily job is not switched on. You can still follow up yourself with the button above.</p>}
        </div>
      )}
      {toast ? <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, zIndex: 50, padding: "10px 16px", borderRadius: 999, background: "var(--accent)", color: "var(--bg)", fontSize: 14, fontWeight: 650, boxShadow: "0 4px 16px rgba(0,0,0,.2)", transform: "translateX(-50%)", animation: "mfit-toast-in 250ms ease-out" }}>{toast}</div> : null}
    </div>
  )
}
