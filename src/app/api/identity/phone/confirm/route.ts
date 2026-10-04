import { createHmac } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const runtime = "nodejs"

function normalizePhone(input: string) {
  const trimmed = input.trim()
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null
  return trimmed
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

  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(String(body.phone || ""))
  const code = String(body.code || "").trim()
  const whatsappOptIn = body.whatsappOptIn !== false

  if (!phone || !/^\d{4,10}$/.test(code)) {
    return NextResponse.json({ error: "Invalid phone or verification code." }, { status: 400 })
  }

  const cfg = twilioAuth()
  if (!cfg) return NextResponse.json({ error: "Phone verification is not configured." }, { status: 503 })

  const verify = await fetch(`https://verify.twilio.com/v2/Services/${cfg.service}/VerificationCheck`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, Code: code }),
    signal: AbortSignal.timeout(20000),
  })
  const result = await verify.json().catch(() => ({}))
  if (!verify.ok || result.status !== "approved") {
    return NextResponse.json({ error: result?.message || "Verification code was not approved." }, { status: 400 })
  }

  const secret = process.env.IDENTITY_PHONE_HASH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return NextResponse.json({ error: "Identity service is not configured." }, { status: 503 })

  const phoneHash = createHmac("sha256", secret).update(phone).digest("hex")
  const service = createServiceClient()
  const { error } = await service.rpc("identity_bind_verified_phone", {
    p_user_id: user.id,
    p_phone_e164: phone,
    p_phone_hash: phoneHash,
    p_last4: phone.slice(-4),
    p_whatsapp_opt_in: whatsappOptIn,
  })

  if (error) {
    const duplicate = /duplicate key|unique constraint/i.test(error.message || "")
    return NextResponse.json(
      { error: duplicate ? "That mobile number is already attached to another MarketFit account." : error.message },
      { status: duplicate ? 409 : 500 },
    )
  }

  return NextResponse.json({ ok: true, phoneLast4: phone.slice(-4), whatsappConnected: whatsappOptIn })
}