"use client"
import TypingDots from "../_components/typing-dots"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Check, Send, Shield, Archive, RotateCcw, ChevronRight, CalendarDays, Leaf, History, ArrowRight } from "lucide-react"
import { Card, Meta, Chip, Btn, Toggle, useAnswered, useLeaving } from "../_suite/ui"
import SmartReply from "./_components/smart-reply"
import MailRow from "./_components/mail-row"
import ReadingPane from "./_components/reading-pane"
import { savedAvailability, type Mail } from "../_suite/sample"
import { useGmailData, buildAccounts, makeAcct } from "@/lib/use-gmail-data"

import IgnoreControls from "./_components/ignore-controls"
import { ignoreReason, type IgnoreRule } from "@/lib/gmail-ignore"

type Filter = "needs" | "invite" | "rtr" | "rate" | "pending" | "all"
const FILTERS: [Filter, string][] = [["needs", "Needs you"], ["invite", "Interview invites"], ["rtr", "RTR forms"], ["rate", "Pay rates"], ["pending", "Waiting"], ["all", "All"]]
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const SLOTS = ["09:00", "10:00", "11:00", "11:30", "13:00", "14:00", "15:00", "15:30", "16:00"]
const pretty = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return `${((h! + 11) % 12) + 1}${m ? ":" + String(m).padStart(2, "0") : ""}${h! < 12 ? "am" : "pm"}`
}

type AcctFn = (id: string) => { tint: string; email: string }

function JdFitPill({ score, why }: { score?: number; why?: string[] }) {
  if (score == null) return null
  const color = score >= 60 ? "var(--success)" : score >= 30 ? "var(--accent-txt)" : "var(--text-muted)"
  const bg = score >= 60 ? "var(--success-soft)" : score >= 30 ? "var(--accent-soft)" : "var(--surface-2)"
  return (
    <span title={why?.length ? `Matched: ${why.join(", ")}` : "Role fit"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: bg, color }}>
      {score}% fit
    </span>
  )
}

// The row itself is _components/mail-row.tsx: one line each for who, what about, how it begins.
const rowProps = (m: Mail, acct: AcctFn) => { const a = acct(m.account); return { tint: a.tint, inbox: a.email.split("@")[0] || a.email } }

function AvailabilityReply({ m, onApprove, acct }: { m: Mail; onApprove: () => void; acct: AcctFn }) {
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

/* ── Role aggregation: Gmail's essence, organized ───────────────────────────
   One role = one card. Every vendor chain touching the same posting lives
   inside it, with rates side by side. This is where duplicate submissions
   get caught at a glance. */

interface RoleGroup {
  key: string
  label: string
  req: string | null
  mails: Mail[]
  vendors: string[]
  rates: string[]
  fit: number | null
  unread: number
  latestAt: string
}

function domainOf(email: string): string {
  const m = (email || "").match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return m ? m[1].toLowerCase() : (email || "").toLowerCase()
}

function roleKeyFor(m: Mail): string {
  const hay = `${m.subject} ${m.role}`
  const req = hay.match(/(?:req|posting|position|job)[\s#:]*(\d{4,7})/i)
  if (req) return `req:${req[1]}`
  const t = (m.role || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
  return `role:${t.slice(0, 50) || m.company.toLowerCase().slice(0, 40)}`
}

function groupByRole(mails: Mail[]): RoleGroup[] {
  const map = new Map<string, Mail[]>()
  for (const m of mails) {
    const k = roleKeyFor(m)
    if (!map.get(k)) map.set(k, [])
    map.get(k)!.push(m)
  }
  const groups: RoleGroup[] = []
  for (const [key, ms] of map) {
    const req = key.startsWith("req:") ? key.slice(4) : null
    const vendors = [...new Set(ms.map(m => domainOf(m.fromEmail)).filter(Boolean))]
    const rates = [...new Set(ms.map(m => m.rate).filter(Boolean) as string[])]
    const fits = ms.map(m => m.jdFit).filter((f): f is number => f != null)
    const label = req
      ? (ms.find(m => m.role)?.role || ms[0].subject.slice(0, 50))
      : (ms.find(m => m.role)?.role || ms[0].company)
    groups.push({
      key, label, req, mails: ms, vendors, rates,
      fit: fits.length ? Math.max(...fits) : null,
      unread: ms.filter(m => m.unread).length,
      latestAt: ms[0].at,
    })
  }
  // Most chains first, then most mail
  groups.sort((a, b) => b.vendors.length - a.vendors.length || b.mails.length - a.mails.length)
  return groups
}

function RoleCard({ group, onOpen, acct }: { group: RoleGroup; onOpen: (id: string) => void; acct: AcctFn }) {
  const [open, setOpen] = useState(false)
  const multi = group.vendors.length > 1
  return (
    <article style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
      boxShadow: "var(--shadow-card)", overflow: "hidden",
    }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.015em" }}>{group.label}</h3>
              {group.req && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 999 }}>
                  req {group.req}
                </span>
              )}
              {multi && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--danger)", background: "var(--surface-2)", border: "1px solid var(--danger-border)", padding: "3px 8px", borderRadius: 999 }}>
                  {group.vendors.length} vendors — pick one
                </span>
              )}
              {group.unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-txt)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", padding: "3px 8px", borderRadius: 999 }}>
                  {group.unread} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              {group.vendors.map(v => {
                const vm = group.mails.find(m => domainOf(m.fromEmail) === v)
                return (
                  <span key={v} style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    <strong style={{ color: "var(--text)", fontWeight: 650 }}>{v}</strong>
                    {vm?.rate ? ` · ${vm.rate}` : ""}
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
            {group.fit != null && <JdFitPill score={group.fit} />}
            <span style={{ fontSize: 11.5, color: "var(--text-soft)" }}>{group.mails.length} email{group.mails.length === 1 ? "" : "s"}</span>
            <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", color: "var(--text-muted)" }} />
          </div>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px 12px" }}>
          {group.mails.map(m => (
            <MailRow key={m.id} m={m} on={false} restored={false} leaving={false}
              onClick={() => onOpen(m.id)} {...rowProps(m, acct)} />
          ))}
        </div>
      )}
    </article>
  )
}

type View = "needs" | "roles" | "all" | "drafts" | "waiting"

export default function MailPage() {
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [showIgnored, setShowIgnored] = useState(false)
  const [tidying, setTidying] = useState(false)   // the tick boxes and the ignore controls, shown only while tidying
  const [ignoreError, setIgnoreError] = useState("")
  useEffect(() => {
    let active = true
    fetch("/api/gmail/ignore-rules").then(r => r.json()).then(j => { if (!active) return; if (j.ok) setIgnoreRules(j.rules); else setIgnoreError(j.error) }).catch(() => { if (active) setIgnoreError("Ignore preferences could not be loaded") })
    return () => { active = false }
  }, [])
  async function saveIgnoreRules(rules: IgnoreRule[]) {
    const res = await fetch("/api/gmail/ignore-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "Could not save")
    setIgnoreRules(data.rules); setSelected([])
  }
  const [account, setAccount] = useState("all")
  const [view, setView] = useState<View>("needs")
  const [sel, setSel] = useState<string | null>(null)
  const [showFiled, setShowFiled] = useState(false)
  const [restored, setRestored] = useState<string[]>([])
  const [answered, answer] = useAnswered()
  const [leaving, leave] = useLeaving(answer)

  // ── Live Gmail data ────────────────────────────────────────────────────
  const { mails, loading, connected, error, refresh, drafts, radar } = useGmailData()
  const accounts = buildAccounts(mails.map(m => m.account))
  const acct = makeAcct(accounts)

  const waiting = (x: Mail) => !!x.needsReply && !answered.includes(x.id)
  const live = mails.filter(x => (!!ignoreReason(x, ignoreRules) === showIgnored) && (x.stage !== "rejected" || restored.includes(x.id)) && (account === "all" || x.account === account))
  const needsList = live.filter(waiting)
  const filed = mails.filter(x => x.stage === "rejected" && !restored.includes(x.id))
  const roles = groupByRole(live.filter(x => x.stage !== "rejected"))

  const shown = showIgnored ? live : view === "needs" ? needsList : live
  const m = shown.find(x => x.id === sel) ?? shown[0]

  const VIEWS: [View, string, number][] = [
    ["needs", "Needs you", needsList.length],
    ["roles", "By role", roles.length],
    ["all", "All mail", live.length],
    ["drafts", "Drafts", drafts.length],
    ["waiting", "Waiting", radar.length],
  ]

  const approve = (id: string) => {
    const nextUp = shown.find(x => x.id !== id && !leaving.includes(x.id) && waiting(x))
    if (nextUp) setSel(nextUp.id)
    leave(id)
  }

  const openMail = (id: string) => {
    setSel(id)
    setView("all")
    setTimeout(() => document.getElementById("reply")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  const needsCount = needsList.length

  return (
    <div className="mf-home" style={{ paddingBottom: 56 }}>
      <header className="mf-home-heading">
        <p className="mf-eyebrow">INBOX</p>
        <h1>Your job mail, organized.</h1>
        <p>
          {!connected
            ? "Connect Gmail and your recruiter emails land here — grouped by role, fit-scored, with drafts and follow-ups in view."
            : loading
              ? "Reading your inboxes…"
              : needsCount === 0
                ? "Nothing needs you right now. Everything below is sorted and waiting."
                : `${needsCount} ${needsCount === 1 ? "email needs" : "emails need"} your reply — start at the top.`}
        </p>
      </header>

      {error && !loading && (
        <div style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 12, border: "1px solid var(--danger-border)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, lineHeight: 1.55 }}>{error}</div>
          <button className="btn-outline" style={{ minHeight: 38 }} onClick={refresh}>Refresh</button>
          <Link href="/dashboard/connections" style={{ fontSize: 13, fontWeight: 700 }}>Check connections →</Link>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          <TypingDots label="Reading your inboxes…" />
        </div>
      ) : !connected ? (
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, letterSpacing: "-0.02em" }}>Connect Gmail to fill this up</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14.5, maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.65 }}>
            Your emails group themselves by role here — every vendor chain side by side, fit-scored, with reply drafts one tap away.
          </p>
          <Link href="/dashboard/connections" className="btn-accent" style={{ minHeight: 46, padding: "0 26px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700 }}>
            Connect Gmail <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </Link>
        </section>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip label="All inboxes" active={account === "all"} onClick={() => setAccount("all")} />
            {accounts.map(a => (
              <Chip key={a.id} active={account === a.id} disabled={!a.connected} onClick={() => setAccount(a.id)}
                label={<><span style={{ width: 8, height: 8, borderRadius: 10, background: a.tint }} />{a.email.split("@")[0]}{(!a.connected || (a.label && a.label !== a.email.split("@")[0])) && <span style={{ opacity: 0.6, fontWeight: 500 }}>{a.connected ? a.label : "Not connected"}</span>}</>} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: tidying || showIgnored ? 10 : 20 }}>
            {VIEWS.map(([v, label, n]) => (
              <Chip key={v} label={label} active={view === v} onClick={() => setView(v)} count={n} />
            ))}
            {/* Hiding senders is a chore, not the page. It waits behind one quiet button, and so do the tick boxes. */}
            <button type="button" className="btn-ghost" aria-expanded={tidying || showIgnored} onClick={() => { if (tidying || showIgnored) { setTidying(false); setShowIgnored(false); setSelected([]) } else { setTidying(true); if (view !== "needs" && view !== "all") setView("all") } }}
              style={{ marginLeft: "auto", minHeight: 40, padding: "0 14px", fontSize: 14 }}>
              {tidying || showIgnored ? "Done tidying" : "Tidy up"}
            </button>
          </div>
          {(tidying || showIgnored) && (
            <>
              <IgnoreControls mails={mails} selected={selected} rules={ignoreRules} onSave={saveIgnoreRules} showIgnored={showIgnored} onToggle={() => { setShowIgnored(v => !v); setView("all") }} />
              {ignoreError && <p role="status" style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 12px" }}>{ignoreError}</p>}
            </>
          )}

          {view === "roles" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {roles.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  No roles found in the last 30 days.
                </div>
              )}
              {roles.map(g => <RoleCard key={g.key} group={g} onOpen={openMail} acct={acct} />)}
            </div>
          ) : view === "drafts" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drafts.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  No unsent drafts. Replies you start in the inbox land here.
                </div>
              )}
              {drafts.map(d => (
                <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--shadow-card)" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{d.subject}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    to {(d.to || "").split("<")[0].trim() || "—"} · {d.snippet.slice(0, 100)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 8 }}>Open Gmail drafts to review and send — nothing sends from here on its own.</div>
                </div>
              ))}
            </div>
          ) : view === "waiting" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {radar.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  Nobody owes you a reply.
                </div>
              )}
              {radar.map(r => (
                <div key={r.threadId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--shadow-card)", display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", color: r.daysWaiting >= 10 ? "var(--danger)" : "var(--accent-txt)", minWidth: 54 }}>
                    {r.daysWaiting}d
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                      {(r.vendor || r.to || "").split("<")[0].trim().slice(0, 40)}{r.jobTitle ? ` · ${r.jobTitle}` : ""}
                    </div>
                  </div>
                  <button className="btn-outline" style={{ minHeight: 38, flex: "none" }} onClick={() => openMail(r.threadId)}>Open</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "0 1 400px", minWidth: 300 }}>
                {shown.map(x => (
                  <div key={`${x.account}:${x.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {(tidying || showIgnored) && (
                      <input type="checkbox" aria-label={`Select ${x.subject}`} checked={selected.includes(`${x.account}:${x.id}`)} onChange={e => setSelected(ids => e.target.checked ? [...ids, `${x.account}:${x.id}`] : ids.filter(id => id !== `${x.account}:${x.id}`))}
                        style={{ width: 18, height: 18, marginTop: 22, flex: "none", accentColor: "var(--accent)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}><MailRow m={x} on={x.id === m?.id} restored={restored.includes(x.id)} leaving={leaving.includes(x.id)} onClick={() => setSel(x.id)} {...rowProps(x, acct)} />
                    {showIgnored && (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "-2px 0 10px 4px", fontSize: 12.5, color: "var(--text-muted)" }}>
                        <span>{ignoreReason(x, ignoreRules)}</span>
                        <button type="button" className="btn-ghost" style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }} onClick={() => saveIgnoreRules([...ignoreRules.filter(r => !(r.account === x.account && r.kind === "thread" && r.value === x.id)), { account: x.account.toLowerCase(), kind: "thread", value: x.id, action: "allow" }]).catch(e => setIgnoreError(String(e)))}>Bring it back</button>
                      </div>
                    )}</div>
                  </div>
                ))}
                {!shown.length && (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                    <Leaf size={18} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                      {view === "needs" ? "Nothing needs you" : "Nothing here"}
                    </div>
                    {view === "needs" ? "Every thread is answered or scheduled." : live.length === 0 ? (
                      <span>No job emails in the last 30 days on the connected account{accounts.length > 1 ? "s" : ""}. <Link href="/dashboard/connections" style={{ fontWeight: 700, color: "var(--text)" }}>Connect your main inbox →</Link></span>
                    ) : "Try another view."}
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
                  {/* Read first: who, what about, what they wrote. Reply, the history and the contact details each wait behind
                      one button (_components/reading-pane.tsx). The reply tools are the same ones as before; they were all on
                      screen at once, under a snippet, with the email itself nowhere on the page. */}
                  <ReadingPane key={`${m.account}:${m.id}`} m={m} myEmail={acct(m.account).email} tint={acct(m.account).tint} restored={restored.includes(m.id)}
                    reply={
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {(answered.includes(m.id) || leaving.includes(m.id) || restored.includes(m.id) || m.when) && (
                          <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: 10, background: "var(--surface-2)", fontSize: 13.5, lineHeight: 1.5 }}>
                            {m.when && !answered.includes(m.id) && !leaving.includes(m.id) ? <CalendarDays size={16} style={{ flexShrink: 0 }} /> : <Check size={16} style={{ flexShrink: 0 }} />}
                            {answered.includes(m.id) || leaving.includes(m.id)
                              ? "Reply approved and sent. The follow-up workflow picks it up from here."
                              : restored.includes(m.id)
                                ? "Restored from Rejected. It stays in your inbox and the tracker until you file it again."
                                : `${m.when} is on your interview calendar.`}
                          </div>
                        )}
                        {!leaving.includes(m.id) && <SmartReply mail={m} onSent={() => approve(m.id)} />}
                        {/* The three sample forms that used to sit here (AvailabilityReply, RtrReply, RateReply, still defined
                            above) are no longer shown. They sent nothing ("Preview", "Try approving"), filled "End client"
                            with the sender's own name, and said "No other submission found in the last 90 days across your
                            four inboxes" without that check being made. The suggested replies above are the real ones: they
                            cover availability, the RTR and the rate, and they send. */}
                      </div>
                    } />
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
