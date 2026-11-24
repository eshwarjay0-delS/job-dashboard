import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

test('Plan & Vision TypeScript source parses on the workflow Node runtime', () => {
  const file = resolve(process.cwd(), 'src/lib/plan-vision.ts')
  const source = readFileSync(file, 'utf8')
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--check', file], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout || 'Node TypeScript syntax check failed')
  assert.ok(source.includes('export const PRODUCT_PLANS: ProductPlan[] = ['), 'PRODUCT_PLANS declaration is present')
})
