"use client"
import TypingDots from "../_components/typing-dots"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight, ArrowUpRight, Inbox, Briefcase, CalendarDays,
  Repeat, Bot, Link2, Mail as MailIcon, FileSignature,
  Send, History, ShieldAlert, RefreshCw, Sparkles, TrendingUp,
} from "lucide-react"
import { useGmailData } from "@/lib/use-gmail-data"
import type { Mail, App } from "../_suite/sample"

const WEEK_MS = 7 * 86_400_000

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function dateLine(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function parseApplied(s: string): number {
  const d = new Date(`${s}, 2026`)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

function Chapter({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 12px", fontWeight: 800 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function StoryCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
      padding: "18px 20px", boxShadow: "var(--shadow-card)",
    }}>
      {children}
    </div>
  )
}

function StoryLine({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.65 }}>{children}</p>
}

function Num({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
      padding: "16px 18px", boxShadow: "var(--shadow-card)", flex: "1 1 140px",
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
    </div>
  )
}

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

/* ── The page: one dashboard, one story ────────────────────────────────── */

export default function TodayPage() {
  const { mails, applications, interviews, drafts, radar, loading, connected, error, refresh } = useGmailData()
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    fetch("/api/agent/notifications", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j.ok) setNotes((j.notifications || []).filter((n: Note) => !n.read).slice(0, 3)) })
      .catch(() => {})
  }, [])

  const now = Date.now()
  // Only what is still open: an ask they made after you last wrote (yourTurn). A mail kept from before that field
  // existed has none, and is listed as it was.
  const needs = mails.filter(m => m.needsReply && m.yourTurn !== false)
  const upcoming = interviews.slice(0, 3)

  // ── The week's story ──
  const weekMails = mails.filter(m => (m.ts || 0) > now - WEEK_MS)
  const newIv = weekMails.filter(m => m.needsReply === "availability").length
  const newRtr = weekMails.filter(m => m.needsReply === "rtr").length
  const newRate = weekMails.filter(m => m.needsReply === "rate").length
  const newApps = applications.filter(a => parseApplied(a.applied) > now - WEEK_MS)
  const touched = radar.filter(r => r.daysWaiting <= 14)
  const quiet = radar.filter(r => r.daysWaiting > 3)
  const longest = radar[0]

  // ── State of the union ──
  const union: string[] = []
  if (needs.length) union.push(`${needs.length} need${needs.length === 1 ? "s" : ""} your reply`)
  if (quiet.length) union.push(`${quiet.length} owe${quiet.length === 1 ? "s" : ""} you a reply`)
  if (upcoming.length) union.push(`${upcoming.length} interview${upcoming.length === 1 ? "" : "s"} lined up`)
  if (drafts.length) union.push(`${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting for your tap`)
  const unionLine = union.length
    ? `${union.join(" · ")}. Nothing's on fire — here's the whole story.`
    : "Nothing needs you. The hunt is humming — here's the whole story."

  const landedBits: string[] = []
  if (newIv) landedBits.push(`${newIv} interview request${newIv === 1 ? "" : "s"}`)
  if (newRtr) landedBits.push(`${newRtr} RTR${newRtr === 1 ? "" : "s"}`)
  if (newRate) landedBits.push(`${newRate} rate confirmation${newRate === 1 ? "" : "s"}`)

  const hasStory = weekMails.length > 0 || newApps.length > 0 || touched.length > 0 || quiet.length > 0

  return (
    <div className="mf-home" style={{ paddingBottom: 56 }}>
      <header className="mf-home-heading">
        <p className="mf-eyebrow">{dateLine()}</p>
        <h1>{greeting()}, Eshwar.</h1>
        <p>{loading ? "Reading your inboxes — gathering your story…" : connected ? unionLine : "Connect your Gmail and I'll keep the story of your hunt right here — so you never have to hold it all in your head."}</p>
      </header>

      {error && !loading && (
        <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 14, border: "1px solid var(--danger-border)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, lineHeight: 1.6 }}>{error}</div>
          <button className="btn-outline" style={{ minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link href="/dashboard/connections" style={{ fontSize: 13, fontWeight: 700 }}>Check connections →</Link>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          <TypingDots label="Reading your inboxes…" />
        </div>
      ) : !connected ? (
        <StoryCard>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Sparkles size={20} style={{ flex: "none", marginTop: 2 }} />
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, letterSpacing: "-0.015em" }}>Your hunt, narrated</h2>
              <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)" }}>
                Once your inbox is connected, this page becomes your chief of staff: what landed this week,
                who you should nudge next, which interviews are coming — all in one story, so the hundred
                things in your head get to rest.
              </p>
              <Link href="/dashboard/connections" className="btn-accent" style={{ minHeight: 44, padding: "0 24px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                Connect Gmail <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </Link>
            </div>
          </div>
        </StoryCard>
      ) : (
        <>
          {hasStory && (
            <Chapter title="Your week in the hunt">
              <StoryCard>
                {weekMails.length > 0 && (
                  <StoryLine>
                    <TrendingUp size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    <strong>{weekMails.length} new thread{weekMails.length === 1 ? "" : "s"} landed this week</strong>
                    {landedBits.length > 0 && <> — {landedBits.join(", ")}</>}. We sorted every one of them for you.
                  </StoryLine>
                )}
                {newApps.length > 0 && (
                  <StoryLine>
                    You put yourself out there <strong>{newApps.length} time{newApps.length === 1 ? "" : "s"}</strong> this week:{" "}
                    {newApps.slice(0, 3).map((a: App) => a.role).join(" · ")}
                    {newApps.length > 3 && ` and ${newApps.length - 3} more`}. That's the work — we track the rest.
                  </StoryLine>
                )}
                {touched.length > 0 && (
                  <StoryLine>
                    You reached out to <strong>{touched.length} {touched.length === 1 ? "person" : "people"}</strong> in the last two weeks.{" "}
                    {quiet.length > 0
                      ? <>{quiet.length} {quiet.length === 1 ? "hasn't" : "haven't"} written back yet — that's normal, and we've got the nudges queued below.</>
                      : "Every one of them replied. That's a good hit rate."}
                  </StoryLine>
                )}
                {!hasStory && (
                  <StoryLine>A quiet week — no new threads, no new applications. The hunt hums on.</StoryLine>
                )}
              </StoryCard>
            </Chapter>
          )}

          {needs.length > 0 && (
            <Chapter title={`Needs you · ${needs.length}`}>
              <StoryCard>
                {needs.slice(0, 5).map(m => (
                  <Row key={m.id} primary={m.company} secondary={ask(m)}
                    meta={m.jdFit != null ? `${m.jdFit}% fit` : undefined} />
                ))}
                <Link href="/dashboard/mail" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  Open inbox <ArrowRight size={15} />
                </Link>
              </StoryCard>
            </Chapter>
          )}

          {(quiet.length > 0 || longest) && (
            <Chapter title="Follow-ups — we've got this">
              <StoryCard>
                {longest && (
                  <>
                    <StoryLine>
                      Longest silence: <strong>{(longest.vendor || longest.to || "").split("<")[0].trim().slice(0, 40) || "a vendor"}</strong>
                      {" "}— <strong>{longest.daysWaiting} days</strong> since you wrote
                      {longest.jobTitle ? <> about <em>{longest.jobTitle}</em></> : null}.
                    </StoryLine>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                      <Link href="/dashboard/agent" className="btn-accent" style={{ minHeight: 40, padding: "0 20px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
                        Draft the nudge <ArrowRight size={15} style={{ marginLeft: 6 }} />
                      </Link>
                      <Link href="/dashboard/mail" className="btn-outline" style={{ minHeight: 40, padding: "0 20px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
                        See all waiting
                      </Link>
                    </div>
                  </>
                )}
                {quiet.length > 1 && (
                  <div style={{ marginTop: 12 }}>
                    {quiet.slice(1, 4).map(r => (
                      <Row key={r.threadId} primary={r.subject} secondary={(r.vendor || r.to || "").split("<")[0].trim().slice(0, 36)}
                        meta={`${r.daysWaiting}d`} accent={r.daysWaiting >= 10} />
                    ))}
                  </div>
                )}
              </StoryCard>
            </Chapter>
          )}

          {upcoming.length > 0 && (
            <Chapter title={`Interviews · ${upcoming.length}`}>
              <StoryCard>
                {upcoming.map(i => (
                  <Row key={i.id} primary={`${i.company} — ${i.role}`} secondary={i.kind} meta={i.with || undefined} />
                ))}
                <Link href="/dashboard/calendar" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  Open calendar <ArrowRight size={15} />
                </Link>
              </StoryCard>
            </Chapter>
          )}

          {notes.length > 0 && (
            <Chapter title="Watchdog">
              <StoryCard>
                {notes.map(n => <Row key={n.id} primary={n.title} secondary={n.body.slice(0, 90)} />)}
                <Link href="/dashboard/agent" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  Ask the agent <ArrowRight size={15} />
                </Link>
              </StoryCard>
            </Chapter>
          )}

          <Chapter title="The numbers">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Num value={applications.filter(a => !["rejected", "offer"].includes(a.stage)).length} label="Active applications" />
              <Num value={upcoming.length} label="Interviews lined up" />
              <Num value={quiet.length} label="Waiting on a reply" />
              <Num value={drafts.length} label="Drafts for your tap" />
            </div>
          </Chapter>

          <Chapter title="All your tabs">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <LensButton href="/dashboard/mail" icon={Inbox} label="Inbox" sub="Every recruiter email, sorted" />
              <LensButton href="/dashboard/tracker" icon={Briefcase} label="My Jobs" sub="Applications and where they stand" />
              <LensButton href="/dashboard/calendar" icon={CalendarDays} label="Interviews" sub="What's coming up" />
              <LensButton href="/dashboard/workflows" icon={Repeat} label="Follow-ups" sub="Automatic check-ins" />
              <LensButton href="/dashboard/agent" icon={Bot} label="Agent" sub="Your job-hunt strategist" />
              <LensButton href="/dashboard/connections" icon={Link2} label="Gmail accounts" sub="Connect and manage inboxes" />
            </div>
          </Chapter>

          <p style={{ marginTop: 28, fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.6, textAlign: "center" }}>
            This page is the whole hunt. Everything else is one tap away —<br />
            the app serves you, not the other way around.
          </p>
        </>
      )}
    </div>
  )
}
