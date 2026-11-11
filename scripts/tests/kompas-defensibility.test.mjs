// Defensibility layer wired into the answer service: prompt block + report (never changes the answer text).
import test from "node:test"
import assert from "node:assert/strict"
const { defensibilityPrompt, defensibilityReport } = await import("../../src/lib/kompasDefensibility.ts")
const Q = "A vendor needs emergency access to production during a change freeze. Who approves it, and what's the first thing you do?"
test("the prompt carries the question's mandatory parts", () => {
  const p = defensibilityPrompt(Q)
  assert.match(p, /CHECKLIST/)
  assert.match(p, /approv|authority|first/i)
})
test("a dodge fails the report; an answer covering every part passes", () => {
  const bad = defensibilityReport(Q, "Vendor access is always a balance between security and business needs, and communication is key.")
  assert.equal(bad.pass, false)
  assert.ok(bad.checklist.missed.length >= 1)
  const good = defensibilityReport(Q, "The first thing I do is check the change ticket and confirm the vendor's named account, because an emergency request is exactly where people skip steps. The emergency change manager approves it, and the system owner signs the risk. At CVS I set the account to expire after four hours and the next morning I checked the access log to confirm the account was disabled.")
  assert.equal(good.pass, true, JSON.stringify(good))
})
