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
export function crawlSearchOrFilter(input: string): string | null {
  const terms = crawlSearchTerms(input)
  if (!terms.length) return null
  return terms.flatMap(term => SEARCH_FIELDS.map(field => `${field}.ilike.*${term}*`)).join(",")
}

export type FilteredPageResult<T> = {
  items: T[]
  scanned: number
  excluded: number
  scanLimited: boolean
}

/** Scan bounded ordered pages until the visible result limit is filled.
 * Filtering after a single over-fetch can underfill search when clearance roles
 * dominate the newest rows. The caller owns ordering and the exclusion rule. */
export async function collectFilteredPages<T>(
  fetchPage: (offset: number, pageSize: number) => Promise<readonly T[]>,
  limit: number,
  exclude: (row: T) => boolean,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<FilteredPageResult<T>> {
  const target = Math.max(1, Math.min(100, Math.floor(limit) || 20))
  const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 100) || 100))
  const maxRows = Math.max(1, Math.min(1000, Math.floor(options.maxRows ?? 1000) || 1000))
  const items: T[] = []
  let scanned = 0
  let excluded = 0

  while (scanned < maxRows && items.length < target) {
    const take = Math.min(pageSize, maxRows - scanned)
    const page = await fetchPage(scanned, take)
    if (!page.length) break
    scanned += page.length
    const visible = page.filter(row => !exclude(row))
    excluded += page.length - visible.length
    items.push(...visible)
    if (page.length < take) break
  }

  return {
    items: items.slice(0, target),
    scanned,
    excluded,
    scanLimited: items.length < target && scanned >= maxRows,
  }
}
