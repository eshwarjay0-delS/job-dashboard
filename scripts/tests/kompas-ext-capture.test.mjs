// Owner, 29 Oct 2026: the share picker must be automated away. The companion
// extension captures a tab (no share dialog) and hands the frame to the page
// through the document, where grabFrame consumes it. These pins hold the
// contract: no picker APIs, no broad access, one frame, one use.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dir = new URL('../../extensions/kompas-tab-capture/', import.meta.url)
const read = (f) => readFileSync(new URL(f, dir), 'utf8')
const manifest = JSON.parse(read('manifest.json'))
const background = read('background.js')
const offscreen = read('offscreen.js')
const content = read('content.js')

test('the companion needs no picker APIs and no broad access', () => {
  assert.equal(manifest.manifest_version, 3)
  assert.ok(manifest.permissions.includes('tabCapture'))
  assert.ok(manifest.permissions.includes('offscreen'))
  assert.ok(manifest.permissions.includes('activeTab'))
  assert.ok(!manifest.permissions.includes('tabs'))
  assert.ok(!manifest.permissions.includes('desktopCapture'))
  assert.ok(!manifest.permissions.includes('history'))
  assert.ok(manifest.content_scripts[0].matches.some((m) => m.includes('job-dashboard-fawn.vercel.app/kompas')))
})

test('arming captures the tab and delivery is one-use with a freshness limit', () => {
  assert.match(background, /getMediaStreamId/)
  assert.match(background, /kompas:frame-request/)
  assert.match(background, /10 \* 60 \* 1000/)
  assert.match(background, /armedFrame = null/)
})

test('the offscreen capture turns a tab stream into one JPEG frame', () => {
  assert.match(offscreen, /chromeMediaSource: "tab"/)
  assert.match(offscreen, /toDataURL\("image\/jpeg"/)
})

test('the page bridge delivers through the document, not a window property', () => {
  assert.match(content, /data-kompas-ext-frame/)
  assert.match(content, /addEventListener\("focus"/)
  assert.doesNotMatch(content, /__kompasExtFrame/)
})
