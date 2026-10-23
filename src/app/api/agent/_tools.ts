// ── MFit Agent tools ──────────────────────────────────────────────────────
// Shared by the agent chat route and the watchdog. Each tool reads the
// signed-in user's own Gmail data through the existing identity layer.
// Nothing here ever sends email — drafts only, and notifications only.

import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { VENDOR_PORTALS } from "@/lib/vendorPortals"
import {
  fetchClassifiedThreads,
  threadsToApps,
  type ClassifiedThread,
  type AccountIssue,
} from "@/app/api/gmail/_lib"
import { readBrief, writeBrief, mergeBrief, parseBriefText, screenBrief, briefWords, briefShowText, contactList, type ChiefBrief } from "@/lib/chief-brief"
import { guardDraft, neverContactHit } from "@/lib/chief-guard"
import { proposeJobs, planCardText, stepOf, stepFindings, findingsText, nextRunAfter, STEPS } from "@/lib/chief-goal"

export interface ToolContext {
  userId: string
  /**
   * What the person wrote to the Chief in this conversation. A figure, a claim or a commitment in a draft stands only
   * when it is in these words or in their brief (chief-guard.ts); without them, every one is flagged for the person.
   */
  ownerWords?: string[]
}

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

type ToolFn = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>

function str(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d
}
function num(v: unknown, d: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

async function supabase() {
  return createClient()
}

// ── inbox_search ──────────────────────────────────────────────────────────
async function inboxSearch(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { threads } = await fetchClassifiedThreads(ctx.userId, {
    days: Math.min(Math.max(num(args.days, 14), 1), 90),
    max: Math.min(Math.max(num(args.max, 30), 1), 100),
    query: str(args.query) || undefined,
  })
  const summary = threads.map(t => {
    const latest = t.messages[t.messages.length - 1]
    const cats = [...new Set(t.messages.map(m => m.category))]
    return {
      threadId: t.threadId,
      account: t.accountEmail,
      subject: latest.subject,
      from: latest.from,
      categories: cats,
      jobTitle: latest.jobTitle || t.messages.find(m => m.jobTitle)?.jobTitle || "",
      rate: latest.rate || t.messages.find(m => m.rate)?.rate || "",
      vendor: latest.vendor || t.messages.find(m => m.vendor)?.vendor || "",
      messages: t.messages.length,
      latestAt: latest.internalDate,
      unread: t.messages.some(m => m.unread),
    }
  })
  return { ok: true, data: { count: summary.length, threads: summary } }
}

// ── read_thread ───────────────────────────────────────────────────────────
async function readThread(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const threadId = str(args.threadId)
  const accountEmail = str(args.accountEmail).toLowerCase()
  if (!threadId) return { ok: false, error: "threadId is required" }
  const { threads } = await fetchClassifiedThreads(ctx.userId, { days: 90, max: 100 })
  const t = threads.find(
    x => x.threadId === threadId && (!accountEmail || x.accountEmail.toLowerCase() === accountEmail),
  )
  if (!t) return { ok: false, error: "Thread not found in the last 90 days." }
  return {
    ok: true,
    data: {
      threadId: t.threadId,
      account: t.accountEmail,
      messages: t.messages.map(m => ({
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
        at: m.internalDate,
        category: m.category,
        jobTitle: m.jobTitle,
        rate: m.rate,
        vendor: m.vendor,
      })),
    },
  }
}

// ── find_contact ──────────────────────────────────────────────────────────
// "Search me this guy's number": find a recruiter/vendor's phone and email
// across classified threads. Matches name fragments against From headers,
// vendor names, and subjects; pulls phone-looking strings from snippets.
async function findContact(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const name = str(args.name).toLowerCase()
  if (!name) return { ok: false, error: "name is required" }
  const { threads } = await fetchClassifiedThreads(ctx.userId, { days: 90, max: 100 })
  const hits: Array<{ name: string; email: string; phones: string[]; vendor: string; role: string; lastSeen: string }> = []
  const seen = new Set<string>()
  const phoneRe = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g
  for (const t of threads) {
    for (const m of t.messages) {
      const hay = `${m.from} ${m.vendor} ${m.subject}`.toLowerCase()
      if (!hay.includes(name)) continue
      const emailMatch = m.from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      const email = emailMatch ? emailMatch[0] : ""
      const key = `${m.vendor}|${email}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const phones = [...new Set((m.snippet.match(phoneRe) || []).map(p => p.trim()))].slice(0, 3)
      hits.push({
        name: m.vendor || m.from.split("<")[0].trim(),
        email,
        phones,
        vendor: m.vendorDomain || "",
        role: m.jobTitle || m.subject.slice(0, 60),
        lastSeen: m.internalDate ? new Date(Number(m.internalDate)).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      })
      if (hits.length >= 8) break
    }
    if (hits.length >= 8) break
  }
  if (hits.length === 0) return { ok: false, error: `No contact found matching "${str(args.name)}" in the last 90 days of threads.` }
  return { ok: true, data: { count: hits.length, contacts: hits } }
}

// ── list_submissions ──────────────────────────────────────────────────────
async function listSubmissions(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { threads } = await fetchClassifiedThreads(ctx.userId, {
    days: Math.min(Math.max(num(args.days, 60), 1), 90),
    max: 100,
  })
  const apps = threadsToApps(threads)
  return { ok: true, data: { count: apps.length, submissions: apps } }
}

// ── create_draft ──────────────────────────────────────────────────────────
// Draft-only. The Gmail API drafts.create endpoint. Never sends.
async function createDraft(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const to = str(args.to).replace(/[\r\n]/g, " ").trim()
  const subject = str(args.subject).replace(/[\r\n]/g, " ").trim()
  const body = str(args.body)
  const accountEmail = str(args.accountEmail).toLowerCase()
  if (!to || !subject || !body) return { ok: false, error: "to, subject, and body are required" }
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(to)) return { ok: false, error: "to must be a single valid email address" }
  // Nobody on the never-contact list is drafted for, and the draft holds nothing the person did not give (chief-guard.ts).
  const brief = await readBrief(ctx.userId)
  const barred = neverContactHit(brief.neverContact, to, str(args.toName))
  if (barred) return { ok: false, error: `${barred} is on the user's never-contact list: no draft is made for them. Tell the user, and do not try another address of theirs.` }
  const guarded = guardDraft({ subject, body, to, toName: str(args.toName), ownWords: [...(ctx.ownerWords || []), briefWords(brief)], resumeText: await resumeTextOf(ctx.userId) })

  const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
  const acct = accounts.find(
    a => a.gmail_enabled && (!accountEmail || a.google_email.toLowerCase() === accountEmail),
  )
  if (!acct) return { ok: false, error: "No connected Gmail account found." }

  const { getGoogleWorkspaceAccessToken } = await import("@/lib/googleWorkspace")
  const token = await getGoogleWorkspaceAccessToken(ctx.userId, acct.id).catch(() => null)
  if (!token) return { ok: false, error: "Could not get Gmail access for that account." }

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${guarded.subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${guarded.body}`,
  ).toString("base64url")

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    return { ok: false, error: `Gmail drafts.create failed (${res.status}): ${txt.slice(0, 200)}` }
  }
  const json = (await res.json()) as { id?: string }
  return { ok: true, data: { draftId: json.id, account: acct.google_email, to, subject: guarded.subject, ...(guarded.flags.length ? { flags: guarded.flags.map(f => f.note), note: "The draft holds [flags] the user must answer: list them for him in plain words; never fill them yourself." } : {}) } }
}

/**
 * The text of the person's own resumes (not the tailored copies, which carry every job post's words): what a skill
 * claim in a draft is checked against. Null when none could be read, so the claim is flagged as unchecked.
 */
async function resumeTextOf(userId: string): Promise<string | null> {
  try {
    const path = await import("path")
    const { USER_RESUMES_DIR } = await import("@/lib/paths")
    const { libraryOf, candidatesFor } = await import("@/lib/library-pick-store")
    const { readPath } = await import("@/lib/storage")
    const { extractText } = await import("@/lib/docx")
    const userDir = path.join(USER_RESUMES_DIR, userId)
    const { index, counts } = await libraryOf(userDir)
    const texts: string[] = []
    for (const email of Object.keys(counts)) {
      for (const c of (await candidatesFor(userDir, email, index)).filter(c => c.depth === 0).slice(0, 6)) {
        const buf = await readPath(c.path).catch(() => null)
        if (buf) texts.push(await extractText(buf).catch(() => ""))
      }
      if (texts.length >= 12) break
    }
    const all = texts.filter(Boolean).join("\n")
    return all ? all : null
  } catch { return null }
}

// ── notify ────────────────────────────────────────────────────────────────
async function notify(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const sb = await supabase()
  const row = {
    user_id: ctx.userId,
    type: str(args.type, "watchdog"),
    title: str(args.title).slice(0, 200),
    body: str(args.body).slice(0, 2000),
    link: str(args.link).slice(0, 500) || null,
    read: false,
  }
  if (!row.title) return { ok: false, error: "title is required" }
  const { data, error } = await sb.from("mfit_notifications").insert(row).select("id").single()
  if (error) return { ok: false, error: `Could not save notification: ${error.message}` }
  return { ok: true, data: { id: data.id } }
}

// ── search_vendor_portals ─────────────────────────────────────────────────
// The Apply tab's prime vendor directory (57 US IT contract staffing firms).
// Lets the agent answer "which portals have a cyber practice", "firms in Texas", etc.
async function searchVendorPortals(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const q = str(args.query).trim().toLowerCase()
  const cyberOnly = args.cyberOnly === true || str(args.cyberOnly).toLowerCase() === "true"
  const withPortal = args.withPortal === true || str(args.withPortal).toLowerCase() === "true"
  const max = Math.min(Math.max(num(args.max, 20), 1), 57)
  const hits = VENDOR_PORTALS.filter(v => {
    if (cyberOnly && !v.cyber) return false
    if (withPortal && !v.url) return false
    if (!q) return true
    return [v.firm, v.hq, v.specialties, v.size, v.notes].join(" ").toLowerCase().includes(q)
  }).slice(0, max)
  return {
    ok: true,
    data: {
      count: hits.length,
      total: VENDOR_PORTALS.length,
      portals: hits.map(v => ({
        firm: v.firm, portal: v.url || null, hq: v.hq,
        specialties: v.specialties, size: v.size,
        cyberPractice: v.cyber, cyberOnly: v.cyberCore,
        notes: v.notes,
      })),
    },
  }
}


// ── chief_briefing ────────────────────────────────────────────────────────
// The unified "while you were out" report: submissions by stage, threads
// needing action, interview invites, double-submit risks. One call = the
// whole picture. This is the Heartbeat equivalent for a solo user.
async function chiefBriefing(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const days = Math.min(Math.max(num(args.days, 2), 1), 14)
  const { threads } = await fetchClassifiedThreads(ctx.userId, { days, max: 100 })
  const byStage: Record<string, number> = {}
  const needsAction: Array<{ from: string; subject: string; why: string; threadId: string }> = []
  const interviews: Array<{ from: string; subject: string; when: string }> = []
  const rateConfirmations: Array<{ from: string; role: string; rate: string }> = []
  const documentRequests: Array<{ from: string; subject: string }> = []
  const rtrRequests: Array<{ from: string; subject: string }> = []

  for (const t of threads) {
    const latest = t.messages[t.messages.length - 1]
    const cats = new Set(t.messages.map(m => m.category))
    const stage = latest.category || "unclassified"
    byStage[stage] = (byStage[stage] || 0) + 1
    const title = latest.jobTitle || t.messages.find(m => m.jobTitle)?.jobTitle || ""
    const vendor = latest.vendor || t.messages.find(m => m.vendor)?.vendor || ""

    if (cats.has("Interview Request")) {
      interviews.push({ from: latest.from || "", subject: latest.subject || "", when: latest.internalDate || "" })
    }
    if (cats.has("Rate Confirmation") && latest.rate) {
      rateConfirmations.push({ from: latest.from || "", role: title, rate: latest.rate })
    }
    // The owner's triage (23 Oct 2026) names document requests and RTRs beside invites and rates.
    if (cats.has("Document Request")) documentRequests.push({ from: latest.from || "", subject: latest.subject || "" })
    if (cats.has("RTR Request")) rtrRequests.push({ from: latest.from || "", subject: latest.subject || "" })
    // Threads gone quiet 7+ days that were active = follow-up candidates
    // internalDate is milliseconds written as text: new Date("1700000000000") is Invalid Date, so until 23 Oct 2026 no
    // thread was ever counted quiet and the follow-up list was always empty.
    const lastDate = Number(latest.internalDate) || 0
    const daysQuiet = (Date.now() - lastDate) / 86400000
    if (daysQuiet >= 7 && (cats.has("RTR Request") || cats.has("Submission Confirmation") || cats.has("Interview Request"))) {
      needsAction.push({
        from: latest.from || "", subject: latest.subject || "",
        why: `Quiet ${Math.floor(daysQuiet)} days after ${stage}`,
        threadId: t.threadId,
      })
    }
    // Double-submit risk: same role from 2+ vendors
    void vendor
  }

  return {
    ok: true,
    data: {
      windowDays: days,
      threadCount: threads.length,
      byStage,
      interviews: interviews.slice(0, 10),
      rateConfirmations: rateConfirmations.slice(0, 10),
      documentRequests: documentRequests.slice(0, 10),
      rtrRequests: rtrRequests.slice(0, 10),
      followUpCandidates: needsAction.slice(0, 15),
    },
  }
}

// ── kompas_prep ───────────────────────────────────────────────────────────
// Interview prep status from Kompas: recent sessions and what was practiced.
// Lets the Chief answer "am I ready for tomorrow's interview" by combining
// this with interview invites from chief_briefing.
async function kompasPrep(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const sb = await supabase()
    const { data, error } = await sb
      .from("kompas_sessions")
      .select("id, created_at, role, company, questions_asked, duration_sec")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(num(args.limit, 5), 1), 20))
    if (error) return { ok: false, error: `Could not read Kompas sessions: ${error.message}` }
    type SessionRow = { id: string; created_at: string; role: string | null; company: string | null; questions_asked: number | null; duration_sec: number | null }
    const rows = (data || []) as SessionRow[]
    return {
      ok: true,
      data: {
        sessions: rows.map(s => ({
          id: s.id, at: s.created_at, role: s.role, company: s.company,
          questions: s.questions_asked, durationMin: s.duration_sec ? Math.round(s.duration_sec / 60) : null,
        })),
        count: rows.length,
      },
    }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) }
  }
}


// ── chief_watch ─────────────────────────────────────────────────────────
// The briefable Chief: a plain-words goal ("watch the Richmond 814050 req")
// becomes a persistent watch task. The Chief decomposes the goal into
// sub-checks (recorded here), runs them on a schedule via /api/chief/watch/run,
// and nudges only when the findings change. Nothing sends without the user's yes.
type WatchRow = {
  id: string; goal: string; subject: string | null; sub_checks: string[];
  check_every_minutes: number; next_run_at: string; deadline_at: string | null;
  status: string; last_findings: unknown; last_run_at: string | null; created_at: string;
}

async function watchesTable(sb: Awaited<ReturnType<typeof supabase>>): Promise<boolean> {
  const { error } = await sb.from("mfit_chief_watches").select("id").limit(1)
  return !error
}

async function chiefWatch(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const sb = await supabase()
  if (!(await watchesTable(sb))) {
    return { ok: false, error: "Watch storage not ready: run supabase/migrations/20261020_chief_watches.sql in the Mfit project SQL editor first." }
  }
  const action = str(args.action, "create").toLowerCase()

  if (action === "list") {
    const { data, error } = await sb.from("mfit_chief_watches")
      .select("id, goal, subject, sub_checks, check_every_minutes, next_run_at, deadline_at, status, last_run_at, created_at")
      .eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(20)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { watches: (data || []) as WatchRow[] } }
  }

  if (action === "cancel") {
    const id = str(args.id)
    if (!id) return { ok: false, error: "id is required to cancel a watch." }
    const { error } = await sb.from("mfit_chief_watches")
      .update({ status: "cancelled" }).eq("id", id).eq("user_id", ctx.userId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { cancelled: id } }
  }

  // create — the Chief decomposes the goal into sub-checks here
  const goal = str(args.goal).trim()
  if (!goal) return { ok: false, error: "goal is required (plain words, e.g. 'watch the Richmond 814050 req')." }
  const subject = str(args.subject).trim() || null
  const subChecks = Array.isArray(args.sub_checks)
    ? (args.sub_checks as unknown[]).map(x => String(x)).filter(Boolean).slice(0, 8)
    : defaultSubChecks(goal, subject)
  const everyMin = Math.min(Math.max(num(args.check_every_minutes, 1440), 1440), 10080)
  const deadline = str(args.deadline).trim() || null

  const { data, error } = await sb.from("mfit_chief_watches").insert({
    user_id: ctx.userId, goal, subject, sub_checks: subChecks,
    check_every_minutes: everyMin, deadline_at: deadline, status: "active",
    next_run_at: new Date().toISOString(),
  }).select("id, goal, subject, sub_checks, check_every_minutes, next_run_at, deadline_at, status").single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { watch: data as WatchRow, note: "The Chief decomposed your goal into sub-checks and will run them on schedule, nudging only on change." } }
}

// Default decomposition when the agent doesn't supply its own sub-checks.
function defaultSubChecks(goal: string, subject: string | null): string[] {
  const s = subject || goal
  return [
    `Scan recent threads mentioning "${s}" for new activity`,
    `Check for new vendors or chains filing on "${s}" (double-submit risk)`,
    `Flag any interview invite, RTR, rate confirmation, or doc deadline on "${s}"`,
  ]
}

// ── runDueWatches ───────────────────────────────────────────────────────
// Executed by /api/chief/watch/run (cron). Runs every due active watch:
// chief_briefing filtered by subject, hash the findings, notify on change.
/**
 * The scheduler's database: the service client when it is set up. The runner has no browser session, and
 * mfit_notifications only lets a signed-in person write their own rows, so until 23 Oct 2026 every finding the runner
 * tried to report was refused without a word.
 */
async function unattended(): Promise<Awaited<ReturnType<typeof supabase>>> {
  const { serviceClientAvailable, createServiceClient } = await import("@/lib/supabase/service")
  return serviceClientAvailable() ? (createServiceClient() as unknown as Awaited<ReturnType<typeof supabase>>) : supabase()
}

export async function runDueWatches(userId: string): Promise<{ ran: number; changed: number; errors: string[] }> {
  const sb = await unattended()
  const out = { ran: 0, changed: 0, errors: [] as string[] }
  if (!(await watchesTable(sb))) { out.errors.push("mfit_chief_watches table missing"); return out }
  const { data: watches, error } = await sb.from("mfit_chief_watches")
    .select("*").eq("user_id", userId).eq("status", "active")
    .lte("next_run_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(10)
  if (error) { out.errors.push(error.message); return out }
  const ctx: ToolContext = { userId }
  // A goal's jobs (chief-goal.ts) read the same mail: fetched once for all of this person's jobs in this run.
  let threads: ClassifiedThread[] | null = null
  let brief: ChiefBrief | null = null
  for (const w of (watches || []) as (WatchRow & { last_findings_hash: string | null })[]) {
    out.ran++
    try {
      const step = stepOf(w.sub_checks)
      let findings: unknown
      let hash: string
      let report = ""
      if (step) {
        threads ??= (await fetchClassifiedThreads(userId, { days: 21, max: 100 })).threads
        brief ??= await readBrief(userId)
        const f = stepFindings(step, threads, { now: Date.now(), subject: w.subject, neverContact: brief.neverContact })
        findings = f
        hash = createHash("sha1").update(JSON.stringify(f.items)).digest("hex")
        // A goal's job reports what it found on its first run too: he asked for the work, not for a baseline.
        if (f.items.length && w.last_findings_hash !== hash) report = findingsText(step, f)
      } else {
        const brief0 = await runTool(ctx, "chief_briefing", { days: 2 })
        findings = brief0.ok ? filterFindings(brief0.data, w.subject) : { error: brief0.error }
        hash = JSON.stringify(findings).length + ":" + JSON.stringify(findings).slice(0, 200)
        if (w.last_findings_hash && w.last_findings_hash !== hash) report = `Something changed on your watch "${w.goal}". ${summarizeFindings(findings)}`
      }
      const nextRun = new Date(nextRunAfter(Date.now(), w.check_every_minutes)).toISOString()
      await sb.from("mfit_chief_watches").update({
        last_findings: findings, last_findings_hash: hash,
        last_run_at: new Date().toISOString(), next_run_at: nextRun,
        status: w.deadline_at && new Date(w.deadline_at) < new Date() ? "done" : "active",
      }).eq("id", w.id)
      if (report) {
        out.changed++
        const { error: nerr } = await sb.from("mfit_notifications").insert({
          user_id: userId, type: "chief-watch", read: false, link: null,
          title: (step ? `Chief job: ${STEPS[step].does}` : `Chief watch: ${w.subject || w.goal}`).slice(0, 200),
          body: report.slice(0, 2000),
        })
        if (nerr) out.errors.push(`${w.id}: notification not saved: ${String(nerr.message).slice(0, 120)}`)
      }
    } catch (e) {
      out.errors.push(`${w.id}: ${String(e).slice(0, 150)}`)
    }
  }
  return out
}

function filterFindings(data: unknown, subject: string | null): unknown {
  if (!subject || typeof data !== "object" || data === null) return data
  const d = data as Record<string, unknown>
  const q = subject.toLowerCase()
  const match = (arr: unknown) => Array.isArray(arr)
    ? arr.filter((x: unknown) => JSON.stringify(x).toLowerCase().includes(q))
    : arr
  return { ...d, interviews: match(d.interviews), rateConfirmations: match(d.rateConfirmations), followUpCandidates: match(d.followUpCandidates) }
}

function summarizeFindings(f: unknown): string {
  try {
    const d = f as Record<string, { length?: number }[]>
    const parts: string[] = []
    if (d.interviews?.length) parts.push(`${d.interviews.length} interview invite(s)`)
    if (d.rateConfirmations?.length) parts.push(`${d.rateConfirmations.length} rate confirmation(s)`)
    if (d.followUpCandidates?.length) parts.push(`${d.followUpCandidates.length} thread(s) need follow-up`)
    return parts.length ? parts.join("; ") + "." : "New activity detected."
  } catch { return "New activity detected." }
}

// ── chief_approval ─────────────────────────────────────────────────────────
// Phase 4: send the owner a WhatsApp approval card (Send / Edit / Skip buttons)
// for a sensitive draft. Nothing sends without his tap. Since 23 Oct 2026 the draft is
// guarded first (never-contact list, rates, resume gaps, filings, employer claims:
// chief-guard.ts), and the card goes only to a number that answers as this account.
async function chiefApproval(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { createApprovalCard, deliverApprovalCard, cardRecipientFor, updateGmailDraft, NeverContactError } = await import("@/lib/chief-approvals")
  // Line breaks only. Until 23 Oct 2026 this read /[\\r\\n]/, which also took every "r" and "n" out of the address
  // and the subject ("Senior role" became "Se io  ole"), and the address then failed the check below.
  const to = str(args.to).replace(/[\r\n]/g, " ").trim()
  const subject = str(args.subject).replace(/[\r\n]/g, " ").trim()
  const body = str(args.body).trim()
  const draftId = str(args.draftId).trim() || undefined
  const accountEmail = str(args.accountEmail).toLowerCase() || undefined
  const threadId = str(args.threadId).trim()
  if (!to || !subject || !body) return { ok: false, error: "to, subject, and body are required." }
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(to)) return { ok: false, error: "to must be a single valid email address" }
  const waDigits = await cardRecipientFor(ctx.userId)
  if (!waDigits) return { ok: false, error: "No WhatsApp number answers as this account, so there is nowhere to send the card. The user links his number in Connections." }
  const brief = await readBrief(ctx.userId)
  // What the thread itself shows: whether the submission was confirmed, and what the recruiter asked for.
  let filed = false
  let context = ""
  if (threadId) {
    const { threads } = await fetchClassifiedThreads(ctx.userId, { days: 90, max: 100 })
    const t = threads.find(x => x.threadId === threadId)
    if (t) {
      filed = t.messages.some(m => m.category === "Submission Confirmation")
      context = t.messages.filter(m => !m.from.toLowerCase().includes(t.accountEmail.toLowerCase())).map(m => m.snippet).join("\n")
    }
  }
  let card
  try {
    card = await createApprovalCard({
      userId: ctx.userId, to: waDigits, kind: "followup-draft", toEmail: to, toName: str(args.toName),
      subject, body, draftId, accountEmail, neverContact: brief.neverContact,
      ownWords: [...(ctx.ownerWords || []), briefWords(brief)], resumeText: await resumeTextOf(ctx.userId), filed, context,
    })
  } catch (e) {
    if (e instanceof NeverContactError) return { ok: false, error: `${e.entry} is on the user's never-contact list: no card is made. Tell the user plainly.` }
    throw e
  }
  // The Gmail draft says what the card says, so the draft in Gmail never carries what the guard took out.
  if (draftId && accountEmail && (card.body !== body || card.subject !== subject)) {
    await updateGmailDraft(ctx.userId, accountEmail, draftId, to, card.subject, card.body)
  }
  const flags = (card.flags || []).map(f => f.note)
  try {
    const waId = await deliverApprovalCard(card)
    return { ok: true, data: { cardId: card.id, waMessageId: waId, ...(flags.length ? { flags } : {}), note: "Approval card sent to WhatsApp. The owner taps Send / Edit / Skip." + (flags.length ? " The card lists what he must answer; Send stays locked until he edits those [flags]." : "") } }
  } catch (e) {
    return { ok: false, error: `Card created (${card.id}) but WhatsApp delivery failed: ${String(e).slice(0, 200)}` }
  }
}

// ── chief_brief ─────────────────────────────────────────────────────────────
// The person's brief (chief-brief.ts): read before every job. Set in their words.
async function chiefBrief(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const action = str(args.action, "show").toLowerCase()
  const current = await readBrief(ctx.userId)
  if (action === "show") return { ok: true, data: { brief: current, text: briefShowText(current) } }
  const patch: Partial<ChiefBrief> = str(args.text) ? parseBriefText(str(args.text)).patch : {}
  for (const k of ["rule", "me", "people", "voice", "never"] as const) if (typeof args[k] === "string") patch[k] = String(args[k])
  if (args.neverContact !== undefined) patch.neverContact = contactList(args.neverContact)
  if (Array.isArray(args.addNeverContact) || typeof args.addNeverContact === "string") patch.neverContact = [...(patch.neverContact || current.neverContact), ...contactList(args.addNeverContact)]
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to set: give me, people, voice, never, neverContact, addNeverContact or text." }
  const why = screenBrief(patch)
  if (why) return { ok: false, error: why }
  const saved = await writeBrief(ctx.userId, mergeBrief(current, patch))
  return { ok: true, data: { brief: saved, text: briefShowText(saved) } }
}

// ── chief_goal ──────────────────────────────────────────────────────────────
// One goal in plain words → the Chief's proposed jobs, as one approval card on the
// user's WhatsApp. Nothing is scheduled until the user taps Yes (chief-commands.ts).
async function chiefGoal(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const goal = str(args.goal).trim()
  if (goal.length < 6) return { ok: false, error: "goal is required, in plain words (e.g. 'watch my submissions tonight')." }
  const { createApprovalCard, deliverApprovalCard, cardRecipientFor } = await import("@/lib/chief-approvals")
  const plan = await proposeJobs({ goal, brief: await readBrief(ctx.userId) })
  const preview = { goal: plan.goal, jobs: plan.jobs, notBuilt: plan.notBuilt.map(j => ({ ...j, why: STEPS[j.step].why })) }
  if (!plan.jobs.length) return { ok: true, data: { ...preview, note: "Nothing in this goal can be scheduled yet; nothing was saved. Tell the user which parts are not built." } }
  const to = await cardRecipientFor(ctx.userId)
  if (!to) return { ok: false, error: "No WhatsApp number answers as this account, so the jobs cannot be put to the user for a yes and nothing was saved. He can send the goal on WhatsApp as 'goal: …' once his number is linked." }
  const card = await createApprovalCard({ userId: ctx.userId, to, kind: "jobs-plan", toEmail: "", subject: plan.goal, body: planCardText(plan, Date.now()), plan })
  try {
    await deliverApprovalCard(card)
  } catch (e) {
    return { ok: false, error: `The jobs card could not be sent to WhatsApp (${String(e).slice(0, 120)}); nothing was scheduled.` }
  }
  return { ok: true, data: { ...preview, cardId: card.id, note: "Proposed on WhatsApp for his Yes. Nothing is scheduled until he taps it." } }
}

// ── Tool registry ─────────────────────────────────────────────────────────
export const AGENT_TOOLS: Record<string, { description: string; fn: ToolFn }> = {
  inbox_search: {
    description:
      "Search the user's classified Gmail threads. Args: query (Gmail search query, optional), days (1-90, default 14), max (1-100, default 30). Returns thread summaries with categories, job titles, rates, vendors.",
    fn: inboxSearch,
  },
  read_thread: {
    description:
      "Read every message in one thread. Args: threadId (required), accountEmail (optional). Returns from/subject/snippet/category per message.",
    fn: readThread,
  },
  list_submissions: {
    description:
      "List job submissions derived from classified threads. Args: days (1-90, default 60). Returns applications with role, vendor, stage, rate.",
    fn: listSubmissions,
  },
  find_contact: {
    description:
      "Find a recruiter or vendor's contact details. Args: name (required — full or partial name, e.g. 'Amit Singh'). Searches 90 days of threads and returns names, emails, phone numbers, vendor, role, and last-seen date.",
    fn: findContact,
  },
  create_draft: {
    description:
      "Create a Gmail DRAFT (never sends). Args: to, subject, body (required), accountEmail (optional — defaults to first connected account). The user reviews and sends it himself.",
    fn: createDraft,
  },
  notify: {
    description:
      "Save an in-app notification for the user. Args: title, body (required), type (e.g. watchdog), link (optional app path). Use for watchdog findings.",
    fn: notify,
  },
  search_vendor_portals: {
    description:
      "Search the Apply tab's prime vendor portal directory (57 US IT contract staffing firms). Args: query (optional keyword — firm name, city, state, specialty), cyberOnly (optional boolean — only firms with a cybersecurity practice), withPortal (optional boolean — only firms with a verified direct portal link), max (1-57, default 20). Returns firm, portal URL, HQ, specialties, size, cyber flags.",
    fn: searchVendorPortals,
  },
  chief_briefing: {
    description:
      "The unified status report: thread counts by stage, interview invites, rate confirmations, and follow-up candidates (threads quiet 7+ days). Args: days (1-14, default 2). One call gives the whole picture — use for 'what's pending' and morning briefings.",
    fn: chiefBriefing,
  },
  kompas_prep: {
    description:
      "Interview prep status from Kompas: recent practice sessions with role, company, questions asked, duration. Args: limit (1-20, default 5). Combine with chief_briefing interview invites to answer readiness questions.",
    fn: kompasPrep,
  },
  chief_watch: {
    description:
      "The briefable Chief: create a persistent watch from a plain-words goal. The Chief decomposes it into sub-checks, runs them on schedule, nudges only on change. Args: action ('create'|'list'|'cancel', default create); goal (required for create, e.g. 'watch the Richmond 814050 req'); subject (optional req/client/vendor keyword); sub_checks (optional string[] — your own decomposition; default provided); check_every_minutes (1440-10080, default 1440 — daily; runner is daily on current hosting plan); deadline (optional ISO date); id (required for cancel). For a whole goal rather than one named thing, use chief_goal, which asks his yes first.",
    fn: chiefWatch,
  },
  chief_approval: {
    description:
      "Send the owner a WhatsApp approval card with Send / Edit / Skip quick-reply buttons for a sensitive draft. Args: to, subject, body (required — the draft), toName (optional recipient name), draftId (optional Gmail draft id, so Send actually sends it and Skip discards it), accountEmail (optional Gmail account), threadId (optional — the thread it answers, so a confirmed submission and the recruiter's own asks are read from it). Nothing ever sends without his tap. The draft is checked first: nobody on the never-contact list; any rate he did not give, skill not on his resume, submission not confirmed, employer claim or commitment becomes a [flag] he must answer.",
    fn: chiefApproval,
  },
  chief_brief: {
    description:
      "The user's brief, read before every job: the one rule, Me, My candidates, My voice (two lines), Never, and the never-contact list. Args: action ('show'|'set', default show); for set any of me, people, voice, never, rule (strings), neverContact (replaces the list), addNeverContact (adds names or domains), or text (lines like 'Me: …'). Never put identity numbers or passwords in it.",
    fn: chiefBrief,
  },
  chief_goal: {
    description:
      "Turn one goal in plain words into the Chief's own scheduled jobs (1-5, each with a day and its run time), proposed to the user as ONE WhatsApp approval card. Args: goal (required, e.g. 'watch my submissions tonight'). Nothing is scheduled until he taps Yes. Use this for a goal; use chief_watch only when he names one thing to watch himself.",
    fn: chiefGoal,
  },
}

export const TOOL_NAMES = Object.keys(AGENT_TOOLS)

export function toolPromptBlock(): string {
  const lines = Object.entries(AGENT_TOOLS).map(
    ([name, t]) => `- ${name}: ${t.description}`,
  )
  return [
    "You have tools. To use one, emit a single JSON block on its own lines, exactly like:",
    "```tool",
    '{"tool": "inbox_search", "args": {"query": "Wisconsin ETF", "days": 30}}',
    "```",
    "Then STOP and wait for the tool result — it comes back as a [TOOL RESULT] message. You may chain up to 6 tool calls per turn, one per assistant message. After the last result, answer the user directly with no more tool blocks.",
    "Available tools:",
    ...lines,
  ].join("\n")
}

export async function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const t = AGENT_TOOLS[name]
  if (!t) return { ok: false, error: `Unknown tool: ${name}` }
  try {
    return await t.fn(ctx, args)
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 300) }
  }
}

// Narrow the type for the watchdog's own analysis
export type { ClassifiedThread, AccountIssue }
export { fetchClassifiedThreads, threadsToApps }
