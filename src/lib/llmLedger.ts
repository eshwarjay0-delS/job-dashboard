/**
 * Every model call, from every app, in one place: who was asked, for what, how many tokens, and whether it answered.
 *
 * Why (2026-10-07): the owner asked for "a centralized place for job-dashboard and kompas usage. API costs, tokens costs". Until
 * now a call left nothing behind. The tailor totalled its own tokens and showed them once; the chat, the cover letters, the
 * interview prep and everything Kompas does spent tokens that were never written down anywhere.
 *
 * THE LISTING IS THE LEDGER. One call is one tiny object in the app's storage whose NAME carries the whole record:
 *
 *   usage/llm/<UTC day>/<time>-<random>__<app>__<purpose>__<provider>__<model>__<ok|fail-429>__i<in>__o<out>__c<cached>__w<written>__t<ms>.json
 *
 * so a day's usage is read with ONE listing and no object is ever opened. A week of a few thousand calls is seven requests, where
 * reading a record per call would be thousands. It also means cost is worked out when the page is read, from the tokens and the
 * price table as it stands (src/lib/llmPrices.ts): a price corrected tomorrow corrects last week's totals too.
 *
 * What a record does NOT hold: not one word of a prompt or a reply, and nobody's identity. Counts and labels only.
 *
 * Recording must never slow a reply or fail one: it is scheduled for after the response (`after`), and every error is swallowed.
 */
import { randomBytes } from "node:crypto"
import { priceCalls, type PricedUsage } from "./llmPrices.ts"

// Storage and the framework are loaded when a record is written or read, not when this file is: the keys and the sums
// below are plain arithmetic, and loading them must not need a storage account or a running server (the tests load them bare).
const storage = () => import("./storage").then(m => m.blob)

export type LlmCall = {
  at: number
  /** Which product made the call: this one, or Kompas reporting in through /api/usage/ingest. */
  app: "marketfit" | "kompas"
  /** What the call was for, as a short label the caller chose ("tailor", "chat", "answer"). */
  purpose: string
  provider: string
  model: string
  ok: boolean
  /** The HTTP status of a refusal, when there was one. Never the provider's message. */
  status?: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  ms: number
}

const PREFIX = "usage/llm"
const day = (at: number) => new Date(at).toISOString().slice(0, 10)
/** A label made safe to be one part of a file name on every store (R2, and a Windows disk in development). */
const slug = (v: unknown, max = 64) => String(v ?? "").replace(/\//g, "~").replace(/:/g, ";").replace(/[^A-Za-z0-9._~;-]/g, "-").replace(/_+/g, "-").slice(0, max) || "unknown"
const unslug = (v: string) => v.replace(/~/g, "/").replace(/;/g, ":")
const count = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000_000) : 0 }

/** The storage key for one call. Pure, so the test can hold the format still: it is the ledger's whole schema. */
export function callKey(c: LlmCall, random = randomBytes(3).toString("hex")): string {
  const outcome = c.ok ? "ok" : `fail-${count(c.status) || 0}`
  return `${PREFIX}/${day(c.at)}/${String(Math.max(0, Math.round(Number(c.at)) || 0)).padStart(14, "0")}-${slug(random, 12)}__${slug(c.app, 16)}__${slug(c.purpose, 32)}__${slug(c.provider, 24)}__${slug(c.model)}__${outcome}__i${count(c.input)}__o${count(c.output)}__c${count(c.cacheRead)}__w${count(c.cacheWrite)}__t${count(c.ms)}.json`
}

/** A key back into a call, or null when it is not one of ours (another file in the folder, or a format from the future). */
export function callFromKey(key: string): LlmCall | null {
  const name = key.slice(key.lastIndexOf("/") + 1).replace(/\.json$/, "")
  const parts = name.split("__")
  if (parts.length !== 11) return null
  const [stamp, app, purpose, provider, model, outcome, i, o, c, w, t] = parts
  const at = Number(stamp.split("-")[0])
  if (!Number.isFinite(at) || at <= 0 || (app !== "marketfit" && app !== "kompas")) return null
  const num = (part: string, letter: string) => (part.startsWith(letter) ? count(part.slice(1)) : -1)
  const tokens = [num(i, "i"), num(o, "o"), num(c, "c"), num(w, "w"), num(t, "t")]
  if (tokens.some(n => n < 0)) return null
  const ok = outcome === "ok"
  const status = ok ? undefined : count(outcome.replace(/^fail-/, "")) || undefined
  return { at, app, purpose: unslug(purpose), provider: unslug(provider), model: unslug(model), ok, ...(status ? { status } : {}), input: tokens[0], output: tokens[1], cacheRead: tokens[2], cacheWrite: tokens[3], ms: tokens[4] }
}

/** Write one call down. Resolves to whether it was kept; never rejects. */
// `id` names the record. Left out, it is random. A report from another app passes one made from the report itself, so the
// same report delivered twice (a replay, or the sender trying again) writes the same objects again instead of new ones.
export async function recordLlmCall(call: LlmCall, id?: string): Promise<boolean> {
  try {
    await (await storage()).put(id ? callKey(call, id) : callKey(call), "{}")
    return true
  } catch (e) {
    console.error("[llm-ledger] a call could not be recorded:", String((e as Error)?.message || e).slice(0, 160))
    return false
  }
}

/**
 * Write a call down after the response has gone. Called from callLLM for every call this app makes.
 * Outside a request (a script, a test) there is no "after", so it is simply started and not waited for.
 */
export function scheduleLlmRecord(call: LlmCall): void {
  if (process.env.LLM_LEDGER === "0" || process.env.LLM_LEDGER === "false") return
  void import("next/server").then(({ after }) => after(() => recordLlmCall(call))).catch(() => recordLlmCall(call))
}

/** Every call from `fromDay` to `toDay` (UTC days, both included), oldest first. One listing per day; no object is opened. */
export async function readLlmCalls(fromDay: string, toDay: string): Promise<{ calls: LlmCall[]; unreadableDays: number }> {
  const calls: LlmCall[] = []
  let unreadableDays = 0
  const days: string[] = []
  for (let t = Date.parse(`${fromDay}T00:00:00Z`); t <= Date.parse(`${toDay}T00:00:00Z`) && days.length < 400; t += 86_400_000) days.push(day(t))
  await Promise.all(days.map(async d => {
    try {
      for (const key of await (await storage()).list(`${PREFIX}/${d}`)) { const c = callFromKey(key); if (c) calls.push(c) }
    } catch { unreadableDays++ }
  }))
  return { calls: calls.sort((a, b) => a.at - b.at), unreadableDays }
}

export type CallSummary = PricedUsage & {
  failed: number
  /** Failures with reported token usage can still be billable. */
  failedWithUsage: number
  failedWithoutUsage: number
  /** Mean time to an answer over the calls that answered, in milliseconds. */
  meanMs: number
  byApp: Record<string, { calls: number; failed: number; input: number; output: number; costUsd: number; unpricedCalls: number }>
  byPurpose: { app: string; purpose: string; calls: number; failed: number; input: number; output: number; costUsd: number; unpricedCalls: number }[]
}

/** Price reported usage even when a request failed after generation. No usage means unknown billing, not proof of a free call. */
export function summarizeCalls(calls: readonly LlmCall[]): CallSummary {
  const answered = calls.filter(c => c.ok)
  const withUsage = (c: LlmCall) => c.input + c.output + c.cacheRead + c.cacheWrite > 0
  const failedWithUsage = calls.filter(c => !c.ok && withUsage(c)).length
  const priced = priceCalls(calls.filter(c => c.ok || withUsage(c)))
  const apps = new Map<string, LlmCall[]>(), purposes = new Map<string, LlmCall[]>()
  for (const c of calls) {
    const a = apps.get(c.app); if (a) a.push(c); else apps.set(c.app, [c])
    const k = `${c.app}\u0000${c.purpose}`, list = purposes.get(k); if (list) list.push(c); else purposes.set(k, [c])
  }
  const line = (list: LlmCall[]) => { const p = priceCalls(list.filter(c => c.ok || withUsage(c))); return { calls: list.length, failed: list.filter(c => !c.ok).length, input: p.input, output: p.output, costUsd: p.costUsd, unpricedCalls: p.unpricedCalls } }
  return {
    ...priced,
    calls: calls.length,
    failed: calls.length - answered.length,
    failedWithUsage,
    failedWithoutUsage: calls.length - answered.length - failedWithUsage,
    meanMs: answered.length ? Math.round(answered.reduce((n, c) => n + c.ms, 0) / answered.length) : 0,
    byApp: Object.fromEntries([...apps.entries()].map(([app, list]) => [app, line(list)])),
    byPurpose: [...purposes.entries()].map(([k, list]) => { const [app, purpose] = k.split("\u0000"); const l = line(list); return { app, purpose, calls: l.calls, failed: l.failed, input: l.input, output: l.output, costUsd: l.costUsd, unpricedCalls: l.unpricedCalls } })
      .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
  }
}
