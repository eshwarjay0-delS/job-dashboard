import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"

export type RealtimeMobileState =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "background"
  | "offline"
  | "ended"
  | "error"

export type RealtimeMobileEvent = {
  id: number
  session_id: string
  direction: "server_to_client" | "system"
  event_type: string
  payload: Record<string, unknown>
  created_at: string
  acked_at?: string | null
}

export interface RealtimeMobileStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export type RealtimeMobileClientOptions = {
  baseUrl: string
  supabase: SupabaseClient
  getAccessToken: () => Promise<string | null>
  storage?: RealtimeMobileStorage
  onEvent?: (event: RealtimeMobileEvent) => void
  onState?: (state: RealtimeMobileState) => void
}

type PendingEvent = {
  clientEventId: string
  eventType: string
  payload: Record<string, unknown>
}

const SESSION_KEY = "marketfit_realtime_session"
const QUEUE_KEY = "marketfit_realtime_queue"
const CURSOR_KEY = "marketfit_realtime_cursor"
const MAX_QUEUE = 100

function backoffMs(attempt: number) {
  const base = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5))
  return base + Math.floor(Math.random() * 250)
}

function eventId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
  return "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2)
}

export class RealtimeMobileClient {
  private options: RealtimeMobileClientOptions
  private sessionId: string | null = null
  private channel: RealtimeChannel | null = null
  private state: RealtimeMobileState = "idle"
  private online = true
  private reconnectAttempt = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(options: RealtimeMobileClientOptions) {
    this.options = {
      ...options,
      baseUrl: options.baseUrl.replace(/\/$/, ""),
    }
  }

  getState() {
    return this.state
  }

  getSessionId() {
    return this.sessionId
  }

  async start(args: {
    clientInstanceId: string
    platform: "android" | "ios" | "web"
    appVersion?: string
    deviceSlotId?: string | null
    metadata?: Record<string, unknown>
  }) {
    this.stopped = false
    this.setState("connecting")

    const token = await this.requireToken()
    const res = await fetch(this.options.baseUrl + "/api/realtime/mobile/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(args),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.session?.id) {
      this.setState("error")
      throw new Error(data?.error || "Could not start realtime mobile session.")
    }

    this.sessionId = String(data.session.id)
    await this.storageSet(SESSION_KEY, this.sessionId)
    await this.subscribe()
    await this.sync()
    await this.flushQueue()
    this.startHeartbeat()
    return data.session
  }

  async stop() {
    this.stopped = true
    this.stopHeartbeat()

    if (this.sessionId) {
      await this.patchSession("ended").catch(() => undefined)
    }
    if (this.channel) {
      await this.options.supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.setState("ended")
    this.sessionId = null
    await this.storageRemove(SESSION_KEY)
  }

  async background() {
    if (!this.sessionId || this.state === "ended") return
    this.stopHeartbeat()
    await this.patchSession("background").catch(() => undefined)
    if (this.channel) {
      await this.options.supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.setState("background")
  }

  async foreground() {
    if (!this.sessionId || this.state === "ended") return
    if (!this.online) {
      this.setState("offline")
      return
    }

    this.setState("reconnecting")
    await this.patchSession("active")
    await this.subscribe()
    await this.sync()
    await this.flushQueue()
    this.startHeartbeat()
  }

  async setOnline(online: boolean) {
    this.online = online
    if (!online) {
      this.stopHeartbeat()
      this.setState("offline")
      return
    }
    if (this.stopped || this.state === "ended") return
    await this.reconnect()
  }

  async send(eventType: string, payload: Record<string, unknown>) {
    const pending: PendingEvent = {
      clientEventId: eventId(),
      eventType,
      payload,
    }

    if (!this.online || !this.sessionId || !["live", "reconnecting"].includes(this.state)) {
      await this.enqueue(pending)
      return { queued: true, clientEventId: pending.clientEventId }
    }

    try {
      await this.sendNow(pending)
      return { queued: false, clientEventId: pending.clientEventId }
    } catch {
      await this.enqueue(pending)
      this.setState("reconnecting")
      void this.reconnect()
      return { queued: true, clientEventId: pending.clientEventId }
    }
  }

  async sync() {
    if (!this.sessionId) return
    const token = await this.requireToken()
    const afterId = Number((await this.storageGet(CURSOR_KEY)) || "0") || 0

    const url = new URL(this.options.baseUrl + "/api/realtime/mobile/events")
    url.searchParams.set("sessionId", this.sessionId)
    url.searchParams.set("after", String(afterId))
    url.searchParams.set("limit", "200")

    const res = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + token },
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Realtime catch-up failed.")

    for (const event of (data.events || []) as RealtimeMobileEvent[]) {
      await this.deliver(event)
    }
  }

  private async subscribe() {
    if (!this.sessionId) return

    if (this.channel) {
      await this.options.supabase.removeChannel(this.channel)
      this.channel = null
    }

    const sessionId = this.sessionId
    this.channel = this.options.supabase
      .channel("marketfit-mobile:" + sessionId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "realtime_mobile_events",
          filter: "session_id=eq." + sessionId,
        },
        payload => {
          const event = payload.new as RealtimeMobileEvent
          if (event.direction === "server_to_client" || event.direction === "system") {
            void this.deliver(event)
          }
        },
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          this.reconnectAttempt = 0
          this.setState("live")
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!this.stopped && this.online && this.state !== "background") {
            this.setState("reconnecting")
            void this.reconnect()
          }
        }
      })
  }

  private async reconnect() {
    if (!this.online || this.stopped || this.state === "background" || this.state === "ended") return
    this.setState("reconnecting")

    const wait = backoffMs(this.reconnectAttempt++)
    await new Promise(resolve => setTimeout(resolve, wait))

    if (!this.online || this.stopped) return

    try {
      await this.patchSession("active")
      await this.subscribe()
      await this.sync()
      await this.flushQueue()
      this.startHeartbeat()
    } catch {
      if (this.reconnectAttempt < 8) {
        void this.reconnect()
      } else {
        this.setState("error")
      }
    }
  }

  private async sendNow(event: PendingEvent) {
    if (!this.sessionId) throw new Error("Realtime session is not active.")
    const token = await this.requireToken()

    const res = await fetch(this.options.baseUrl + "/api/realtime/mobile/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        clientEventId: event.clientEventId,
        eventType: event.eventType,
        payload: event.payload,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Realtime event send failed.")
  }

  private async patchSession(status: "active" | "background" | "offline" | "ended") {
    if (!this.sessionId) return
    const token = await this.requireToken()

    const res = await fetch(this.options.baseUrl + "/api/realtime/mobile/session", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ sessionId: this.sessionId, status }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Realtime session update failed.")
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.online && this.sessionId && this.state === "live") {
        void this.patchSession("active").catch(() => {
          this.setState("reconnecting")
          void this.reconnect()
        })
      }
    }, 25_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  private async enqueue(event: PendingEvent) {
    const queue = await this.readQueue()
    const next = [...queue, event].slice(-MAX_QUEUE)
    await this.storageSet(QUEUE_KEY, JSON.stringify(next))
  }

  private async flushQueue() {
    if (!this.online || !this.sessionId) return
    const queue = await this.readQueue()
    if (!queue.length) return

    const remaining: PendingEvent[] = []
    for (const event of queue) {
      try {
        await this.sendNow(event)
      } catch {
        remaining.push(event)
      }
    }
    await this.storageSet(QUEUE_KEY, JSON.stringify(remaining))
  }

  private async readQueue(): Promise<PendingEvent[]> {
    const raw = await this.storageGet(QUEUE_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : []
    } catch {
      return []
    }
  }

  private async deliver(event: RealtimeMobileEvent) {
    const cursor = Number((await this.storageGet(CURSOR_KEY)) || "0") || 0
    if (event.id <= cursor) return

    await this.storageSet(CURSOR_KEY, String(event.id))
    this.options.onEvent?.(event)
  }

  private setState(state: RealtimeMobileState) {
    if (this.state === state) return
    this.state = state
    this.options.onState?.(state)
  }

  private async requireToken() {
    const token = await this.options.getAccessToken()
    if (!token) throw new Error("Authentication token is unavailable.")
    return token
  }

  private async storageGet(key: string) {
    return this.options.storage ? await this.options.storage.getItem(key) : null
  }

  private async storageSet(key: string, value: string) {
    if (this.options.storage) await this.options.storage.setItem(key, value)
  }

  private async storageRemove(key: string) {
    if (this.options.storage) await this.options.storage.removeItem(key)
  }
}
