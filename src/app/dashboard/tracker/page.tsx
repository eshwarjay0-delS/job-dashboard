"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Card, Chip, StagePill } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import { STAGE, type App, type Stage } from "../_suite/sample"
import { useGmailData, buildAccounts, makeAcct } from "@/lib/use-gmail-data"

const COLUMNS: { title: string; stages: Stage[] }[] = [
  { title: "Applied", stages: ["applied"] },
  { title: "Pending", stages: ["pending", "followup"] },
  { title: "RTR · Rate", stages: ["rtr", "rate"] },
  { title: "Interviewing", stages: ["invite"] },
  { title: "Offer", stages: ["offer"] },
  { title: "Rejected", stages: ["rejected"] },
]
const MOVES: Stage[] = ["applied", "pending", "followup", "rtr", "rate", "invite", "offer", "rejected"]
const TH: React.CSSProperties = { textAlign: "left", padding: "10px 16px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-soft)", whiteSpace: "nowrap" }
const TD: React.CSSProperties = { padding: "10px 16px", fontSize: 13, color: "var(--text-muted)", borderTop: "1px solid var(--border)", whiteSpace: "nowrap" }

function TableView({ apps, setStage, acct }: { apps: App[]; setStage: (id: string, s: Stage) => void; acct: (id: string) => { tint: string; email: string } }) {
  return (
    <Card style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
        <thead style={{ background: "var(--surface-2)" }}>
          <tr>{["Company", "Inbox", "Type", "Applied", "Rate", "Stage", "Last activity"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {apps.map(a => (
            <tr key={a.id} style={{ opacity: a.stage === "rejected" ? 0.6 : 1 }}>
              <td style={TD}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: STAGE[a.stage].bg, color: STAGE[a.stage].fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{a.company[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{a.company}</div>
                    <div style={{ fontSize: 12 }}>{a.role}</div>
                  </div>
                </div>
              </td>
              <td style={TD}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 10, background: acct(a.account).tint }} />{acct(a.account).email.split("@")[0]}
                </span>
              </td>
              <td style={TD}>{a.type}</td>
              <td style={TD}>{a.applied}</td>
              <td style={{ ...TD, fontWeight: 600, color: a.rate ? "var(--text)" : "var(--text-soft)", fontVariantNumeric: "tabular-nums" }}>{a.rate ?? "—"}</td>
              <td style={TD}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <StagePill stage={a.stage} />
                  <select value={a.stage} onChange={e => setStage(a.id, e.target.value as Stage)} aria-label={`Change stage for ${a.company}`}
                    style={{ height: 28, fontSize: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}>
                    {MOVES.map(s => <option key={s} value={s}>{STAGE[s].label}</option>)}
                  </select>
                </label>
              </td>
              <td style={TD}>{a.last}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function BoardView({ apps, acct }: { apps: App[]; acct: (id: string) => { tint: string; email: string } }) {
  return (
    <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
      {COLUMNS.map(c => {
        const items = apps.filter(a => c.stages.includes(a.stage))
        return (
          <div key={c.title} style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 10, background: STAGE[c.stages[0]!].dot }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</span>
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 10, background: "var(--surface-2)", minHeight: 220 }}>
              {items.map(a => (
                <div key={a.id} style={{ padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", opacity: a.stage === "rejected" ? 0.6 : 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.company}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.role}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 10, background: acct(a.account).tint }} />{a.type}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{a.rate ?? a.applied}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>{a.last}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TrackerPage() {
  // ── Live Gmail data (replaces ../_suite/sample mocks) ────────────────────
  const { applications, loading, connected } = useGmailData()
  const [overrides, setOverrides] = useState<Record<string, Stage>>({})
  const [view, setView] = useState<"table" | "board">("table")
  const [type, setType] = useState<"all" | App["type"]>("all")
  const [hideRejected, setHideRejected] = useState(false)

  const apps = applications.map(a => overrides[a.id] ? { ...a, stage: overrides[a.id] as Stage } : a)
  const accounts = buildAccounts(apps.map(a => a.account))
  const acct = makeAcct(accounts)

  const shown = apps.filter(a => (type === "all" || a.type === type) && !(hideRejected && a.stage === "rejected"))
  const setStage = (id: string, s: Stage) =>
    setOverrides(xs => ({ ...xs, [id]: s }))

  return (
    <div>
      <PageIntro page="/dashboard/tracker" action={{ label: "Change a job's step", href: "#jobs" }} sample={connected ? undefined : "Connect Gmail to track your live pipeline."} />
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          ⟳ Loading your pipeline…
        </div>
      )}
      {!loading && (
      <>
      <div id="jobs" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20, scrollMarginTop: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip label="All" active={type === "all"} onClick={() => setType("all")} count={apps.length} />
          <Chip label="Contract" active={type === "Contract"} onClick={() => setType("Contract")} count={apps.filter(a => a.type === "Contract").length} />
          <Chip label="Full-time" active={type === "Full-time"} onClick={() => setType("Full-time")} count={apps.filter(a => a.type === "Full-time").length} />
          <Chip label={hideRejected ? "Show rejected" : "Hide rejected"} onClick={() => setHideRejected(!hideRejected)} />
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {(["table", "board"] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              style={{ height: 28, padding: "0 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 650, textTransform: "capitalize",
                background: view === v ? "var(--surface)" : "transparent", color: "var(--text)", boxShadow: view === v ? "0 1px 2px rgba(12,11,8,.08)" : "none" }}>{v}</button>
          ))}
        </div>
      </div>
      {view === "table" ? <TableView apps={shown} setStage={setStage} acct={acct} /> : <BoardView apps={shown} acct={acct} />}
      </>)}
      <div style={{ display: "flex", gap: 10, marginTop: 20, padding: 16, borderRadius: 10, background: "var(--surface-2)", fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)" }}>
        <Zap size={16} style={{ flexShrink: 0, color: "var(--text)" }} />
        <span><b style={{ color: "var(--text)" }}>Auto-status:</b> rejection mail → Rejected and archived · invite → added to the calendar · RTR or rate mail → RTR · Rate. Anything uncertain stays where it is and asks you.</span>
      </div>
    </div>
  )
}
