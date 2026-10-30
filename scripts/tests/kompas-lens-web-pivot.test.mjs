// Lens 3D/4D on the web page: the PIVOT line is empty while KOMPAS_DESKTOP_LENS is off and present when it is on.
import test from "node:test"
import assert from "node:assert/strict"
import { webPivotLine } from "../../src/lib/kompasDesktopResponse.ts"

test("web pivot is off by default", () => {
  delete process.env.KOMPAS_DESKTOP_LENS
  assert.equal(webPivotLine("How would you design PAM for a bank?", "architect"), "")
})
test("web pivot appears with the switch on", () => {
  process.env.KOMPAS_DESKTOP_LENS = "on"
  try { assert.match(webPivotLine("How would you design PAM for a bank?", "architect"), /\S/) } finally { delete process.env.KOMPAS_DESKTOP_LENS }
})
