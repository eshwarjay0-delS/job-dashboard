import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { waConfigured, waDisplayNumber, waStatus } from "@/lib/whatsapp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const service = createServiceClient()
  const [{ data: profile, error: profileError }, { data: accounts, error: accountsError }, { data: services, error: servicesError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("phone_verified,phone_last4,whatsapp_opt_in")
      .eq("id", user.id)
      .maybeSingle(),
    service.rpc("identity_list_google_workspace_accounts", { p_user_id: user.id }),
    supabase
      .from("connected_services")
      .select("service,status,connected_account_label,connected_at")
      .eq("user_id", user.id),
  ])

  if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 })

  if (profileError || servicesError) return NextResponse.json({ error: "Could not verify your saved connections. Please retry." }, { status: 503 })

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
      canAdd: (accounts || []).length < 4,
    },
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
