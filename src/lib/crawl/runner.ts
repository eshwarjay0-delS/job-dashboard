import { createServiceClient } from "@/lib/supabase/service"
import { ADAPTERS } from "./adapters"
import { classifyWorkType, normalizeDate } from "./classify"
import type { CrawlResult, RawJob } from "./types"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (MarketFit job aggregator; contact via site)"

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

type JobRow = {
  portal: string; firm: string; title: string; url: string
  location: string | null; work_type: string; engagement: string | null
  pay_range: string | null; posted_at: string | null
  last_seen_at: string; active: boolean
}

function toRow(portal: string, firm: string, j: RawJob): JobRow {
  return {
    portal, firm,
    title: j.title.slice(0, 300),
    url: j.url,
    location: j.location?.slice(0, 200) ?? null,
    work_type: classifyWorkType(j.engagement, j.title),
    engagement: j.engagement?.slice(0, 200) ?? null,
    pay_range: j.payRange?.slice(0, 120) ?? null,
    posted_at: normalizeDate(j.postedAt),
    last_seen_at: new Date().toISOString(),
    active: true,
  }
}

/**
 * Run the portal crawl: fetch each adapter's listing pages, parse job cards,
 * upsert into mfit_crawl_jobs, deactivate listings that vanished, log the run.
 * Throws when the service client isn't configured (loud, not silent).
 */
export async function runCrawl(onlyPortals?: string[]): Promise<CrawlResult[]> {
  const service = createServiceClient()
  const adapters = onlyPortals?.length
    ? ADAPTERS.filter(a => onlyPortals.includes(a.portal))
    : ADAPTERS

  const runId: string = (await service.from("mfit_crawl_runs").insert({
    portals: adapters.map(a => a.portal),
  }).select("id").single()).data?.id ?? ""

  const results: CrawlResult[] = []
  let totalFound = 0
  let totalUpserted = 0
  const errors: { portal: string; error: string }[] = []

  for (const adapter of adapters) {
    const result: CrawlResult = { portal: adapter.portal, firm: adapter.firm, found: 0, upserted: 0 }
    try {
      const seen = new Map<string, JobRow>()
      for (const listUrl of adapter.listUrls) {
        const html = await fetchHtml(listUrl)
        for (const raw of adapter.parseList(html)) {
          if (!raw.url || !raw.title) continue
          const row = toRow(adapter.portal, adapter.firm, raw)
          if (!seen.has(row.url)) seen.set(row.url, row)
        }
      }
      result.found = seen.size
      totalFound += seen.size

      if (seen.size > 0) {
        const rows = [...seen.values()]
        // Upsert in batches of 100.
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100)
          const { error } = await service.from("mfit_crawl_jobs")
            .upsert(batch, { onConflict: "portal,url" })
          if (error) throw new Error(`upsert: ${error.message}`)
        }
        result.upserted = seen.size
        totalUpserted += seen.size

        // Deactivate listings this portal no longer shows.
        const { data: existing } = await service.from("mfit_crawl_jobs")
          .select("id,url").eq("portal", adapter.portal).eq("active", true)
        const gone = (existing ?? []).filter(r => !seen.has(r.url)).map(r => r.id)
        for (let i = 0; i < gone.length; i += 100) {
          await service.from("mfit_crawl_jobs").update({ active: false }).in("id", gone.slice(i, i + 100))
        }
      }
    } catch (err) {
      result.error = String(err).slice(0, 300)
      errors.push({ portal: adapter.portal, error: result.error })
    }
    results.push(result)
  }

  if (runId) {
    await service.from("mfit_crawl_runs").update({
      finished_at: new Date().toISOString(),
      jobs_found: totalFound,
      jobs_upserted: totalUpserted,
      errors,
    }).eq("id", runId)
  }
  return results
}
