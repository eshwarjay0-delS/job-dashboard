import { createServiceClient } from "@/lib/supabase/service"

export type MobilePlatform = "android" | "ios" | "web"
export type MobileSessionStatus = "active" | "background" | "offline" | "ended"
export type MobileEventDirection = "client_to_server" | "server_to_client" | "system"

const EVENT_TYPE_RE = /^[a-z0-9][a-z0-9_.-]{0,79}$/i
const MAX_PAYLOAD_BYTES = 32 * 1024

export function validateMobileEvent(eventType: string, payload: unknown) {
  if (!EVENT_TYPE_RE.test(eventType)) {
    throw new Error("Invalid realtime event type.")
  }
  const json = JSON.stringify(payload ?? {})
  if (Buffer.byteLength(json, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new Error("Realtime event payload is too large.")
  }
}

export async function createOrResumeMobileSession(args: {
  userId: string
  clientInstanceId: string
  platform: MobilePlatform
  appVersion?: string | null
  deviceSlotId?: string | null
  metadata?: Record<string, unknown>
}) {
  const db = createServiceClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: existing, error: lookupError } = await db
    .from("realtime_mobile_sessions")
    .select("id,status,expires_at")
    .eq("user_id", args.userId)
    .eq("client_instance_id", args.clientInstanceId)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)

  if (existing?.id) {
    const { data, error } = await db
      .from("realtime_mobile_sessions")
      .update({
        platform: args.platform,
        app_version: args.appVersion ?? null,
        device_slot_id: args.deviceSlotId ?? null,
        status: "active",
        last_heartbeat_at: now.toISOString(),
        expires_at: expiresAt,
        metadata: args.metadata ?? {},
        updated_at: now.toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", args.userId)
      .select("id,user_id,platform,app_version,status,transport,last_heartbeat_at,expires_at")
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await db
    .from("realtime_mobile_sessions")
    .insert({
      user_id: args.userId,
      device_slot_id: args.deviceSlotId ?? null,
      client_instance_id: args.clientInstanceId,
      platform: args.platform,
      app_version: args.appVersion ?? null,
      status: "active",
      transport: "supabase_realtime",
      last_heartbeat_at: now.toISOString(),
      expires_at: expiresAt,
      metadata: args.metadata ?? {},
      updated_at: now.toISOString(),
    })
    .select("id,user_id,platform,app_version,status,transport,last_heartbeat_at,expires_at")
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateMobileSessionState(args: {
  userId: string
  sessionId: string
  status: MobileSessionStatus
}) {
  const db = createServiceClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from("realtime_mobile_sessions")
    .update({
      status: args.status,
      last_heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", args.sessionId)
    .eq("user_id", args.userId)
    .neq("status", "ended")
    .select("id,status,last_heartbeat_at,expires_at")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Realtime session is not active.")
  return data
}

export async function assertMobileSession(args: {
  userId: string
  sessionId: string
}) {
  const db = createServiceClient()
  const { data, error } = await db
    .from("realtime_mobile_sessions")
    .select("id,user_id,status,expires_at")
    .eq("id", args.sessionId)
    .eq("user_id", args.userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Realtime session was not found.")
  if (data.status === "ended") throw new Error("Realtime session has ended.")
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("Realtime session expired.")
  }
  return data
}

export async function ingestClientMobileEvent(args: {
  userId: string
  sessionId: string
  clientEventId: string
  eventType: string
  payload: Record<string, unknown>
}) {
  validateMobileEvent(args.eventType, args.payload)
  await assertMobileSession({ userId: args.userId, sessionId: args.sessionId })

  const db = createServiceClient()
  const { data, error } = await db
    .from("realtime_mobile_events")
    .upsert(
      {
        session_id: args.sessionId,
        user_id: args.userId,
        client_event_id: args.clientEventId,
        direction: "client_to_server",
        event_type: args.eventType,
        payload: args.payload,
      },
      {
        onConflict: "session_id,client_event_id",
        ignoreDuplicates: true,
      },
    )
    .select("id,session_id,client_event_id,event_type,created_at")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) return data

  const { data: existing, error: existingError } = await db
    .from("realtime_mobile_events")
    .select("id,session_id,client_event_id,event_type,created_at")
    .eq("session_id", args.sessionId)
    .eq("client_event_id", args.clientEventId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  return existing
}

export async function publishMobileEvent(args: {
  userId: string
  sessionId: string
  eventType: string
  payload: Record<string, unknown>
  direction?: Exclude<MobileEventDirection, "client_to_server">
}) {
  validateMobileEvent(args.eventType, args.payload)
  await assertMobileSession({ userId: args.userId, sessionId: args.sessionId })

  const db = createServiceClient()
  const { data, error } = await db
    .from("realtime_mobile_events")
    .insert({
      session_id: args.sessionId,
      user_id: args.userId,
      client_event_id: null,
      direction: args.direction ?? "server_to_client",
      event_type: args.eventType,
      payload: args.payload,
    })
    .select("id,session_id,direction,event_type,payload,created_at")
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function listMobileEvents(args: {
  userId: string
  sessionId: string
  afterId?: number
  limit?: number
}) {
  await assertMobileSession({ userId: args.userId, sessionId: args.sessionId })
  const db = createServiceClient()
  const limit = Math.max(1, Math.min(args.limit ?? 100, 200))

  let query = db
    .from("realtime_mobile_events")
    .select("id,session_id,direction,event_type,payload,created_at,acked_at")
    .eq("user_id", args.userId)
    .eq("session_id", args.sessionId)
    .in("direction", ["server_to_client", "system"])
    .order("id", { ascending: true })
    .limit(limit)

  if (args.afterId && args.afterId > 0) {
    query = query.gt("id", args.afterId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
