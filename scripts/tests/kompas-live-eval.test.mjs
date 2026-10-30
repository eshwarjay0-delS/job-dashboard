import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

test("live eval does not call production when KOMPAS_EVAL_TOKEN is absent", () => {
  const env = { ...process.env }
  delete env.KOMPAS_EVAL_TOKEN
  delete env.KOMPAS_API_TOKEN
  const result = spawnSync(process.execPath, ["scripts/kompas-live-eval.mjs"], { encoding: "utf8", env, cwd: new URL("../..", import.meta.url) })
  assert.equal(result.status, 2)
  assert.match(`${result.stderr}${result.stdout}`, /KOMPAS_EVAL_TOKEN/)
  assert.doesNotMatch(`${result.stderr}${result.stdout}`, /asking /)
})

test("the eval script documents the token and the failure rules", () => {
  const source = readFileSync(new URL("../kompas-live-eval.mjs", import.meta.url), "utf8")
  assert.match(source, /KOMPAS_EVAL_TOKEN/)
  assert.match(source, /process\.exit\(2\)/)
  assert.match(source, /\/api\/kompas\/answer/)
  assert.doesNotMatch(source, /eyJ/)
})

test("idea F: offline mode needs no token, makes no call, and reports first-word and finish p50/p95 per mode", () => {
  const env = { ...process.env, KOMPAS_EVAL_OFFLINE: "1", KOMPAS_BASE_URL: "http://127.0.0.1:9" }
  delete env.KOMPAS_EVAL_TOKEN
  delete env.KOMPAS_API_TOKEN
  const result = spawnSync(process.execPath, ["scripts/kompas-live-eval.mjs"], { encoding: "utf8", env, cwd: new URL("../..", import.meta.url) })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.match(report.mode, /offline.*NOT live answer quality/)
  assert.equal(report.origin, null)
  assert.equal(report.answers, 30)
  assert.equal(report.latency.reportingOnly, true)
  for (const level of ["engineer", "director", "architect"]) {
    const l = report.latency[level]
    assert.equal(l.n, 10)
    for (const key of ["firstWordMs", "finishMs"]) {
      assert.ok(Number.isFinite(l[key].p50) && Number.isFinite(l[key].p95), `${level} ${key}`)
      assert.ok(l[key].p95 >= l[key].p50, `${level} ${key}`)
    }
    assert.ok(l.finishMs.p50 >= l.firstWordMs.p50)
  }
})

test("idea F failsafe: without the offline flag a missing token still exits 2 before any call", () => {
  const env = { ...process.env, KOMPAS_EVAL_OFFLINE: "0" }
  delete env.KOMPAS_EVAL_TOKEN
  const result = spawnSync(process.execPath, ["scripts/kompas-live-eval.mjs"], { encoding: "utf8", env, cwd: new URL("../..", import.meta.url) })
  assert.equal(result.status, 2)
  assert.doesNotMatch(`${result.stderr}${result.stdout}`, /asking |latency/)
})
