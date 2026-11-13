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

  const [{ data: profile, error: profileError }, loaded, { data: services, error: servicesError }] = await Promise.all([
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
  const accounts = loaded.accounts

  if ((profileError || servicesError) && !isGmailQuotaError(profileError) && !isGmailQuotaError(servicesError)) {
    return NextResponse.json({ error: "Could not verify your saved connections. Please retry." }, { status: 503 })
  }

  const whatsappRow = (services || []).find((row: any) => row.service === "whatsapp")
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
