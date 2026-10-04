import { NextRequest, NextResponse } from "next/server"
import { createClientFromRequest } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabase = await createClientFromRequest(request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const [{ data: profile }, { data: services }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("connected_services").select("*").eq("user_id", user.id),
  ])

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    },
    profile: profile ?? null,
    services: services ?? [],
    capabilities: {
      googleIdentity: true,
      phoneVerification: process.env.PHONE_VERIFICATION_REQUIRED === "1",
      gmailCalendar: process.env.GMAIL_CONNECT_ENABLED === "1" || process.env.GOOGLE_CALENDAR_CONNECT_ENABLED === "1",
      whatsapp: process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED === "1",
      maxActiveDevices: Number(process.env.MAX_ACTIVE_DEVICES || 2),
      deviceEnforcement: process.env.DEVICE_ENFORCEMENT_ENABLED === "1",
      nativeAutoAnswerDefault: true,
    },
  })
}
