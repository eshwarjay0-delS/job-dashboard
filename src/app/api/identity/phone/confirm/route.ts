import { createHmac } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { normalizePhone, checkVerificationCode } from "@/lib/phoneVerify"
import { waDisplayNumber } from "@/lib/whatsapp"

export const runtime = "nodejs"

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

  // The link to the account is checked BEFORE the code is spent: a code can be used once, so if the account cannot be linked
  // (the service key or the database function is missing) the person must not lose their code finding that out.
  const secret = process.env.IDENTITY_PHONE_HASH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !serviceClientAvailable()) {
    console.error("[phone-verify] cannot link: the identity service is not configured")
    return NextResponse.json({ error: "We cannot link a mobile number to your account right now. This is on our side. Your code is still valid: please try again in a few minutes.", reason: "identity_not_configured" }, { status: 503 })
  }

  const checked = await checkVerificationCode(phone, code)
  if (!checked.ok) return NextResponse.json({ error: checked.message, reason: checked.reason }, { status: checked.http })

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
    const duplicate = /duplicate key|unique constraint|PHONE_ALREADY_BOUND/i.test(error.message || "")
    // The database's own message (it can name tables and functions) stays in the server log.
    if (!duplicate) console.error("[phone-verify] binding failed", { message: String(error.message || "").slice(0, 300) })
    return NextResponse.json(
      {
        error: duplicate
          ? "That mobile number is already attached to another MarketFit account."
          : "Your code was right, but we could not link the number to your account. This is on our side. Press Send code and try again in a few minutes.",
        reason: duplicate ? "already_bound" : "binding_failed",
      },
      { status: duplicate ? 409 : 500 },
    )
  }

  const { data: resolvedUserId, error: resolveError } = await service.rpc("identity_resolve_whatsapp_user", {
    p_phone_e164: phone,
  })
  const bindingReady = !resolveError && String(resolvedUserId || "") === user.id

  if (whatsappOptIn && !bindingReady) {
    return NextResponse.json(
      { error: "Your phone was verified, but the WhatsApp identity binding could not be confirmed. Please retry verification." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    phoneLast4: phone.slice(-4),
    whatsappConnected: whatsappOptIn && bindingReady,
    identityReady: bindingReady,
    // The number this person can now message. Empty when the bot's sender is not wired on this deployment.
    whatsappNumber: whatsappOptIn && bindingReady ? await waDisplayNumber() : "",
  })
}