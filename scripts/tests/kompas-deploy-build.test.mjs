import "./kompas-account-sync.test.mjs" // Cross-device sessions must pass on every verified build.
import "./kompas-desktop-ticket.test.mjs" // Keep the connector regression in the existing CI gate
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authDisabledStamp, stampAuthFlag } from '../stamp-version.mjs'

test('Vercel must use the same verified Webpack build mode as CI',()=>{
  const vercel=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.equal(vercel.buildCommand,'npm run build -- --webpack')
  assert.equal(vercel.framework,'nextjs')
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'))
  assert.equal(pkg.scripts.prebuild,'node scripts/kompas-baseline.mjs && node --test scripts/tests/auth-disabled.test.mjs scripts/tests/kompas-deploy-build.test.mjs && node --test scripts/tests/resume-guards.test.mjs scripts/tests/whatsapp-gap-report.test.mjs && node --test scripts/tests/whatsapp-resume-acceptance.test.mjs scripts/tests/tailor-ship-on-rollback.test.mjs scripts/tests/whatsapp-recovery-durability.test.mjs scripts/tests/storage-prefix-recovery.test.mjs scripts/tests/whatsapp-resume-contract.test.mjs && node --test scripts/tests/kompas-dual-dossier.test.mjs scripts/tests/kompas-master-bible.test.mjs scripts/tests/kompas-metric-evidence-contract.test.mjs')
  assert.equal(pkg.scripts.build,'node scripts/stamp-version.mjs && next build')
})

test('CI and Vercel agree on Webpack to prevent intermittent Turbopack font failures',()=>{
  const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8')
  const v=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.match(ci,/npm run build -- --webpack/)
  assert.match(v.buildCommand,/--webpack/)
})


test('production builds cannot stamp a shared synthetic-owner login bypass', () => {
  assert.equal(authDisabledStamp({ NODE_ENV: 'production', AUTH_DISABLED: 'true' }), false)
  assert.equal(authDisabledStamp({ NODE_ENV: 'production', NEXT_PUBLIC_AUTH_DISABLED: 'true' }), false)
  assert.equal(authDisabledStamp({ NODE_ENV: 'development', AUTH_DISABLED: 'true' }), true)
  const dir = mkdtempSync(join(tmpdir(), 'mfit-auth-flag-'))
  const file = join(dir, 'auth-flag.js')
  try {
    assert.equal(stampAuthFlag({ env: { NODE_ENV: 'production', AUTH_DISABLED: 'true', NEXT_PUBLIC_AUTH_DISABLED: 'true' }, file, log: () => {} }), false)
    assert.equal(readFileSync(file, 'utf8'), 'window.KOMPAS_AUTH_DISABLED = false;\\n')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
