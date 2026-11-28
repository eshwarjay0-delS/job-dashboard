// Fetching one portal's jobs, without storage: the part of a crawl that tests can run with a stand-in fetch.
import type { Fetcher, PortalAdapter, RawJob } from "./types"

export const CRAWL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (MarketFit job aggregator; contact via site)"

/** One request at a time, `gapMs` apart, 25 s each by default, with the aggregator's own user agent. */
function abortError(message = "Portal request cancelled"): Error {
  const error = new Error(message)
  error.name = "AbortError"
  return error
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError())
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      reject(abortError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}

export function politeFetcher(gapMs = 600, requestTimeoutMs = 25_000, portalSignal?: AbortSignal): Fetcher {
  let last = 0
  return async (url, init = {}) => {
    const wait = last + gapMs - Date.now()
    const ctrl = new AbortController()
    let host = "unknown host"
    let localTimeout = false
    let t: ReturnType<typeof setTimeout> | undefined
    const onPortalAbort = () => ctrl.abort()
    portalSignal?.addEventListener("abort", onPortalAbort, { once: true })
    if (portalSignal?.aborted) ctrl.abort()
    try {
      // URL parsing and pacing remain inside the cleanup boundary, so malformed
      // input advances the per-portal clock without leaving abort listeners behind.
      host = new URL(url).host
      if (wait > 0) await abortableDelay(wait, ctrl.signal)
      if (ctrl.signal.aborted) throw abortError()
      t = setTimeout(() => { localTimeout = true; ctrl.abort() }, requestTimeoutMs)
      const res = await fetch(url, {
        method: init.method || "GET",
        headers: { "User-Agent": CRAWL_UA, Accept: init.accept || "text/html", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        ...(init.body ? { body: init.body } : {}),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`)
      return await res.text()
    } catch (error) {
      if (localTimeout) {
        throw new Error(`Request to ${host} timed out after ${requestTimeoutMs} ms`, { cause: error })
      }
      if (portalSignal?.aborted) {
        throw new Error(`Request to ${host} was cancelled by the portal time limit`, { cause: error })
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request to ${host} was aborted before the local timeout`, { cause: error })
      }
      throw error
    } finally {
      clearTimeout(t)
      portalSignal?.removeEventListener("abort", onPortalAbort)
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

export type PortalOutcome<T> = { adapter: PortalAdapter; value?: T; error?: string; skipped?: boolean; quarantined?: boolean }

/**
 * `work` for every portal, `concurrency` at a time (different firms, so one firm still gets one request at a time),
 * starting at `offset` so the order turns day by day and the same portals are not always the ones time runs out on.
 * A portal not started by `deadline` is reported skipped, never half-done; one that runs past `perPortalMs` (or its own
 * `budgetMs`, for a portal that asks for a slow pace) is
 * reported as timed out. Outcomes come back in the portals' own order. Until 20 Oct 2026 portals were crawled one
 * after another inside a 60 s function: fine for two portals, cut off partway for thirty.
 */
/**
 * Portal work that outlives a timeout is quarantined. Its portal key stays reserved
 * until the promise settles, so a later run cannot start the same portal twice.
 */
const pendingPortalWork = new Map<string, Promise<unknown>>()

export async function crawlEach<T>(
  adapters: PortalAdapter[],
  work: (adapter: PortalAdapter, signal: AbortSignal) => Promise<T>,
  opts: { concurrency: number; deadline: number; perPortalMs: number; offset?: number; now?: () => number; timeoutDrainMs?: number },
): Promise<PortalOutcome<T>[]> {
  const now = opts.now || Date.now
  const n = adapters.length
  const startIndex = n ? (((opts.offset || 0) % n) + n) % n : 0
  const order = adapters.map((_, i) => (startIndex + i) % n)
  const out: PortalOutcome<T>[] = adapters.map(adapter => ({ adapter, skipped: true }))
  let next = 0
  const worker = async () => {
    while (next < order.length) {
      const i = order[next++]
      const adapter = adapters[i]
      if (pendingPortalWork.has(adapter.portal)) {
        out[i] = { adapter, error: "previous timed-out portal work is still settling; skipped to prevent overlap" }
        continue
      }
      const limit = adapter.budgetMs ?? opts.perPortalMs
      // Nor is one started whose own time would run past the run's end (the deadline plus the usual time a portal gets).
      if (now() >= opts.deadline || now() + limit > opts.deadline + opts.perPortalMs) { out[i] = { adapter, skipped: true }; continue }
      let timer: ReturnType<typeof setTimeout> | undefined
      const controller = new AbortController()
      const timeoutMessage = `timed out after ${Math.round(limit / 1000)} s`
      let timedOut = false
      let quarantined = false
      const workPromise = Promise.resolve().then(() => work(adapter, controller.signal))
      pendingPortalWork.set(adapter.portal, workPromise)
      const clearPending = () => {
        if (pendingPortalWork.get(adapter.portal) === workPromise) pendingPortalWork.delete(adapter.portal)
      }
      void workPromise.then(clearPending, clearPending)
      try {
        const late = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true
            controller.abort()
            reject(new Error(timeoutMessage))
          }, limit)
        })
        out[i] = { adapter, value: await Promise.race([workPromise, late]) }
      } catch (e) {
        if (timedOut) {
          // Give abort-aware work a short drain window. If it ignores abort, quarantine
          // this worker instead of awaiting forever or reusing its concurrency slot.
          const drainMs = Math.max(0, opts.timeoutDrainMs ?? 1000)
          const settled = await Promise.race([
            workPromise.then(() => true, () => true),
            new Promise<boolean>(resolve => setTimeout(() => resolve(false), drainMs)),
          ])
          out[i] = { adapter, error: timeoutMessage, quarantined: !settled }
          quarantined = !settled
        } else {
          out[i] = { adapter, error: String(e instanceof Error ? e.message : e).slice(0, 300) }
        }
      } finally {
        clearTimeout(timer)
      }
      if (quarantined) return
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, n)) }, worker))
  return out
}
