import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const module = { exports: {} }
const source = readFileSync(new URL('../../src/lib/keywords.ts', import.meta.url), 'utf8')
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, process, console,
  require: id => id === 'path' || id === 'crypto' ? require(id) : {},
})
const { extractJdKeywords, coveredJdKeywords, present } = module.exports

test('recruiter contact details and job descriptors are not missing qualifications', () => {
  const terms = extractJdKeywords(`Role: Threat Intelligence Analyst IV
Location: Arlington Heights, IL
Send Resume to recruiter@samsonsoft.com or visit https://samsonsoft.com/jobs.
samsonsoft.com
Senior-level hands-on analyst handles incident-related work using CSOC, OSINT and TTPs.
Uses open-source intelligence and analytical collaboration.`)
  for (const term of ['samsonsoft.com', 'samsonsoft', 'recruiter', 'resume', 'senior-level', 'hands-on', 'incident-related']) assert.ok(!terms.includes(term), term)
  for (const term of ['csoc', 'osint', 'ttp', 'open-source', 'analytical', 'collaboration']) assert.ok(terms.includes(term), term)
})
test('equivalent spellings and standard threat-intelligence expansions count', () => {
  const text = 'Performed open source intelligence research in the Cybersecurity Operations Center. Mapped adversary tactics, techniques, and procedures and investigated indicators of compromise.'
  const matched = coveredJdKeywords(text, ['open-source', 'OSINT', 'CSOC', 'TTPs', 'IOCs'])
  assert.equal(matched.size, 5)
  assert.equal(present('Mapped adversary TTPs to detections.', 'TTP'), true)
})
test('matching does not fabricate absent tools or match inside longer words', () => {
  assert.equal(present('Collaborated on incident response.', 'OSINT'), false)
  assert.equal(present('Coordinate security reviews.', 'NAT'), false)
  assert.equal(present('Reviewed microservices.', 'services'), false)
  assert.equal(present('Azure security monitoring.', 'AWS'), false)
})
test('technology names ending in s and genuine technical punctuation survive extraction', () => {
  const terms = extractJdKeywords('Use ADFS and Kubernetes with Node.js, CI/CD, IPsec, PAN-OS and AZ-500. Track TTPs (TTPs).')
  for (const term of ['adfs', 'kubernetes', 'node.js', 'ci/cd', 'ipsec', 'pan-os', 'az-500', 'ttp']) assert.ok(terms.includes(term), term)
  assert.ok(!terms.includes('adf'))
  assert.ok(!terms.includes('kubernete'))
})

test('forwarded JD formatting and work schedules do not become technical requirements', () => {
  const terms = extractJdKeywords(`> *Threat Intelligence Analyst IV*
> *Location: Arlington Heights, IL - onsite*
> *Work Arrangement:* Primarily onsite
> *Project:* Cyber Security Operations Center (CSOC) Build
> Research threat actors using OSINT and TTPs. Prepare threat intelligence reports through Microsoft Teams.
> *Work Schedule & Environment*
> Weekday evening coverage: 4:00 PM - midnight.
> Flexible weekday/weekend coverage onsite in Arlington Heights, IL.
> *Note:* Temporary contract.`)
  for (const term of ['arlington', 'heights', 'weekday/weekend', 'weekday', 'weekend', 'il', 'arrangement', 'schedule', 'environment', 'intelligence', 'center']) assert.ok(!terms.includes(term), term)
  for (const term of ['osint', 'ttp', 'csoc', 'threat actors', 'threat intelligence reports', 'microsoft teams']) assert.ok(terms.includes(term), term)
  assert.ok(!terms.includes('ttps'), 'one concept must not count twice')
})

test('pasted keyword-bank commentary is not scored as a Salesforce requirement', () => {
  const terms = extractJdKeywords(`Here is an expanded, high-density keyword bank specifically tailored for ATS optimization, candidate sourcing and LinkedIn.
Salesforce Developer
Develop Apex with Lightning Web Components (LWC), Salesforce CPQ/Revenue Cloud, SOQL/SOSL, CDC and event-driven integrations with SAP and NetSuite.
Tip: Add these keywords to your LinkedIn profile for ATS optimization.
Candidate must have active LinkedIn profile.`)
  for (const noise of ['high-density','ats','linkedin','cpq/revenue','soql/sosl']) assert.ok(!terms.includes(noise), noise)
  for (const required of ['apex','lwc','cpq','soql','sosl','cdc','sap','netsuite','event-driven']) assert.ok(terms.includes(required), required)
})
test('legitimate ATS and LinkedIn product integration work is retained', () => {
  const terms = extractJdKeywords('Implement ATS integrations with LinkedIn Recruiter and Salesforce APIs.')
  assert.ok(terms.includes('ats'))
  assert.ok(terms.includes('linkedin'))
})
test('Salesforce expansions count without requiring acronym stuffing', () => {
  const matched = coveredJdKeywords('Built Lightning Web Components and change data capture integrations; configured configure, price, quote and quote-to-cash workflows.', ['lwc','cdc','cpq','q2c'])
  assert.equal(matched.size, 4)
  assert.equal(present('Used Oracle integrations.', 'NetSuite'), false)
})
