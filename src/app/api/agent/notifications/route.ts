import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/agent/notifications — list the signed-in user's notifications
// POST /api/agent/notifications — { ids: string[] } | { all: true } → mark read
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const { data, error } = await supabase
    .from("mfit_notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread = (data || []).filter((n: { read: boolean }) => !n.read).length
  return NextResponse.json({ ok: true, unread, notifications: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  let q = supabase.from("mfit_notifications").update({ read: true }).eq("user_id", user.id)
  if (body.all) {
    // mark all read
  } else if (Array.isArray(body.ids) && body.ids.length) {
    q = q.in("id", body.ids.map(String))
  } else {
    return NextResponse.json({ error: "Provide ids[] or { all: true }." }, { status: 400 })
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
