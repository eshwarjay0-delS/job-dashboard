import assert from "node:assert/strict"
import test from "node:test"
import { classifyWorkType } from "../../src/lib/crawl/classify.ts"
import { contractTypes } from "../../src/lib/contract-jobs.ts"

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

test("owner-approved Contract To Perm and Right To Hire aliases map to C2H", () => {
  for (const value of [
    "Contract To Perm",
    "Contract-To-Perm",
    "Contract To Permanent",
    "Right To Hire",
    "Right-To-Hire",
    "Contract To Hire",
    "C2H",
  ]) {
    assert.ok(contractTypes(value).includes("C2H"), value)
    assert.equal(classifyWorkType(value), "contract", value)
  }
  assert.ok(contractTypes("Software Engineer", "Right To Hire").includes("C2H"))
})

test("explicitly negated C2H aliases remain unknown", () => {
  for (const value of [
    "No C2H",
    "Not C2H",
    "Without C2H",
    "No Contract To Perm",
    "Not Contract-To-Perm",
    "No Right To Hire",
    "Not a Right To Hire",
    "Without Right-To-Hire",
    "Never Contract To Permanent",
  ]) {
    assert.deepEqual(contractTypes(value), [], value)
    assert.equal(classifyWorkType(value), "unknown", value)
  }
  assert.deepEqual(contractTypes("Software Engineer", "No Contract To Perm"), [])
})

test("a negated C2H phrase does not leak into the generic Contract label", () => {
  assert.deepEqual(contractTypes("No Contract To Perm"), [])
  assert.deepEqual(contractTypes("No Right To Hire"), [])
  assert.deepEqual(contractTypes("No C2H"), [])
  assert.deepEqual(contractTypes("No Contract To Perm; C2C"), ["C2C"])
})

test("the C2H correction does not change unrelated contract labels", () => {
  assert.deepEqual(contractTypes("Contract"), ["Contract"])
  assert.deepEqual(contractTypes("W2 Contract"), ["W2"])
  assert.equal(contractTypes("Contract administration").includes("C2H"), false)
})
