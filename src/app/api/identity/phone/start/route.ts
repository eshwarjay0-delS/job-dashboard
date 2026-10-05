import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function normalizePhone(input: string) {
  const trimmed = input.trim()
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

function twilioAuth() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const service = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_SERVICE_SID
  if (!sid || !token || !service) return null
  return { sid, token, service }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { phone } = await req.json().catch(() => ({ phone: "" }))
  const normalized = normalizePhone(String(phone || ""))
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid US 10 digit number or an international number in E.164 format." }, { status: 400 })
  }

  const cfg = twilioAuth()
  if (!cfg) return NextResponse.json({ error: "Phone verification is not configured." }, { status: 503 })

  const res = await fetch(`https://verify.twilio.com/v2/Services/${cfg.service}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: normalized, Channel: "sms" }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: body?.message || "Could not send verification code." }, { status: 502 })
  }

  return NextResponse.json({ ok: true, status: body.status || "pending" })
}