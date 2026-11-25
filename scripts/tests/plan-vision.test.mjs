import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { PLAN_REVISION, PRODUCT_PLANS, productPlan, planImage, planText } from '../../src/lib/plan-vision.ts'
import { PLAN_JOURNAL } from '../../src/lib/plan-vision-journal.ts'

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


test('resume alignment handoff reflects the current-master restack and remains blocked for live acceptance', () => {
  const resume = productPlan('resume')
  assert.equal(PLAN_REVISION, '2026-11-25.7')
  assert.match(resume.baseline, /PR #585 clean current-master restack/)
  assert.match(resume.baseline, /54\/54/)
  assert.match(resume.baseline, /those results are not reused/)
  assert.match(resume.baseline, /protected preview and owner-authorized resume\/JD\/explicit[- ]confirmation\/exported-DOCX acceptance remain missing/)
  const handoff = PLAN_JOURNAL.find(entry => entry.id === 'resume-confirmed-skill-clean-restack-2026-11-25')
  assert.ok(handoff)
  assert.equal(handoff.approval, 'approved')
  assert.equal(handoff.delivery, 'in progress')
  assert.match(handoff.next, /independent review/)
})
