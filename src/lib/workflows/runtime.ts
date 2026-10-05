import { createServiceClient } from "@/lib/supabase/service"

export type WorkflowSourceChannel =
  | "web"
  | "mobile"
  | "extension"
  | "whatsapp"
  | "gmail"
  | "calendar"
  | "system"

export type WorkflowStepType =
  | "deterministic"
  | "llm"
  | "tool"
  | "cache"
  | "approval"

export type WorkflowRun = {
  id: string
  userId: string
  workflowKey: string
  inputFingerprint: string
}

export class WorkflowGateError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 409) {
    super(message)
    this.name = "WorkflowGateError"
    this.code = code
    this.status = status
  }
}

export async function requireActiveSubscription(userId: string) {
  const db = createServiceClient()
  const { data, error } = await db
    .from("subscription_accounts")
    .select("plan_key,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new WorkflowGateError("subscription_lookup_failed", error.message, 500)
  if (!data || !["active", "trialing"].includes(String(data.status))) {
    throw new WorkflowGateError(
      "subscription_inactive",
      "An active MarketFit subscription is required before this AI workflow can run.",
      402,
    )
  }
  return data
}

export async function startWorkflowRun(args: {
  userId: string
  workflowKey: string
  input: Record<string, unknown>
  inputFingerprint: string
  sourceChannel?: WorkflowSourceChannel
}) {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_workflow_runs")
    .insert({
      user_id: args.userId,
      workflow_key: args.workflowKey,
      workflow_version: 1,
      input_fingerprint: args.inputFingerprint,
      source_channel: args.sourceChannel ?? "web",
      execution_mode: "synchronous",
      status: "running",
      input: args.input,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error || !data?.id) throw new Error(error?.message || "Could not start workflow run.")
  return {
    id: String(data.id),
    userId: args.userId,
    workflowKey: args.workflowKey,
    inputFingerprint: args.inputFingerprint,
  } satisfies WorkflowRun
}

export async function markWorkflowAwaitingApproval(
  run: WorkflowRun,
  output: Record<string, unknown>,
  meta?: { provider?: string; model?: string; cacheHit?: boolean },
) {
  const db = createServiceClient()
  const { error } = await db
    .from("ai_workflow_runs")
    .update({
      status: "awaiting_approval",
      output,
      provider: meta?.provider ?? null,
      model: meta?.model ?? null,
      cache_hit: meta?.cacheHit ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.userId)
  if (error) throw new Error(error.message)
}

export async function failWorkflowRun(run: WorkflowRun, code: string, message: string) {
  const db = createServiceClient()
  await db
    .from("ai_workflow_runs")
    .update({
      status: "failed",
      error_code: code,
      error_message: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.userId)
}

export async function cancelWorkflowRun(runId: string, userId: string, reason: string) {
  const db = createServiceClient()
  const { error } = await db
    .from("ai_workflow_runs")
    .update({
      status: "cancelled",
      error_code: "user_rejected",
      error_message: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function recordWorkflowStep(args: {
  run: WorkflowRun
  key: string
  index: number
  type: WorkflowStepType
  status: "succeeded" | "failed" | "skipped"
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
  latencyMs?: number
}) {
  const db = createServiceClient()
  const { error } = await db.from("ai_workflow_steps").insert({
    run_id: args.run.id,
    user_id: args.run.userId,
    step_key: args.key,
    step_index: args.index,
    step_type: args.type,
    status: args.status,
    input: args.input ?? {},
    output: args.output ?? {},
    error_code: args.errorCode ?? null,
    error_message: args.errorMessage ?? null,
    latency_ms: args.latencyMs ?? null,
    completed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function getWorkflowCache<T>(args: {
  userId: string
  workflowKey: string
  cacheKey: string
  sourceFingerprint: string
}): Promise<T | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_workflow_cache")
    .select("id,payload,expires_at,hit_count")
    .eq("user_id", args.userId)
    .eq("workflow_key", args.workflowKey)
    .eq("namespace", "draft")
    .eq("cache_key", args.cacheKey)
    .eq("source_fingerprint", args.sourceFingerprint)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null

  await db
    .from("ai_workflow_cache")
    .update({
      hit_count: Number(data.hit_count || 0) + 1,
      last_hit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)

  return data.payload as T
}

export async function putWorkflowCache(args: {
  userId: string
  workflowKey: string
  cacheKey: string
  sourceFingerprint: string
  payload: Record<string, unknown>
}) {
  const db = createServiceClient()
  const { error } = await db
    .from("ai_workflow_cache")
    .upsert(
      {
        user_id: args.userId,
        workflow_key: args.workflowKey,
        namespace: "draft",
        cache_key: args.cacheKey,
        source_fingerprint: args.sourceFingerprint,
        payload: args.payload,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,workflow_key,namespace,cache_key,source_fingerprint" },
    )
  if (error) throw new Error(error.message)
}

export async function createWorkflowApproval(args: {
  run: WorkflowRun
  actionKey: string
  payload: Record<string, unknown>
  payloadFingerprint: string
}) {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_workflow_approvals")
    .insert({
      run_id: args.run.id,
      user_id: args.run.userId,
      action_key: args.actionKey,
      status: "pending",
      payload: args.payload,
      payload_fingerprint: args.payloadFingerprint,
      updated_at: new Date().toISOString(),
    })
    .select("id,payload_fingerprint")
    .single()

  if (error || !data?.id) throw new Error(error?.message || "Could not create workflow approval.")
  return {
    id: String(data.id),
    payloadFingerprint: String(data.payload_fingerprint),
  }
}
