// Rounds 11-13 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { draftSpokenAnswer, leadPhrase, dissectQuestion, settleSpokenAnswer, askedPartList, topicOfAsk } from "../../src/lib/kompasDissection.ts"
import { questionForAnswer } from "../../src/lib/kompasAnswer.ts"
import { ROUNDS, runRound } from "../kompas-stress-rounds.mjs"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const lead = (q, level = "engineer") => (draftSpokenAnswer(q, level, RESUME).match(/^(?:For|On|In|When) (.+?), /) || [])[1]

test("fallback lead-in: no 'For if the owner says it's fixed but there's no'", () => {
  const q = "What would you do if the owner says it's fixed but there's no evidence?"
  for (const level of ["engineer", "director", "architect"]) assert.doesNotMatch(draftSpokenAnswer(q, level, RESUME), /^For if\b|there's no,/)
  assert.equal(lead(q), "the case where the owner says it's fixed but there's no evidence")
})
test("failsafe: a lead that ends on 'no' naturally is not trimmed", () => {
  assert.match(lead("Walk me through a situation where you had to say no."), /say no$/)
})
test("yes/no and amount asks are said as mine, not read back as questions", () => {
  assert.equal(lead("Would you close a finding the owner says is fixed?"), "whether I would close a finding the owner says is fixed")
  assert.match(lead("Should we accept this risk?"), /^whether we should accept this risk$/)
  assert.match(lead("Do you trust an owner's self-assessment?"), /^whether I trust/)
  assert.match(lead("By what percent did you cut open findings?"), /^how much I cut open findings$/)
  assert.match(lead("What was your audit pass rate, as a percentage?"), /^my audit pass rate$/)
  assert.match(lead("How many audits did you pass without a single finding?"), /^how many audits I pass/)
})
test("multi-part lead is the first part; listed parts are said in the first person, without 'and'", () => {
  const q = "How would you run a vendor risk review, what would you ask the vendor, what would you check yourself, and when would you stop the contract?"
  assert.equal(leadPhrase(q), "run a vendor risk review")
  for (const level of ["director", "architect"]) assert.doesNotMatch(draftSpokenAnswer(q, level, RESUME), /\byou(?:rself|r)?\b/)
  assert.ok(!askedPartList("How do you test a control, how do you know the test is enough, what do you do when it fails, and who signs off?").some((p) => /^and\b/.test(p)))
})
test("'how do you know … and …' is not a comparison", () => {
  assert.notEqual(dissectQuestion("How do you test a control, how do you know the test is enough, what do you do when it fails, and who signs off?").shape, "comparison")
  assert.equal(dissectQuestion("Do you know Python and Go?").shape, "comparison") // failsafe
})
test("jargon setup is context, not topic, and is not said back", () => {
  assert.equal(topicOfAsk("With GRC platforms, ServiceNow IRM, Archer, OneTrust, how do you track exceptions?"), "how do you track exceptions?")
  assert.equal(topicOfAsk("How do you handle residual risk, you know, with all the SOAR, XDR, CSPM, CNAPP, and SBOM stuff these days?"), "How do you handle residual risk?")
  assert.doesNotMatch(draftSpokenAnswer("Considering SIEM, UEBA, SOAR playbooks and MITRE ATT&CK, how do you write a finding?", "architect", RESUME), /SOAR|UEBA|MITRE/)
  assert.ok(!settleSpokenAnswer("What is residual risk?", "Residual risk is what is left. I explain it with Monte Carlo runs. The owner decides.", "engineer", RESUME).text.includes("Monte Carlo"))
  // failsafe: asked jargon stays
  assert.match(settleSpokenAnswer("How do you use SOAR playbooks?", "I use SOAR playbooks for triage. I review each run.", "engineer", RESUME).text, /SOAR/)
  // failsafe: "with" that is the ask itself is kept
  assert.match(topicOfAsk("With whom do you share findings?"), /^With whom/)
})
test("interviewer pushback is tied to the challenged question and keeps its topic", () => {
  const h = [{ q: "What is residual risk?", a: "x" }]
  for (const push of ["That doesn't sound right.", "Are you sure about that?", "Really? Even for a senior owner?", "I'm not convinced. Who decides it is acceptable?"]) {
    const f = questionForAnswer(push, "", false, false, h)
    assert.match(f, /following up on: "What is residual risk"/, push)
    assert.match(draftSpokenAnswer(f, "engineer", RESUME, ["x"]), /residual risk/i, push)
  }
  // failsafe: no history, no tie; pushback words inside a real ask are a real ask
  assert.doesNotMatch(questionForAnswer("That doesn't sound right.", "", false, false, []), /following up on/)
  assert.doesNotMatch(questionForAnswer("What would you do if you disagree with the auditor?", "", false, false, h), /following up on/)
})
test("STAR: behavioural asks are told as a real past story", () => {
  assert.equal(dissectQuestion("Tell me about your biggest mistake at work.").shape, "personal-experience")
  assert.equal(dissectQuestion("Walk me through a situation where you had to say no.").shape, "personal-experience")
  for (const q of ["Tell me about a time a fix did not hold.", "Tell me about your biggest mistake at work."]) {
    const t = draftSpokenAnswer(q, "engineer", RESUME)
    assert.match(t, /closest real example/); assert.doesNotMatch(t, /\bOn (?:a time|challenged|that situation\b.*On a time)/)
    assert.doesNotMatch(t, /^In a time\b|mistake at,/)
  }
  // failsafe: empty resume keeps the honest line
  assert.match(draftSpokenAnswer("Tell me about a time a fix did not hold.", "engineer", ""), /resume does not show|not done this|not something/i)
})
test("made-up numbers: the answer says it will not guess, once, and no figure appears", () => {
  for (const q of ["What percentage of your findings were closed on time last year?", "What was the ROI of your remediation programme, in dollars?"])
    for (const level of ["engineer", "director", "architect"]) {
      const t = draftSpokenAnswer(q, level, RESUME)
      assert.equal((t.match(/won't guess/g) || []).length, 1); assert.doesNotMatch(t, /\d/)
    }
  assert.doesNotMatch(draftSpokenAnswer("The control failed in 37% of samples. What would you do?", "engineer", RESUME), /won't guess/) // failsafe
})
test("rounds 11-13 hold offline", () => {
  for (const i of [10, 11, 12]) assert.deepEqual(runRound(i).failures, [], `round ${i + 1}`)
  assert.ok(ROUNDS.slice(10).flat().length >= 150)
})
