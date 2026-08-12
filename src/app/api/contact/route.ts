import { NextRequest, NextResponse } from "next/server"
import { blob } from "@/lib/storage"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  // 3 contact form submissions per hour per IP — prevents disk-fill spam
  const rl = checkRateLimit(`contact:${clientIp(request)}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }
  try {
    const { email, message } = await request.json()
    if (!message?.trim()) return NextResponse.json({ error: "No message." }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: "Message too long (max 5000 chars)." }, { status: 400 })

    const line = JSON.stringify({
      ts: new Date().toISOString(),
      email: (email || "").trim() || "anonymous",
      message: message.trim(),
    }) + "\n"

    await blob.put("contact_messages.jsonl", ((await blob.getText("contact_messages.jsonl")) || "") + line)

    // ── Owner notification — fire-and-forget, never blocks the 200 response ──
    // Supports two outbound channels; configure one or both via env vars:
    //   CONTACT_WEBHOOK_URL  — any HTTPS endpoint (Slack, Discord, Make, Zapier, n8n…)
    //                          receives: { text, email, message, ts }
    //   CONTACT_EMAIL_TO     — Resend.com delivery; also requires RESEND_API_KEY env var
    //                          sends a plain-text email to that address
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL
    const emailTo    = process.env.CONTACT_EMAIL_TO
    const resendKey  = process.env.RESEND_API_KEY
    const msgData    = JSON.parse(line) as { ts: string; email: string; message: string }

    if (webhookUrl) {
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `📬 New MarketFit contact\nFrom: ${msgData.email}\n\n${msgData.message}`,
          email:   msgData.email,
          message: msgData.message,
          ts:      msgData.ts,
        }),
      }).catch(() => { /* best-effort */ })
    }

    if (emailTo && resendKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from:    "MarketFit <noreply@marketfit.app>",
          to:      [emailTo],
          subject: `New contact message from ${msgData.email}`,
          text:    `From: ${msgData.email}\nSent: ${msgData.ts}\n\n${msgData.message}`,
        }),
      }).catch(() => { /* best-effort */ })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
