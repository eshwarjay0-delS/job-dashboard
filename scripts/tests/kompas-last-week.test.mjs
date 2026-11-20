import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("last-week capture and card rules are in the page", () => {
  assert.match(app, /Start timed out\. No audio received\./)
  assert.match(app, /if \(captureStartedAt && !startedAt\) startClock\(\)/)
  assert.match(app, /if \(running \|\| starting\) return/)
  assert.match(app, /Leave this session\? Your answers stay saved\./)
  assert.match(app, /No question yet\. Nothing was heard\./)
  assert.match(app, /card\.spoken = typeof text === "string"/)
  assert.match(app, /spans\.length > 1/)
  const start = app.indexOf("function questionEnded(")
  const src = app.slice(start, app.indexOf("function paraphrasesOwn("))
  const ctx = vm.createContext({})
  vm.runInContext(src + "\nthis.ended = questionEnded;", ctx)
  assert.equal(ctx.ended("How would you investigate a phishing email and"), false)
  assert.equal(ctx.ended("How would you investigate a phishing email?"), true)
})
