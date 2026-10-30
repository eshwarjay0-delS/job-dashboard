// The 29 Oct 2026 production refusal, through the real runTailor floor (no AI provider): a post asking for "gcp security"
// and "gcp iam", which the resume never shows. Eshwar: "If it is mentioned in JD that presented then it is our
// responsibility to include it in the updated resume every time". Switch on (JD_TERMS_ALWAYS_ON_SKILLS, default): both
// terms are on the skills line and the WhatsApp gate sends the file. Locked skills: the file goes out unchanged in that
// respect, with the terms named in the reply. Switch off: the old behaviour, the terms are not placed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const PROJECT = fileURLToPath(new URL('../../', import.meta.url))
const HOOKS = pathToFileURL(fileURLToPath(new URL('./helpers/ts-alias-hooks.mjs', import.meta.url))).href
const RUN = fileURLToPath(new URL('./helpers/resume-floor-run.mjs', import.meta.url))

function floor(extraEnv = {}) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'mf-gate-'))
  try {
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PROJECT_DIR: PROJECT, FLOOR_CASES: 'gate', ...extraEnv }
    const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', HOOKS, RUN], { cwd, env, encoding: 'utf8', timeout: 120000 })
    const line = (r.stdout || '').trim().split('\n').pop()
    if (!line || !line.startsWith('{')) throw new Error(`the floor run printed nothing usable: ${(r.stderr || '').slice(-1500)}`)
    return JSON.parse(line)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}
function acceptance(env) {
  const source = readFileSync(new URL('../../src/lib/whatsapp-resume-acceptance.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require, process: { env } })
  return exports
}
const skillsOf = r => r.skills.join('\n').toLowerCase()
const on = floor()
const off = floor({ JD_TERMS_ALWAYS_ON_SKILLS: '0' })

test('switch on: gcp security and gcp iam are written on the skills line and the file is sent', () => {
  const r = on.gcp
  for (const t of ['gcp security', 'gcp iam']) assert.ok(skillsOf(r).includes(t), `${t} on the skills line: ${r.skills.join(' | ')}`)
  assert.ok(!r.bullets.some(b => /gcp/i.test(b)), 'never in an experience bullet')
  assert.deepEqual(r.unverified, [])
  const { acceptableWhatsAppResume, whatsappResumeRejectionReasons } = acceptance({})
  const result = { token: 't', coverage: r.coverage, supported_coverage: 100, diff: r.diff, quality: r.quality, partial: r.partial, skills_only: r.skillsOnlyFlag,
    unverified_added_keywords: r.unverified, quality_blockers: r.blockers, jd_terms_unplaced: r.unplaced, jd_terms_unplaced_reason: r.unplacedReason || undefined }
  assert.equal(acceptableWhatsAppResume(result), true, whatsappResumeRejectionReasons(result).join(', '))
})
test('switch on, skills locked: the skills line is left alone and the terms are named for the reply', () => {
  const r = on.gcpLocked
  assert.ok(!skillsOf(r).includes('gcp'), r.skills.join(' | '))
  assert.equal(r.unplacedReason, 'skills_locked')
  const named = r.unplaced.map(t => t.toLowerCase())
  assert.ok(named.includes('gcp security') && named.includes('gcp iam'), r.unplaced.join(', '))
})
test('switch off: the job-post-only terms are not placed (old behaviour)', () => {
  const r = off.gcp
  assert.ok(!skillsOf(r).includes('gcp iam'), r.skills.join(' | '))
  assert.equal(r.unplacedReason, null)
})
