import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { PRODUCT_PLANS, productPlan, planImage, planText } from '../../src/lib/plan-vision.ts'

test('every plan exports the same workstreams, build steps and checks as its notes', () => {
  assert.deepEqual(PRODUCT_PLANS.map(p => p.id), ['gmail', 'applications', 'resume', 'kompas'])
  for (const p of PRODUCT_PLANS) {
    const md = planText(p)
    const svg = new JSDOM(planImage(p), { contentType: 'image/svg+xml' }).window.document
    assert.equal(svg.querySelector('parsererror'), null)
    assert.equal(svg.querySelectorAll('script, foreignObject, image').length, 0)
    for (const b of p.branches) {
      assert.ok(md.includes(b.title))
      assert.ok(svg.documentElement.textContent.includes(b.title))
      for (const n of b.notes) assert.ok(md.includes(n))
    }
    for (const c of [...p.phases, ...p.acceptance]) assert.ok(md.includes(c))
    assert.equal(new Set(p.branches.map(b => b.title)).size, 4)
  }
})
test('unknown plan identifiers cannot select a file or generate an export', () => {
  for (const input of ['../../secret', '<script>', '', undefined, null]) assert.equal(productPlan(input), undefined)
})
test('image labels are escaped as text', () => {
  const p = {...PRODUCT_PLANS[0], title: '<script>alert("x")</script> & notes'}
  const svg = new JSDOM(planImage(p), {contentType:'image/svg+xml'}).window.document
  assert.equal(svg.querySelector('script'), null)
  assert.ok(svg.querySelector('title').textContent.includes(p.title))
})
