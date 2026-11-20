// Parakeet S5 gate. Offline. Ten folds, identical each time.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { manualAnswerTarget, ANSWER_ANGLES } from "../../src/lib/kompasS5Press.ts"
import { classifyScreenText, screenCardBody, correctTerraform, screenFirstWordOk, SCREEN_FIRST_WORD_MS, SCREEN_FALLBACK_UNAVAILABLE, GWLB_FIX } from "../../src/lib/kompasS5Screen.ts"
import { applyHonestyGate, honestySource, HOUSTON_RESUME, scopeAnswer, wentWrongAnswer } from "../../src/lib/kompasHonestyGate.ts"

const fx = JSON.parse(readFileSync(new URL("../fixtures/kompas-s5.json", import.meta.url), "utf8"))
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const saint = "jayeshwar44@gmail.com\nSaint Louis University\nCigna Healthcare — OT Security Analyst\n"

function resumeOf(name) {
  if (name === "saint") return saint
  if (name === "empty") return ""
  return HOUSTON_RESUME
}

function words(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

function runOnce() {
  const notes = []
  for (const row of fx.screen) {
    const body = screenCardBody(row.text)
    assert.equal(classifyScreenText(body), row.kind, row.id)
    assert.equal(body, row.text.replace(/\r\n/g, "\n").trim(), row.id)
    assert.ok(words(body) > 15, `${row.id} body was cut to a heading`)
    if (row.kind === "jd") assert.ok(body.includes("\n"), `${row.id} collapsed the job body`)
    if (row.kind === "code") {
      const fixed = correctTerraform("The snippet is wrong.", body)
      assert.match(fixed, /load_balancer_type = "gateway"/, row.id)
      assert.match(fixed, /protocol = "GENEVE"/, row.id)
      assert.match(fixed, /```hcl/, row.id)
      assert.ok(fixed.split("\n").length < 20, `${row.id} code block is not short`)
    }
    notes.push(row.id)
  }
  for (const row of fx.press) {
    const got = manualAnswerTarget({
      recent: row.recent,
      lastQuestion: row.lastQuestion,
      alreadyAnswered: row.alreadyAnswered,
      pass: row.pass || 0,
    })
    assert.doesNotMatch(got.question, /no new question/i, row.id)
    assert.equal(got.regenerate, row.regenerate, row.id)
    if (row.empty) assert.equal(got.question, "", row.id)
    if (row.includes) assert.match(got.question, new RegExp(row.includes, "i"), row.id)
    if (row.excludes) assert.doesNotMatch(got.question, new RegExp(row.excludes, "i"), row.id)
    if (row.regenerate) assert.ok(ANSWER_ANGLES.includes(got.angle), row.id)
    if (row.angleDiffersFromPass != null) {
      const other = manualAnswerTarget({ recent: row.recent, lastQuestion: row.lastQuestion, alreadyAnswered: true, pass: row.angleDiffersFromPass })
      assert.notEqual(got.angle, other.angle, row.id)
    }
    notes.push(row.id)
  }
  for (const row of fx.honesty) {
    const resume = resumeOf(row.resume)
    assert.equal(/jayeshwar44|saint louis university/i.test(honestySource(resume)), false, row.id)
    const got = applyHonestyGate({ question: row.question, answer: row.answer, resume })
    const again = applyHonestyGate({ question: row.question, answer: got.text, resume })
    assert.equal(again.text, got.text, `${row.id} not stable`)
    if (row.same) {
      assert.equal(got.rewritten, false, row.id)
      assert.equal(got.text, row.answer, row.id)
    } else {
      assert.equal(got.rewritten, true, row.id)
      for (const must of row.must || []) assert.match(got.text, new RegExp(must, "i"), row.id)
      for (const ban of row.mustNot || []) {
        const re = ban.startsWith("^") ? new RegExp(ban, "i") : new RegExp(ban, "i")
        assert.doesNotMatch(got.text, re, row.id)
      }
      if (row.band) {
        const n = words(got.text)
        assert.ok(n >= 120 && n <= 180, `${row.id} ${n} words`)
      }
    }
    notes.push(row.id)
  }
  assert.equal(words(scopeAnswer()) >= 120 && words(scopeAnswer()) <= 180, true)
  assert.equal(words(wentWrongAnswer()) >= 120 && words(wentWrongAnswer()) <= 180, true)
  assert.equal(screenFirstWordOk(1600), true)
  assert.equal(screenFirstWordOk(SCREEN_FIRST_WORD_MS), false)
  assert.equal(screenFirstWordOk(2400), false)
  assert.equal(SCREEN_FALLBACK_UNAVAILABLE.includes("\n"), false)
  assert.match(GWLB_FIX, /gateway/)
  return notes.join("|")
}

test("S5 fixtures, 10 folds, same result each time", () => {
  assert.ok(fx.screen.length >= 10)
  assert.ok(fx.press.length >= 10)
  assert.ok(fx.honesty.length >= 10)
  const first = runOnce()
  for (let fold = 1; fold < 10; fold++) assert.equal(runOnce(), first, `fold ${fold}`)
})

test("the page grabs the shared tab and does not ask for a new share", () => {
  assert.match(html, /id="screenAnalyzeBtn"/)
  assert.match(app, /Ctrl\+Shift\+Enter|e\.ctrlKey && e\.shiftKey && e\.key === "Enter"/)
  const start = app.indexOf("async function analyzeSharedTab()")
  const end = app.indexOf("async function ensureScreenReview()")
  const fn = app.slice(start, end)
  assert.ok(start > 0 && end > start)
  assert.doesNotMatch(fn, /getDisplayMedia/)
  assert.doesNotMatch(fn, /tabPreview/)
  assert.match(fn, /screenImage/)
  assert.match(fn, /generateAnswer\(/)
  assert.doesNotMatch(app, /status\("Listening, no new question yet/)
  assert.doesNotMatch(app, /status\("No new question yet/)
  assert.match(app, /function manualAnswerTarget/)
})
