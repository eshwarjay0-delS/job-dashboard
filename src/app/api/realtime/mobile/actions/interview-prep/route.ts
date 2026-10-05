import { after, NextRequest, NextResponse } from "next/server"
import { createClientFromRequest } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  assertMobileSession,
  ingestClientMobileEvent,
  publishMobileEvent,
} from "@/lib/realtime/mobileServer"
import { runInterviewPrepWorkflow, type InterviewPrepInput } from "@/lib/workflows/interview-prep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type MobileAction = {
  id: string
  status: "accepted" | "running" | "succeeded" | "failed" | "cancelled"
  input: InterviewPrepInput
  workflow_run_id?: string | null
  result?: Record<string, unknown>
  error_message?: string | null
}

async function runAcceptedAction(args: {
  actionId: string
  userId: string
  sessionId: string
  requestId: string
}) {
  const db = createServiceClient()
  const startedAt = new Date().toISOString()

  // Durable claim: duplicate HTTP retries may all schedule this callback, but only
  // one worker can transition accepted -> running.
  const { data: claimed, error: claimError } = await db
    .from("realtime_mobile_actions")
    .update({
      status: "running",
      started_at: startedAt,
      updated_at: startedAt,
    })
    .eq("id", args.actionId)
    .eq("user_id", args.userId)
    .eq("status", "accepted")
    .select("id,input")
    .maybeSingle()

  if (claimError) throw new Error(claimError.message)
  if (!claimed) return

  await publishMobileEvent({
    userId: args.userId,
    sessionId: args.sessionId,
    eventType: "workflow.running",
    direction: "system",
    payload: {
      actionId: args.actionId,
      requestId: args.requestId,
      workflow: "interview_prep",
    },
  })

  try {
    const result = await runInterviewPrepWorkflow({
      userId: args.userId,
      input: (claimed.input || {}) as InterviewPrepInput,
    })

    const completedAt = new Date().toISOString()
    const persistedResult = {
      runId: result.runId,
      cacheHit: result.cacheHit,
      provider: result.provider,
      model: result.model,
      output: result.output,
    }

    const { error: updateError } = await db
      .from("realtime_mobile_actions")
      .update({
        status: "succeeded",
        workflow_run_id: result.runId,
        result: persistedResult,
        error_message: null,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", args.actionId)
      .eq("user_id", args.userId)
      .eq("status", "running")

    if (updateError) throw new Error(updateError.message)

    await publishMobileEvent({
      userId: args.userId,
      sessionId: args.sessionId,
      eventType: "workflow.completed",
      payload: {
        actionId: args.actionId,
        requestId: args.requestId,
        workflow: "interview_prep",
        ...persistedResult,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const completedAt = new Date().toISOString()

    await db
      .from("realtime_mobile_actions")
      .update({
        status: "failed",
        error_message: message,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", args.actionId)
      .eq("user_id", args.userId)
      .eq("status", "running")

    await publishMobileEvent({
      userId: args.userId,
      sessionId: args.sessionId,
      eventType: "workflow.failed",
      payload: {
        actionId: args.actionId,
        requestId: args.requestId,
        workflow: "interview_prep",
        error: message,
      },
    }).catch(() => undefined)
  }
}

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
  if (!sessionId || !requestId || requestId.length > 180) {
    return NextResponse.json(
      { error: "A valid sessionId and requestId are required." },
      { status: 400 },
    )
  }

  const input: InterviewPrepInput = {
    company: String(body.company || "").slice(0, 180),
    role: String(body.role || "").slice(0, 180),
    interviewType: String(body.interviewType || "video").slice(0, 60),
    notes: String(body.notes || "").slice(0, 4000),
    llmLight: body.llmLight,
  }

  try {
    await assertMobileSession({ userId: user.id, sessionId })
    const db = createServiceClient()

    const { data: inserted, error: insertError } = await db
      .from("realtime_mobile_actions")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        request_id: requestId,
        action_type: "interview_prep",
        status: "accepted",
        input,
        updated_at: new Date().toISOString(),
      })
      .select("id,status,input,workflow_run_id,result,error_message")
      .maybeSingle()

    let action = inserted as MobileAction | null
    let duplicate = false

    if (insertError) {
      if (insertError.code !== "23505") throw new Error(insertError.message)
      duplicate = true

      const { data: existing, error: existingError } = await db
        .from("realtime_mobile_actions")
        .select("id,status,input,workflow_run_id,result,error_message")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .eq("request_id", requestId)
        .maybeSingle()

      if (existingError) throw new Error(existingError.message)
      action = existing as MobileAction | null
    }

    if (!action) throw new Error("Could not persist realtime action.")

    if (!duplicate) {
      await ingestClientMobileEvent({
        userId: user.id,
        sessionId,
        clientEventId: requestId,
        eventType: "workflow.interview_prep.requested",
        payload: {
          actionId: action.id,
          company: input.company || "",
          role: input.role || "",
          interviewType: input.interviewType || "video",
        },
      })

      await publishMobileEvent({
        userId: user.id,
        sessionId,
        eventType: "workflow.accepted",
        direction: "system",
        payload: {
          actionId: action.id,
          requestId,
          workflow: "interview_prep",
        },
      })
    }

    // If a previous server instance accepted the request but died before claiming
    // it, a client retry schedules recovery. The atomic status transition inside
    // runAcceptedAction makes this race-safe.
    if (action.status === "accepted") {
      after(() => runAcceptedAction({
        actionId: action!.id,
        userId: user.id,
        sessionId,
        requestId,
      }))
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        duplicate,
        actionId: action.id,
        requestId,
        status: action.status,
        workflowRunId: action.workflow_run_id || null,
        result: action.status === "succeeded" ? action.result || {} : undefined,
        error: action.status === "failed" ? action.error_message || "Action failed." : undefined,
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
