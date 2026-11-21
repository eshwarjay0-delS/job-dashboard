import assert from "node:assert/strict"
import test from "node:test"
import { classifyWorkType } from "../../src/lib/crawl/classify.ts"

test("crawler recognizes every explicit contract shape supported by Apply", () => {
  for (const value of [
    "C2H",
    "C2C",
    "1099",
    "Temporary",
    "Temp-to-hire",
    "Contract-to-hire",
    "W2 Contract",
  ]) {
    assert.equal(classifyWorkType(value), "contract", value)
  }
})

test("W2 payroll alone and generic temp substrings do not establish contract work", () => {
  for (const value of ["W2", "Template Engineer", "Attempted deployment"]) {
    assert.equal(classifyWorkType(value), "unknown", value)
  }
})

test("permanent work remains distinct and explicit contract evidence wins", () => {
  assert.equal(classifyWorkType("Full-time"), "permanent")
  assert.equal(classifyWorkType("Direct Hire"), "permanent")
  assert.equal(classifyWorkType("Full-time Contract"), "contract")
})


test("explicit negations remain unknown instead of becoming contract or permanent work", () => {
  for (const value of ["No C2H", "Not contract", "Without C2C", "1099 not accepted", "Not permanent"]) {
    assert.equal(classifyWorkType(value), "unknown", value)
  }
  assert.equal(classifyWorkType("Right To Hire"), "unknown")
  assert.equal(classifyWorkType("Contract To Perm"), "contract")
})
