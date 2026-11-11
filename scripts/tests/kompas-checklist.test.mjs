// Fix 1: question decomposition checklist (node --experimental-strip-types --test).
import test from "node:test"
import assert from "node:assert/strict"
const { decompose, validate, checklistPrompt } = await import("../../src/lib/kompasChecklist.ts")

const Q = "In an emergency change during a freeze, the application owner wants you to approve it without a change ticket. What do you do first, who has the authority, and how do you confirm it worked without inventing a metric?"
test("c096-style question decomposes into first action, authority, verification and the metric constraint", () => {
  const keys = decompose(Q).map((i) => i.key)
  for (const k of ["first-action", "authority", "verification", "no-invented-metric"]) assert.ok(keys.includes(k), k)
})
test("an answer that names no authority fails the checklist", () => {
  const a = "I tell the owner I won't approve it without a ticket, and I draft the emergency change request first. I confirm it worked by checking the change record shows the override and the service came back."
  const v = validate(Q, a)
  assert.equal(v.pass, false)
  assert.ok(v.missed.some((m) => m.key === "authority"))
})
test("an answer covering every part passes", () => {
  const a = "First, I draft the emergency change request myself, because nothing goes in without a record. The change manager and the emergency CAB have the authority to approve it, not me. I confirm it worked by re-running the failing transaction and checking the change record shows the override, so there is no number to invent."
  const v = validate(Q, a)
  assert.equal(v.pass, true, JSON.stringify(v.missed))
})
test("interruption constraints: 20 seconds is a word limit, pick one tool means one tool", () => {
  assert.equal(validate("Can you answer that in 20 seconds?", "word ".repeat(80)).pass, false)
  assert.equal(validate("You're using too many tools. Pick one.", "I'd use Splunk to correlate logons and Tanium for live queries.").pass, false)
  assert.equal(validate("You're using too many tools. Pick one.", "I'd use Splunk: logons from one account to many hosts in a short window are the signal.").pass, true)
})
test("no-jargon and mistake families", () => {
  assert.equal(validate("Explain that without technical terminology.", "An attacker asks the SIEM for TGS tickets with RC4 and cracks them.").pass, false)
  const m = validate("Tell me about a security decision you made that turned out to be wrong. How did you find out, and what did you change?", "I misjudged a vendor alert as noise at Citi. The rescan two days later showed the host was exposed, which is how I found out. Since then I check the asset owner before I close anything.")
  assert.equal(m.pass, true, JSON.stringify(m.missed))
})
test("prompt block lists every mandatory item", () => {
  const p = checklistPrompt(Q)
  assert.match(p, /CHECKLIST/)
  assert.match(p, /authority/)
})
