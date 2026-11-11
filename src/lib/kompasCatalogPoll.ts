import { createHash } from "node:crypto"
import { checkRateLimit } from "./rateLimit.ts"

export type CatalogMark = { session_id: string; revision?: unknown; updated_at?: unknown; deleted_at?: unknown }

/** In-memory tag cache so a burst of polls (several tabs) can 304 without another hash/query. */
export const CATALOG_TAG_MEMO_TTL_MS = 20_000
/** Conditional catalog polls per user, per minute. A 60 s timer plus a focus/visibility refresh fits. */
export const CATALOG_POLL_WINDOW_MS = 60_000
export const CATALOG_POLL_MAX_PER_WINDOW = 3

const memo = new Map<string, { tag: string; at: number }>()

export function catalogTag(userId: string, rows: CatalogMark[]): string {
  const h = createHash("sha256").update(userId)
  for (const r of rows) {
    h.update("\n" + r.session_id + "|" + String(r.revision ?? "") + "|" + String(r.updated_at ?? "") + "|" + (r.deleted_at ? "d" : ""))
  }
  return 'W/"ks-' + h.digest("base64url").slice(0, 32) + '"'
}

export function rememberCatalogTag(userId: string, tag: string, now = Date.now()): void {
  if (!userId || !tag) return
  memo.set(userId, { tag, at: now })
}

export function rememberedCatalogTag(userId: string, now = Date.now()): string | null {
  const row = memo.get(userId)
  if (!row) return null
  if (now - row.at > CATALOG_TAG_MEMO_TTL_MS) {
    memo.delete(userId)
    return null
  }
  return row.tag
}

export function invalidateCatalogTag(userId: string): void {
  memo.delete(userId)
}

export function resetCatalogTagMemo(): void {
  memo.clear()
}

export function isCatalogPollDisabled(env: NodeJS.Dict<string | undefined> = process.env): boolean {
  const v = String(env.KOMPAS_POLL_DISABLED || "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes" || v === "on"
}

export function checkCatalogPollCap(userId: string): { ok: boolean; retryAfterSec?: number } {
  return checkRateLimit("kompas-catalog-poll:" + userId, {
    max: CATALOG_POLL_MAX_PER_WINDOW,
    windowMs: CATALOG_POLL_WINDOW_MS,
  })
}

/** Unconditional full catalog reads per user per window (first load, legacy 12 s clients). */
export const CATALOG_FULL_READ_WINDOW_MS = 5 * 60_000
export const CATALOG_FULL_READ_MAX_PER_WINDOW = 6

export function checkCatalogFullReadCap(userId: string): { ok: boolean; retryAfterSec?: number } {
  return checkRateLimit("kompas-catalog-full:" + userId, {
    max: CATALOG_FULL_READ_MAX_PER_WINDOW,
    windowMs: CATALOG_FULL_READ_WINDOW_MS,
  })
}

/** Overlap applied to a delta read so a row committed just after the last read is never skipped. */
export const DELTA_OVERLAP_MS = 2 * 60_000

/** The `since` floor for a delta read: an ISO timestamp minus the overlap, or null when invalid. */
export function deltaSinceFloor(since: string | null | undefined, now = Date.now()): string | null {
  if (!since || since.length > 40) return null
  const t = Date.parse(since)
  if (!Number.isFinite(t) || t > now + 60_000 || t < now - 30 * 24 * 3600_000) return null
  return new Date(t - DELTA_OVERLAP_MS).toISOString()
}
