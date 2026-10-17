// ── Shared Gmail API helpers ────────────────────────────────────────────────
// Used by /api/gmail/* routes. Fetches threads, classifies, and shapes data
// to match the dashboard _suite/sample.ts interfaces.

import { createClient } from "@/lib/supabase/server"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { classifyEmail, type EmailCategory } from "@/lib/email-classifier"
import type { Mail, Stage, App, Interview } from "@/app/dashboard/_suite/sample"

import { emailAddress, authoredText, submissionEvidence, calendarEvidence, linkReferencedThreads, type CalendarEvidence } from "@/lib/application-evidence"
import { turnOf, saysWaitForUs } from "@/lib/mail-reading"

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

interface GmailPart { filename?: string; mimeType?: string; body?: { data?: string; attachmentId?: string }; parts?: GmailPart[] }
interface GmailHeader { name: string; value: string }
interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  labelIds?: string[]
  payload?: GmailPart & { headers: GmailHeader[] }
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
  evidenceVersion?: number
  sourceThreadIds?: string[]
  messages: Array<{
    id: string
    from: string
    to?: string
    cc?: string
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
    bodyText?: string
    rfcMessageId?: string
    references?: string
    sourceThreadId?: string
    calendar?: CalendarEvidence[]
    hasIcs?: boolean
  }>
}

export interface AccountIssue {
  account: string
  reason: string
}

const BASE_QUERY = '(interview OR screening OR recruiter OR "right to represent" OR RTR OR "rate confirmation" OR "profile submitted" OR "submitted your profile" OR "application received" OR "Teams meeting" OR "meet.google.com" OR "zoom.us" OR filename:ics OR subject:invitation OR subject:offer OR subject:position OR subject:role OR (has:attachment (resume OR CV OR profile)))'

// Three months, including the beginning of submission chains.
export const TRACKING_DAYS = 90

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

async function readCachedThreads(sb: Sb, userId: string, days: number, account?: string): Promise<ClassifiedThread[]> {
  const cutoff = Date.now() - Math.min(Math.max(days, 1), TRACKING_DAYS) * 86_400_000
  const data: Array<{ data: unknown }> = []
  for (let offset = 0; ; offset += 500) {
    let query = sb
    .from("mfit_gmail_threads")
    .select("data")
    .eq("user_id", userId)
    .gt("latest_ts", cutoff)
    .order("latest_ts", { ascending: false })
    .order("account_id").order("thread_id")
    .range(offset, offset + 499)
    if (account) query = query.eq("account_email", account)
    const page = await query
    if (page.error) throw page.error
    data.push(...(page.data || []))
    if ((page.data || []).length < 500) break
  }
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
        .eq("account_email", t.accountEmail)
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
async function messageEvidence(m: GmailMessage, token: string) {
  const texts: string[] = []
  const htmlTexts: string[] = []
  const calendars: CalendarEvidence[] = []
  let hasIcs = false
  async function walk(p: GmailPart) {
    const isCalendar = p.mimeType === "text/calendar" || /\.ics$/i.test(p.filename || "")
    if (isCalendar) hasIcs = true
    let data = p.body?.data
    if (isCalendar && !data && p.body?.attachmentId) {
      const a = await gmailGet(`/messages/${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(p.body.attachmentId)}`, token) as { data?: string }
      data = a.data
    }
    if (data) {
      const text = Buffer.from(data, "base64url").toString("utf8")
      if (isCalendar) calendars.push(...calendarEvidence(text))
      else if (p.mimeType === "text/plain" && !p.filename) texts.push(text)
      else if (p.mimeType === "text/html" && !p.filename) htmlTexts.push(text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/?(?:p|div|br|tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"))
    }
    for (const child of p.parts || []) await walk(child)
  }
  if (m.payload) await walk(m.payload)
  return { bodyText: (texts.length ? texts : htmlTexts).join("\n").slice(0, 100000), calendar: calendars, hasIcs,
    rfcMessageId: getHeader(m.payload?.headers, "Message-ID"),
    references: [getHeader(m.payload?.headers, "References"), getHeader(m.payload?.headers, "In-Reply-To")].join(" "),
    sourceThreadId: m.threadId, to: getHeader(m.payload?.headers, "To"), cc: getHeader(m.payload?.headers, "Cc") }
}

async function fetchAccountThreads(
  acct: GwAccount,
  token: string,
  query: string,
  max: number,
  paging?: { token?: string },
 ): Promise<ClassifiedThread[] & { partial?: boolean; nextPageToken?: string; failed?: number }> {
  const out: ClassifiedThread[] & { partial?: boolean; nextPageToken?: string; failed?: number } = []
  const stubs: Array<{ id: string }> = []
  let pageToken = paging?.token || ""
  do {
    const search = await gmailGet(`/threads?q=${encodeURIComponent(query)}&maxResults=${Math.min(100, max - stubs.length)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, token) as { threads?: Array<{ id: string }>; nextPageToken?: string }
    stubs.push(...(search.threads || []))
    pageToken = search.nextPageToken || ""
  } while (!paging && pageToken && stubs.length < max)
  let failed = 0
  if (stubs.length === 0) return out

  // Small batches with a breather — a fresh Cloud project gets throttled fast.
  const BATCH = 4
  for (let i = 0; i < stubs.length; i += BATCH) {
    if (i > 0) await new Promise(r => setTimeout(r, 400))
    const slice = stubs.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      slice.map(t =>
        gmailGet(
          `/threads/${t.id}?format=full`,
          token,
        ),
      ),
    )
    for (const r of results) {
      if (r.status !== "fulfilled") { failed++; continue }
      const thread = r.value as { id: string; messages: GmailMessage[] }
      if (!thread.messages?.length) continue

      const messages = await Promise.all(thread.messages.filter(m => !m.labelIds?.includes("DRAFT")).map(async m => {
        const headers = m.payload?.headers
        const from = getHeader(headers, "From")
        const subject = getHeader(headers, "Subject")
        const snippet = m.snippet || ""
        const c = classifyEmail({ subject, snippet, from })
        const evidence = await messageEvidence(m, token)
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
          ...evidence,
        }
      }))

      if (!messages.length) continue
      out.push({
        threadId: thread.id,
        accountEmail: acct.google_email,
        evidenceVersion: 2,
        messages,
      })
    }
  }
  out.partial = !!pageToken || failed > 0
  out.nextPageToken = pageToken || undefined
  out.failed = failed
  return out
}

// One bounded page per request, persisted before returning its continuation.
// The overview drains every page, so a busy inbox cannot starve older progress.
export async function scanApplicationHistory(ctx: AuthContext, account: string, days: number, pageToken?: string, phase: "progress" | "history" = "history") {
  const acct = ctx.accounts.find(a => a.gmail_enabled && a.google_email.toLowerCase() === account.toLowerCase())
  if (!acct) throw new Error("Gmail account not connected")
  const token = await getGoogleWorkspaceAccessToken(ctx.userId, acct.id)
  if (!token) throw new Error("Reconnect this Gmail account")
  const after = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "/")
  const progressQuery = '("submitted your profile" OR "profile submitted" OR "shared your profile" OR "forwarded your resume" OR "submitted to client" OR filename:ics OR "client interview")'
  const threads = await fetchAccountThreads(acct, token, `${phase === "progress" ? progressQuery : BASE_QUERY} after:${after}`, 40, { token: pageToken })
  if (threads.failed) throw new Error("Some emails could not be read. Retry this history page; its position has not advanced.")
  await upsertCachedThreads(ctx.supabase, ctx.userId, acct, threads)
  const cached = await readCachedThreads(ctx.supabase, ctx.userId, days, acct.google_email)
  return { threads: cached.filter(t => t.evidenceVersion === 2), nextPageToken: threads.nextPageToken || null, scanned: threads.length }
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
  const sinceDays = !force && lastSync && wideEnough ? Math.ceil((now - lastSync) / 86_400_000) + 1 : days
  const after = new Date(now - Math.min(Math.max(sinceDays, 1), TRACKING_DAYS) * 86_400_000)
  const afterStr = after.toISOString().split("T")[0].replace(/-/g, "/")
  const query = `${BASE_QUERY} after:${afterStr}`

  try {
    const threads = await fetchAccountThreads(acct, token, query, max)
    await upsertCachedThreads(sb, userId, acct, threads)
    // Some threads could not be read: not recorded, so the next request tries again.
    if (threads.failed) return { account: acct.google_email, reason: `History scan is partial (up to ${max} threads). Counts are not a complete inbox inventory.` }
    // A sync that stopped at its cap (a busy inbox has more than `max` job threads in the window) read and stored the
    // newest ones, and is recorded. It used to return here unrecorded, so the cache never counted as fresh and every
    // request read the same threads from Gmail again: 9 to 18 seconds per request on the owner's inbox, 14 Oct 2026.
    await setSyncState(sb, userId, acct.id, Math.max(days, sync?.days_synced || 0))
    if (threads.partial) return { account: acct.google_email, reason: `History scan is partial (up to ${max} threads). Counts are not a complete inbox inventory.` }
    return null
  } catch (e) {
    return toIssue(acct, e)
  }
}

// One sync per account at a time on this server. The inbox, its steps, the tracker, the interviews and the follow-up
// radar all ask at the same moment when a mail page opens; each used to read the same account from Gmail on its own
// (five reads at once, which Gmail throttles). A request that arrives while a sync runs waits for it, then checks the
// cache again, which is now fresh unless it needs a wider window than the one just read.
const syncing = new Map<string, Promise<AccountIssue | null>>()
async function syncAccountCacheOnce(
  sb: Sb,
  userId: string,
  acct: GwAccount,
  days: number,
  max: number,
  force: boolean,
): Promise<AccountIssue | null> {
  const key = `${userId}:${acct.id}`
  const running = syncing.get(key)
  if (running) {
    const issue = await running.catch(() => null)
    if (force) return issue
  }
  const next = syncAccountCache(sb, userId, acct, days, max, force)
  syncing.set(key, next)
  try {
    return await next
  } finally {
    if (syncing.get(key) === next) syncing.delete(key)
  }
}

export async function fetchClassifiedThreads(
  userId: string,
  opts: { days?: number; max?: number; query?: string; account?: string } = {},
  extra: { force?: boolean } = {},
): Promise<{ threads: ClassifiedThread[]; issues: AccountIssue[] }> {
  const days = Math.min(Math.max(opts.days ?? 30, 1), TRACKING_DAYS)
  const max = Math.min(Math.max(opts.max ?? 50, 1), 300)

  const accounts = await listGoogleWorkspaceAccounts(userId)
  const enabled = accounts.filter(a => a.gmail_enabled && (!opts.account || a.google_email.toLowerCase() === opts.account.toLowerCase()))
  if (enabled.length === 0) return { threads: [], issues: [] }

  // A custom Gmail query bypasses the cache (direct live fetch, old behavior).
  const customQuery = !!opts.query && opts.query !== BASE_QUERY

  let sb: Sb | null = null
  let useCache = false
  {
    try {
      sb = await createClient()
      useCache = !customQuery && await cacheAvailable(sb)
    } catch {
      sb = null
      useCache = false
    }
  }

  const issues: AccountIssue[] = []

  if (useCache && sb) {
    for (const acct of enabled) {
      try {
        const issue = await syncAccountCacheOnce(sb, userId, acct, days, max, !!extra.force)
        if (issue) issues.push(issue)
      } catch (e) {
        issues.push(toIssue(acct, e))
      }
    }
    try {
      const cached = await readCachedThreads(sb, userId, days)
      const threads = cached.filter(t => enabled.some(a => a.google_email.toLowerCase() === t.accountEmail.toLowerCase()))
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
      if (opts.query && sb) await upsertCachedThreads(sb, userId, acct, threads)
      if (threads.partial) issues.push({ account: acct.google_email, reason: "History scan is partial. Counts are not a complete inbox inventory." })
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

    // Whose turn it is. Until 12 Oct 2026 this only looked at what KIND of mail the thread held, never at who wrote
    // last: on the owner's inboxes 39 threads were listed as needing his reply and in 30 of them the last word was his.
    // An ask is open only if they made it after he last wrote (src/lib/mail-reading.ts: turnOf).
    const askKind = (c?: EmailCategory) =>
      c === "Interview Request" ? "availability" as const :
      c === "RTR Request" ? "rtr" as const :
      c === "Rate Confirmation" ? "rate" as const :
      undefined
    const turn = turnOf(t.messages, [t.accountEmail])
    const pendingAsk = [...turn.since].sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category))[0]
    // needsReply keeps saying what kind of mail this is (other pages count "invites this week" by it); the open ask's
    // own kind wins when there is one. yourTurn is the answer to "do I have to do something".
    const needsReply = askKind(pendingAsk?.category) ?? askKind(primary.category)
    // The person on the other side: the last one of them to write. `primary` can be the user's own message.
    const them = [...t.messages].reverse().find(m => emailAddress(m.from) !== t.accountEmail.toLowerCase()) || primary

    const role = primary.jobTitle || latest.subject.slice(0, 60)
    const jdFit = jdFitScore(role, latest.subject, latest.snippet)

    return {
      id: t.threadId,
      account: t.accountEmail,
      from: primary.vendor,
      fromEmail: them.from,
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
      // Not your turn when the last thing they wrote says they will come back to you and asks nothing.
      yourTurn: !!askKind(pendingAsk?.category) && !saysWaitForUs(turn.since[turn.since.length - 1]?.bodyText || turn.since[turn.since.length - 1]?.snippet || ""),
      lastMine: turn.lastMine,
      messages: t.messages.length,
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
const CONFIRMED_LANG_RE = /\b(scheduled|confirmed|booked)\b[^.]{0,60}\b(for|on)\b/i

export interface InviteEvidence {
  confirmed: boolean
  how: "calendar-invite" | "meeting-link" | "confirmed-email" | "request-only"
  via: string
}

export function inviteEvidence(t: ClassifiedThread): InviteEvidence {
  for (const m of t.messages) {
    if ((m.calendar?.length && m.calendar.every(c => c.cancelled)) || /\b(cancelled|canceled|not scheduled|not confirmed)\b/i.test(m.subject)) continue
    const text = `${m.subject} ${authoredText(m.bodyText || m.snippet)}`
    if (/\b(?:webinar|newsletter|birthday|training course)\b/i.test(m.subject) && !/interview|screening/i.test(m.subject)) continue
    if (!/interview|screening|recruiter|recruiting|candidate|hiring|(?:security|software|data|network|cloud|systems?)\s+(?:engineer|analyst|architect|developer)/i.test(text)) continue
    if (m.hasIcs) return { confirmed: true, how: "calendar-invite", via: m.vendor || m.from }
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
  const out = new Map<string, { at: number; item: Interview | null }>()
  for (const t of threads) {
    const firstTouchTs = Math.min(...t.messages.map(m => Number(m.internalDate || 0)).filter(n => n > 0))
    for (const m of t.messages) {
      const text = `${m.subject} ${authoredText(m.bodyText || m.snippet)}`
      if (!/interview|screening|recruit|candidate|hiring/i.test(text) && !m.hasIcs) continue
      const evidence = inviteEvidence({ ...t, messages: [m] })
      const calendars = m.calendar?.length ? m.calendar : [undefined]
      for (const calendar of calendars) {
        const key = `${t.accountEmail}:${calendar?.uid || t.threadId}`
        const at = Number(m.internalDate || 0)
        if ((out.get(key)?.at ?? -1) > at) continue
        if (calendar?.cancelled || /\b(cancelled|canceled)\b/i.test(authoredText(m.bodyText || m.snippet))) { out.set(key, { at, item: null }); continue }
        if (!evidence.confirmed) continue
        const ts = calendar?.start
        const date = ts ? new Date(ts) : null
        const start = date ? date.getUTCHours() + date.getUTCMinutes() / 60 : 0
        out.set(key, { at, item: {
          id: key, company: companyFromDomain(extractDomain(m.from), m.from),
          role: m.jobTitle || m.subject.slice(0, 80), account: t.accountEmail,
          with: m.vendor, day: date ? (date.getUTCDay() + 6) % 7 : 0,
          start, end: calendar?.end && ts ? start + (calendar.end - ts) / 3600000 : start + 1,
          kind: /onsite|in.person/i.test(text) ? "Onsite" : /phone|call/i.test(text) ? "Phone" : "Video",
          ts, timingStatus: ts ? "scheduled" : "unknown", requestTs: at || undefined,
          firstTouchTs: Number.isFinite(firstTouchTs) ? firstTouchTs : undefined,
          threadId: t.threadId, evidence: evidence.how as Interview["evidence"], inviteVia: evidence.via,
        } })
      }
    }
  }
  return [...out.values()].flatMap(x => x.item ? [x.item] : []).sort((a, b) => (b.ts || b.requestTs || 0) - (a.ts || a.requestTs || 0))
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
  messageId?: string
}

export interface ChainLink {
  name: string
  email?: string
  role: string // "recruiter" | "vendor" | "partner" | "client" | "you"
  at?: number
}

export type ChainEventKind =
  | "first_contact" | "rtr_request" | "rtr_signed" | "resume_sent" | "rate"
  | "submitted" | "client" | "interview_request" | "interview_scheduled"
  | "followup" | "response" | "note" | "offer" | "rejection"

export interface ChainContact {
  name: string
  email?: string
  phone?: string
  firstSeen?: number
  emails: number
}

export interface ChainEvent {
  at: number
  from: string
  fromEmail?: string
  isMe: boolean
  kind: ChainEventKind
  label: string
  detail: string
  mentions: string[]
  handoffFrom?: string // this sender was named in an earlier mail — the profile passed hand to hand
  messageId: string
  phone?: string
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
  sourceThreadIds?: string[]
  holderConfirmed?: boolean
  latestProgress?: { label: string; quote: string; messageId: string; at: number }
  holder: string
  holderSince?: number
  stalledDays: number
  nextAction: string
  interviewThreadId?: string
  lastActivity?: number
  events: ChainEvent[]
  contacts: ChainContact[]
  journey?: { emails: number; people: number; daysToInterview?: number }
}

const SUBMITTED_RE = /submitted your profile|profile submitted|have submitted|submission (is )?done|submitted to (the )?client|resume (has been )?submitted/i
const SHARED_RE = /shared .*profile|forwarded .*profile|sent .*profile to/i
const CLIENT_RE = /\bclient\b/i
const RTR_SIGNED_RE = /\brtr\b.{0,40}\bsign|\bsign.{0,40}\brtr\b|authorization .*signed|exclusive representation|\bi agree to (the )?rtr\b|\bagree\b.{0,30}\brtr\b/i
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

const RESUME_SENT_RE = /resume (attached|enclosed|herewith)|attached .*resume|updated resume|my resume/i
const RATE_RE = /\$\s?\d|\b\d+\s?\/\s?hr\b|rate confirmation|\bc2c\b/i
const INTERVIEW_SCHED_RE = /scheduled|invite|calendar|teams\.microsoft|meet\.google|zoom\.us|webex/i

const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d{2,5})?/i

function extractPhone(text: string): string | undefined {
  const m = text.match(PHONE_RE)
  return m ? m[0].trim() : undefined
}

function emailOf(from: string): string | undefined {
  return emailAddress(from) || undefined
}

/** First names of everyone in the thread, for mention-threading. */
function threadRoster(t: ClassifiedThread): Array<{ name: string; first: string }> {
  const seen = new Map<string, { name: string; first: string }>()
  for (const m of t.messages) {
    const name = personName(m.from)
    const first = name.split(/\s+/)[0].toLowerCase()
    if (name && first.length >= 2 && !seen.has(first)) seen.set(first, { name, first })
  }
  return [...seen.values()]
}

/** Which roster people are named in this mail's text. */
function findMentions(text: string, roster: Array<{ name: string; first: string }>, selfFirst: string): string[] {
  const out: string[] = []
  const lower = ` ${text.toLowerCase()} `
  for (const r of roster) {
    if (r.first === selfFirst) continue
    // Name appears as a standalone word ("from Shikha", "contact Emon").
    if (new RegExp(`[^\\p{L}]${r.first}[^\\p{L}]`, "iu").test(lower)) out.push(r.name)
  }
  return [...new Set(out)]
}

function classifyEvent(
  m: ClassifiedThread["messages"][number],
  isMe: boolean,
  isFirst: boolean,
  roster: Array<{ name: string; first: string }>,
  selfFirst: string,
): { kind: ChainEventKind; label: string } {
  const text = `${m.subject} ${authoredText(m.bodyText || m.snippet)}`
  const submission = !isMe ? submissionEvidence(m.bodyText || m.snippet) : null
  if (submission?.submitted) return { kind: submission.client ? "client" : "submitted", label: submission.client ? (submission.targetKind === "end_client" ? "End client submission confirmed" : "Client submission reported") : `Profile submitted${submission.recipientLabel ? ` to ${submission.recipientLabel}` : ""}` }
  if (isMe && FOLLOWUP_SENT_RE.test(authoredText(m.bodyText || m.snippet))) return { kind: "followup", label: "You followed up" }
  if (isMe && /\b(?:I agree|I confirm|I authorize|I acknowledge)\b/i.test(authoredText(m.bodyText || m.snippet)) && /rtr|represent|authorization/i.test(text)) return { kind: "rtr_signed", label: "You authorized representation" }
  if (m.category === "Offer") return { kind: "offer", label: "Offer received" }
  if (m.category === "Rejection") return { kind: "rejection", label: "Rejected" }
  if (m.category === "RTR Request") return { kind: "rtr_request", label: "RTR requested" }
  if (RTR_SIGNED_RE.test(text)) return { kind: "rtr_signed", label: isMe ? "You signed the RTR" : "RTR signed" }
  if (m.category === "Interview Request") {
    const ev = inviteEvidence({ messages: [m] } as ClassifiedThread)
    if (ev.confirmed) return { kind: "interview_scheduled", label: "Interview scheduled" }
    return { kind: "interview_request", label: "Interview requested" }
  }
  if (isMe && FOLLOWUP_SENT_RE.test(text)) return { kind: "followup", label: "You followed up" }
  if (isMe && RESUME_SENT_RE.test(text)) return { kind: "resume_sent", label: "You sent your resume" }
  if (RATE_RE.test(text) && (m.category === "Rate Confirmation" || /rate/i.test(m.subject))) {
    return { kind: "rate", label: "Rate discussed" }
  }
  if (submissionEvidence(m.bodyText || m.snippet).submitted && !isMe) {
    if (submissionEvidence(m.bodyText || m.snippet).client) return { kind: "client", label: "With the end client" }
    return { kind: "submitted", label: "Profile submitted" }
  }
  if (isFirst) return { kind: "first_contact", label: "First contact" }
  return { kind: isMe ? "response" : "note", label: isMe ? "You replied" : "Update" }
}

export function buildApplicationChains(threads: ClassifiedThread[]): ApplicationChain[] {
  const out: ApplicationChain[] = []
  const now = Date.now()

  for (const raw of linkReferencedThreads(threads)) {
    const t = { ...raw, messages: [...raw.messages].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0) || a.id.localeCompare(b.id)) }
    const primary = t.messages.find(m => emailAddress(m.from) !== t.accountEmail.toLowerCase()) || t.messages[0]
    if (!primary || !t.messages.some(m => ["RTR Request", "Rate Confirmation", "Submission Confirmation", "Interview Request", "Offer", "Rejection"].includes(m.category) || (m.hasIcs && inviteEvidence({ ...t, messages: [m] }).confirmed) || (emailAddress(m.from) !== t.accountEmail.toLowerCase() && submissionEvidence(m.bodyText || m.snippet).submitted))) continue

    const domain = extractDomain(primary.from)
    const reached = new Map<ChainStageKey, { at: number; evidence: string; messageId: string; label?: string }>()
    let terminal: "offer" | "rejected" | null = null
    let interviewThreadId: string | undefined
    const people = new Map<string, ChainLink>()

    // ── Granular event timeline: every email is a step, in order ──────────
    const roster = threadRoster(t)
    const selfFirst = (t.accountEmail || "").split("@")[0].toLowerCase()
    const events: ChainEvent[] = []
    t.messages.forEach((m, idx) => {
      const ts = m.internalDate ? Number(m.internalDate) : 0
      const isMe = emailAddress(m.from) === t.accountEmail.toLowerCase()
      const name = personName(m.from)
      const text = `${m.subject} ${authoredText(m.bodyText || m.snippet)}`
      const { kind, label } = classifyEvent(m, isMe, idx === 0, roster, selfFirst)
      const mentions = findMentions(text, roster, selfFirst)
      // A name mention is not a transfer. Require explicit completed sharing
      // language naming this exact email address in an earlier source message.
      const namingMessage = t.messages.slice(0, idx).find(previous =>
        submissionEvidence(previous.bodyText || previous.snippet).recipient === emailAddress(m.from))
      const handoffFrom = namingMessage ? personName(namingMessage.from) : undefined
      events.push({
        at: ts,
        from: name,
        fromEmail: emailOf(m.from),
        isMe,
        kind,
        label,
        detail: m.subject.slice(0, 80),
        mentions,
        handoffFrom,
        messageId: m.id,
        phone: extractPhone(text),
      })
    })

    const mark = (key: ChainStageKey, at: number, evidence: string, messageId: string, label?: string) => {
      const prev = reached.get(key)
      if (!prev || at >= prev.at) reached.set(key, { at, evidence, messageId, label })
    }

    for (const m of t.messages) {
      const text = `${m.subject} ${authoredText(m.bodyText || m.snippet)}`
      const ts = m.internalDate ? Number(m.internalDate) : 0
      const isMe = emailAddress(m.from) === t.accountEmail.toLowerCase()
      const name = personName(m.from)

      if (!isMe && name && !people.has(name.toLowerCase())) {
        const emailMatch = m.from.match(/<([^>]+)>/)
        people.set(name.toLowerCase(), {
          name,
          email: emailMatch ? emailMatch[1] : undefined,
          role: "participant",
          at: ts || undefined,
        })
      }

      if (m.category === "RTR Request" && !/^(?:re|fw|fwd):/i.test(m.subject)) mark("rtr", ts, m.subject.slice(0, 60), m.id)
      else if (RTR_SIGNED_RE.test(text) && !isMe) mark("rtr", ts, "RTR signed", m.id)
      const submission = submissionEvidence(m.bodyText || m.snippet)
      if (submission.submitted && !isMe) {
        mark("submitted", ts, submission.quote || m.subject, m.id)
        if (submission.client) mark("client", ts, submission.quote || m.subject, m.id, submission.targetKind === "end_client" ? "End client" : "Client reported")
      }
      if (!isMe && (m.category === "Interview Request" || m.hasIcs)) {
        const ev = inviteEvidence({ ...t, messages: [m] })
        if (ev.confirmed) {
          mark("interview", ts, `${ev.how === "meeting-link" ? "Meeting link" : ev.how === "calendar-invite" ? "Calendar invite" : "Confirmed"} · ${m.subject.slice(0, 50)}`, m.id)
          if (/\b(?:client|customer|hiring manager) interview\b/i.test(text)) mark("client", ts, `Client interview invitation: ${m.subject}`, m.id, "Client interview")
          interviewThreadId = m.sourceThreadId || t.threadId
        }
      }
      if (m.category === "Offer") terminal = "offer"
      if (m.category === "Rejection") terminal = "rejected"
    }

    const order: ChainStageKey[] = ["rtr", "submitted", "client", "interview", "decision"]
    let current: ChainStageKey = "rtr"
    for (const k of order) if (reached.has(k)) current = k
    // A vendor screening can precede a later client submission. The last
    // documented transfer is the present position, not the highest old dot.
    const latestTransfer = [...t.messages].reverse().find(m => emailAddress(m.from) !== t.accountEmail.toLowerCase() && submissionEvidence(m.bodyText || m.snippet).submitted)
    const transferProof = latestTransfer ? submissionEvidence(latestTransfer.bodyText || latestTransfer.snippet) : undefined
    if (latestTransfer && Number(latestTransfer.internalDate || 0) > (reached.get("interview")?.at || 0)) current = transferProof?.client ? "client" : "submitted"
    if (terminal) current = "decision"

    const stops: ChainStop[] = RAIL.map(s => {
      const r = reached.get(s.key)
      const isDecision = s.key === "decision"
      return {
        key: s.key,
        label: isDecision ? (terminal === "offer" ? "Offer" : terminal === "rejected" ? "Rejected" : "Decision") : r?.label || s.label,
        reached: isDecision ? terminal !== null : !!r,
        at: isDecision ? undefined : r?.at,
        evidence: isDecision ? undefined : r?.evidence,
        messageId: r?.messageId,
      }
    })

    // ── People & contacts: who was involved, how to reach them ──────────
    const contactMap = new Map<string, ChainContact>()
    for (const e of events) {
      if (e.isMe) continue
      const key = (e.fromEmail || e.from).toLowerCase()
      const existing = contactMap.get(key)
      if (existing) {
        existing.emails += 1
        if (!existing.phone) existing.phone = e.phone
      } else {
        contactMap.set(key, {
          name: e.from,
          email: e.fromEmail,
          phone: e.phone,
          firstSeen: e.at,
          emails: 1,
        })
      }
    }
    const contacts = [...contactMap.values()].sort((a, b) => (a.firstSeen || 0) - (b.firstSeen || 0))

    // ── Journey to interview: the numbers behind the win ─────────────────
    const interviewEv = events.find(e => e.kind === "interview_scheduled")
    const firstEv = events[0]
    const journey = {
      emails: events.length,
      people: contactMap.size,
      daysToInterview: interviewEv && firstEv?.at && interviewEv.at
        ? Math.max(0, Math.round((interviewEv.at - firstEv.at) / 86_400_000))
        : undefined,
    }

    const lastMsg = t.messages[t.messages.length - 1]
    const lastTs = lastMsg?.internalDate ? Number(lastMsg.internalDate) : 0
    const lastInbound = [...t.messages].reverse().find(m => emailAddress(m.from) !== t.accountEmail.toLowerCase())
    const inboundTs = Number(lastInbound?.internalDate || 0)
    const stalledDays = terminal ? 0 : inboundTs ? Math.max(0, Math.floor((now - inboundTs) / 86_400_000)) : 0
    const holder = terminal ? "Closed" : transferProof?.recipient || transferProof?.recipientLabel || "Unknown"
    const holderConfirmed = !!transferProof?.recipient
    const nextAction = terminal === "offer" ? "Offer email found. Review the terms."
      : terminal === "rejected" ? "Rejection email found."
      : current === "interview" ? "Invite evidence found. Attendance and outcome remain unconfirmed."
      : current === "client" ? "Client submission reported. Awaiting their response; end client identity is confirmed only when explicitly named."
      : stalledDays >= 7 ? `No recruiter update for ${stalledDays} days. Review the latest contact and draft a follow up.`
      : "Awaiting the next documented update. Missing handoffs remain open."

    out.push({
      threadId: t.threadId,
      accountEmail: t.accountEmail,
      company: domain || "Company unconfirmed",
      role: primary.jobTitle || primary.subject.slice(0, 50),
      rate: primary.rate || undefined,
      stops,
      current,
      terminal,
      links: [...people.values()].slice(0, 6),
      holder,
      holderConfirmed,
      sourceThreadIds: t.sourceThreadIds || [t.threadId],
      holderSince: latestTransfer?.internalDate ? Number(latestTransfer.internalDate) : undefined,
      latestProgress: latestTransfer && transferProof ? { label: transferProof.client ? "Client submission reported" : "Submission confirmed", quote: transferProof.quote || "", messageId: latestTransfer.id, at: Number(latestTransfer.internalDate || 0) } : undefined,
      stalledDays,
      nextAction,
      interviewThreadId,
      lastActivity: lastTs || undefined,
      events,
      contacts,
      journey,
    })
  }

  out.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
  return out
}

