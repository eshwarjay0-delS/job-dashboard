import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  BANDS,
  EVAL_CASES,
  applyPersonalityFilter,
  assessAnswer,
  bannedHits,
  employmentViolations,
  evaluateFallbackMatrix,
  fallbackAnswer,
  hedgeHits,
  modelKeyUsable,
  openingSentences,
  poolSentences,
  questionKind,
  wordCount,
} from "../../src/lib/kompasLevelPersonality.ts"
import { personalityPrompt } from "../../src/lib/kompasLevelPersonalityPrompt.ts"

test("hedge family catches the named gaps and the close variants", () => {
  const samples = [
    ["less direct hands-on", "I had less direct hands-on with that console."],
    ["transfers because", "It transfers because the seniority is the same."],
    ["my Sr work transfers", "My Sr work transfers to this stack."],
    ["I haven't used", "I haven't used that product."],
    ["I haven't had", "I have not had that one in production."],
    ["not directly", "That was not directly my area."],
    ["limited experience", "I have limited experience there."],
    ["I'm not as familiar", "I'm not as familiar with the console."],
    ["while I haven't", "While I haven't owned the product, I can speak about it."],
    ["I'm not familiar", "I am not familiar with the alert."],
    ["never used", "I never used the tool."],
  ]
  for (const [label, sample] of samples) {
    assert.ok(hedgeHits(sample).includes(label), `${label} should fail: ${hedgeHits(sample).join(",")}`)
  }
})

test("canned closers fail the banned-phrase check", () => {
  for (const phrase of [
    "I own the decision",
    "the risk we accepted is named",
    "I do not walk the build",
    "I say what I chose",
    "The point is the result, said once",
    "I've had less direct hands-on with that; my Sr work transfers",
  ]) {
    assert.ok(bannedHits(`The answer ends with ${phrase}.`).length, phrase)
  }
})

test("employment claims fail and a customer tool story does not", () => {
  const resume = "Fortinet AWS Cloud Networking Engineer"
  assert.deepEqual(employmentViolations("A customer ran Saviynt and I troubleshot the integration with their identity partner.", resume), [])
  assert.ok(employmentViolations("I worked at Saviynt on the connector.", resume).includes("Saviynt"))
  assert.ok(employmentViolations("I worked at Accenture before this.", resume).includes("Accenture"))
  assert.ok(employmentViolations("At Charter Communications I led the program.", resume).some((hit) => /charter/i.test(hit)))
  assert.ok(employmentViolations("I joined Charter last year.", resume).some((hit) => /charter/i.test(hit)))
  assert.deepEqual(employmentViolations("I wrote the project charter for the cutover.", resume), [])
  assert.ok(employmentViolations("The Saint Louis profile is a different person.", resume).length)
  assert.ok(employmentViolations("Mail jayeshwar44 from the other profile.", resume).length)
  assert.ok(employmentViolations("I am an architect at the company.", resume).includes("invented title"))
})

test("question kinds match the eval set", () => {
  for (const item of EVAL_CASES) assert.equal(questionKind(item.question), item.kind)
})

test("fallback matrix passes every level check", () => {
  const rows = evaluateFallbackMatrix()
  assert.equal(rows.length, EVAL_CASES.length * 3)
  const failed = rows.filter((row) => !row.assessment.ok).map((row) => ({
    id: row.id,
    level: row.level,
    words: row.assessment.words,
    employer: row.assessment.employerHits,
    banned: row.assessment.bannedHits,
    hedges: row.assessment.hedgeHits,
    style: row.assessment.styleHits,
    topic: row.assessment.topic,
    band: row.assessment.wordBand,
  }))
  assert.deepEqual(failed, [])
  for (const row of rows) {
    const band = BANDS[row.level]
    assert.ok(row.assessment.words >= band.min && row.assessment.words <= band.max)
    assert.ok(wordCount(row.text) >= 1)
  }
})

test("pool sentences stay short enough to fit the band", () => {
  for (const level of ["architect", "director", "engineer"]) {
    for (const sentence of [...poolSentences(level), ...EVAL_CASES.flatMap((item) => openingSentences(level, item.kind))]) {
      assert.ok(wordCount(sentence) <= 55, `${level} sentence is ${wordCount(sentence)} words: ${sentence.slice(0, 80)}`)
    }
  }
})

test("empty intro falls back to a full answer at every level", async () => {
  for (const level of ["architect", "director", "engineer"]) {
    const result = await applyPersonalityFilter({ level, question: "Tell me about yourself.", text: "" })
    assert.ok(result.reasons.includes("fallback"))
    assert.equal(result.assessment.ok, true)
    assert.equal(result.text, fallbackAnswer(level, "Tell me about yourself."))
  }
})

test("banned phrase and hedge are stripped, then regenerated once", async () => {
  const question = "Tell me about yourself."
  const good = fallbackAnswer("engineer", question)
  let calls = 0
  const replaced = await applyPersonalityFilter({
    level: "engineer",
    question,
    text: "I own the decision. I haven't used Sentinel.",
    regenerate: async () => {
      calls += 1
      return good
    },
  })
  assert.equal(calls, 1)
  assert.equal(replaced.text, good)
  assert.deepEqual(replaced.reasons, ["regenerated"])

  const dirtyAgain = await applyPersonalityFilter({
    level: "director",
    question,
    text: "I do not walk the build. While I haven't had this, my Sr work transfers.",
    regenerate: async () => "I haven't had that. The point is the result, said once.",
  })
  assert.ok(dirtyAgain.reasons.includes("regenerated"))
  assert.ok(dirtyAgain.reasons.includes("fallback"))
  assert.equal(dirtyAgain.assessment.ok, true)
  assert.equal(hedgeHits(dirtyAgain.text).length, 0)
  assert.equal(bannedHits(dirtyAgain.text).length, 0)
})

test("a clean fallback is already acceptable", async () => {
  const question = EVAL_CASES[0].question
  const text = fallbackAnswer("architect", question)
  const result = await applyPersonalityFilter({ level: "architect", question, text })
  assert.equal(result.rewritten, false)
  assert.deepEqual(result.reasons, [])
  assert.equal(result.text, text)
})

test("prompts differ by level and carry the tone rule plus the Houston resume", () => {
  const question = "Tell me about yourself."
  const architect = personalityPrompt("architect", question)
  const director = personalityPrompt("director", question)
  const engineer = personalityPrompt("engineer", question)
  assert.notEqual(architect, director)
  assert.notEqual(director, engineer)
  for (const prompt of [architect, director, engineer]) {
    assert.match(prompt, /Answer in the first person, confident and decisive/)
    assert.match(prompt, /No hedging, and never admit a gap/)
    assert.match(prompt, /FortiGate-VM/)
    assert.match(prompt, /eshwarjay05@gmail.com/)
    assert.match(prompt, /I own the decision/)
  }
  assert.match(architect, /1000 to 1400/)
  assert.match(director, /400 to 600/)
  assert.match(engineer, /700 to 800/)
  assert.match(director, /No build-level detail/)
})

test("placeholder keys are not a live model", () => {
  assert.equal(modelKeyUsable(""), false)
  assert.equal(modelKeyUsable("sk-or-placeholder"), false)
  assert.equal(modelKeyUsable("short-key"), false)
  assert.equal(modelKeyUsable("sk-or-v1-abc1234567890xyz"), true)
})

test("committed eval table matches this fallback matrix", () => {
  const md = readFileSync(new URL("../../docs/kompas-eval/levels-results.md", import.meta.url), "utf8")
  assert.match(md, /Live model samples were not produced/)
  assert.match(md, /Hedges/)
  for (const row of evaluateFallbackMatrix()) {
    assert.match(md, new RegExp(`\\| ${row.id} \\| ${row.level} \\| deterministic fallback \\| ${row.assessment.words} \\|`))
  }
})
