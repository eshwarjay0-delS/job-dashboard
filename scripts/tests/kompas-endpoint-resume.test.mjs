// The owner's Endpoint Analyst session, 27 Oct 2026: every introduction opened "I'm a Citi Bank at Citi Bank", and prep wrote
// three projects with no employer and outcomes nobody wrote ("reducing endpoint policy violations by over 30%"), which
// answers then reached for out of the blue. Held still here with the resume's own header lines (the Word tab between place
// and dates is lost in the text, so "NYNOV 2024" arrives glued).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const K = await import('../../src/lib/kompasResume.ts')
const G = await import('../../src/lib/kompasGuards.ts')
const P = await import('../../src/lib/kompasPrepPack.ts')

const HEADS = [
  'Senior Endpoint Security | Citi Bank | New York, NYNOV 2024 – PRESENT',
  'Endpoint Security  | CVS Health | Irving, TXMAR 2023 – OCT 2024',
  'Digital Security Engineer | City of San Diego (DOE) | San Diego, CAAUG 2021 – FEB 2023',
  'Endpoint Security Engineer | Charter Communications | Stamford, CTFEB 2019 - JUL 2021',
  'Junior Security Specialist | Accenture | IndiaAPR 2017 – JAN 2019',
]
const resume = ['Eshwar Janjirala', 'PROFESSIONAL SUMMARY', 'I am a Endpoint Security Engineer with over 9+ years of experience.', 'PROFESSIONAL EXPERIENCE',
  ...HEADS.flatMap((h, i) => [h, `•Role ${i + 1} resolved escalated endpoint tickets within SLA.`, `•Role ${i + 1} analyzed HAR files.`])].join('\n')

test('glued place and dates, and titles without a title word, parse the same in both readers', () => {
  for (const roles of [K.resumeRoles(resume), G.resumeRoles(resume)]) {
    assert.deepEqual(roles.list.map((r) => r.org), ['Citi Bank', 'CVS Health', 'City of San Diego (DOE)', 'Charter Communications', 'Accenture'])
    assert.deepEqual(roles.list.map((r) => r.title), ['Senior Endpoint Security', 'Endpoint Security', 'Digital Security Engineer', 'Endpoint Security Engineer', 'Junior Security Specialist'])
    assert.deepEqual(roles.list.map((r) => r.dates), ['NOV 2024 – PRESENT', 'MAR 2023 – OCT 2024', 'AUG 2021 – FEB 2023', 'FEB 2019 - JUL 2021', 'APR 2017 – JAN 2019'])
  }
  const f = G.speakFacts({ resume })
  assert.equal(f.employer, 'Citi Bank'); assert.equal(f.title, 'Senior Endpoint Security')
})

test('a month is split off only where a place code or a lower-case word ran into it', () => {
  const one = (h) => K.resumeRoles(`EXPERIENCE\n${h}\nDid work.`).list[0]
  assert.equal(one('Security Analyst | Acme Bank | Austin, TXJan 2020 – Present').dates, 'Jan 2020 – Present')
  assert.equal(one('SUMMARY 2020 – 2021 | Security Analyst | Acme Bank').dates, '2020 – 2021')
})

test('an unclear header follows the order the resume uses for its other headers', () => {
  const r = K.resumeRoles(['EXPERIENCE', 'Cloud Security | Northwind | Remote | JAN 2022 – PRESENT', 'x', 'Security Engineer | Contoso | Remote | JAN 2020 – DEC 2021', 'y', 'Security Analyst | Fabrikam | Remote | JAN 2018 – DEC 2019', 'z'].join('\n'))
  assert.deepEqual(r.list.map((x) => [x.title, x.org]), [['Cloud Security', 'Northwind'], ['Security Engineer', 'Contoso'], ['Security Analyst', 'Fabrikam']])
  const old = K.resumeRoles('EXPERIENCE\nCigna Healthcare — IAM Team Lead | Texas | Sep 2023 – Present\nDid IAM work.')
  assert.deepEqual([old.list[0].org, old.list[0].title], ['Cigna Healthcare', 'IAM Team Lead'])
})

test('prep projects name a resume employer and keep only figures the resume states', () => {
  const projects = [
    { id: 'p1', name: 'Enterprise Endpoint Hardening', employer: '', role: 'Lead Engineer', impact: 'Implemented GPO, Intune and CyberArk Privilege Manager controls, reducing endpoint policy violations by over 30%.' },
    { id: 'p2', name: 'HAR triage', employer: 'Citi', role: 'Senior Endpoint Security', impact: 'Analyzed HAR files, cutting mean time to detect by 40%.' },
    { id: 'p3', name: 'Ticket SLA', employer: 'CVS Health', role: 'Endpoint Security', impact: 'Resolved escalated endpoint tickets within SLA across 9+ years of practice.' },
  ]
  const kept = P.groundPrepProjects(projects, resume)
  assert.deepEqual(kept.map((p) => [p.name, p.employer]), [['HAR triage', 'Citi Bank'], ['Ticket SLA', 'CVS Health']])
  assert.equal(kept[0].impact, 'Analyzed HAR files.')
  assert.equal(kept[1].impact, 'Resolved escalated endpoint tickets within SLA across 9+ years of practice.')
  assert.equal(P.withoutUnsourcedFigures('Cut alert volume by 40%.', G.allowedNumbers(resume)), '')
})

test('prep reads every role through the digest and returns grounded projects', () => {
  const route = readFileSync(new URL('../../src/app/api/kompas/prep/route.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(route, /str\(config\.resume, 6000\)/)
  assert.match(route, /resumeDigest\(String\(config\.resume\)/)
  assert.match(route, /"employer": "the employer exactly as the ROLES line writes it"/)
  assert.match(route, /projects: grounded,/)
  assert.match(route, /q\.answer = q\.answer\.map\(\(a\) => withoutUnsourcedFigures\(a, figures\)\)/)
  const digest = K.resumeDigest(resume, 'Endpoint Analyst\nHAR files', 9000)
  for (const e of ['Citi Bank', 'CVS Health', 'City of San Diego (DOE)', 'Charter Communications', 'Accenture']) assert.ok(digest.includes(e), e)
})

test('an introduction opens with the total years when the resume states them, and prep keeps tools with their employer', async () => {
  const A = await import('../../src/lib/kompasAnswer.ts')
  assert.match(A.INTRO_CAREER_SPINE, /When the resume states the total years of experience, say that total in the opening sentence with the current identity/)
  assert.match(A.INTRO_CAREER_SPINE, /Each tool, client and achievement belongs to the role it is listed under/)   // the baseline stays
  const route = readFileSync(new URL('../../src/app/api/kompas/prep/route.ts', import.meta.url), 'utf8')
  assert.match(route, /A tool, platform or client named together with an employer must be one that employer's section of the resume lists\./)
})
