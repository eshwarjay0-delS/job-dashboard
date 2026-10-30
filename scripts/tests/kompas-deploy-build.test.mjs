import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Vercel must use the same verified Webpack build mode as CI',()=>{
  const vercel=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.equal(vercel.buildCommand,'npm run build -- --webpack')
  assert.equal(vercel.framework,'nextjs')
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'))
  assert.equal(pkg.scripts.prebuild,'node scripts/kompas-baseline.mjs && node --test scripts/tests/whatsapp-resume-acceptance.test.mjs scripts/tests/whatsapp-recovery-durability.test.mjs scripts/tests/storage-prefix-recovery.test.mjs scripts/tests/whatsapp-resume-contract.test.mjs && node --test scripts/tests/kompas-dual-dossier.test.mjs')
  assert.equal(pkg.scripts.build,'node scripts/stamp-version.mjs && next build')
})

test('CI and Vercel agree on Webpack to prevent intermittent Turbopack font failures',()=>{
  const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8')
  const v=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.match(ci,/npm run build -- --webpack/)
  assert.match(v.buildCommand,/--webpack/)
})
