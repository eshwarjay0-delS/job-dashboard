// Fix 4: technical coherence validator.
import test from "node:test"
import assert from "node:assert/strict"
const { coherence, coherenceScore } = await import("../../src/lib/kompasCoherence.ts")
const codes = (a, n) => coherence(a, n).map((f) => f.code)
test("b02 pattern: PowerShell logs on a Linux sudo CVE is an OS mismatch", () => {
  assert.ok(codes("Qualys found CVE-2021-3156 in sudo on the Ubuntu jump hosts. I checked PowerShell logs for sudo execution patterns.").includes("os-mismatch"))
  assert.ok(!codes("Qualys found the sudo bug on the Ubuntu jump hosts. I checked the auth log and the package version after the patch.").includes("os-mismatch"))
})
test("a scanner can't show process telemetry", () => {
  assert.ok(codes("Qualys showed event 4688 process creation on the host.").includes("tool-capability"))
})
test("one blocked connection doesn't prove no exfiltration", () => {
  assert.ok(codes("The firewall blocked the C2 domain. We confirmed no exfiltration.").includes("detection-overreach"))
  assert.ok(!codes("We reviewed proxy and egress logs across every host for the window and saw no exfiltration, though the laptop image was still with forensics.").includes("detection-overreach"))
})
test("a fix needs a check that proves it", () => {
  assert.ok(codes("We patched the server and monitored it for a week.").includes("weak-verification"))
  assert.equal(codes("We patched the server and the rescan came back clean on the next morning.").length, 0)
  assert.equal(coherenceScore(coherence("We patched the server and the rescan came back clean.")), 100)
})
