// Failure cases found by probing the gate (round 6). Each one slipped through before its fix.
import test from "node:test"
import assert from "node:assert/strict"
import { gateFigures, HOLE } from "../../src/lib/dossierBlueprint.ts"
const SRC = ["Approximately 70% of the role is reviewing control issues. Jan 2019 – June 2022."]

test("a range is a claim: one unsourced end blocks the whole range", () => {
  const g = gateFigures("Within 70-80% of cases.", SRC)
  assert.ok(g.text.includes(HOLE)); assert.ok(!/80%/.test(g.text))
  assert.equal(gateFigures("From 2019-2022.", SRC).blocked.length, 0)
})
test("full-width digits are normalised before the check", () => {
  const g = gateFigures("Cut by ４２%.", SRC)
  assert.ok(g.blocked.length >= 1); assert.ok(!/４２/.test(g.text))
})
test("spelled numbers as claims are holes; sourced or idiomatic words stay", () => {
  for (const t of ["I led twelve analysts.", "forty percent fewer escalations.", "I halved the backlog.", "Findings doubled after the change."]) {
    const g = gateFigures(t, SRC); assert.ok(g.text.includes(HOLE), t)
  }
  for (const t of ["one of the controls", "I'll give two examples.", "the first time"]) assert.equal(gateFigures(t, SRC).blocked.length, 0, t)
  assert.equal(gateFigures("twelve analysts", ["Led twelve analysts"]).blocked.length, 0)
})
