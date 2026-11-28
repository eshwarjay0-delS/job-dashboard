const SEARCH_FIELDS = ["title", "location", "firm", "description"] as const
const MAX_SEARCH_TERMS = 8

// A source that has not been re-seen for two weeks is no longer a live search result.
// Keep this aligned with crawl/runner.ts, which retires listings after 14 days unseen.
export const CRAWL_FRESHNESS_DAYS = 14

export function crawlFreshnessCutoff(now: number | Date = Date.now()): string {
  const epoch = now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(epoch) || !Number.isFinite(new Date(epoch).getTime())) {
    throw new RangeError("crawl freshness clock must be a valid timestamp")
  }
  return new Date(epoch - CRAWL_FRESHNESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Turn a user job search into safe, distinct terms for PostgREST's raw `or`
 * filter. Keep punctuation that is meaningful in technical roles (C++, C#,
 * .NET) while removing PostgREST filter delimiters and wildcard characters.
 */
export function crawlSearchTerms(input: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of input.trim().split(/\s+/)) {
    const term = raw.replace(/[^a-zA-Z0-9@+#.-]/g, "")
    const key = term.toLowerCase()
    if (!term || !/[a-zA-Z0-9]/.test(term) || seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length === MAX_SEARCH_TERMS) break
  }
  return terms
}

/**
 * Broad category search: any distinct term may match any searchable field.
 * This mirrors `/api/jobs` instead of requiring a literal multi-word phrase.
 */
/** Safe, bounded location tokens applied as AND filters to the location column. */
export function crawlLocationTerms(input: string): string[] {
  return crawlSearchTerms(input).slice(0, 4)
}

export function crawlSearchOrFilter(input: string): string | null {
  const terms = crawlSearchTerms(input)
  if (!terms.length) return null
  return terms.flatMap(term => SEARCH_FIELDS.map(field => `${field}.ilike.*${term}*`)).join(",")
}


export type FilteredSnapshotResult<T> = {
  items: T[]
  scanned: number
  excluded: number
  scanLimited: boolean
}

/** Filter one ordered database snapshot.
 * Avoid offset pagination over mutable last_seen_at: concurrent crawls can move
 * rows between pages. The caller performs one bounded query, then filters it
 * in memory so this request sees a stable result set.
 */
export function collectFilteredSnapshot<T>(
  rows: readonly T[],
  limit: number,
  exclude: (row: T) => boolean,
  scanLimit: number,
): FilteredSnapshotResult<T> {
  const target = Math.max(1, Math.min(100, Math.floor(limit) || 20))
  const maxRows = Math.max(1, Math.min(1000, Math.floor(scanLimit) || 1000))
  const snapshot = rows.slice(0, maxRows)
  const visible = snapshot.filter(row => !exclude(row))

  return {
    items: visible.slice(0, target),
    scanned: snapshot.length,
    excluded: snapshot.length - visible.length,
    scanLimited: visible.length < target && snapshot.length >= maxRows,
  }
}
