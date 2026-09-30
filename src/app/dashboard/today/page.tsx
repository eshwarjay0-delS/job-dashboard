"use client"

import Link from "next/link"
import { Leaf, Mic, FileText } from "lucide-react"
import { SAMPLE_LINE, Card, Meta, StagePill, Avatar, useAnswered } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import { mails, interviews, acct, fmtHour, WEEK_DAYS, WEEK_DATES, type Mail } from "../_suite/sample"

// Today is the door, not a dashboard: the replies waiting on you, the next interview, and the way
// into the resume tailor. Each one opens its room; everything else lives in the room.
const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"]
const ask = (m: Mail) =>
  m.needsReply === "availability" ? "Asks for your availability" : m.needsReply === "rtr" ? "RTR to sign and return" : `Confirm ${m.rate}`

export default function TodayPage() {
  const [answered] = useAnswered()
  const needs = mails.filter(m => m.needsReply && !answered.includes(m.id))
  const next = interviews.filter(i => i.day >= 2).sort((a, b) => a.day - b.day || a.start - b.start)[0]!

  return (
    <div style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 20 }}>
      <PageIntro page="/dashboard/today" action={{ label: "Answer my replies", href: "/dashboard/mail" }} sample={SAMPLE_LINE} />
      <Card dark style={{ padding: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
          <div style={{ flex: "1.2 1 340px", display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.2, fontWeight: 600, color: "var(--bg)" }}>
              {needs.length ? `${WORDS[needs.length] ?? `${needs.length} things`} need${needs.length === 1 ? "s" : ""} you today.` : "Nothing needs you today."}
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,.75)", maxWidth: 520 }}>
              {needs.length
                ? "These people are waiting for you to write back."
                : "Every reply is sent. Follow-ups go out on their own."}
            </p>
          </div>
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 8 }}>
            <Meta style={{ color: "rgba(255,255,255,.5)" }}>Replies waiting · {needs.length}</Meta>
            {needs.map(m => (
              <Link key={m.id} href="/dashboard/mail" aria-label={`${m.company}: ${ask(m)}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, textDecoration: "none",
                background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.08)",
              }}>
                <Avatar name={m.from} tint={acct(m.account).tint === "#1c1b16" ? "#4d4b44" : acct(m.account).tint} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.company}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ask(m)}</div>
                </div>
                <StagePill stage={m.stage} label={m.stage === "invite" ? "Invite" : undefined} />
              </Link>
            ))}
            {!needs.length && <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", padding: "8px 0" }}>Nothing waiting.</div>}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Meta>Next interview</Meta>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{next.kind}</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "flex-start" }}>
            <div style={{ width: 56, textAlign: "center", padding: "8px 0", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--text-muted)" }}>{WEEK_DAYS[next.day]!.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 750, color: "var(--text)" }}>{WEEK_DATES[next.day]}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{next.company}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{next.role}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 2 }}>{fmtHour(next.start)} – {fmtHour(next.end)} · {next.with}</div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 20 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/dashboard/prep" style={linkBtn}><Mic size={14} /> Open prep</Link>
            <Link href="/dashboard/calendar" style={{ ...linkBtn, background: "transparent", color: "var(--text)", border: "1px solid var(--border-strong)" }}>Calendar</Link>
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column" }}>
          <Meta>Resume</Meta>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12 }}>Tailor a resume to a job</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.55 }}>
            Paste a job description and MarketFit rewrites your best-matching resume against it.
          </div>
          <div style={{ flex: 1, minHeight: 20 }} />
          <div><Link href="/dashboard/resume" style={linkBtn}><FileText size={14} /> Open the resume tailor</Link></div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 4px", fontSize: 12.5, color: "var(--text-muted)" }}>
        <Leaf size={15} />
        Two rejections were filed this week, and follow-up emails go out on their own in{" "}
        <Link href="/dashboard/workflows" style={{ color: "var(--text)", fontWeight: 600 }}>Follow-ups</Link>.
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 18px", borderRadius: 10,
  background: "var(--accent)", color: "var(--bg)", fontSize: 15, fontWeight: 650, textDecoration: "none",
}
