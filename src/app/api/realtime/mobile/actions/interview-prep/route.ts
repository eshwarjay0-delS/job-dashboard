import { randomUUID } from "node:crypto"
import { after, NextRequest, NextResponse } from "next/server"
import { createClientFromRequest } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  assertMobileSession,
  ingestClientMobileEvent,
  publishMobileEvent,
} from "@/lib/realtime/mobileServer"
import { runInterviewPrepWorkflow } from "@/lib/workflows/interview-prep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClientFromRequest(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit("mobile-prep:" + user.id, { max: 12, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Realtime prep limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const sessionId = String(body.sessionId || "").trim()
  const requestId = String(body.requestId || "").trim()
  if (!sessionId || !requestId) {
    return NextResponse.json({ error: "sessionId and requestId are required." }, { status: 400 })
  }

  try {
    await assertMobileSession({ userId: user.id, sessionId })

    const requestEvent = await ingestClientMobileEvent({
      userId: user.id,
      sessionId,
      clientEventId: requestId,
      eventType: "workflow.interview_prep.requested",
      payload: {
        company: String(body.company || "").slice(0, 180),
        role: String(body.role || "").slice(0, 180),
        interviewType: String(body.interviewType || "video").slice(0, 60),
      },
    })

    const actionId = requestEvent?.created ? randomUUID() : "duplicate:" + requestId

    if (!requestEvent?.created) {
      return NextResponse.json(
        { ok: true, accepted: true, duplicate: true, requestId },
        { status: 202 },
      )
    }

    await publishMobileEvent({
      userId: user.id,
      sessionId,
      eventType: "workflow.accepted",
      direction: "system",
      payload: {
        actionId,
        requestId,
        workflow: "interview_prep",
      },
    })

    const input = {
      company: String(body.company || "").slice(0, 180),
      role: String(body.role || "").slice(0, 180),
      interviewType: String(body.interviewType || "video").slice(0, 60),
      notes: String(body.notes || "").slice(0, 4000),
      llmLight: body.llmLight,
    }

    after(async () => {
      try {
        await publishMobileEvent({
          userId: user.id,
          sessionId,
          eventType: "workflow.running",
          direction: "system",
          payload: {
            actionId,
            requestId,
            workflow: "interview_prep",
          },
        })

        const result = await runInterviewPrepWorkflow({
          userId: user.id,
          input,
        })

        await publishMobileEvent({
          userId: user.id,
          sessionId,
          eventType: "workflow.completed",
          payload: {
            actionId,
            requestId,
            workflow: "interview_prep",
            runId: result.runId,
            cacheHit: result.cacheHit,
            provider: result.provider,
            model: result.model,
            output: result.output,
          },
        })
      } catch (error) {
        await publishMobileEvent({
          userId: user.id,
          sessionId,
          eventType: "workflow.failed",
          payload: {
            actionId,
            requestId,
            workflow: "interview_prep",
            error: error instanceof Error ? error.message : String(error),
          },
        }).catch(() => undefined)
      }
    })

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        duplicate: false,
        actionId,
        requestId,
      },
      { status: 202 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    )
  }
}
