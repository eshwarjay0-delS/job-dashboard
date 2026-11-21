// Abort, empty stream, then one retry and a cheap-model fallback. The pane is never left blank.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const aside = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const start = app.indexOf("function answerFinishPlan")
const end = app.indexOf("function labelFromHeard")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\nthis.plan = answerFinishPlan;", ctx)

test("an abort or empty answer retries once, then a faster model, and never stops blank", () => {
  for (let i = 0; i < 20; i++) {
    const code = i % 2 === 0 ? "ABORT" : "EMPTY"
    const first = ctx.plan({ code, hasText: false, pass: 0, aborted: true })
    assert.equal(first.action, "retry")
    assert.equal(first.fallback, false)
    const second = ctx.plan({ code, hasText: false, pass: 1, aborted: true })
    assert.equal(second.action, "retry")
    assert.equal(second.fallback, true)
    const done = ctx.plan({ code, hasText: false, pass: 2, aborted: true })
    assert.equal(done.action, "stop")
    assert.ok(done.text && done.text.split(/\s+/).length >= 4)
    assert.doesNotMatch(done.text, /^…$/)
    assert.doesNotMatch(done.text, /sign in/i)
  }
  const signedOut = ctx.plan({ code: "OPENROUTER_AUTH", hasText: false, pass: 0, aborted: false })
  assert.equal(signedOut.action, "retry")
  assert.equal(signedOut.text, "")
  const configured = ctx.plan({ code: "OPENROUTER_NOT_CONFIGURED", hasText: false, pass: 2, aborted: false })
  assert.equal(configured.action, "stop")
  assert.doesNotMatch(configured.text, /sign in/i)
  assert.doesNotMatch(app, /Sign in again, then press AI Answer/)
  assert.match(app, /fallbackModel: !!plan\.fallback/)
  assert.match(app, /function labelFromHeard/)
  assert.match(service, /async function cheapGroqAnswer/)
  assert.match(service, /const CHEAP_MODEL = "google\/gemini-2\.5-flash"/)
  assert.match(service, /if \(body\.preflight === true\) \{\n\s*\/\/ Do not call a model here/)
  assert.match(css, /background:#fdfcf9 !important/)
  assert.match(css, /html\.kd \.kd-right\{[\s\S]*right:0 !important/)
  assert.match(aside, /id = "asideClose"/)
  assert.match(aside, /bridgeDismissed = !open/)
})

test("a heard interviewer line replaces the Intro label", () => {
  const endLabel = app.indexOf("async function generateAnswerRequest(")
  const labelStart = app.indexOf("function labelFromHeard")
  const box = vm.createContext({})
  vm.runInContext(app.slice(labelStart, endLabel) + "\nthis.label = labelFromHeard;", box)
  const heard = "INTERVIEWER the infrastructure digital certificates is basically all about authentication and trust."
  assert.match(box.label("Your introduction", heard), /digital certificates/i)
  assert.equal(box.label("How do you rotate keys?", heard), "How do you rotate keys?")
})
