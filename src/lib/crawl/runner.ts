import { createServiceClient } from "@/lib/supabase/service"
import { ADAPTERS } from "./adapters"
import { classifyWorkType, normalizeDate } from "./classify"
import { collectJobs, crawlEach, politeFetcher } from "./collect"
import { scrubContacts } from "./text"
import type { CrawlResult, PortalAdapter, RawJob } from "./types"

type JobRow = {
  portal: string; firm: string; title: string; url: string
  location: string | null; work_type: string; engagement: string | null
  pay_range: string | null; posted_at: string | null; description: string | null
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
    // Kept for matching and tailoring (the table always had the column; until 20 Oct 2026 nothing filled it).
    // A recruiter's address or number written into the text is taken out before anything is stored.
    description: j.description ? scrubContacts(j.description).slice(0, 8000) : null,
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

  // Several firms at once (each firm still one request at a time, 600 ms apart), the order turning by the day, and
  // nothing started after 230 s nor running past 60 s, so the run ends inside the function's 300 s.
  const started = Date.now()
  const outcomes = await crawlEach(adapters, adapter => crawlOne(service, adapter), {
    concurrency: 6, deadline: started + 230_000, perPortalMs: 60_000, offset: Math.floor(started / 86_400_000),
  })
  const results: CrawlResult[] = outcomes.map(o => o.value ?? {
    portal: o.adapter.portal, firm: o.adapter.firm, found: 0, upserted: 0,
    error: o.skipped ? "not reached in this run's time (the order turns daily)" : o.error || "failed",
  })
  const totalFound = results.reduce((n, r) => n + r.found, 0)
  const totalUpserted = results.reduce((n, r) => n + r.upserted, 0)
  const errors = results.filter(r => r.error).map(r => ({ portal: r.portal, error: r.error as string }))

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

/** One portal: read its jobs, store them, and retire those not seen for 14 days. Throws on a storage failure. */
async function crawlOne(service: ReturnType<typeof createServiceClient>, adapter: PortalAdapter): Promise<CrawlResult> {
  const result: CrawlResult = { portal: adapter.portal, firm: adapter.firm, found: 0, upserted: 0 }
  // Listing pages, a JSON API or a sitemap, whichever the portal has; one request at a time, 600 ms apart unless the portal asks for slower.
  const seen = new Map<string, JobRow>()
  for (const raw of await collectJobs(adapter, politeFetcher(adapter.gapMs ?? 600))) seen.set(raw.url, toRow(adapter.portal, adapter.firm, raw))
  result.found = seen.size
  if (seen.size > 0) {
    const rows = [...seen.values()]
    // Upsert in batches of 100.
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await service.from("mfit_crawl_jobs").upsert(rows.slice(i, i + 100), { onConflict: "portal,url" })
      if (error) throw new Error(`upsert: ${error.message}`)
    }
    result.upserted = seen.size
    // A run reads the newest listings only. Absence from them is not proof a job closed: retire after 14 days unseen.
    await service.from("mfit_crawl_jobs").update({ active: false })
      .eq("portal", adapter.portal).eq("active", true)
      .lt("last_seen_at", new Date(Date.now() - 14 * 86400000).toISOString())
  }
  return result
}
