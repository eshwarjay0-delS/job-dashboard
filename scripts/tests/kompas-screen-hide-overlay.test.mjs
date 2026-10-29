import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const code = app.slice(app.indexOf('async function analyseScreen()'), app.indexOf('/* ---- Follow along:'))

function baseContext(overrides = {}) {
  return vm.createContext({
    current: { id: 'a' }, aiBusy: false, aiBusySince: 0, AbortSignal,
    addCard: () => ({}), renderCard: () => {}, performance: { now: () => 0 },
    slimPrep: () => ({}), liveConfig: () => ({}), cards: [], idx: 0,
    generateAnswer: async () => {},
    ...overrides,
  })
}

test('overlay hides only for the grab and is restored after', async () => {
  const card = {}
  const overlay = { style: { visibility: 'visible' } }
  let seenDuringGrab = null
  const ctx = baseContext({
    addCard: () => card,
    cards: [card],
    grabFrame: async () => { seenDuringGrab = overlay.style.visibility; return 'frame' },
    fetch: async () => ({ ok: true, json: async () => ({ needsAnswer: true, question: 'Q' }) }),
    document: { getElementById: (id) => (id === 'overlay' ? overlay : null) },
  })
  vm.runInContext(code, ctx)
  await ctx.analyseScreen()
  assert.equal(seenDuringGrab, 'hidden')
  assert.equal(overlay.style.visibility, 'visible')
})

test('overlay is restored when the grab fails', async () => {
  const card = {}
  const overlay = { style: { visibility: '' } }
  const ctx = baseContext({
    addCard: () => card,
    cards: [card],
    grabFrame: async () => { throw new Error('grab failed') },
    document: { getElementById: () => overlay },
  })
  vm.runInContext(code, ctx)
  await ctx.analyseScreen()
  assert.equal(overlay.style.visibility, '')
  assert.match(String(card.answer), /Couldn't capture the screen/)
})

test('missing overlay or missing document never breaks the capture', async () => {
  for (const document of [{ getElementById: () => null }, undefined]) {
    const card = {}
    let answered = false
    const overrides = {
      addCard: () => card,
      cards: [card],
      grabFrame: async () => 'frame',
      fetch: async () => ({ ok: true, json: async () => ({ needsAnswer: true, question: 'Q' }) }),
      generateAnswer: async () => { answered = true },
    }
    if (document !== undefined) overrides.document = document
    const ctx = baseContext(overrides)
    vm.runInContext(code, ctx)
    await ctx.analyseScreen()
    assert.equal(answered, true)
  }
})

test('the hide wraps the grab in source', () => {
  assert.match(app, /style\.visibility = "hidden"/)
  assert.match(app, /try \{ image = await grabFrame\(\); \} finally \{ if \(canHide\) overlayEl\.style\.visibility = prevVisibility; \}/)
})
