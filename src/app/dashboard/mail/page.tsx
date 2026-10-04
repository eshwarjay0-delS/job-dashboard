"use client"

import { useState } from "react"
import { Check, Send, Shield, Archive, RotateCcw, ChevronRight, CalendarDays, Leaf } from "lucide-react"
import { Card, Meta, StagePill, Chip, Btn, Avatar, Toggle, useAnswered, useLeaving, leavingStyle } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import { mails, accounts, acct, savedAvailability, type Mail, type Stage } from "../_suite/sample"

type Filter = "needs" | "invite" | "rtr" | "rate" | "pending" | "all"
const FILTERS: [Filter, string][] = [["needs", "Needs you"], ["invite", "Interview invites"], ["rtr", "RTR forms"], ["rate", "Pay rates"], ["pending", "Waiting"], ["all", "All"]]
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const SLOTS = ["09:00", "10:00", "11:00", "11:30", "13:00", "14:00", "15:00", "15:30", "16:00"]
const pretty = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return `${((h! + 11) % 12) + 1}${m ? ":" + String(m).padStart(2, "0") : ""}${h! < 12 ? "am" : "pm"}`
}

function MailRow({ m, on, restored, leaving, onClick }: { m: Mail; on: boolean; restored: boolean; leaving: boolean; onClick: () => void }) {
  const a = acct(m.account)
  return (
    <button type="button" onClick={onClick} aria-current={on ? "true" : undefined}
      style={{
        ...leavingStyle(leaving), width: "100%", textAlign: "left", display: "flex", gap: 12, padding: 12, marginBottom: 6,
        borderRadius: 10, cursor: "pointer", background: on ? "var(--surface-2)" : "var(--surface)",
        border: `1px solid ${on ? "var(--border-strong)" : "var(--border)"}`,
      }}>
      <div style={{ position: "relative" }}>
        <Avatar name={m.from} tint={a.tint} size={38} />
        {m.unread && <span style={{ position: "absolute", right: -1, top: -1, width: 11, height: 11, borderRadius: 10, background: "var(--accent)", border: "2px solid var(--surface)" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: m.unread ? 700 : 600, color: "var(--text)" }}>{m.company}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-soft)", whiteSpace: "nowrap" }}>{m.at}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{m.role}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
          {restored ? <StagePill stage="applied" label="Restored" /> : <StagePill stage={m.stage} />}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: a.tint }} />{a.email.split("@")[0]}
          </span>
        </div>
      </div>
    </button>
  )
}

function AvailabilityReply({ m, onApprove }: { m: Mail; onApprove: () => void }) {
  const [slots, setSlots] = useState<Record<string, string[]>>(savedAvailability)
  const [auto, setAuto] = useState(false)
  const toggle = (d: string, s: string) =>
    setSlots(x => ({ ...x, [d]: x[d]?.includes(s) ? x[d]!.filter(y => y !== s) : [...(x[d] ?? []), s].sort() }))
  const line = WEEK.filter(d => slots[d]?.length).map(d => `${d} ${slots[d]!.map(pretty).join(", ")}`).join(" · ")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Your availability</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pre-filled from last time — click to change</span>
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", background: "var(--surface-2)" }}>
          <div style={{ width: 64 }} />
          {WEEK.map(d => <div key={d} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--text-muted)" }}>{d.toUpperCase()}</div>)}
        </div>
        {SLOTS.map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", height: 38, borderTop: "1px solid var(--border)" }}>
            <div style={{ width: 64, paddingLeft: 12, fontSize: 11.5, color: "var(--text-muted)" }}>{pretty(s)}</div>
            {WEEK.map(d => {
              const on = !!slots[d]?.includes(s)
              return (
                <button key={d} type="button" role="checkbox" aria-checked={on} aria-label={`${d} ${pretty(s)}`} onClick={() => toggle(d, s)}
                  style={{
                    flex: 1, height: 30, margin: "0 2px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: on ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {on && <Check size={13} color="#fff" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderRadius: 10, background: "var(--surface-2)", borderLeft: "3px solid var(--accent)" }}>
        <Meta style={{ marginBottom: 8 }}>Draft reply · from {acct(m.account).email}</Meta>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>
          {`Hi ${m.from.split(" ")[0]},\n\nThank you — I'd be glad to meet the hiring manager. I'm available ${line || "(pick at least one slot)"} (ET). Happy to work around the panel if none of these suit.\n\nBest,\nEshwar`}
        </div>
      </div>
      <Toggle value={auto} onChange={setAuto} label="Send availability replies automatically next time" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onApprove} disabled={!line}><Send size={14} /> Try approving reply</Btn>
      </div>
    </div>
  )
}

function RtrReply({ m, onApprove }: { m: Mail; onApprove: () => void }) {
  const [rate, setRate] = useState("$62/hr C2C")
  const field = (label: string, value: string, onChange?: (v: string) => void) => (
    <label style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
      {label}
      <input value={value} readOnly={!onChange} onChange={e => onChange?.(e.target.value)}
        style={{ height: 36, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13.5, color: "var(--text)", background: onChange ? "var(--surface)" : "var(--surface-2)" }} />
    </label>
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Right to Represent</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{field("Role", m.role)}{field("End client", m.company)}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{field("Your rate", rate, setRate)}{field("Exclusive for", "30 days")}</div>
      <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: 10, background: "var(--surface-2)", fontSize: 13, lineHeight: 1.5 }}>
        <Shield size={17} style={{ flexShrink: 0 }} />
        No other submission to {m.company} found in the last 90 days across your four inboxes.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="outline">Decline</Btn>
        <Btn onClick={onApprove}><Check size={14} /> Preview RTR approval</Btn>
      </div>
    </div>
  )
}

function RateReply({ m, onApprove }: { m: Mail; onApprove: () => void }) {
  const [rate, setRate] = useState("$68/hr")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Confirm the rate</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["$65/hr", "$68/hr", "$70/hr", "$72/hr"].map(r => <Chip key={r} label={`${r} C2C`} active={r === rate} onClick={() => setRate(r)} />)}
      </div>
      <div style={{ padding: 16, borderRadius: 10, background: "var(--surface-2)", borderLeft: "3px solid var(--accent)", fontSize: 13.5, lineHeight: 1.6 }}>
        Hi {m.from.split(" ")[0]}, confirming {rate} on C2C for the {m.role} role. I can start in two weeks. Please go ahead and submit.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="outline">Counter</Btn>
        <Btn onClick={onApprove}><Send size={14} /> Try approving reply</Btn>
      </div>
    </div>
  )
}

export default function MailPage() {
  const [account, setAccount] = useState("all")
  const [filter, setFilter] = useState<Filter>("needs")
  const [sel, setSel] = useState("m1")
  const [showFiled, setShowFiled] = useState(false)
  const [restored, setRestored] = useState<string[]>([])
  const [answered, answer] = useAnswered()
  const [leaving, leave] = useLeaving(answer)

  const waiting = (x: Mail) => !!x.needsReply && !answered.includes(x.id)
  const live = mails.filter(x => (x.stage !== "rejected" || restored.includes(x.id)) && (account === "all" || x.account === account))
  const shown = live.filter(x => filter === "all" ? true : filter === "needs" ? waiting(x) : x.stage === filter)
  const filed = mails.filter(x => x.stage === "rejected" && !restored.includes(x.id))
  const m = shown.find(x => x.id === sel) ?? shown[0]
  const count = (f: Filter) => live.filter(x => f === "all" ? true : f === "needs" ? waiting(x) : x.stage === (f as Stage)).length

  const approve = (id: string) => {
    const nextUp = shown.find(x => x.id !== id && !leaving.includes(x.id) && waiting(x))
    if (nextUp) setSel(nextUp.id)
    leave(id)
  }

  return (
    <div>
      <PageIntro page="/dashboard/mail" action={{ label: "Answer the first one", href: "#reply" }} sample="Preview with sample messages. Changes stay in this browser session; no email is sent or signed." />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Chip label="All inboxes" active={account === "all"} onClick={() => setAccount("all")} />
        {accounts.map(a => (
          <Chip key={a.id} active={account === a.id} disabled={!a.connected} onClick={() => setAccount(a.id)}
            label={<><span style={{ width: 8, height: 8, borderRadius: 10, background: a.tint }} />{a.email.split("@")[0]}<span style={{ opacity: 0.6, fontWeight: 500 }}>{a.connected ? a.label : "Not connected"}</span></>} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTERS.map(([f, label]) => <Chip key={f} label={label} active={filter === f} onClick={() => setFilter(f)} count={count(f)} />)}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 400px", minWidth: 300 }}>
          {shown.map(x => (
            <MailRow key={x.id} m={x} on={x.id === m?.id} restored={restored.includes(x.id)} leaving={leaving.includes(x.id)} onClick={() => setSel(x.id)} />
          ))}
          {!shown.length && (
            <div style={{ padding: 24, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 10, color: "var(--text-muted)", fontSize: 13 }}>
              <Leaf size={18} style={{ marginBottom: 6 }} /><div style={{ fontWeight: 700, color: "var(--text)" }}>Nothing waiting here</div>
              Every thread in this view is answered or scheduled.
            </div>
          )}

          <div style={{ marginTop: 8, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setShowFiled(!showFiled)} aria-expanded={showFiled}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 12, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <Archive size={16} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650 }}>{filed.length ? `${filed.length} rejection${filed.length === 1 ? "" : "s"} filed automatically` : "No rejections filed"}</div>
                {filed.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{filed.map(a => a.company).join(", ")} — moved to Rejected in the tracker</div>}
              </div>
              <ChevronRight size={16} style={{ transform: showFiled ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
            </button>
            {showFiled && (
              <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
                {filed.map(a => (
                  <div key={a.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.company} · {a.role}</span>
                      <Btn variant="ghost" onClick={() => setRestored(xs => [...xs, a.id])}><RotateCcw size={13} /> Restore</Btn>
                    </div>
                    <blockquote style={{ margin: "4px 0 0", padding: "6px 10px", borderLeft: "2px solid var(--border-strong)", fontSize: 12.5, fontStyle: "italic", color: "var(--text-muted)" }}>
                      “{a.trigger ?? a.preview}”
                      <div style={{ fontStyle: "normal", fontSize: 11.5, color: "var(--text-soft)", marginTop: 2 }}>Filed because this line matched · {a.fromEmail} · {a.at}</div>
                    </blockquote>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {m && (
          <Card id="reply" style={{ flex: "1 1 420px", minWidth: 320, scrollMarginTop: 24 }}>
            <div key={m.id}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar name={m.from} tint={acct(m.account).tint} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>{m.company}</h2>
                    {restored.includes(m.id) ? <StagePill stage="applied" label="Restored" /> : <StagePill stage={m.stage} />}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.from} · {m.fromEmail} → {acct(m.account).email}</div>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{m.at}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 650, marginTop: 20 }}>{m.subject}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)", margin: "6px 0 0" }}>{m.preview}</p>
              {m.when && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, padding: 12, borderRadius: 10, background: "var(--surface-2)", fontSize: 13.5, fontWeight: 600 }}>
                  <CalendarDays size={16} /> {m.when} — on your interview calendar
                </div>
              )}
              <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
              {!waiting(m) || leaving.includes(m.id) ? (
                <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: 10, background: "var(--surface-2)", fontSize: 13, lineHeight: 1.5 }}>
                  <Check size={16} style={{ flexShrink: 0 }} />
                  {answered.includes(m.id) || leaving.includes(m.id)
                    ? "Reply approved and sent. The follow-up workflow picks it up from here."
                    : restored.includes(m.id)
                      ? "Restored from Rejected. It stays in your inbox and the tracker until you file it again."
                      : "No reply needed. The follow-up workflow checks in on Monday and Thursday at 10:00 AM if nothing changes."}
                </div>
              ) : m.needsReply === "availability" ? <AvailabilityReply m={m} onApprove={() => approve(m.id)} />
                : m.needsReply === "rtr" ? <RtrReply m={m} onApprove={() => approve(m.id)} />
                : <RateReply m={m} onApprove={() => approve(m.id)} />}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
