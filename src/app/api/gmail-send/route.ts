import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

import { recipients, attachments, encodeGmailMessage } from "@/lib/gmail-message"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit(`gmail-send:${user.id}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: "Email send limit reached. Try again later." }, { status: 429 })

  if (req.headers.get("sec-fetch-site") === "cross-site" || (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  let to: string[], cc: string[], bcc: string[], files
  try { to = recipients(body.to); cc = recipients(body.cc || ""); bcc = recipients(body.bcc || ""); files = attachments(body.attachments) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid message." }, { status: 400 }) }
  const subject = String(body.subject || "").trim().slice(0, 180)
  const message = String(body.body || "").trim().slice(0, 20000)
  if (!to.length || !subject || !message) return NextResponse.json({ error: "Recipient, subject and message are required." }, { status: 400 })
  const accounts = await listGoogleWorkspaceAccounts(user.id)
  const account = typeof body.accountEmail === "string" ? accounts.find(a => a.google_email.toLowerCase() === body.accountEmail.toLowerCase()) : accounts.find(a => a.id === body.accountId)
  if (!account || !account.gmail_enabled) return NextResponse.json({ error: "Choose a connected sending account." }, { status: 400 })
  const token = await getGoogleWorkspaceAccessToken(user.id, account.id)
  if (!token) return NextResponse.json({ error: "Reconnect this Gmail account." }, { status: 403 })
  const threadId = typeof body.threadId === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(body.threadId) ? body.threadId : undefined
  if (body.threadId && !threadId) return NextResponse.json({error:"Invalid conversation."},{status:400})
  let replyTo: string | undefined
  if (threadId) {
    const thread = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Message-ID`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
    if (!thread.ok) return NextResponse.json({ error: "This thread could not be verified in the selected inbox." }, { status: 409 })
    const data = await thread.json()
    const last = data.messages?.at(-1)
    replyTo = last?.payload?.headers?.find((h: { name: string; value: string }) => h.name.toLowerCase() === "message-id")?.value
  }
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encodeGmailMessage({ from: account.google_email, to, cc, bcc, subject, body: message, attachments: files, replyTo }), ...(threadId ? { threadId } : {}) }),
    signal: AbortSignal.timeout(20000),
  })
  const sent = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: sent?.error?.message || "Gmail send failed." }, { status: 502 })
  return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId })
}