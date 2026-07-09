"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { connectGmail } from "@/lib/google-auth"
import PageHeader from "@/components/layout/PageHeader"
import { Mail, Loader2 } from "lucide-react"

// ── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0b1220",
  card:   "#111827",
  card2:  "#141f30",
  border: "rgba(255,255,255,.07)",
  text:   "#f0f4ff",
  muted:  "#8892a8",
  hint:   "#4b5568",
  accent: "#3b82f6",
  teal:   "#14b8a6",
  green:  "#60a5fa",
  amber:  "#f59e0b",
  red:    "#ef4444",
  purple: "#8b5cf6",
}

// ── Mock thread data ───────────────────────────────────────────────────────────
const MOCK_THREADS = [
  {
    id: "t1", company: "TCS", logo: "TD", logoColor: "#1d6fc4",
    subject: "Interview Invitation — Senior Java Developer",
    preview: "Congratulations! We'd like to invite you for a technical interview for the Sr. Java Developer position...",
    time: "9:42 AM", unread: true, label: "Interview", labelColor: C.green,
    aiSummary: "TCS wants to schedule a technical interview for the W2 Java contract role. They ask for your availability this week.",
    actionNeeded: "Reply with 3 time slots this week.",
    from: "talent@tcs.com",
  },
  {
    id: "t2", company: "Apex Systems", logo: "AS", logoColor: "#7c3aed",
    subject: "RE: Your Resume — Cybersecurity Openings",
    preview: "Thank you for sending your resume. We have two openings that match your profile — an AppSec role in NYC...",
    time: "Yesterday", unread: true, label: "Recruiter", labelColor: C.purple,
    aiSummary: "Recruiter has 2 matching cyber roles: AppSec NYC ($90-110/hr W2) and Cloud Security Remote ($100-120/hr C2C). They want your availability for a call.",
    actionNeeded: "Reply to confirm phone screen. Ask about H1B sponsorship availability.",
    from: "recruiter@apexsystems.com",
  },
  {
    id: "t3", company: "Infosys BPM", logo: "IB", logoColor: "#1d6fc4",
    subject: "Application Update: DevOps Engineer",
    preview: "We regret to inform you that your application has been reviewed and we will not be moving forward...",
    time: "2 days ago", unread: false, label: "Rejection", labelColor: C.red,
    aiSummary: "Rejection for DevOps Engineer contract at Infosys. No specific reason given. C2C contract, Austin TX.",
    actionNeeded: "No action needed. Consider following up in 30 days for other openings.",
    from: "noreply@infosys.com",
  },
  {
    id: "t4", company: "Cognizant", logo: "CG", logoColor: "#0891b2",
    subject: "Offer Letter — Python Data Engineer",
    preview: "We are pleased to extend an offer for the position of Python Data Engineer (W2 Contract)...",
    time: "3 days ago", unread: true, label: "Offer!", labelColor: C.amber,
    aiSummary: "OFFER: Python Data Engineer, W2, $75/hr, Remote, 9 months. Start date: July 14. Benefits included. Counter possible — market is $80-90/hr for this profile.",
    actionNeeded: "Review offer letter. Consider countering at $82/hr based on your profile.",
    from: "offers@cognizant.com",
  },
  {
    id: "t5", company: "HCL Technologies", logo: "HC", logoColor: "#dc2626",
    subject: "Following up — ServiceNow Developer opening",
    preview: "Hi, I wanted to follow up on the ServiceNow Developer position I reached out about last week...",
    time: "4 days ago", unread: false, label: "Follow-up", labelColor: C.teal,
    aiSummary: "Recruiter following up on ServiceNow Developer role. $85-105/hr C2H. Chicago. H1B transfer OK per earlier conversation.",
    actionNeeded: "Reply if still interested. Good H1B-friendly firm.",
    from: "staffing@hcl.com",
  },
  {
    id: "t6", company: "LinkedIn Job Alerts", logo: "LI", logoColor: "#0077b5",
    subject: "17 new jobs match: 'Cybersecurity' 'H1B' 'Remote'",
    preview: "Based on your job alert, here are 17 new postings that match your search criteria...",
    time: "Today", unread: false, label: "Job Alert", labelColor: C.accent,
    aiSummary: "17 new cybersecurity jobs flagged. Top matches: Cloud Security Engineer (Palo Alto, Remote, GC OK), AppSec Lead (NYC, H1B sponsor listed), GRC Analyst (Chicago, W2 only).",
    actionNeeded: "Review top 3 matches. Tailor resume for Cloud Security role first.",
    from: "jobs-noreply@linkedin.com",
  },
]

type Thread = typeof MOCK_THREADS[0]

// ── Stage → label/color mapping ────────────────────────────────────────────────
const STAGE_LABEL: Record<string, string> = {
  applied:   "Applied", screening: "Recruiter", interview: "Interview",
  technical: "Technical", offer: "Offer!", rejected: "Rejection",
}
const STAGE_COLOR: Record<string, string> = {
  applied:   C.accent, screening: C.purple, interview: C.green,
  technical: C.teal, offer: C.amber, rejected: C.red,
}
const LOGO_COLORS = [
  "#1d6fc4","#7c3aed","#0891b2","#dc2626","#059669","#d97706","#6366f1",
]

interface ParsedApplication {
  id: string; company: string; role: string; location: string; remote: boolean
  salary: string; stage: string; appliedDate: string; notes: string; url: string
  visa: string; priority: "high"|"mid"|"low"; source: string; gmailThreadId: string
}

function toThread(app: ParsedApplication, idx: number): Thread {
  const initials = app.company.split(/\s+/).map(w => w[0]).join("").slice(0,2).toUpperCase() || "?"
  const logoColor = LOGO_COLORS[idx % LOGO_COLORS.length]
  const stage = app.stage || "applied"
  const date = app.appliedDate
    ? new Date(app.appliedDate).toLocaleDateString("en-US", { month:"short", day:"numeric" })
    : "Recent"
  return {
    id:           app.id || app.gmailThreadId,
    company:      app.company,
    logo:         initials,
    logoColor,
    subject:      app.role || "Job Application",
    preview:      app.notes || `${stage} — ${app.location || (app.remote ? "Remote" : "On-site")}`,
    time:         date,
    unread:       app.priority === "high" || stage === "offer" || stage === "interview",
    label:        STAGE_LABEL[stage] ?? stage,
    labelColor:   STAGE_COLOR[stage] ?? C.muted,
    aiSummary:    `${app.company} — ${app.role || "role"}. Stage: ${stage}. ${app.salary ? `Salary: ${app.salary}. ` : ""}${app.location || (app.remote ? "Remote" : "")}`,
    actionNeeded: stage === "offer"      ? "Review offer and respond."
                : stage === "interview"  ? "Prepare for your interview and confirm attendance."
                : stage === "technical"  ? "Complete the technical assessment."
                : stage === "screening"  ? "Reply to schedule your phone screen."
                : "",
    from:         app.url || "",
  }
}

// ── Label badge ───────────────────────────────────────────────────────────────
function Label({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: "uppercase", letterSpacing: ".05em", flexShrink: 0,
    }}>{text}</span>
  )
}

// ── Gmail connect state ───────────────────────────────────────────────────────
function ConnectBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <div style={{
      background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)",
      borderRadius: 12, padding: "16px 20px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ fontSize: 24 }}>📧</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Connect your Gmail</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          MarketFit reads your inbox to surface recruiter emails, track replies, and draft responses automatically.
        </div>
      </div>
      <button
        onClick={onConnect}
        style={{
          padding: "9px 18px", borderRadius: 9, background: C.accent,
          color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
          boxShadow: `0 4px 14px ${C.accent}44`, flexShrink: 0,
        }}
      >Connect Gmail →</button>
    </div>
  )
}

export default function EmailDashboard() {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [selected, setSelected] = useState<Thread | null>(null)
  const [filter, setFilter] = useState<"all" | "unread" | "action">("all")
  const [draftVisible, setDraftVisible] = useState(false)
  const [draft, setDraft] = useState("")
  // Start empty — MOCK_THREADS only shown in demo (not-connected) mode
  const [allThreads, setAllThreads] = useState<Thread[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  // Check localStorage for connected state + process OAuth callback
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("gmail") === "connected") {
        localStorage.setItem("mf_gmail_connected", "1")
        window.history.replaceState({}, "", window.location.pathname)
      }
      const isConnected = !!localStorage.getItem("mf_gmail_connected")
      setConnected(isConnected)
      if (isConnected) {
        syncGmail()
      } else {
        // Not connected → show mock threads as a feature preview
        setAllThreads(MOCK_THREADS)
        setSyncDone(true)
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function syncGmail() {
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 90, max: 50 }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.applications && data.applications.length > 0) {
          setAllThreads((data.applications as ParsedApplication[]).map(toThread))
        } else {
          // Synced successfully but no recruiter emails found yet — show empty state
          setAllThreads([])
        }
      } else {
        // API error — show empty state, not fake data
        setAllThreads([])
      }
    } catch {
      // Network error or Gmail not configured — show empty state for connected users
      setAllThreads([])
    } finally {
      setSyncing(false)
      setSyncDone(true)
    }
  }

  async function connect() {
    setSyncDone(false)
    setAllThreads([])
    try {
      await connectGmail()
    } catch {
      try { localStorage.setItem("mf_gmail_connected", "1") } catch {}
      setConnected(true)
      syncGmail()
    }
  }

  const threads = allThreads.filter(t => {
    if (filter === "unread") return t.unread
    if (filter === "action") return !!t.actionNeeded
    return true
  })

  function generateDraft(thread: Thread) {
    const templates: Record<string, string> = {
      "t1": `Hi Team,\n\nThank you for the interview invitation for the Senior Java Developer position.\n\nI'm available for a technical interview on:\n- Tuesday, July 2nd: 10am–2pm CT\n- Wednesday, July 3rd: 9am–12pm CT\n- Thursday, July 4th: 1pm–4pm CT\n\nPlease let me know which slot works best. Looking forward to speaking with the team.\n\nBest regards,`,
      "t2": `Hi,\n\nThank you for reaching out! Both the AppSec NYC and Cloud Security Remote roles sound interesting.\n\nCould you share more about:\n1. H1B sponsorship availability for both roles\n2. Whether the NYC role is open to hybrid arrangement\n\nI'm available for a call this week — Tuesday or Thursday afternoon works well.\n\nBest,`,
      "t4": `Hi,\n\nThank you for the offer — I'm excited about this opportunity.\n\nAfter reviewing the offer, I'd like to discuss the rate. Based on market research for Python Data Engineers with my experience level, I was hoping we could explore $82/hr. I'm flexible on start date and committed to the 9-month engagement.\n\nAre you able to revisit the compensation?\n\nBest regards,`,
      "t5": `Hi,\n\nThank you for following up on the ServiceNow Developer role. I'm still interested.\n\nA few quick questions:\n1. Can you confirm H1B transfer is supported for this role?\n2. Is there flexibility for partial remote (3 days Chicago, 2 days remote)?\n\nLooking forward to connecting.\n\nBest,`,
    }
    setDraft(templates[thread.id] || `Hi,\n\nThank you for your email regarding ${thread.subject}.\n\nI'll review and respond shortly.\n\nBest regards,`)
    setDraftVisible(true)
  }

  const unreadCount = allThreads.filter(t => t.unread).length
  const actionCount = allThreads.filter(t => !!t.actionNeeded).length

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <PageHeader
          icon={<Mail size={17}/>}
          title="Email Updates"
          description={syncing ? "Syncing Gmail…" : connected ? "Recruiter emails · AI summaries · Smart reply drafts" : "Connect Gmail to track recruiter emails automatically"}
          actions={
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Unread", value: unreadCount, color: C.accent },
                { label: "Need Action", value: actionCount, color: C.amber },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "6px 12px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          }
        />
      </div>

      {!connected && <ConnectBanner onConnect={connect} />}

      {/* ── Layout: thread list + detail ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "340px 1fr" : "1fr", gap: 14 }}>
        {/* Thread list */}
        <div>
          {/* Filter tabs */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 12,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 3,
          }}>
            {(["all", "unread", "action"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 8, border: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: filter === f ? C.accent : "transparent",
                  color: filter === f ? "#fff" : C.muted,
                  transition: "all .15s",
                }}
              >
                {f === "all" ? "All" : f === "unread" ? `Unread (${unreadCount})` : `Action (${actionCount})`}
              </button>
            ))}
          </div>

          {/* Demo preview banner when not connected */}
          {!connected && syncDone && (
            <div style={{
              background: "rgba(107,114,128,.08)", border: "1px dashed rgba(107,114,128,.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>👁️</span>
              <span style={{ fontSize: 12, color: C.muted }}>
                Preview — connect Gmail above to see your real recruiter emails here.
              </span>
            </div>
          )}

          {/* Empty state when connected but no emails synced yet */}
          {connected && syncDone && allThreads.length === 0 && !syncing && (
            <div style={{
              textAlign: "center", padding: "48px 24px",
              background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>No recruiter emails yet</p>
              <p style={{ fontSize: 13, color: C.muted, maxWidth: 340, margin: "0 auto" }}>
                MarketFit scans your inbox for job applications, interview invitations, and offers.
                Check back after you start applying — emails will appear here automatically.
              </p>
            </div>
          )}

          {/* Syncing indicator */}
          {connected && syncing && (
            <div style={{
              textAlign: "center", padding: "40px 24px",
              background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 13, color: C.muted }}>⟳ Scanning your inbox…</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {threads.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t); setDraftVisible(false) }}
                style={{
                  background: selected?.id === t.id ? "#1e2a40" : C.card,
                  border: `1px solid ${selected?.id === t.id ? C.accent + "50" : C.border}`,
                  borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                  transition: "all .15s",
                  borderLeft: t.unread ? `3px solid ${C.accent}` : `3px solid transparent`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: t.logoColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 11,
                  }}>{t.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: t.unread ? 700 : 500, color: C.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{t.company}</span>
                      <span style={{ fontSize: 10, color: C.hint, flexShrink: 0, marginLeft: 6 }}>{t.time}</span>
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: t.unread ? 600 : 400, color: "#cbd5e1",
                  marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{t.subject}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Label text={t.label} color={t.labelColor} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail pane */}
        {selected && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", gap: 16,
          }}>
            {/* Thread header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>
                  {selected.subject}
                </h2>
                <div style={{ fontSize: 12, color: C.muted }}>From: {selected.from} · {selected.time}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "transparent", border: "none", color: C.muted,
                  cursor: "pointer", fontSize: 18, padding: 4,
                }}
              >✕</button>
            </div>

            {/* AI Summary */}
            <div style={{
              background: "rgba(20,184,166,.08)", border: "1px solid rgba(20,184,166,.2)",
              borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: ".06em",
                textTransform: "uppercase", marginBottom: 8,
              }}>🤖 AI Summary</div>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, margin: 0 }}>
                {selected.aiSummary}
              </p>
            </div>

            {/* Action needed */}
            {selected.actionNeeded && (
              <div style={{
                background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 10, padding: "12px 16px",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: ".06em",
                  textTransform: "uppercase", marginBottom: 6,
                }}>⚡ Action Needed</div>
                <p style={{ fontSize: 13, color: "#fef3c7", lineHeight: 1.6, margin: 0 }}>
                  {selected.actionNeeded}
                </p>
              </div>
            )}

            {/* Original preview */}
            <div style={{
              borderTop: `1px solid ${C.border}`, paddingTop: 14,
            }}>
              <div style={{ fontSize: 11, color: C.hint, marginBottom: 8 }}>Original message preview:</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
                "{selected.preview}"
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <button
                onClick={() => generateDraft(selected)}
                style={{
                  padding: "9px 16px", borderRadius: 9, background: C.accent,
                  color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer",
                  boxShadow: `0 4px 14px ${C.accent}33`,
                }}
              >✨ Draft Reply</button>
              <button
                onClick={() => {
                  // Pre-fill the resume tailor with this job's context
                  try {
                    sessionStorage.setItem("jd_prefill_role", selected.subject)
                    sessionStorage.setItem("jd_prefill_company", selected.company)
                    sessionStorage.setItem("jd_prefill", `${selected.company} — ${selected.subject}\n\n${selected.preview}`)
                  } catch {}
                  router.push("/dashboard/resume")
                }}
                style={{
                  padding: "9px 14px", borderRadius: 9, background: "rgba(20,184,166,.12)",
                  color: C.teal, border: "1px solid rgba(20,184,166,.25)",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                }}
              >📄 Tailor Resume for Role</button>
              <button
                onClick={() => {
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const apps: any[] = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
                    const id = selected.id || `email-${Date.now()}`
                    if (!apps.find((a) => a.id === id)) {
                      apps.unshift({
                        id, company: selected.company, role: selected.subject,
                        stage: selected.label === "Offer!" ? "offer"
                          : selected.label === "Interview" ? "interview"
                          : selected.label === "Technical" ? "technical"
                          : selected.label === "Recruiter" ? "screening"
                          : "applied",
                        appliedDate: new Date().toISOString(),
                        source: "gmail", url: selected.from,
                      })
                      localStorage.setItem("jd_applications_v2", JSON.stringify(apps))
                    }
                    const ids: string[] = JSON.parse(localStorage.getItem("jd_applied_ids") || "[]")
                    if (!ids.includes(id)) {
                      ids.push(id)
                      localStorage.setItem("jd_applied_ids", JSON.stringify(ids))
                    }
                  } catch {}
                  try { sessionStorage.setItem("jd_view", "pipeline") } catch {}
                  router.push("/dashboard/jobs")
                }}
                style={{
                  padding: "9px 14px", borderRadius: 9, background: "rgba(255,255,255,.05)",
                  color: C.muted, border: `1px solid ${C.border}`,
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                }}
              >📋 Add to Pipeline</button>
            </div>

            {/* Draft area */}
            {draftVisible && (
              <div style={{
                background: "#0d1929", border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "16px",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: ".05em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>AI Draft Reply</div>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={10}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8,
                    background: "#0b1220", border: `1px solid ${C.border}`,
                    color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, resize: "vertical",
                    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button style={{
                    padding: "9px 20px", borderRadius: 9, background: C.green,
                    color: "#fff", fontWeight: 700, fontSize: 12, border: "none",
                    cursor: "pointer",
                  }}>✉️ Send Reply</button>
                  <button
                    onClick={() => setDraftVisible(false)}
                    style={{
                      padding: "9px 14px", borderRadius: 9,
                      background: "rgba(255,255,255,.05)", color: C.muted,
                      border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12,
                    }}
                  >Discard</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
