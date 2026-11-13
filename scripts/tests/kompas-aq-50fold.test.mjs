// Fifty answer-quality folds. Each fold rechecks every earlier ask.
// Offline drafts only. The fictional sample resume is not either private profile.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
import { blendSpoken } from "../../src/lib/kompasBlend.ts"
import { AQ_FOLDS, foreignProfileHit, scoreSpokenAnswer } from "../../src/lib/kompasAnswerQuality.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")

function answerFor(fold) {
  const text = draftSpokenAnswer(fold.question, fold.level, RESUME, fold.previous ? [fold.previous] : [])
  return blendSpoken(text)
}

for (const fold of AQ_FOLDS) {
  test(`AQ fold ${String(fold.id).padStart(2, "0")}: ${fold.kind} / ${fold.level}`, () => {
    assert.equal(AQ_FOLDS.length, 50)
    for (const earlier of AQ_FOLDS.filter((item) => item.id <= fold.id)) {
      const spoken = answerFor(earlier)
      assert.equal(foreignProfileHit(spoken), false, earlier.question)
      assert.doesNotMatch(spoken, /\b(?:houston|saint louis|jayeshwar44|eshwarjay05)\b/i)
      const scores = scoreSpokenAnswer(earlier, spoken)
      for (const [factor, score] of Object.entries(scores)) {
        assert.ok(score >= 3, `fold ${earlier.id} ${factor}=${score}\n${spoken}`)
      }
    }
  })
}
