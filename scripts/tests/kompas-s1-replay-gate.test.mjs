import test from "node:test"
import assert from "node:assert/strict"
import { evaluate } from "../kompas-s1-replay-gate.mjs"

test("S1 replay: five questions, no small talk, You never merges, long answers, preview stays clear", () => {
  const result = evaluate()
  assert.equal(result.pass, true, result.failures.join("\n"))
  assert.equal(result.fires.filter((fire) => ["1", "2", "3", "4", "5"].includes(fire.qId)).length, 5)
})
