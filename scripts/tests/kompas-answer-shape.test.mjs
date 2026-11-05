// Fixed questions and a fixed sample answer. No model call.
// A definition stays shorter than a story, and story labels never reach the card.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { classify, lengthPlan } from "../../src/lib/kompasAnswer.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const start = app.indexOf("function spokenShape")
const end = app.indexOf("function sayAloud")
const context = {}
vm.runInNewContext(app.slice(start, end) + "\nthis.spokenShape = spokenShape;", context)

const SAMPLE = [
  "## Where I've done this",
  "**Situation:** The Dallas SIEM went quiet.",
  "**Task:** I had to prove the gap.",
  "**Action:** I checked the collector.",
  "**Result:** The alerts came back.",
  "I would start with the collector.",
].join("\n")

test("a definition is shorter than a story, and both answer the question they were given", () => {
  const definition = "What is a SIEM?"
  const story = "Tell me about a time you handled a SIEM outage."
  const defPlan = lengthPlan(classify(definition).tier, definition, "engineer")
  const storyPlan = lengthPlan(classify(story).tier, story, "engineer")
  assert.ok(defPlan.words < storyPlan.words, defPlan.words + " vs " + storyPlan.words)
  assert.ok(defPlan.words <= 180)
  assert.equal(classify(story).tier, 1)
})

test("a sample answer loses its story labels and its side heading", () => {
  const spoken = context.spokenShape(SAMPLE)
  assert.doesNotMatch(spoken, /situation\s*:/i)
  assert.doesNotMatch(spoken, /task\s*:/i)
  assert.doesNotMatch(spoken, /action\s*:/i)
  assert.doesNotMatch(spoken, /result\s*:/i)
  assert.doesNotMatch(spoken, /^#{1,6}\s/m)
  assert.match(spoken, /I would start with the collector/)
  assert.match(spoken, /Dallas SIEM went quiet/)
})

test("the live card does not print a timing line or a reconnecting status", () => {
  assert.equal(app.includes('status("Reconnecting.'), false)
  assert.equal(app.includes("Answer request timed out"), false)
  assert.equal(app.includes('meta = "⚡'), false)
  assert.match(app, /function spokenShape/)
})
