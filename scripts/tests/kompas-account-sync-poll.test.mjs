import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const Cloud = require("../../public/kompas/account-sync.js")

function harness(extra = {}) {
  const store = new Map()
  let list = []
  const calls = []
  const records = [{ id: "s1", session: { id: "s1", createdAt: 1, role: "Analyst" }, deleted: false }]
  const queued = []
  const timer = {
    setTimeout(fn, ms) {
      const id = { fn, ms, cleared: false }
      queued.push(id)
      return id
    },
    clearTimeout(id) {
      if (id) id.cleared = true
    },
  }
  const fetcher = extra.fetcher || (async (url, opts) => {
    const tag = opts.headers && opts.headers["if-none-match"]
    calls.push({ url, method: opts.method, tag })
    if (tag === 'W/"t1"') {
      return { ok: false, status: 304, headers: { get: () => 'W/"t1"' }, json: async () => null }
    }
    return {
      ok: true, status: 200,
      headers: { get: k => (k.toLowerCase() === "etag" ? 'W/"t1"' : null) },
      json: async () => ({ ok: true, userId: "u1", records }),
    }
  })
  const sync = Cloud.create({
    storage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    fetcher, read: () => list, write: n => { list = n }, render: () => {}, notify: () => {},
    timer, ...extra,
  })
  return { sync, calls, queued, liveTimer() { return queued.filter(x => !x.cleared).at(-1) }, get list() { return list } }
}

test("default poll interval is 60s and start schedules one timer", async () => {
  assert.equal(Cloud.POLL_MS, 60_000)
  const h = harness()
  h.sync.start()
  assert.equal(await h.sync.refresh(), true)
  assert.equal(h.liveTimer().ms, 60_000)
  h.sync.stopPolling()
})

test("timed poll is conditional, stays quiet while the tab is hidden, and polls when visible", async () => {
  const page = { hidden: true }
  const h = harness({ document: page })
  h.sync.start()
  assert.equal(await h.sync.refresh(), true)
  const before = h.calls.length
  await h.liveTimer().fn()
  assert.equal(h.calls.length, before, "hidden tab must not hit the catalog")
  page.hidden = false
  await h.liveTimer().fn()
  assert.equal(h.calls[h.calls.length - 1].tag, 'W/"t1"')
  h.sync.stopPolling()
})

test("unchanged polls back off, then a change returns to 60s", async () => {
  const h = harness()
  h.sync.start()
  assert.equal(await h.sync.refresh(), true)
  for (let i = 0; i < 3; i++) {
    const timer = h.liveTimer()
    assert.ok(timer, `missing timer on pass ${i}`)
    await timer.fn()
  }
  assert.equal(h.sync.unchangedPolls, 3)
  assert.equal(h.liveTimer().ms, 120_000)
  h.sync.stopPolling()
})

test("KOMPAS_POLL_DISABLED through create() never starts the timer; 429 disables it later", async () => {
  const off = harness({ pollDisabled: true })
  off.sync.start()
  assert.equal(off.sync.pollStopped, true)
  assert.equal(off.queued.filter(x => !x.cleared).length, 0)
  off.sync.stopPolling()

  const h = harness({
    fetcher: async (url, opts) => {
      const tag = opts.headers && opts.headers["if-none-match"]
      if (tag) {
        return {
          ok: false, status: 429,
          headers: { get: k => k.toLowerCase() === "retry-after" ? "60" : k.toLowerCase() === "x-kompas-poll" ? "disabled" : null },
          json: async () => null,
        }
      }
      return {
        ok: true, status: 200,
        headers: { get: k => (k.toLowerCase() === "etag" ? 'W/"t1"' : null) },
        json: async () => ({ ok: true, userId: "u1", records: [{ id: "s1", session: { id: "s1" }, deleted: false }] }),
      }
    },
  })
  h.sync.start()
  assert.equal(await h.sync.refresh(), true)
  await h.liveTimer().fn()
  assert.equal(h.sync.pollStopped, true)
})
