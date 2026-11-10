import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { confirmedCandidateStatements, explicitlyConfirmsAllRequirements, missingRoleEvidenceTerms } from '../../src/lib/resume-evidence.ts'
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
