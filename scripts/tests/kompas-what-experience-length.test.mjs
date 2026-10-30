// Gap C (30 Oct 2026): "What is your experience with X?" asks the candidate to explain their experience, the same as
// "Explain your experience with X", but it fell through to "direct" and got the 44/66/99-word ceiling. It now takes the
// full personal-experience band (110/165/248). Brevity asks, yes/no asks, comparisons and employer asks keep their route.
import test from "node:test"
import assert from "node:assert/strict"
import { dissectQuestion } from "../../src/lib/kompasDissection.ts"
import { interviewIntent, focusPlan } from "../../src/lib/kompasRelevance.ts"
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"

const FULL = [
  "What is your experience with Splunk?",
  "What's your experience with CyberArk?",
  "what is your experience with okta",
  "What has been your hands-on experience with threat modeling?",
  "What experience do you have with incident response?",
  "What kind of experience do you have with SIEM tuning?",
  "What is your experience leading a security team?",
]
const SHORT = [
  "In one sentence, what is your experience with Splunk?",
  "Briefly, what is your experience with CyberArk?",
  "Quickly, what experience do you have with Okta?",
  "Do you have experience with CyberArk?",
  "What is your biggest strength?",
]
for (const q of FULL) {
  test(`what-is-your-experience gets the full experience band: ${q}`, () => {
    const cut = dissectQuestion(q)
    assert.equal(cut.intent, "experience-story")
    assert.ok(cut.modes.engineer.targetWords >= 100, `engineer ${cut.modes.engineer.targetWords}`)
    assert.ok(cut.modes.director.targetWords >= 150, `director ${cut.modes.director.targetWords}`)
    assert.ok(cut.modes.architect.targetWords >= 220, `architect ${cut.modes.architect.targetWords}`)
    assert.ok(focusPlan(q, 2, "engineer").maxWords >= 170)
  })
}
for (const q of SHORT) {
  test(`brief or yes/no ask stays short: ${q}`, () => {
    const cut = dissectQuestion(q)
    assert.notEqual(cut.intent, "experience-story")
    assert.ok(cut.modes.engineer.targetWords <= 44, `engineer ${cut.modes.engineer.targetWords}`)
  })
}
test("a comparison and an employer ask keep their route", () => {
  assert.notEqual(interviewIntent("What is your experience with Splunk versus Sentinel?"), "experience-story")
  const HIT = "# Sam\n## Experience\n### GRC Analyst — Hitachi Vantara — 2021 to 2024\n- Ran quarterly access reviews for 40 applications.\n"
  assert.match(draftSpokenAnswer("What is your experience at Google?", "director", HIT), /does not show/)
})
test("a logistics ask is never turned into an experience story", () => {
  for (const q of ["What is your visa status?", "What is your notice period?", "What are your salary expectations?"]) assert.notEqual(interviewIntent(q), "experience-story", q)
})
