// CI gate for the video-2 live timeline. One card per real question, questions
// never change, manual presses use the latest question, candidate lines are You,
// and a stub model returns a non-empty on-topic answer. No network.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const root = new URL("../../", import.meta.url)
const turns = JSON.parse(readFileSync(new URL("../fixtures/replay-fixtures.json", import.meta.url), "utf8"))
  .filter((turn) => turn.video === "eUlD63RbCnc")
const src = readFileSync(new URL("public/kompas/live-session.js", root), "utf8")
const ctx = vm.createContext({ globalThis: {} })
vm.runInContext(src, ctx)
const Gate = ctx.globalThis.KompasLiveSession

const KEYS = {
  "v2-1": /shifts/i,
  "v2-2": /day/i,
  "v2-3": /tools/i,
  "v2-4": /sentinel/i,
  "v2-5": /dashboard/i,
  "v2-6": /false positive/i,
  "v2-7": /escalate/i,
  "v2-8": /trending/i,
  "v2-9": /sql injection/i,
  "v2-10": /xss/i,
}

test("video 2 opens one locked card per real question and labels the candidate You", () => {
  const replay = Gate.replayLive(turns)
  const candidate = turns.filter((turn) => turn.speaker === "candidate")
  candidate.forEach((turn) => {
    const label = replay.labels.find((row) => row.text === turn.text)
    assert.equal(label && label.role, "You", turn.text.slice(0, 90))
  })
  for (const [id, key] of Object.entries(KEYS)) {
    const hits = replay.cards.filter((card) => key.test(card.question))
    assert.equal(hits.length, 1, id + " -> " + replay.cards.map((card) => card.question).join(" | "))
    assert.ok(String(hits[0].answer || "").split(/\s+/).length >= 8, id)
    assert.equal(Gate.onTopic(hits[0].question, hits[0].answer), true, id)
  }
  replay.cards.forEach((card) => {
    const stolen = candidate.some((turn) => turn.text.slice(0, 48) === card.question.slice(0, 48))
    assert.equal(stolen, false, card.question.slice(0, 80))
  })
  const again = Gate.replayLive(turns)
  assert.deepEqual(again.cards.map((card) => card.question), replay.cards.map((card) => card.question))
})

test("a manual press answers the latest question, not an earlier card", () => {
  const replay = Gate.replayLive(turns)
  const stale = [{ question: "What is Responsible?", answer: "I own the queue at Citi Bank and I assign the ticket.", locked: true }]
  const latest = replay.cards[replay.cards.length - 1].question
  const plan = Gate.manualAnswerPlan(stale, 0, latest)
  assert.equal(plan.reuse, false)
  assert.match(plan.question, /xss/i)
  const open = [{ question: "Preparing…", answer: "", locked: false }]
  const replaced = Gate.manualAnswerPlan(open, 0, latest)
  assert.equal(replaced.reuse, true)
  assert.equal(replaced.replaceQuestion, true)
  assert.match(replaced.question, /xss/i)
})

test("the summary does not count an off-topic or empty card as answered", () => {
  const summary = Gate.sessionSummary({
    cards: [
      { question: "What do you know about SQL injection?", answer: "Having 10+ years of experience in ServiceNow development." },
      { question: "How does the dashboard look?", answer: "" },
      { question: "When do you escalate?", answer: "I escalate at Citi Bank when the account is still moving and I assign the ticket." },
    ],
  })
  const sql = summary.questions.find((row) => /sql injection/i.test(row.question))
  const dash = summary.questions.find((row) => /dashboard/i.test(row.question))
  const esc = summary.questions.find((row) => /escalate/i.test(row.question))
  assert.equal(sql.answered, false)
  assert.equal(dash.answered, false)
  assert.equal(esc.answered, true)
})

test("production length and resume defaults are not the test-only path", () => {
  const service = readFileSync(new URL("src/lib/kompasAnswerService.ts", root), "utf8")
  assert.match(service, /catch \{\s*return expandToBand/)
  const controls = readFileSync(new URL("src/lib/kompasAnswerContract.ts", root), "utf8")
  assert.doesNotMatch(controls, /two to four short sentences/)
  const app = readFileSync(new URL("public/kompas/app.js", root), "utf8")
  assert.match(app, /autoAnswer: prev\.autoAnswer !== false/)
  assert.match(app, /setAuto\(true\)/)
  assert.match(app, /packCatalog\.ownerResume/)
  const level = readFileSync(new URL("src/lib/kompasLevelContract.ts", root), "utf8")
  assert.match(level, /\^having\\b/)
})
