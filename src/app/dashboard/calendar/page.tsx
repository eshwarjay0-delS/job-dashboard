"use client"

import { useState } from "react"
import Link from "next/link"
import { Clock, User, Mic, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, Btn } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import MetricHero from "../_components/metric-hero"
import { fmtHour, type Interview } from "../_suite/sample"
import { useGmailData, buildAccounts, makeAcct } from "@/lib/use-gmail-data"

// ── Current week (Mon–Sun), computed live ───────────────────────────────────
const now = new Date()
const monday = new Date(now)
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEK_DATES = WEEK_DAYS.map((_, i) => {
  const d = new Date(monday)
  d.setDate(monday.getDate() + i)
  return d.getDate()
})
const TODAY_IDX = (now.getDay() + 6) % 7
const WEEK_LABEL = (() => {
  const end = new Date(monday)
  end.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
  return `${fmt(monday)} – ${fmt(end)}`
})()

// Interviews only: no meetings, reminders or other calendar noise ever lands on this grid.
// One hour is 64px, so 30 minutes is exactly 32px, and a block is its duration minus a 1px breath at
// each end. Nothing is stretched to fit its text; a short block changes how it reads instead.
const START = 8, END = 19, HOUR = 64, GUTTER = 56, COL_MIN = 104
const SHORT = 0.75 // under 45 minutes a block has room for one line only

const KIND: Record<Interview["kind"], { bg: string; bar: string }> = {
  Onsite: { bg: "#e4e0d6", bar: "#11100c" },
  Panel:  { bg: "#ebe8e0", bar: "#42413c" },
  Video:  { bg: "#f0ede7", bar: "#6e6b5b" },
  Phone:  { bg: "#f4f2ed", bar: "#a29d89" },
}
const range = (a: number, b: number) => `${fmtHour(a, true)}–${fmtHour(b, true)}`
const brief = (a: number, b: number) => `${fmtHour(a, true).slice(0, -2)}–${fmtHour(b, true).slice(0, -2)}`

function Event({ iv, selected, onPick }: { iv: Interview; selected: boolean; onPick: () => void }) {
  const dur = iv.end - iv.start
  const short = dur < SHORT
  const k = KIND[iv.kind]
  const height = dur * HOUR - 2
  return (
    <button type="button" onClick={onPick}
      aria-label={`${iv.company}, ${WEEK_DAYS[iv.day]} ${fmtHour(iv.start)} to ${fmtHour(iv.end)}, ${iv.kind}`}
      style={{
        position: "absolute", left: 3, right: 3, top: (iv.start - START) * HOUR + 1, height, minHeight: 0, maxHeight: height,
        boxSizing: "border-box", margin: 0, overflow: "hidden", textAlign: "left", font: "inherit", cursor: "pointer",
        display: "flex", flexDirection: short ? "row" : "column", alignItems: short ? "center" : "stretch", gap: short ? 6 : 1,
        padding: short ? "0 7px" : "5px 8px", borderRadius: 10, background: k.bg,
        border: "none", borderLeft: `3px solid ${k.bar}`,
        boxShadow: selected ? `0 0 0 2px ${k.bar}` : "none", zIndex: selected ? 2 : 1,
      }}>
      <span style={{
        fontSize: 12, lineHeight: "16px", fontWeight: 700, color: "var(--text)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, maxWidth: "100%", flexShrink: short ? 0 : 1,
      }}>{iv.company}</span>
      <span style={{
        fontSize: 11, lineHeight: "14px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flexShrink: 10,
      }}>{short ? brief(iv.start, iv.end) : range(iv.start, iv.end)}</span>
      {dur >= 1 && (
        <span style={{ fontSize: 11, lineHeight: "14px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {iv.kind} · {iv.with}
        </span>
      )}
    </button>
  )
}

function Week({ sel, onPick, interviews }: { sel: string | null; onPick: (id: string) => void; interviews: Interview[] }) {
  const hours = Array.from({ length: END - START }, (_, i) => START + i)
  const nowY = (10.6 - START) * HOUR
  return (
    <Card style={{ padding: 0, overflowX: "auto" }}>
      <div style={{ minWidth: GUTTER + COL_MIN * 7 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: GUTTER, flexShrink: 0 }} />
          {WEEK_DAYS.map((d, i) => (
            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: i === TODAY_IDX ? "var(--text)" : "var(--text-soft)" }}>{d.toUpperCase()}</span>
              <span style={{
                width: 30, height: 30, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, background: i === TODAY_IDX ? "var(--accent)" : "transparent",
                color: i === TODAY_IDX ? "#fff" : i > 4 ? "var(--text-soft)" : "var(--text)",
              }}>{WEEK_DATES[i]}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: hours.length * HOUR }}>
          <div style={{ width: GUTTER, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR, paddingRight: 8, textAlign: "right", fontSize: 11, lineHeight: "16px", color: "var(--text-soft)", transform: "translateY(-8px)" }}>
                {h === START ? "" : fmtHour(h, true)}
              </div>
            ))}
          </div>
          {WEEK_DAYS.map((d, di) => (
            <div key={d} style={{
              flex: 1, minWidth: COL_MIN, position: "relative", borderLeft: "1px solid var(--border)",
              background: di === TODAY_IDX ? "rgba(12,11,8,.018)" : di > 4 ? "rgba(12,11,8,.01)" : "transparent",
            }}>
              {hours.map(h => <div key={h} style={{ height: HOUR, borderTop: h === START ? "none" : "1px solid var(--border)", boxSizing: "border-box" }} />)}
              {di === TODAY_IDX && (
                <div aria-hidden style={{ position: "absolute", left: -5, right: 0, top: nowY, display: "flex", alignItems: "center", zIndex: 3, pointerEvents: "none" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: "var(--accent)" }} />
                  <span style={{ flex: 1, height: 2, background: "var(--accent)" }} />
                </div>
              )}
              {interviews.filter(iv => iv.day === di).map(iv => (
                <Event key={iv.id} iv={iv} selected={sel === iv.id} onPick={() => onPick(iv.id)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Detail({ iv, acct }: { iv: Interview; acct: (id: string) => { tint: string; email: string } }) {
  const k = KIND[iv.kind]
  return (
    <Card style={{ flex: "0 1 320px", minWidth: 280 }}>
      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: k.bg, borderLeft: `3px solid ${k.bar}`, fontSize: 12, fontWeight: 700 }}>{iv.kind}</span>
      <h2 style={{ margin: "12px 0 0", fontSize: 19, fontWeight: 750 }}>{iv.company}</h2>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>{iv.role}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, fontSize: 13.5 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Clock size={15} color="var(--text-soft)" />{WEEK_DAYS[iv.day]} {WEEK_DATES[iv.day]} {iv.day < 3 ? "Sep" : "Oct"} · {fmtHour(iv.start)} – {fmtHour(iv.end)} ET</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><User size={15} color="var(--text-soft)" />{iv.with}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 15, display: "flex", justifyContent: "center" }}><span style={{ width: 9, height: 9, borderRadius: 5, background: acct(iv.account).tint }} /></span>
          Invite came to {acct(iv.account).email}
        </div>
      </div>
      <Link href="/dashboard/prep" style={{
        marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 10,
        background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 650, textDecoration: "none",
      }}><Mic size={14} /> Prep for this interview</Link>
    </Card>
  )
}

export default function CalendarPage() {
  // ── Live Gmail data (replaces ../_suite/sample mocks) ────────────────────
  const { interviews, loading, connected } = useGmailData()
  const [sel, setSel] = useState<string | null>(null)
  const accounts = buildAccounts(interviews.map(i => i.account))
  const acct = makeAcct(accounts)
  const iv = interviews.find(x => x.id === sel) ?? interviews[0]
  return (
    <div>
      <PageIntro page="/dashboard/calendar" action={{ label: "Get ready for an interview", href: "/dashboard/prep" }} sample={connected ? undefined : "Connect Gmail to see interviews from your inbox."} />
      {!loading && (
        <MetricHero
          why={(() => {
            if (!connected) return "This is your interview calendar. Connect Gmail and your real interviews will show up here."
            if (interviews.length === 0) return "This is your interview calendar. No interviews scheduled yet."
            const next = interviews[0]
            return `This is your interview calendar. Your next interview is ${next ? `${next.company} — don't miss it.` : "coming up."}`
          })()}
          metrics={[
            { value: interviews.length, label: "interviews scheduled", hot: interviews.length > 0 },
            { value: interviews.filter(i => i.day === TODAY_IDX).length, label: "today" },
            { value: new Set(interviews.map(i => i.company)).size, label: "companies" },
          ]}
        />
      )}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          ⟳ Loading interviews…
        </div>
      )}
      {!loading && interviews.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          No interviews found in your inbox yet.
        </div>
      )}
      {!loading && interviews.length > 0 && (
      <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Btn variant="ghost" title="Previous week" style={{ padding: "0 8px" }}><ChevronLeft size={16} /></Btn>
          <span style={{ fontSize: 17, fontWeight: 750, letterSpacing: "-0.02em" }}>{WEEK_LABEL}</span>
          <Btn variant="ghost" title="Next week" style={{ padding: "0 8px" }}><ChevronRight size={16} /></Btn>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {(Object.keys(KIND) as Interview["kind"][]).map(kk => (
            <span key={kk} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: KIND[kk].bg, borderLeft: `3px solid ${KIND[kk].bar}` }} />{kk}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 780px", minWidth: 0 }}><Week sel={sel} onPick={setSel} interviews={interviews} /></div>
        {iv && <Detail iv={iv} acct={acct} />}
      </div>
      </>
      )}
    </div>
  )
}
