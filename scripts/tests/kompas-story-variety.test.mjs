// Fix 6: story variety.
import test from "node:test"
import assert from "node:assert/strict"
const { screenplay, pickOutcome, sessionScreenplayPenalty, OUTCOMES } = await import("../../src/lib/kompasStoryVariety.ts")
const FORMULA = "Qualys flagged a critical bug. The release manager pushed back. I escalated to the CISO, who approved a 72-hour exception, and we added daily monitoring."
test("the reusable screenplay is detected; an off-script outcome is not", () => {
  assert.equal(screenplay(FORMULA).formula, true)
  assert.equal(screenplay(FORMULA + " Looking back, I was wrong about the severity.").formula, false)
})
test("outcomes rotate and mistake questions get wrong-call", () => {
  assert.equal(pickOutcome("Tell me about a mistake you made", "m1"), "wrong-call")
  const used = {}
  const seen = new Set()
  for (let i = 0; i < 6; i++) { const o = pickOutcome("Tell me about a conflict", "q" + i, used); used[o] = (used[o] || 0) + 1; seen.add(o) }
  assert.equal(seen.size, Object.keys(OUTCOMES).length)
})
test("session penalty starts at the third formula answer", () => {
  assert.deepEqual(sessionScreenplayPenalty([FORMULA, "I patched it.", FORMULA, FORMULA]), [0, 0, 0, 1])
})
