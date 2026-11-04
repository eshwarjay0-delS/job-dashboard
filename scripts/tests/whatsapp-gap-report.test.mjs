import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const route = readFileSync('src/app/api/whatsapp/webhook/route.ts', 'utf8')
const start = route.indexOf('function resumeGapReport(')
const end = route.indexOf('\n// The send check.', start)
assert.ok(start > 0 && end > start)
const compiled = ts.transpileModule(route.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const report = vm.runInNewContext(compiled + '\nresumeGapReport')
const good = () => ({ coverage: 100, supported_coverage: 100, keyword_analysis: { matched: ['DNS'], added: ['TLS'], missing: [] }, quality: { status: 'coverage_met', incomplete: false } })
for (const [name, override] of [
  ['unverified added claim', { unverified_added_keywords: ['CyberArk'] }],
  ['quality blocker', { quality_blockers: ['identity'] }],
  ['incomplete quality', { quality: { status: 'coverage_met', incomplete: true } }],
  ['needs review quality', { quality: { status: 'needs_review' } }],
  ['missing measurement', { coverage: undefined }],
  ['zero coverage', { coverage: 0 }],
  ['above 100 invalid', { coverage: 101 }],
  ['negative supported coverage', { supported_coverage: -1 }],
  ['partial rewrite', { partial: { failed: 1, total: 2 } }],
  ['unchanged result', { unchanged: true }],
]) test('risk retained: ' + name, () => {
  const text = report({ ...good(), ...override })
  assert.match(text, /Risk: Needs review/)
  assert.doesNotMatch(text, /Keyword review passed/)
})
test('long source terms cannot truncate the risk or evidence warning', () => {
  const terms = Array.from({length: 40}, (_,i) => `${i}: ${'very long requirement '.repeat(50)}`)
  const text = report({ ...good(), keyword_analysis: { matched: terms, added: terms, missing: terms }, unverified_added_keywords: terms })
  assert.ok(text.length <= 4000, `length ${text.length}`)
  assert.match(text, /Risk: Needs review/)
  assert.match(text, /not an employer ATS score/)
  assert.match(text, /Verify each added claim before applying/)
  assert.match(text, /more/)
})
test('complete measured result retains factual qualification', () => {
  const text = report(good())
  assert.match(text, /Keyword review passed; experience evidence still requires verification/)
  assert.match(text, /Estimated JD keyword coverage: 100%/)
})
test('invalid percentages are not printed as measured coverage', () => {
  const text = report({ ...good(), coverage: 101, supported_coverage: -4 })
  assert.match(text, /Estimated JD keyword coverage: Not measured/)
  assert.match(text, /Resume-supported coverage: Not measured/)
})
