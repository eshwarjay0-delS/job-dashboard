import test from "node:test"
import assert from "node:assert/strict"
import { CHIEF_WORKER_CAP, THIS_CHAT, chiefDesk } from "../../src/lib/chief-desk.ts"

test("the desk gathers this chat, the open plan, and unfinished REA, with Kompas first", () => {
  const items = chiefDesk()
  assert.equal(CHIEF_WORKER_CAP, 100)
  assert.ok(items.length > THIS_CHAT.length)
  for (const id of ["chat-kompas-levels", "chat-kompas-spoken", "chat-resume-confirmed", "chat-chief-only"]) {
    assert.ok(items.some(i => i.id === id), id)
  }
  const firstOther = items.findIndex(i => i.area !== "kompas")
  const lastKompas = items.reduce((n, i, idx) => i.area === "kompas" ? idx : n, -1)
  assert.ok(lastKompas < firstOther, "Kompas jobs stay ahead of the rest")
  assert.equal(chiefDesk("kompas").every(i => i.area === "kompas"), true)
})
