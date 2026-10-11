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
  if (!res.ok) {
    // Capture Gmail's own reason — "accessNotConfigured" vs "insufficientPermissions"
    // tells us (and the user) exactly what to fix.
    let detail = ""
    let rateLimited = false
    try {
      const body = await res.json()
      const err = body?.error
      const reason = err?.errors?.[0]?.reason || ""
      if (reason === "rateLimitExceeded") rateLimited = true
      const msg = (err?.message || "").slice(0, 180)
      detail = [reason, msg].filter(Boolean).join(": ")
    } catch { /* ignore */ }
    // RATE_LIMIT: prefix lets callers give "wait and refresh" guidance instead of "reconnect".
    throw new Error(`${rateLimited ? "RATE_LIMIT: " : ""}Gmail API ${res.status}${detail ? ` — ${detail}` : ""}`)
  }
  return res.json()
}

interface GmailHeader { name: string; value: string }
interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  labelIds?: string[]
  payload?: { headers: GmailHeader[]; parts?: Array<{ filename?: string; mimeType?: string }> }
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
    hasIcs?: boolean
  }>
}

export interface AccountIssue {
  account: string
  reason: string
}

const BASE_QUERY = "(subject:(interview) OR subject:(RTR) OR subject:(rate) OR subject:(offer) OR subject:(application) OR subject:(recruiter) OR subject:(position) OR subject:(role))"

// ── Tracking window ─────────────────────────────────────────────────────────
// The app tracks the last 45 days of activity — interviews, applications,
// chains, crawls. One constant, used everywhere, so the window can't drift
// between routes.
export const TRACKING_DAYS = 45

// ── Gmail cache: load once, refresh incrementally ─────────────────────────
// First load fills the cache (slow, one time). Every later load serves the
// cache instantly and only asks Gmail for what's new since the last sync.
// If the cache tables don't exist yet (SQL not run), everything falls back
// to the old direct-fetch behavior — nothing breaks.

const CACHE_FRESH_MS = 5 * 60 * 1000

type Sb = Awaited<ReturnType<typeof createClient>>
type GwAccount = { id: string; google_email: string; gmail_enabled: boolean }

async function cacheAvailable(sb: Sb): Promise<boolean> {
  const { error } = await sb.from("mfit_gmail_sync").select("user_id").limit(1)
  return !error
}

function threadLatestTs(t: ClassifiedThread): number {
  return Math.max(0, ...t.messages.map(m => Number(m.internalDate || 0)))
}

async function readCachedThreads(sb: Sb, userId: string, days: number): Promise<ClassifiedThread[]> {
  const cutoff = Date.now() - Math.min(Math.max(days, 1), TRACKING_DAYS) * 86_400_000
  const { data, error } = await sb
    .from("mfit_gmail_threads")
    .select("data")
    .eq("user_id", userId)
    .gt("latest_ts", cutoff)
    .order("latest_ts", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data || []).map((r: { data: unknown }) => {
    const t = r.data as ClassifiedThread
    let healed = false
    const messages = t.messages.map(m => {
      const c = classifyEmail({ subject: m.subject, snippet: m.snippet, from: m.from })
      if (c.category !== m.category) {
        healed = true
        return { ...m, category: c.category, confidence: c.confidence, jobTitle: c.jobTitle, rate: c.rate, vendor: c.vendor, vendorDomain: c.vendorDomain }
      }
      return m
    })
    if (healed) {
      // Persist the healed classification so the next read is already correct.
      const nt = { ...t, messages }
      sb.from("mfit_gmail_threads")
        .update({ data: nt, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("thread_id", t.threadId)
        .then(() => {})
      return nt
    }
    return t
  })
}

async function upsertCachedThreads(sb: Sb, userId: string, acct: GwAccount, threads: ClassifiedThread[]): Promise<void> {
  if (threads.length === 0) return
  const rows = threads.map(t => ({
    user_id: userId,
    account_id: acct.id,
    thread_id: t.threadId,
    account_email: acct.google_email,
    latest_ts: threadLatestTs(t),
    data: t,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await sb.from("mfit_gmail_threads").upsert(rows, { onConflict: "user_id,account_id,thread_id" })
  if (error) throw error
}

async function getSyncState(sb: Sb, userId: string, accountId: string): Promise<{ last_sync_at: string | null; days_synced: number } | null> {
  const { data, error } = await sb
    .from("mfit_gmail_sync")
    .select("last_sync_at,days_synced")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function setSyncState(sb: Sb, userId: string, accountId: string, days: number): Promise<void> {
  const { error } = await sb.from("mfit_gmail_sync").upsert(
    { user_id: userId, account_id: accountId, last_sync_at: new Date().toISOString(), days_synced: days },
    { onConflict: "user_id,account_id" },
  )
  if (error) throw error
}

// Live-fetch + classify one account's threads for a Gmail query. Throws on failure.
async function fetchAccountThreads(
  acct: GwAccount,
  token: string,
  query: string,
  max: number,
): Promise<ClassifiedThread[]> {
  const out: ClassifiedThread[] = []
  const search = (await gmailGet(
    `/threads?q=${encodeURIComponent(query)}&maxResults=${max}`,
    token,
  )) as { threads?: Array<{ id: string }> }
  const stubs = search.threads || []
  if (stubs.length === 0) return out

  // Small batches with a breather — a fresh Cloud project gets throttled fast.
  const BATCH = 4
  for (let i = 0; i < stubs.length; i += BATCH) {
    if (i > 0) await new Promise(r => setTimeout(r, 400))
    const slice = stubs.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      slice.map(t =>
        gmailGet(
          `/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          token,
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
        const hasIcs = (m.payload?.parts || []).some(p => (p.filename || "").toLowerCase().endsWith(".ics"))
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
          hasIcs,
        }
      })

      out.push({
        threadId: thread.id,
        accountEmail: acct.google_email,
        messages,
      })
    }
  }
  return out
}

function toIssue(acct: GwAccount, e: unknown): AccountIssue {
  const msg = e instanceof Error ? e.message : String(e)
  if (/invalid_grant/i.test(msg)) {
    return { account: acct.google_email, reason: `Google access failed: ${msg}`.slice(0, 160) }
  }
  const reason = msg.startsWith("RATE_LIMIT:")
    ? "Google is throttling requests right now \u2014 wait a couple of minutes, then refresh. Nothing is broken."
    : `Gmail search failed: ${msg.replace(/^RATE_LIMIT: /, "")}`.slice(0, 200)
  return { account: acct.google_email, reason }
}

// Sync one account's cache incrementally. Returns an issue on failure, null on success.
async function syncAccountCache(
  sb: Sb,
  userId: string,
  acct: GwAccount,
  days: number,
  max: number,
  force: boolean,
): Promise<AccountIssue | null> {
  let sync: { last_sync_at: string | null; days_synced: number } | null = null
  try {
    sync = await getSyncState(sb, userId, acct.id)
  } catch { /* treat as never synced */ }

  const now = Date.now()
  const lastSync = sync?.last_sync_at ? new Date(sync.last_sync_at).getTime() : 0
  const fresh = now - lastSync < CACHE_FRESH_MS
  const wideEnough = (sync?.days_synced || 0) >= days
  if (!force && fresh && wideEnough && sync) return null

  let token: string | null = null
  try {
    token = await getGoogleWorkspaceAccessToken(userId, acct.id)
  } catch (e) {
    return toIssue(acct, e)
  }
  if (!token) {
    return { account: acct.google_email, reason: "Google didn't return an access token \u2014 reconnect this account." }
  }

  // Incremental window: since the last sync (1-day overlap), or the full window.
  const sinceDays = lastSync && wideEnough ? Math.ceil((now - lastSync) / 86_400_000) + 1 : days
  const after = new Date(now - Math.min(Math.max(sinceDays, 1), TRACKING_DAYS) * 86_400_000)
  const afterStr = after.toISOString().split("T")[0].replace(/-/g, "/")
  const query = `${BASE_QUERY} after:${afterStr}`

  try {
    const threads = await fetchAccountThreads(acct, token, query, max)
    await upsertCachedThreads(sb, userId, acct, threads)
    await setSyncState(sb, userId, acct.id, Math.max(days, sync?.days_synced || 0))
    return null
  } catch (e) {
    return toIssue(acct, e)
  }
}

export async function fetchClassifiedThreads(
  userId: string,
  opts: { days?: number; max?: number; query?: string } = {},
  extra: { force?: boolean } = {},
): Promise<{ threads: ClassifiedThread[]; issues: AccountIssue[] }> {
  const days = Math.min(Math.max(opts.days ?? 30, 1), TRACKING_DAYS)
  const max = Math.min(Math.max(opts.max ?? 50, 1), 100)

  const accounts = await listGoogleWorkspaceAccounts(userId)
  const enabled = accounts.filter(a => a.gmail_enabled)
  if (enabled.length === 0) return { threads: [], issues: [] }

  // A custom Gmail query bypasses the cache (direct live fetch, old behavior).
  const customQuery = !!opts.query && opts.query !== BASE_QUERY

  let sb: Sb | null = null
  let useCache = false
  if (!customQuery) {
    try {
      sb = await createClient()
      useCache = await cacheAvailable(sb)
    } catch {
      sb = null
      useCache = false
    }
  }

  const issues: AccountIssue[] = []

  if (useCache && sb) {
    for (const acct of enabled) {
      try {
        const issue = await syncAccountCache(sb, userId, acct, days, max, !!extra.force)
        if (issue) issues.push(issue)
      } catch (e) {
        issues.push(toIssue(acct, e))
      }
    }
    try {
      const threads = await readCachedThreads(sb, userId, days)
      threads.sort((a, b) => threadLatestTs(b) - threadLatestTs(a))
      return { threads, issues }
    } catch {
      // Cache read failed — fall through to direct fetch below.
    }
  }

  // Direct live fetch (no cache tables yet, custom query, or cache read failed).
  const after = new Date()
  after.setDate(after.getDate() - days)
  const afterStr = after.toISOString().split("T")[0].replace(/-/g, "/")
  const query = `${opts.query || BASE_QUERY} after:${afterStr}`

  const allThreads: ClassifiedThread[] = []

  for (const acct of enabled) {
    let token: string | null = null
    try {
      token = await getGoogleWorkspaceAccessToken(userId, acct.id)
    } catch (e) {
      issues.push(toIssue(acct, e))
      continue
    }
    if (!token) {
      issues.push({ account: acct.google_email, reason: "Google didn't return an access token \u2014 reconnect this account." })
      continue
    }

    try {
      const threads = await fetchAccountThreads(acct, token, query, max)
      allThreads.push(...threads)
    } catch (e) {
      issues.push(toIssue(acct, e))
      continue
    }
  }

  // Newest first by latest message
  allThreads.sort((a, b) => threadLatestTs(b) - threadLatestTs(a))

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
      ts: latest.internalDate ? Number(latest.internalDate) : 0,
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

// ── Confirmed-invite detection ────────────────────────────────────────────
// An "interview" only counts when there's evidence it was actually scheduled:
// a calendar invite (.ics attachment), a meeting link (Teams/Zoom/Meet/Webex/
// GoTo/Chime/BlueJeans), or explicit confirmation language ("scheduled for",
// "confirmed for", "looking forward to speaking").
// "Interview slots available" / "share your availability" is a REQUEST — it
// stays in Needs-you, never in the interview list. No guessing, no
// celebrating emails that were never meetings.

const MEETING_LINK_RE = /(teams\.microsoft\.com|teams\.live\.com|zoom\.us|zoom\.com|meet\.google\.com|webex\.com|gotomeeting\.com|goto\.com|chime\.aws|bluejeans\.com|meetings\.ringcentral\.com)/i
const CONFIRMED_LANG_RE = /\b(scheduled|confirmed|booked)\b[^.]{0,60}\b(for|on)\b|\blooking forward to (speaking|talking|meeting|connecting)\b|\bcalendar invite\b/i

export interface InviteEvidence {
  confirmed: boolean
  how: "calendar-invite" | "meeting-link" | "confirmed-email" | "request-only"
  via: string
}

export function inviteEvidence(t: ClassifiedThread): InviteEvidence {
  for (const m of t.messages) {
    if (m.hasIcs) return { confirmed: true, how: "calendar-invite", via: m.vendor || m.from }
    const text = `${m.subject} ${m.snippet}`
    if (MEETING_LINK_RE.test(text)) return { confirmed: true, how: "meeting-link", via: m.vendor || m.from }
    if (CONFIRMED_LANG_RE.test(text)) return { confirmed: true, how: "confirmed-email", via: m.vendor || m.from }
  }
  return { confirmed: false, how: "request-only", via: "" }
}

// ── Evidence catch-up ─────────────────────────────────────────────────────
// Threads cached before the .ics signal existed get re-verified: for threads
// containing an Interview Request message but no hasIcs field yet, re-fetch
// the thread metadata live (batched, max 15) and update the cache. This keeps
// the confirmed/requested split deterministic even for old cache rows.
export async function enrichInterviewEvidence(
  userId: string,
  threads: ClassifiedThread[],
): Promise<ClassifiedThread[]> {
  const candidates = threads.filter(
    t => t.messages.some(m => m.category === "Interview Request") && t.messages.every(m => m.hasIcs === undefined),
  ).slice(0, 15)

  let sb: Sb | null = null
  try {
    sb = await createClient()
    if (!(await cacheAvailable(sb))) return threads
  } catch {
    return threads
  }

  const byAccount = new Map<string, ClassifiedThread[]>()
  for (const t of candidates) {
    if (!byAccount.get(t.accountEmail)) byAccount.set(t.accountEmail, [])
    byAccount.get(t.accountEmail)!.push(t)
  }

  const updated = new Map<string, ClassifiedThread>()
  const accounts = await listGoogleWorkspaceAccounts(userId).catch(() => [])
  for (const [accountEmail, ts] of byAccount) {
    const acct = accounts.find(a => a.google_email.toLowerCase() === accountEmail.toLowerCase() && a.gmail_enabled)
    if (!acct) continue
    const token = await getGoogleWorkspaceAccessToken(userId, acct.id).catch(() => null)
    if (!token) continue
    for (let i = 0; i < ts.length; i += 4) {
      if (i > 0) await new Promise(r => setTimeout(r, 400))
      const slice = ts.slice(i, i + 4)
      const results = await Promise.allSettled(
        slice.map(t =>
          gmailGet(
            `/threads/${t.threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            token,
          ),
        ),
      )
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled") return
        const raw = r.value as { id: string; messages: GmailMessage[] }
        const orig = slice[idx]
        const messages = orig.messages.map((m, mi) => {
          const rm = raw.messages?.[mi]
          const hasIcs = rm
            ? (rm.payload?.parts || []).some(p => (p.filename || "").toLowerCase().endsWith(".ics"))
            : m.hasIcs
          return { ...m, hasIcs }
        })
        const nt: ClassifiedThread = { ...orig, messages }
        updated.set(orig.threadId, nt)
        // Persist the enriched thread back to the cache.
        upsertCachedThreads(sb!, userId, acct, [nt]).catch(() => {})
      })
    }
  }

  const merged = threads.map(t => updated.get(t.threadId) || t)

  // ── Live discovery: interview threads the cache fill missed ────────────
  // The cache keeps only the N most recent threads, so a real interview from
  // weeks ago may never have been cached. Search Gmail live for interview
  // subjects AND calendar invites (.ics) — the .ics query catches confirmed
  // interviews whose subject never says "interview" (e.g. "Screening call
  // with Eshwar", "Eshwar Janjirala - IT Security Analyst_USA"). Bounded and
  // batched (rate-limit safe): at most 30 missing threads per call.
  try {
    const have = new Set(merged.map(t => t.threadId))
    const missing: Array<{ acct: GwAccount; token: string; threadId: string }> = []
    const queries = ["subject:(interview) newer_than:45d", "filename:ics newer_than:45d"]
    for (const acct of accounts) {
      if (missing.length >= 30) break
      const token = await getGoogleWorkspaceAccessToken(userId, acct.id).catch(() => null)
      if (!token) continue
      for (const q of queries) {
        if (missing.length >= 30) break
        const list = (await gmailGet(
          `/messages?q=${encodeURIComponent(q)}&maxResults=50`,
          token,
        )) as { messages?: Array<{ id: string; threadId: string }> }
        for (const m of list.messages || []) {
          if (m.threadId && !have.has(m.threadId) && missing.length < 30) {
            have.add(m.threadId)
            missing.push({ acct, token, threadId: m.threadId })
          }
        }
      }
    }
    for (let i = 0; i < missing.length; i += 4) {
      if (i > 0) await new Promise(r => setTimeout(r, 400))
      const slice = missing.slice(i, i + 4)
      const results = await Promise.allSettled(
        slice.map(x =>
          gmailGet(
            `/threads/${x.threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            x.token,
          ),
        ),
      )
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled") return
        const raw = r.value as { id: string; messages: GmailMessage[] }
        if (!raw.messages?.length) return
        const x = slice[idx]
        const messages = raw.messages.map(m => {
          const headers = m.payload?.headers || []
          const subject = getHeader(headers, "Subject")
          const from = getHeader(headers, "From")
          const c = classifyEmail({ subject, snippet: m.snippet || "", from })
          const hasIcs = (m.payload?.parts || []).some(p => (p.filename || "").toLowerCase().endsWith(".ics"))
          return {
            id: m.id,
            from,
            subject,
            snippet: m.snippet || "",
            internalDate: m.internalDate,
            unread: (m.labelIds || []).includes("UNREAD"),
            category: c.category,
            confidence: c.confidence,
            jobTitle: c.jobTitle,
            rate: c.rate,
            vendor: c.vendor,
            vendorDomain: c.vendorDomain,
            hasIcs,
          }
        })
        const nt: ClassifiedThread = { threadId: raw.id, accountEmail: x.acct.google_email, messages }
        merged.push(nt)
        // Cache it so the next load finds it without the live search.
        upsertCachedThreads(sb!, userId, x.acct, [nt]).catch(() => {})
      })
    }
  } catch {
    /* live discovery is best-effort — cached results still stand */
  }

  return merged
}


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

    // EVIDENCE GATE: no confirmed invite, no interview. Requests stay in Needs-you.
    const evidence = inviteEvidence(t)
    if (!evidence.confirmed) continue

    const domain = extractDomain(iv.from)

    const requestTs = iv.internalDate ? Number(iv.internalDate) : 0
    const firstTouchTs = Math.min(...t.messages.map(m => Number(m.internalDate || 0)).filter(n => n > 0))

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

    // Best estimate of when the interview happens/happened (epoch ms).
    // A weekday name refers to the email's own week; otherwise fall back to the request email date.
    let at: number | null = null
    if (dayOffset !== null && requestTs) {
      const emailDate = new Date(requestTs)
      const emailMonday = new Date(emailDate)
      emailMonday.setDate(emailDate.getDate() - ((emailDate.getDay() + 6) % 7))
      emailMonday.setHours(0, 0, 0, 0)
      at = emailMonday.getTime() + dayOffset * DAY_MS + start * 3_600_000
      // If the parsed date is more than a day before the request email, it meant *next* week.
      if (at < requestTs - DAY_MS) at += 7 * DAY_MS
    } else if (requestTs) {
      at = requestTs + 2 * DAY_MS // assume ~2 days out when no weekday is named
    }
    if (!at) continue

    // Calendar grid still wants a 0-6 day offset relative to the *current* week for upcoming ones.
    const diffDays = Math.floor((at - monday.getTime()) / DAY_MS)
    const day = ((diffDays % 7) + 7) % 7

    const kind: Interview["kind"] = /onsite|in.person|office/i.test(text) ? "Onsite"
      : /panel/i.test(text) ? "Panel"
      : /phone|call/i.test(text) ? "Phone" : "Video"

    out.push({
      id: t.threadId,
      company: companyFromDomain(domain, iv.from),
      role: iv.jobTitle || iv.subject.slice(0, 50),
      day,
      start,
      end: start + 1,
      kind,
      account: t.accountEmail,
      with: iv.vendor,
      ts: at,
      firstTouchTs: firstTouchTs > 0 ? firstTouchTs : undefined,
      requestTs: requestTs || undefined,
      threadId: t.threadId,
      evidence: evidence.how as Exclude<typeof evidence.how, "request-only">,
      inviteVia: evidence.via,
    })
  }
  // Newest first — the page splits past vs upcoming itself.
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return out
}


// ── Application chains ────────────────────────────────────────────────────
// Every RTR/submission is the start of a chain: the profile travels from hand
// to hand — recruiter → vendor → implementation partner → client — and each
// handoff is progress. This builds the full chain per application thread:
// the stages reached (with dates + evidence), who currently holds the
// profile, whether it's stalled, and the next action. Deterministic: every
// stage needs a message that proves it.

export type ChainStageKey = "rtr" | "submitted" | "client" | "interview" | "decision"

export interface ChainStop {
  key: ChainStageKey
  label: string
  reached: boolean
  at?: number
  evidence?: string
}

export interface ChainLink {
  name: string
  email?: string
  role: string // "recruiter" | "vendor" | "partner" | "client" | "you"
  at?: number
}

export interface ApplicationChain {
  threadId: string
  accountEmail: string
  company: string
  role: string
  rate?: string
  stops: ChainStop[]
  current: ChainStageKey
  terminal: "offer" | "rejected" | null
  links: ChainLink[]
  holder: string
  holderSince?: number
  stalledDays: number
  nextAction: string
  interviewThreadId?: string
  lastActivity?: number
}

const SUBMITTED_RE = /submitted your profile|profile submitted|have submitted|submission (is )?done|submitted to (the )?client|resume (has been )?submitted/i
const SHARED_RE = /shared .*profile|forwarded .*profile|sent .*profile to/i
const CLIENT_RE = /\bclient\b/i
const RTR_SIGNED_RE = /\brtr\b.{0,40}\bsign|\bsign.{0,40}\brtr\b|authorization .*signed|exclusive representation/i
const FOLLOWUP_SENT_RE = /follow.?up|any update|checking in|next steps/i

const RAIL: Array<{ key: ChainStageKey; label: string }> = [
  { key: "rtr", label: "RTR" },
  { key: "submitted", label: "Submitted" },
  { key: "client", label: "With client" },
  { key: "interview", label: "Interview" },
  { key: "decision", label: "Decision" },
]

function personName(from: string): string {
  const m = from.match(/^"?([^"<@]+)"?\s*</)
  if (m) return m[1].trim()
  const bare = from.split("@")[0].replace(/[._-]+/g, " ").trim()
  return bare || from
}

export function buildApplicationChains(threads: ClassifiedThread[]): ApplicationChain[] {
  const out: ApplicationChain[] = []
  const now = Date.now()

  for (const t of threads) {
    const primary = t.messages[0]
    if (primary.category === "General Correspondence" || primary.category === "Sales Pitch") continue

    const domain = extractDomain(primary.from)
    const reached = new Map<ChainStageKey, { at: number; evidence: string }>()
    let terminal: "offer" | "rejected" | null = null
    let interviewThreadId: string | undefined
    const people = new Map<string, ChainLink>()

    const mark = (key: ChainStageKey, at: number, evidence: string) => {
      const prev = reached.get(key)
      if (!prev || at < prev.at) reached.set(key, { at, evidence })
    }

    for (const m of t.messages) {
      const text = `${m.subject} ${m.snippet}`
      const ts = m.internalDate ? Number(m.internalDate) : 0
      const isMe = m.from.toLowerCase().includes(t.accountEmail.toLowerCase().split("@")[0])
      const name = personName(m.from)

      if (!isMe && name && !people.has(name.toLowerCase())) {
        const emailMatch = m.from.match(/<([^>]+)>/)
        people.set(name.toLowerCase(), {
          name,
          email: emailMatch ? emailMatch[1] : undefined,
          role: /client|hiring/i.test(text) ? "client" : m.vendorDomain && !/gmail|yahoo|hotmail/i.test(m.vendorDomain) ? "vendor" : "recruiter",
          at: ts || undefined,
        })
      }

      if (m.category === "RTR Request") mark("rtr", ts, m.subject.slice(0, 60))
      else if (RTR_SIGNED_RE.test(text) && !isMe) mark("rtr", ts, "RTR signed")
      if (SUBMITTED_RE.test(text) && !isMe) {
        mark("submitted", ts, m.subject.slice(0, 60))
        if (SHARED_RE.test(text) || CLIENT_RE.test(text)) mark("client", ts, m.subject.slice(0, 60))
      }
      if (m.category === "Interview Request") {
        const ev = inviteEvidence({ ...t, messages: [m] })
        if (ev.confirmed) {
          mark("interview", ts, `${ev.how === "meeting-link" ? "Meeting link" : ev.how === "calendar-invite" ? "Calendar invite" : "Confirmed"} · ${m.subject.slice(0, 50)}`)
          interviewThreadId = t.threadId
        }
      }
      if (m.category === "Offer") terminal = "offer"
      if (m.category === "Rejection") terminal = "rejected"
    }

    // A thread with real back-and-forth but no explicit "submitted" language
    // still counts as submitted once the vendor is engaged past the RTR.
    if (!reached.has("submitted") && (reached.has("client") || reached.has("interview") || terminal)) {
      const first = t.messages.find(m => SUBMITTED_RE.test(`${m.subject} ${m.snippet}`))
      mark("submitted", first && first.internalDate ? Number(first.internalDate) : (reached.get("client")?.at || reached.get("interview")?.at || now), "Vendor engaged")
    }

    const order: ChainStageKey[] = ["rtr", "submitted", "client", "interview", "decision"]
    let current: ChainStageKey = "rtr"
    for (const k of order) if (reached.has(k)) current = k
    if (terminal) current = "decision"

    const stops: ChainStop[] = RAIL.map(s => {
      const r = reached.get(s.key)
      const isDecision = s.key === "decision"
      return {
        key: s.key,
        label: isDecision ? (terminal === "offer" ? "Offer" : terminal === "rejected" ? "Rejected" : "Decision") : s.label,
        reached: isDecision ? terminal !== null : !!r,
        at: isDecision ? undefined : r?.at,
        evidence: isDecision ? undefined : r?.evidence,
      }
    })

    const lastMsg = t.messages[t.messages.length - 1]
    const lastTs = lastMsg?.internalDate ? Number(lastMsg.internalDate) : 0
    const stalledDays = terminal ? 0 : lastTs ? Math.floor((now - lastTs) / 86_400_000) : 0
    const holder = terminal
      ? terminal === "offer" ? "You — offer in hand" : "Closed"
      : personName(lastMsg?.from || "") || primary.vendor || "the vendor"

    const nextAction = terminal === "offer"
      ? "Offer received — review the terms and decide."
      : terminal === "rejected"
        ? "Closed. Reflect in Kompas if there's anything to learn."
        : current === "interview"
          ? "Interview stage — prepare, then reflect in Kompas after."
          : stalledDays >= 10
            ? `Quiet for ${stalledDays} days — ${holder} has your profile. Time to call.`
            : stalledDays >= 7
              ? `No movement in ${stalledDays} days — send ${holder} a follow-up.`
              : `${holder} has your profile — check back if nothing moves in a few days.`

    out.push({
      threadId: t.threadId,
      accountEmail: t.accountEmail,
      company: companyFromDomain(domain, primary.from),
      role: primary.jobTitle || primary.subject.slice(0, 50),
      rate: primary.rate || undefined,
      stops,
      current,
      terminal,
      links: [...people.values()].slice(0, 6),
      holder,
      holderSince: lastTs || undefined,
      stalledDays,
      nextAction,
      interviewThreadId,
      lastActivity: lastTs || undefined,
    })
  }

  out.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
  return out
}

