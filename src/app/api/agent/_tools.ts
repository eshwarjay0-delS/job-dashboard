// ── MFit Agent tools ──────────────────────────────────────────────────────
// Shared by the agent chat route and the watchdog. Each tool reads the
// signed-in user's own Gmail data through the existing identity layer.
// Nothing here ever sends email — drafts only, and notifications only.

import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { VENDOR_PORTALS } from "@/lib/vendorPortals"
import {
  fetchClassifiedThreads,
  threadsToApps,
  type ClassifiedThread,
  type AccountIssue,
} from "@/app/api/gmail/_lib"

export interface ToolContext {
  userId: string
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

  const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
  const acct = accounts.find(
    a => a.gmail_enabled && (!accountEmail || a.google_email.toLowerCase() === accountEmail),
  )
  if (!acct) return { ok: false, error: "No connected Gmail account found." }

  const { getGoogleWorkspaceAccessToken } = await import("@/lib/googleWorkspace")
  const token = await getGoogleWorkspaceAccessToken(ctx.userId, acct.id).catch(() => null)
  if (!token) return { ok: false, error: "Could not get Gmail access for that account." }

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`,
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
  return { ok: true, data: { draftId: json.id, account: acct.google_email, to, subject } }
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
