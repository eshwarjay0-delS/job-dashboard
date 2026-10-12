"use client"

// Overview — every submission as a mind map and a progress bar.
// Two tables: "Submission progress" (submitted RTRs moving forward) and "Waiting to
// board" (RTRs and rate confirmations with no submission yet). Every row has a
// View button that opens the submission's mind map: who touched the profile,
// in what order, where it stands, and what is next.

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { TrainFront, Eye, X, ArrowDown, FileText, Download } from "lucide-react"
import { Card } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import TypingDots from "../_components/typing-dots"
import { gmailEvidenceUrl } from "@/lib/application-evidence"
import type { ApplicationChain, ChainStageKey, ChainEventKind } from "@/app/api/gmail/_lib"

const STAGES: Array<{ key: ChainStageKey; label: string }> = [
  { key: "rtr", label: "RTR" },
  { key: "submitted", label: "Submitted" },
  { key: "client", label: "With client" },
  { key: "interview", label: "Interview" },
  { key: "decision", label: "Decision" },
]

const fmtDate = (ts?: number) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"

// ── Horizontal train-track progress bar ────────────────────────────────────
function TrackBar({ chain }: { chain: ApplicationChain }) {
  const currentIdx = chain.terminal ? STAGES.length - 1 : STAGES.findIndex(s => s.key === chain.current)
  const doneIdx = Math.max(0, currentIdx)
  // All dots share one baseline: the track line is absolutely positioned at the
  // dot center, so alignment can never drift regardless of dot size or label.
  const DOT = 12
  const TOP = 6
  return (
    <div style={{ position: "relative", paddingTop: TOP }} aria-label={`At ${STAGES[doneIdx]?.label}`}>
      <div style={{ position: "absolute", top: TOP + DOT / 2 - 1, left: 16, right: 16, height: 2, background: "var(--border)", borderRadius: 2 }} />
      <div style={{
        position: "absolute", top: TOP + DOT / 2 - 1, left: 16, height: 2, borderRadius: 2,
        width: `calc(${(doneIdx / (STAGES.length - 1)) * 100}% - ${32 * (doneIdx / (STAGES.length - 1))}px)`,
        background: "var(--border)",
      }} />
      <div style={{ position: "relative", display: "flex" }}>
        {STAGES.map((s, i) => {
          const reached = !!chain.stops.find(stop => stop.key === s.key)?.reached
          const isCurrent = reached && i === doneIdx && !chain.terminal
          const terminal = chain.terminal && i === STAGES.length - 1
          return (
            <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
              <div style={{
                width: DOT, height: DOT, borderRadius: "50%", flex: "none", position: "relative", zIndex: 1,
                background: terminal ? (chain.terminal === "offer" ? "var(--success)" : "var(--danger)")
                  : reached ? "var(--accent)" : "var(--surface)",
                border: reached && !terminal ? "none" : `2px solid ${reached ? "var(--accent)" : "var(--border-strong)"}`,
                boxShadow: isCurrent ? "0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent)" : "none",
              }} />
              <span style={{
                fontSize: 9.5, color: reached ? "var(--text)" : "var(--text-muted)",
                fontWeight: reached ? 700 : 400, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
              }}>
                {terminal ? (chain.terminal === "offer" ? "Offer" : "Rejected") : chain.stops.find(stop => stop.key === s.key)?.label || s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface HopFile { filename: string; messageId: string; attachmentId: string; from: string; date: string }

const EVENT_DOT: Record<ChainEventKind, string> = {
  first_contact: "var(--text-muted)",
  rtr_request: "#b3541e",
  rtr_signed: "#2f6f6a",
  resume_sent: "#2f6f6a",
  rate: "#8a6d1b",
  submitted: "var(--accent)",
  client: "var(--accent)",
  interview_request: "#6d4fa3",
  interview_scheduled: "#6d4fa3",
  followup: "#a3a099",
  response: "var(--text-muted)",
  note: "var(--text-muted)",
  offer: "var(--success)",
  rejection: "var(--danger)",
}

// ── Mind map: the people who carried the profile, in order ─────────────────
function MindMap({ chain, onClose }: { chain: ApplicationChain; onClose: () => void }) {
  const [files, setFiles] = useState<HopFile[]>([])
  useEffect(() => {
    Promise.all((chain.sourceThreadIds || [chain.threadId]).map(id => fetch(`/api/gmail/chain-attachments?threadId=${encodeURIComponent(id)}&account=${encodeURIComponent(chain.accountEmail)}`, { cache: "no-store" }).then(r => r.json())))
      .then(results => ({ ok: results.every(j => j.ok), messages: results.flatMap(j => j.messages || []) }))
      .then(j => {
        if (!j.ok) return
        const out: HopFile[] = []
        for (const m of j.messages || []) {
          for (const a of m.attachments || []) {
            out.push({ filename: a.filename, messageId: a.messageId, attachmentId: a.attachmentId, from: m.from, date: m.date })
          }
        }
        setFiles(out)
      })
      .catch(() => {})
  }, [chain.threadId, chain.accountEmail])

  // Files ride on the exact email that carried them.
  const filesForEvent = (messageId: string): HopFile[] => files.filter(f => f.messageId === messageId)
  return (
    <div style={{ width: "100%" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%",
        background: "var(--surface)", borderRadius: "22px 22px 0 0",
        borderTop: "1px solid var(--border-strong)",
        padding: "14px 22px calc(22px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--border-strong)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase" }}>
              Application evidence map
            </div>
            <h2 style={{ margin: "6px 0 2px", fontSize: 20 }}>{chain.company}</h2>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{chain.role}{chain.rate ? ` · ${chain.rate}` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "var(--surface-2)", borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--text-muted)", flex: "none" }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ margin: "14px 0" }}>
          <TrackBar chain={chain} />
        </div>

        {/* The numbers behind it: emails, people, days to interview */}
        {chain.journey && (
          <div style={{
            display: "flex", gap: 14, flexWrap: "wrap", margin: "10px 0 4px",
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "10px 14px",
          }}>
            <span style={{ fontSize: 13 }}><strong>{chain.journey.emails}</strong> <span style={{ color: "var(--text-muted)" }}>emails</span></span>
            <span style={{ fontSize: 13 }}><strong>{chain.journey.people}</strong> <span style={{ color: "var(--text-muted)" }}>people</span></span>
            {chain.journey.daysToInterview !== undefined && (
              <span style={{ fontSize: 13 }}><strong>{chain.journey.daysToInterview}</strong> <span style={{ color: "var(--text-muted)" }}>days to interview</span></span>
            )}
          </div>
        )}

        {/* People & contacts */}
        {chain.contacts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 8 }}>
              People involved
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {chain.contacts.map(ct => (
                <div key={ct.email || ct.name} style={{
                  border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px",
                  display: "flex", gap: 10, alignItems: "center", background: "var(--surface)",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flex: "none",
                    background: "var(--accent-soft)", color: "var(--accent-txt)",
                    display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13,
                  }}>
                    {ct.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ct.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ct.email}{ct.phone ? ` · ${ct.phone}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-soft)", flex: "none" }}>{ct.emails} mail{ct.emails === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step by step: every email, in order, who passed to whom */}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", margin: "14px 0 4px" }}>
          Every step, in order
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 4 }}>
          {chain.events.map((e, i) => (
            <div key={`${e.messageId}-${i}`} style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 20 }}>
                <div style={{
                  width: 11, height: 11, borderRadius: "50%", marginTop: 4, flex: "none",
                  background: EVENT_DOT[e.kind] || "var(--text-muted)",
                  boxShadow: e.handoffFrom ? "0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
                }} />
                {i < chain.events.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 14, background: "var(--border)", borderRadius: 2 }} />
                )}
              </div>
              <div style={{ paddingBottom: 14, minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{e.label}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{fmtDate(e.at)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
                  {e.isMe ? "You" : e.from}{e.handoffFrom ? <span> · handed off by {e.handoffFrom}</span> : null}
                  {e.detail ? <span> — {e.detail}</span> : null}
                  <a href={gmailEvidenceUrl(chain.accountEmail, e.messageId)} target="_blank" rel="noreferrer" style={{ display: "block", color: "var(--accent)" }}>Open source email</a>
                </div>
                {e.mentions.length > 0 && (
                  <div style={{ fontSize: 11.5, color: "var(--text-soft)", marginTop: 2 }}>
                    Named: {e.mentions.join(", ")}
                  </div>
                )}
                {filesForEvent(e.messageId).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {filesForEvent(e.messageId).map(f => (
                      <a
                        key={`${f.messageId}-${f.attachmentId}`}
                        href={`/api/gmail/attachment?messageId=${encodeURIComponent(f.messageId)}&attachmentId=${encodeURIComponent(f.attachmentId)}&filename=${encodeURIComponent(f.filename)}&account=${encodeURIComponent(chain.accountEmail)}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 12, fontWeight: 650, color: "var(--accent-txt)",
                          background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
                          borderRadius: 999, padding: "5px 11px", textDecoration: "none",
                        }}
                      >
                        <FileText size={12} /> {f.filename.length > 28 ? f.filename.slice(0, 26) + "…" : f.filename} <Download size={11} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {chain.terminal || chain.current === "interview" || chain.current === "decision" ? null : (
            <div>
              <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                <ArrowDown size={16} style={{ color: "var(--text-muted)" }} />
              </div>
              <div style={{
                border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "12px 14px",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <TrainFront size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
                <div style={{ fontSize: 13.5 }}>
                  <div style={{ fontWeight: 700 }}>Next: {chain.nextAction}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                    Last documented recipient: {chain.holder}{chain.stalledDays > 0 ? ` · quiet ${chain.stalledDays}d` : ""}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <p style={{ padding: 12, border: "1px dashed var(--border)", fontSize: 13 }}>Open circles mean no evidence found. People appearing in the same conversation do not by themselves prove a profile handoff. Interview attendance remains unconfirmed.</p>
        {/* Stage evidence */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 8 }}>
            Milestones
          </div>
          {chain.stops.filter(s => s.reached).map(s => (
            <div key={s.key} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ fontWeight: 700, flex: "none", minWidth: 88 }}>{s.label}</span>
              <span style={{ color: "var(--text-muted)" }}>{fmtDate(s.at)}{s.evidence ? ` · ${s.evidence}` : ""}{s.messageId && <> · <a href={gmailEvidenceUrl(chain.accountEmail, s.messageId)} target="_blank" rel="noreferrer">Source email</a></>}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function ChainRow({ chain, onView }: { chain: ApplicationChain; onView: () => void }) {
  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{chain.company}</div>
          <div style={{ fontSize: 12 }}>{chain.accountEmail}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>
            {chain.role}{chain.rate ? ` · ${chain.rate}` : ""}
          </div>
          {chain.latestProgress && <div style={{ fontSize: 13, marginTop: 8, padding: 10, background: "var(--surface-2)", borderRadius: 8 }}>
            <strong>{chain.latestProgress.label}</strong> · {fmtDate(chain.latestProgress.at)}
            <div>{chain.latestProgress.quote}</div>
            <div>Reported destination: {chain.holder} · <a href={gmailEvidenceUrl(chain.accountEmail, chain.latestProgress.messageId)} target="_blank" rel="noreferrer">Source email</a></div>
          </div>}
          {chain.stalledDays >= 7 && !chain.terminal && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 3, fontWeight: 600 }}>
              Quiet {chain.stalledDays}d — recipient: {chain.holder}
            </div>
          )}
          {/* The pattern at a glance: numbers + who, no tap needed */}
          {chain.journey && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {chain.journey.emails} emails · {chain.journey.people} {chain.journey.people === 1 ? "person" : "people"}
              {chain.journey.daysToInterview !== undefined ? ` · ${chain.journey.daysToInterview}d to interview` : ""}
            </div>
          )}
          {chain.contacts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
              {chain.contacts.slice(0, 4).map(ct => (
                <span key={ct.email || ct.name} title={ct.email || ct.name} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11.5, fontWeight: 600, color: "var(--text)",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 999, padding: "4px 10px", maxWidth: "100%",
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", flex: "none",
                    background: "var(--accent-soft)", color: "var(--accent-txt)",
                    display: "grid", placeItems: "center", fontWeight: 800, fontSize: 10,
                  }}>
                    {ct.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ct.name}
                  </span>
                </span>
              ))}
              {chain.contacts.length > 4 && (
                <span style={{ fontSize: 11.5, color: "var(--text-soft)", alignSelf: "center" }}>
                  +{chain.contacts.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button" onClick={onView}
          style={{
            display: "flex", alignItems: "center", gap: 6, flex: "none",
            border: "1px solid var(--border-strong)", background: "var(--surface)",
            borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", color: "var(--text)",
          }}
        >
          <Eye size={14} /> View
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <TrackBar chain={chain} />
      </div>
    </div>
  )
}

function OverviewInner() {
  const params = useSearchParams()
  const router = useRouter()
  const account = params.get("account") || ""
  const [accounts, setAccounts] = useState<string[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [chains, setChains] = useState<ApplicationChain[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState("")
  const [error, setError] = useState("")
  const [viewId, setViewId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setScanning(true)
    setChains([])
    setIssues([])
    setError("")
    setScanStatus("Reading submission evidence from Gmail…")
    async function scan() {
      const byAccount = new Map<string, ApplicationChain[]>()
      const discovery = await fetch("/api/gmail/application-chains?accountsOnly=1", { cache: "no-store", signal: controller.signal })
      const connections = await discovery.json()
      if (!discovery.ok || !connections.ok) throw new Error(connections.error || "Could not load connected inboxes")
      if (!active) return
      setAccounts(connections.accounts || [])
      const pending: string[] = account ? [account] : connections.accounts || []
      const failures = new Map<string, string>()
      let scanned = 0
      // Read important progress from every inbox before backfilling the rest.
      for (const phase of ["progress", "history"]) {
        for (const selected of pending) {
          if (!active) return
          if (failures.has(selected)) continue
          let token: string | null = null
          const seen = new Set<string>()
          try {
            do {
              const query = new URLSearchParams({ days: "90", scan: "1", account: selected, phase })
              if (token) query.set("pageToken", token)
              const response = await fetch(`/api/gmail/application-chains?${query}`, { cache: "no-store", signal: controller.signal })
              const j = await response.json()
              if (!active) return
              if (!response.ok || !j.ok) throw new Error(j.error || "Could not read history")
              byAccount.set(selected, j.chains || [])
              setChains([...byAccount.values()].flat())
              setLoading(false)
              scanned += j.scanned || 0
              token = j.nextPageToken || null
              if (token && seen.has(token)) throw new Error("Gmail repeated a history page")
              if (token) seen.add(token)
              setScanStatus(`Reading ${selected}: ${scanned} conversation checks. Older updates are still loading.`)
            } while (token && active)
          } catch (e) {
            if (!active) return
            failures.set(selected, `${selected}: ${e instanceof Error ? e.message : "Could not read history"}. History is incomplete. Refresh to retry.`)
            setIssues([...failures.values()])
          }
        }
      }
      if (active) setScanStatus(failures.size
        ? `History incomplete for ${failures.size} inboxes. ${scanned} conversation checks completed.`
        : `History scan finished for ${pending.length} inboxes. ${scanned} conversation checks completed.`)
    }
    scan().catch(e => { if (active) { setIssues([`History scan stopped before completion: ${e.message}. Refresh history to retry.`]); setScanStatus("History incomplete. Displayed stages may change as more emails are read.") } })
      .finally(() => { if (active) { setLoading(false); setScanning(false) } })
    return () => { active = false; controller.abort() }
  }, [account, refreshKey])

  // Deep link: /dashboard/overview?chain=<threadId> opens that mind map.
  useEffect(() => {
    const id = params.get("chain")
    setViewId(id)
  }, [params])

  const { rails, waiting } = useMemo(() => {
    const rails: ApplicationChain[] = []
    const waiting: ApplicationChain[] = []
    for (const c of chains) {
      if (!c.stops.some(s => s.key !== "rtr" && s.reached)) waiting.push(c)
      else rails.push(c)
    }
    const byActivity = (a: ApplicationChain, b: ApplicationChain) => (b.lastActivity || 0) - (a.lastActivity || 0)
    rails.sort(byActivity)
    waiting.sort(byActivity)
    return { rails, waiting }
  }, [chains])

  const viewing = viewId ? chains.find(c => (c.threadId === viewId || c.sourceThreadIds?.includes(viewId)) && (!account || c.accountEmail === account)) || null : null
  const interviews = chains.filter(c => c.stops.some(s => s.key === "interview" && s.reached)).length

  if (viewing && !loading) return <><p role="status">{scanStatus}</p>{issues.map(issue => <p key={issue} role="alert">{issue}</p>)}<MindMap chain={viewing} onClose={() => router.push(`/dashboard/overview?account=${encodeURIComponent(viewing.accountEmail)}`)} /></>

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageIntro
        page="/dashboard/overview"
        action={{ label: "Open My Jobs", href: "/dashboard/tracker" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <label>Inbox <select aria-label="Filter inbox" value={account} onChange={e => router.push(`/dashboard/overview?account=${encodeURIComponent(e.target.value)}`)}><option value="">All connected inboxes</option>{accounts.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
        <button className="btn-outline" disabled={scanning} onClick={() => setRefreshKey(k => k + 1)}>{scanning ? "Reading history…" : "Refresh history"}</button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Last 90 days. Counts reflect scanned matching emails. Open circles are evidence gaps.</p>
      <p role="status" style={{ fontSize: 13 }}>{scanStatus}</p>
      {issues.map(issue => <p role="status" key={issue}>{issue}</p>)}
      {viewId && !viewing && !loading && <p role="status">This chain was not found in the scanned history for this inbox.</p>}
      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center" }}><TypingDots label="Mapping your submissions…" /></div>
      ) : error ? (
        <Card style={{ padding: 24 }}><p style={{ color: "var(--danger)" }}>{error}</p></Card>
      ) : (
        <>
          {/* Big numbers */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { n: rails.length, label: "with progress evidence" },
              { n: waiting.length, label: "awaiting submission evidence" },
              { n: interviews, label: "invite evidence" },
            ].map(s => (
              <Card key={s.label} style={{ flex: 1, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Submission progress */}
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <TrainFront size={17} /> Submission progress
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 6px" }}>
            One application per row, with only documented milestones filled.
          </p>
          <Card style={{ padding: "4px 18px 14px", marginBottom: 26 }}>
            {rails.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>No submission or later stage evidence found in this scan.</p>
            ) : rails.map(c => (
              <ChainRow key={`${c.accountEmail}:${c.threadId}`} chain={c} onView={() => router.push(`/dashboard/overview?chain=${encodeURIComponent(c.threadId)}&account=${encodeURIComponent(c.accountEmail)}`)} />
            ))}
          </Card>

          {/* RTR and rate discussions */}
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>RTR and rate discussions</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 6px" }}>
            RTRs and rate discussions without submission evidence in the scanned emails.
          </p>
          <Card style={{ padding: "4px 18px 14px" }}>
            {waiting.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>Nothing waiting.</p>
            ) : waiting.map(c => (
              <ChainRow key={`${c.accountEmail}:${c.threadId}`} chain={c} onView={() => router.push(`/dashboard/overview?chain=${encodeURIComponent(c.threadId)}&account=${encodeURIComponent(c.accountEmail)}`)} />
            ))}
          </Card>

          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 18, textAlign: "center" }}>
            Every View opens the mind map: who touched your profile, in order, with dates and evidence.{" "}
            <Link href="/dashboard/tracker" style={{ color: "var(--accent)" }}>My Jobs</Link> has the same journeys per application.
          </p>
        </>
      )}


    </div>
  )
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: "60px 0", textAlign: "center" }}><TypingDots label="Loading…" /></div>}>
      <OverviewInner />
    </Suspense>
  )
}
