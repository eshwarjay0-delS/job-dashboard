/**
 * How another of the owner's apps reports its model calls here, and how this app knows the report is real.
 *
 * Why (2026-10-07): "This should be a centralized place for job-dashboard and kompas usage." Kompas runs on its own deployment
 * with no storage of its own, so it cannot keep a ledger; it posts each call's counts to POST /api/usage/ingest and they are
 * filed in this app's ledger beside its own (src/lib/llmLedger.ts).
 *
 * A report is signed, because an open door that anyone can post numbers through is a cost page anyone can falsify. The
 * signature is an HMAC of the exact body. Its key is, in order:
 *
 *   USAGE_INGEST_SECRET   when the owner has set one on both deployments.
 *   otherwise             a key DERIVED from GROQ_API_KEY, which both deployments already hold. The Groq key itself is never
 *                         sent or stored anywhere new: each side computes HMAC(groq key, a fixed label) and uses that. So the
 *                         two apps can vouch for each other the day this ships, with no new secret for anyone to create,
 *                         paste or lose. If the two deployments ever hold different Groq keys the reports are refused, the
 *                         sender logs it, and the admin page says Kompas is not reporting: setting USAGE_INGEST_SECRET on
 *                         both is then the fix.
 *
 * A report carries when it was sent and is refused when that is more than ten minutes off, so a captured one cannot be replayed
 * later. It holds counts and labels only; this file checks every field's type and size before anything is stored.
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import type { LlmCall } from "@/lib/llmLedger"

const LABEL = "marketfit-usage-ingest-v1"
export const MAX_REPORT_BYTES = 64 * 1024
export const MAX_CALLS_PER_REPORT = 50
export const MAX_SKEW_MS = 10 * 60 * 1000

/** The signing key, or null when this deployment has nothing to derive one from. */
export function ingestKey(env: Record<string, string | undefined> = process.env): string | null {
  const own = (env.USAGE_INGEST_SECRET || "").trim()
  if (own.length >= 32) return own
  const groq = (env.GROQ_API_KEY || "").trim()
  return groq ? createHmac("sha256", groq).update(LABEL).digest("hex") : null
}

export function signReport(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("hex")
}

export function reportIsSigned(body: string, signature: string | null, key: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = Buffer.from(signReport(body, key), "hex"), given = Buffer.from(signature, "hex")
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export type ReportVerdict = { ok: true; calls: LlmCall[] } | { ok: false; because: "not-json" | "wrong-shape" | "stale" | "too-many" | "unknown-app" }

const label = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null)
const whole = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null)

/** Read a report. Everything is checked; a single bad call refuses the whole report, so a sender bug is seen, not half-stored. */
export function readReport(body: string, now: number): ReportVerdict {
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return { ok: false, because: "not-json" } }
  const r = parsed as { app?: unknown; sentAt?: unknown; calls?: unknown }
  if (!r || typeof r !== "object" || !Array.isArray(r.calls)) return { ok: false, because: "wrong-shape" }
  if (r.app !== "kompas") return { ok: false, because: "unknown-app" }
  const sentAt = whole(r.sentAt, 1e14)
  if (sentAt === null || Math.abs(now - sentAt) > MAX_SKEW_MS) return { ok: false, because: "stale" }
  if (r.calls.length === 0 || r.calls.length > MAX_CALLS_PER_REPORT) return { ok: false, because: "too-many" }
  const calls: LlmCall[] = []
  for (const raw of r.calls as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") return { ok: false, because: "wrong-shape" }
    const at = whole(raw.at, 1e14), purpose = label(raw.purpose, 32), provider = label(raw.provider, 24), model = label(raw.model, 64)
    const input = whole(raw.input ?? 0, 1e8), output = whole(raw.output ?? 0, 1e8), cacheRead = whole(raw.cacheRead ?? 0, 1e8), cacheWrite = whole(raw.cacheWrite ?? 0, 1e8), ms = whole(raw.ms ?? 0, 1e7)
    const status = raw.status === undefined ? undefined : whole(raw.status, 999)
    if (at === null || purpose === null || provider === null || model === null || typeof raw.ok !== "boolean" || input === null || output === null || cacheRead === null || cacheWrite === null || ms === null || status === null) return { ok: false, because: "wrong-shape" }
    // A call is filed on the day it says it was made, so that is held near the present too: no back-dating into last month.
    if (Math.abs(now - at) > 24 * 60 * 60 * 1000) return { ok: false, because: "stale" }
    calls.push({ at, app: "kompas", purpose, provider, model, ok: raw.ok, ...(status ? { status } : {}), input, output, cacheRead, cacheWrite, ms })
  }
  return { ok: true, calls }
}
