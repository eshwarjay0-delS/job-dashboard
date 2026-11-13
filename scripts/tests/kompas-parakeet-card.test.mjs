// Parakeet-style card text and utterance rows. Offline. No live session.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { answerIsComplex, presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"
import { deriveQuestion, stitchUtterance, utteranceItem, utteranceTag, wordErrorRate } from "../../src/lib/kompasUtterance.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const REFERENCE = "What was the state of the system when you joined and what were your specific contributions?"
const FRAGMENTS = [
  "Um. You hit close to home and talked about performance and resilience.",
  "Uh, let's talk more about that. Uh.",
  "I want to understand what was your role going into the project you mentioned you.",
  "Uh, two months. Uh.",
  "Out from delivery. What was the state of the system when you joined and what did you specifically contribute to it?",
]

test("a simple definition stays one block with no section headings", () => {
  const q = "What is least privilege?"
  const a = "Least privilege means a person keeps only the access the job needs."
  assert.equal(answerIsComplex(q, a), false)
  assert.equal(presentSpokenAnswer(q, a), a)
  assert.doesNotMatch(presentSpokenAnswer(q, a), /\*\*/)
})

test("a complex contribution answer becomes headed bullets and a breath mark", () => {
  const q = "What was the state of the system when you joined and what were your specific contributions?"
  const a = "I joined two months before launch. Downstream calls were failing. I implemented queue-based staging and an object storage backup. I added a circuit breaker and request batching. The nightly path stopped dropping rows."
  assert.equal(answerIsComplex(q, a), true)
  const card = presentSpokenAnswer(q, a)
  assert.match(card, /\*\*Claim\*\*/)
  assert.match(card, /\*\*Context\*\*/)
  assert.match(card, /\*\*Action\*\*/)
  assert.match(card, /\*\*Close\*\*/)
  assert.match(card, /^-\s/m)
  assert.match(card, /^…$/m)
  assert.equal(presentSpokenAnswer(q, card), card)
})

test("the card renders a bold mini-heading and does not show the stars", () => {
  const dom = new JSDOM("<ul id='answer'></ul>")
  const ctx = vm.createContext({ document: dom.window.document, window: {}, PAUSE_MARK: "(?:\\((?:pause|beat|breath)\\)|\\[(?:pause|beat|breath)\\])" })
  vm.runInContext(app.slice(app.indexOf("function unbracket"), app.indexOf("function renderCard")), ctx)
  const lines = ctx.answerLines("**Context**\n- I joined two months before launch.\n…\n**Result**\n- The path stopped dropping rows.", "What were your contributions?")
  assert.equal(lines.some((line) => line.kind === "head" && line.t === "**Context**"), true)
  const ul = dom.window.document.getElementById("answer")
  for (const line of lines) {
    const li = dom.window.document.createElement("li")
    if (line.kind === "head") li.className = "minihead"
    ctx.inline(li, line.t)
    ul.append(li)
  }
  assert.equal(ul.querySelector(".minihead strong").textContent, "Context")
  assert.equal(ul.textContent.includes("**"), false)
})

test("the short anchor rows are still rendered apart from the section layout", () => {
  assert.match(app, /hasAnchorFields\(c\)/)
  assert.match(app, /row\("Stance:"/)
  assert.match(app, /if \(!hasAnchorFields\(c\)/)
})

test("fragments rewrite into the Parakeet question, and the raw join does not", () => {
  const before = FRAGMENTS.join(" ")
  const after = deriveQuestion(FRAGMENTS)
  const beforeRate = wordErrorRate(REFERENCE, before)
  const afterRate = wordErrorRate(REFERENCE, after)
  assert.ok(beforeRate > 0.5, String(beforeRate))
  assert.ok(afterRate < 0.05, `${afterRate} ${after}`)
  assert.equal(after, REFERENCE)
})

test("each utterance is its own tagged row, and a repeated tail is not said twice", () => {
  const gold = [
    ["Awesome.", "No question"],
    ["Oh, sure. Let's get started then.", "No question"],
    ["Projects that you've done in the past and then just talk about.", "Question detected"],
    ["Um. Pick any technical project that you've done.", "Question detected"],
    ["What was the state of the system when you joined?", "Question detected"],
  ]
  let hits = 0
  for (const [text, tag] of gold) {
    const item = utteranceItem("Them", text, Date.parse("2026-11-12T17:29:00Z"))
    assert.equal(item.speaker, "Interviewer")
    assert.equal(item.tag, tag)
    assert.equal(item.tag, utteranceTag(text))
    if (item.tag === tag) hits++
  }
  assert.equal(hits / gold.length, 1)
  const stitched = stitchUtterance("when you joined and what did you do", "what did you do next in the batch")
  assert.equal(stitched.part, "next in the batch")
})

test("the recorder slice is 200 ms and the last chunk is still flushed", () => {
  assert.match(app, /rec\.start\(200\)/)
  assert.match(app, /setTimeout\(flush, 80\)/)
  assert.match(app, /function stitchUtterance/)
  assert.match(app, /Question detected/)
})
