// Captions-first screen capture, remembered taskbar hide, WASAPI loopback,
// and an asInvoker manifest. Caption-once stays strict. Question intake is
// not edited here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { asInvokerManifest } from '../../legacy/perfact/desktop/scripts/execution-level.mjs'

const require = createRequire(import.meta.url)
const { chooseCaptureSource, isWindowsLiveCaption } = require('../../legacy/perfact/desktop/capture-source.cjs')
const { rememberedTaskbar, taskbarAnswer } = require('../../legacy/perfact/desktop/taskbar-choice.cjs')

const caption = { id: 'window:1:0', name: 'Windows Live Captions', kind: 'window', thumbnail: { isEmpty: () => false } }
const meet = { id: 'window:2:0', name: 'Meet - Interview', kind: 'window', thumbnail: { isEmpty: () => false } }
const kompas = { id: 'window:3:0', name: 'Kompas', kind: 'window' }
const primary = { id: 'screen:0:0', name: 'Screen 1', kind: 'screen', display_id: '10' }
const other = { id: 'screen:1:0', name: 'Screen 2', kind: 'screen', display_id: '11' }

test('a single Live Captions window is chosen before other windows and screens', () => {
  assert.equal(isWindowsLiveCaption('Live Captions'), true)
  assert.equal(isWindowsLiveCaption('Windows Live Caption'), true)
  assert.equal(isWindowsLiveCaption('Meet - Live Captions'), false)
  const picked = chooseCaptureSource([meet, kompas, other, caption, primary], { primaryDisplayId: '10' })
  assert.equal(picked.kind, 'caption')
  assert.equal(picked.source, caption)
})

test('without a unique caption window the topmost other window is next, then the primary screen', () => {
  const two = [
    { ...caption, id: 'window:9:0', name: 'Live Captions' },
    { ...caption, id: 'window:8:0', name: 'Live Caption' },
    meet,
    primary,
  ]
  const windowFirst = chooseCaptureSource(two, { primaryDisplayId: '10' })
  assert.equal(windowFirst.kind, 'window')
  assert.equal(windowFirst.source, meet)
  const screenOnly = chooseCaptureSource([kompas, other, primary], { primaryDisplayId: '10' })
  assert.equal(screenOnly.kind, 'screen')
  assert.equal(screenOnly.source, primary)
  assert.equal(chooseCaptureSource([kompas]).kind, 'none')
})

test('a blank caption thumbnail falls through instead of returning an empty frame', () => {
  const blank = { ...caption, thumbnail: { isEmpty: () => true } }
  const picked = chooseCaptureSource([blank, meet, primary], { primaryDisplayId: '10' })
  assert.equal(picked.kind, 'window')
  assert.equal(picked.source, meet)
})

test('a yes hide is kept and a no is asked again', () => {
  assert.deepEqual(rememberedTaskbar({ hideTaskbar: true, hideTaskbarRemembered: true }), { ask: false, hide: true })
  assert.deepEqual(rememberedTaskbar({ hideTaskbar: false, hideTaskbarRemembered: true }), { ask: true, hide: null })
  assert.deepEqual(rememberedTaskbar({ hideTaskbar: true }), { ask: true, hide: null })
  assert.deepEqual(rememberedTaskbar({}), { ask: true, hide: null })
  assert.deepEqual(taskbarAnswer(0, false), { hide: true, remember: true })
  assert.deepEqual(taskbarAnswer(1, true), { hide: false, remember: false })
})

test('the packaged manifest is rewritten to asInvoker and not to administrator', () => {
  const xml = '<requestedExecutionLevel level="highestAvailable" uiAccess="false"/>'
  const next = asInvokerManifest(xml)
  assert.match(next, /level="asInvoker"/)
  assert.equal(asInvokerManifest(next), next)
  assert.equal(asInvokerManifest('<assembly></assembly>'), '<assembly></assembly>')
  const runtime = readFileSync(new URL('../../legacy/perfact/desktop/scripts/runtime.mjs', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../../legacy/perfact/desktop/main.js', import.meta.url), 'utf8')
  assert.match(runtime, /asInvokerManifest\(xml\)/)
  assert.doesNotMatch(runtime, /highestAvailable/)
  assert.match(main, /audio: "loopback"/)
  assert.match(main, /setDisplayMediaRequestHandler/)
  assert.match(main, /types: \["screen"\]/)
  assert.match(main, /if \(matched\.length !== 1\)/)
})
