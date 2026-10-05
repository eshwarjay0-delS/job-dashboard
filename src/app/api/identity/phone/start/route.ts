import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePhone, sendVerificationCode } from "@/lib/phoneVerify"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// POST { phone } -> texts a verification code to that number. The person must be signed in.
// A refusal comes back as a sentence the person can act on plus a `reason`; the provider's own message never leaves the server.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { phone } = await req.json().catch(() => ({ phone: "" }))
  const normalized = normalizePhone(String(phone || ""))
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid US 10 digit number or an international number in E.164 format.", reason: "invalid_number" }, { status: 400 })
  }

  // Every code is a paid text to a number the caller chose. Five an hour is plenty for one person verifying one phone; the
  // limiter is per server instance, so it slows abuse rather than ending it (the provider's own fraud controls are the real bound).
  const mine = checkRateLimit(`phone-start:${user.id}`, { max: 5, windowMs: 60 * 60 * 1000 })
  const here = checkRateLimit(`phone-start-ip:${clientIp(req)}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!mine.ok || !here.ok) {
    return NextResponse.json({ error: "Too many codes were requested. Wait a while, then try again.", reason: "too_many_attempts" }, { status: 429 })
  }

  const sent = await sendVerificationCode(normalized)
  if (!sent.ok) return NextResponse.json({ error: sent.message, reason: sent.reason }, { status: sent.http })

  return NextResponse.json({ ok: true, status: "pending" })
}
