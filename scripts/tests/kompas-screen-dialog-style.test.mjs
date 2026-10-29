import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../../public/kompas/styles.css', import.meta.url), 'utf8')

test('review dialog carries explicit colors, never theme variables', () => {
  assert.match(css, /\.screen-review\{[^}]*background:#17212b;color:#f1f5f9\}/)
  assert.doesNotMatch(css, /\.screen-review\{[^}]*var\(--bg/)
  assert.doesNotMatch(css, /\.screen-review\{[^}]*var\(--text/)
})

test('review dialog heading stays readable on the dark dialog', () => {
  assert.match(css, /\.screen-review h2\{color:#f1f5f9\}/)
})
