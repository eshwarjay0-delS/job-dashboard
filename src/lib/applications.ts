// Shared application-tracker model. The Jobs & Apply hub's inline PipelineView,
// the standalone /dashboard/pipeline kanban, and the /dashboard/applications
// table all read/write the SAME localStorage key with this SAME shape — so a
// change in any one shows up in the others. Schema mirrors the hub's inline
// AppItem exactly (do not diverge, or the tracker desyncs).

export const APPLICATIONS_KEY = "jd_applications_v2"

export type AppStage =
  | "applied" | "screening" | "interview" | "technical" | "offer" | "rejected"

export interface AppItem {
  id: string
  company: string
  role: string
  location: string
  remote: boolean
  salary: string
  stage: AppStage
  appliedDate: string        // ISO
  followUpDate?: string      // yyyy-mm-dd
  notes: string
  url: string
  visa: string
  priority: "high" | "mid" | "low"
}

export const APP_STAGES: { id: AppStage; label: string; color: string; rgb: string; icon: string }[] = [
  { id: "applied",   label: "Applied",   color: "#1d6fc4", rgb: "29,111,196",  icon: "📨" },
  { id: "screening", label: "Screening", color: "#d97706", rgb: "217,119,6",   icon: "📞" },
  { id: "interview", label: "Interview", color: "#1d6fc4", rgb: "29,111,196",  icon: "🤝" },
  { id: "technical", label: "Technical", color: "#7c3aed", rgb: "124,58,237",  icon: "💻" },
  { id: "offer",     label: "Offer",     color: "#0369a1", rgb: "3,105,161",   icon: "🎉" },
  { id: "rejected",  label: "Rejected",  color: "#dc2626", rgb: "220,38,38",   icon: "✗"  },
]

export const APP_PRIORITY: Record<AppItem["priority"], { label: string; color: string }> = {
  high: { label: "High", color: "#ef4444" },
  mid:  { label: "Mid",  color: "#f59e0b" },
  low:  { label: "Low",  color: "#6b7280" },
}

export function appUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function loadApplications(): AppItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) || "null")
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

export function saveApplications(apps: AppItem[]): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps)) } catch {}
}

// ── Gmail sync merge ─────────────────────────────────────────────────────────
// /api/gmail-sync parses application-related emails (confirmations, screens,
// interview invites, offers, rejections) and dedupes WITHIN that one sync
// batch by company+role, but returns the parsed list — nothing wrote it into
// the tracker (GmailSync's onSync callback was a no-op `() => {}`, so a user
// clicking "Sync Now" saw "N added" and a real 0 land in their tracker). This
// is the actual merge: dedupes against EVERY existing entry (by stable
// gmail_<threadId> id, falling back to company+role for anything the user
// already tracked manually), and for a thread synced before, only ever moves
// its stage forward (offer/rejected are terminal — an older or misclassified
// email should never downgrade a stage a later, more specific one confirmed).
const STAGE_RANK: Record<AppStage, number> = {
  applied: 0, screening: 1, interview: 2, technical: 3, offer: 4, rejected: 5,
}
export interface GmailParsedApp {
  id: string; company: string; role: string; location: string; remote: boolean
  salary: string; stage: string; appliedDate: string; notes: string; url: string
  visa: string; priority: AppItem["priority"]
}
export function mergeGmailApplications(fresh: GmailParsedApp[]): { added: number; updated: number } {
  const existing = loadApplications()
  const byId = new Map(existing.map(a => [a.id, a]))
  const byCompanyRole = new Map(existing.map(a => [`${a.company.toLowerCase()}|${a.role.toLowerCase()}`, a]))
  let added = 0, updated = 0

  for (const g of fresh) {
    if (!(g.stage in STAGE_RANK)) continue   // unrecognized stage — skip rather than guess
    const stage = g.stage as AppStage
    const key = `${g.company.toLowerCase()}|${g.role.toLowerCase()}`
    const match = byId.get(g.id) || byCompanyRole.get(key)

    if (!match) {
      const entry: AppItem = {
        id: g.id, company: g.company, role: g.role, location: g.location, remote: g.remote,
        salary: g.salary, stage, appliedDate: g.appliedDate, notes: g.notes,
        url: g.url, visa: g.visa, priority: g.priority,
      }
      existing.push(entry)
      byId.set(entry.id, entry)
      byCompanyRole.set(key, entry)
      added++
      continue
    }
    if (STAGE_RANK[stage] > STAGE_RANK[match.stage]) {
      match.stage = stage
      match.notes = g.notes
      updated++
    }
  }
  saveApplications(existing)
  return { added, updated }
}

// ── Follow-up date helpers ────────────────────────────────────────────────────
export function isOverdue(d?: string): boolean {
  return !!d && new Date(d) < new Date(new Date().toDateString())
}
export function isDueSoon(d?: string): boolean {
  if (!d) return false
  const dt = new Date(d), tom = new Date(); tom.setDate(tom.getDate() + 1)
  return dt >= new Date(new Date().toDateString()) && dt <= tom
}

export function daysSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (Number.isNaN(d)) return ""
  if (d <= 0) return "Today"
  if (d === 1) return "1d ago"
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function extractSalaryNum(s: string): number {
  const m = (s || "").match(/[\d,]+/)
  return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0
}

// ── CSV export (shared by pipeline + applications) ────────────────────────────
export function exportApplicationsCSV(apps: AppItem[]): void {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const hdrs = ["Company", "Role", "Location", "Remote", "Salary", "Stage", "Visa", "Priority", "Applied Date", "Follow-up Date", "Notes", "URL"]
  const rows = apps.map(a => [
    a.company, a.role, a.location, a.remote ? "Yes" : "No", a.salary,
    APP_STAGES.find(s => s.id === a.stage)?.label ?? a.stage,
    a.visa, a.priority.toUpperCase(),
    a.appliedDate ? new Date(a.appliedDate).toLocaleDateString() : "",
    a.followUpDate ?? "", a.notes, a.url,
  ].map(esc).join(","))
  const csv = "﻿" + [hdrs.map(esc).join(","), ...rows].join("\r\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const el = document.createElement("a")
  el.href = url
  el.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`
  el.click()
  URL.revokeObjectURL(url)
}
