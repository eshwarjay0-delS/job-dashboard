// A follow-up continues what the previous answer concluded. Measured 26 Oct 2026 (evaluation round 2): the desktop
// sent only the first 900 characters of each earlier answer, so a recursive follow-up never saw the root cause the
// previous turn had reached at its end, and changed it (hitachi-grc-4, azure-security-5, microsegmentation-5).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const fn = app.slice(app.indexOf('function headAndTail('), app.indexOf('\n}', app.indexOf('function headAndTail(')) + 2)
const headAndTail = vm.runInNewContext(`(${fn})`)

test('an earlier answer keeps its opening and its conclusion', () => {
  const answer = 'Opening: the first hypothesis is clock drift. ' + 'Detail. '.repeat(600) + 'Conclusion: the root cause was the manual role deletion.'
  const out = headAndTail(answer, 2400)
  assert.ok(out.length <= 2400)
  assert.match(out, /^Opening: the first hypothesis/)
  assert.match(out, /root cause was the manual role deletion\.$/)
  assert.equal(headAndTail('short answer', 2400), 'short answer')
})

test('recentQA sends head and tail, never only the first 900 characters', () => {
  const body = app.slice(app.indexOf('function recentQA('), app.indexOf('function headAndTail('))
  assert.match(body, /headAndTail\(plainAnswer\(c\.answer\), 2400\)/)
  assert.ok(!body.includes('slice(0, 900)'))
})
