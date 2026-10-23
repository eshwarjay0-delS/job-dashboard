import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acceptedEdits, resumeChanges } from '../../src/lib/resume-changes.ts'

test('confirmed experience is safe while unsupported terms and numbers require confirmation', () => {
  const before = {
    title: 'Salesforce Administrator', tagline: '', summary: '', skills: [],
    roles: [{ role: 'Wipro | 2024 – Present', lines: [{ idx: 8, text: 'Configured Salesforce Flow automation.' }] }],
  }
  const after = {
    ...before,
    roles: [{ role: before.roles[0].role, lines: [{ idx: 8, text: 'Built Apex and LWC automation for 40 users with MuleSoft.' }] }],
  }
  const [change] = resumeChanges(before, after, {
    requirements: ['Apex', 'LWC', 'MuleSoft'],
    jd: 'Strong Apex and LWC development skills. MuleSoft integration experience.',
    evidence: 'I confirm hands-on Apex and LWC experience.',
  })
  assert.deepEqual(change.answers.map(x => x.term), ['Apex', 'LWC', 'MuleSoft'])
  assert.deepEqual(change.notInOriginal, ['MuleSoft'])
  assert.deepEqual(change.newNumbers, ['40'])
})

test('the reviewed file receives only changes whose ids the candidate kept', () => {
  const edits = {
    headline: { title: 'Salesforce Developer', tagline: 'Revenue Cloud' },
    summary: 'Confirmed summary',
    skills: [{ idx: 5, text: 'Apex, LWC' }],
    bullets: [{ idx: 8, text: 'Built Apex services.' }],
    added: [{ after: 8, text: 'Integrated MuleSoft.' }], extras: [],
  }
  const changes = [
    { id: 'title', kind: 'changed', area: 'title' },
    { id: 'tagline', kind: 'changed', area: 'tagline' },
    { id: 'summary', kind: 'changed', area: 'summary' },
    { id: 'skill:5', kind: 'changed', area: 'skills' },
    { id: 'bullet:8', kind: 'changed', area: 'role' },
    { id: 'added:0', kind: 'added', area: 'role' },
  ].map(c => ({ ...c, before: '', after: '', answers: [], notInOriginal: [], newNumbers: [] }))
  const cut = acceptedEdits(edits, changes, ['title', 'skill:5', 'bullet:8'])
  assert.equal(cut.edits.headline.title, 'Salesforce Developer')
  assert.equal(cut.edits.headline.tagline, '')
  assert.equal(cut.edits.summary, '')
  assert.deepEqual(cut.edits.skills, [{ idx: 5, text: 'Apex, LWC' }])
  assert.deepEqual(cut.edits.bullets, [{ idx: 8, text: 'Built Apex services.' }])
  assert.deepEqual(cut.edits.added, [])
})

test('result downloads are gated by the server-built accepted-change token', () => {
  const page = readFileSync(new URL('../../src/app/dashboard/resume/result/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /fetch\("\/api\/tailor\/review"/)
  assert.match(page, /body: JSON\.stringify\(\{ token, accepted: acceptedIds \}\)/)
  assert.match(page, /downloadToken = await buildReviewedFile\(\)/)
  assert.match(page, /encodeURIComponent\(downloadToken\)/)
  assert.match(page, /!c\.notInOriginal\.length && !c\.newNumbers\.length/)
  assert.doesNotMatch(page, /encodeURIComponent\(token\).*fmt=\$\{fmt\}/)
})
