import test from "node:test"
import assert from "node:assert/strict"
import { fullSpokenQuestion, mergeInterviewerWindow, lengthPlan, localSpokenAnswer } from "../../src/lib/kompasAnswer.ts"

const HEARD = [
  "Them: We have been rolling certificates out to the plants.",
  "Them: Tell me about the principle of least privilege.",
  "Them: And how do you apply it when operators need emergency access?",
].join("\n")

test("a multi-sentence multi-question turn keeps every ask", () => {
  const full = fullSpokenQuestion(HEARD)
  assert.match(full, /least privilege/i)
  assert.match(full, /emergency access/i)
  assert.match(full, /certificates/i)
  const lines = [
    { who: "Them", text: "We have been rolling certificates out to the plants.", at: 1000 },
    { who: "Them", text: "Tell me about the principle of least privilege.", at: 1800 },
    { who: "Them", text: "And how do you apply it when operators need emergency access?", at: 2600 },
  ]
  const merged = mergeInterviewerWindow(lines)
  assert.match(merged, /emergency access/i)
  assert.match(merged, /certificates/i)
  const later = mergeInterviewerWindow(lines.concat([{ who: "Them", text: "What is your favorite color?", at: 9000 }]))
  assert.match(later, /favorite color/i)
  assert.doesNotMatch(later, /emergency access/i)
})

test("behavioral and technical answers stay in a full spoken range", () => {
  const story = lengthPlan(1, "Tell me about a time you handled an incident.", "engineer")
  const tech = lengthPlan(2, "How would you design certificate issuance and revocation?", "engineer")
  const yes = lengthPlan(4, "What does PKI stand for?", "engineer")
  assert.ok(story.words >= 150 && story.words <= 250)
  assert.ok(tech.words >= 150)
  assert.ok(yes.words < 120)
  assert.ok(story.maxTokens >= 1400)
  assert.ok(tech.maxTokens >= 1400)
})

test("5 of 5 local answers are complete sentences when every model is down", () => {
  const resume = [
    "Owned certificate issuance and revocation for twelve plants, including emergency access for operators.",
    "Designed least privilege for operator accounts so emergency access expired after the shift.",
    "Rotated privileged credentials after each emergency window and recorded who used them.",
  ].join("\n")
  const questions = [
    "Tell me about the principle of least privilege.",
    "How do you handle emergency access for operators?",
    "Walk me through certificate revocation.",
    "Describe a time you rotated privileged credentials.",
    "How would you design issuance and revocation?",
  ]
  for (const question of questions) {
    const text = localSpokenAnswer(question, resume)
    assert.match(text, /^Yeah, so in my last role,/)
    assert.match(text, /[.!?]$/)
    assert.ok(text.split(/\s+/).length >= 12, question)
    assert.doesNotMatch(text, /given what you said|I'd weigh|interviewer/i)
  }
  const none = localSpokenAnswer("How would you handle a conflict with a coworker?", "Short line.")
  assert.match(none, /general approach/i)
  assert.match(none, /not a story from a specific role/i)
  assert.doesNotMatch(none, /in my last role|access that is actually required/i)
  assert.match(none, /[.!?]$/)
})
