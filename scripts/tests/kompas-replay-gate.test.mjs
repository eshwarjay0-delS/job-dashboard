// Replay gate and clarify seed. Local drafts only.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { assertsCandidateExperience, loadClarifyBank, usableClarifyBank } from "../../src/lib/kompasClarifyBank.ts"
import { historicalTagCounts, scoreReplay } from "../../src/lib/kompasReplayGate.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")

test("the clarify seed drops lines that assert someone else's experience", () => {
  const all = loadClarifyBank()
  assert.equal(all.length, 408)
  const dropped = all.filter((row) => assertsCandidateExperience(row.text))
  assert.ok(dropped.some((row) => /Cincinnati/i.test(row.text)))
  assert.ok(dropped.some((row) => /unloader/i.test(row.text)))
  const usable = usableClarifyBank(all)
  assert.ok(usable.length > 300 && usable.length < 408)
  for (const row of usable) assert.equal(assertsCandidateExperience(row.text), false, row.text)
})

test("replay set stays inside the failure thresholds", () => {
  const history = historicalTagCounts()
  assert.ok(history.filler >= 322)
  assert.ok(history["choppy-flow"] >= 270)
  assert.ok(history.generic >= 246)
  assert.ok(history["too-short"] >= 194)
  const report = scoreReplay(RESUME)
  assert.equal(report.n, 249)
  assert.ok(report.ms / report.n < 150, String(report.ms))
  // These counts are the restored 01ceb1dc generator.
  assert.equal(report.counts.filler, 146)
  assert.equal(report.counts["choppy-flow"], 0)
  assert.equal(report.counts["profile-mix"], 0)
  assert.equal(report.counts.generic, 10)
  assert.equal(report.counts["too-short"], 42)
  console.log(JSON.stringify(report.counts))
})
