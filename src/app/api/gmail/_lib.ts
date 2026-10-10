// ── Shared Gmail API helpers ────────────────────────────────────────────────
// Used by /api/gmail/* routes. Fetches threads, classifies, and shapes data
// to match the dashboard _suite/sample.ts interfaces.

import { createClient } from "@/lib/supabase/server"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { classifyEmail, type EmailCategory } from "@/lib/email-classifier"
import type { Mail, Stage, App, Interview } from "@/app/dashboard/_suite/sample"

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  accounts: Array<{ id: string; google_email: string; gmail_enabled: boolean }>
}

export async function requireAuth(): Promise<AuthContext | { error: string; status: number }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: "Not logged in", status: 401 }
  const accounts = await listGoogleWorkspaceAccounts(session.user.id)
  return { supabase, userId: session.user.id, accounts }
}

export function isAuthContext(ctx: unknown): ctx is AuthContext {
  return !!ctx && typeof ctx === "object" && "userId" in ctx
}

async function gmailGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail API ${res.status}`)
  return res.json()
}

interface GmailHeader { name: string; value: string }
interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  labelIds?: string[]
  payload?: { headers: GmailHeader[] }
  internalDate?: string
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

function extractDomain(from: string): string {
  const m = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return m ? m[1].toLowerCase() : ""
}

function companyFromDomain(domain: string, from: string): string {
  // Prefer display name if it looks like a company
  const nameMatch = from.match(/^"?([^"<@]+?)"?\s*</)
  if (nameMatch) {
    const name = nameMatch[1]
      .replace(/\b(talent|recruiting|recruiter|careers|jobs|hr|notifications|no-?reply|team)\b/gi, "")
      .trim()
    if (name.length > 1 && name.length < 40) return name
  }
  // Fall back to prettified domain
  const part = domain.split(".")[0] || ""
  return part
    .replace(/-/g, " ")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Unknown"
}

// ── Category → Stage mapping ────────────────────────────────────────────────
export function categoryToStage(category: EmailCategory): Stage {
  switch (category) {
    case "Interview Request": return "invite"
    case "RTR Request": return "rtr"
    case "Rate Confirmation": return "rate"
    case "Rejection": return "rejected"
    case "Offer": return "offer"
    case "Follow-up": return "followup"
    case "Submission Confirmation": return "applied"
    case "Document Request": return "pending"
    case "Job Description": return "pending"
    case "Sales Pitch": return "pending"
    default: return "pending"
  }
}

function formatAt(internalDate: string | undefined): string {
  if (!internalDate) return ""
  const d = new Date(Number(internalDate))
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 3_600_000) return `${Math.max(1, Math.round(diffMs / 60_000))}m ago`
  if (diffMs < 86_400_000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }
  if (diffMs < 7 * 86_400_000) return d.toLocaleDateString("en-US", { weekday: "short" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Fetch + classify threads ────────────────────────────────────────────────

export interface ClassifiedThread {
  threadId: string
  accountEmail: string
  messages: Array<{
    id: string
    from: string
    subject: string
    snippet: string
    internalDate?: string
    unread: boolean
    category: EmailCategory
    confidence: string
    jobTitle: string
    rate: string
    vendor: string
    vendorDomain: string
  }>
}

export interface AccountIssue {
  account: string
  reason: string
}

export async function fetchClassifiedThreads(
  userId: string,
  opts: { days?: number; max?: number; query?: string } = {},
): Promise<{ threads: ClassifiedThread[]; issues: AccountIssue[] }> {
  const days = Math.min(Math.max(opts.days ?? 30, 1), 90)
  const max = Math.min(Math.max(opts.max ?? 50, 1), 100)

  const accounts = await listGoogleWorkspaceAccounts(userId)
  const enabled = accounts.filter(a => a.gmail_enabled)
  if (enabled.length === 0) return { threads: [], issues: [] }

  const after = new Date()
  after.setDate(after.getDate() - days)
  const afterStr = after.toISOString().split("T")[0].replace(/-/g, "/")
  const baseQuery = opts.query || "(subject:(interview) OR subject:(RTR) OR subject:(rate) OR subject:(offer) OR subject:(application) OR subject:(recruiter) OR subject:(position) OR subject:(role))"
  const query = `${baseQuery} after:${afterStr}`

  const allThreads: ClassifiedThread[] = []
  const issues: AccountIssue[] = []

  for (const acct of enabled) {
    let token: string | null = null
    try {
      token = await getGoogleWorkspaceAccessToken(userId, acct.id)
    } catch (e) {
      issues.push({ account: acct.google_email, reason: `Google access failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160) })
      continue
    }
    if (!token) {
      issues.push({ account: acct.google_email, reason: "Google didn't return an access token — reconnect this account." })
      continue
    }

    try {
      const search = (await gmailGet(
        `/threads?q=${encodeURIComponent(query)}&maxResults=${max}`,
        token,
      )) as { threads?: Array<{ id: string }> }
      const stubs = search.threads || []
      if (stubs.length === 0) continue

      // Fetch thread details in batches
      const BATCH = 8
      for (let i = 0; i < stubs.length; i += BATCH) {
        const slice = stubs.slice(i, i + BATCH)
        const results = await Promise.allSettled(
          slice.map(t =>
            gmailGet(
              `/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
              token as string,
            ),
          ),
        )
        for (const r of results) {
          if (r.status !== "fulfilled") continue
          const thread = r.value as { id: string; messages: GmailMessage[] }
          if (!thread.messages?.length) continue

          const messages = thread.messages.map(m => {
            const headers = m.payload?.headers
            const from = getHeader(headers, "From")
            const subject = getHeader(headers, "Subject")
            const snippet = m.snippet || ""
            const c = classifyEmail({ subject, snippet, from })
            return {
              id: m.id,
              from,
              subject,
              snippet,
              internalDate: m.internalDate,
              unread: (m.labelIds || []).includes("UNREAD"),
              category: c.category,
              confidence: c.confidence,
              jobTitle: c.jobTitle,
              rate: c.rate,
              vendor: c.vendor,
              vendorDomain: c.vendorDomain,
            }
          })

          allThreads.push({
            threadId: thread.id,
            accountEmail: acct.google_email,
            messages,
          })
        }
      }
    } catch (e) {
      // Per-account failure shouldn't kill the whole sync — but say so.
      issues.push({ account: acct.google_email, reason: `Gmail search failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160) })
      continue
    }
  }

  // Newest first by latest message
  allThreads.sort((a, b) => {
    const aMax = Math.max(...a.messages.map(m => Number(m.internalDate || 0)))
    const bMax = Math.max(...b.messages.map(m => Number(m.internalDate || 0)))
    return bMax - aMax
  })

  return { threads: allThreads, issues }
}

// ── Shape to Mail[] ─────────────────────────────────────────────────────────

// ── JD-fit scoring ──────────────────────────────────────────────────────────
// Lightweight, explainable relevance: how closely does this email's role look
// like the security roles he hunts? Title keywords weigh 2x, body keywords 1x.
// Returns 0-100 plus the matched keywords so the UI can show its work.

const JD_TITLE_KEYWORDS = [
  "security analyst", "soc analyst", "soc lead", "senior soc", "security engineer",
  "cyber security", "cybersecurity", "information security", "infosec",
  "vulnerability", "siem", "splunk", "qradar", "sentinel", "incident response",
  "threat", "iam", "cyberark", "sailpoint", "okta", "pam", "pki",
  "grc", "risk analyst", "soc", "appsec", "application security",
]
const JD_BODY_KEYWORDS = [
  "c2c", "contract", "remote", "soc", "siem", "splunk", "incident", "vulnerability",
  "triage", "playbook", "runbook", "edr", "crowdstrike", "firewall", "ids", "ips",
  "nist", "iso 27001", "cissp", "security+", "ceh", "gcih", "gcfa",
  "log analysis", "threat hunting", "forensics", "malware", "phishing",
]

export function jdFitScore(jobTitle: string, subject: string, snippet: string): { score: number; matched: string[] } {
  const title = (jobTitle || "").toLowerCase()
  const body = `${subject || ""} ${snippet || ""}`.toLowerCase()
  const matched: string[] = []
  let points = 0
  for (const k of JD_TITLE_KEYWORDS) {
    if (title.includes(k) && !matched.includes(k)) { matched.push(k); points += 2 }
  }
  for (const k of JD_BODY_KEYWORDS) {
    if (body.includes(k) && !matched.includes(k)) { matched.push(k); points += 1 }
  }
  // Normalize: ~14 points ≈ strong fit
  const score = Math.min(100, Math.round((points / 14) * 100))
  return { score, matched: matched.slice(0, 8) }
}

// ── Shape to Mail[] ─────────────────────────────────────────────────────────

export function threadsToMails(threads: ClassifiedThread[]): Mail[] {
  return threads.map(t => {
    // Use the most recent message for the row; classification from the most
    // "actionable" message in the thread (priority order)
    const priority: EmailCategory[] = [
      "Interview Request", "Offer", "RTR Request", "Rate Confirmation",
      "Rejection", "Document Request", "Submission Confirmation",
      "Follow-up", "Job Description", "Sales Pitch", "General Correspondence",
    ]
    const sorted = [...t.messages].sort(
      (a, b) => priority.indexOf(a.category) - priority.indexOf(b.category),
    )
    const primary = sorted[0]
    const latest = t.messages[t.messages.length - 1]
    const domain = extractDomain(primary.from)

    // needsReply: actionable inbound categories where user hasn't replied last
    const needsReply =
      primary.category === "Interview Request" ? "availability" as const :
      primary.category === "RTR Request" ? "rtr" as const :
      primary.category === "Rate Confirmation" ? "rate" as const :
      undefined

    const role = primary.jobTitle || latest.subject.slice(0, 60)
    const jdFit = jdFitScore(role, latest.subject, latest.snippet)

    return {
      id: t.threadId,
      account: t.accountEmail,
      from: primary.vendor,
      fromEmail: primary.from,
      company: companyFromDomain(domain, primary.from),
      role,
      subject: latest.subject,
      preview: latest.snippet.slice(0, 140),
      at: formatAt(latest.internalDate),
      stage: categoryToStage(primary.category),
      rate: primary.rate || undefined,
      unread: t.messages.some(m => m.unread),
      needsReply,
      jdFit: jdFit.score,
      jdFitWhy: jdFit.matched,
    }
  })
}

// ── Shape to App[] (tracker) ────────────────────────────────────────────────

export function threadsToApps(threads: ClassifiedThread[]): App[] {
  const apps: App[] = []
  for (const t of threads) {
    const primary = t.messages[0]
    const domain = extractDomain(primary.from)
    // Skip pure noise for the tracker
    if (primary.category === "General Correspondence" || primary.category === "Sales Pitch") continue

    const isContract = /c2c|\$\d+\/hr/i.test(`${primary.subject} ${primary.snippet} ${primary.rate}`)
    const latestDate = t.messages[t.messages.length - 1]?.internalDate
    const d = latestDate ? new Date(Number(latestDate)) : new Date()

    apps.push({
      id: t.threadId,
      company: companyFromDomain(domain, primary.from),
      role: primary.jobTitle || primary.subject.slice(0, 50),
      account: t.accountEmail,
      type: isContract ? "Contract" : "Full-time",
      applied: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      stage: categoryToStage(primary.category),
      last: `${primary.category} · ${formatAt(latestDate)}`,
      rate: primary.rate || undefined,
    })
  }
  return apps
}

// ── Shape to Interview[] (calendar) ─────────────────────────────────────────

const DAY_MS = 86_400_000

export function threadsToInterviews(threads: ClassifiedThread[]): Interview[] {
  const out: Interview[] = []
  const now = new Date()
  // Week starts Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  for (const t of threads) {
    const iv = t.messages.find(m => m.category === "Interview Request")
    if (!iv) continue
    const domain = extractDomain(iv.from)

    // Try to parse a date from subject/snippet
    const text = `${iv.subject} ${iv.snippet}`
    let dayOffset: number | null = null
    let start = 10

    const dayMatch = text.match(/\b(mon|tue|wed|thu|fri)(?:day)?\b/i)
    if (dayMatch) {
      const days: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 }
      dayOffset = days[dayMatch[1].toLowerCase().slice(0, 3)]
    }
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
    if (timeMatch) {
      let h = Number(timeMatch[1])
      if (timeMatch[3].toLowerCase() === "pm" && h < 12) h += 12
      start = h + (Number(timeMatch[2] || 0) / 60)
    }
    // Fallback: use email date
    if (dayOffset === null && iv.internalDate) {
      const d = new Date(Number(iv.internalDate))
      const diff = Math.floor((d.getTime() - monday.getTime()) / DAY_MS)
      if (diff >= 0 && diff < 14) dayOffset = diff % 7
    }
    if (dayOffset === null) continue

    const kind: Interview["kind"] = /onsite|in.person|office/i.test(text) ? "Onsite"
      : /panel/i.test(text) ? "Panel"
      : /phone|call/i.test(text) ? "Phone" : "Video"

    out.push({
      id: t.threadId,
      company: companyFromDomain(domain, iv.from),
      role: iv.jobTitle || iv.subject.slice(0, 50),
      day: dayOffset,
      start,
      end: start + 1,
      kind,
      account: t.accountEmail,
      with: iv.vendor,
    })
  }
  return out
}
