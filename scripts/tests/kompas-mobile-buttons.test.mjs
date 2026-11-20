import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const mobileCss = readFileSync(new URL("../../public/kompas/mobile-shell.css", import.meta.url), "utf8")
const manifest = JSON.parse(readFileSync(new URL("../../public/kompas/manifest.json", import.meta.url), "utf8"))

function mediaBlock(source, query) {
  const start = source.indexOf(query)
  assert.notEqual(start, -1, query)
  let i = source.indexOf("{", start)
  let depth = 0
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}") {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error("unclosed " + query)
}

test("narrow web puts Stop and AI Answer on one full 48px row", () => {
  assert.match(html, /id="startBtn"/)
  assert.match(html, /id="answerBtn"/)
  assert.match(html, /AI Answer/)
  const narrow = mediaBlock(css, "@media (max-width:900px)")
  const row = narrow.slice(narrow.indexOf("html:not(.kd) #view-copilot .overlay .bar-actions #startBtn"))
  assert.match(row, /#answerBtn/)
  assert.match(row, /flex:1 0 calc\(50% - 4px\)/)
  assert.match(row, /height:48px/)
  assert.match(row, /min-height:48px/)
  assert.match(row, /max-height:48px/)
  assert.match(row, /order:-1/)
  const bar = narrow.slice(narrow.indexOf("html:not(.kd) #view-copilot .overlay .bar-actions{"))
  assert.match(bar, /flex-wrap:wrap/)
})

test("desktop control rows stretch the full window and do not clip into the title bar", () => {
  const desktop = css.slice(0, css.indexOf("@media (max-width:900px)"))
  assert.match(desktop, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*width:100% !important/s)
  assert.match(desktop, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*justify-content:space-evenly !important/s)
  assert.doesNotMatch(desktop, /top:-48px !important/)
  assert.doesNotMatch(desktop, /right:200px !important/)
  const narrow = mediaBlock(css, "@media (max-width:900px)")
  assert.match(narrow, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*flex-wrap:wrap !important/s)
  assert.doesNotMatch(narrow, /html\.kd #view-copilot \.overlay \.bar-actions #startBtn/)
  assert.doesNotMatch(narrow, /html\.kd #view-copilot \.overlay \.bar-actions #answerBtn/)
})

test("phone copilot fills the dynamic viewport and respects safe areas", () => {
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/)
  assert.ok(html.indexOf("mobile-shell.css") > html.indexOf("answer-aside.css"), "phone overrides load after the legacy panel styles")
  assert.equal(manifest.display, "standalone")
  assert.match(mobileCss, /height:100vh;\s*height:100dvh;/)
  assert.match(mobileCss, /safe-area-inset-top/)
  assert.match(mobileCss, /safe-area-inset-bottom/)
  assert.match(mobileCss, /#view-copilot > \.overlay\s*\{[^}]*display:flex/s)
  assert.match(mobileCss, /#view-copilot \.content\s*\{[^}]*min-height:0[^}]*overflow-y:auto/s)
  assert.match(mobileCss, /#view-copilot #answer\s*\{[^}]*max-height:none[^}]*overflow-y:auto/s)
  assert.match(mobileCss, /touch-action:manipulation/)
  assert.match(mobileCss, /min-height:44px/)
  assert.match(mobileCss, /min-width:44px/)
  assert.match(mobileCss, /height:48px/)
})

test("phone shell leaves desktop-focus mode untouched and adapts landscape", () => {
  const selectors = mobileCss.split("}").filter(Boolean).join("}")
  assert.match(selectors, /html:not\(\.kd\)/)
  assert.doesNotMatch(selectors, /html\.kd/)
  assert.match(mobileCss, /@media \(max-width:760px\) and \(orientation:landscape\)/)
})
