// Fetching one portal's jobs, without storage: the part of a crawl that tests can run with a stand-in fetch.
import type { Fetcher, PortalAdapter, RawJob } from "./types"

export const CRAWL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (MarketFit job aggregator; contact via site)"

/** One request at a time, `gapMs` apart, 25 s each, with the aggregator's own user agent. */
export function politeFetcher(gapMs = 600): Fetcher {
  let last = 0
  return async (url, init = {}) => {
    const wait = last + gapMs - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    try {
      const res = await fetch(url, {
        method: init.method || "GET",
        headers: { "User-Agent": CRAWL_UA, Accept: init.accept || "text/html", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        ...(init.body ? { body: init.body } : {}),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
      return await res.text()
    } finally {
      clearTimeout(t)
      last = Date.now()
    }
  }
}

/** Every job one portal lists now, each address once, nothing without a title and an address. */
export async function collectJobs(adapter: PortalAdapter, get: Fetcher): Promise<RawJob[]> {
  let raws: RawJob[] = []
  if (adapter.fetchJobs) raws = await adapter.fetchJobs(get)
  else if (adapter.listUrls && adapter.parseList) {
    for (const url of adapter.listUrls) raws.push(...adapter.parseList(await get(url)))
  } else throw new Error(`${adapter.portal}: no way to read its jobs`)
  const seen = new Map<string, RawJob>()
  for (const j of raws) {
    if (!j?.url || !j?.title?.trim() || seen.has(j.url)) continue
    seen.set(j.url, { ...j, title: j.title.trim() })
  }
  return [...seen.values()]
}
