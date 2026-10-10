"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ClipboardList, Landmark, Award, Target, History, Zap,
  ArrowRight, Sparkles, Lightbulb,
} from "lucide-react"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Application {
  id: string; company: string; role?: string; title?: string
  stage?: string; status?: string
  appliedDate?: string; appliedAt?: string; lastUpdated?: string
}
interface VisaEntry { id: string; type: string; status: string; expiryDate?: string; priority?: string }
interface CertEntry  { id: string; name: string; status: string; targetDate?: string }
interface GoalEntry  { id: string; title: string; targetDate: string; done: boolean }
interface SavedJob   { id: string; company?: string; title?: string; salary?: string }

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}
function todayFull() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

/* ── Insight card in the main-dashboard feature-card language ── */
function InsightCard({ icon: Icon, title, children, href, linkLabel }: {
  icon: typeof ClipboardList; title: string; children: React.ReactNode; href?: string; linkLabel?: string
}) {
  return (
    <article className="mf-feature">
      <div className="mf-feature-icon"><Icon size={25} aria-hidden="true" /></div>
      <h2>{title}</h2>
      <div style={{ flex: 1 }}>{children}</div>
      {href && linkLabel && (
        <Link href={href} className="mf-primary-link" style={{ marginTop: 20 }}>
          {linkLabel}<ArrowRight size={18} aria-hidden="true" />
        </Link>
      )}
    </article>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      background: "var(--surface-2)", borderRadius: 10,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ text, linkHref, linkText }: { text: string; linkHref?: string; linkText?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)" }}>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{text}</p>
      {linkHref && linkText && (
        <Link href={linkHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13.5, fontWeight: 650, color: "var(--text)", textDecoration: "none" }}>
          {linkText}<ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function BriefPage() {
  const [name, setName]       = useState("")
  const [apps, setApps]       = useState<Application[]>([])
  const [visas, setVisas]     = useState<VisaEntry[]>([])
  const [certs, setCerts]     = useState<CertEntry[]>([])
  const [goals, setGoals]     = useState<GoalEntry[]>([])
  const [saved, setSaved]     = useState<SavedJob[]>([])
  const [aiSummary, setAiSummary] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReady, setAiReady]     = useState(false)

  /* load data */
  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      setName(profile.full_name?.split(" ")[0] || profile.name?.split(" ")[0] || "")
      setApps(JSON.parse(localStorage.getItem("jd_applications_v2") || "[]"))
      setVisas(JSON.parse(localStorage.getItem("jd_visas") || "[]"))
      setCerts(JSON.parse(localStorage.getItem("jd_certs_v1") || "[]"))
      setGoals(JSON.parse(localStorage.getItem("jd_goals_v1") || "[]"))
      setSaved(JSON.parse(localStorage.getItem("jd_saved_ids") || "[]").map((id: string) => ({ id })))
    } catch { /* ignore */ }
  }, [])

  /* AI summary */
  async function generateSummary() {
    setAiLoading(true)
    const actionNeeded = apps.filter(a => ["interview", "assessment", "offer"].includes((a.stage ?? a.status ?? "")))
    const expiringVisas = visas.filter(v => v.expiryDate && daysUntil(v.expiryDate) < 60 && daysUntil(v.expiryDate) >= 0)
    const upcomingCerts = certs.filter(c => c.status === "in_progress" && c.targetDate && daysUntil(c.targetDate) < 30)
    const urgentGoals   = goals.filter(g => !g.done && g.targetDate && daysUntil(g.targetDate) < 7)

    const context = [
      `Applications: ${apps.length} total, ${actionNeeded.length} need action (${actionNeeded.map(a => a.company).join(", ")}).`,
      expiringVisas.length ? `Visa alerts: ${expiringVisas.map(v => `${v.type} expires in ${daysUntil(v.expiryDate!)}d`).join(", ")}.` : "",
      upcomingCerts.length ? `Upcoming certs: ${upcomingCerts.map(c => `${c.name} due ${fmtDate(c.targetDate!)}`).join(", ")}.` : "",
      urgentGoals.length   ? `Urgent goals due this week: ${urgentGoals.map(g => g.title).join(", ")}.` : "",
      saved.length ? `${saved.length} saved jobs not yet applied to.` : "",
    ].filter(Boolean).join(" ")

    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "daily_brief",
          instruction: `Write a brief, friendly 3-sentence career day summary for ${name || "the user"}: ${context} Focus on what they should prioritize today. Be specific and motivating.`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      setAiSummary(data.result || data.text || data.content || "")
    } catch { /* ignore */ }
    setAiLoading(false)
    setAiReady(true)
  }

  /* computed */
  const actionApps     = apps.filter(a => ["interview", "assessment", "offer"].includes((a.stage ?? a.status ?? "")))
  const staleApps      = apps.filter(a => (a.stage ?? a.status ?? "") === "applied" && (a.appliedDate ?? a.appliedAt) && daysUntil((a.appliedDate ?? a.appliedAt) as string) < -14)
  const expiringVisas  = visas.filter(v => v.expiryDate && daysUntil(v.expiryDate) < 90 && daysUntil(v.expiryDate) >= 0)
  const activeCerts    = certs.filter(c => c.status === "in_progress")
  const pendingGoals   = goals.filter(g => !g.done && g.targetDate && daysUntil(g.targetDate) < 14)
  const totalAlerts    = actionApps.length + staleApps.length + expiringVisas.length + pendingGoals.length

  const stats = [
    { label: "Applications", value: apps.length, sub: `${actionApps.length} need action`, href: "/dashboard/applications" },
    { label: "Saved jobs", value: saved.length, sub: "waiting to apply", href: "/dashboard/saved" },
    { label: "Certifications", value: activeCerts.length, sub: `${certs.filter(c => c.status === "completed").length} completed`, href: "/dashboard/skills" },
    { label: "Open goals", value: goals.filter(g => !g.done).length, sub: `${pendingGoals.length} due in 14 days`, href: "/dashboard/skills" },
  ]

  return (
    <div className="mf-home">
      <header className="mf-home-heading">
        <p className="mf-eyebrow">YOUR PROGRESS, TODAY</p>
        <h1>{greeting()}{name ? `, ${name}` : ""}.</h1>
        <p>{todayFull()}{totalAlerts > 0 ? ` — ${totalAlerts} thing${totalAlerts === 1 ? "" : "s"} need${totalAlerts === 1 ? "s" : ""} your attention.` : " — all clear."}</p>
      </header>

      {/* Today's note */}
      <section className="mf-access" aria-label="Today's note" style={{ borderTop: "1px solid var(--border)", marginTop: 0, paddingTop: 26 }}>
        <div>
          <h2>Today&apos;s note</h2>
          <p style={{ maxWidth: 560 }}>
            {aiReady && aiSummary
              ? aiSummary
              : "A short, specific read on what to prioritize today — built from your applications, deadlines, and goals."}
          </p>
        </div>
        <div className="mf-access-links">
          <button
            onClick={() => { if (!aiLoading) void generateSummary() }}
            className="mf-primary-link"
            style={{ border: "none", cursor: "pointer", minWidth: 220, justifyContent: "space-between" }}
            disabled={aiLoading}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={19} aria-hidden="true" />
              <span>{aiLoading ? "Writing it now…" : "Write today's note"}</span>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="mf-feature-grid" aria-label="Your numbers" style={{ marginTop: 32 }}>
        {stats.map(s => (
          <article className="mf-feature" key={s.label} style={{ padding: "22px 24px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{s.value}</div>
            <h2 style={{ fontSize: 16, margin: "8px 0 4px" }}>{s.label}</h2>
            <p style={{ fontSize: 13 }}>{s.sub}</p>
            <Link href={s.href} className="mf-primary-link" style={{ marginTop: 16 }}>
              View<ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>

      {/* Insight cards */}
      <section className="mf-feature-grid" aria-label="What needs you" style={{ marginTop: 20 }}>
        <InsightCard icon={ClipboardList} title="Needs action" href="/dashboard/applications" linkLabel="View all">
          {actionApps.length === 0 ? (
            <EmptyState text="All clear — no pending interviews or assessments." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {actionApps.slice(0, 4).map(a => (
                <Row key={a.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{a.company}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{a.role || a.title || ""}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "capitalize", color: "var(--text-muted)" }}>
                    {(a.stage ?? a.status ?? "").replace("_", " ")}
                  </span>
                </Row>
              ))}
              {actionApps.length > 4 && (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", textAlign: "center", margin: "4px 0 0" }}>
                  +{actionApps.length - 4} more
                </p>
              )}
            </div>
          )}
        </InsightCard>

        <InsightCard icon={Landmark} title="Visa & immigration" href="/dashboard/visa" linkLabel="Tracker">
          {expiringVisas.length === 0 && visas.length === 0 ? (
            <EmptyState text="No visa deadlines tracked yet." linkHref="/dashboard/visa" linkText="Add visa status" />
          ) : expiringVisas.length === 0 ? (
            <EmptyState text={`${visas.length} visa${visas.length > 1 ? "s" : ""} tracked — no urgent deadlines.`} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expiringVisas.map(v => {
                const days = daysUntil(v.expiryDate!)
                return (
                  <Row key={v.id}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 650 }}>{v.type}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: days < 30 ? 700 : 400 }}>
                        {days}d until expiry · {fmtDate(v.expiryDate!)}
                      </div>
                    </div>
                  </Row>
                )
              })}
            </div>
          )}
        </InsightCard>

        <InsightCard icon={Award} title="Certifications" href="/dashboard/skills" linkLabel="View all">
          {activeCerts.length === 0 ? (
            <EmptyState text="No certs in progress." linkHref="/dashboard/skills" linkText="Add certification" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeCerts.slice(0, 4).map(c => {
                const days = c.targetDate ? daysUntil(c.targetDate) : null
                return (
                  <Row key={c.id}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 650 }}>{c.name}</div>
                      {days !== null && (
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          {days < 0 ? "Overdue" : `${days}d to exam · ${fmtDate(c.targetDate!)}`}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)" }}>Studying</span>
                  </Row>
                )
              })}
            </div>
          )}
        </InsightCard>

        <InsightCard icon={Target} title="Goals due soon" href="/dashboard/skills" linkLabel="All goals">
          {pendingGoals.length === 0 ? (
            goals.length === 0
              ? <EmptyState text="No learning goals set." linkHref="/dashboard/skills" linkText="Add a goal" />
              : <EmptyState text="No goals due in the next 14 days — great pace." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingGoals.slice(0, 4).map(g => {
                const days = daysUntil(g.targetDate)
                return (
                  <Row key={g.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.35 }}>{g.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                        Due {fmtDate(g.targetDate)} · {days < 0 ? "overdue" : `${days}d left`}
                      </div>
                    </div>
                  </Row>
                )
              })}
            </div>
          )}
        </InsightCard>

        {staleApps.length > 0 && (
          <InsightCard icon={History} title="Going stale" href="/dashboard/applications" linkLabel="Pipeline">
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Applied 14+ days ago with no update — worth a follow-up.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {staleApps.slice(0, 4).map(a => (
                <Row key={a.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{a.company}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      {(a.appliedDate ?? a.appliedAt) ? `Applied ${fmtDate((a.appliedDate ?? a.appliedAt) as string)}` : "Applied"}
                    </div>
                  </div>
                </Row>
              ))}
              {staleApps.length > 4 && (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", textAlign: "center", margin: "4px 0 0" }}>
                  +{staleApps.length - 4} more
                </p>
              )}
            </div>
          </InsightCard>
        )}

        <InsightCard icon={Zap} title="Quick actions">
          <div className="mf-access-links" style={{ marginTop: 4 }}>
            {[
              { label: "Tailor resume", sub: "Fit it to a job post", href: "/dashboard/resume/builder" },
              { label: "Prep interview", sub: "Practice with Kompas", href: "/dashboard/prep" },
              { label: "Ask the Agent", sub: "Strategy on any role", href: "/dashboard/agent" },
              { label: "Check salary", sub: "Know your number", href: "/dashboard/salary" },
            ].map(q => (
              <Link key={q.label} href={q.href}>
                <span>{q.label}<small>{q.sub}</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </InsightCard>
      </section>

      {/* Tip of the day */}
      <section className="mf-access" aria-label="Tip of the day">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lightbulb size={18} aria-hidden="true" /> Tip of the day
          </h2>
          <p style={{ maxWidth: 640 }}>{DAILY_TIPS[new Date().getDay()]}</p>
        </div>
      </section>
    </div>
  )
}

const DAILY_TIPS = [
  "Sunday recharge: Spend 20 minutes updating your resume with concrete metrics before the week starts — a 1% improvement compounded weekly adds up.",
  "Start Mondays by applying to 3 roles before 10am. Companies review weekend applications first thing, giving you an early-week edge.",
  "Follow up with recruiters on Tuesday — it's statistically the highest-response day of the week for hiring teams.",
  "Mid-week: update your LinkedIn headline to match your target role. Recruiters search by title, not job history.",
  "Thursday is the best day to send follow-up emails after interviews — decision makers often finalize hires on Friday.",
  "Before the weekend, review your pipeline. Any applications 7+ days without a response deserve a polite follow-up.",
  "Use Saturday to prep for next week: review 3 JDs for your target role and note the recurring skills — those belong on your resume.",
]
