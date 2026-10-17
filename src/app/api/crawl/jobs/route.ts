import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { adminOf } from "@/lib/adminAccess"
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

  const service = createServiceClient()
  let query = service.from("mfit_crawl_jobs")
    .select("id,portal,firm,title,location,work_type,engagement,pay_range,posted_at,url,last_seen_at")
    .eq("active", true)
    .order("last_seen_at", { ascending: false })
    .limit(limit)

  if (workType !== "all") query = query.eq("work_type", workType)
  if (portal) query = query.eq("portal", portal)
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`
    query = query.or(`title.ilike.${like},location.ilike.${like},firm.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, jobs: [], reason: error.message })
  return NextResponse.json({ ok: true, jobs: data ?? [], work_type: workType })
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
