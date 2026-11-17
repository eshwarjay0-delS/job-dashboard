import "./kompas-account-sync.test.mjs" // Cross-device sessions must pass on every verified build.
import "./kompas-desktop-ticket.test.mjs" // Keep the connector regression in the existing CI gate
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Vercel must use the same verified Webpack build mode as CI',()=>{
  const vercel=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.equal(vercel.buildCommand,'npm run build -- --webpack')
  assert.equal(vercel.framework,'nextjs')
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'))
  const prebuild=pkg.scripts.prebuild
  assert.ok(prebuild.startsWith('node scripts/kompas-baseline.mjs && '),
    'the shared Kompas baseline must remain the first prebuild gate')
  for (const suite of [
    'scripts/tests/google-workspace-no-hard-cap.test.mjs',
    'scripts/tests/mail-updates.test.mjs',
    'scripts/tests/resume-guards.test.mjs',
    'scripts/tests/whatsapp-gap-report.test.mjs',
    'scripts/tests/whatsapp-resume-acceptance.test.mjs',
    'scripts/tests/tailor-ship-on-rollback.test.mjs',
    'scripts/tests/whatsapp-recovery-durability.test.mjs',
    'scripts/tests/storage-prefix-recovery.test.mjs',
    'scripts/tests/whatsapp-resume-contract.test.mjs',
    'scripts/tests/kompas-dual-dossier.test.mjs',
    'scripts/tests/kompas-master-bible.test.mjs',
    'scripts/tests/kompas-metric-evidence-contract.test.mjs',
  ]) {
    assert.ok(prebuild.includes(suite), `prebuild must include ${suite}`)
  }
  assert.equal(pkg.scripts.build,'node scripts/stamp-version.mjs && next build')
})

test('CI and Vercel agree on Webpack to prevent intermittent Turbopack font failures',()=>{
  const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8')
  const v=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.match(ci,/npm run build -- --webpack/)
  assert.match(v.buildCommand,/--webpack/)
})
