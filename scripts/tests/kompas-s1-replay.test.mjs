// Taskmaster S1: tab preview must not cover the controls, Auto must fire all 3 tab questions in full, and candidate lines stay You.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const s1 = JSON.parse(readFileSync(new URL("../fixtures/s1-taskmaster-replay.json", import.meta.url), "utf8"))
const start = app.indexOf("function isGatedQuestion")
const end = app.indexOf("function liveInterviewer(")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\nthis.replay = replayS1; this.stub = answerIsStub;", ctx)

test("S1 tab preview is collapsed beside the answer and does not cover Start, AI Answer, or More", () => {
  assert.match(html, /id="tabPreview" class="tab-preview is-collapsed" hidden/)
  assert.match(html, /<main class="content">[\s\S]*id="card"[\s\S]*id="tabPreview"/)
  assert.match(html, /id="tabPreviewToggle"/)
  assert.match(css, /#tabPreview\.is-collapsed\{display:none !important/)
  assert.match(css, /position:relative/)
  assert.doesNotMatch(css, /#tabPreview\{[^}]*position:absolute/)
  assert.doesNotMatch(css, /#tabPreview\{[^}]*left:12px/)
  assert.doesNotMatch(css, /#tabPreview\{[^}]*width:400px/)
  assert.match(app, /setTabPreviewOpen\(false\)/)
})

test("S1 replay: three tab questions fire in full, and candidate speech is You", () => {
  const out = ctx.replay(s1.events)
  assert.equal(out.fires.length, 3)
  for (const fire of out.fires) {
    assert.equal(ctx.stub(fire.answer), false)
    assert.ok(fire.answer.split(/\s+/).length >= 12, fire.answer)
  }
  assert.match(out.fires[0].answer, /incident is an unplanned event/)
  assert.match(out.fires[1].question, /risk, a threat/)
  assert.match(out.fires[2].answer, /incident response plan/)
  const you = out.lines.filter((line) => line.who === "You").map((line) => line.text)
  assert.ok(you.some((text) => /explain the incident/.test(text)))
  assert.ok(you.some((text) => /contained the host/.test(text)))
  assert.equal(out.lines.filter((line) => /explain the incident|contained the host/.test(line.text) && line.who === "Them").length, 0)
})
