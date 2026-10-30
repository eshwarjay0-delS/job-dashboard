import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  dissectQuestion, modesFiftyApart, modeBand, settleSpokenAnswer, draftSpokenAnswer,
  evaluateLiveAnswers, isProviderErrorAnswer, questionKeywords, relativeGap, wordCount,
} from "../../src/lib/kompasDissection.ts"
import { MASTER_PROMPT_VERSION, MASTER_PROMPT_TEXT } from "../../src/lib/kompasMasterPrompt.ts"
import { desktopResponsePolicy, levelMetrics, metricsApart } from "../../src/lib/kompasDesktopResponse.ts"

const SHAPES = ["intro", "personal-experience", "comparison", "scenario", "technical-deep-dive", "logistics", "follow-up", "closing", "definition", "direct", "acknowledgement", "value"]
const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")

test("master prompt v1 is the file the route sends", () => {
  const file = readFileSync(new URL("../../docs/kompas/MASTER_PROMPT_v1.md", import.meta.url), "utf8")
  assert.match(file, new RegExp(MASTER_PROMPT_VERSION))
  assert.match(MASTER_PROMPT_TEXT, /interviewer's real question/)
  assert.match(file, /interviewer's real question/)
  assert.match(file, /Changelog/)
})

test("every shape keeps the three modes at least 50% apart on length, depth, and confidence", () => {
  for (const shape of SHAPES) assert.equal(modesFiftyApart(shape), true, shape)
  const engineer = levelMetrics("engineer")
  const architect = levelMetrics("architect")
  const director = levelMetrics("director")
  for (const key of ["depth", "length", "confidence"]) {
    assert.ok(relativeGap(engineer[key], architect[key]) >= 0.5, key)
    assert.ok(relativeGap(engineer[key], director[key]) >= 0.5, key)
    assert.ok(relativeGap(architect[key], director[key]) >= 0.5, key)
  }
  assert.ok(metricsApart(engineer, architect) >= 3)
  assert.equal(engineer.relevance, director.relevance)
})

test("a definition is dissected into its own words and a ban list", () => {
  const cut = dissectQuestion("What does residual risk mean?", RESUME)
  assert.equal(cut.shape, "definition")
  assert.ok(cut.keywords.some((word) => /residual risk|residual/.test(word)))
  assert.ok(cut.banned.includes("Splunk"))
  assert.ok(cut.banned.includes("Kerberoasting"))
  assert.equal(cut.banned.includes("residual risk"), false)
})

test("a named tool in the question is not banned, and a deep dive may keep that family", () => {
  const named = dissectQuestion("How does Kerberos authentication work?", "")
  assert.equal(named.banned.includes("Kerberos"), false)
  assert.ok(named.banned.includes("Splunk"))
  const attack = dissectQuestion("Explain how Kerberoasting and DCSync differ technically.", "")
  assert.equal(attack.banned.includes("Kerberoasting"), false)
  assert.equal(attack.banned.includes("DCSync"), false)
})

test("provider error text is never an answer", () => {
  for (const sample of [
    "openrouter 429 try again in 2400ms",
    "The paid provider is temporarily rate limited.",
    "answer engine is at its limit right now",
  ]) {
    assert.equal(isProviderErrorAnswer(sample), true)
    const settled = settleSpokenAnswer("What does residual risk mean?", sample, "engineer", RESUME)
    assert.equal(settled.providerError, true)
    assert.equal(settled.text, "")
  }
  assert.equal(isProviderErrorAnswer("I would explain residual risk as what remains after the control."), false)
})

test("a long answer is trimmed to the mode ceiling and drops an unasked tool", () => {
  const junk = "Residual risk is what remains after the control. " + "Splunk hunts the rest of the story. ".repeat(40)
  const settled = settleSpokenAnswer("What does residual risk mean?", junk, "engineer", RESUME)
  assert.ok(settled.words <= modeBand("definition", "engineer").maxWords)
  assert.doesNotMatch(settled.text, /Splunk/)
  assert.match(settled.text, /residual risk/i)
})

test("drafts for different questions are not the same answer", () => {
  const questions = [
    "What does residual risk mean?",
    "What is the difference between a policy deviation and a policy exception?",
    "Tell me about a time you challenged a weak remediation plan.",
    "Are you able to work on site three days a week?",
  ]
  const drafts = questions.map((question) => draftSpokenAnswer(question, "engineer", RESUME))
  assert.equal(new Set(drafts).size, drafts.length)
  const rows = []
  for (const question of questions) {
    for (const level of ["engineer", "director", "architect"]) rows.push({ question, level, text: draftSpokenAnswer(question, level, RESUME) })
  }
  const judged = evaluateLiveAnswers(rows, RESUME)
  assert.equal(judged.ok, true, judged.failures.join("\n"))
})

test("desktop word targets follow the same mode ceilings", () => {
  assert.equal(desktopResponsePolicy("engineer", "What is CSRF?").words, modeBand("definition", "engineer").targetWords)
  assert.equal(desktopResponsePolicy("architect", "What is CSRF?").words, modeBand("definition", "architect").targetWords)
  assert.ok(desktopResponsePolicy("engineer", "What is CSRF?").words <= 100)
  assert.ok(desktopResponsePolicy("architect", "Compare IDOR versus CSRF").words <= 120)
  assert.ok(questionKeywords("What does residual risk mean?").length >= 1)
})

test("the page refuses to show a provider error as the spoken answer", () => {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  assert.match(app, /function providerLeak/)
  assert.match(app, /providerLeak\(t\)/)
  assert.match(app, /providerLeak\(text\)/)
})
