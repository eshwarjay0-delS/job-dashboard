import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  draftSpokenAnswer, dissectQuestion, isProviderErrorAnswer, overlapRatio, wordCount, firstSentence,
} from "../../src/lib/kompasDissection.ts"

const resume = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const references = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-reference-answers.json", import.meta.url), "utf8"))

test("hand-written references stay in band, echo the question, and do not invent tools", () => {
  assert.equal(references.length, 4)
  const seen = new Set()
  for (const row of references) {
    assert.equal(seen.has(row.answer), false)
    seen.add(row.answer)
    assert.equal(isProviderErrorAnswer(row.answer), false)
    assert.doesNotMatch(row.answer, /^\s*Having\b|^\s*[-*•]/)
    const cut = dissectQuestion(row.question, resume)
    const mode = cut.modes[row.level]
    const words = wordCount(row.answer)
    assert.ok(words >= mode.minWords && words <= mode.maxWords, `${row.question} has ${words}, band ${mode.minWords}-${mode.maxWords}`)
    const opening = firstSentence(row.answer).toLowerCase()
    assert.ok(cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase())), row.question)
    const banned = cut.banned.filter((term) => row.answer.toLowerCase().includes(term.toLowerCase()))
    assert.deepEqual(banned, [])
    const draft = draftSpokenAnswer(row.question, row.level, resume)
    assert.notEqual(draft, row.answer)
    assert.ok(overlapRatio(draft, row.answer) >= 0.15, `${row.question} overlap ${overlapRatio(draft, row.answer).toFixed(2)}`)
  }
})
