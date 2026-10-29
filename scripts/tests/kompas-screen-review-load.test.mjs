import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const fnSrc = app.slice(app.indexOf('async function ensureScreenReview()'), app.indexOf('/* ---- Follow along:'))

function setup({ reviewPresent = false, failOn = null, setReviewAfterLoad = true } = {}) {
  const created = []
  const window = reviewPresent ? { KompasScreenReview: () => {} } : {}
  const head = {
    appendChild: (tag) => {
      created.push(tag.src)
      queueMicrotask(() => {
        if (failOn === tag.src) { tag.onerror && tag.onerror() }
        else {
          if (setReviewAfterLoad && tag.src === 'screen-review.js') window.KompasScreenReview = () => {}
          tag.onload && tag.onload()
        }
      })
    },
  }
  const ctx = vm.createContext({ window, document: { createElement: () => ({}), head } })
  vm.runInContext(fnSrc, ctx)
  return { ctx, window, created }
}

test('review already present needs no script load', async () => {
  const { ctx, created } = setup({ reviewPresent: true })
  assert.equal(await ctx.ensureScreenReview(), true)
  assert.equal(created.length, 0)
})

test('missing review loads core then review in order and recovers', async () => {
  const { ctx, window, created } = setup()
  assert.equal(await ctx.ensureScreenReview(), true)
  assert.deepEqual(created, ['screen-core.js', 'screen-review.js'])
  assert.equal(typeof window.KompasScreenReview, 'function')
})

test('a failed script load fails recovery without trying the second script', async () => {
  const { ctx, created } = setup({ failOn: 'screen-core.js' })
  assert.equal(await ctx.ensureScreenReview(), false)
  assert.deepEqual(created, ['screen-core.js'])
})

test('loads that still leave the review missing fail recovery', async () => {
  const { ctx } = setup({ setReviewAfterLoad: false })
  assert.equal(await ctx.ensureScreenReview(), false)
})

test('no usable document fails recovery instead of throwing', async () => {
  const ctx = vm.createContext({ window: {} })
  vm.runInContext(fnSrc, ctx)
  assert.equal(await ctx.ensureScreenReview(), false)
})

test('the screen flow never opens the review dialog', () => {
  assert.doesNotMatch(app, /KompasScreenReview\(\{ image, tasks: data\.tasks/)
  assert.doesNotMatch(app, /Screen review could not open/)
})
