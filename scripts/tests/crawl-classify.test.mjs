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


test("Right To Hire and Contract To Perm are explicit contract-to-hire aliases", () => {
  for (const value of ["Right To Hire", "Right to Hire", "right-to-hire", "Right‑to‑Hire", "Contract To Perm", "Contract-to-Perm", "Contract To Permanent"]) {
    assert.ok(contractTypes(value).includes("C2H"), value)
    assert.equal(classifyWorkType(value), "contract", value)
  }
})

test("negated right-to-hire and contract-to-perm labels do not create contract evidence", () => {
  for (const value of ["No Right To Hire", "Not Right To Hire", "Without Right To Hire", "No Contract To Perm", "No Contract To Hire", "No C2H"]) {
    assert.deepEqual(contractTypes(value), [], value)
    assert.equal(classifyWorkType(value), "unknown", value)
  }
})

test("contract administration and generic contract vocabulary are not employment evidence", () => {
  for (const value of [
    "Contract management and contract negotiations.",
    "Contract administrator responsible for contract review.",
    "Vendor contract compliance and contract lifecycle management.",
    "No contract position; direct hire.",
    "Not a contract role; permanent full-time."
  ]) {
    assert.deepEqual(contractTypes(value, "Full-time"), [], value)
  }
  assert.deepEqual(contractTypes("Contract position for six months."), ["Contract"])
  assert.deepEqual(contractTypes("W2 contract role."), ["W2"])
  assert.deepEqual(contractTypes("No contract position."), [])
})

test("structured engagement labels are recognized without relying on description wording", () => {
  assert.deepEqual(contractTypes("", "C2C"), ["C2C"])
  assert.deepEqual(contractTypes("", "1099"), ["1099"])
  assert.deepEqual(contractTypes("", "C2H"), ["C2H"])
  assert.deepEqual(contractTypes("", "Contract"), ["Contract"])
  assert.deepEqual(contractTypes("", "Temporary"), ["Temporary"])
  assert.deepEqual(contractTypes("W2", "W2"), [])
  assert.deepEqual(contractTypes("No W2; C2C only"), ["C2C"])
  assert.deepEqual(contractTypes("Without 1099; W2 contract"), ["W2"])
  assert.deepEqual(contractTypes("No temporary role"), [])
})

test("crawler passes structured engagement separately from title", () => {
  assert.equal(classifyWorkType("Full-time", "Contract Administrator"), "permanent")
  assert.equal(classifyWorkType("Full-time", "Contract role"), "contract")
  assert.equal(classifyWorkType("Full-time", "Right To Hire"), "contract")
  assert.equal(classifyWorkType("Full-time Contract", "Software Engineer"), "contract")
  assert.equal(classifyWorkType("No Contract", "Software Engineer"), "unknown")
})
