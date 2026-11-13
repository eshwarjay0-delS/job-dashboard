import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")

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

test("desktop and the desktop shell keep the existing control bar", () => {
  const desktop = css.slice(0, css.indexOf("@media (max-width:900px)"))
  assert.match(desktop, /#view-copilot \.overlay \.bar-actions\{[^}]*flex-wrap:nowrap/s)
  assert.match(desktop, /#view-copilot \.overlay \.bar-actions\{[^}]*height:48px/s)
  assert.match(desktop, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*top:-48px !important/s)
  assert.match(desktop, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*flex-wrap:nowrap !important/s)
  const narrow = mediaBlock(css, "@media (max-width:900px)")
  assert.match(narrow, /html\.kd #view-copilot \.overlay \.bar-actions\{[^}]*flex-wrap:wrap !important/s)
  assert.doesNotMatch(narrow, /html\.kd #view-copilot \.overlay \.bar-actions #startBtn/)
  assert.doesNotMatch(narrow, /html\.kd #view-copilot \.overlay \.bar-actions #answerBtn/)
})
