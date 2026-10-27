// Which employer each role belongs to. Measured 26 Oct 2026 (evaluation, all six introductions scrambled the career):
// "Senior Cybersecurity Engineer | Citi Bank | New York, NY  NOV 2024 – PRESENT" lost "Citi Bank" as a "location", and
// the previous role's last bullet became the employer, so the model was handed a role map it could only scramble.
import test from 'node:test'
import assert from 'node:assert/strict'

const K = await import('../../src/lib/kompasResume.ts')
const G = await import('../../src/lib/kompasGuards.ts')

const HEADS = [
  'Senior Cybersecurity Engineer | Citi Bank | New York, NY\t\t\t            NOV 2024 – PRESENT',
  'Cybersecurity Engineer | CVS Health | Irving, TX\t\t\t\t\t\tMAR 2023 – OCT 2024',
  'Digital Security Engineer | City of San Diego (DOE) | San Diego, CA \t\t             AUG 2021 – FEB 2023',
  'Network Security Engineer | Charter Communications | Stamford, CT\t\t               FEB 2019 - JUL 2021',
  'Junior Cybersecurity Specialist | Accenture | India \t\t\t\t\t APR 2017 – JAN 2019',
]
const resume = ['Eshwar', 'SR CYBER SECURITY ENGINEER', 'Summary line.', 'EXPERIENCE',
  ...HEADS.flatMap((h, i) => [h, `Role ${i + 1} bullet A.`, `Role ${i + 1} bullet B.`])].join('\n')
const EMPLOYERS = ['Citi Bank', 'CVS Health', 'City of San Diego (DOE)', 'Charter Communications', 'Accenture']

test('"Title | Employer | City, ST  dates" keeps the employer, in both parsers', () => {
  for (const roles of [K.resumeRoles(resume), G.resumeRoles(resume)]) {
    assert.deepEqual(roles.list.map((r) => r.org), EMPLOYERS)
    assert.deepEqual(roles.list.map((r) => r.title), ['Senior Cybersecurity Engineer', 'Cybersecurity Engineer', 'Digital Security Engineer', 'Network Security Engineer', 'Junior Cybersecurity Specialist'])
  }
  assert.match(K.resumeDigest(resume, 'Introduce yourself', 14000, 'career'), /^ROLES \(resume order, not inferred chronology\): Citi Bank — Senior Cybersecurity Engineer — NOV 2024 – PRESENT; CVS Health — Cybersecurity Engineer/)
})

test('the layouts the parser was built for still parse', () => {
  const a = K.resumeRoles('EXPERIENCE\nCigna Healthcare — IAM Team Lead | Texas | Sep 2023 – Present\nDid IAM work.')
  assert.equal(a.list[0].org, 'Cigna Healthcare'); assert.equal(a.list[0].title, 'IAM Team Lead')
  const b = K.resumeRoles('EXPERIENCE\nFifth Bank\nSenior Security Engineer | Nov 2023 – Present\nDid work.')
  assert.equal(b.list[0].org, 'Fifth Bank'); assert.equal(b.list[0].title, 'Senior Security Engineer')
})

test('a place is a place, an employer is not', () => {
  for (const s of ['New York, NY', 'Irving, TX', 'San Diego, CA', 'India', 'Texas', 'Remote', 'Hyderabad, IN', 'Austin, Texas', 'Bengaluru']) assert.equal(K.isLocationSeg(s), true, s)
  for (const s of ['Citi Bank', 'CVS Health', 'Accenture', 'Charter Communications', 'Acme, Inc.', 'Senior Security Engineer']) assert.equal(K.isLocationSeg(s), false, s)
})
