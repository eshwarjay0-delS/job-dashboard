import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"))
const route = readFileSync(resolve(root, "src/app/api/crawl/run/route.ts"), "utf8")

test("the Apply crawler has exactly one daily 11:00 UTC cron", () => {
  const entries = config.crons.filter((entry) => entry.path === "/api/crawl/run")
  assert.equal(entries.length, 1)
  assert.equal(entries[0].schedule, "0 11 * * *")
  assert.equal(entries[0].schedule.split(" ").length, 5)
})

test("restoring the Apply crawler does not remove the existing daily maintenance crons", () => {
  const schedules = new Map(config.crons.map((entry) => [entry.path, entry.schedule]))
  assert.equal(schedules.get("/api/agent/watchdog"), "0 13 * * *")
  assert.equal(schedules.get("/api/gmail/crawl"), "0 12 * * *")
  assert.equal(schedules.get("/api/whatsapp/recover"), "45 11 * * *")
  assert.equal(new Set(config.crons.map((entry) => entry.path)).size, config.crons.length)
})

test("the scheduled crawl remains fail-closed behind a configured cron secret", () => {
  assert.ok(route.includes('const vercelCronSecret = process.env.CRON_SECRET || ""'))
  assert.ok(route.includes("authHeader === \x60Bearer \${vercelCronSecret}\x60 && vercelCronSecret.length >= 16"))
  assert.ok(route.includes("watchdogSecret.length >= 32 && timingSafeEqual(provided, watchdogSecret)"))
  assert.ok(route.includes('if (!okSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })'))
})

test("the scheduled crawl refuses to run without the service client", () => {
  assert.ok(route.includes("if (!serviceClientAvailable())"))
  assert.ok(route.includes('const { runCrawl } = await import("@/lib/crawl/runner")'))
  assert.ok(route.includes("const results = await runCrawl()"))
})
