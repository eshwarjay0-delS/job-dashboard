"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight, ArrowUpRight, Inbox, Briefcase, CalendarDays,
  Repeat, Bot, Link2, Mail as MailIcon, FileSignature,
  Send, History, ShieldAlert, RefreshCw,
} from "lucide-react"
import { useGmailData } from "@/lib/use-gmail-data"
import type { Mail } from "../_suite/sample"

const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things"]

function LensButton({ href, icon: Icon, label, sub }: { href: string; icon: typeof Inbox; label: string; sub: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
      textDecoration: "none", color: "var(--text)",
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center",
        background: "var(--surface-2)", border: "1px solid var(--border-strong)", flex: "none",
      }}>
        <Icon size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</span>
      </span>
      <ArrowUpRight size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
    </Link>
  )
}

function Section({ icon: Icon, title, href, linkLabel, count, children }: {
  icon: typeof Inbox; title: string; href: string; linkLabel: string; count?: number; children: React.ReactNode
}) {
  return (
    <section style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
      padding: 20, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
          background: "var(--surface-2)", border: "1px solid var(--border-strong)", flex: "none",
        }}>
          <Icon size={16} />
        </span>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.015em", flex: 1 }}>{title}</h2>
        {count != null && count > 0 && (
          <span style={{
            fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999,
            background: "var(--accent-soft)", border: "1px solid var(--accent-border)", color: "var(--accent-txt)",
          }}>{count}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <Link href={href} style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14,
        fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none",
      }}>
        {linkLabel} <ArrowRight size={15} />
      </Link>
    </section>
  )
}

function Row({ primary, secondary, meta, accent }: { primary: string; secondary?: string; meta?: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</div>
        {secondary && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{secondary}</div>}
      </div>
      {meta && <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", color: accent ? "var(--danger)" : "var(--text-muted)" }}>{meta}</span>}
    </div>
  )
}

const ask = (m: Mail) =>
  m.needsReply === "availability" ? "Interview — share availability"
  : m.needsReply === "rtr" ? "RTR to sign and return"
  : m.needsReply === "rate" ? `Confirm ${m.rate || "rate"}`
  : m.subject.slice(0, 48)

interface Note { id: string; title: string; body: string; created_at: string; read: boolean }

export default function TodayPage() {
  const { mails, interviews, drafts, radar, loading, connected, error, refresh } = useGmailData()
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    fetch("/api/agent/notifications", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j.ok) setNotes((j.notifications || []).filter((n: Note) => !n.read).slice(0, 3)) })
      .catch(() => {})
  }, [])

  const needs = mails.filter(m => m.needsReply)
  const rtrs = mails.filter(m => m.stage === "rtr")
  const rates = mails.filter(m => m.stage === "rate")
  const upcoming = interviews.slice(0, 3)

  const total = needs.length + rtrs.length + rates.length + drafts.length + radar.length + notes.length

  return (
    <div className="mf-home" style={{ paddingBottom: 56 }}>
      <header className="mf-home-heading">
        <p className="mf-eyebrow">TODAY</p>
        <h1>{loading ? "Checking your inboxes…" : total === 0 ? "All clear." : `${WORDS[Math.min(total, 6)] ?? `${total} things`} need${total === 1 ? "s" : ""} you today.`}</h1>
        <p>
          {loading
            ? "Pulling your latest recruiter emails, drafts, and alerts."
            : connected
              ? "Everything below is live from your connected Gmail — one glance, then dive in where it matters."
              : "Connect your Gmail and this page comes alive with your real job hunt."}
        </p>
      </header>

      {error && !loading && (
        <div style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 12, border: "1px solid var(--danger-border)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, lineHeight: 1.55 }}>{error}</div>
          <button className="btn-outline" style={{ minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link href="/dashboard/connections" style={{ fontSize: 13, fontWeight: 700 }}>Check connections →</Link>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          ⟳ Reading your inboxes…
        </div>
      ) : !connected ? (
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, letterSpacing: "-0.02em" }}>Connect Gmail to wake this up</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14.5, maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.65 }}>
            Your replies, interviews, RTRs, drafts, and follow-ups will all live here — one tab, everything visible.
          </p>
          <Link href="/dashboard/connections" className="btn-accent" style={{ minHeight: 46, padding: "0 26px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700 }}>
            Connect Gmail <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </Link>
        </section>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <Section icon={MailIcon} title="Needs your reply" href="/dashboard/mail" linkLabel="Open inbox" count={needs.length}>
              {needs.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>Nothing waiting — every thread is answered.</p>
              ) : needs.slice(0, 4).map(m => (
                <Row key={m.id} primary={m.company} secondary={ask(m)}
                  meta={m.jdFit != null ? `${m.jdFit}% fit` : undefined} />
              ))}
            </Section>

            <Section icon={CalendarDays} title="Interviews" href="/dashboard/calendar" linkLabel="Open calendar" count={upcoming.length}>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>No interviews parsed from recent emails.</p>
              ) : upcoming.map(i => (
                <Row key={i.id} primary={`${i.company} — ${i.role}`} secondary={i.kind} meta={i.with || undefined} />
              ))}
            </Section>

            <Section icon={FileSignature} title="RTRs & rates" href="/dashboard/mail" linkLabel="Review them" count={rtrs.length + rates.length}>
              {rtrs.length + rates.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>No RTR forms or rate confirmations waiting.</p>
              ) : (
                <>
                  {rtrs.slice(0, 2).map(m => <Row key={m.id} primary={m.company} secondary={`RTR — ${m.role}`} />)}
                  {rates.slice(0, 2).map(m => <Row key={m.id} primary={m.company} secondary={`${m.rate || "Rate"} — ${m.role}`} />)}
                </>
              )}
            </Section>

            <Section icon={Send} title="Drafts waiting" href="/dashboard/mail" linkLabel="Review drafts" count={drafts.length}>
              {drafts.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>No unsent drafts.</p>
              ) : drafts.slice(0, 4).map(d => (
                <Row key={d.id} primary={d.subject} secondary={`to ${(d.to || "").split("<")[0].trim().slice(0, 30)}`} />
              ))}
            </Section>

            <Section icon={History} title="Waiting on them" href="/dashboard/mail" linkLabel="See all" count={radar.length}>
              {radar.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>Nobody owes you a reply.</p>
              ) : radar.slice(0, 4).map(r => (
                <Row key={r.threadId} primary={r.subject} secondary={(r.vendor || r.to || "").split("<")[0].trim().slice(0, 32)}
                  meta={`${r.daysWaiting}d`} accent={r.daysWaiting >= 10} />
              ))}
            </Section>

            <Section icon={ShieldAlert} title="Watchdog" href="/dashboard/agent" linkLabel="Ask the agent" count={notes.length}>
              {notes.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                  No alerts. The watchdog checks for duplicate submissions, RTR conflicts, and quiet vendors.
                </p>
              ) : notes.map(n => (
                <Row key={n.id} primary={n.title} secondary={n.body.slice(0, 80)} />
              ))}
            </Section>
          </div>

          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 16, letterSpacing: "-0.015em", margin: "0 0 12px" }}>All your tabs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <LensButton href="/dashboard/mail" icon={Inbox} label="Inbox" sub="Every recruiter email, sorted" />
              <LensButton href="/dashboard/tracker" icon={Briefcase} label="My Jobs" sub="Applications and where they stand" />
              <LensButton href="/dashboard/calendar" icon={CalendarDays} label="Interviews" sub="What's coming up" />
              <LensButton href="/dashboard/workflows" icon={Repeat} label="Follow-ups" sub="Automatic check-ins" />
              <LensButton href="/dashboard/agent" icon={Bot} label="Agent" sub="Your job-hunt strategist" />
              <LensButton href="/dashboard/connections" icon={Link2} label="Gmail accounts" sub="Connect and manage inboxes" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
