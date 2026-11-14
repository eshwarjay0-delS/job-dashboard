import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const vercel = JSON.parse(read("../../vercel.json"))
const runRoute = read("../../src/app/api/crawl/run/route.ts")
const jobsRoute = read("../../src/app/api/crawl/jobs/route.ts")
const adapters = read("../../src/lib/crawl/adapters.ts")

test("contract crawl has no Vercel schedule and the manual routes remain protected", () => {
  assert.ok(!vercel.crons.some(cron => cron.path === "/api/crawl/run"))
  const secretGate = runRoute.indexOf("if (!okSecret)")
  const secretRunner = runRoute.indexOf("const { runCrawl }")
  assert.ok(secretGate >= 0 && secretRunner > secretGate, "secret validation must precede the crawler import")
  const adminGate = jobsRoute.indexOf("if (!(await adminOf(req)))")
  const manualRunner = jobsRoute.indexOf("const { runCrawl }")
  assert.ok(adminGate >= 0 && manualRunner > adminGate, "admin authorization must precede manual crawl execution")
  assert.match(jobsRoute, /manual crawl trigger/)
  assert.doesNotMatch(runRoute, /daily portal crawl|Vercel cron/)
  assert.doesNotMatch(jobsRoute, /daily Vercel cron/)
})

test("Robert Half remains a manual-only directory source", () => {
  const active = adapters.match(/export const ADAPTERS: PortalAdapter\[\] = \[([\s\S]*?)\n\]/)
  const pending = adapters.match(/export const PENDING_PORTALS = \[([\s\S]*?)\n\]/)
  assert.ok(active, "active adapter list is present")
  assert.ok(pending, "pending/manual-only list is present")
  assert.doesNotMatch(active[1], /roberthalf/i)
  assert.match(pending[1], /roberthalf/i)
})
