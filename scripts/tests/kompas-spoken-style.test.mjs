// Fix 5: spoken style + decision reasoning.
import test from "node:test"
import assert from "node:assert/strict"
const { styleFindings, reasoning, needsReasoning } = await import("../../src/lib/kompasSpokenStyle.ts")
const codes = (a) => styleFindings(a).map((f) => f.code)
test("slogan closers from the round-35 review are hard failures", () => {
  assert.ok(codes("We kept going. Accepting short-term risk if it's time-boxed and visible.").includes("slogan"))
  assert.ok(codes("The compromise held until the next cycle.").includes("slogan"))
})
test("theatrical dialogue: two quotes or one long quote", () => {
  assert.ok(codes('I said, "Look, if this is ransomware, we lose recovery time." He said, "Not before the release, the board is watching."').includes("theatrical-quotes"))
  assert.equal(codes("I explained that skipping isolation meant losing the audit trail.").length, 0)
})
test("the tool as protagonist of the opening sentence", () => {
  assert.ok(codes("Qualys VMDR flagged a zero-day in a live Windows Server hosting citizen permits.").includes("tool-protagonist"))
  assert.ok(!codes("The hard part was a live permitting server the release team wouldn't take down; I used the Qualys results to show it was exposed.").includes("tool-protagonist"))
})
test("reasoning chain counts the seven elements", () => {
  const r = reasoning("The scan showed the server was still exposed, which meant the exception wasn't protecting anything. Instead of blocking the release, I proposed a firewall rule because the patch broke the vendor app. The trade-off was slower access for the vendor. The CISO signed the exception, and the patch itself was still open at handover.")
  assert.equal(r.n, 7, r.missing.join(","))
  assert.ok(reasoning("I patched it.").n < 2)
  assert.equal(needsReasoning("What is a SIEM?"), false)
})
