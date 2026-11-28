// Live copilot regressions found on production 11bf120 against the 2dcc1bb mock interview.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { repairDictation } from "../../src/lib/kompasDictation.ts"
import { dropIrrelevantTail, dropOffTopicResume, keepSpokenOpening } from "../../src/lib/kompasConsistency.ts"

const root = new URL("../../", import.meta.url)
const src = readFileSync(new URL("public/kompas/live-session.js", root), "utf8")
const ctx = vm.createContext({ globalThis: {} })
vm.runInContext(src, ctx)
const Gate = ctx.globalThis.KompasLiveSession

const SQL = "How would you prevent SQL injection in a login form?"

test("auto-answer fires on a finished auto card even when the VAD clock is 0", () => {
  const blocked = Gate.shouldFire({ text: SQL, pauseMs: 0 })
  assert.equal(blocked.fire, false)
  assert.equal(blocked.reason, "not-ended")
  const fired = Gate.liveAutoDecision({ text: SQL, pauseMs: 0, finalLine: true })
  assert.equal(fired.fire, true, fired.reason)
  assert.match(fired.text, /SQL injection/i)
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  assert.match(install, /finalLine:\s*true/)
  assert.match(install, /liveAutoDecision/)
  assert.match(install, /showQueuedAnswer/)
  assert.doesNotMatch(install, /emptyAutoCard/)
})

test("the first streamed sentence is kept when finalize drops it", () => {
  const streamed = "I parameterize every query before it reaches the database. Then I review the logs."
  const settled = "Then I review the logs and I add a check on the login form."
  const kept = keepSpokenOpening(streamed, settled)
  assert.match(kept, /^I parameterize every query before it reaches the database\./)
  assert.match(kept, /login form/)
  assert.equal(keepSpokenOpening(streamed, streamed), streamed)
})

test("SIEM reaches the STT prompt and the SAM-tools repair", () => {
  const speech = readFileSync(new URL("src/lib/kompasSpeech.ts", root), "utf8")
  assert.match(speech, /const STT_BIAS = \["SIEM", "SOC", "XSS", "KQL", "SQL"/)
  assert.match(speech, /accuracyPrompt\(\[\.\.\.STT_BIAS/)
  assert.match(repairDictation("What SAM tools have you used for the alerts?"), /SIEM tools/i)
  assert.match(repairDictation("What SAM tools have you used for the alerts?"), /^(?!.*\bSAM tools\b)/i)
  assert.match(repairDictation("what is a SAM account"), /SAM account/)
  assert.match(Gate.correctSecurityAsr("What SAM tools have you used for the alerts?"), /SIEM tools/i)
  assert.match(Gate.correctSecurityAsr("what is a SAM account"), /SAM account/)
  const app = readFileSync(new URL("public/kompas/app.js", root), "utf8")
  assert.match(app, /"SIEM", "SOC", "XSS", "KQL", "SQL"/)
})

test("speaker labels keep a first-person answer as You", () => {
  assert.equal(Gate.attributeSpeaker({
    text: "I would check which logs the SIEM kept after the alert.",
    previousRole: "Interviewer",
    source: "system",
  }), "You")
  assert.equal(Gate.attributeSpeaker({
    text: "How would you prevent SQL injection in a login form?",
    previousRole: "You",
    source: "system",
  }), "Interviewer")
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  assert.doesNotMatch(install, /previousRole: who === "You" \? "You" : "Interviewer"/)
})

test("small talk does not open a question card", () => {
  for (const text of [
    "can you hear me from the other room",
    "can you see my screen",
    "Welcome to this mock interview.",
    "Let me introduce the session before we start.",
  ]) {
    const decision = Gate.liveAutoDecision({ text, pauseMs: 0, finalLine: true })
    assert.equal(decision.fire, false, text + " " + decision.reason)
    assert.equal(decision.reason, "small-talk", text)
  }
  const real = Gate.liveAutoDecision({
    text: "Can you walk me through how you prevent SQL injection?",
    pauseMs: 0,
    finalLine: true,
  })
  assert.equal(real.fire, true, real.reason)
})

test("unrelated resume tails are not appended", () => {
  const answer = "I parameterize every query in the login form. I also ran ITBM and PPM for the portfolio. Fraud monitoring and KYC reviews followed."
  const cleaned = dropOffTopicResume("How would you prevent SQL injection in a login form?", "Security engineer", answer)
  assert.match(cleaned, /parameterize every query/)
  assert.doesNotMatch(cleaned, /ITBM|PPM|Fraud|KYC|jayeshwar44/)
})

test("a hearing-silence warning stays quiet while audio is transcribing", () => {
  const app = readFileSync(new URL("public/kompas/app.js", root), "utf8")
  const m = app.match(/function silenceWarningFor\(cap, now\) \{[\s\S]*?\n\}/)
  assert.ok(m)
  const box = {}
  vm.createContext(box)
  vm.runInContext(m[0] + "\nthis.silenceWarningFor = silenceWarningFor;", box)
  const now = 99999
  assert.equal(box.silenceWarningFor({ who: "You", zeroWarned: false, lastAudibleAt: 1000, inflight: 1 }, now), null)
  assert.equal(box.silenceWarningFor({ who: "Them", zeroWarned: false, lastAudibleAt: 1000, voiced: true }, now), null)
  assert.equal(box.silenceWarningFor({ who: "You", zeroWarned: false, lastAudibleAt: 1000, hearing: true }, now), null)
  assert.match(box.silenceWarningFor({ who: "You", zeroWarned: false, lastAudibleAt: 1000 }, now), /hearing silence/)
})

test("a new question opens its own card and does not rewrite the one still answering", () => {
  const first = Gate.nextQuestionCard([], "How do you escalate an alert?")
  const second = Gate.nextQuestionCard(first.cards, "What is trending in the SIEM?")
  assert.equal(second.cards.length, 2)
  assert.match(second.cards[0].question, /escalate/)
  assert.match(second.cards[1].question, /trending/)
  assert.equal(second.reused, false)
  const quiet = Gate.liveAutoDecision({ text: "How would you prevent SQL injection in a login form?", pauseMs: 0, finalLine: true })
  assert.equal(quiet.fire, true, quiet.reason)
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  assert.match(install, /pauseMs: Gate\.FIRE_PAUSE_MS/)
  assert.match(install, /questionLocked/)
  assert.match(install, /labelFromHeard/)
})

test("candidate speech is You and stays out of the question text", () => {
  assert.equal(Gate.attributeSpeaker({
    text: "I tuned the correlation rules after the false positive.",
    previousRole: "Interviewer",
    source: "system",
  }), "You")
  const mixed = "How do you handle a false positive? I tuned the correlation rules after the false positive."
  const only = Gate.questionWithoutCandidate(mixed)
  assert.match(only, /false positive/i)
  assert.doesNotMatch(only, /I tuned/)
  const joined = Gate.joinSplitQuestion([
    { role: "Interviewer", text: "How do you handle a false positive" },
    { text: "I tuned the correlation rules after the false positive.", source: "system" },
  ])
  assert.equal(joined.length, 2)
  assert.equal(joined[1].role, "You")
})

test("trailing resume sentences that miss the question topic are dropped", () => {
  const fp = "I tune the rule until the false positive stops firing. I also owned the onboarding workflows for new hires."
  const fpClean = dropIrrelevantTail("How do you handle a false positive?", fp)
  assert.match(fpClean, /false positive/)
  assert.doesNotMatch(fpClean, /onboarding/)
  const dash = "I put the detections on one screen. I also tracked the dashboards and the ITSM budget."
  const dashClean = dropIrrelevantTail("How do you design a security dashboard?", dash)
  assert.match(dashClean, /detections/)
  assert.doesNotMatch(dashClean, /ITSM|budget/)
  assert.doesNotMatch(dropOffTopicResume("How do you handle a false positive?", "", fp), /onboarding/)
})

test("an empty or placeholder card is heard, not answered", () => {
  for (const answer of ["", "…", ["…"], "Answering…", "Press Start — answers appear here."]) {
    assert.equal(Gate.answerIsReal(answer), false, JSON.stringify(answer))
  }
  assert.equal(Gate.answerIsReal("I parameterize every query in the login form."), true)
  const summary = Gate.sessionSummary({
    cards: [
      { question: "How do you escalate an alert?", answer: ["…"] },
      { question: "How would you prevent SQL injection?", answer: "I parameterize every query in the login form." },
    ],
  })
  assert.match(summary.text, /escalate an alert\? - heard/)
  assert.match(summary.text, /SQL injection\? - answered/)
})

test("manual AI Answer reuses the open card instead of cloning it", () => {
  const cards = [{ question: "How would you prevent SQL injection in a login form?", answer: "" }]
  assert.equal(Gate.manualAnswerPlan(cards, 0, cards[0].question).reuse, true)
  const different = Gate.manualAnswerPlan(cards, 0, "What is XSS?")
  assert.equal(different.reuse, true)
  assert.equal(different.replaceQuestion, true)
  assert.match(different.question, /XSS/i)
  const answered = [{ question: cards[0].question, answer: "I parameterize every query in the login form." }]
  assert.equal(Gate.manualAnswerPlan(answered, 0, "What is XSS?").reuse, false)
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  assert.match(install, /manualAnswerPlan/)
  assert.match(install, /plan\.reuse/)
})

test("the silence warning clears while sound is coming in", () => {
  const app = readFileSync(new URL("public/kompas/app.js", root), "utf8")
  const m = app.match(/function silenceClearsOnSound\(status, rms\) \{[\s\S]*?\n\}/)
  assert.ok(m)
  const box = {}
  vm.createContext(box)
  vm.runInContext(m[0] + "\nthis.silenceClearsOnSound = silenceClearsOnSound;", box)
  assert.equal(box.silenceClearsOnSound("Kompas is hearing silence from the microphone. Check the input device.", 0.02), true)
  assert.equal(box.silenceClearsOnSound("Listening", 0.02), false)
  assert.equal(box.silenceClearsOnSound("Kompas is hearing silence from the shared audio.", 0), false)
  assert.match(app, /silenceClearsOnSound\(silenceLine\.textContent, rms\)/)
})

test("End paints the session summary on the page, not inside a hidden overlay", () => {
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  assert.match(install, /function showSessionSummary/)
  assert.match(install, /document\.body \|\| document\.getElementById\("overlay"\)/)
  assert.match(install, /origStop/)
  const summary = Gate.sessionSummary({
    cards: [{ question: SQL, answer: ["I parameterize the queries."] }],
    turns: [{ who: "Them", text: "How are you doing today?" }, { who: "You", text: "I am doing well." }],
    endedAt: 1,
  })
  assert.match(summary.text, /Session summary/)
  assert.match(summary.text, /SQL injection/)
  assert.doesNotMatch(summary.text, /How are you/)
})
