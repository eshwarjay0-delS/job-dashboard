import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"
import { sendGmailMessage } from "@/lib/gmailSend"
import { requireActiveSubscription } from "@/lib/workflows/runtime"

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ReviewPayload = {
  accountId?: string | null
  to?: string
  subject?: string
  body?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const reviewId = String(body.reviewId || "")
  const expectedFingerprint = String(body.expectedFingerprint || "")
  const action = String(body.action || "approve")

  if (!reviewId) return NextResponse.json({ error: "reviewId is required." }, { status: 400 })

  const db = createServiceClient()

  if (action === "reject") {
    const { data, error } = await db
      .from("ai_workflow_approvals")
      .update({
        status: "rejected",
        failure_reason: "Rejected by user.",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("run_id")
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Review is no longer pending." }, { status: 409 })

    await db
      .from("ai_workflow_runs")
      .update({
        status: "cancelled",
        error_code: "user_rejected",
        error_message: "User rejected the generated action.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.run_id)
      .eq("user_id", user.id)

    return NextResponse.json({ ok: true, status: "rejected" })
  }

  if (action !== "approve") return NextResponse.json({ error: "Unknown review action." }, { status: 400 })
  if (!expectedFingerprint) return NextResponse.json({ error: "expectedFingerprint is required." }, { status: 400 })

  const rl = checkRateLimit("poke-send:" + user.id, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Follow-up send limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const { data: claimed, error: claimError } = await db
    .from("ai_workflow_approvals")
    .update({
      status: "sending",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq("payload_fingerprint", expectedFingerprint)
    .select("id,run_id,payload,payload_fingerprint")
    .maybeSingle()

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimed) {
    return NextResponse.json(
      { error: "This review changed, expired, or was already handled. Nothing was sent." },
      { status: 409 },
    )
  }

  const payload = (claimed.payload || {}) as ReviewPayload
  const to = String(payload.to || "").trim()
  const subject = String(payload.subject || "").trim().slice(0, 180)
  const message = String(payload.body || "").trim().slice(0, 20000)
  const accountId = payload.accountId ? String(payload.accountId) : null

  try {
    await requireActiveSubscription(user.id)
    if (!EMAIL_RE.test(to) || !subject || !message) throw new Error("Stored review payload is invalid.")

    const sent = await sendGmailMessage({
      userId: user.id,
      accountId,
      to,
      subject,
      body: message,
      workflowRunId: String(claimed.run_id),
    })

    await db
      .from("ai_workflow_approvals")
      .update({
        status: "approved",
        result: sent,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .eq("status", "sending")

    await db
      .from("ai_workflow_runs")
      .update({
        status: "succeeded",
        output: { sent, reviewId, to, subject },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.run_id)
      .eq("user_id", user.id)

    await db.from("usage_events").insert({
      user_id: user.id,
      source_channel: "gmail",
      feature_key: "poke_followup_send",
      source_event_key: "poke:" + String(claimed.run_id),
      units: 1,
      metadata: {
        workflow_run_id: claimed.run_id,
        gmail_account_id: accountId,
      },
    })

    return NextResponse.json({ ok: true, status: "sent", ...sent })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error)

    await db
      .from("ai_workflow_approvals")
      .update({
        status: "failed",
        failure_reason: messageText,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .eq("status", "sending")

    await db
      .from("ai_workflow_runs")
      .update({
        status: "failed",
        error_code: "send_failed_or_ambiguous",
        error_message: messageText,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.run_id)
      .eq("user_id", user.id)

    return NextResponse.json(
      {
        ok: false,
        error: messageText,
        retrySafe: false,
        note: "The review is locked after a send failure so MarketFit cannot accidentally send twice.",
      },
      { status: 502 },
    )
  }
}
