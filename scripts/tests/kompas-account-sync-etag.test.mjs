// Origin-transfer cut (10 Nov 2026): the timed poll is conditional; every other read stays a full read.
import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const Cloud = require("../../public/kompas/account-sync.js")

function harness() {
  const store = new Map(); const calls = []
  let list = []
  const records = [{ id: "s1", session: { id: "s1", createdAt: 1, role: "Analyst" }, deleted: false }]
  const fetcher = async (url, opts) => {
    const tag = opts.headers && opts.headers["if-none-match"]
    calls.push({ url, method: opts.method, tag })
    if (tag === 'W/"t1"') return { ok: false, status: 304, headers: { get: () => 'W/"t1"' }, json: async () => null }
    return { ok: true, status: 200, headers: { get: k => (k.toLowerCase() === "etag" ? 'W/"t1"' : null) }, json: async () => ({ ok: true, userId: "u1", records }) }
  }
  const sync = Cloud.create({
    storage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetcher, read: () => list, write: n => { list = n }, render: () => {}, notify: () => {},
  })
  return { sync, calls, get list() { return list } }
}

test("first read is full, the timed poll sends the tag and keeps the list on 304", async () => {
  const h = harness()
  assert.equal(await h.sync.refresh(), true)
  assert.equal(h.calls[0].tag, undefined)
  assert.equal(h.list.length, 1)
  assert.equal(await h.sync.refresh(true), true)
  assert.equal(h.calls[1].tag, 'W/"t1"')
  assert.equal(h.list.length, 1)
})

test("an unconditional refresh never sends the tag", async () => {
  const h = harness()
  await h.sync.refresh(); await h.sync.refresh()
  assert.equal(h.calls[1].tag, undefined)
})
