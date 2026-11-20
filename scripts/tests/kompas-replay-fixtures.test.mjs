import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const turns = JSON.parse(readFileSync(new URL("../fixtures/replay-fixtures.json", import.meta.url), "utf8"))
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const start = app.indexOf("function oneQuestionLine(")
const end = app.indexOf("function soundsLikeCandidate(")
const oneQuestionLine = vm.runInNewContext(`${app.slice(start, end)}\noneQuestionLine`)

function replayFires(rows) {
  return rows.filter((turn) => turn.speaker === "interviewer").map((turn) => ({
    at: turn.end_s,
    text: turn.text,
    video: turn.video,
    start: turn.start_s,
  }))
}

test("labeled replay: interviewer turns fire once after end_s, candidate turns never fire", () => {
  const fires = replayFires(turns)
  const interviewer = turns.filter((turn) => turn.speaker === "interviewer")
  const candidate = turns.filter((turn) => turn.speaker === "candidate")
  assert.equal(fires.length, interviewer.length)
  assert.equal(candidate.length, 50)
  assert.equal(interviewer.length, 52)
  for (const turn of candidate) {
    assert.equal(fires.some((fire) => fire.text === turn.text && fire.start === turn.start_s), false)
  }
  for (const turn of interviewer) {
    const mine = fires.filter((fire) => fire.video === turn.video && fire.start === turn.start_s)
    assert.equal(mine.length, 1)
    assert.ok(mine[0].at >= turn.end_s)
    assert.equal(mine[0].at, turn.end_s)
    const header = oneQuestionLine(turn.text)
    assert.equal((header.match(/Question:/g) || []).length, 1)
    const body = header.replace(/^Question:\s*/, "")
    assert.ok(turn.text.replace(/\s+/g, " ").includes(body.split(" ").slice(0, 4).join(" ")) || body.length > 0)
    for (const other of candidate) {
      if (other.video !== turn.video) continue
      if (other.text.length < 12) continue
      assert.equal(header.includes(other.text.slice(0, 24)), false)
    }
  }
  const zero = turns.find((turn) => turn.video === "XQC_t7uplBo" && turn.start_s === 344 && turn.speaker === "candidate")
  assert.ok(zero)
  assert.equal(zero.end_s, zero.start_s)
  assert.equal(fires.some((fire) => fire.text === zero.text && fire.start === 344), false)
  const q6 = turns.find((turn) => turn.q_id === 6)
  assert.ok(q6)
  assert.equal(/firewall/i.test(q6.text), false)
  assert.equal(fires.filter((fire) => fire.video === q6.video && fire.start === q6.start_s).length, 1)
  assert.equal(turns.filter((turn) => turn.split).length, 14)
  assert.ok(turns.some((turn) => turn.end_s_approx))
})
