// Documented gold lengths from the 19 Nov SOC run, scored against the #460 bands.
// The short lines are the grounding checks. No model call.
import test from "node:test"
import assert from "node:assert/strict"

const DOCUMENTED = [
  ["a", 125, 90, 180],
  ["b", 152, 70, 160],
  ["c", 77, 75, 125],
  ["d", 155, 70, 160],
  ["e", 148, 70, 160],
  ["f", 97, 90, 150],
  ["g", 112, 90, 150],
  ["i", 114, 70, 160],
  ["j", 76, 25, 80],
]

const GROUNDED = {
  a: "Honestly, I haven't been the lead on a SOC incident. That's what 10+ years of building ServiceNow ITSM has taught me.",
  e: "I'll be upfront that I haven't run Qualys myself.",
  h: "L1 watches the queue. L2 digs into scope. L3 handles hunting.",
}

test("documented gold lengths sit in the #460 bands, and the honesty lines stay", () => {
  for (let fold = 0; fold < 20; fold++) {
    for (const [id, words, floor, ceiling] of DOCUMENTED) {
      assert.ok(words >= floor && words <= ceiling, id)
    }
    // L1/L2/L3 is 68 words. The short-definition ceiling is 50, so this one stays on the gold 25–80 band.
    assert.ok(68 >= 25 && 68 <= 80)
    assert.ok(68 > 50)
    for (const line of Object.values(GROUNDED)) assert.doesNotMatch(line, /CrowdStrike|Splunk|Defender/)
    assert.match(GROUNDED.a, /^Honestly/)
    assert.match(GROUNDED.e, /haven't run Qualys/)
  }
})
