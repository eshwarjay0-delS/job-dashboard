// ── MFit Agent tools ──────────────────────────────────────────────────────
// Shared by the agent chat route and the watchdog. Each tool reads the
// signed-in user's own Gmail data through the existing identity layer.
// Nothing here ever sends email — drafts only, and notifications only.

import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
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
  const to = str(args.to)
  const subject = str(args.subject)
  const body = str(args.body)
  const accountEmail = str(args.accountEmail).toLowerCase()
  if (!to || !subject || !body) return { ok: false, error: "to, subject, and body are required" }

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
