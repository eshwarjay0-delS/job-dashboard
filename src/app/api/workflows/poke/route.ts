import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { runPokeDraftWorkflow } from "@/lib/workflows/poke"
import { WorkflowGateError } from "@/lib/workflows/runtime"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit("poke-draft:" + user.id, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Follow-up draft limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const body = await req.json().catch(() => ({}))

  try {
    const result = await runPokeDraftWorkflow({
      userId: user.id,
      input: body,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WorkflowGateError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
