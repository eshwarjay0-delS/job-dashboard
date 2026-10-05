import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/owner"
import { phoneStepAvailable } from "@/lib/identityStatus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name,title,phone_verified,open_to_roles,profile_complete")
    .eq("id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // profile_complete is a durable milestone. Once earned, transient integration
  // health must never send an existing user through onboarding again.
  if (profile?.profile_complete === true) {
    return NextResponse.json({
      complete: true,
      missing: [],
      resumeTo: null,
      durable: true,
    })
  }

  const missing: string[] = []
  if (!profile?.full_name?.trim()) missing.push("full_name")
  if (!profile?.title?.trim()) missing.push("title")
  const admin = isAdminEmail(user.email)
  // Asked only when it matters: someone already verified never triggers the probe.
  const available = profile?.phone_verified || admin ? true : await phoneStepAvailable()
  const phoneRequired = !admin && available
  if (!profile?.phone_verified && phoneRequired) missing.push("phone_verification")
  if (!Array.isArray(profile?.open_to_roles) || profile.open_to_roles.length === 0) missing.push("target_roles")

  return NextResponse.json({
    complete: false,
    missing,
    resumeTo: "/dashboard/setup",
    durable: false,
    // false for an admin named in ADMIN_EMAILS, and for everyone while codes cannot be texted or numbers cannot be linked:
    // setup then lets the person continue and verify later. phoneNote says which.
    phoneRequired,
    phoneNote: admin ? "admin" : available ? "" : "unavailable",
  })
}
