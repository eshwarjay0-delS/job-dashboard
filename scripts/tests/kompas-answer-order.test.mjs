// Fixed answer order and spoken-order question reconstruction. Offline only.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { presentSpokenAnswer, sectionOrder, SECTION_ORDER } from "../../src/lib/kompasAnswerPresentation.ts"
import { reconstructQuestion } from "../../src/lib/kompasUtterance.ts"
import { naturalNarrationGuidance } from "../../src/lib/kompasNaturalNarration.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const QUESTION = "What was the state of the system when you joined and what were your specific contributions?"
const DRAFT = "I joined two months before launch. Downstream calls were failing. I implemented queue-based staging and an object storage backup. I added a circuit breaker and request batching. The nightly path stopped dropping rows. I cut the open queue by 40 percent."
const RESUME = "Cut the open queue by 40 percent after the staging change."

test("the same answer is ordered the same way twice", () => {
  const once = presentSpokenAnswer(QUESTION, DRAFT, RESUME)
  const twice = presentSpokenAnswer(QUESTION, DRAFT, RESUME)
  assert.equal(once, twice)
  assert.deepEqual(sectionOrder(once), ["Claim", "Context", "Action", "Result", "Close"])
  assert.deepEqual(sectionOrder(once).filter((name) => SECTION_ORDER.includes(name)), sectionOrder(once))
})

test("the claim comes before the evidence, and a resume number lands in the result", () => {
  const card = presentSpokenAnswer(QUESTION, DRAFT, RESUME)
  const order = sectionOrder(card)
  assert.ok(order.indexOf("Claim") < order.indexOf("Context"))
  assert.ok(order.indexOf("Context") < order.indexOf("Action"))
  assert.ok(order.indexOf("Action") < order.indexOf("Result"))
  const result = card.split("**Result**")[1] || ""
  assert.match(result, /\b40\b/)
  assert.doesNotMatch(card.split("**Result**")[0], /\b40\b/)
  assert.match(card, /First, /)
  assert.match(card, /Then, /)
  assert.match(card, /The result: /)
})

test("a number the resume does not hold is not spoken", () => {
  const card = presentSpokenAnswer(QUESTION, "I joined the team. I cut the open queue by 90 percent.", RESUME)
  assert.doesNotMatch(card, /\b90\b/)
})

test("broken fragments keep the speaker's word order once the clock is restored", () => {
  const pieces = [
    { at: 30, text: "what did you specifically contribute to it?" },
    { at: 10, text: "What was the state of the system" },
    { at: 20, text: "when you joined and" },
  ]
  const question = reconstructQuestion(pieces)
  assert.equal(question, "What was the state of the system when you joined and what were your specific contributions?")
  assert.ok(question.indexOf("when you joined and") < question.indexOf("what were your specific contributions"))
  assert.equal(question.includes("state of the system when you joined"), true)
})

test("the teacher voice signposts First, Then, and The result", () => {
  const guidance = naturalNarrationGuidance("How would you explain the check?", "engineer")
  assert.match(guidance, /hook first/)
  assert.match(guidance, /one idea per sentence/)
  assert.match(guidance, /First, Then, and The result/)
})

test("the drawer keeps rows in clock order instead of folding a later sentence backward", () => {
  const dom = new JSDOM('<div id="drawerBody"><div class="muted small">Nothing heard yet.</div></div>')
  const ctx = vm.createContext({ document: dom.window.document, $: (id) => dom.window.document.getElementById(id), Date })
  vm.runInContext(app.slice(app.indexOf("const DRAWER_FILLER"), app.indexOf("function renderDrawer(")), ctx)
  const t0 = Date.parse("2026-11-12T17:29:00Z")
  ctx.appendDrawer("Them", "when you joined and", t0 + 2000)
  ctx.appendDrawer("Them", "What was the state of the system", t0)
  ctx.appendDrawer("Them", "what did you contribute?", t0 + 3000)
  const rows = [...dom.window.document.querySelectorAll("#drawerBody .tl span")].map((node) => node.textContent)
  assert.deepEqual(rows, ["What was the state of the system", "when you joined and", "what did you contribute?"])
})
