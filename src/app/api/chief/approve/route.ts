import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runTool } from "@/app/api/agent/_tools"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/chief/approve   — list the signed-in user's pending approval cards
// POST   /api/chief/approve   — push a WhatsApp approval card (Send/Edit/Skip):
//                               { to, subject, body, draftId?, accountEmail? }
// ─────────────────────────────────────────────────────────────────────────────

async function authedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { user }
}

export async function GET() {
  const { user } = await authedUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const { listPendingCards, ownerWhatsAppDigits } = await import("@/lib/chief-approvals")
  const cards = await listPendingCards(ownerWhatsAppDigits())
  return NextResponse.json({ ok: true, cards })
}

export async function POST(req: NextRequest) {
  const { user } = await authedUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await runTool({ userId: user.id }, "chief_approval", body as Record<string, unknown>)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, ...(r.data as object) })
}
