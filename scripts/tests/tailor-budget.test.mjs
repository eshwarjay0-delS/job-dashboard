// The first split draft must keep most of a WhatsApp call. A 60% repair
// reserve assembled the draft while role calls were still running.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
function load(rel) {
  const source = readFileSync(resolve(root, rel), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports } }, { filename: rel })
  return exports
}
const { firstDraftRepairReserveMs } = load('src/lib/tailor-budget.ts')
const tailor = readFileSync(resolve(root, 'src/lib/tailor.ts'), 'utf8')

test('a 195s WhatsApp call keeps the first draft until 150s and repairs for 45s', () => {
  assert.equal(firstDraftRepairReserveMs(195_000), 45_000)
  assert.equal(195_000 - firstDraftRepairReserveMs(195_000), 150_000)
})

test('the reserve never takes 60 percent of a long call', () => {
  for (const budget of [52_000, 120_000, 195_000, 240_000]) {
    const reserve = firstDraftRepairReserveMs(budget)
    assert.ok(reserve <= 45_000, String(budget))
    assert.ok(reserve <= budget * 0.25, String(budget))
    assert.ok(budget - reserve > budget * 0.5, String(budget))
  }
})

test('a short call still leaves a repair window without going negative', () => {
  assert.equal(firstDraftRepairReserveMs(10_000), 2_500)
  assert.equal(firstDraftRepairReserveMs(0), 0)
  assert.equal(firstDraftRepairReserveMs(Number.NaN), 0)
})

test('the tailor uses that reserve and does not mark every review blocker unfinished', () => {
  assert.match(tailor, /firstDraftRepairReserveMs\(TAILOR_MAX_MS\)/)
  assert.doesNotMatch(tailor, /Math\.min\(150000, Math\.floor\(TAILOR_MAX_MS \* \.6\)\)/)
  assert.match(tailor, /unfinished: writersUnfinished/)
  assert.match(tailor, /const writersUnfinished = !!\(best\.partial \|\| skillsOnly\)/)
  assert.match(tailor, /if \(refused \* 2 > total\) throw new Error\(`Tailoring incomplete/)
})
