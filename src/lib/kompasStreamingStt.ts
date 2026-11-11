/**
 * Streaming, revisable STT scaffolding for Kompas (2026-11-10, phase 2).
 *
 * The live speech path today is MediaRecorder slices posted to Groq Whisper
 * (GROQ_API_KEY / GROQ_TRANSCRIBE_MODEL). An optional batch HTTP provider
 * (KOMPAS_STT_PROVIDER=parakeet + KOMPAS_PARAKEET_URL) is also file-based.
 * Neither is a streaming, revisable protocol.
 *
 * This module is the client/server policy for a future live stream: interim
 * and final events, keepalive, reconnect with backoff, and a hard fallback
 * to the existing Whisper slices when the stream is off or dies. It stays
 * behind KOMPAS_STREAMING_STT (off by default) and only reports "ready"
 * when a streaming key is present. It never logs or returns key values.
 */

export const STREAMING_STT_FLAG = "KOMPAS_STREAMING_STT"
/** The env name that would enable Deepgram live streaming. Never log its value. */
export const STREAMING_STT_KEY = "DEEPGRAM_API_KEY"
export const STREAMING_STT_PROVIDER = "deepgram"

export const KEEPALIVE_MS = 5_000
export const BACKOFF_MS = [500, 1_000, 2_000, 4_000, 8_000] as const
export const MAX_RECONNECTS = 5

export type StreamingStatus = "idle" | "connecting" | "live" | "reconnecting" | "fallback"
export type StreamingReason = "flag-off" | "no-key" | "ready"

export type EnvMap = Record<string, string | undefined>

function flagOn(env: EnvMap): boolean {
  const raw = String(env[STREAMING_STT_FLAG] || "").trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "on"
}

function keyPresent(env: EnvMap, name: string): boolean {
  const v = env[name]
  return typeof v === "string" && v.trim().length > 0
}

/** Whether streaming may be offered. Reports only names and booleans, never secret values. */
export function streamingSttAvailability(env: EnvMap = process.env): {
  enabled: boolean
  reason: StreamingReason
  provider: typeof STREAMING_STT_PROVIDER | null
  flag: string
  keyName: string
  fallback: "whisper"
} {
  if (!flagOn(env)) {
    return { enabled: false, reason: "flag-off", provider: null, flag: STREAMING_STT_FLAG, keyName: STREAMING_STT_KEY, fallback: "whisper" }
  }
  if (!keyPresent(env, STREAMING_STT_KEY)) {
    return { enabled: false, reason: "no-key", provider: null, flag: STREAMING_STT_FLAG, keyName: STREAMING_STT_KEY, fallback: "whisper" }
  }
  return { enabled: true, reason: "ready", provider: STREAMING_STT_PROVIDER, flag: STREAMING_STT_FLAG, keyName: STREAMING_STT_KEY, fallback: "whisper" }
}

export function nextBackoff(attempt: number): number {
  const i = Math.max(0, Math.min(BACKOFF_MS.length - 1, attempt))
  return BACKOFF_MS[i]
}

export function shouldFallback(attempt: number, fatal = false): boolean {
  return fatal || attempt >= MAX_RECONNECTS
}

export type StreamEvent =
  | { type: "open" }
  | { type: "interim"; text: string; who: string }
  | { type: "final"; text: string; who: string }
  | { type: "keepalive" }
  | { type: "reconnecting"; attempt: number; delayMs: number }
  | { type: "fallback"; reason: string }
  | { type: "close"; reason: string }

/** Parse a Deepgram-like live message into an interim or final event. Unknown payloads are ignored. */
export function eventFromProviderMessage(raw: unknown, who: string): StreamEvent | null {
  let data: unknown = raw
  if (typeof raw === "string") {
    try { data = JSON.parse(raw) } catch { return null }
  }
  if (!data || typeof data !== "object") return null
  const rec = data as Record<string, unknown>
  if (rec.type === "KeepAlive" || rec.type === "keepalive") return { type: "keepalive" }
  const alt = (rec.channel as { alternatives?: Array<{ transcript?: unknown }> } | undefined)?.alternatives?.[0]
    || (rec.alternatives as Array<{ transcript?: unknown }> | undefined)?.[0]
  const text = typeof alt?.transcript === "string" ? alt.transcript.trim()
    : (typeof rec.transcript === "string" ? rec.transcript.trim() : "")
  if (!text) return null
  const isFinal = rec.is_final === true || rec.type === "final" || rec.speech_final === true
  return isFinal ? { type: "final", text, who } : { type: "interim", text, who }
}

export type StreamingController = {
  status: StreamingStatus
  attempt: number
  lastKeepaliveAt: number
  who: string
}

export function createStreamingSession(who: string, now = 0): StreamingController {
  return { status: "idle", attempt: 0, lastKeepaliveAt: now, who }
}

export function onSocketOpen(session: StreamingController, now = Date.now()): StreamEvent {
  session.status = "live"
  session.attempt = 0
  session.lastKeepaliveAt = now
  return { type: "open" }
}

export function onSocketNeededKeepalive(session: StreamingController, now: number): StreamEvent | null {
  if (session.status !== "live") return null
  if (now - session.lastKeepaliveAt < KEEPALIVE_MS) return null
  session.lastKeepaliveAt = now
  return { type: "keepalive" }
}

export function onSocketLost(session: StreamingController, reason: string, fatal = false): StreamEvent {
  if (shouldFallback(session.attempt, fatal) || session.status === "fallback") {
    session.status = "fallback"
    return { type: "fallback", reason: reason || "stream lost" }
  }
  const delayMs = nextBackoff(session.attempt)
  session.attempt += 1
  session.status = "reconnecting"
  return { type: "reconnecting", attempt: session.attempt, delayMs }
}
