import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

test('Plan & Vision TypeScript source parses without syntax diagnostics', () => {
  const file = resolve(process.cwd(), 'src/lib/plan-vision.ts')
  const source = readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\\n')).join('\\n'))
  assert.match(source, /export const PRODUCT_PLANS: ProductPlan\\[\\] = \\[/)
})
