import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const start = app.indexOf("function secondQuestionPlan")
const end = app.indexOf("function labelFromHeard")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\nthis.second = secondQuestionPlan;\nthis.release = releaseQueuedAnswer;", ctx)

test("a queued second interviewer question switches the card and streams within 2s", () => {
  const showing = { card: "Tell me about yourself.", queue: [], badge: 0, busy: true }
  const queued = ctx.second(showing, { who: "Them", text: "How do you support security operations?", ask: true })
  assert.equal(queued.action, "queue")
  assert.equal(queued.card, "Tell me about yourself.")
  assert.equal(queued.badge, 1)
  const shown = ctx.release({ card: queued.card, queue: queued.queue })
  assert.equal(shown.action, "switch")
  assert.equal(shown.card, "How do you support security operations?")
  assert.equal(shown.stream, true)
  assert.ok(shown.switchMs < 2000)
  assert.equal(shown.badge, 0)
})

test("a YOU fragment is not an interviewer question and does not raise the badge", () => {
  const showing = { card: "Tell me about yourself.", queue: [], badge: 0, busy: true }
  const you = ctx.second(showing, { who: "You", text: "where you are supporting the security operations.", ask: true })
  assert.equal(you.action, "ignore")
  assert.equal(you.reason, "candidate")
  assert.equal(you.card, "Tell me about yourself.")
  assert.equal(you.badge, 0)
  assert.equal(you.stream, false)
})
