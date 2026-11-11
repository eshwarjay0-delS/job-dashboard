import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

const script = new URL("../hobby-usage-guard.mjs", import.meta.url).pathname

function run(env, args = ["--health-only"]) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 8000,
  })
}

function dataUrl(body) {
  return "data:application/json," + encodeURIComponent(JSON.stringify(body))
}

test("health-only succeeds on 200 {ok:true} and fails when ok is false", () => {
  const good = run({ HEALTH_URL: dataUrl({ ok: true, app: "MarketFit" }) })
  assert.equal(good.status, 0, good.stderr + good.stdout)
  assert.match(good.stdout, /health ok/)
  const fail = run({ HEALTH_URL: dataUrl({ ok: false }) })
  assert.equal(fail.status, 1)
  assert.match(fail.stderr + fail.stdout, /health check failed/)
})
