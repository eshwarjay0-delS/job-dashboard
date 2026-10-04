import { createHmac } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const runtime = "nodejs"

function digest(value: string) {
  const secret = process.env.DEVICE_HASH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Device identity service is not configured.")
  return createHmac("sha256", secret).update(value).digest("hex")
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const deviceKey = String(body.deviceKey || "").trim()
  const channel = String(body.channel || "web")
  const label = String(body.label || "").slice(0, 120) || null
  if (deviceKey.length < 16 || deviceKey.length > 300) {
    return NextResponse.json({ error: "Invalid device key." }, { status: 400 })
  }
  if (!["web","mobile","extension"].includes(channel)) {
    return NextResponse.json({ error: "Invalid device channel." }, { status: 400 })
  }

  try {
    const service = createServiceClient()
    const { data, error } = await service.rpc("identity_register_device", {
      p_user_id: user.id,
      p_device_key_hash: digest(`device:${deviceKey}`),
      p_installation_key_hash: digest(`${channel}:${deviceKey}`),
      p_channel: channel,
      p_label: label,
    })
    if (error) {
      const limited = /DEVICE_LIMIT_REACHED/i.test(error.message || "")
      return NextResponse.json(
        { error: limited ? "This subscription already has two active devices." : error.message, code: limited ? "DEVICE_LIMIT_REACHED" : "DEVICE_REGISTRATION_FAILED" },
        { status: limited ? 409 : 500 },
      )
    }
    return NextResponse.json({ ok: true, deviceSlotId: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
