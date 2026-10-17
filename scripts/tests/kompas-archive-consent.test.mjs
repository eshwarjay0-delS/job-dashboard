import test from "node:test"
import assert from "node:assert/strict"
import { shouldArchiveSession } from "../../src/lib/kompasArchiveConsent.mjs"

test("requires explicit consent and server enablement", () => {
  assert.equal(shouldArchiveSession("s1", "granted", "1"), true)
  assert.equal(shouldArchiveSession("s1", "granted", undefined), false)
  assert.equal(shouldArchiveSession("s1", null, "1"), false)
  assert.equal(shouldArchiveSession("", "granted", "1"), false)
})

test("non affirmative consent fails closed", () => {
  for (const value of ["", "true", "yes", "GRANTED", "revoked", "denied", null]) {
    assert.equal(shouldArchiveSession("s1", value, "1"), false)
  }
})
