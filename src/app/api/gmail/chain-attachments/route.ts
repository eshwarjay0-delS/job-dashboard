import { NextResponse } from "next/server"
import { requireAuth, isAuthContext } from "../_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1"

async function gmailGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`gmail ${res.status}`)
  return res.json()
}

interface Attachment {
  filename: string
  mimeType: string
  messageId: string
  attachmentId: string
  size: number
}

function collectAttachments(payload: any, messageId: string, out: Attachment[]) {
  const walk = (p: any) => {
    if (!p) return
    const filename = p.filename || ""
    const body = p.body || {}
    // A real attachment: has a filename and an attachmentId (not inline body data).
    if (filename && body.attachmentId) {
      out.push({
        filename,
        mimeType: p.mimeType || "application/octet-stream",
        messageId,
        attachmentId: body.attachmentId,
        size: body.size || 0,
      })
    }
    for (const part of p.parts || []) walk(part)
  }
  walk(payload)
}

// GET /api/gmail/chain-attachments?threadId=X&account=email@...
// Every file attached anywhere in the thread, grouped by message — so the
// mind map can show which resume went out at each hop. Resumes first.
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }
    const rl = checkRateLimit(`gmail-attachments:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const url = new URL(req.url)
    const threadId = url.searchParams.get("threadId")
    const accountEmail = (url.searchParams.get("account") || "").toLowerCase()
    if (!threadId) return NextResponse.json({ ok: false, error: "threadId required" }, { status: 400 })

    const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
    const acct = accounts.find(a => (a.google_email || "").toLowerCase() === accountEmail)
      || accounts.find(a => a.gmail_enabled)
    if (!acct) return NextResponse.json({ ok: false, error: "No Gmail account" }, { status: 400 })

    const token = await getGoogleWorkspaceAccessToken(ctx.userId, acct.id).catch(() => null)
    if (!token) return NextResponse.json({ ok: false, error: "Gmail not connected" }, { status: 400 })

    // Try the requested account first, then any other connected account.
    const ordered = [acct, ...accounts.filter(a => a.id !== acct.id && a.gmail_enabled)]
    let thread: any = null
    for (const a of ordered) {
      const t = await getGoogleWorkspaceAccessToken(ctx.userId, a.id).catch(() => null)
      if (!t) continue
      try {
        thread = await gmailGet(`/users/me/threads/${encodeURIComponent(threadId)}?format=full`, t)
        break
      } catch { /* try next account */ }
    }
    if (!thread) return NextResponse.json({ ok: false, error: "Thread not found" }, { status: 404 })

    const isResume = (f: string) => /resume|cv|profile/i.test(f) && /\.(docx?|pdf|rtf|txt)$/i.test(f)
    const byMessage: Array<{ messageId: string; date: string; from: string; attachments: Attachment[] }> = []
    for (const m of thread.messages || []) {
      const atts: Attachment[] = []
      collectAttachments(m.payload, m.id, atts)
      if (!atts.length) continue
      const headers = m.payload?.headers || []
      const get = (n: string) => headers.find((h: any) => h.name?.toLowerCase() === n)?.value || ""
      // Resumes first, then the rest.
      atts.sort((a, b) => Number(isResume(b.filename)) - Number(isResume(a.filename)))
      byMessage.push({ messageId: m.id, date: get("date"), from: get("from"), attachments: atts })
    }

    return NextResponse.json({ ok: true, threadId, messages: byMessage })
  } catch (err) {
    console.error("gmail/chain-attachments error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
