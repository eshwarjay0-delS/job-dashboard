import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGoogleWorkspaceAccessToken } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

function encodeMessage(to: string, subject: string, body: string) {
  const mime = [
    `To: ${to}`,
    `Subject: ${subject.replace(/[\r\n]+/g, " ")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit(`gmail-send:${user.id}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: "Email send limit reached. Try again later." }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const to = String(body.to || "").trim()
  const subject = String(body.subject || "").trim().slice(0, 180)
  const message = String(body.body || "").trim().slice(0, 20000)
  const accountId = typeof body.accountId === "string" && body.accountId ? body.accountId : null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !message) {
    return NextResponse.json({ error: "Recipient, subject and message are required." }, { status: 400 })
  }

  const token = await getGoogleWorkspaceAccessToken(user.id, accountId)
  if (!token) return NextResponse.json({ error: "Gmail is not connected." }, { status: 403 })

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encodeMessage(to, subject, message) }),
    signal: AbortSignal.timeout(20000),
  })
  const sent = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: sent?.error?.message || "Gmail send failed." }, { status: 502 })
  return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId })
}