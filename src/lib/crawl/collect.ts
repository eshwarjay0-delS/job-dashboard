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

export type PortalOutcome<T> = { adapter: PortalAdapter; value?: T; error?: string; skipped?: boolean }

/**
 * `work` for every portal, `concurrency` at a time (different firms, so one firm still gets one request at a time),
 * starting at `offset` so the order turns day by day and the same portals are not always the ones time runs out on.
 * A portal not started by `deadline` is reported skipped, never half-done; one that runs past `perPortalMs` (or its own
 * `budgetMs`, for a portal that asks for a slow pace) is
 * reported as timed out. Outcomes come back in the portals' own order. Until 20 Oct 2026 portals were crawled one
 * after another inside a 60 s function: fine for two portals, cut off partway for thirty.
 */
export async function crawlEach<T>(
  adapters: PortalAdapter[],
  work: (adapter: PortalAdapter) => Promise<T>,
  opts: { concurrency: number; deadline: number; perPortalMs: number; offset?: number; now?: () => number },
): Promise<PortalOutcome<T>[]> {
  const now = opts.now || Date.now
  const n = adapters.length
  const start = n ? (((opts.offset || 0) % n) + n) % n : 0
  const order = adapters.map((_, i) => (start + i) % n)
  const out: PortalOutcome<T>[] = adapters.map(adapter => ({ adapter, skipped: true }))
  let next = 0
  const worker = async () => {
    while (next < order.length) {
      const i = order[next++]
      const adapter = adapters[i]
      const limit = adapter.budgetMs ?? opts.perPortalMs
      // Nor is one started whose own time would run past the run's end (the deadline plus the usual time a portal gets).
      if (now() >= opts.deadline || now() + limit > opts.deadline + opts.perPortalMs) { out[i] = { adapter, skipped: true }; continue }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(limit / 1000)} s`)), limit) })
        out[i] = { adapter, value: await Promise.race([work(adapter), late]) }
      } catch (e) {
        out[i] = { adapter, error: String(e instanceof Error ? e.message : e).slice(0, 300) }
      } finally {
        clearTimeout(timer)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, n)) }, worker))
  return out
}
