import "./kompas-account-sync.test.mjs" // Cross-device sessions must pass on every verified build.
import "./kompas-desktop-ticket.test.mjs" // Keep the connector regression in the existing CI gate
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function assertRequiredPrebuildContract(prebuild) {
  const commands = prebuild.split(/\s*&&\s*/).map(command => command.trim()).filter(Boolean)
  assert.equal(commands[0], 'node scripts/kompas-baseline.mjs', 'the Kompas baseline must remain the first fail-fast prebuild step')
  const testCommands = commands.filter(command => /^node --test(?:\s|$)/.test(command))
  const requiredGroups = [
    ['scripts/tests/resume-guards.test.mjs', 'scripts/tests/whatsapp-gap-report.test.mjs'],
    ['scripts/tests/whatsapp-resume-acceptance.test.mjs', 'scripts/tests/tailor-ship-on-rollback.test.mjs', 'scripts/tests/whatsapp-recovery-durability.test.mjs', 'scripts/tests/storage-prefix-recovery.test.mjs', 'scripts/tests/whatsapp-resume-contract.test.mjs'],
    ['scripts/tests/kompas-dual-dossier.test.mjs', 'scripts/tests/kompas-master-bible.test.mjs', 'scripts/tests/kompas-metric-evidence-contract.test.mjs']
  ]
  let previous = -1
  for (const group of requiredGroups) {
    const next = testCommands.findIndex((command, index) => index > previous && group.every(file => command.split(/\s+/).includes(file)))
    assert.ok(next > previous, `prebuild must retain the ordered required regression group: ${group.join(', ')}`)
    previous = next
  }
}

test('Vercel must use the same verified Webpack build mode as CI', () => {
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.equal(vercel.buildCommand, 'npm run build -- --webpack')
  assert.equal(vercel.framework, 'nextjs')
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  assertRequiredPrebuildContract(pkg.scripts.prebuild)
  assert.equal(pkg.scripts.build, 'node scripts/stamp-version.mjs && next build')
})

test('prebuild permits additive regression files without dropping existing gates', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  const base = pkg.scripts.prebuild
  const additions = [
    'scripts/tests/crawl-classify.test.mjs',
    'scripts/tests/dashboard-shell.test.mjs'
  ]
  for (const file of additions) {
    const augmented = base.replace(
      'scripts/tests/whatsapp-gap-report.test.mjs',
      `scripts/tests/whatsapp-gap-report.test.mjs ${file}`
    )
    assertRequiredPrebuildContract(augmented)
  }
})

test('CI and Vercel agree on Webpack to prevent intermittent Turbopack font failures', () => {
  const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.match(ci, /npm run build -- --webpack/)
  assert.match(v.buildCommand, /--webpack/)
})


test('resume profile gap suites remain part of fail-fast prebuild', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  for (const file of ['scripts/tests/resume-confirmation-quality.test.mjs', 'scripts/tests/tailor-profile-gap-fill.test.mjs']) {
    assert.ok(pkg.scripts.prebuild.split(/\\s+/).includes(file), `prebuild must execute ${file}`)
  }
})
