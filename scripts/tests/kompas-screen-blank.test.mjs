// Owner, 28 Oct 2026: a window that opted out of capture comes back as one flat colour, usually
// black, and must be named as such instead of being sent to vision as if it held a question.
// Capture itself never interrupts the user: no dialogs, no focus steal, no prompts in the path.
// The flatness check lives inside grabFrame because suites run that function on its own.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const grabSrc = app.slice(app.indexOf('async function grabFrame()'), app.indexOf('async function screenStream()'))
async function grab(pixels) {
  let paused = false, drawn = false
  const track = { readyState: 'live' }
  const video = { muted: false, playsInline: false, readyState: 2, videoWidth: 1920, videoHeight: 1080, play: async () => {}, pause: () => { paused = true } }
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => { drawn = true }, getImageData: () => ({ data: Uint8ClampedArray.from(pixels) }) }), toDataURL: () => 'frame' }
  const ctx = vm.createContext({ displayVideo: track, navigator: { mediaDevices: { getDisplayMedia: async () => ({ getVideoTracks: () => [track] }) } }, document: { createElement: (t) => t === 'video' ? video : canvas }, MediaStream: class {}, setTimeout })
  vm.runInContext(grabSrc, ctx)
  const out = await ctx.grabFrame().then(
    (v) => ({ ok: true, value: v, paused, drawn }),
    (e) => ({ ok: false, error: e, paused, drawn }),
  )
  return out
}
const px = (r, g, b) => [r, g, b, 255]
const flat = (n, c) => Array.from({ length: n }, () => px(...c)).flat()

test('a flat frame is a protected window, whatever its colour', async () => {
  for (const colour of [[0, 0, 0], [255, 255, 255], [128, 128, 128]]) {
    const r = await grab(flat(4, colour))
    assert.equal(r.ok, false)
    assert.match(r.error.message, /opted out of screen capture/)
    assert.match(r.error.message, /Running as administrator does not change that/)
    assert.equal(r.paused, true)
  }
})

test('any real content breaks the flatness and captures', async () => {
  const r = await grab([...flat(3, [0, 0, 0]), ...px(255, 255, 255)])
  assert.equal(r.ok, true)
  assert.equal(r.value, 'frame')
  assert.equal(r.drawn, true)
  assert.equal(r.paused, true)
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
