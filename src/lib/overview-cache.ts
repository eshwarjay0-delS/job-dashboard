// Overview instant copy (7 Nov 2026, owner ask): the list must load from cache,
// readily available at all times, with new things appearing as the background
// scan finds them. The pattern is the Interviews tab's: the last good list
// lives in memory and in localStorage under the signed-in person's id, so
// opening Overview paints what was there last time at once and only the quiet
// refresh behind it can change it. New chains append when the refresh lands;
// nothing already shown is ever taken away by a slow load. A saved list
// fresher than 15 minutes is shown as-is, with no scan behind it at all.
//
// No imports by design, so the pure parts stay directly testable.
import type { ApplicationChain } from "../app/api/gmail/_lib"

export const OVERVIEW_SNAPSHOT_KEY_PREFIX = "mfit:overview-chains:v1:"
export const OVERVIEW_REFRESH_TTL_MS = 15 * 60 * 1000
export type OverviewSnapshot = { chains: ApplicationChain[]; scanned: number; at: number }

export function overviewKey(userId: string | null, account: string): string | null {
  return userId ? `${OVERVIEW_SNAPSHOT_KEY_PREFIX}${userId}:${account || "all"}` : null
}

export function readOverviewSnapshot(key: string): OverviewSnapshot | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const j = JSON.parse(raw) as OverviewSnapshot
    return j && Array.isArray(j.chains) && typeof j.at === "number" && typeof j.scanned === "number" ? j : null
  } catch { return null }
}

export function keepOverviewSnapshot(key: string, snap: OverviewSnapshot): void {
  try { localStorage.setItem(key, JSON.stringify(snap)) } catch { /* storage full: the live list still works */ }
}

export function snapshotIsFresh(snap: OverviewSnapshot | null, now: number): boolean {
  return !!snap && now - snap.at < OVERVIEW_REFRESH_TTL_MS
}

/**
 * Merge fresh scan pages into the painted list: an updated chain replaces its
 * old copy by inbox + thread, a new chain appends, and a chain the slow load
 * has not reached yet stays put.
 */
export function mergeChains(shown: ApplicationChain[], fresh: ApplicationChain[]): ApplicationChain[] {
  const byId = new Map(shown.map(c => [`${c.accountEmail}:${c.threadId}`, c]))
  for (const c of fresh) byId.set(`${c.accountEmail}:${c.threadId}`, c)
  return [...byId.values()]
}
