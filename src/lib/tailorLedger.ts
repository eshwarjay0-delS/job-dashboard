/**
 * Every resume generation, written down: when, by which channel, how it ended, which models wrote it and what it cost.
 *
 * Why (2026-10-07): the owner asked the admin page for "how much usage is left. How many were interacted. clear picture of
 * resume gen costs. How many generated this week and today". None of it could be answered. The WhatsApp bot wrote a row to a
 * Supabase table through the service key, and the service key on the deployment is not the service-role key (see
 * /api/health/services), so every one of those writes failed quietly; the web tailor wrote nothing at all; and a tailor that
 * FAILED left no trace anywhere, which is the kind an owner most needs to count.
 *
 * So the record lives in the app's own storage (`blob`: R2 in production, the data folder locally), one small JSON object per
 * generation under `usage/tailor/<UTC day>/`. No table to migrate, no key to get right, and a day's records are one listing.
 *
 * What a record does NOT hold: no job description, no resume text, no name, no phone number, no account id. A person is a
 * twelve-character hash, which is enough to count how many different people used the tailor and not enough to say who.
 *
 * Recording never throws and never decides anything: a tailor that worked is delivered whether or not it could be counted.
 */
import { createHash, randomBytes } from "node:crypto"
import type { PricedCall } from "@/lib/llmPrices"
import type { TailorResult } from "@/lib/tailor"

// Loaded when a record is written or read, not when this file is: the summaries below are plain arithmetic (the tests load them bare).
const storage = () => import("./storage").then(m => m.blob)

export type TailorChannel = "whatsapp" | "web" | "auto-reply"
export type TailorOutcome = "whole" | "partial" | "unchanged" | "cached" | "failed"

export type TailorEvent = {
  v: 1
  at: string
  channel: TailorChannel
  kind: "tailor" | "refine"
  /** A hash of the sender or account. Counts people; identifies nobody. */
  person: string
  outcome: TailorOutcome
  ms: number
  /** The models that wrote it, as the tailor's own note names them. Empty for a failure. */
  via: string
  calls: number
  input: number
  output: number
  costUsd: number
  /** Calls to a model with no known price: when not 0, costUsd is a floor. */
  unpricedCalls: number
  byModel: PricedCall[]
  coverageBefore?: number
  coverageAfter?: number
  /** For a failure, which kind. Never the provider's own message. */
  failure?: "timed out" | "incomplete" | "every model refused" | "no resume" | "other"
}

const PREFIX = "usage/tailor"
export const utcDay = (at: Date | number | string): string => new Date(at).toISOString().slice(0, 10)

/** Twelve hex characters of a salted hash. The salt is the channel, so the same number on two channels is two people: an undercount would need the raw id kept, and it is not. */
export function personOf(channel: TailorChannel, id: string): string {
  return createHash("sha256").update(`marketfit:tailor-person:${channel}:${String(id || "").trim().toLowerCase()}`).digest("hex").slice(0, 12)
}

function failureOf(error: unknown): NonNullable<TailorEvent["failure"]> {
  const m = String((error as Error)?.message || error || "")
  if (/timed out/i.test(m)) return "timed out"
  if (/Tailoring incomplete/i.test(m)) return "incomplete"
  if (/every model errored/i.test(m)) return "every model refused"
  if (/No resumes in your library|could not be read/i.test(m)) return "no resume"
  return "other"
}

export type TailorEventInput = {
  channel: TailorChannel
  kind: "tailor" | "refine"
  /** The sender's number or the account id. Hashed here and not kept. */
  personId: string
  startedAt: number
  at: number
  result?: TailorResult
  error?: unknown
}

/** The record for one finished or failed generation. Pure: `at` is handed in. */
export function tailorEvent(input: TailorEventInput): TailorEvent {
  const base = { v: 1 as const, at: new Date(input.at).toISOString(), channel: input.channel, kind: input.kind, person: personOf(input.channel, input.personId), ms: Math.max(0, input.at - input.startedAt) }
  const r = input.result
  if (!r) return { ...base, outcome: "failed", via: "", calls: 0, input: 0, output: 0, costUsd: 0, unpricedCalls: 0, byModel: [], failure: failureOf(input.error) }
  const outcome: TailorOutcome = r.cached ? "cached" : r.unchanged ? "unchanged" : r.partial ? "partial" : "whole"
  const via = ((r.notes || []).find(n => n.startsWith("Tailored with ")) || "").replace(/^Tailored with /, "").split(" · ")[0] || ""
  // A cached result made no call now: its tokens were counted when it was first made.
  const u = r.cached ? undefined : r.usage
  return {
    ...base, outcome, via,
    calls: u?.calls ?? 0, input: (u?.inputTokens ?? 0) + (u?.cacheReadTokens ?? 0) + (u?.cacheWriteTokens ?? 0), output: u?.outputTokens ?? 0,
    costUsd: u?.estCostUSD ?? 0, unpricedCalls: u?.unpricedCalls ?? 0, byModel: u?.byModel ?? [],
    coverageBefore: r.keyword_analysis?.coverage_before, coverageAfter: r.keyword_analysis?.coverage_after,
  }
}

/** Write one record. Resolves to whether it was kept; never rejects. */
export async function recordTailor(input: Omit<TailorEventInput, "at"> & { at?: number }): Promise<boolean> {
  try {
    const at = input.at ?? Date.now()
    const event = tailorEvent({ ...input, at })
    await (await storage()).put(`${PREFIX}/${utcDay(at)}/${String(at).padStart(14, "0")}-${randomBytes(4).toString("hex")}.json`, JSON.stringify(event))
    return true
  } catch (e) {
    console.error("[tailor-ledger] a generation could not be recorded:", String((e as Error)?.message || e).slice(0, 160))
    return false
  }
}

/** Every record from `fromDay` to `toDay` (UTC days, both included), oldest first. A day that cannot be read is skipped and counted. */
export async function readTailorEvents(fromDay: string, toDay: string, limit = 5000): Promise<{ events: TailorEvent[]; unreadable: number; truncated: boolean }> {
  const days: string[] = []
  for (let t = Date.parse(`${fromDay}T00:00:00Z`); t <= Date.parse(`${toDay}T00:00:00Z`) && days.length < 400; t += 86_400_000) days.push(utcDay(t))
  const keys: string[] = []
  let unreadable = 0
  for (const day of days) {
    try { keys.push(...(await (await storage()).list(`${PREFIX}/${day}`)).filter(k => k.endsWith(".json"))) } catch { unreadable++ }
  }
  keys.sort()
  const truncated = keys.length > limit
  const wanted = truncated ? keys.slice(-limit) : keys
  const events: TailorEvent[] = []
  // Read in small batches: a week of use is a few hundred small objects, and a burst of a few hundred reads at once is how a storage
  // account gets rate limited for everyone else using it.
  for (let i = 0; i < wanted.length; i += 16) {
    const batch = await Promise.all(wanted.slice(i, i + 16).map(async k => {
      try { const raw = await (await storage()).getText(k); return raw ? JSON.parse(raw) as TailorEvent : null } catch { return null }
    }))
    for (const e of batch) { if (e && e.v === 1 && typeof e.at === "string") events.push(e); else unreadable++ }
  }
  return { events: events.sort((a, b) => a.at.localeCompare(b.at)), unreadable, truncated }
}

// ─────────────────────────────────────────── the summary ────────────────────────────────────────────

export type TailorWindow = {
  /** Resumes that were written and came back changed: whole or partial. This is "generated". */
  generated: number
  whole: number
  partial: number
  /** Asked for, and nothing came back different. */
  unchanged: number
  /** Served again from a result made earlier: no model was called. */
  cached: number
  failed: number
  /** Different people who asked, by hash. */
  people: number
  costUsd: number
  unpricedCalls: number
  calls: number
  input: number
  output: number
  /** costUsd over the resumes that called a model and came back changed. 0 when there were none. */
  costPerResumeUsd: number
  byChannel: Record<string, { generated: number; failed: number; people: number; costUsd: number; unpricedCalls: number }>
  byModel: { provider: string; model: string; calls: number; input: number; output: number; costUsd: number; kind: string }[]
}

export function summarizeTailor(events: readonly TailorEvent[]): TailorWindow {
  const people = new Set<string>(), channels = new Map<string, { generated: number; failed: number; people: Set<string>; costUsd: number; unpricedCalls: number }>(), models = new Map<string, TailorWindow["byModel"][number]>()
  const w = { generated: 0, whole: 0, partial: 0, unchanged: 0, cached: 0, failed: 0, costUsd: 0, unpricedCalls: 0, calls: 0, input: 0, output: 0 }
  let paidFor = 0
  for (const e of events) {
    people.add(e.person)
    const made = e.outcome === "whole" || e.outcome === "partial"
    if (made) { w.generated++; if (e.calls > 0) paidFor++ }
    w[e.outcome]++
    w.costUsd += e.costUsd; w.unpricedCalls += e.unpricedCalls; w.calls += e.calls; w.input += e.input; w.output += e.output
    const c = channels.get(e.channel) || { generated: 0, failed: 0, people: new Set<string>(), costUsd: 0, unpricedCalls: 0 }
    if (made) c.generated++
    if (e.outcome === "failed") c.failed++
    c.people.add(e.person); c.costUsd += e.costUsd; c.unpricedCalls += e.unpricedCalls; channels.set(e.channel, c)
    for (const m of e.byModel || []) {
      const key = `${m.provider}\u0000${m.model}`, line = models.get(key) || { provider: m.provider, model: m.model, calls: 0, input: 0, output: 0, costUsd: 0, kind: m.kind }
      line.calls += m.calls; line.input += m.input; line.output += m.output; line.costUsd += m.costUsd; models.set(key, line)
    }
  }
  const money = (n: number) => Math.round(n * 1e6) / 1e6
  return {
    ...w, costUsd: money(w.costUsd), people: people.size,
    costPerResumeUsd: paidFor ? money(w.costUsd / paidFor) : 0,
    byChannel: Object.fromEntries([...channels.entries()].map(([k, c]) => [k, { generated: c.generated, failed: c.failed, people: c.people.size, costUsd: money(c.costUsd), unpricedCalls: c.unpricedCalls }])),
    byModel: [...models.values()].map(m => ({ ...m, costUsd: money(m.costUsd) })).sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
  }
}

/** The calendar day an instant falls on in a time zone, as YYYY-MM-DD. "Today" on an admin page is the owner's day, not UTC's. */
export function dayIn(timeZone: string, at: Date | number | string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at))
  } catch {
    return utcDay(at)
  }
}

export type TailorOverview = {
  timeZone: string
  today: TailorWindow
  /** The last seven calendar days in the time zone, today included. */
  week: TailorWindow
  /** The calendar month so far. */
  month: TailorWindow
  /** One row per day of the week window, oldest first: for the picture of the week. */
  days: { day: string; generated: number; failed: number; people: number; costUsd: number; unpricedCalls: number }[]
  /** The newest twenty, newest first, with no person on them. */
  recent: Pick<TailorEvent, "at" | "channel" | "kind" | "outcome" | "ms" | "via" | "costUsd" | "unpricedCalls" | "failure">[]
}

/**
 * The `count` calendar days that end on `today` (YYYY-MM-DD), oldest first.
 * It steps the DATE. Taking 24 hours at a time off "now" names the same local day twice on the night the clocks go back and
 * skips one when they go forward (found in review, 2026-10-08), so a week would have six days or lose a day's resumes.
 */
export function daysEnding(today: string, count: number): string[] {
  const noon = Date.parse(`${today}T12:00:00Z`)
  return Array.from({ length: count }, (_, i) => utcDay(noon - (count - 1 - i) * 86_400_000))
}

export function overviewOf(events: readonly TailorEvent[], now: number, timeZone: string): TailorOverview {
  const today = dayIn(timeZone, now)
  const weekDays = daysEnding(today, 7)
  const inDays = new Set(weekDays), month = today.slice(0, 7)
  const local = events.map(e => ({ e, day: dayIn(timeZone, e.at) }))
  return {
    timeZone,
    today: summarizeTailor(local.filter(x => x.day === today).map(x => x.e)),
    week: summarizeTailor(local.filter(x => inDays.has(x.day)).map(x => x.e)),
    month: summarizeTailor(local.filter(x => x.day.startsWith(month)).map(x => x.e)),
    days: weekDays.map(day => { const s = summarizeTailor(local.filter(x => x.day === day).map(x => x.e)); return { day, generated: s.generated, failed: s.failed, people: s.people, costUsd: s.costUsd, unpricedCalls: s.unpricedCalls } }),
    recent: [...events].sort((a, b) => a.at.localeCompare(b.at)).slice(-20).reverse().map(({ at, channel, kind, outcome, ms, via, costUsd, unpricedCalls, failure }) => ({ at, channel, kind, outcome, ms, via, costUsd, unpricedCalls, ...(failure ? { failure } : {}) })),
  }
}
