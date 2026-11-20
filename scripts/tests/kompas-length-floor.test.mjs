import test from "node:test"
import assert from "node:assert/strict"
import { levelAwareBand, QUESTION_LENGTH, visibleLengthBand } from "../../src/lib/kompasDissection.ts"

const FOLLOW_FLOOR = visibleLengthBand("How did you verify that?").floor

test("a director or architect ceiling stays above the follow-up floor, and a long story stops at 180", () => {
  for (let fold = 0; fold < 20; fold++) {
    for (const level of ["director", "architect"]) {
      const follow = levelAwareBand("How did you verify that?", level, "balanced")
      assert.ok(follow.ceiling > FOLLOW_FLOOR, level)
      assert.ok(follow.floor < follow.ceiling, level)
      const story = levelAwareBand("Tell me about a time you led an incident.", level, "long")
      assert.equal(story.ceiling, 180)
      assert.equal(story.aim, 180)
      assert.ok(story.ceiling <= visibleLengthBand(story.type && "Tell me about a time you led an incident.").ceiling)
    }
    assert.equal(QUESTION_LENGTH.star.architect.ceiling, 300)
    assert.equal(QUESTION_LENGTH.definition.director.ceiling, 50)
    const defined = levelAwareBand("What is a SIEM?", "director", "balanced")
    assert.ok(defined.floor < defined.ceiling)
    assert.ok(defined.ceiling <= 50)
  }
})
