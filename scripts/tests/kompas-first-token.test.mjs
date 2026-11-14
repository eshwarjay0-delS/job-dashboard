// A silent answer must retry once after 8 seconds, then say so.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const preload = readFileSync(new URL("../../legacy/perfact/desktop/preload.js", import.meta.url), "utf8")
const start = app.indexOf("function firstTokenDecision")
const end = app.indexOf("async function generateAnswerRequest")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end), ctx)

test("no first token within 8 seconds retries once, then shows a status", () => {
  assert.equal(ctx.firstTokenDecision(1000, false, false), "wait")
  assert.equal(ctx.firstTokenDecision(8000, false, false), "retry")
  assert.equal(ctx.firstTokenDecision(8000, true, false), "keep")
  assert.equal(ctx.firstTokenDecision(9000, false, true), "status")
  assert.match(app, /No words yet\. Retrying once\./)
  assert.match(app, /Still no words\. Press AI Answer to try again\./)
  assert.match(app, /firstTokenRetry: true/)
})

test("lowering opacity fades the panels and strengthens the answer text", () => {
  assert.match(preload, /--answer-weight/)
  assert.match(preload, /--answer-shadow/)
  assert.match(app, /--answer-weight/)
  assert.match(css, /font-weight:var\(--answer-weight, 560\)/)
  assert.doesNotMatch(css, /max\(var\(--panel-a\),0\.94\)/)
  assert.match(css, /justify-content:space-evenly !important/)
  assert.match(css, /#tabPreview\{display:none !important/)
})
