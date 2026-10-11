"use client"

// Overview — every submission as a mind map and a progress bar.
// Two tables: "On the rails" (submitted RTRs moving forward) and "Waiting to
// board" (RTRs and rate confirmations with no submission yet). Every row has a
// View button that opens the submission's mind map: who touched the profile,
// in what order, where it stands, and what is next.

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { TrainFront, Eye, X, ArrowDown, User, Mail, CalendarDays, FileText, Download } from "lucide-react"
import { Card } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import TypingDots from "../_components/typing-dots"
import type { ApplicationChain, ChainStageKey } from "@/app/api/gmail/_lib"

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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: 0 }} aria-label={`At ${STAGES[doneIdx]?.label}`}>
      {STAGES.map((s, i) => {
        const reached = i <= doneIdx
        const isCurrent = i === doneIdx && !chain.terminal
        const terminal = chain.terminal && i === STAGES.length - 1
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "none" }}>
              <div style={{
                width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10, borderRadius: "50%",
                background: terminal ? (chain.terminal === "offer" ? "var(--success)" : "var(--danger)")
                  : reached ? "var(--accent)" : "var(--border-strong)",
                border: isCurrent ? "2px solid var(--accent)" : "none",
                boxShadow: isCurrent ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)" : "none",
              }} />
              <span style={{ fontSize: 9.5, color: reached ? "var(--text)" : "var(--text-muted)", fontWeight: reached ? 700 : 400, whiteSpace: "nowrap" }}>
                {terminal ? (chain.terminal === "offer" ? "Offer" : "Rejected") : s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 2px 14px", background: i < doneIdx ? "var(--accent)" : "var(--border)", borderRadius: 2 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface HopFile { filename: string; messageId: string; attachmentId: string; from: string; date: string }

// ── Mind map: the people who carried the profile, in order ─────────────────
function MindMap({ chain, onClose }: { chain: ApplicationChain; onClose: () => void }) {
  const hops = chain.links
  const [files, setFiles] = useState<HopFile[]>([])
  useEffect(() => {
    fetch(`/api/gmail/chain-attachments?threadId=${encodeURIComponent(chain.threadId)}&account=${encodeURIComponent(chain.accountEmail)}`, { cache: "no-store" })
      .then(r => r.json())
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

  // Files sent by (or near in time to) a hop belong to that hop.
  const filesFor = (hopName: string, hopAt?: number): HopFile[] =>
    files.filter(f => {
      const fromName = (f.from.match(/^"?([^"<@]+)"?\s*</) || [])[1]?.trim().toLowerCase()
      if (fromName && hopName.toLowerCase().includes(fromName.split(" ")[0])) return true
      return false
    })
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(600px, 100%)", maxHeight: "88dvh", overflowY: "auto",
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
              How your profile traveled
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

        {/* You → hop → hop → … */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
          <MindNode
            name="You"
            email={chain.accountEmail}
            meta="Your profile started here"
            first
          />
          {hops.map((h, i) => (
            <div key={`${h.name}-${i}`}>
              <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                <ArrowDown size={16} style={{ color: "var(--text-muted)" }} />
              </div>
              <MindNode
                name={h.name}
                email={h.email}
                meta={`${h.role === "you" ? "you" : h.role} · ${fmtDate(h.at)}`}
                files={filesFor(h.name, h.at)}
                accountEmail={chain.accountEmail}
              />
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
                    Held by {chain.holder}{chain.stalledDays > 0 ? ` · quiet ${chain.stalledDays}d` : ""}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stage evidence */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 8 }}>
            Milestones
          </div>
          {chain.stops.filter(s => s.reached).map(s => (
            <div key={s.key} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ fontWeight: 700, flex: "none", minWidth: 88 }}>{s.label}</span>
              <span style={{ color: "var(--text-muted)" }}>{fmtDate(s.at)}{s.evidence ? ` · ${s.evidence}` : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MindNode({ name, email, meta, first, files, accountEmail }: {
  name: string; email?: string; meta: string; first?: boolean; files?: HopFile[]; accountEmail?: string
}) {
  return (
    <div style={{
      border: first ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
      borderRadius: 12, padding: "12px 14px", background: first ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "var(--surface)",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flex: "none",
        background: first ? "var(--accent)" : "var(--surface-2)",
        color: first ? "#fff" : "var(--text-muted)",
        display: "grid", placeItems: "center",
      }}>
        <User size={16} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{name}</div>
        {email && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, overflow: "hidden" }}>
            <Mail size={12} style={{ flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
          <CalendarDays size={12} style={{ flex: "none" }} />
          {meta}
        </div>
        {files && files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {files.map(f => (
              <a
                key={`${f.messageId}-${f.attachmentId}`}
                href={`/api/gmail/attachment?messageId=${encodeURIComponent(f.messageId)}&attachmentId=${encodeURIComponent(f.attachmentId)}&filename=${encodeURIComponent(f.filename)}&account=${encodeURIComponent(accountEmail || "")}`}
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
  )
}

function ChainRow({ chain, onView }: { chain: ApplicationChain; onView: () => void }) {
  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{chain.company}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>
            {chain.role}{chain.rate ? ` · ${chain.rate}` : ""}
          </div>
          {chain.stalledDays >= 7 && !chain.terminal && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 3, fontWeight: 600 }}>
              Quiet {chain.stalledDays}d — held by {chain.holder}
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
  const [chains, setChains] = useState<ApplicationChain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewId, setViewId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/gmail/application-chains", { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        if (j.ok) setChains(j.chains || [])
        else setError(j.error || "Could not load submissions.")
        setLoading(false)
      })
      .catch(() => { setError("Could not load submissions."); setLoading(false) })
  }, [])

  // Deep link: /dashboard/overview?chain=<threadId> opens that mind map.
  useEffect(() => {
    const id = params.get("chain")
    if (id) setViewId(id)
  }, [params])

  const { rails, waiting } = useMemo(() => {
    const rails: ApplicationChain[] = []
    const waiting: ApplicationChain[] = []
    for (const c of chains) {
      if (c.current === "rtr" && !c.terminal) waiting.push(c)
      else rails.push(c)
    }
    const byActivity = (a: ApplicationChain, b: ApplicationChain) => (b.lastActivity || 0) - (a.lastActivity || 0)
    rails.sort(byActivity)
    waiting.sort(byActivity)
    return { rails, waiting }
  }, [chains])

  const viewing = viewId ? chains.find(c => c.threadId === viewId) || null : null
  const interviews = chains.filter(c => c.stops.some(s => s.key === "interview" && s.reached)).length

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <PageIntro
        page="/dashboard/overview"
        action={{ label: "Open My Jobs", href: "/dashboard/tracker" }}
      />

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center" }}><TypingDots label="Mapping your submissions…" /></div>
      ) : error ? (
        <Card style={{ padding: 24 }}><p style={{ color: "var(--danger)" }}>{error}</p></Card>
      ) : (
        <>
          {/* Big numbers */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { n: rails.length, label: "on the rails" },
              { n: waiting.length, label: "waiting to board" },
              { n: interviews, label: "reached interview" },
            ].map(s => (
              <Card key={s.label} style={{ flex: 1, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
              </Card>
            ))}
          </div>

          {/* On the rails */}
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <TrainFront size={17} /> On the rails
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 6px" }}>
            Submitted RTRs, and how far each one has traveled toward an interview.
          </p>
          <Card style={{ padding: "4px 18px 14px", marginBottom: 26 }}>
            {rails.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>Nothing submitted yet.</p>
            ) : rails.map(c => (
              <ChainRow key={c.threadId} chain={c} onView={() => setViewId(c.threadId)} />
            ))}
          </Card>

          {/* Waiting to board */}
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Waiting to board</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 6px" }}>
            RTRs and rate confirmations with no submission yet — the next move is yours or theirs.
          </p>
          <Card style={{ padding: "4px 18px 14px" }}>
            {waiting.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>Nothing waiting.</p>
            ) : waiting.map(c => (
              <ChainRow key={c.threadId} chain={c} onView={() => setViewId(c.threadId)} />
            ))}
          </Card>

          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 18, textAlign: "center" }}>
            Every View opens the mind map: who touched your profile, in order, with dates and evidence.{" "}
            <Link href="/dashboard/tracker" style={{ color: "var(--accent)" }}>My Jobs</Link> has the same journeys per application.
          </p>
        </>
      )}

      {viewing && <MindMap chain={viewing} onClose={() => setViewId(null)} />}
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
