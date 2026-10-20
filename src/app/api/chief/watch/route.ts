import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runTool } from "@/app/api/agent/_tools"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/chief/watch      — list the signed-in user's Chief watch tasks
// POST   /api/chief/watch      — create a watch: { goal, subject?, sub_checks?, check_every_minutes?, deadline? }
// DELETE /api/chief/watch     — cancel a watch: { id }
// ─────────────────────────────────────────────────────────────────────────────

async function authedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { user } = await authedUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const r = await runTool({ userId: user.id }, "chief_watch", { action: "list" })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true, ...(r.data as object) })
}

export async function POST(req: NextRequest) {
  const { user } = await authedUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await runTool({ userId: user.id }, "chief_watch", { action: "create", ...body })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, ...(r.data as object) })
}

export async function DELETE(req: NextRequest) {
  const { user } = await authedUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await runTool({ userId: user.id }, "chief_watch", { action: "cancel", id: body.id })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, ...(r.data as object) })
}
