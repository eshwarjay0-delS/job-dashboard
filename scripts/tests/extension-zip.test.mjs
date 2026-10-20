// The extension people download is exactly the extension/ folder (scripts/build-extension-zip.mjs). Found 19 Oct 2026:
// the hand-made zip lacked trusted-url.js, so every install ran without the 2 Oct token hardening.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { extensionFiles, shippedBytes, ZIP_PATH } from '../build-extension-zip.mjs'

test('the downloadable zip holds exactly the extension folder, file for file', async () => {
  const zip = await JSZip.loadAsync(readFileSync(ZIP_PATH))
  const inZip = Object.values(zip.files).filter(f => !f.dir).map(f => f.name).sort()
  assert.deepEqual(inZip, extensionFiles().sort(), 'run: node scripts/build-extension-zip.mjs')
  for (const rel of inZip) {
    const shipped = Buffer.from(await zip.file(rel).async('uint8array'))
    assert.ok(shipped.equals(shippedBytes(rel)), `${rel} in the zip differs from extension/${rel}: run node scripts/build-extension-zip.mjs`)
  }
})

test('everything the extension loads is in the zip, the token guard included', async () => {
  const zip = await JSZip.loadAsync(readFileSync(ZIP_PATH))
  const has = name => !!zip.file(name)
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
  const loaded = [manifest.background?.service_worker, manifest.action?.default_popup, ...(manifest.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])])].filter(Boolean)
  for (const f of loaded) assert.ok(has(f), f)
  const background = await zip.file('background.js').async('string')
  for (const m of background.matchAll(/from\s+["']\.\/([^"']+)["']/g)) assert.ok(has(m[1]), `background.js imports ${m[1]}`)
  assert.ok(has('trusted-url.js'))
})
