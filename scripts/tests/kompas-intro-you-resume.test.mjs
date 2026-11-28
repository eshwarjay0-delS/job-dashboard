import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { createRequire } from "node:module"
import { repairIntroHeadline, INTRO_HEADLINE } from "../../src/lib/kompasLevelContract.ts"

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

test("a guessed title is not replaced with I, and the intro stays Senior Cybersecurity Engineer", () => {
  const sample = "I am a Senior Cybersecurity Engineer with 8 years of experience at the City of SanG Diego."
  const spoken = Correct.asSpeaker(sample, "Cybersecurity")
  assert.match(spoken, /Senior Cybersecurity Engineer/)
  assert.doesNotMatch(spoken, /Senior I Engineer/)
  assert.match(spoken, /San Diego/)
  assert.doesNotMatch(spoken, /SanG/)
  const intro = Correct.repairOwnerIntro(sample)
  assert.match(intro, /Senior Cybersecurity Engineer/)
  assert.match(intro, /9\+ years/)
  assert.match(intro, /San Diego/)
  assert.doesNotMatch(intro, /Senior I Engineer|SanG|\b8\+?\s+years\b/)
  const headline = repairIntroHeadline("Your introduction", "I am a Senior I Engineer with 8 years at SanG Diego. I work the queue.")
  assert.equal(headline.split(/(?<=[.!?])\s+/)[0], INTRO_HEADLINE)
  assert.match(headline, /9\+ years/)
  assert.match(headline, /San Diego/)
  assert.doesNotMatch(headline, /Senior I Engineer|SanG|\b8 years\b/)
  assert.match(app, /Cybersecurity\|Digital/)
  assert.match(app, /repairOwnerIntro/)
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
