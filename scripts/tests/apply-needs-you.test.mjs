// Apply Needs-you tab: derived from the existing pipeline, never from
// invented data. Submitted jobs are done, not needs-you.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsYou, nextActionFor, whatFor, stageLabel } from '../../src/lib/apply-needs-you.ts'

const JOB = (over) => ({ title: 'Security Engineer', company: 'Acme', url: 'https://example.com/jobs/1', stage: 'save', at: 100, location: 'Remote', ...over })

test('submitted jobs never appear in needs-you', () => {
  const out = needsYou([JOB({ stage: 'submitted', at: 300 }), JOB({ stage: 'open_portal', at: 200 })])
  assert.equal(out.length, 1)
  assert.equal(out[0].stage, 'open_portal')
})

test('rows without a URL are left out, not shown as dead cards', () => {
  assert.deepEqual(needsYou([JOB({ url: '' })]), [])
})

test('most recent unfinished job first', () => {
  const out = needsYou([JOB({ at: 100, title: 'Old' }), JOB({ at: 300, title: 'New' })])
  assert.deepEqual(out.map((o) => o.title), ['New', 'Old'])
})

test('open_portal is the only stage whose next step is a confirmation', () => {
  assert.equal(nextActionFor('open_portal').action, 'mark-submitted')
  assert.equal(nextActionFor('open_portal').actionLabel, 'Mark as submitted')
  for (const stage of ['save', 'view', 'tailor']) {
    assert.equal(nextActionFor(stage).action, 'open-portal')
  }
})

test('every unfinished stage has a plain what and do-next, and no deadline is invented', () => {
  for (const stage of ['save', 'view', 'tailor', 'open_portal']) {
    const item = needsYou([JOB({ stage })])[0]
    assert.ok(item.what.length > 0)
    assert.ok(item.doNext.length > 0)
    assert.ok(!/deadline|due|expires/i.test(item.what + item.doNext))
    assert.equal(item.actionLabel, nextActionFor(stage).actionLabel)
  }
})

test('stage labels match the pipeline labels', () => {
  assert.equal(stageLabel('open_portal'), 'Portal opened')
  assert.equal(stageLabel('tailor'), 'Tailored')
  assert.equal(whatFor('tailor', 'Security Engineer'), 'Your resume is tailored for Security Engineer, but it has not been submitted.')
})
