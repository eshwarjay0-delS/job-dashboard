import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { createRequire } from "node:module"
import { repairIntroHeadline, INTRO_HEADLINE, fitLevelAnswer, levelContract } from "../../src/lib/kompasLevelContract.ts"
import { answerAside } from "../../src/lib/kompasAnswerAside.ts"
import { OWNER_RESUME } from "../../src/lib/kompasPacks/owner.ts"

const require = createRequire(import.meta.url)

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const route = readFileSync(new URL("../../src/app/api/kompas/account-sessions/route.ts", import.meta.url), "utf8")
const syncSrc = readFileSync(new URL("../../public/kompas/account-sync.js", import.meta.url), "utf8")

function load(file, name) {
  const ctx = { globalThis: {}, console }
  ctx.globalThis = ctx
  vm.runInNewContext(readFileSync(new URL(file, import.meta.url), "utf8"), ctx)
  return ctx[name] || ctx.globalThis[name]
}

const Correct = load("../../public/kompas/correct.js", "KompasCorrect")
const Gate = load("../../public/kompas/live-session.js", "KompasLiveSession")

test("intro repairs transcription only and never invents biography", () => {
  const sample = "I am a Senior Cybersecurity Engineer with 8 years of experience at the City of SanG Diego."
  const spoken = Correct.asSpeaker(sample, "Cybersecurity")
  assert.match(spoken, /Senior Cybersecurity Engineer/)
  assert.doesNotMatch(spoken, /Senior I Engineer/)
  assert.match(spoken, /San Diego/)
  assert.doesNotMatch(spoken, /SanG/)
  const intro = Correct.repairOwnerIntro(sample)
  assert.match(intro, /Senior Cybersecurity Engineer/)
  assert.match(intro, /8 years/)
  assert.match(intro, /City of San Diego/)
  assert.doesNotMatch(intro, /9\\+ years|Citi Bank|CVS Health|Charter Communications|Accenture/)
  assert.doesNotMatch(Correct.repairOwnerIntro(sample + " Press Start — answers appear here."), /Press Start/)
  const headline = repairIntroHeadline("Tell me about yourself.", "I am a Senior I Engineer with 8 years at SanG Diego. I work the queue.")
  assert.equal(headline, "I am a Senior Cybersecurity Engineer with 8 years at San Diego. I work the queue.")
  assert.doesNotMatch(headline, /9\\+ years|Citi Bank|CVS Health|Charter Communications|Accenture|Press Start/)
  assert.match(app, /I can walk you through the experience and projects listed in the resume loaded for this interview/)
  assert.doesNotMatch(app, /Citi Bank since November 2024|CVS Health, the City of San Diego, Charter Communications, and Accenture/)
})

test("candidate speech is labeled You and is dropped from the question on the answer card", () => {
  const narrative = "I tuned the Splunk notable at Citi Bank and assigned the ServiceNow ticket."
  assert.equal(Gate.attributeSpeaker({ text: narrative, previousRole: "Interviewer", source: "system" }), "You")
  assert.equal(Gate.isCandidateNarrative(narrative), true)
  const mixed = "How do you escalate an alert? " + narrative
  const question = Gate.questionWithoutCandidate(mixed)
  assert.match(question, /How do you escalate an alert/)
  assert.doesNotMatch(question, /I tuned the Splunk notable/)
  assert.match(app, /isCandidateNarrative/)
  assert.match(app, /questionWithoutCandidate/)
})

test("a finished question card with no answer gets a retry instead of staying empty", () => {
  const retry = "The answer could not finish. Your question is saved on this card. Press AI Answer to retry."
  assert.equal(Gate.finishedAnswerText(""), retry)
  assert.equal(Gate.finishedAnswerText(["…"]), retry)
  assert.equal(Gate.finishedAnswerText("Answering…"), retry)
  assert.equal(Gate.finishedAnswerText("I assign the ServiceNow ticket at Citi Bank."), "I assign the ServiceNow ticket at Citi Bank.")
  assert.match(app, /function ensureFinishedAnswer/)
  assert.match(app, /ensureFinishedAnswer\(card\)/)
  assert.match(app, /questionLocked && kept/)
})

test("a role session with resume text selects that resume instead of an empty choice", () => {
  assert.match(app, /const SESSION_RESUME = "__session__"/)
  assert.match(app, /function resumeChoiceLabel/)
  assert.match(app, /eshwarjay05@gmail\\.com/)
  assert.match(app, /return "eshwarjay05"/)
  assert.match(app, /function storedResumeId/)
  assert.match(app, /Resume: " \+ resumeName/)
})

test("pack fill is first person and does not keep scaffold or an empty metric", () => {
  const { expandToBand, spokenPackSentence } = require("../../src/lib/kompasLevelContract.ts")
  assert.equal(spokenPackSentence("Tools: Name Fortify, SAST, owner, retest, ServiceNow only when the question needs them."), "")
  assert.equal(spokenPackSentence("Story 2: I tuned the notable so it pages once."), "")
  assert.match(spokenPackSentence("Story 2: At Citi Bank I assigned the ServiceNow ticket to the owner and closed it after the rescan."), /At Citi Bank I assigned/)
  const filled = expandToBand("I do this at Citi Bank. I pull the evidence, decide, and assign the ServiceNow ticket.", levelContract("engineer", "How do you use Splunk for detection?"), "At Citi Bank I searched the notable in Splunk and I assigned the ServiceNow ticket. Tools: Name Fortify only when the question needs them. I tuned it so it pages once.", "How do you use Splunk for detection?", "Citi Bank Splunk ServiceNow", true)
  assert.doesNotMatch(filled, /Story\s+\d+:|only when the question needs|pages once|by %/)
})

test("a hedge about a specific risk is removed, and a repeated closing sentence is dropped", () => {
  const hedge = "I can't accurately name a specific OWASP Top 10 risk I personally remediated. At CVS Health I fixed broken access control on the portal."
  const cleaned = fitLevelAnswer(hedge + " At CVS Health I fixed broken access control on the portal.", levelContract("engineer", "How do you handle an OWASP finding?"))
  assert.doesNotMatch(cleaned, /can't accurately name|personally remediated/i)
  assert.match(cleaned, /CVS Health/)
  const repeated = fitLevelAnswer("I open the SailPoint queue and assign the owner. I check the CyberArk vault next. I open the SailPoint queue and assign the owner.", levelContract("engineer", "How do you review access?"))
  assert.equal(repeated.split(/SailPoint queue/i).length - 1, 1)
})

test("Say this for an eshwarjay05 session does not speak the ServiceNow profile", () => {
  const mixed = OWNER_RESUME + "\nHaving 10+ years of experience in Sr. ServiceNow Development and FSO and CSM.\njayeshwar44@gmail.com"
  const aside = answerAside({ question: "How do you handle an AppSec finding?", resume: mixed })
  const blob = JSON.stringify(aside)
  assert.doesNotMatch(blob, /jayeshwar44|Sr\. ServiceNow Development|ServiceNow FSO/i)
  assert.match(app, /current\.resume/)
  assert.match(readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8"), /function sessionResumeText/)
})

test("a second half merges into the open card and candidate speech does not open one", () => {
  const dangling = Gate.mergeIntoOpenCard([{ question: "Tell me about", answer: "" }], "SQL injection")
  assert.equal(dangling.merge, true)
  assert.match(dangling.question, /SQL injection/)
  const separate = Gate.mergeIntoOpenCard([{ question: "How do you detect SQL injection?", answer: "" }], "How does Sentinel work?")
  assert.equal(separate.merge, false)
  assert.match(separate.question, /Sentinel/)
  const mine = Gate.mergeIntoOpenCard([], "I tuned the Splunk notable at Citi Bank.")
  assert.equal(mine.question, "")
  assert.equal(Gate.liveAutoDecision({ text: "I tuned the Splunk notable at Citi Bank.", finalLine: true, pauseMs: Gate.FIRE_PAUSE_MS }).fire, false)
})

test("skip-login session sync stays on this device when the account store is unavailable", async () => {
  assert.match(route, /localOnly: true/)
  assert.match(route, /Account sync is not configured/)
  assert.match(syncSrc, /data\.localOnly/)
  const { create } = require("../../public/kompas/account-sync.js")
  const sessions = [{ id: "role-1", role: "SOC Analyst", resume: "eshwarjay05@gmail.com\nSenior Cybersecurity Engineer" }]
  let current = sessions.slice()
  const notes = []
  const sync = create({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    read: () => current,
    write: (rows) => { current = rows },
    render: () => {},
    notify: (state) => notes.push(state),
    fetcher: async () => ({ ok: true, status: 200, headers: { get: () => "" }, json: async () => ({ ok: true, localOnly: true, userId: "owner", records: [], error: "Sessions stay on this device. Account sync is not configured." }) }),
  })
  const ok = await sync.refresh()
  assert.equal(ok, true)
  assert.equal(current[0].id, "role-1")
  assert.equal(notes.at(-1).state, "local")
  assert.match(notes.at(-1).message, /stay on this device/)
  assert.doesNotMatch(notes.at(-1).message, /unavailable \(503\)/)
})
