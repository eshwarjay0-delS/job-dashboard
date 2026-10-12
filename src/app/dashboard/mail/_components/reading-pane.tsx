"use client"
import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { Reply, History, Phone } from "lucide-react"
import { Avatar, StagePill } from "../../_suite/ui"
import type { Mail } from "../../_suite/sample"
import { contactsOf, decodeEntities, senderEmail, senderName, sequenceOf, type Reading } from "@/lib/mail-reading"

// One conversation, the way a person reads one: who it is from, what it is about, what they wrote. Then three things to do,
// one at a time: reply, see the history, see how to reach them.
//
// The owner, 12 Oct 2026: "the whole gmail board is super messy. Clear Organizing and only present how much a 5 year old
// baby could consume understand and respond, think, ask for clarification, question, ask for automated replies, ask for
// history about the mail sequence. occurence. details contact numbers".
//
// Before this the pane showed the subject, Gmail's 140-character snippet (often only the signature) and then every reply
// tool at once. The email itself was never on the page. It is fetched here from /api/gmail/reading when a row is opened.

/** One sentence a person can act on: who wants what. `first` is the sender's first name. */
export function narrate(m: Pick<Mail, "needsReply" | "stage" | "when" | "rate">, first: string, youWroteLast: boolean): string {
  if (m.stage === "rejected") return `${first} says this one is not going ahead. Nothing to do.`
  if (m.stage === "offer") return `${first} is making you an offer. Read it, then reply.`
  if (m.when) return `Your interview is set: ${m.when}.`
  if (youWroteLast) return `You answered ${first}. Now it is their turn.`
  if (m.needsReply === "availability") return `${first} wants to set up an interview and is waiting for your times.`
  if (m.needsReply === "rtr") return `${first} wants your go-ahead to put you forward for this job (a Right to Represent).`
  if (m.needsReply === "rate") return `${first} wants you to confirm the pay rate${m.rate ? ` of ${m.rate}` : ""}.`
  if (m.stage === "followup") return `${first} is following up with you.`
  if (m.stage === "pending" || m.stage === "applied") return `${first} is keeping you posted. Nothing is being asked of you yet.`
  return `${first} wrote to you about this job.`
}

type Panel = "reply" | "history" | "details" | null
const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "")
const day = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "")
const letter: CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "68ch", margin: 0 }
const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 6px" }

export default function ReadingPane({ m, myEmail, tint, restored, reply }: {
  m: Mail; myEmail: string; tint: string; restored: boolean
  reply: ReactNode   // the reply tools this conversation gets, shown only when Reply is pressed
}) {
  const [reading, setReading] = useState<Reading | null>(null)
  const [failed, setFailed] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [opened, setOpened] = useState<string | null>(null)

  // The parent gives this component a new key for each conversation, so it starts empty each time and only fetches here.
  useEffect(() => {
    let on = true
    fetch(`/api/gmail/reading?id=${encodeURIComponent(m.id)}&account=${encodeURIComponent(m.account)}`)
      .then(r => r.json())
      .then(j => { if (!on) return; if (j && j.ok && Array.isArray(j.messages)) setReading({ subject: j.subject || "", messages: j.messages }); else setFailed(true) })
      .catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [m.id, m.account])

  const who = senderName(m.fromEmail) || m.from || m.company
  const messages = reading?.messages || []
  const theirs = [...messages].reverse().find(x => !x.mine)          // the last thing THEY wrote is what there is to read
  const seq = reading ? sequenceOf(reading) : null
  const contacts = reading ? contactsOf(reading) : { phones: [], emails: [] }
  const subject = reading?.subject || decodeEntities(m.subject).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, "")
  const tab = (id: Exclude<Panel, null>, icon: ReactNode, text: string) => (
    <button type="button" onClick={() => setPanel(p => (p === id ? null : id))} aria-expanded={panel === id}
      className={panel === id ? "btn-accent" : "btn-outline"} style={{ minHeight: 44, padding: "0 18px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}>
      {icon}{text}
    </button>
  )

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={who} tint={tint} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>{who}</h2>
            {restored ? <StagePill stage="applied" label="Restored" /> : <StagePill stage={m.stage} />}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflowWrap: "anywhere" }}>{senderEmail(m.fromEmail)} · to {myEmail}</div>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{m.at}</span>
      </div>

      {/* In plain words: what this is and what it wants from you. Worked out from the stage the mail was sorted into,
          never from a model: it says nothing the mail does not. */}
      <p style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, margin: "18px 0 0", color: "var(--text)" }}>{narrate(m, who.split(/[\s,]+/)[0] || who, !!seq?.lastMine)}</p>
      <h3 style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, margin: "6px 0 0", color: "var(--text-muted)", overflowWrap: "anywhere" }}>{subject}</h3>
      {seq && seq.count > 1 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {seq.count} messages since {day(seq.first)}. {seq.lastMine ? "You wrote last." : `${who.split(/[\s,]+/)[0]} wrote last.`}
        </p>
      )}

      <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {theirs
          ? <><p style={label}>{theirs.who} wrote, {when(theirs.at)}</p><p style={letter}>{theirs.text}</p></>
          : reading
            ? <><p style={label}>You wrote, {when(messages[messages.length - 1]?.at || 0)}</p><p style={letter}>{messages[messages.length - 1]?.text || decodeEntities(m.preview)}</p></>
            : <><p style={label}>{failed ? "The full message could not be opened. This is how it begins:" : "Opening the message…"}</p><p style={{ ...letter, color: "var(--text-muted)" }}>{decodeEntities(m.preview)}</p></>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        {tab("reply", <Reply size={16} aria-hidden />, "Reply")}
        {tab("history", <History size={16} aria-hidden />, seq && seq.count > 1 ? `History (${seq.count})` : "History")}
        {tab("details", <Phone size={16} aria-hidden />, "Contact and details")}
      </div>

      {panel === "reply" && <div style={{ marginTop: 18 }}>{reply}</div>}

      {panel === "history" && (
        <div style={{ marginTop: 18 }}>
          {!messages.length && <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>{failed ? "The history could not be opened." : "Opening the history…"}</p>}
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((x, i) => {
              const open = opened === x.id
              return (
                <li key={x.id} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                  <button type="button" onClick={() => setOpened(open ? null : x.id)} aria-expanded={open}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "12px 14px", color: "var(--text)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, fontWeight: 650 }}>{i + 1}. {x.mine ? "You" : x.who}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{when(x.at)}</span>
                    </div>
                    {!open && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.text.replace(/\s+/g, " ").slice(0, 160)}</div>}
                  </button>
                  {open && <p style={{ ...letter, fontSize: 14.5, padding: "0 14px 14px" }}>{x.text}</p>}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {panel === "details" && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={label}>Call</p>
            {contacts.phones.length
              ? contacts.phones.map(p => <div key={p.number} style={{ fontSize: 15 }}><a href={`tel:${p.number.replace(/[^\d]/g, "").slice(0, 10)}`} style={{ color: "var(--text)", fontWeight: 650 }}>{p.number}</a> <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.who}</span></div>)
              : <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{reading ? "No phone number in this conversation." : failed ? "Could not be read." : "Looking…"}</div>}
          </div>
          <div>
            <p style={label}>Email</p>
            {(contacts.emails.length ? contacts.emails : [{ email: senderEmail(m.fromEmail), who }]).filter(e => e.email).map(e => (
              <div key={e.email} style={{ fontSize: 15, overflowWrap: "anywhere" }}><a href={`mailto:${e.email}`} style={{ color: "var(--text)", fontWeight: 650 }}>{e.email}</a> <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{e.who}</span></div>
            ))}
          </div>
          <div>
            <p style={label}>About</p>
            <div style={{ fontSize: 14.5, lineHeight: 1.6, overflowWrap: "anywhere" }}>
              <div>{decodeEntities(m.role)}</div>
              {m.rate && <div>Rate named: {m.rate}</div>}
              {m.when && <div>When: {m.when}</div>}
              {m.jdFit != null && <div style={{ color: "var(--text-muted)" }}>Fit with your profile: {m.jdFit}%{m.jdFitWhy && m.jdFitWhy.length ? ` (${m.jdFitWhy.join(", ")})` : ""}</div>}
              <div style={{ color: "var(--text-muted)" }}>In your inbox {myEmail}</div>
              <div><a href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(myEmail)}#all/${encodeURIComponent(m.id)}`} target="_blank" rel="noreferrer" style={{ color: "var(--text)", fontWeight: 650 }}>Open the original in Gmail</a></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
