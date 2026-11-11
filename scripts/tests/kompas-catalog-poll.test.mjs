import test from "node:test"
import assert from "node:assert/strict"
import {
  catalogTag,
  rememberedCatalogTag,
  rememberCatalogTag,
  invalidateCatalogTag,
  resetCatalogTagMemo,
  isCatalogPollDisabled,
  checkCatalogPollCap,
  CATALOG_TAG_MEMO_TTL_MS,
  CATALOG_POLL_MAX_PER_WINDOW,
} from "../../src/lib/kompasCatalogPoll.ts"

test("catalogTag is stable for the same marks and changes when a revision moves", () => {
  const rows = [{ session_id: "a", revision: 1, updated_at: "t1", deleted_at: null }]
  assert.equal(catalogTag("u", rows), catalogTag("u", rows))
  assert.notEqual(catalogTag("u", rows), catalogTag("u", [{ ...rows[0], revision: 2 }]))
  assert.notEqual(catalogTag("u", rows), catalogTag("other", rows))
})

test("in-memory tag memo expires, and POST invalidation drops it immediately", () => {
  resetCatalogTagMemo()
  rememberCatalogTag("u", 'W/"ks-abc"', 1_000)
  assert.equal(rememberedCatalogTag("u", 1_000 + 10), 'W/"ks-abc"')
  assert.equal(rememberedCatalogTag("u", 1_000 + CATALOG_TAG_MEMO_TTL_MS + 1), null)
  rememberCatalogTag("u", 'W/"ks-abc"', 5_000)
  invalidateCatalogTag("u")
  assert.equal(rememberedCatalogTag("u", 5_000), null)
})

test("KOMPAS_POLL_DISABLED accepts the documented truthy values only", () => {
  assert.equal(isCatalogPollDisabled({}), false)
  assert.equal(isCatalogPollDisabled({ KOMPAS_POLL_DISABLED: "0" }), false)
  for (const v of ["1", "true", "YES", "on"]) {
    assert.equal(isCatalogPollDisabled({ KOMPAS_POLL_DISABLED: v }), true, v)
  }
})

test("conditional poll cap allows a short burst and then refuses", () => {
  const id = "cap-" + Math.random().toString(16).slice(2)
  for (let i = 0; i < CATALOG_POLL_MAX_PER_WINDOW; i++) {
    assert.equal(checkCatalogPollCap(id).ok, true, `call ${i} should pass`)
  }
  const blocked = checkCatalogPollCap(id)
  assert.equal(blocked.ok, false)
  assert.ok((blocked.retryAfterSec || 0) > 0)
})
