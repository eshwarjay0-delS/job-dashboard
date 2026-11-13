// Vague and blame openers stay grammatical. Design-first drafts move toward the aim.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { draftSpokenAnswer, wordCount, dissectQuestion } from "../../src/lib/kompasDissection.ts"
import { blendSpoken } from "../../src/lib/kompasBlend.ts"
import { AQ_FOLDS, scoreSpokenAnswer } from "../../src/lib/kompasAnswerQuality.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const LEAK = /\bI (?:name|state|stop|answer)\b/i
const GARBLED = /:\s*(?:miss|fail|drop|whose|you|they)\b|\b(\w{4,})\s+\1\b/i

function spoken(fold) {
  return blendSpoken(draftSpokenAnswer(fold.question, fold.level, RESUME, fold.previous ? [fold.previous] : []))
}

test("fifty fold drafts do not leak instructions or garble a verb", () => {
  assert.equal(AQ_FOLDS.length, 50)
  for (const fold of AQ_FOLDS) {
    const text = spoken(fold)
    assert.doesNotMatch(text, LEAK, fold.question)
    assert.doesNotMatch(text, GARBLED, fold.question)
    const scores = scoreSpokenAnswer(fold, text)
    for (const [factor, score] of Object.entries(scores)) assert.ok(score >= 3, `${fold.id} ${factor}`)
  }
})

test("a vague ask states the assumption and then answers", () => {
  const fold = AQ_FOLDS.find((item) => item.id === 41)
  const text = spoken(fold)
  assert.match(text, /^Assuming you mean security, I check the live setting before I change it\./)
  assert.equal(text.split(/(?<=[.!?])\s+/).filter(Boolean).length, 1)
})

test("a blame ask names the miss in a grammatical sentence", () => {
  const fold = AQ_FOLDS.find((item) => item.id === 26)
  const text = spoken(fold)
  assert.match(text, /The pressure was real, and the miss was mine: I missed the stale session\./)
  const dropped = spoken(AQ_FOLDS.find((item) => item.id === 29))
  assert.match(dropped, /I dropped the check, and I failed the customer/)
})

test("the first design stage moves toward 90, 70, and 120 words", () => {
  const aims = { engineer: 90, director: 70, architect: 120 }
  for (const id of [11, 12, 13]) {
    const fold = AQ_FOLDS.find((item) => item.id === id)
    const text = spoken(fold)
    const words = wordCount(text)
    const cut = dissectQuestion(fold.question)
    const aim = aims[fold.level]
    assert.ok(words >= aim - 25, `${fold.level} ${words} is still short of ${aim}`)
    assert.ok(words <= cut.modes[fold.level].maxWords, `${fold.level} ${words}`)
    assert.ok(words > 66, fold.level)
  }
})
