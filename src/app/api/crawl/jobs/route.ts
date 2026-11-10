import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { CRAWL_FRESHNESS_DAYS, collectFilteredPages, crawlFreshnessCutoff, crawlSearchOrFilter } from "@/lib/crawl/search"
import { requiresSecurityClearance } from "@/lib/contract-jobs"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/crawl/jobs — search the centralized crawl jobs table.
// Contract-only is the default view (the product's identity); pass
// work_type=all to include permanent/unknown listings too.
export async function GET(req: NextRequest) {
  if (!serviceClientAvailable()) {
    return NextResponse.json({ ok: false, jobs: [], reason: "crawl store not configured" })
  }
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim().slice(0, 120)
  const workType = searchParams.get("work_type") ?? "contract"
  const portal = (searchParams.get("portal") ?? "").trim().slice(0, 40)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100)
  const excludeClearance = searchParams.get("clearance") !== "include"
  const service = createServiceClient()
  let query = service.from("mfit_crawl_jobs")
    .select("id,portal,firm,title,location,work_type,engagement,pay_range,posted_at,url,last_seen_at,description")
    .eq("active", true)
    .gte("last_seen_at", crawlFreshnessCutoff())
    .order("last_seen_at", { ascending: false })

  if (workType !== "all") query = query.eq("work_type", workType)
  if (portal) query = query.eq("portal", portal)
  const searchFilter = crawlSearchOrFilter(q)
  if (searchFilter) query = query.or(searchFilter)

  let jobs: unknown[] = []
  let excludedClearance = 0
  let clearanceScanLimited = false
  if (excludeClearance) {
    try {
      const scanned = await collectFilteredPages(
        async (offset, pageSize) => {
          const { data, error } = await query.range(offset, offset + pageSize - 1)
          if (error) throw new Error(error.message)
          return data ?? []
        },
        limit,
        job => requiresSecurityClearance(`${job.title || ""} ${job.description || ""}`),
        { pageSize: 100, maxRows: Math.min(1000, Math.max(100, limit * 10)) },
      )
      jobs = scanned.items
      excludedClearance = scanned.excluded
      clearanceScanLimited = scanned.scanLimited
    } catch (error) {
      return NextResponse.json({
        ok: false,
        jobs: [],
        reason: error instanceof Error ? error.message : "crawl store query failed",
      })
    }
  } else {
    const { data, error } = await query.limit(limit)
    if (error) return NextResponse.json({ ok: false, jobs: [], reason: error.message })
    jobs = data ?? []
  }
  return NextResponse.json({
    ok: true,
    jobs,
    work_type: workType,
    freshness_days: CRAWL_FRESHNESS_DAYS,
    clearance: excludeClearance ? "excluded" : "included",
    excluded_clearance: excludedClearance,
    clearance_scan_limited: clearanceScanLimited,
  })
}

// POST /api/crawl/jobs — admin-only manual crawl trigger (body: { portals?: string[] }).
// The daily Vercel cron hits GET /api/crawl/run instead.
export async function POST(req: NextRequest) {
  if (!(await adminOf(req))) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }
  const { runCrawl } = await import("@/lib/crawl/runner")
  const body = await req.json().catch(() => ({}))
  const results = await runCrawl(Array.isArray(body.portals) ? body.portals : undefined)
  return NextResponse.json({ ok: true, results })
}
