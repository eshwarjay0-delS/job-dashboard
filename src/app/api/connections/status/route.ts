import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { waConfigured, waDisplayNumber, waStatus } from "@/lib/whatsapp"
import { isGmailQuotaError, loadWorkspaceAccounts } from "@/lib/gmailSnapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  // The accounts load is the one the page cannot render without; the
  // profile/services reads only fill WhatsApp details, so a failure there
  // must degrade to defaults instead of taking the whole page down. (A
  // single flaky query used to 503 the accounts list too, and the cause
  // was swallowed with no server log — see the PGRST301 skip-login token
  // failure, Nov 2026.)
  const [profileRes, loadedRes, servicesRes] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select("phone_verified,phone_last4,whatsapp_opt_in")
      .eq("id", user.id)
      .maybeSingle(),
    loadWorkspaceAccounts(user.id),
    supabase
      .from("connected_services")
      .select("service,status,connected_account_label,connected_at")
      .eq("user_id", user.id),
  ])
  if (loadedRes.status === "rejected") {
    console.error("connections status: workspace accounts load failed", loadedRes.reason)
    return NextResponse.json({ error: "Could not load your saved Google accounts. Please retry." }, { status: 503 })
  }
  const loaded = loadedRes.value
  const accounts = loaded.accounts

  let profile: { phone_verified?: boolean | null; phone_last4?: string | null; whatsapp_opt_in?: boolean | null } | null = null
  if (profileRes.status === "fulfilled") {
    profile = profileRes.value.data
    if (profileRes.value.error && !isGmailQuotaError(profileRes.value.error)) {
      console.error("connections status: profiles read failed", profileRes.value.error)
    }
  } else {
    console.error("connections status: profiles read threw", profileRes.reason)
  }
  let services: { service: string; status: string; connected_account_label: string | null; connected_at: string }[] = []
  if (servicesRes.status === "fulfilled") {
    services = servicesRes.value.data || []
    if (servicesRes.value.error && !isGmailQuotaError(servicesRes.value.error)) {
      console.error("connections status: connected_services read failed", servicesRes.value.error)
    }
  } else {
    console.error("connections status: connected_services read threw", servicesRes.reason)
  }

  const whatsappRow = services.find((row) => row.service === "whatsapp")
  const phoneVerified = Boolean(profile?.phone_verified)
  const optedIn = Boolean(profile?.whatsapp_opt_in)
  const provider = await waStatus()
  const systemConfigured = waConfigured()
  const systemReady = provider.state === "ok" && provider.hasNumber
  // The number to message is only handed to someone whose own number is verified and linked: the bot answers nobody else.
  const number = phoneVerified && optedIn && systemReady ? await waDisplayNumber() : ""

  return NextResponse.json({
    google: {
      accounts: accounts || [],
      maxAccounts: 4,
      canAdd: loaded.source === "supabase" && (accounts || []).length < 4,
    },
    ...(loaded.notice ? { snapshotNotice: loaded.notice } : {}),
    whatsapp: {
      phoneVerified,
      phoneLast4: profile?.phone_last4 || null,
      optedIn,
      systemReady,
      systemConfigured,
      providerState: provider.state,
      webhookState: "unverified",
      connected: Boolean(phoneVerified && optedIn && systemReady && whatsappRow?.status === "connected"),
      label: whatsappRow?.connected_account_label || (profile?.phone_last4 ? `••••${profile.phone_last4}` : null),
      number: number || null,
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
