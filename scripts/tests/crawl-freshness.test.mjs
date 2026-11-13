import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { CRAWL_FRESHNESS_DAYS, crawlFreshnessCutoff } from "../../src/lib/crawl/search.ts"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("crawler search uses the same fixed 14-day window as retirement", () => {
  const now = Date.parse("2026-11-09T11:00:00.000Z")
  assert.equal(CRAWL_FRESHNESS_DAYS, 14)
  assert.equal(crawlFreshnessCutoff(now), "2026-10-26T11:00:00.000Z")
  assert.equal(crawlFreshnessCutoff(new Date(now)), "2026-10-26T11:00:00.000Z")
  const runner = read("../../src/lib/crawl/runner.ts")
  assert.match(runner, /14\s*\*\s*86400000/)
})

test("invalid freshness clocks fail closed", () => {
  assert.throws(() => crawlFreshnessCutoff(Number.NaN), RangeError)
  assert.throws(() => crawlFreshnessCutoff(new Date("not-a-date")), RangeError)
})

test("crawler search API applies freshness before returning rows", () => {
  const route = read("../../src/app/api/crawl/jobs/route.ts")
  assert.match(route, /\.eq\("active", true\)\s*\.gte\("last_seen_at",\s*crawlFreshnessCutoff\(\)\)/)
  assert.match(route, /freshness_days:\s*CRAWL_FRESHNESS_DAYS/)
})

test("eTeam is manual-only until a public feed is verified", () => {
  const adapters = read("../../src/lib/crawl/adapters.ts")
  const active = adapters.match(/export const ADAPTERS: PortalAdapter\[\] = \[([\s\S]*?)\n\]/)
  const pending = adapters.match(/export const PENDING_PORTALS = \[([\s\S]*?)\n\]/)
  assert.ok(active, "active adapter registry exists")
  assert.ok(pending, "pending adapter registry exists")
  assert.doesNotMatch(active[1], /\beteam\b/i)
  assert.match(pending[1], /"eteam"/)
  const vendors = read("../../src/lib/vendorPortals.ts")
  assert.match(vendors, /firm: "eTeam", url: "https:\/\/www\.eteaminc\.com\/careers"/)
})

test("Robert Half remains a manual cybersecurity directory link, not an active crawler adapter", () => {
  const adapters = read("../../src/lib/crawl/adapters.ts")
  const activeStart = adapters.indexOf("export const ADAPTERS: PortalAdapter[] = [")
  const pendingStart = adapters.indexOf("export const PENDING_PORTALS = [")
  assert.ok(activeStart >= 0, "active adapter registry exists")
  assert.ok(pendingStart > activeStart, "pending adapter registry follows active registry")
  const active = adapters.slice(activeStart, pendingStart)
  const pending = adapters.slice(pendingStart)
  assert.doesNotMatch(active, /roberthalf/i)
  assert.match(pending, /"roberthalf"/)
  const vendors = read("../../src/lib/vendorPortals.ts")
  assert.ok(vendors.includes('firm: "Robert Half Technology", url: "https://www.roberthalf.com/us/en/jobs/all/cyber-security"'))
  assert.ok(vendors.includes("manual-only until express prior written consent for automated collection"))
})

 
test("contract crawler has no automatic schedule and manual trigger remains admin-gated", () => {
  const vercel = JSON.parse(read("../../vercel.json"))
  assert.equal((vercel.crons || []).some(job => job.path === "/api/crawl/run"), false)
  const workflow = read("../../.github/workflows/crawl-freshness.yml")
  assert.doesNotMatch(workflow, /^\s*schedule\s*:/m)
  assert.match(workflow, /workflow_dispatch:/)
  const manualRoute = read("../../src/app/api/crawl/jobs/route.ts")
  assert.match(manualRoute, /export async function POST\(req: NextRequest\)/)
  assert.match(manualRoute, /adminOf\(req\)/)
})
