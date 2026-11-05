import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const ts = require('typescript')
let bytes = Buffer.from('supported export')
const source = readFileSync(new URL('../../src/lib/made-floor.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.runInNewContext(compiled, { exports, module: { exports }, require: n => {
  if (n === './storage') return { readPath: async () => bytes }
  if (n === './docx') return { extractText: async () => 'python' }
  if (n === './keywords') return { extractJdKeywords: jd => jd ? ['python'] : [], coveredJdKeywords: (_t, terms) => new Set(terms) }
  if (n === './keyword-targets') return { floorTerms: (_jd, terms) => terms, targetKeywords: terms => terms }
  return require(n)
} })
const { madeMeetsFloor, floorShare } = exports
const receipt = 'evidence-v1:' + createHash('sha256').update(bytes).digest('hex')
test('legacy 100% overlap saved file is not reused without evidence receipt', async () => {
  assert.equal(await madeMeetsFloor('/resume.docx', 'python', Date.now()), false)
})
test('complete export receipt permits unchanged matching file', async () => {
  assert.equal(await madeMeetsFloor('/resume.docx', 'python', 0, receipt), true)
})
test('changed bytes cannot inherit the prior quality receipt', async () => {
  bytes = Buffer.from('changed export')
  assert.equal(await madeMeetsFloor('/resume.docx', 'python', 0, receipt), false)
})
test('empty JD denominator is not perfect matching', () => assert.equal(floorShare('python', ''), 0))
