import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import outputAudio from "../../public/kompas/output-audio.js"

const require = createRequire(import.meta.url)
const loopback = require("../../legacy/perfact/desktop/output-loopback.cjs")
const { chooseCaptureSource } = require("../../legacy/perfact/desktop/capture-source.cjs")
const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const captions = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
const page = readFileSync(new URL("../../public/kompas/caption-once.js", import.meta.url), "utf8")

test("loopback follows the default output device and never pins Realtek or any other name", () => {
  assert.deepEqual(loopback.loopbackCapture(), { audio: "loopback", pinnedDevice: "" })
  assert.equal(loopback.loopbackCapture().pinnedDevice, "")
  assert.match(main, /loopbackCapture\(\)/)
  assert.match(main, /audio: "loopback"/)
  assert.doesNotMatch(loopback.loopbackCapture().audio, /Realtek|Headphones|deviceId/)
  assert.equal(outputAudio.THEM_RECORD_GAIN, loopback.THEM_RECORD_GAIN)
})

test("a change from Realtek to another output device reopens loopback; the first reading does not", () => {
  const realtek = [{ kind: "audiooutput", deviceId: "default", label: "Speakers (Realtek(R) Audio)" }]
  const headphones = [{ kind: "audiooutput", deviceId: "default", label: "Headphones" }]
  const keyA = outputAudio.defaultOutputKey(realtek)
  const keyB = outputAudio.defaultOutputKey(headphones)
  assert.equal(keyA, "Speakers (Realtek(R) Audio)")
  assert.equal(outputAudio.shouldFollowOutputDevice("", keyA), false)
  assert.equal(outputAudio.shouldFollowOutputDevice(keyA, keyA), false)
  assert.equal(outputAudio.shouldFollowOutputDevice(keyA, keyB), true)
  assert.equal(loopback.shouldFollowOutputDevice(keyA, keyB), true)
  assert.match(app, /addEventListener\("devicechange"/)
  assert.match(app, /shouldFollowOutputDevice/)
  assert.match(app, /if \(!follow \|\| !running \|\| !srcOn\.sys \|\| !window\.kompasDesktop\) return/)
})

test("computer audio is recorded louder than unity and the microphone is left at unity", () => {
  assert.equal(outputAudio.recordGainFor("Them"), 2.5)
  assert.equal(outputAudio.recordGainFor("You"), 1)
  assert.match(app, /function boostedLoopbackStream/)
  assert.match(app, /cap\.stream = recordStream/)
  assert.match(app, /echoCancellation: false/)
  assert.match(app, /echoCancellation: true/)
})

test("the caption source stays the Windows Live Captions window", () => {
  const caption = { id: "window:1:0", name: "Windows Live Captions", kind: "window" }
  const screen = { id: "screen:0:0", name: "Screen 1", kind: "screen", display_id: "1" }
  const picked = chooseCaptureSource([screen, caption], { primaryDisplayId: "1" })
  assert.equal(picked.kind, "caption")
  assert.match(captions, /if \(matched\.length !== 1\)/)
  assert.match(captions, /isWindowsLiveCaption/)
  assert.doesNotMatch(page, /audio: "loopback"/)
})
