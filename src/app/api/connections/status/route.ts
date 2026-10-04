import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { waConfigured } from "@/lib/whatsapp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const [{ data: profile }, { data: services }] = await Promise.all([
    supabase
      .from("profiles")
      .select("phone_verified,phone_last4,whatsapp_opt_in,gmail_connected,calendar_connected")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("connected_services")
      .select("service,status,connected_account_label,connected_at,updated_at")
      .eq("user_id", user.id),
  ])

  const byService = Object.fromEntries((services || []).map(row => [row.service, row]))
  const whatsappSystemReady = waConfigured()
  const whatsappDisplay = (process.env.WHATSAPP_DISPLAY_NUMBER || "").replace(/\D/g, "")

  return NextResponse.json({
    user: { email: user.email ?? null },
    googleWorkspace: {
      gmail: Boolean(profile?.gmail_connected),
      calendar: Boolean(profile?.calendar_connected),
      label: byService.gmail?.connected_account_label || byService.google_workspace?.connected_account_label || user.email || null,
      connectedAt: byService.gmail?.connected_at || byService.google_workspace?.connected_at || null,
    },
    whatsapp: {
      phoneVerified: Boolean(profile?.phone_verified),
      phoneLast4: profile?.phone_last4 || null,
      optedIn: Boolean(profile?.whatsapp_opt_in),
      connected: Boolean(profile?.phone_verified && profile?.whatsapp_opt_in && byService.whatsapp?.status === "connected"),
      systemReady: whatsappSystemReady,
      displayNumber: whatsappSystemReady && whatsappDisplay.length >= 8 ? whatsappDisplay : null,
      connectedAt: byService.whatsapp?.connected_at || null,
    },
    extension: {
      pairingAvailable: process.env.EXTENSION_PAIRING_REQUIRED === "1",
      paired: false,
    },
  })
}
