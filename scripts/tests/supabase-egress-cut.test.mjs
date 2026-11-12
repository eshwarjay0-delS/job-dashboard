// Supabase egress cut (11 Nov 2026): the project hit the Free plan 5 GB egress quota and sign-in went down.
// The Kompas session catalog was re-downloaded in full far too often. These checks pin the cuts.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import {
  deltaSinceFloor, DELTA_OVERLAP_MS, checkCatalogFullReadCap, CATALOG_FULL_READ_MAX_PER_WINDOW,
} from "../../src/lib/kompasCatalogPoll.ts"
const require = createRequire(import.meta.url)
const Cloud = require("../../public/kompas/account-sync.js")

function harness(responder) {
  const store = new Map(); const calls = []
  let list = []
  const fetcher = async (url, opts) => {
    const tag = opts.headers && opts.headers["if-none-match"]
    calls.push({ url, method: opts.method, tag })
    const r = responder({ url, tag, method: opts.method, n: calls.length })
    if (r.status === 304) return { ok: false, status: 304, headers: { get: () => r.etag }, json: async () => null }
    return { ok: true, status: 200, headers: { get: k => (k.toLowerCase() === "etag" ? r.etag : null) }, json: async () => r.body }
  }
  const sync = Cloud.create({
    storage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetcher, read: () => list, write: n => { list = n }, render: () => {}, notify: () => {},
  })
  return { sync, calls, get list() { return list } }
}

const full = {
  ok: true, userId: "u1", records: [
    { id: "a", session: { id: "a", createdAt: 2, role: "PM", jd: "x".repeat(1000) }, deleted: false, updatedAt: "2026-11-10T10:00:00.000Z" },
    { id: "b", session: { id: "b", createdAt: 1, role: "Analyst" }, deleted: false, updatedAt: "2026-11-10T11:00:00.000Z" },
  ],
}

test("a conditional read after a full read sends since=<newest updatedAt> and applies only the delta", async () => {
  const h = harness(({ n }) => n === 1
    ? { etag: 'W/"t1"', body: full }
    : { etag: 'W/"t2"', body: { ok: true, userId: "u1", delta: true, nextCursor: null, records: [
        { id: "b", session: { id: "b", createdAt: 1, role: "Senior Analyst" }, deleted: false, updatedAt: "2026-11-11T09:00:00.000Z" },
        { id: "c", session: { id: "c", createdAt: 3, role: "Engineer" }, deleted: false, updatedAt: "2026-11-11T09:01:00.000Z" },
      ] } })
  await h.sync.refresh()
  await h.sync.refresh(true)
  assert.equal(h.calls[1].tag, 'W/"t1"')
  assert.match(h.calls[1].url, /\?since=2026-11-10T11%3A00%3A00\.000Z$/)
  assert.deepEqual(h.list.map(s => s.id), ["c", "a", "b"])
  assert.equal(h.list.find(s => s.id === "b").role, "Senior Analyst")
  assert.equal(h.list.find(s => s.id === "a").jd.length, 1000, "untouched sessions are kept, not re-downloaded")
})

test("a delta tombstone removes the session; the next read advances since", async () => {
  const h = harness(({ n }) => n === 1
    ? { etag: 'W/"t1"', body: full }
    : n === 2
      ? { etag: 'W/"t2"', body: { ok: true, userId: "u1", delta: true, records: [{ id: "a", session: null, deleted: true, updatedAt: "2026-11-11T12:00:00.000Z" }] } }
      : { status: 304, etag: 'W/"t2"' })
  await h.sync.refresh(); await h.sync.refresh(true); await h.sync.refresh(true)
  assert.deepEqual(h.list.map(s => s.id), ["b"])
  assert.match(h.calls[2].url, /since=2026-11-11T12%3A00%3A00\.000Z/)
  assert.equal(h.calls[2].tag, 'W/"t2"')
})

test("the first read and unconditional reads never send since", async () => {
  const h = harness(() => ({ etag: 'W/"t1"', body: full }))
  await h.sync.refresh(); await h.sync.refresh()
  assert.equal(h.calls[0].url, "/api/kompas/account-sessions")
  assert.equal(h.calls[1].url, "/api/kompas/account-sessions")
})

test("focus, visibility, online, sibling-tab and post-save refreshes are conditional", () => {
  const lib = readFileSync(new URL("../../public/kompas/account-sync.js", import.meta.url), "utf8")
  assert.match(lib, /addEventListener\("focus",\(\)=>\{noteActivity\(\);void refresh\(true\);\}\)/)
  assert.match(lib, /visibilitychange",\(\)=>\{if\(!document\.hidden\)\{noteActivity\(\);void refresh\(true\);\}\}/)
  assert.match(lib, /flush\(\)\.then\(\(\)=>refresh\(true\)\)/)
  assert.match(lib, /if\(!Object\.keys\(pending\)\.length\)\{[\s\S]*?void refresh\(true\);\s*\}/)
  assert.match(lib, /now-lastStorageRefresh<STORAGE_REFRESH_MS/)
  assert.doesNotMatch(lib, /void refresh\(\);\s*\}\);\s*document/, "no unconditional sibling-tab refresh")
})

test("deltaSinceFloor subtracts the overlap and refuses junk or far-off timestamps", () => {
  const now = Date.parse("2026-11-11T15:00:00.000Z")
  assert.equal(deltaSinceFloor("2026-11-11T14:00:00.000Z", now), new Date(Date.parse("2026-11-11T14:00:00.000Z") - DELTA_OVERLAP_MS).toISOString())
  for (const bad of [null, "", "yesterday", "2026-12-31T00:00:00Z", "2020-01-01T00:00:00Z", "x".repeat(50)]) assert.equal(deltaSinceFloor(bad, now), null)
})

test("unconditional full catalog reads are capped per user", () => {
  const id = "cap-" + Math.random()
  for (let i = 0; i < CATALOG_FULL_READ_MAX_PER_WINDOW; i++) assert.equal(checkCatalogFullReadCap(id).ok, true)
  const refused = checkCatalogFullReadCap(id)
  assert.equal(refused.ok, false)
  assert.ok(refused.retryAfterSec > 0)
})

test("the route serves deltas, caps legacy full reads and saves through the payload-free RPC with a fallback", () => {
  const route = readFileSync(new URL("../../src/app/api/kompas/account-sessions/route.ts", import.meta.url), "utf8")
  assert.match(route, /deltaSinceFloor\(req\.nextUrl\.searchParams\.get\("since"\)\)/)
  assert.match(route, /\.gte\("updated_at", floor\)/)
  assert.match(route, /delta: true/)
  assert.match(route, /checkCatalogFullReadCap\(user\.id\)/)
  assert.match(route, /merge_kompas_account_session_lite/)
  assert.match(route, /isMissingFunction\(error\)/)
  const mig = new URL("../../supabase/migrations/20261111150000_kompas_session_merge_lite.sql", import.meta.url)
  assert.ok(existsSync(mig))
  const sql = readFileSync(mig, "utf8")
  assert.match(sql, /- 'session'/)
  assert.match(sql, /revoke all on function public\.merge_kompas_account_session_lite/)
  assert.match(sql, /grant execute on function public\.merge_kompas_account_session_lite\(uuid,text,jsonb,boolean\) to service_role/)
})
