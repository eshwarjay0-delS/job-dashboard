"use client"
import TypingDots from "../_components/typing-dots"

import { useState } from "react"
import Link from "next/link"
import { Clock, User, Mic, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { Card, Btn, Chip } from "../_suite/ui"
import { fmtHour, type Interview } from "../_suite/sample"
import { useGmailData, buildAccounts, makeAcct } from "@/lib/use-gmail-data"
import InterviewBoard from "./_components/interview-board"

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
  Onsite: { bg: "var(--surface-3)", bar: "#11100c" },
  Panel:  { bg: "var(--surface-2)", bar: "#42413c" },
  Video:  { bg: "var(--surface-2)", bar: "#6e6b5b" },
  Phone:  { bg: "var(--surface-2)", bar: "#a29d89" },
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
      <Link href="/dashboard/kompas" style={{
        marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 10,
        background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 650, textDecoration: "none",
      }}><Mic size={14} /> Prep for this interview</Link>
    </Card>
  )
}

/* ── Past interviews: the journey view ────────────────────────────────────
   Every past interview is proof of progress, not regret. Each card shows the
   arc — first touch to interview request, in days — and points at Kompas so
   "what went wrong" becomes "what I fixed for next time." */

const DAY_MS = 86_400_000

function mondayOf(ts: number): Date {
  const d = new Date(ts)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function weekLabel(mondayTs: number): string {
  const end = new Date(mondayTs + 6 * DAY_MS)
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { day: "numeric", month: "short" })
  return `${fmt(mondayTs)} – ${fmt(end.getTime())}`
}

function JourneyCard({ iv }: { iv: Interview }) {
  const journeyDays = iv.firstTouchTs && iv.requestTs
    ? Math.max(0, Math.round((iv.requestTs - iv.firstTouchTs) / DAY_MS))
    : null
  const reflectHref = `/dashboard/kompas/flow?mode=transcribe&company=${encodeURIComponent(iv.company)}&role=${encodeURIComponent(iv.role)}`
  const k = KIND[iv.kind]
  return (
    <article style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
      padding: "18px 20px", boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: k.bg, borderLeft: `3px solid ${k.bar}`, fontSize: 12, fontWeight: 700 }}>{iv.kind}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{iv.ts ? fmtDate(iv.ts) : ""}</span>
          </div>
          <h3 style={{ margin: "10px 0 0", fontSize: 17, letterSpacing: "-0.015em" }}>{iv.company}</h3>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>{iv.role}</div>

          {journeyDays !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", fontWeight: 650, color: "var(--text)" }}>
                First touch
              </span>
              <span aria-hidden>→</span>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{journeyDays} day{journeyDays === 1 ? "" : "s"}</span>
              <span aria-hidden>→</span>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", fontWeight: 650, color: "var(--text)" }}>
                Interview request
              </span>
            </div>
          )}
          {iv.evidence && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                background: "var(--accent-soft)", border: "1px solid var(--accent-border)", color: "var(--accent-txt)",
              }}>
                {iv.evidence === "calendar-invite" ? "Calendar invite" : iv.evidence === "meeting-link" ? "Meeting link" : "Confirmed by email"}
              </span>
              <span>from {iv.inviteVia || iv.with || "the vendor"}</span>
            </div>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
            {iv.ts ? "Scheduled date found. Attendance and outcome are unconfirmed." : "Invite evidence found. Date or timezone has not been verified."}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <a href={reflectHref} style={{
          display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 18px", borderRadius: 999,
          background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none",
        }}>
          <Mic size={14} /> Reflect in Kompas
        </a>
        <Link href="/dashboard/mock-interview" style={{
          display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 18px", borderRadius: 999,
          border: "1px solid var(--border-strong)", fontSize: 13.5, fontWeight: 700, textDecoration: "none", color: "var(--text)",
        }}>
          Practice for the next one
        </Link>
        {iv.threadId && (
          <Link href={`/dashboard/overview?chain=${encodeURIComponent(iv.threadId)}&account=${encodeURIComponent(iv.account)}`} style={{
            display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 18px", borderRadius: 999,
            border: "1px solid var(--border-strong)", fontSize: 13.5, fontWeight: 700, textDecoration: "none", color: "var(--text)",
          }}>
            <Eye size={14} /> Overview
          </Link>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-soft)", lineHeight: 1.5 }}>
        In Kompas you can upload the interview transcript or recording, walk through what went wrong, and get sharper for next time.
      </div>
    </article>
  )
}

export default function CalendarPage() {
  // ── Live Gmail data ────────────────────────────────────────────────────
  const { interviews: rawInterviews, loading, connected, error, refresh } = useGmailData()
  const interviews = rawInterviews.map(iv => {
    if (!iv.ts) return iv
    const d = new Date(iv.ts)
    const start = d.getHours() + d.getMinutes() / 60
    return { ...iv, day: (d.getDay() + 6) % 7, start, end: start + (iv.end - iv.start) }
  })
  const [sel, setSel] = useState<string | null>(null)
  const [tab, setTab] = useState<"upcoming" | "past" | "unknown">("upcoming")
  const [weekOff, setWeekOff] = useState(0) // 0 = this week, -1 = last week, …
  const accounts = buildAccounts(interviews.map(i => i.account))
  const acct = makeAcct(accounts)

  const nowTs = Date.now()
  const isPast = (iv: Interview) => !!iv.ts && iv.ts < nowTs
  const upcoming = interviews.filter(iv => !!iv.ts && !isPast(iv))
  const past = interviews.filter(isPast)
  const unknown = interviews.filter(iv => !iv.ts)

  const iv = upcoming.find(x => x.id === sel) ?? upcoming[0]

  // Past weeks, newest first
  const pastWeeks = (() => {
    const map = new Map<number, Interview[]>()
    for (const p of past) {
      const m = mondayOf(p.ts || nowTs).getTime()
      if (!map.get(m)) map.set(m, [])
      map.get(m)!.push(p)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  })()
  const weekIdx = Math.min(Math.max(weekOff, 0), Math.max(0, pastWeeks.length - 1))
  const activeWeek = pastWeeks[weekIdx]

  return (
    <div className="mf-home" style={{ paddingBottom: 56 }}>
      <header className="mf-home-heading">
        <p className="mf-eyebrow">INTERVIEWS</p>
        <h1>Every interview, past and future.</h1>
        <p>
          {loading ? "Reading your inboxes…" : !connected
            ? "Connect Gmail and your interviews — upcoming and past — will live here."
            : tab === "upcoming"
              ? upcoming.length === 0
                ? "Nothing scheduled right now. When invites land, they'll appear here."
                : `Your next one is ${upcoming[upcoming.length - 1]?.company} — walk in ready.`
              : past.length === 0
                ? "No past interviews parsed yet — they'll show up here with the full journey."
                : `${past.length} past scheduled invites. Attendance is not inferred from the date.`}
        </p>
      </header>

      {/* Every interview that is still open, each with what to do about it; the ones that ended are under "Past
          interviews". Before 13 Oct 2026 this page showed a week at a time and nothing said what came after one. */}
      {connected && <InterviewBoard />}

      {error && !loading && (
        <div style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 12, border: "1px solid var(--danger-border)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, lineHeight: 1.55 }}>{error}</div>
          <button className="btn-outline" style={{ minHeight: 38 }} onClick={() => refresh()}>Refresh</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["upcoming", "past", "unknown"] as const).map(t => (
          <Chip
            key={t}
            label={t === "upcoming" ? "Upcoming invites" : t === "past" ? "Past scheduled" : "Date unverified"}
            count={t === "upcoming" ? upcoming.length : t === "past" ? past.length : unknown.length}
            active={tab === t}
            onClick={() => setTab(t)}
          />
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          <TypingDots label="Loading interviews…" />
        </div>
      ) : tab === "unknown" ? (<div>{unknown.map(p => <JourneyCard key={`${p.account}:${p.id}`} iv={p} />)}</div>) : tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
            No interviews scheduled. When invites land in your inbox, they'll appear here — and in the meantime,{" "}
            <Link href="/dashboard/mock-interview" style={{ fontWeight: 700, color: "var(--text)" }}>practice here</Link> so you're ready.
          </div>
        ) : (
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
              <div style={{ flex: "1 1 780px", minWidth: 0 }}><Week sel={sel} onPick={setSel} interviews={upcoming.filter(i => i.ts && i.ts >= mondayOf(nowTs).getTime() && i.ts < mondayOf(nowTs).getTime() + 7 * DAY_MS)} /></div>
              {iv && <Detail iv={iv} acct={acct} />}
            </div>
          </>
        )
      ) : (
        /* ── Past ── */
        past.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
            No past interviews parsed yet. They'll appear here with the full journey once your inbox history is read.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
              <Btn variant="ghost" title="Older week" style={{ padding: "0 8px" }} onClick={() => setWeekOff(w => w + 1)}><ChevronLeft size={16} /></Btn>
              <span style={{ fontSize: 17, fontWeight: 750, letterSpacing: "-0.02em" }}>
                {activeWeek ? weekLabel(activeWeek[0]) : ""}
              </span>
              <Btn variant="ghost" title="Newer week" style={{ padding: "0 8px" }} onClick={() => setWeekOff(w => Math.max(0, w - 1))} disabled={weekIdx === 0}><ChevronRight size={16} /></Btn>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginLeft: 8 }}>
                {activeWeek ? `${activeWeek[1].length} interview${activeWeek[1].length === 1 ? "" : "s"}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(activeWeek?.[1] || []).map(p => <JourneyCard key={p.id} iv={p} />)}
            </div>
            <p style={{ marginTop: 24, fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.6, textAlign: "center" }}>
              An elapsed invitation is not proof of attendance. Open the application overview to inspect its source emails.
            </p>
          </>
        )
      )}
    </div>
  )
}
