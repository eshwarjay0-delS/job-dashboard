import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const html = readFileSync("public/kompas/index.html", "utf8")
const app = readFileSync("public/kompas/app.js", "utf8")
const styles = readFileSync("public/kompas/styles.css", "utf8")

test("desktop live toolbar contains Screen Answer immediately next to AI Answer", () => {
  const answer = html.indexOf('id="answerBtn"')
  const screen = html.indexOf('id="screenCaptureAnswerBtn"')
  const auto = html.indexOf('id="autoBtn"')
  assert.ok(answer > 0 && screen > answer && auto > screen)
  assert.match(html, /id="screenCaptureAnswerBtn"[^>]*title="Caption Capture:[^"]*"/)
  assert.match(html, /▣ Caption Capture <b id="captionCaptureState">OFF<\/b>/)
})
test("screen capture is enabled in desktop even when computer audio is unsupported", () => {
  const audioBlock = app.slice(app.indexOf("const NO_SYS_AUDIO"), app.indexOf("function syncSrc()"))
  assert.match(audioBlock, /if \(NO_SYS_AUDIO\) \$\("sysBtn"\)\.classList\.add\("hidden"\)/)
  assert.doesNotMatch(audioBlock, /\$\("screenBtn"\)\.classList\.add\("hidden"\)/)
  assert.match(audioBlock, /if \(window\.kompasDesktop\) \{[\s\S]*?\$\("screenCaptureAnswerBtn"\)\?\.classList\.remove\("hidden"\)/)
})
test("visible button, menu and keyboard shortcut share the same capture flow", () => {
  assert.match(app, /\$\("screenBtn"\)\.onclick = analyseScreen/)
  assert.match(app, /\$\("screenCaptureAnswerBtn"\)\) \$\("screenCaptureAnswerBtn"\)\.onclick = \(\) =>/)
  assert.match(app, /captionBegin\(\)/)
  assert.match(app, /captionEnd\(\)/)
  assert.match(app, /e\.ctrlKey && e\.shiftKey && \(e\.key === "S" \|\| e\.key === "s"\)/)
  assert.match(app, /async function analyseScreen\(\)/)
  assert.doesNotMatch(app, /window\.KompasScreenReview\(\{/)
  assert.match(app, /generateAnswer\(pieces\[0\], card, \{ pinned: true, derived: pieces\[0\], source: "screen" \}\)/)
})
test("desktop-only styling does not expose the extra toolbar button in web mode", () => {
  assert.match(html, /class="pill action toggle hidden" id="screenCaptureAnswerBtn"/)
  assert.match(styles, /html\.kd #screenCaptureAnswerBtn\{display:inline-flex !important/)
})

test("native Windows screenshot bridge precedes browser display capture fallback", () => {
  const start = app.indexOf("async function grabFrame()")
  const native = app.indexOf("window.kompasDesktop?.captureScreen", start)
  const legacy = app.indexOf("navigator.mediaDevices.getDisplayMedia", start)
  assert.ok(start >= 0 && native > start && legacy > native,
    "The native desktop must capture a fresh screen frame instead of sharing the audio-loopback track")
  assert.match(app.slice(start, legacy), /return await window\.kompasDesktop\.captureScreen\(\)/)
})
