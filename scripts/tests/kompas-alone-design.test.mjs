// 10:08 AM CT: "Did you design it alone?" showed First, - on every bullet, plus generic third-person lines.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"

const QUESTION = "Did you design it alone?"
const KEPT = "No, I didn't design it alone I led the architecture while coordinating with network, security, vendor, and field-ops teams."
const OURS = "- We rejected a pure vendor-supplied blueprint because it would have locked us into a single carrier and limited the backup flexibility we needed for high-availability banking apps."
const GENERAL = "- In general, teams start by defining business and resiliency requirements, then draft the overall network topology, select appropriate edge devices, and size backup links."
const NEXT = "- Next they build tunnel profiles, configure routing policies, and set fail-over thresholds, validating each step in a lab and then in pilot branches."
const FINALLY = "- Finally they run automated fail-over tests, capture telemetry with monitoring tools, and sign off when the backup restores services within the defined recovery objectives, confirming the design met the required availability."
const HEARD = [KEPT, OURS, GENERAL, NEXT, FINALLY].join("\n")
const SHOWN = [
  "**Claim**",
  `- ${KEPT}`,
  "**Context**",
  `- First, ${OURS}`,
  `- First, ${GENERAL}`,
  `- First, ${NEXT}`,
  `- First, ${FINALLY}`,
].join("\n")

function leftBullets(card) {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const dom = new JSDOM("<ul id='answer'></ul>")
  const ctx = vm.createContext({ document: dom.window.document, window: {}, PAUSE_MARK: "(?:\\((?:pause|beat|breath)\\)|\\[(?:pause|beat|breath)\\])" })
  vm.runInContext(app.slice(app.indexOf("function unbracket"), app.indexOf("function renderCard")), ctx)
  return ctx.answerLines(card, QUESTION).filter((line) => line.kind === "bullet").map((line) => line.t)
}

test("Did you design it alone drops First, - and the generic third person", () => {
  const card = presentSpokenAnswer(QUESTION, HEARD)
  assert.doesNotMatch(card, /First, -/)
  assert.doesNotMatch(card, /In general, teams/)
  assert.doesNotMatch(card, /\bthey\b/i)
  assert.match(card, /I didn't design it alone/)
  assert.match(card, /field-ops teams/)
  assert.match(card, /vendor-supplied blueprint/)
  const bullets = leftBullets(card)
  assert.ok(bullets.length >= 2)
  for (const bullet of bullets) {
    assert.doesNotMatch(bullet, /^First, -/)
    assert.doesNotMatch(bullet, /^- /)
    assert.doesNotMatch(bullet, /In general, teams/)
    assert.doesNotMatch(bullet, /\bthey\b/i)
  }
  const repaired = leftBullets(presentSpokenAnswer(QUESTION, SHOWN))
  assert.ok(repaired.some((line) => /vendor-supplied blueprint/.test(line)))
  for (const bullet of repaired) {
    assert.doesNotMatch(bullet, /First, -/)
    assert.doesNotMatch(bullet, /In general, teams/)
    assert.doesNotMatch(bullet, /\bthey\b/i)
  }
})
