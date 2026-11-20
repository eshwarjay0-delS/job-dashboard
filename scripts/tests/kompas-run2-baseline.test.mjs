// Live baseline on 1c6c1622 with a resume attached (run 2). Length=Long was
// ignored, a streamed answer was replaced by a shorter one, SOC questions
// closed on ServiceNow, and the incident card was the confirm stub.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { lengthPlan } from "../../src/lib/kompasAnswer.ts"
import { visibleLengthBand } from "../../src/lib/kompasDissection.ts"
import { dropOffTopicResume, keepLongerAnswer, resumeFitsQuestion } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const aside = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const prep = readFileSync(new URL("../../src/app/api/kompas/prep/route.ts", import.meta.url), "utf8")

const JD = "Senior SOC Analyst at First National Bank. Watch Splunk, CrowdStrike, and Qualys. ServiceNow is only the ticket tool."
const QUESTIONS = {
  incident: "Tell me about a time you led the response to a critical security incident.",
  phishing: "How would you investigate a phishing email reported by an employee?",
  compare: "What is the difference between EDR and SIEM?",
  ransomware: "How would you contain ransomware across 200 endpoints?",
  qualys: "How do you prioritize vulnerabilities in Qualys when everything is marked critical?",
  intro: "Tell me about yourself.",
  why: "Why did you choose cybersecurity?",
  tiers: "What are the roles of L1, L2, and L3 in a SOC?",
  reports: "What reports do you prepare as a SOC analyst?",
  routing: "What do you know about routing?",
}

const SOC = "I led the bridge for a ransomware incident, isolated the host in CrowdStrike because the process was still writing, and searched Splunk for the same hash. We contained it in 6 hours across 40 endpoints."
const ITIL = "In my experience, I built similar reports in ServiceNow while working on ITIL process configuration, change and knowledge-management reporting."
const STREAMED = "I prepare a daily alert summary and a weekly note on what we contained. I pull the counts from Splunk because that is the queue the SOC watches. Last quarter that note covered 40 endpoints and the three cases we closed. I also write who owned each case and when it left the queue."

test("Length=Long is the session choice, and the plan meets the band", () => {
  assert.match(app, /current && current\.length/)
  assert.match(service, /LENGTH: Long/)
  assert.match(prep, /about 120 words/)
  assert.match(app, /s\.length \|\| ""\)\.toLowerCase\(\) === "long"/)
  for (let fold = 0; fold < 20; fold++) {
    const intro = lengthPlan(0, QUESTIONS.intro, "architect", { length: "long" })
    const band = visibleLengthBand(QUESTIONS.intro)
    assert.ok(intro.words >= band.aim, `intro plan ${intro.words} under aim ${band.aim}`)
    const qualys = visibleLengthBand(QUESTIONS.qualys)
    assert.ok(qualys.floor > 41, "a 41-word Qualys answer is under the long floor")
    const planned = lengthPlan(2, QUESTIONS.qualys, "architect", { length: "long" })
    assert.ok(planned.words >= qualys.floor)
  }
})

test("a late replace does not shrink a longer on-topic answer, and the stub never stays", () => {
  assert.ok(ITIL.split(/\s+/).length < 25)
  for (let fold = 0; fold < 20; fold++) {
    assert.equal(keepLongerAnswer(STREAMED, ITIL, QUESTIONS.reports, JD), STREAMED)
    assert.match(keepLongerAnswer("I would want to confirm that.", "", QUESTIONS.incident, JD), /less direct hands-on/)
    assert.match(dropOffTopicResume(QUESTIONS.reports, JD, ITIL), /less direct hands-on/)
    assert.doesNotMatch(keepLongerAnswer("I would want to confirm that.", "", QUESTIONS.incident, JD), /not on my resume|would want to confirm/)
    const mixed = `${SOC} I also configured ITIL reports in ServiceNow.`
    const cleaned = dropOffTopicResume(QUESTIONS.reports, JD, mixed)
    assert.match(cleaned, /CrowdStrike/)
    assert.doesNotMatch(cleaned, /ServiceNow|ITIL/)
  }
})

test("a SOC question does not keep an unrelated ServiceNow closer", () => {
  const bad = {
    [QUESTIONS.phishing]: "I would pull the headers and then file the ITIL change in ServiceNow.",
    [QUESTIONS.why]: "I chose this work because I like building Flow Designer and IntegrationHub in ServiceNow.",
    [QUESTIONS.reports]: ITIL,
    [QUESTIONS.intro]: "A senior ServiceNow developer with 10+ years, having delivered solutions for several clients.",
  }
  for (let fold = 0; fold < 20; fold++) {
    for (const [question, answer] of Object.entries(bad)) {
      assert.equal(resumeFitsQuestion(question, JD, answer), false, question)
    }
    assert.equal(resumeFitsQuestion(QUESTIONS.incident, JD, SOC), true)
    assert.equal(resumeFitsQuestion(QUESTIONS.compare, JD, "EDR watches one host. A SIEM collects the alerts from many hosts. I have used CrowdStrike for the host and Splunk for the search."), true)
    assert.equal(resumeFitsQuestion("How do you build a catalog item?", "Senior ServiceNow Developer.", "I build the catalog item in ServiceNow."), true)
  }
  assert.match(service, /ROLE FIRST/)
  assert.match(service, /dropOffTopicResume/)
  assert.doesNotMatch(service, /text: CONFIRM_LINE/)
})

test("typed questions paint Say this or nothing, and a cached stub is not served", () => {
  assert.match(aside, /else if \(stemNow\) \{ current = null; paintLocal\(\); \}/)
  assert.doesNotMatch(aside, /Context shows up with the next answer/)
  assert.match(app, /I would want to confirm that/)
  assert.match(app, /less direct hands-on with that/)
})
