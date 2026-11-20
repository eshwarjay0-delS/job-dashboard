import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { jdOnlyExperience } from "../../src/lib/kompasAnswerPresentation.ts"
import { autoMayAnswer } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const RESUME = "Senior ServiceNow Developer. 10+ years. McKesson."
const JD = "Senior SOC Analyst. Splunk, CrowdStrike, Qualys, ServiceNow."

test("candidate speech, a 30s repeat, and a pre-start line do not auto-answer", () => {
  for (let fold = 0; fold < 20; fold++) {
    assert.equal(autoMayAnswer({ speaker: "You", text: "How would you investigate a phishing email?" }).fire, false)
    assert.equal(autoMayAnswer({
      speaker: "Them",
      text: "How would you investigate a phishing email?",
      recentQuestions: ["How would you investigate a phishing email?"],
    }).fire, false)
    assert.equal(autoMayAnswer({ speaker: "Them", text: "How would you investigate a phishing email?" }).fire, true)
  }
  assert.match(app, /captureStartedAt/)
  assert.match(app, /now - row\.at < 30000/)
  assert.match(app, /Question: /)
  assert.match(app, /Listening/)
  assert.match(app, /Answering/)
})

test("a JD-only tool is not claimed as experience", () => {
  for (let fold = 0; fold < 20; fold++) {
    assert.equal(jdOnlyExperience("I used Qualys across the estate.", RESUME, JD), true)
    assert.equal(jdOnlyExperience("I would rank Qualys findings by the asset.", RESUME, JD), false)
    assert.equal(jdOnlyExperience("I have 10+ years on ServiceNow.", RESUME, JD), false)
    assert.doesNotMatch("Honestly, I haven't been the lead on a SOC incident.", /CrowdStrike|Splunk|Qualys/)
  }
})
