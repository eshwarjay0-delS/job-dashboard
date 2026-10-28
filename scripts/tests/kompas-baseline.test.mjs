// The Kompas baseline contract (scripts/kompas-baseline.mjs) also runs with the test suite, so a change that breaks
// the owner's baseline fails here before it ever reaches the build gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('the Kompas baseline contract holds', () => {
  const script = fileURLToPath(new URL('../kompas-baseline.mjs', import.meta.url))
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.match(run.stdout, /Kompas baseline contract: \d+ checks hold\./)
})
