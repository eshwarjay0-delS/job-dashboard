// Owner, 28 Oct 2026: a window that opted out of capture comes back as one flat colour, usually
// black, and must be named as such instead of being sent to vision as if it held a question.
// Capture itself never interrupts the user: no dialogs, no focus steal, no prompts in the path.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const fnSrc = (name) => { let s = app.indexOf(`function ${name}(`); assert.ok(s >= 0, name); if (app.slice(s - 6, s) === 'async ') s -= 6; return app.slice(s, app.indexOf('\n}', s) + 2) }
function isBlank(pixels) {
  const ctx = { data: Uint8ClampedArray.from(pixels) }
  vm.createContext(ctx)
  vm.runInContext(fnSrc('isBlankFrame'), ctx)
  return vm.runInContext('isBlankFrame(data)', ctx)
}
const px = (r, g, b) => [r, g, b, 255]
const flat = (n, c) => Array.from({ length: n }, () => px(...c)).flat()

test('a flat frame is blank whatever its colour', () => {
  assert.equal(isBlank(flat(4, [0, 0, 0])), true)
  assert.equal(isBlank(flat(4, [255, 255, 255])), true)
  assert.equal(isBlank(flat(4, [128, 128, 128])), true)
  assert.equal(isBlank([]), true)
  assert.equal(isBlank(flat(1, [0, 0, 0])), true)
})

test('any real content breaks the flatness', () => {
  assert.equal(isBlank([...flat(3, [0, 0, 0]), ...px(255, 255, 255)]), false)
  assert.equal(isBlank([...px(0, 0, 0), ...px(20, 20, 20)]), false)
  assert.equal(isBlank([...flat(2, [30, 30, 30]), ...px(30, 30, 45)]), false)
})

test('the capture path checks the frame and names a protected window', () => {
  const grab = app.slice(app.indexOf('async function grabFrame'), app.indexOf('async function screenStream'))
  assert.match(grab, /isBlankFrame\(context\.getImageData\(0, 0, c\.width, c\.height\)\.data\)/)
  assert.match(grab, /This window opted out of screen capture/)
  assert.match(grab, /Running as administrator does not change that/)
})

test('capture never interrupts the user with a dialog or a focus steal', () => {
  const path = app.slice(app.indexOf('async function grabFrame'), app.indexOf('/* ---- Follow along'))
  assert.doesNotMatch(path, /alert\(|confirm\(|prompt\(/)
  assert.doesNotMatch(path, /\.focus\(\)/)
})

test('review crops by region, so a question area is captured, not just the whole screen', () => {
  const review = readFileSync(new URL('../../public/kompas/screen-review.js', import.meta.url), 'utf8')
  assert.match(review, /function crop\(image,bounds\)/)
  assert.match(app, /KompasScreenReview\(\{ image, tasks: data\.tasks/)
})
