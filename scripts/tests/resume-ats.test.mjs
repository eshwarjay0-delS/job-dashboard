// ATS parseability of the EXPORTED document: pure checks on extracted text +
// zones. No docx toolchain needed: the module under test is import-free at
// runtime (Zones is type-only), so node 24 type-stripping loads it directly.
// DRAFT — unwired, uncommitted: ships only with a journal entry + the
// evidence-gate composition (acceptableWhatsAppResume && ats.passed).
import test from 'node:test'
import assert from 'node:assert/strict'
import { atsCheck } from '../../src/lib/resume-ats.ts'

const BASE_TEXT = [
  'Eshwar Janjirala',
  'eshwar@example.com | 314-255-9156 | Saint Louis, MO',
  'Professional Summary',
  'Security engineer with 8 years in SOC operations.',
  'Skills',
  'Splunk Enterprise Security, SentinelOne, Python',
  'Experience',
  'Security Engineer, Example Corp, Jan 2022 - Present',
  '• Ran Splunk detections for SOC operations.',
  'SOC Analyst, Other Corp, Mar 2019 - Dec 2021',
  '• Triaged SentinelOne alerts.',
].join('\n')

function zones(over = {}) {
  return {
    header: { idx: 0, name: 'Eshwar Janjirala', title: 'Security Engineer', tagline: '' },
    summaryIdx: 2,
    summaryText: 'Security engineer with 8 years in SOC operations.',
    summaryOverflowIdx: [],
    skills: [{ idx: 5, text: 'Splunk Enterprise Security, SentinelOne, Python' }],
    roles: [
      { role: 'Security Engineer, Example Corp, Jan 2022 - Present', bullets: [{ idx: 8, text: 'Ran Splunk detections for SOC operations.' }] },
      { role: 'SOC Analyst, Other Corp, Mar 2019 - Dec 2021', bullets: [{ idx: 10, text: 'Triaged SentinelOne alerts.' }] },
    ],
    extras: [],
    ...over,
  }
}

test('perfect document: 100, passed, no issues', () => {
  const r = atsCheck(BASE_TEXT, zones())
  assert.equal(r.score, 100)
  assert.equal(r.passed, true)
  assert.deepEqual(r.issues, [])
})

test('missing email fails contact only', () => {
  const r = atsCheck(BASE_TEXT.replace('eshwar@example.com | ', ''), zones())
  assert.equal(r.passed, false)
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['contact'])
  assert.equal(r.score, 85.7)
})

test('missing phone fails contact only', () => {
  const r = atsCheck(BASE_TEXT.replace(' | 314-255-9156', ''), zones())
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['contact'])
})

test('missing name fails name only', () => {
  const r = atsCheck(BASE_TEXT, zones({ header: { idx: 0, name: '', title: '', tagline: '' } }))
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['name'])
})

test('no skills lines fails skills_section only', () => {
  const r = atsCheck(BASE_TEXT, zones({ skills: [] }))
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['skills_section'])
})

test('no roles fails experience and dates-vacuous-pass: only experience', () => {
  const r = atsCheck(BASE_TEXT, zones({ roles: [] }))
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['experience_section'])
})

test('role without a date fails roles_have_dates only', () => {
  const z = zones()
  z.roles = [{ role: 'Security Engineer, Example Corp', bullets: [{ idx: 8, text: 'Ran Splunk detections.' }] }]
  const r = atsCheck(BASE_TEXT, z)
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['roles_have_dates'])
  assert.ok(r.issues[0].includes('1 of 1 role(s)'))
})

test('year-range and numeric dates pass', () => {
  const z = zones()
  z.roles = [
    { role: 'A, X, 2022 - Present', bullets: [{ idx: 1, text: 'x' }] },
    { role: 'B, Y, 01/2019 - 03/2021', bullets: [{ idx: 2, text: 'y' }] },
  ]
  assert.equal(atsCheck(BASE_TEXT, z).checks.find(c => c.id === 'roles_have_dates').passed, true)
})

test('empty summary body fails summary_not_empty only', () => {
  const r = atsCheck(BASE_TEXT, zones({ summaryText: '   ' }))
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['summary_not_empty'])
})

test('no summary section in source: summary check passes vacuously', () => {
  const r = atsCheck(BASE_TEXT, zones({ summaryIdx: null, summaryText: '' }))
  assert.equal(r.checks.find(c => c.id === 'summary_not_empty').passed, true)
})

test('tiny extracted text fails substantive only', () => {
  const r = atsCheck('Eshwar Janjirala\neshwar@example.com | 314-255-9156', zones({
    summaryIdx: null, summaryText: '',
    skills: [{ idx: 1, text: 'Splunk' }],
    roles: [{ role: 'A, X, Jan 2022 - Present', bullets: [{ idx: 2, text: 'x' }] }],
  }))
  assert.deepEqual(r.issues.map(i => i.split(':')[0]), ['substantive'])
})

test('issues carry no resume content', () => {
  const r = atsCheck(BASE_TEXT, zones({ skills: [] }))
  assert.ok(!r.issues.join(' ').includes('Splunk'))
  assert.ok(!r.issues.join(' ').includes('eshwar@example.com'))
})
