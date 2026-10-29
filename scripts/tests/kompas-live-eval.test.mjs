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
