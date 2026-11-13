import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { resumeQuality } from '../../src/lib/resume-quality.ts'
const require = createRequire(import.meta.url)
const module = { exports: {} }
const source = readFileSync(new URL('../../src/lib/keywords.ts', import.meta.url), 'utf8')
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, process, console,
  require: id => id === 'path' || id === 'crypto' ? require(id) : {},
})
const { extractJdKeywords, coveredJdKeywords, present } = module.exports

test('actual keyword sets remain consistent when weighted overlap would round to all terms', () => {
  const terms = ['ci/cd', 'tcp/ip', 'pl/sql', 'pan-os', 'iso 27001', 'nist 800-53', 'tls 1.2', 'tls 1.3', 'oauth2', 'saml2',
    'ipv4', 'ipv6', 'sha256', 'sha512', 'aes256', 's3', 'ec2', 's4hana', 'http2', 'x509', 'collaboration']
  const result = module.exports.weightedCoverage(terms.slice(0, -1).join(', '), terms)
  assert.equal(Math.round(result.coverage * terms.length), 21, 'old conversion invents a match')
  assert.equal(result.matched.length, 20)
  assert.equal(result.missing.length, 1)
  const report = resumeQuality({ matched: result.matched.length, total: terms.length, missing: result.missing, weightedCoverage: result.coverage })
  assert.equal(report.matched + report.missing.length, report.total)
  assert.equal(report.status, 'delivered_with_gaps')
})

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
test('IIQ matches IdentityIQ in either spelling, but not the vendor alone', () => {
  assert.equal(present('Administered SailPoint IdentityIQ for 5,000 users.', 'IIQ'), true)
  assert.equal(present('Administered SailPoint Identity IQ for 5,000 users.', 'IIQ'), true)
  assert.equal(present('Built IIQ workflows and custom rules.', 'IIQ'), true)
  assert.equal(present('Administered SailPoint for 5,000 users.', 'IIQ'), false)
})
test('security acronyms match their spelled-out expansions, both directions', () => {
  // Nov 5 Security Analyst hold (32.4%): the JD asks for acronyms while a
  // resume spells the term out — same undercount class as IIQ. Each group is
  // the standard expansion only; the acronym never matches an unrelated word.
  assert.equal(present('Worked in the Security Operations Center triaging alerts.', 'SOC'), true)
  assert.equal(present('Worked in the SOC triaging alerts.', 'security operations center'), true)
  assert.equal(present('Tuned Security Information and Event Management rules.', 'SIEM'), true)
  assert.equal(present('Built Security Orchestration Automation and Response playbooks.', 'SOAR'), true)
  assert.equal(present('Managed Endpoint Detection and Response tooling.', 'EDR'), true)
  assert.equal(present('Managed Extended Detection and Response tooling.', 'XDR'), true)
  assert.equal(present('Ran Identity and Access Management reviews.', 'IAM'), true)
  assert.equal(present('Configured multi-factor authentication policies.', 'MFA'), true)
  assert.equal(present('Configured MFA policies.', 'multi factor authentication'), true)
  assert.equal(present('Federated logins with Security Assertion Markup Language.', 'SAML'), true)
  assert.equal(present('Monitored User and Entity Behavior Analytics dashboards.', 'UEBA'), true)
  assert.equal(present('Worked with social teams on awareness.', 'SOC'), false)
  assert.equal(present('Administered endpoints.', 'EDR'), false)
  assert.equal(present('Ran access reviews.', 'IAM'), false)
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

test('explicit certification alternatives count once and accept any listed credential', () => {
  const terms = extractJdKeywords('Certifications: CISSP, CCSP, CISM, CRISC or CISA preferred.\nUse AWS and Azure for cloud security.')
  const group = terms.find(t => t === 'cissp or ccsp or cism or crisc or cisa')
  assert.ok(group)
  for (const term of ['cissp','ccsp','cism','crisc','cisa']) assert.ok(!terms.includes(term))
  assert.equal(present('Certifications: CISSP', group), true)
  assert.equal(present('Certifications: CISM', group), true)
  assert.equal(present('Cloud engineer using AWS.', group), false)
})

test('AND credentials and independent required credentials cannot disappear behind OR lists', () => {
  const both = extractJdKeywords('CISSP and CISA are required.')
  assert.ok(both.includes('cissp') && both.includes('cisa'))
  const separate = extractJdKeywords('CISSP is required.\nAdditional certification: CISSP or CCSP.')
  assert.ok(separate.includes('cissp'))
  assert.ok(separate.includes('cissp or ccsp'))
})

test('work-authorization boilerplate caps are not skills (Oct 22 owner screenshot)', () => {
  // The exact failure: a tailored resume's skills line ended "…, VMware ESXi, VITA,
  // GC-EAD, H4, JD, NEED, CANDIDATES, OVERALL, PREFFERED" — JD eligibility/header
  // boilerplate extracted as required keywords, then woven into the skills line by
  // the tailor's coverage passes. Every one of those tokens must be filtered here.
  const terms = extractJdKeywords(`Senior Cloud Security Engineer - VDOT
Agency: VITA
Eligibility: GC-EAD, H4 EAD, H1B accepted. JD NEED CANDIDATES local to Richmond. OVERALL PREFFERED: prior state experience.
Responsibilities: PowerShell automation, Microsoft GraphAPI integrations, Python and Bash scripting, Terraform and Ansible configuration, Windows Server and VMware ESXi hardening, Azure security monitoring in a SIEM. Certifications: AZ-500, SC-300.`)
  for (const junk of ['vita', 'vdot', 'gc-ead', 'h4', 'h1b', 'ead', 'jd', 'need', 'candidates', 'candidate', 'overall', 'preffered', 'preferred']) assert.ok(!terms.includes(junk), junk)
  for (const real of ['powershell', 'graphapi', 'python', 'bash', 'terraform', 'ansible', 'windows', 'vmware', 'esxi', 'azure', 'siem', 'az-500', 'sc-300']) assert.ok(terms.includes(real), real)
})

test('generic specialty and attributes headings are not technical gaps; named technologies remain', () => {
  const terms = extractJdKeywords('Required Specialty Attributes\nSPECIALTY ATTRIBUTES\nExperience with Canton and Solana blockchain technologies, NIST, ISO 27001, CIS Controls and COBIT.')
  for (const word of ['specialty','attributes']) assert.ok(!terms.includes(word), word)
  for (const term of ['canton','solana','nist','iso 27001','cobit']) assert.ok(terms.includes(term), term)
})

test('Nov4 extraction junk: prose fragments, adverbs and recruiter names are not JD terms', () => {
  const terms = extractJdKeywords(`Senior Cloud Security Engineer
Experience with SIEM, Palo Alto firewalls and Data Mover required.
Work closely with teams on cloud-based tools and government-issued devices.
This opportunity-please apply today. Contact Sai Kumar on our Talent Acquisition team.
Best regards,
Sai Kumar`)
  for (const term of ['cloud-based', 'government-issued', 'closely', 'opportunity-please', 'sai kumar']) assert.ok(!terms.includes(term), term)
  for (const term of ['siem', 'palo alto', 'data mover']) assert.ok(terms.includes(term), term)
})

test('an incomplete DLT platform token is not expanded into a candidate skill', () => {
  const truncated = extractJdKeywords('Platforms: Ethereum, Hyperledger Besu, Canton, Sol.')
  assert.ok(truncated.includes('canton'))
  assert.ok(!truncated.includes('sol'))
  assert.ok(!truncated.includes('solana'))
  const complete = extractJdKeywords('Platforms: Ethereum, Hyperledger Besu, Canton, Solana.')
  assert.ok(complete.includes('solana'))
})

test('a "such as" preferred credential list is one alternative and AWS Security Specialty stays compound', () => {
  const jd = `Preferred Qualifications
Professional certifications such as: CISSP, CISM, CRISC, CISA, CCSP.
AWS Security Specialty (or equivalent) preferred.
Knowledge of distributed ledger platforms (Ethereum, Hyperledger Besu, Canton, Sol).
Desired Attributes
Strong ownership, collaboration and continuous learning.`
  const terms = extractJdKeywords(jd)
  const group = 'cissp or cism or crisc or cisa or ccsp'
  assert.ok(terms.includes(group))
  for (const individual of ['cissp', 'cism', 'crisc', 'cisa', 'ccsp']) assert.ok(!terms.includes(individual), individual)
  assert.ok(terms.includes('aws security specialty'))
  for (const heading of ['specialty', 'attributes']) assert.ok(!terms.includes(heading), heading)
  assert.ok(terms.includes('canton'))
  assert.ok(!terms.includes('sol'))
  assert.ok(!terms.includes('solana'))
  const source = 'CISSP, CCSK, Security+, PenTest+, AZ-500. AWS, Azure, GCP. Smart contracts, cryptography, NIST, ISO 27001, CIS Controls, COBIT.'
  assert.equal(present(source, group), true)
  assert.equal(present(source, 'aws security specialty'), false)
  assert.equal(present(source, 'canton'), false)
  assert.equal(present(source, 'sol'), false)
  assert.equal(present(source, 'solana'), false)
})
