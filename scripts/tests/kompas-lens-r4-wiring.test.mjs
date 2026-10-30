// Lens r4, service wiring commit only (drop this file with that commit). OFFLINE: reads the service source and git history.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"

// r7: the base is the AQ commit the lens stack sits on (parent of "Kompas lens r1"), not a pinned hash, so the test holds on any AQ base.
const ROOT = new URL("../..", import.meta.url).pathname
const BASE = execFileSync("git", ["log", "--format=%H", "--grep=^Kompas lens opener module", "-n", "1"], { cwd: ROOT, encoding: "utf8" }).trim() + "~1"
test("wiring: the service change is only the two slots, and with the switch off it rebuilds the AQ base's system line exactly", () => {
  const now = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const before = execFileSync("git", ["show", `${BASE}:src/lib/kompasAnswerService.ts`], { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" })
  const sys = (s) => s.split("\n").find((l) => l.includes("AUDIENCE DELIVERY"))
  const back = sys(now).replace('(desktopWire?.delivery || audienceGuidance(level, question)) + (webPivot ? " " + webPivot : "")', "desktopWire?.delivery || audienceGuidance(level, question)").replace("desktopWire?.delivery || audienceGuidance(level, question)", "desktopPolicy?.guidance || audienceGuidance(level, question)").replace("desktopWire?.tail || \"\"", "desktopPolicy?.guidance || \"\"")
  assert.equal(back, sys(before))
  // web pivot: webPivotLine() is "" while the switch is off (kompas-lens-web-pivot.test.mjs), so the added term adds nothing
  // off: desktopWire.delivery === desktopPolicy.guidance and desktopWire.tail === desktopPolicy.guidance (tests above), so the prompt is byte-identical
  assert.match(now, /const desktopWire = desktopPolicy \? desktopDelivery\(desktopPolicy, level, question\) : null/)
  // The budget measures the wiring commit itself (BASE..wiring), so later unrelated service fixes do not count against it.
  const WIRING = execFileSync("git", ["log", "--format=%H", "--grep=^Kompas lens desktop wiring", "-n", "1"], { cwd: ROOT, encoding: "utf8" }).trim()
  const changed = execFileSync("git", ["diff", "--numstat", BASE, WIRING, "--", "src/lib/kompasAnswerService.ts"], { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" }).trim().split(/\s+/)
  assert.ok(Number(changed[0]) <= 3 && Number(changed[1]) <= 2, `service diff +${changed[0]} -${changed[1]}`)
})

