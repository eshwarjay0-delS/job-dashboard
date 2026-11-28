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
  const groups=pkg.scripts.prebuild.split(/\s*&&\s*/).map(s=>s.trim()).filter(Boolean)
  assert.equal(groups[0],'node scripts/kompas-baseline.mjs')
  const required=[
    {runner:'node --test',files:['scripts/tests/resume-guards.test.mjs','scripts/tests/whatsapp-gap-report.test.mjs','scripts/tests/dashboard-shell.test.mjs','scripts/tests/role-match.test.mjs']},
    {runner:'node --test',files:['scripts/tests/whatsapp-resume-acceptance.test.mjs','scripts/tests/tailor-ship-on-rollback.test.mjs','scripts/tests/whatsapp-recovery-durability.test.mjs','scripts/tests/storage-prefix-recovery.test.mjs','scripts/tests/whatsapp-resume-contract.test.mjs']},
    {runner:'node --test',files:['scripts/tests/kompas-dual-dossier.test.mjs','scripts/tests/kompas-master-bible.test.mjs','scripts/tests/kompas-metric-evidence-contract.test.mjs']},
    {runner:'node --experimental-strip-types --test',files:['scripts/tests/contract-search.test.mjs','scripts/tests/apply-clearance-filter.test.mjs','scripts/tests/auth-disabled-access-token.test.mjs','scripts/tests/mail-digest-account-isolation.test.mjs']},
  ]
  const testGroups=groups.slice(1)
  assert.ok(testGroups.length>=required.length,'prebuild must keep all required regression groups')
  for(const group of testGroups) assert.match(group,/^node (?:--experimental-strip-types )?--test\s+/,'every prebuild test group must execute through Node test runner')
  for(const expected of required){
    const found=testGroups.some(group=>{
      const parts=group.split(/\s+/)
      const runner=parts.slice(0,expected.runner.split(/\s+/).length).join(' ')
      const files=parts.filter(part=>part.startsWith('scripts/tests/'))
      return runner===expected.runner && expected.files.every(file=>files.includes(file))
    })
    assert.ok(found,'prebuild is missing required regression group: '+expected.files.join(', '))
  }
  assert.equal(pkg.scripts.build,'node scripts/stamp-version.mjs && next build')
})

test('CI and Vercel agree on Webpack to prevent intermittent Turbopack font failures',()=>{
  const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8')
  const v=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.match(ci,/npm run build -- --webpack/)
  assert.match(v.buildCommand,/--webpack/)
})
