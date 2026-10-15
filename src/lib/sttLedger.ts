/**
 * Every speech-to-text call, metered for the business model: who asked, how
 * much audio, which session it belonged to, and what it cost.
 *
 * Why (2026-10-11): the owner asked for the full Compass business model —
 * "every token has some usage… this session produced this much dollars…
 * how many sessions left". The LLM ledger records tokens, but Whisper bills
 * per audio minute, and neither ledger knew which session a call belonged to
 * or which user made it. This ledger closes that gap.
 *
 * THE LISTING IS THE LEDGER, same trick as the LLM ledger: one call is one
 * tiny object whose NAME carries the whole record:
 *
 *   usage/stt/<UTC day>/<time>-<random>__<app>__<purpose>__<provider>__<model>__<ok|fail-429>__s<seconds>__<session>__<user>__t<ms>.json
 *
 * What a record holds: counts, labels, and a session id the client chose.
 * What it does NOT hold: no audio, no transcript, no raw user id — the user
 * field is a one-way hash (HMAC with the ingest secret), enough to group a
 * user's spend without naming them in storage.
 *
 * Recording never slows or fails a transcription: scheduled for after the
 * response, every error swallowed.
 */
import { randomBytes, createHmac } from "node:crypto"

const storage = () => import("./storage").then(m => m.blob)

export type SttCall = {
  at: number
  app: "marketfit" | "kompas"
  purpose: string
  provider: string
  model: string
  ok: boolean
  status?: number
  /** Seconds of audio sent, rounded. This is the billable unit. */
  seconds: number
  /** The live session this chunk belonged to, when the client tagged one. */
  session?: string
  /** HMAC(userId) — groups spend per user without storing identity. */
  userHash?: string
  ms: number
}

const PREFIX = "usage/stt"
const day = (at: number) => new Date(at).toISOString().slice(0, 10)
const slug = (v: unknown, max = 64) => String(v ?? "").replace(/\//g, "~").replace(/:/g, ";").replace(/[^A-Za-z0-9._~;-]/g, "-").replace(/_+/g, "-").slice(0, max) || "unknown"
const unslug = (v: string) => v.replace(/~/g, "/").replace(/;/g, ":")
const count = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000_000) : 0 }

/** One-way hash of a user id for per-user metering without identity in storage. */
export function hashUserId(userId: string): string {
  const secret = (process.env.USAGE_INGEST_SECRET || process.env.GROQ_API_KEY || "kompas-usage").trim()
  return createHmac("sha256", secret).update(`stt-user-v1:${userId}`).digest("hex").slice(0, 16)
}

export function sttKey(c: SttCall, random = randomBytes(3).toString("hex")): string {
  const outcome = c.ok ? "ok" : `fail-${count(c.status) || 0}`
  return `${PREFIX}/${day(c.at)}/${String(Math.max(0, Math.round(Number(c.at)) || 0)).padStart(14, "0")}-${slug(random, 12)}__${slug(c.app, 16)}__${slug(c.purpose, 32)}__${slug(c.provider, 24)}__${slug(c.model)}__${outcome}__s${count(c.seconds)}__${slug(c.session || "", 40) || "nosession"}__${slug(c.userHash || "", 20) || "nouser"}__t${count(c.ms)}.json`
}

export function sttFromKey(key: string): SttCall | null {
  const name = key.slice(key.lastIndexOf("/") + 1).replace(/\.json$/, "")
  const parts = name.split("__")
  if (parts.length !== 10) return null
  const [stamp, app, purpose, provider, model, outcome, s, session, user, t] = parts
  const at = Number(stamp.split("-")[0])
  if (!Number.isFinite(at) || at <= 0 || (app !== "marketfit" && app !== "kompas")) return null
  const seconds = s.startsWith("s") ? count(s.slice(1)) : -1
  const ms = t.startsWith("t") ? count(t.slice(1)) : -1
  if (seconds < 0 || ms < 0) return null
  const ok = outcome === "ok"
  const status = ok ? undefined : count(outcome.replace(/^fail-/, "")) || undefined
  return {
    at, app, purpose: unslug(purpose), provider: unslug(provider), model: unslug(model), ok,
    ...(status ? { status } : {}), seconds,
    session: session === "nosession" ? undefined : unslug(session),
    userHash: user === "nouser" ? undefined : user,
    ms,
  }
}

/** Write one call down. Resolves to whether it was kept; never rejects. */
export async function recordSttCall(call: SttCall, id?: string): Promise<boolean> {
  try {
    await (await storage()).put(id ? sttKey(call, id) : sttKey(call), "{}")
    return true
  } catch (e) {
    console.error("[stt-ledger] a call could not be recorded:", String((e as Error)?.message || e).slice(0, 160))
    return false
  }
}

export function scheduleSttRecord(call: SttCall): void {
  if (process.env.LLM_LEDGER === "0" || process.env.LLM_LEDGER === "false") return
  void import("next/server").then(({ after }) => after(() => recordSttCall(call))).catch(() => recordSttCall(call))
}

/** Every STT call from `fromDay` to `toDay` (UTC days, both included), oldest first. */
export async function readSttCalls(fromDay: string, toDay: string): Promise<{ calls: SttCall[]; unreadableDays: number }> {
  const calls: SttCall[] = []
  let unreadableDays = 0
  const days: string[] = []
  for (let t = Date.parse(`${fromDay}T00:00:00Z`); t <= Date.parse(`${toDay}T00:00:00Z`) && days.length < 400; t += 86_400_000) days.push(day(t))
  await Promise.all(days.map(async d => {
    try {
      for (const key of await (await storage()).list(`${PREFIX}/${d}`)) { const c = sttFromKey(key); if (c) calls.push(c) }
    } catch { unreadableDays++ }
  }))
  return { calls: calls.sort((a, b) => a.at - b.at), unreadableDays }
}
