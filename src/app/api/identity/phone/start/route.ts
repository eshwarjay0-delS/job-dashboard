import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePhone, sendVerificationCode } from "@/lib/phoneVerify"

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

  const sent = await sendVerificationCode(normalized)
  if (!sent.ok) return NextResponse.json({ error: sent.message, reason: sent.reason }, { status: sent.http })

  return NextResponse.json({ ok: true, status: "pending" })
}
