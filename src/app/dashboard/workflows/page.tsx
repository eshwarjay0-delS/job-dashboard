"use client"

import { useState } from "react"
import { Check, ChevronUp, ChevronDown, Pause, Play, Plus } from "lucide-react"
import { Card, Btn, Toggle, useAnswered, useLeaving, leavingStyle } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import MetricHero from "../_components/metric-hero"
import { type Step } from "../_suite/sample"
import { useGmailData } from "@/lib/use-gmail-data"

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function move<T>(xs: T[], from: number, to: number): T[] {
  if (to < 0 || to >= xs.length) return xs
  const next = xs.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x!)
  return next
}

function StepRow({ s, i, total, update, nudge }: { s: Step; i: number; total: number; update: (p: Partial<Step>) => void; nudge: (d: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-soft)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650 }}>{s.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.trigger} · {s.days.length ? `${s.days.join(" & ")} ${s.time}` : s.time}</div>
      </div>
      <div style={{ display: "flex", gap: 2 }} role="group" aria-label={`Days ${s.title} repeats on`}>
        {WEEK.map(d => {
          const on = s.days.includes(d)
          return (
            <button key={d} type="button" role="checkbox" aria-checked={on} aria-label={d}
              onClick={() => update({ days: on ? s.days.filter(x => x !== d) : [...s.days, d] })}
              style={{
                width: 28, height: 28, borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 700,
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--text-muted)",
              }}>{d[0]}</button>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {(["approve", "auto"] as const).map(m => (
          <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => update({ mode: m })}
            style={{
              height: 26, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 650,
              background: s.mode === m ? "var(--surface)" : "transparent", color: "var(--text)",
              boxShadow: s.mode === m ? "0 1px 2px rgba(12,11,8,.08)" : "none",
            }}>{m === "approve" ? "Approve" : "Auto"}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <button type="button" onClick={() => nudge(-1)} disabled={i === 0} aria-label={`Move ${s.title} up`} style={arrow(i === 0)}><ChevronUp size={14} /></button>
        <button type="button" onClick={() => nudge(1)} disabled={i === total - 1} aria-label={`Move ${s.title} down`} style={arrow(i === total - 1)}><ChevronDown size={14} /></button>
      </div>
    </div>
  )
}

const arrow = (off: boolean): React.CSSProperties => ({
  width: 26, height: 18, border: "none", background: "transparent", cursor: off ? "default" : "pointer",
  color: off ? "var(--border-strong)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
})

export default function WorkflowsPage() {
  const [tab, setTab] = useState<"apply" | "interview">("apply")
  const [enabled, setEnabled] = useState(true)
  const [answered, answer] = useAnswered()
  const [leaving, leave] = useLeaving(answer)

  // ── Live Gmail data (replaces ../_suite/sample mocks) ────────────────────
  const { mails, steps: liveSteps, loading, connected } = useGmailData()

  // Derive approval queue from mails that need replies
  const approvalFor: Record<string, { step: string; detail: string }> = {}
  for (const m of mails) {
    if (!m.needsReply) continue
    if (m.needsReply === "availability") {
      approvalFor[m.id] = { step: "Share availability", detail: `${m.role} · ${m.company}` }
    } else if (m.needsReply === "rtr") {
      approvalFor[m.id] = { step: "Send RTR back", detail: `${m.role}${m.rate ? ` · ${m.rate}` : ""}` }
    } else if (m.needsReply === "rate") {
      approvalFor[m.id] = { step: "Rate confirmation", detail: `${m.role}${m.rate ? ` · ${m.rate}` : ""}` }
    }
  }

  // Live follow-up engine steps; fall back to the standing automation when empty
  const engineSteps: Step[] = liveSteps.length > 0 ? liveSteps : [
    { id: "s-default-1", title: "Weekly follow-up sweep", trigger: "Mon / Wed / Fri — threads with 24–48h activity", days: ["Mon", "Wed", "Fri"], time: "9:00 AM", mode: "auto" },
    { id: "s-default-2", title: "Thursday call list", trigger: "Threads 10+ days silent after follow-up", days: ["Thu"], time: "9:00 AM", mode: "auto" },
  ]
  const [apply, setApply] = useState<Step[]>(engineSteps)
  const [interview, setInterview] = useState<Step[]>([
    { id: "t1", title: "Thank-you note to the panel", trigger: "2 hours after the interview", days: [], time: "+2h", mode: "approve" },
    { id: "t2", title: "Recruiter debrief", trigger: "Same evening", days: [], time: "6:00 PM", mode: "auto" },
    { id: "t3", title: "Status check", trigger: "No reply after 3 business days", days: ["Tue", "Fri"], time: "11:00 AM", mode: "auto" },
    { id: "t4", title: "Decision follow-up", trigger: "One week after", days: ["Mon"], time: "9:30 AM", mode: "approve" },
  ])

  const steps = tab === "apply" ? apply : interview
  const set = tab === "apply" ? setApply : setInterview
  const autoCount = steps.filter(s => s.mode === "auto").length
  const waiting = mails.filter(m => m.needsReply && approvalFor[m.id] && !answered.includes(m.id))

  return (
    <div>
      <PageIntro page="/dashboard/workflows" action={{ label: "Try approvals", href: "#approve" }} sample={connected ? undefined : "Connect Gmail to see live workflow state. No email is sent or scheduled without your approval."} />
      {!loading && (
        <MetricHero
          why={(() => {
            const w = waiting.length
            if (w === 0) return "These are your automatic follow-ups. Nothing is waiting for your OK right now."
            return `These are your automatic follow-ups. ${w} ${w === 1 ? "needs" : "need"} your OK before anything goes out — nothing sends without you saying yes.`
          })()}
          metrics={[
            { value: waiting.length, label: "waiting for your OK", hot: waiting.length > 0 },
            { value: autoCount, label: "run automatically" },
            { value: steps.length - autoCount, label: "need your approval" },
          ]}
        />
      )}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          ⟳ Loading workflows…
        </div>
      )}

      <Card dark style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>Workflow</div>
        <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em", marginTop: 6 }}>{tab === "apply" ? "After every application" : "After every interview"}</div>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.65)", marginTop: 4 }}>
          {steps.length} steps · {autoCount} automatic · {steps.length - autoCount} wait for your approval
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" onClick={() => setEnabled(!enabled)} aria-label={enabled ? "Pause preview" : "Run preview"}
            style={{ width: 44, height: 44, borderRadius: 22, border: "none", cursor: "pointer", background: "var(--surface)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {enabled ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span style={{ fontSize: 14, fontWeight: 650 }}>{enabled ? "Preview running" : "Preview paused"}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "rgba(255,255,255,.1)" }}>
            {([["apply", "After applying"], ["interview", "After interview"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)}
                style={{
                  height: 30, padding: "0 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 650,
                  background: tab === v ? "#fff" : "transparent", color: tab === v ? "var(--accent)" : "rgba(255,255,255,.75)",
                }}>{label}</button>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => (
            <StepRow key={s.id} s={s} i={i} total={steps.length}
              update={p => set(xs => xs.map(x => x.id === s.id ? { ...x, ...p } : x))}
              nudge={d => set(xs => move(xs, i, i + d))} />
          ))}
          <button type="button" disabled title="Adding steps is not available in this preview" style={{
            display: "flex", alignItems: "center", gap: 10, height: 52, padding: "0 16px", borderRadius: 10, cursor: "pointer",
            border: "1.5px dashed var(--border-strong)", background: "transparent", fontSize: 13.5, fontWeight: 650, color: "var(--text)",
          }}><Plus size={16} /> Add a step</button>
        </div>

        <div style={{ flex: "0 1 340px", minWidth: 280, display: "flex", flexDirection: "column", gap: 20 }}>
          <Card id="approve" style={{ scrollMarginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Waiting for your approval</h3>
              <span aria-label={`${waiting.length} waiting`} style={{
                minWidth: 26, height: 22, padding: "0 8px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                background: waiting.length ? "var(--accent)" : "var(--surface-3)", color: waiting.length ? "#fff" : "var(--text-muted)",
              }}>{waiting.length}</span>
            </div>
            {!waiting.length && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No sample replies waiting. No email was sent.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {waiting.map(m => (
                <div key={m.id} style={{ ...leavingStyle(leaving.includes(m.id)), padding: 12, borderRadius: 10, background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 650 }}>{m.company}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{approvalFor[m.id]!.step}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{approvalFor[m.id]!.detail}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn onClick={() => leave(m.id)} style={{ flex: 1 }}><Check size={14} /> Try approval</Btn>
                    <Btn variant="outline" disabled>Edit · coming soon</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Example week</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["Mon 10:00", "Weekly follow-up", "4 sent"], ["Tue 09:12", "Polite close on rejection", "Mastercard"], ["Wed 08:40", "Thank-you + resume", "Vanguard"], ["Thu 10:00", "Weekly follow-up", "scheduled · 3"]].map(([t, s, d]) => (
                <div key={t + s} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                  <span style={{ width: 72, fontSize: 12, fontWeight: 600, color: "var(--text-soft)", fontVariantNumeric: "tabular-nums" }}>{t}</span>
                  <span style={{ flex: 1 }}>{s}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}><Toggle value={!enabled} onChange={v => setEnabled(!v)} label="Pause everything" /></div>
          </Card>
        </div>
      </div>
    </div>
  )
}
