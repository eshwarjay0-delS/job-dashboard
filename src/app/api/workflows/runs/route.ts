import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { data: runs, error } = await supabase
    .from("ai_workflow_runs")
    .select("id,workflow_key,workflow_version,status,provider,model,cache_hit,error_code,error_message,started_at,completed_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ runs: runs || [] })
}
