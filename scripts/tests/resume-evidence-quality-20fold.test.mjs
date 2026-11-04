// Twenty varied real DOCX/export/outage regressions. No live model quality claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { RESUME } from './helpers/resume-floor-run.mjs'
const project = fileURLToPath(new URL('../../', import.meta.url))
const cwd = mkdtempSync(path.join(os.tmpdir(), 'mf-quality20-'))
let runs
try {
  const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', pathToFileURL(path.join(project, 'scripts/tests/helpers/ts-alias-hooks.mjs')).href, path.join(project, 'scripts/tests/helpers/resume-floor-run.mjs')], {
    cwd, env: { PATH: process.env.PATH, PROJECT_DIR: project, FLOOR_CASES: 'quality20' }, encoding: 'utf8', timeout: 120000,
  })
  assert.equal(r.status, 0, r.stderr)
  runs = JSON.parse(r.stdout.trim().split('\n').pop())
} finally { rmSync(cwd, { recursive: true, force: true }) }
assert.equal(Object.keys(runs).length, 20)
for (const [name, r] of Object.entries(runs)) test(`export ${name}: no JD-only claims or invented completion, exact measured score, preserved facts/layout`, () => {
  const before = new Set(r.beforeShown)
  assert.deepEqual(r.shown.filter(k => !before.has(k)), [], 'outage cannot add unsupported requirements')
  assert.equal(r.coverage, Math.floor(r.measured * 1000) / 10, 'report measures exported DOCX')
  assert.equal(r.status, 'needs_review', 'provider outage never counts as completed tailoring')
  assert.ok(r.blockers.includes('skills_only'))
  assert.deepEqual(r.bullets, RESUME.filter(l => l.startsWith('•')), 'retain all original numbers and work claims')
  assert.equal(r.email, 'jordan.test@example.com')
  for (const line of RESUME.filter(l => /Jan 2022|Mar 2019|Jun 2016/.test(l))) assert.ok(r.text.includes(line), 'title/employer/date preserved')
  for (const h of ['Identity & Access Management:', 'Security Operations:', 'Languages:', 'Cloud & Scripting:', 'Governance & Compliance:']) assert.ok(r.boldHeads.includes(h))
  assert.deepEqual(r.placed, [])
  assert.deepEqual(r.placedSummary, [])
})
