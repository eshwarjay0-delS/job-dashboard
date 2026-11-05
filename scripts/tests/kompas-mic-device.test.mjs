// The microphone menu must ask for the chosen device, and a missing device must fall back to the default.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const page = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const start = app.indexOf("function micConstraints")
const end = app.indexOf("let micDeviceId")
const fn = app.slice(start, end)

test("a chosen microphone is requested exactly, and an empty choice stays the default", () => {
  const context = {}
  vm.runInNewContext(fn + "\nthis.micConstraints = micConstraints;", context)
  const plain = context.micConstraints("")
  assert.equal(plain.audio.deviceId, undefined)
  assert.equal(plain.audio.echoCancellation, true)
  assert.equal(plain.audio.channelCount, 1)
  assert.equal(context.micConstraints("built-in").audio.deviceId.exact, "built-in")
})

test("the live row has a microphone menu with a name", () => {
  assert.match(page, /<select id="micPick" aria-label="Microphone"/)
  assert.match(app, /getUserMedia\(micConstraints\(micDeviceId\)\)/)
  assert.match(app, /e\.name !== "NotFoundError" && e\.name !== "OverconstrainedError"/)
})
