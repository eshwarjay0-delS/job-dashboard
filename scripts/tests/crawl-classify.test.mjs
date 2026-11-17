import assert from "node:assert/strict"
import test from "node:test"
import { classifyWorkType } from "../../src/lib/crawl/classify.ts"
import { contractTypes } from "../../src/lib/contract-jobs.ts"
import { kindOf } from "../../src/lib/crawl/portals/pyramid.ts"

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

 
test("unapproved Right To Hire stays an unclassified source label, not C2H", () => {
  assert.deepEqual(contractTypes("Right To Hire"), [])
  assert.equal(classifyWorkType("Right To Hire"), "unknown")
  const engagement = kindOf("Right to hire opportunity")
  assert.equal(engagement, "Right To Hire")
  assert.equal(classifyWorkType(engagement ?? ""), "unknown")
})

test("Contract To Perm and Contract To Permanent are generic Contract, not C2H", () => {
  assert.deepEqual(contractTypes("Contract To Perm"), ["Contract"])
  assert.deepEqual(contractTypes("Contract To Permanent"), ["Contract"])
  assert.equal(classifyWorkType("Contract To Perm"), "contract")
  assert.equal(classifyWorkType("Contract To Permanent"), "contract")
})

test("approved explicit C2H and Contract-to-hire labels remain recognized", () => {
  assert.deepEqual(contractTypes("C2H"), ["C2H"])
  assert.deepEqual(contractTypes("Contract-to-hire"), ["C2H"])
  assert.equal(classifyWorkType("C2H"), "contract")
  assert.equal(classifyWorkType("Contract-to-hire"), "contract")
  assert.equal(kindOf("Contract-to-hire opportunity"), "Contract to Hire")
})
