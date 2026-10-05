import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name,title,work_auth,phone_verified,open_to_roles,profile_complete")
    .eq("id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const missing: string[] = []
  if (!profile?.full_name?.trim()) missing.push("full_name")
  if (!profile?.title?.trim()) missing.push("title")
  if (!profile?.work_auth?.trim()) missing.push("work_auth")
  if (!profile?.phone_verified) missing.push("phone_verification")
  if (!Array.isArray(profile?.open_to_roles) || profile.open_to_roles.length === 0) missing.push("target_roles")

  const complete = missing.length === 0 && profile?.profile_complete === true
  return NextResponse.json({
    complete,
    missing,
    resumeTo: complete ? null : "/dashboard/setup",
  })
}
