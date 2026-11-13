// Fix 8: new question families carry checklists that fix 1 enforces.
import test from "node:test"
import assert from "node:assert/strict"
const { FAMILY_QUESTIONS, FAMILIES } = await import("../../src/lib/kompasQuestionFamilies.ts")
const { decompose, validate } = await import("../../src/lib/kompasChecklist.ts")
test("42 questions across the six families, each with at least one mandatory part", () => {
  assert.equal(FAMILY_QUESTIONS.length, 42)
  assert.deepEqual([...new Set(FAMILY_QUESTIONS.map((q) => q.family))].sort(), [...FAMILIES].sort())
  for (const q of FAMILY_QUESTIONS) {
    assert.ok(decompose(q.question, q.checklist).length >= 1, `${q.id} has no mandatory parts`)
    for (const c of q.checklist) assert.doesNotThrow(() => new RegExp(c.re, "i"), `${q.id}:${c.key}`)
    assert.ok(decompose(q.question, q.checklist).length >= q.checklist.length, q.id)
  }
})
test("one holdout per family; live interruptions carry the earlier turn", () => {
  assert.equal(FAMILY_QUESTIONS.filter((q) => q.holdout).length, 6)
  for (const q of FAMILY_QUESTIONS.filter((q) => q.family === "interruption")) assert.ok(q.prev && q.prev.q && q.prev.a, q.id)
})
test("an answer that dodges the family checklist fails validation", () => {
  const q = FAMILY_QUESTIONS.find((x) => x.id === "m001")
  const dodge = validate(q.question, "At Citi I handled a lot of vulnerability work and kept stakeholders informed.", { bank: q.checklist })
  assert.equal(dodge.pass, false)
  const ok = validate(q.question, "At Citi I marked a finding as a false positive and I was wrong. I found out when the rescan came back with the same CVE on a second host. Since then I verify the package version myself before I close anything.", { bank: q.checklist })
  assert.equal(ok.pass, true, ok.missed.map((m) => m.text).join(" | "))
})
