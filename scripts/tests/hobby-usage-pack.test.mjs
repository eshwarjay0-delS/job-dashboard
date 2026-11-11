import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"))
const nextConfig = readFileSync(new URL("../../next.config.js", import.meta.url), "utf8")
const health = readFileSync(new URL("../../src/app/api/health/route.ts", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const route = readFileSync(new URL("../../src/app/api/kompas/account-sessions/route.ts", import.meta.url), "utf8")

test("only master creates Vercel deployments; preview branches do not", () => {
  assert.equal(vercel.git.deploymentEnabled["**"], false)
  assert.equal(vercel.git.deploymentEnabled.master, true)
})

test("Vercel cron list keeps recover, crawl, and watchdog only, each once a day", () => {
  const paths = vercel.crons.map(c => c.path).sort()
  assert.deepEqual(paths, ["/api/agent/watchdog", "/api/gmail/crawl", "/api/whatsapp/recover"].sort())
  for (const cron of vercel.crons) {
    const parts = cron.schedule.trim().split(/\s+/)
    assert.equal(parts.length, 5)
    assert.ok(!cron.schedule.includes("*/"), cron.path)
    assert.notEqual(parts[1], "*", cron.path + " must not run every hour")
  }
  assert.ok(!vercel.crons.some(c => c.path === "/api/crawl/run"))
  assert.ok(!vercel.crons.some(c => c.path === "/api/chief/watch/run"))
})

test("public stamps may be cached; other API routes stay no-store", () => {
  const cacheFor = (source) => vercel.headers.find(h => h.source === source)?.headers.find(x => x.key === "Cache-Control")?.value
  assert.match(cacheFor("/api/(.*)"), /no-store/)
  assert.match(cacheFor("/version.json"), /s-maxage=300/)
  assert.match(cacheFor("/kompas/version.json"), /s-maxage=300/)
  assert.match(cacheFor("/api/health"), /s-maxage=60/)
  assert.match(nextConfig, /source: "\/version\.json"/)
  assert.match(nextConfig, /source: "\/api\/health"/)
  assert.match(health, /s-maxage=60/)
  assert.ok(!/no-store/.test(health))
})

test("Kompas sidebar deep links are relative so an Oracle origin stays on-host", () => {
  assert.match(html, /href="\/dashboard\/kompas\/flow"/)
  assert.match(html, /href="\/dashboard\/prep"/)
  assert.match(html, /href="\/downloads\/kompas"/)
  assert.doesNotMatch(html, /https:\/\/job-dashboard-fawn\.vercel\.app/)
})

test("catalog route uses the poll kill switch and memo helper, and never caches user data", () => {
  assert.match(route, /isCatalogPollDisabled/)
  assert.match(route, /rememberCatalogTag/)
  assert.match(route, /invalidateCatalogTag/)
  assert.match(route, /Cache-Control": "no-store, private/)
})

test("weekly usage guard workflow exists and is not a pull_request job", () => {
  const path = new URL("../../.github/workflows/hobby-usage-guard.yml", import.meta.url)
  assert.equal(existsSync(path), true)
  const yml = readFileSync(path, "utf8")
  assert.match(yml, /cron: "0 14 \* \* 1"/)
  assert.match(yml, /workflow_dispatch/)
  assert.doesNotMatch(yml, /pull_request/)
  assert.match(yml, /hobby-usage-guard\.mjs/)
})
