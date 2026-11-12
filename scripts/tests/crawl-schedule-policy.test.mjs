import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8")
const config = JSON.parse(read("vercel.json"))

test("contract portal crawling has no scheduled Vercel cron", () => {
  const paths = (config.crons || []).map(cron => cron.path)
  assert.equal(paths.includes("/api/crawl/run"), false)
  assert.equal(paths.includes("/api/crawl/jobs"), false)
  assert.ok(paths.includes("/api/gmail/crawl"), "the separate Gmail crawl remains scheduled")
})

test("the manual contract crawler trigger is admin-only", () => {
  const route = read("src/app/api/crawl/jobs/route.ts")
  const post = route.slice(route.indexOf("export async function POST"))
  const guard = post.indexOf("adminOf(req)")
  const crawl = post.indexOf("runCrawl(")
  assert.ok(guard >= 0, "POST must verify the admin")
  assert.ok(crawl > guard, "the crawl must happen after the admin guard")
  assert.match(post, /Admins only\./)
})

test("the separate GET runner remains secret-gated", () => {
  const route = read("src/app/api/crawl/run/route.ts")
  assert.match(route, /CRON_SECRET/)
  assert.match(route, /WATCHDOG_CRON_SECRET/)
  assert.match(route, /Unauthorized\./)
})


test("crawler route comments do not imply a daily Vercel schedule", () => {
  const run = read("src/app/api/crawl/run/route.ts")
  const jobs = read("src/app/api/crawl/jobs/route.ts")
  assert.doesNotMatch(run, /daily Vercel cron|daily portal crawl/i)
  assert.doesNotMatch(jobs, /daily Vercel cron|daily portal crawl/i)
  assert.match(run, /manual|on-demand|unscheduled/i)
  assert.match(jobs, /manual|on-demand|admin/i)
})
