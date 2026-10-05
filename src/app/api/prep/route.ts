import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { runInterviewPrepWorkflow } from "@/lib/workflows/interview-prep"
import { WorkflowGateError } from "@/lib/workflows/runtime"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 })
  }

  const rl = checkRateLimit("prep:" + user.id, { max: 8, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many prep requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const body = await req.json().catch(() => ({}))

  try {
    const result = await runInterviewPrepWorkflow({
      userId: user.id,
      input: body,
    })

    return NextResponse.json({
      ok: true,
      ...result.output,
      workflow: {
        runId: result.runId,
        cacheHit: result.cacheHit,
        provider: result.provider,
        model: result.model,
      },
    })
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
