import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isOwnerEmail } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false, owner: false }, { status: 401 })
  const owner = isOwnerEmail(user.email)
  return NextResponse.json({ authenticated: true, owner, role: owner ? "owner" : "user" }, { status: owner ? 200 : 403 })
}
