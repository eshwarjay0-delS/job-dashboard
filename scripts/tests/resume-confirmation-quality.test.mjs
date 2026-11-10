import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { confirmedCandidateStatements, explicitlyConfirmsAllRequirements, missingRoleEvidenceTerms, restoreUnsupportedRoleEdits } from '../../src/lib/resume-evidence.ts'
import { weaveExperienceRepresentation } from '../../src/lib/constructed-jd.ts'
import { coveredJdKeywords } from '../../src/lib/keywords.ts'
for (const input of ['Add Kafka and AWS', 'Make this match Kubernetes', 'Do I have Splunk?', 'I have no experience with GCP', 'I have never used Drata', 'Required skills: Snowflake', 'Include F5 in the skills section']) {
  test(`editing instruction or missing experience is not evidence: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), []))
}
for (const input of ['I have experience with AWS and Terraform', 'I personally deployed CyberArk EPM', 'My experience includes SOX testing', 'Confirmed skills: Python']) {
  test(`explicit experience is retained: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), [input]))
}
test('an exception cannot confirm every requirement', () => {
  assert.equal(explicitlyConfirmsAllRequirements(['I have experience with all required skills except GCP']), false)
  assert.deepEqual(confirmedCandidateStatements(['I used AWS but not GCP']), ['I used AWS'])
})

test('technical punctuation remains part of confirmed skills', () => {
  assert.deepEqual(confirmedCandidateStatements(['I have experience with .NET, Node.js and ASP.NET']), ['I have experience with .NET, Node.js and ASP.NET'])
  assert.deepEqual(confirmedCandidateStatements(['I used Node.js. Add AWS']), ['I used Node.js'])
})

test('the owner-approved explicit blanket confirmation covers all supplied requirements', () => {
  const statement = 'I have experience with all of them evenly'
  assert.equal(explicitlyConfirmsAllRequirements([statement]), true)
  assert.deepEqual(confirmedCandidateStatements([statement]), [statement])
})

test('a job-description or formatting instruction is not blanket experience confirmation', () => {
  for (const instruction of ['Add all keywords', 'Make this 98% match', 'Required skills: AWS, GCP']) {
    assert.equal(explicitlyConfirmsAllRequirements([instruction]), false)
  }
})


test("resume writer and role weaving use only source-supported or explicitly confirmed JD terms", () => {
  const tailor = readFileSync(new URL("../../src/lib/tailor.ts", import.meta.url), "utf8")
  assert.doesNotMatch(tailor, /Write every known JD term into the current role and the previous roles/)
  assert.doesNotMatch(tailor, /the candidate claims this JD skill set/)
  assert.match(tailor, /only source-supported jdKeywords/)
  assert.match(tailor, /const candidateEvidence = \[text, \.\.\.candidateStatements\]\.join/)
  assert.match(tailor, /coveredJdKeywords\(candidateEvidence, \[k\]\)\.has\(k\)/)
  assert.match(tailor, /jdKwsPrompt = \[\.\.\.new Set\(\[\.\.\.jdKwsPrompt, \.\.\.freshUnique\]\)\]/)
  assert.match(tailor, /const missing = jdKwsPrompt\.filter/)
})

test('role repair never borrows a globally missing JD term from another role', () => {
  const required = ['Splunk', 'Okta', 'Canton']
  assert.deepEqual(missingRoleEvidenceTerms(new Set(['Splunk']), new Set(), required), ['Splunk'])
  assert.deepEqual(missingRoleEvidenceTerms(new Set(['Okta']), new Set(), required), ['Okta'])
})

test('role repair omits already-covered and unsupported terms', () => {
  assert.deepEqual(
    missingRoleEvidenceTerms(new Set(['Splunk', 'Python']), new Set(['Splunk']), ['Splunk', 'Okta', 'Canton']),
    ['Python'],
  )
})

test('role gap-fill uses role-scoped evidence and never appends the global unseen list', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /missingRoleEvidenceTerms\(sourceTerms, currentTerms, cur\.required\[i\]\)/)
  assert.doesNotMatch(tailor, /const missing = [^\n]*\.\.\.unseen/)
})


test('final experience weave assigns each JD term only to a role whose source bullets support it', () => {
  const terms = ['Splunk', 'Okta', 'Canton']
  const roleA = { bullets: [{ idx: 1, text: 'Used Splunk for SIEM alert triage' }] }
  const roleB = { bullets: [{ idx: 2, text: 'Managed Okta access reviews' }] }
  const currentA = [{ idx: 1, text: 'Managed SIEM alert triage' }]
  const currentB = [{ idx: 2, text: 'Managed access reviews' }]
  const missingA = missingRoleEvidenceTerms(coveredJdKeywords(roleA.bullets[0].text, terms), coveredJdKeywords(currentA[0].text, terms), terms)
  const missingB = missingRoleEvidenceTerms(coveredJdKeywords(roleB.bullets[0].text, terms), coveredJdKeywords(currentB[0].text, terms), terms)
  assert.deepEqual(missingA, ['Splunk'])
  assert.deepEqual(missingB, ['Okta'])
  const wovenA = weaveExperienceRepresentation([roleA], currentA, missingA)
  const wovenB = weaveExperienceRepresentation([roleB], currentB, missingB)
  assert.deepEqual(wovenA.placed, ['Splunk'])
  assert.deepEqual(wovenB.placed, ['Okta'])
  assert.ok(!wovenA.placed.includes('Okta'))
  assert.ok(!wovenB.placed.includes('Splunk'))
})

test('final caller scopes deterministic weaving per employer and restores cross-role terms', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /for \(const role of zones\.roles\)/)
  assert.match(tailor, /missingRoleEvidenceTerms\(sourceTerms, currentTerms, requiredExperienceTerms\)/)
  assert.match(tailor, /weaveExperienceRepresentation\(\s*\[\{ bullets: sourceBullets \}\]/)
  assert.doesNotMatch(tailor, /zones\.roles\.map\(r => \(\{ bullets: r\.bullets/)
  assert.match(tailor, /restoreUnsupportedRoleEdits\(/)
})

test('role-scoped generated gap pass never asks every employer for the same global terms', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /missingRoleEvidenceTerms\(sourceTerms, currentTerms, freshUnique\)/)
  assert.match(tailor, /ROLE-SPECIFIC GAP KEYWORDS: \$\{t\.skills\.join/)
  assert.doesNotMatch(tailor, /countedRoles\.map\(i => \(\{ role: i, skills: freshUnique \}\)\)/)
})

test('unsupported JD terms are restored from the affected role without deleting another role valid evidence', () => {
  const roles = [
    { bullets: [{ idx: 1, text: 'Used Splunk for SIEM alert triage' }] },
    { bullets: [{ idx: 2, text: 'Managed Okta access reviews' }] },
  ]
  const edits = [
    { idx: 1, text: 'Used Splunk for SIEM alert triage and Okta access reviews' },
    { idx: 2, text: 'Managed Okta access reviews and Splunk alerts' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['Splunk', 'Okta', 'Canton'], cover)
  assert.equal(guarded.reverted, 2)
  assert.deepEqual(guarded.edits, [
    { idx: 1, text: roles[0].bullets[0].text },
    { idx: 2, text: roles[1].bullets[0].text },
  ])
  assert.deepEqual(guarded.blockedTerms.sort(), ['Okta', 'Splunk'])
})
