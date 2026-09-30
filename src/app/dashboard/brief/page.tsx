"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import PageIntro from "../_components/page-intro"

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Application {
  id: string; company: string; role?: string; title?: string
  // jobs/page.tsx writes "stage"; legacy pipeline/brief wrote "status" — support both
  stage?: string; status?: string
  // jobs/page.tsx writes "appliedDate"; older schemas wrote "appliedAt" — support both
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

const ACTION_STATUS = ["applied", "interview", "assessment", "offer", "follow_up", "rejected"]

/* ═══════════════════════════════════════════════════════════════════
   INSIGHT CARD
   ═══════════════════════════════════════════════════════════════════ */
function InsightCard({ icon, title, color, children, href, linkLabel }: {
  icon: string; title: string; color: string; children: React.ReactNode; href?: string; linkLabel?: string
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid #e6e2d9", borderRadius: 14, padding: "20px 22px", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#161510" }}>{title}</span>
        </div>
        {href && linkLabel && (
          <Link href={href} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>{linkLabel} →</Link>
        )}
      </div>
      {children}
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

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 900 }}>

      <PageIntro page="/dashboard/brief"
        action={{ label: aiLoading ? "Writing it now…" : "Write today's note", onClick: () => { if (!aiLoading) void generateSummary() } }} />
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0 }}>{todayFull()} · {greeting()}{name ? `, ${name}` : ""}.</p>

        {/* AI Summary */}
        {(aiReady || aiSummary) && (
          <div style={{ marginTop: 16, padding: "18px 22px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 16, color: "var(--text)", lineHeight: 1.7 }}>
            <div className="ink-label" style={{ marginBottom: 6 }}>Today&apos;s note</div>
            {aiSummary || "No specific actions needed right now — keep applying!"}
          </div>
        )}

        {/* Alert count */}
        {totalAlerts > 0 && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AlertPill count={actionApps.length} label="need action" color="#1c1b16"/>
            {staleApps.length > 0 && <AlertPill count={staleApps.length} label="stale (14d+)" color="#7e7a68"/>}
            {expiringVisas.length > 0 && <AlertPill count={expiringVisas.length} label="visa alert" color="#2e2d27"/>}
            {pendingGoals.length > 0 && <AlertPill count={pendingGoals.length} label="goal due soon" color="#605d51"/>}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Applications",  value: apps.length,          sub: `${actionApps.length} active`,       color: "#1c1b16", href: "/dashboard/applications" },
          { label: "Saved Jobs",    value: saved.length,         sub: "waiting to apply",                   color: "#605d51", href: "/dashboard/saved" },
          { label: "Certs Active",  value: activeCerts.length,   sub: `${certs.filter(c=>c.status==="completed").length} completed`, color: "#58564c", href: "/dashboard/skills" },
          { label: "Open Goals",    value: goals.filter(g=>!g.done).length, sub: `${pendingGoals.length} due in 14d`, color: "#7e7a68", href: "/dashboard/skills" },
        ].map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--surface)", border: "1px solid #e6e2d9", borderRadius: 12, padding: "14px 18px", cursor: "pointer", transition: "box-shadow .15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(12,11,8,0.07)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "none"}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#161510", marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11.5, color: "#6e6b5b", marginTop: 1 }}>{s.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Applications needing action */}
        <InsightCard icon="📋" title="Applications Needing Action" color="#1c1b16" href="/dashboard/applications" linkLabel="View all">
          {actionApps.length === 0 ? (
            <EmptyState icon="✅" text="All clear — no pending interviews or assessments" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {actionApps.slice(0, 4).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f7f5f0", borderRadius: 8 }}>
                  <StatusDot status={(a.stage ?? a.status ?? "")}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#161510" }}>{a.company}</div>
                    <div style={{ fontSize: 11.5, color: "#6e6b5b" }}>{a.role || a.title || (a.stage ?? a.status ?? "")}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: statusBg((a.stage ?? a.status ?? "")), color: statusColor((a.stage ?? a.status ?? "")) }}>
                    {(a.stage ?? a.status ?? "").replace("_", " ")}
                  </span>
                </div>
              ))}
              {actionApps.length > 4 && <div style={{ fontSize: 12, color: "#6e6b5b", textAlign: "center" }}>+{actionApps.length - 4} more</div>}
            </div>
          )}
        </InsightCard>

        {/* Visa & immigration */}
        <InsightCard icon="🛂" title="Visa & Immigration" color="#2e2d27" href="/dashboard/visa" linkLabel="Tracker">
          {expiringVisas.length === 0 && visas.length === 0 ? (
            <EmptyState icon="🟢" text="No visa deadlines tracked yet" linkHref="/dashboard/visa" linkText="Add visa status"/>
          ) : expiringVisas.length === 0 ? (
            <EmptyState icon="✅" text={`${visas.length} visa${visas.length>1?"s":""} tracked — no urgent deadlines`}/>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expiringVisas.map(v => {
                const days = daysUntil(v.expiryDate!)
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: days < 30 ? "rgba(132,128,109,0.04)" : "#f7f5f0", borderRadius: 8, border: `1px solid ${days < 30 ? "rgba(132,128,109,0.15)" : "#e6e2d9"}` }}>
                    <span style={{ fontSize: 16 }}>{days < 30 ? "⚠️" : "📄"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#161510" }}>{v.type}</div>
                      <div style={{ fontSize: 11.5, color: days < 30 ? "#2e2d27" : "#6e6b5b", fontWeight: days < 30 ? 700 : 400 }}>{days}d until expiry · {fmtDate(v.expiryDate!)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </InsightCard>

        {/* Certifications */}
        <InsightCard icon="🏅" title="Certification Progress" color="#58564c" href="/dashboard/skills" linkLabel="View all">
          {activeCerts.length === 0 ? (
            <EmptyState icon="📚" text="No certs in progress — start studying!" linkHref="/dashboard/skills" linkText="Add certification"/>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeCerts.slice(0, 4).map(c => {
                const days = c.targetDate ? daysUntil(c.targetDate) : null
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f7f5f0", borderRadius: 8 }}>
                    <span style={{ fontSize: 16 }}>📖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#161510" }}>{c.name}</div>
                      {days !== null && <div style={{ fontSize: 11.5, color: days < 14 ? "#7e7a68" : "#6e6b5b", fontWeight: days < 14 ? 700 : 400 }}>
                        {days < 0 ? "⚠ Overdue" : `${days}d to exam · ${fmtDate(c.targetDate!)}`}
                      </div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(176,170,153,0.1)", color: "#7e7a68" }}>Studying</span>
                  </div>
                )
              })}
            </div>
          )}
        </InsightCard>

        {/* Learning Goals */}
        <InsightCard icon="📚" title="Goals Due Soon" color="#605d51" href="/dashboard/skills" linkLabel="All goals">
          {pendingGoals.length === 0 ? (
            goals.length === 0
              ? <EmptyState icon="🎯" text="No learning goals set" linkHref="/dashboard/skills" linkText="Add a goal"/>
              : <EmptyState icon="✅" text="No goals due in the next 14 days — great pace!"/>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingGoals.slice(0, 4).map(g => {
                const days = daysUntil(g.targetDate)
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f7f5f0", borderRadius: 8 }}>
                    <span style={{ fontSize: 15 }}>{days < 3 ? "🔴" : days < 7 ? "🟡" : "🟢"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#161510", lineHeight: 1.3 }}>{g.title}</div>
                      <div style={{ fontSize: 11.5, color: days < 3 ? "#2e2d27" : "#6e6b5b", fontWeight: days < 3 ? 700 : 400 }}>Due {fmtDate(g.targetDate)} · {days < 0 ? "overdue" : `${days}d`}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </InsightCard>

        {/* Stale Applications */}
        {staleApps.length > 0 && (
          <InsightCard icon="⏰" title="Follow Up These" color="#7e7a68" href="/dashboard/applications" linkLabel="Pipeline">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12.5, color: "#6e6b5b", marginBottom: 4, marginTop: -4 }}>Applied 14+ days ago with no update — consider following up</p>
              {staleApps.slice(0, 4).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(176,170,153,0.04)", borderRadius: 8, border: "1px solid rgba(176,170,153,0.15)" }}>
                  <span style={{ fontSize: 15 }}>📮</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#161510" }}>{a.company}</div>
                    <div style={{ fontSize: 11.5, color: "#6e6b5b" }}>{(a.appliedDate ?? a.appliedAt) ? `Applied ${fmtDate((a.appliedDate ?? a.appliedAt) as string)}` : "Applied"}</div>
                  </div>
                </div>
              ))}
              {staleApps.length > 4 && <div style={{ fontSize: 12, color: "#6e6b5b", textAlign: "center" }}>+{staleApps.length - 4} more</div>}
            </div>
          </InsightCard>
        )}

        {/* Quick Actions */}
        <div style={{ background: "linear-gradient(135deg, #15140f, #2d2c26)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>⚡ Quick Actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Tailor Resume",    href: "/dashboard/resume/builder", icon: "📄", color: "#6e6b5b" },
              { label: "Prep Interview",  href: "/dashboard/prep",           icon: "🎤", color: "#58564c" },
              { label: "Write Cover Ltr", href: "/dashboard/cover-letters",  icon: "✉️", color: "#605d51" },
              { label: "Ask Copilot",     href: "/dashboard/copilot",        icon: "⚡", color: "#7e7a68" },
              { label: "Check Salary",    href: "/dashboard/salary",         icon: "💰", color: "#6a6757" },
              { label: "Browse Jobs",     href: "/dashboard/recommended",    icon: "🔍", color: "#5e5b50" },
            ].map(q => (
              <Link key={q.label} href={q.href} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 9, cursor: "pointer", transition: "background .15s", border: "1px solid rgba(255,255,255,0.08)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}>
                  <span style={{ fontSize: 16 }}>{q.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{q.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Market tip of the day */}
      <div style={{ marginTop: 16, background: "rgba(107,104,88,0.04)", border: "1px solid rgba(107,104,88,0.12)", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>💡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>Career Tip of the Day</div>
          <div style={{ fontSize: 13.5, color: "#161510", lineHeight: 1.6 }}>
            {DAILY_TIPS[new Date().getDay()]}
          </div>
        </div>
      </div>

    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  interview:  { color: "#7c7866", bg: "rgba(155,150,130,0.1)", dot: "#7c7866" },
  assessment: { color: "#605d51", bg: "rgba(122,118,100,0.1)", dot: "#605d51" },
  offer:      { color: "#58564c", bg: "rgba(163,158,139,0.1)", dot: "#58564c" },
  applied:    { color: "#6e6b5b", bg: "rgba(121,117,100,0.1)", dot: "#6e6b5b" },
  follow_up:  { color: "#7e7a68", bg: "rgba(176,170,153,0.1)", dot: "#7e7a68" },
  rejected:   { color: "#2e2d27", bg: "rgba(132,128,109,0.1)",  dot: "#2e2d27" },
}
function statusColor(s: string) { return STATUS_STYLES[s]?.color ?? "#6e6b5b" }
function statusBg(s: string) { return STATUS_STYLES[s]?.bg ?? "rgba(121,117,100,0.1)" }
function StatusDot({ status }: { status: string }) {
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_STYLES[status]?.dot ?? "#6e6b5b", flexShrink: 0 }}/>
}

function AlertPill({ count, label, color }: { count: number; label: string; color: string }) {
  if (!count) return null
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: `${color}14`, color, border: `1px solid ${color}30` }}>
      {count} {label}
    </span>
  )
}

function EmptyState({ icon, text, linkHref, linkText }: { icon: string; text: string; linkHref?: string; linkText?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0", color: "#6e6b5b" }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{text}</div>
      {linkHref && linkText && (
        <Link href={linkHref} style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>{linkText} →</Link>
      )}
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
