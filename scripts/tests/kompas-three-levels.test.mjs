import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { questionRegister } from "../../src/lib/kompasAnswer.ts"
import { desktopQuestionKind, desktopResponsePolicy, levelMetrics, metricsApart } from "../../src/lib/kompasDesktopResponse.ts"
import { blendSpoken } from "../../src/lib/kompasBlend.ts"

const page = fs.readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const app = fs.readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("the desktop offers exactly three asking levels", () => {
  const live = page.slice(page.indexOf('id="liveInterviewer"'), page.indexOf("</select>", page.indexOf('id="liveInterviewer"')))
  assert.match(live, /Technical HR \+ Engineer/)
  assert.match(live, /Architect \+ Developer/)
  assert.match(live, />Director</)
  assert.doesNotMatch(live, /value="technical_hr"/)
  assert.doesNotMatch(live, /value="developer"/)
  assert.match(app, /three-level-v3/)
  assert.match(app, /regenerateForAudience\(\)/)
})

test("a definition stays abstract at every level", () => {
  const q = "Can you define an IDOR vulnerability, and what is that?"
  assert.equal(desktopQuestionKind(q), "definition")
  assert.equal(questionRegister(q, 2), "concept")
  for (const who of ["engineer", "architect", "director"]) {
    const policy = desktopResponsePolicy(who, q)
    assert.match(policy.guidance, /Do not add a personal incident/)
    assert.match(policy.guidance, /Splunk/)
    assert.ok(policy.words <= 120)
  }
  assert.equal(desktopQuestionKind("Compare IDOR versus CSRF"), "comparison")
})

test("a deep example is not answered like a definition", () => {
  const q = "Have you ever discovered a vulnerability? Give me a deep example."
  assert.equal(desktopQuestionKind(q), "experience")
  const engineer = desktopResponsePolicy("engineer", q)
  const architect = desktopResponsePolicy("architect", q)
  const director = desktopResponsePolicy("director", q)
  assert.match(engineer.guidance, /not a general recruiter/)
  assert.match(engineer.guidance, /bottleneck/)
  assert.match(architect.guidance, /bit by bit/)
  assert.match(director.guidance, /business/)
  assert.ok(architect.words > engineer.words)
})

test("an ordinary question does not become an investigation", () => {
  const policy = desktopResponsePolicy("engineer", "Can you talk about CSRF?")
  assert.equal(policy.kind, "general")
  assert.match(policy.guidance, /Do not pull logs/)
  assert.ok(policy.words <= 90)
})

test("the three levels differ on at least half of the spoken measures", () => {
  const engineer = levelMetrics("engineer")
  const architect = levelMetrics("architect")
  const director = levelMetrics("director")
  assert.ok(metricsApart(engineer, architect) >= 3)
  assert.ok(metricsApart(engineer, director) >= 3)
  assert.ok(metricsApart(architect, director) >= 3)
  assert.equal(engineer.relevance, architect.relevance)
  assert.equal(architect.relevance, director.relevance)
})

test("a printed answer says the symbol instead of leaving it as code", () => {
  assert.equal(blendSpoken("Keep it x-amp; and score >=9."), "Keep it and score at least 9.")
  assert.equal(blendSpoken("Use &amp; when the floor is &gt;=9."), "Use and when the floor is at least 9.")
})

test("switching level on the desktop does not wait on the anchor cache", () => {
  assert.match(app, /if \(desktopResponses\(\)\)/)
  assert.match(app, /c\.anchorFlight = ""/)
  assert.match(app, /answerCtl\.abort\(\)/)
})
