import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"

const app = fs.readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const start = app.indexOf("function sessionRecap(")
const end = app.indexOf("async function leaveLive(", start)
const context = {}
vm.runInNewContext(app.slice(start, end) + "\nthis.sessionRecap = sessionRecap;", context)

test("a stopped call keeps the questions that were actually answered", () => {
  const note = context.sessionRecap([
    { question: "What is IDOR?", answer: "IDOR is a missing check on the owner of a record. The rest stays off this line." },
    { question: "No question yet", answer: "x".repeat(50) },
    { question: "Have you found a vulnerability?", answer: "I found a missing owner check on one record.\nThe later sentences stay in the card." },
  ])
  assert.match(note, /What is IDOR\? — IDOR is a missing check/)
  assert.match(note, /Have you found a vulnerability\? — I found a missing owner check/)
  assert.doesNotMatch(note, /No question yet|later sentences/)
})

test("an empty call does not invent a note", () => {
  assert.equal(context.sessionRecap([]), "")
  assert.equal(context.sessionRecap([{ question: "Ready", answer: "hello" }]), "")
})
