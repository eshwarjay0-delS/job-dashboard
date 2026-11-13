import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import {
  catalogMarks,
  createMemoryFreeStore,
  deltaRows,
  isFreeSessionStoreConfigured,
  loadCatalog,
  mergeSessionOperations,
  mergeSessionRow,
  pageRows,
  readArtifact,
  replaceCatalog,
  resetFreeSessionStoreForTests,
  saveArtifact,
  setFreeSessionStoreForTests,
  setFreeStoreClockForTests,
  shouldUseFreeSessionStore,
} from "../../src/lib/kompasFreeSessionStore.ts"
import { catalogTag } from "../../src/lib/kompasCatalogPoll.ts"

const { create } = createRequire(import.meta.url)("../../public/kompas/account-sync.js")

test("login-off uses the free store unless skip-login was explicitly turned off", () => {
  assert.equal(shouldUseFreeSessionStore({}), true)
  assert.equal(shouldUseFreeSessionStore({ AUTH_DISABLED: "false" }), true)
  assert.equal(shouldUseFreeSessionStore({ AUTH_DISABLED: "1" }), true)
  assert.equal(shouldUseFreeSessionStore({ AUTH_DISABLED: "true" }), true)
  assert.equal(shouldUseFreeSessionStore({ NEXT_PUBLIC_AUTH_DISABLED: "true" }), true)
  assert.equal(shouldUseFreeSessionStore({ AUTH_DISABLED: "off-confirmed-by-eshwar" }), false)
  assert.equal(isFreeSessionStoreConfigured({}), false)
  assert.equal(isFreeSessionStoreConfigured({ BLOB_STORE_ID: "store_test" }), true)
})

test.afterEach(() => {
  resetFreeSessionStoreForTests()
})

test("merge inserts, patches, tombstones, and never undeletes", () => {
  setFreeStoreClockForTests(() => "2026-11-12T22:00:00.000Z")
  const created = mergeSessionRow(undefined, { id: "s1", patch: { id: "s1", role: "Engineer" }, deleted: false })
  assert.equal(created.revision, 2)
  assert.equal(created.payload.role, "Engineer")
  assert.equal(created.deleted_at, null)
  const patched = mergeSessionRow(created, { id: "s1", patch: { company: "LPL" }, deleted: false }, "2026-11-12T22:01:00.000Z")
  assert.equal(patched.revision, 3)
  assert.equal(patched.payload.role, "Engineer")
  assert.equal(patched.payload.company, "LPL")
  const ended = mergeSessionRow(patched, { id: "s1", patch: { endedAt: 9, endedBy: "user" }, deleted: false }, "2026-11-12T22:02:00.000Z")
  const staleStart = mergeSessionRow(ended, { id: "s1", patch: { runAt: 10, pausedAt: null }, deleted: false }, "2026-11-12T22:03:00.000Z")
  assert.equal(staleStart.payload.endedAt, 9)
  assert.equal(staleStart.payload.runAt, undefined)
  const deleted = mergeSessionRow(ended, { id: "s1", patch: {}, deleted: true }, "2026-11-12T22:04:00.000Z")
  assert.ok(deleted.deleted_at)
  assert.deepEqual(deleted.payload, {})
  const resurrect = mergeSessionRow(deleted, { id: "s1", patch: { role: "Nope" }, deleted: false }, "2026-11-12T22:05:00.000Z")
  assert.equal(resurrect.deleted_at, deleted.deleted_at)
  assert.deepEqual(resurrect.payload, {})
})

test("transcript keys union and prefer the incoming copy", () => {
  const before = mergeSessionRow(undefined, {
    id: "s1",
    patch: { transcripts: [{ key: "a", text: "old-a" }, { key: "b", text: "keep-b" }] },
    deleted: false,
  })
  const after = mergeSessionRow(before, {
    id: "s1",
    patch: { transcripts: [{ key: "a", text: "new-a" }, { key: "c", text: "new-c" }] },
    deleted: false,
  }, "2026-11-12T22:10:00.000Z")
  // Same order as the SQL merge: surviving rows are aggregated by original ordinal,
  // so an unchanged earlier entry stays ahead of incoming keys.
  assert.deepEqual(after.payload.transcripts, [
    { key: "b", text: "keep-b" },
    { key: "a", text: "new-a" },
    { key: "c", text: "new-c" },
  ])
})

test("memory store pages, deltas, etags, and artifacts", async () => {
  const store = createMemoryFreeStore()
  setFreeSessionStoreForTests(store)
  setFreeStoreClockForTests(() => "2026-11-12T22:20:00.000Z")
  const user = "67f02d95-f7fe-4058-9b0d-9363221e7c61"
  await mergeSessionOperations(user, [
    { id: "s1", patch: { id: "s1", role: "A" }, deleted: false },
    { id: "s2", patch: { id: "s2", role: "B" }, deleted: false },
  ])
  setFreeStoreClockForTests(() => "2026-11-12T22:30:00.000Z")
  await mergeSessionOperations(user, [{ id: "s3", patch: { id: "s3", role: "C" }, deleted: false }])
  const catalog = await loadCatalog(user)
  assert.equal(catalog.rows.length, 3)
  const page = pageRows(catalog.rows, "", 2)
  assert.deepEqual(page.records.map(r => r.id), ["s1", "s2"])
  assert.equal(page.nextCursor, "s2")
  const page2 = pageRows(catalog.rows, page.nextCursor, 2)
  assert.deepEqual(page2.records.map(r => r.id), ["s3"])
  assert.equal(page2.nextCursor, null)
  const delta = deltaRows(catalog.rows, "2026-11-12T22:25:00.000Z", 20)
  assert.deepEqual(delta.map(r => r.id), ["s3"])
  const tag = catalogTag(user, catalogMarks(catalog.rows))
  assert.match(tag, /^W\/"ks-/)
  assert.equal(catalogTag(user, catalogMarks(catalog.rows)), tag)
  await mergeSessionOperations(user, [{ id: "s1", patch: { role: "A2" }, deleted: false }])
  const after = await loadCatalog(user)
  assert.notEqual(catalogTag(user, catalogMarks(after.rows)), tag)

  assert.equal(await saveArtifact(user, "s2", "s2:live", { at: 1, log: [1] }, 1), true)
  assert.equal((await readArtifact(user, "s2", "s2:live")).captured_at, 1)
  assert.equal(await saveArtifact(user, "s2", "s2:live", { at: 1, log: [1] }, 1), false, "older or equal shorter log is ignored")
  assert.equal(await saveArtifact(user, "s2", "s2:live", { at: 1, log: [1, 2] }, 1), true)
  assert.equal((await readArtifact(user, "s2", "s2:live")).payload.log.length, 2)
  await assert.rejects(() => saveArtifact(user, "missing", "missing:live", { at: 1 }, 1))
})

test("replaceCatalog seeds rows the client contract can read", async () => {
  setFreeSessionStoreForTests(createMemoryFreeStore())
  const user = "owner-1"
  await replaceCatalog(user, [{
    session_id: "seed-1",
    payload: { id: "seed-1", role: "Seeded" },
    deleted_at: null,
    updated_at: "2026-11-01T00:00:00.000Z",
    revision: 4,
  }])
  const page = pageRows((await loadCatalog(user)).rows, "", 20)
  assert.equal(page.records[0].session.role, "Seeded")
  assert.equal(page.records[0].revision, 4)
})

test("the sessions route uses the free store when login is off and keeps the 60s poll", () => {
  const route = readFileSync(new URL("../../src/app/api/kompas/account-sessions/route.ts", import.meta.url), "utf8")
  const artifacts = readFileSync(new URL("../../src/app/api/kompas/account-artifacts/route.ts", import.meta.url), "utf8")
  const sync = readFileSync(new URL("../../public/kompas/account-sync.js", import.meta.url), "utf8")
  assert.match(route, /shouldUseFreeSessionStore\(\)/)
  assert.match(route, /getFromFreeStore/)
  assert.match(route, /postToFreeStore/)
  assert.match(route, /authDisabled: true/)
  assert.match(artifacts, /shouldUseFreeSessionStore\(\)/)
  assert.match(artifacts, /saveArtifact/)
  assert.match(sync, /const POLL_MS = 60_000;/)
  assert.match(sync, /data\.authDisabled === true/)
  assert.doesNotMatch(sync, /POLL_MS = (12_000|15000|15_000)/)
})

test("client still polls no faster than 60 seconds", () => {
  const sync = create({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetcher: async () => ({ ok: true, json: async () => ({ ok: true, userId: "u", records: [] }) }),
    read: () => [],
    write: () => {},
    render: () => {},
    notify: () => {},
  })
  assert.equal(sync.pollInterval, 60_000)
})
