// A long session keeps its words. The question cut stays small and local.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { selectAnswerContext } from "../../src/lib/kompasLongContext.ts"

const ASK = "What was the state of the system when you joined and what were your specific contributions?"

function fixture(words) {
  const lines = []
  let left = words
  let n = 0
  while (left > 0) {
    const sentence = `The batch finished pass ${n} and the owner kept the old path in place for the review.`
    const count = sentence.split(/\s+/).length
    lines.push({ who: n % 7 === 0 ? "You" : "Them", text: sentence, at: n })
    left -= count
    n++
  }
  lines.push({ who: "Them", text: "The service had been failing overnight.", at: n })
  lines.push({ who: "Them", text: ASK, at: n + 1 })
  return lines
}

test("ten thousand words resolve to the latest ask in under a second", () => {
  const lines = fixture(10000)
  const started = performance.now()
  const picked = selectAnswerContext(lines)
  const ms = performance.now() - started
  assert.equal(picked.question, ASK)
  assert.match(picked.passages, /failing overnight/)
  assert.ok(picked.words < 200, String(picked.words))
  assert.ok(ms < 1000, String(ms))
  console.log(`long-context ${picked.words} words in ${ms.toFixed(1)} ms`)
})

test("the live page keeps a 10k-word transcript and sends the cut, not the whole", () => {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  assert.match(app, /words < 12000/)
  assert.match(app, /function selectAnswerContext/)
  assert.match(app, /selectAnswerContext\(transcript\)\.passages/)
})
