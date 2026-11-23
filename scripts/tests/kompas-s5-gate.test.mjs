// Parakeet S5 gate. Offline. Ten folds, identical each time.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { manualAnswerTarget, ANSWER_ANGLES } from "../../src/lib/kompasS5Press.ts"
import { classifyScreenText, screenCardBody, correctTerraform, screenFirstWordOk, SCREEN_FIRST_WORD_MS, SCREEN_FALLBACK_UNAVAILABLE, GWLB_FIX } from "../../src/lib/kompasS5Screen.ts"
import { applyHonestyGate, honestySource, HOUSTON_RESUME, scopeAnswer, wentWrongAnswer, bridgeTemplates } from "../../src/lib/kompasHonestyGate.ts"

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
    assert.equal(honestySource(resume), resume.trim() ? resume : HOUSTON_RESUME, row.id)
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

const NOUN_STOP = new Set("the and for with you your that this those these when where what which who how then from into over after before during not did was were are have has had will would can could should must may its our but all any one two new old keep write show also only plus team part call test path role tool name if".split(" "))

function properNouns(text) {
  const found = new Set()
  for (const match of String(text || "").matchAll(/\b[A-Z][A-Za-z0-9+#-]{1,}\b/g)) {
    const word = match[0]
    if (word.length < 2 || NOUN_STOP.has(word.toLowerCase())) continue
    found.add(word)
  }
  return [...found]
}

test("bridge templates use only nouns from the Houston resume file", () => {
  const source = HOUSTON_RESUME.toLowerCase()
  assert.equal(source.includes("mckesson"), false)
  assert.equal(source.includes("eshwarjay05"), true)
  assert.match(HOUSTON_RESUME, /Fortinet AWS Cloud Networking Engineer/)
  const missing = []
  for (const template of bridgeTemplates()) {
    assert.doesNotMatch(template, /McKesson|I led the ServiceNow/i)
    for (const noun of properNouns(template)) {
      if (!source.includes(noun.toLowerCase())) missing.push(noun)
    }
  }
  assert.deepEqual([...new Set(missing)], [])
})

test("a loaded session resume is the allow-list", () => {
  const loaded = "Senior ServiceNow Developer at Paypal.\nMigrated apps using Terraform and CloudFormation."
  const got = applyHonestyGate({
    question: "You led that migration yourself, right?",
    answer: "Yes, I personally led it at McKesson.",
    resume: loaded,
  })
  assert.match(got.text, /Terraform/)
  assert.doesNotMatch(got.text, /FortiGate|McKesson/)
})

test("the current resume stays authoritative and contact details never become spoken facts", () => {
  assert.equal(honestySource(saint), saint)
  assert.equal(honestySource(""), HOUSTON_RESUME)
  const got = applyHonestyGate({
    question: "Where did you study?",
    answer: "I studied at Saint Louis University and then I joined Cigna.",
    resume: saint,
  })
  assert.match(got.text, /Saint Louis University/)
  assert.doesNotMatch(got.text, /Cigna|Fortinet|McKesson|jayeshwar44/)
})

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


test("spoken evidence excludes email, URL and phone-only lines", () => {
  const resume = [
    "Candidate",
    "candidate@example.test",
    "https://example.test/profile",
    "+1 (555) 010-0123",
    "Supported project line: I configured SIEM alert routing and incident triage.",
  ].join("\n")
  const spoken = bridgeTemplates(resume).join("\n")
  assert.match(spoken, /SIEM alert routing/i)
  assert.doesNotMatch(spoken, /candidate@example\.test|https:\/\/example\.test|555/)
})
