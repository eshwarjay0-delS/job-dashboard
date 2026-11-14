import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const html = readFileSync("public/kompas/index.html", "utf8")
const app = readFileSync("public/kompas/app.js", "utf8")
const styles = readFileSync("public/kompas/styles.css", "utf8")

test("desktop live toolbar keeps questions and answers, and does not show screen sharing", () => {
  const answer = html.indexOf('id="answerBtn"')
  const start = html.indexOf('id="startBtn"')
  const auto = html.indexOf('id="autoBtn"')
  assert.ok(start > 0 && answer > start && auto > answer)
  assert.match(html, /class="pill action hidden" id="screenCaptureAnswerBtn"/)
})
test("screen sharing stays hidden on the desktop window", () => {
  const audioBlock = app.slice(app.indexOf("const NO_SYS_AUDIO"), app.indexOf("function syncSrc()"))
  assert.match(audioBlock, /if \(NO_SYS_AUDIO\) \$\("sysBtn"\)\.classList\.add\("hidden"\)/)
  assert.match(audioBlock, /\$\("screenBtn"\)\?\.classList\.add\("hidden"\)/)
  assert.match(audioBlock, /\$\("screenCaptureAnswerBtn"\)\?\.classList\.add\("hidden"\)/)
  assert.doesNotMatch(audioBlock, /screenCaptureAnswerBtn"\)\?\.classList\.remove\("hidden"\)/)
})
test("visible button, menu and keyboard shortcut share the same capture flow", () => {
  assert.match(app, /\$\("screenBtn"\)\.onclick = analyseScreen/)
  const caption = readFileSync("public/kompas/caption-once.js", "utf8")
  assert.match(html, /caption-once\.js\?v=/)
  assert.match(caption, /button\.onclick = \(\) => \{ void capture\(\); \}/)
  assert.match(caption, /await aiAnswer\(false, \{ captionOnce: true \}\)/)
  assert.match(app, /e\.ctrlKey && e\.shiftKey && \(e\.key === "S" \|\| e\.key === "s"\)/)
  assert.match(app, /async function analyseScreen\(\)/)
  assert.doesNotMatch(app, /window\.KompasScreenReview\(\{/)
  assert.match(app, /generateAnswer\(first\.display, card, \{ pinned: true, derived: first\.answerQuestion, source: "screen", frameKind: first\.kind \}\)/)
})
test("desktop styling hides the screen-share button and the visible focus stays on the answer", () => {
  assert.match(html, /class="pill action hidden" id="screenCaptureAnswerBtn"/)
  assert.match(styles, /html\.kd #screenCaptureAnswerBtn,\s*html\.kd #screenBtn\{display:none !important/)
})

test("native Windows screenshot bridge precedes browser display capture fallback", () => {
  const start = app.indexOf("async function grabFrame()")
  const native = app.indexOf("window.kompasDesktop?.captureScreen", start)
  const legacy = app.indexOf("navigator.mediaDevices.getDisplayMedia", start)
  assert.ok(start >= 0 && native > start && legacy > native,
    "The native desktop must capture a fresh screen frame instead of sharing the audio-loopback track")
  assert.match(app.slice(start, legacy), /return await window\.kompasDesktop\.captureScreen\(\)/)
})
