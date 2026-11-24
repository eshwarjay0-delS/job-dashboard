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


test('resume alignment handoff evidence is current and explicitly blocked', () => {
  const resume = productPlan('resume')
  assert.equal(PLAN_REVISION, '2026-11-24.2')
  assert.match(resume.baseline, /PR #570 head 96a8b909f68421e35e0f642a9b9c0c090838435b/)
  assert.match(resume.baseline, /41\/41/)
  assert.match(resume.baseline, /answerCtl is not defined/)
  assert.match(resume.baseline, /protected preview and owner-authorized resume\/JD\/explicit confirmation\/exported-DOCX acceptance remain missing/)
  const handoff = PLAN_JOURNAL.find(entry => entry.id === 'resume-confirmed-skill-ci-dependency-2026-11-24')
  assert.ok(handoff)
  assert.equal(handoff.commit, '96a8b909f68421e35e0f642a9b9c0c090838435b')
  assert.match(handoff.next, /independent authorized reviewer/)
})
