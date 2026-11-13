// Question type sets the length. The mode sets the stance.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dissectQuestion, draftSpokenAnswer, lengthKind, QUESTION_LENGTH, wordCount } from "../../src/lib/kompasDissection.ts"
import { focusPrompt, interviewIntent } from "../../src/lib/kompasRelevance.ts"
import { blendSpoken } from "../../src/lib/kompasBlend.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const LEVELS = ["engineer", "director", "architect"]

test("a design ask is design, before a scenario or a deep dive", () => {
  for (const q of [
    "How would you design a rollback without downtime?",
    "Design a rate limiter for the public API.",
    "Design me a tenant isolation approach for the cache.",
  ]) {
    assert.equal(interviewIntent(q), "design", q)
    const cut = dissectQuestion(q)
    assert.equal(cut.shape, "design", q)
    assert.equal(lengthKind(q, cut.shape), "design-first", q)
    assert.equal(cut.modes.engineer.maxWords, 160)
    assert.equal(cut.modes.director.maxWords, 120)
    assert.equal(cut.modes.architect.maxWords, 200)
    assert.ok(cut.modes.director.aimWords < cut.modes.engineer.aimWords)
  }
  assert.equal(interviewIntent("How would you investigate a privileged access exception?"), "scenario")
  assert.notEqual(interviewIntent("In that design, audit evidence disagrees with live configuration."), "design")
})

test("go deeper on a named layer is the later design stage", () => {
  const q = "Go deeper on the storage layer."
  const cut = dissectQuestion(q)
  assert.equal(lengthKind(q, cut.shape), "design-later")
  assert.equal(cut.modes.engineer.maxWords, 180)
  assert.equal(cut.modes.director.maxWords, 100)
  assert.equal(cut.modes.architect.maxWords, 220)
  assert.ok(cut.modes.architect.maxWords <= 300)
})

test("the length table is aim then ceiling, and a follow-up is shorter than an opener", () => {
  assert.deepEqual(QUESTION_LENGTH.definition.director, { aim: 30, ceiling: 50 })
  assert.deepEqual(QUESTION_LENGTH.star.architect, { aim: 200, ceiling: 300 })
  assert.deepEqual(QUESTION_LENGTH["yes-no"].engineer, { aim: 20, ceiling: 40 })
  for (const level of LEVELS) {
    assert.ok(QUESTION_LENGTH["follow-up"][level].aim < QUESTION_LENGTH.opener[level].aim, level)
    assert.ok(QUESTION_LENGTH["follow-up"][level].ceiling < QUESTION_LENGTH.opener[level].ceiling, level)
    assert.ok(QUESTION_LENGTH["design-first"][level].ceiling <= 300)
  }
  const opener = "Tell me about yourself."
  const follow = "How did you verify that?"
  for (const level of LEVELS) {
    assert.ok(wordCount(draftSpokenAnswer(follow, level, RESUME)) < wordCount(draftSpokenAnswer(opener, level, RESUME)), level)
  }
})

test("a multi-part ceiling scales and still stops at 300", () => {
  const many = dissectQuestion("Design multi-cloud controls mapped to NIST 800-53. Explain trust boundaries, data flow, failure isolation, rollout and validation.")
  const one = dissectQuestion("Design multi-cloud controls.")
  assert.ok(many.modes.architect.maxWords > one.modes.architect.maxWords)
  assert.ok(many.modes.architect.maxWords <= 300)
  assert.equal(one.modes.architect.maxWords, 200)
})

test("the prompt no longer gives a second word quota", () => {
  const prompt = focusPrompt("Design a rate limiter for the public API.", 2, "director")
  assert.equal(prompt.includes("Spoken length guide:"), false)
  assert.match(prompt, /Spoken length follows the question type first, then the mode band/)
  assert.match(prompt, /A design-me-X answer is one stage, then a checkpoint, not the entire system/)
  assert.match(prompt, /A follow-up is shorter than the opener/)
})

test("a design draft keeps one named checkpoint and does not fill a second mode with padding", () => {
  const q = "Design a rate limiter for the public API."
  const director = draftSpokenAnswer(q, "director", RESUME)
  const architect = draftSpokenAnswer(q, "architect", RESUME)
  assert.match(director, /Want me to go deeper on/)
  assert.match(blendSpoken(director), /Want me to go deeper on/)
  assert.ok(wordCount(director) <= dissectQuestion(q).modes.director.maxWords)
  assert.ok(wordCount(architect) <= dissectQuestion(q).modes.architect.maxWords)
  assert.equal(/happy to go deeper/i.test(director), false)
})
