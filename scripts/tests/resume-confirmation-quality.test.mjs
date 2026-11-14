import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { candidateEvidenceInput, confirmedCandidateStatements, explicitlyConfirmsAllRequirements, missingRoleEvidenceTerms, roleScopedMissingTerms, restoreUnsupportedRoleEdits } from '../../src/lib/resume-evidence.ts'
for (const input of ['Add Kafka and AWS', 'Make this match Kubernetes', 'Do I have Splunk?', 'I have no experience with GCP', 'I have never used Drata', 'Required skills: Snowflake', 'Include F5 in the skills section']) {
  test(`editing instruction or missing experience is not evidence: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), []))
}
for (const input of ['I have experience with AWS and Terraform', 'I personally deployed CyberArk EPM', 'My experience includes SOX testing', 'Confirmed skills: Python']) {
  test(`explicit experience is retained: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), [input]))
}
test('an exception cannot confirm every requirement', () => {
  assert.equal(explicitlyConfirmsAllRequirements(['I have experience with all required skills except GCP']), false)
  assert.deepEqual(confirmedCandidateStatements(['I have experience with all required skills except GCP']), [])
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

test('second-person blanket wording is not a candidate experience confirmation', () => {
  for (const statement of ['You have experience with all required skills', 'Do you have experience with all required skills?']) {
    assert.equal(explicitlyConfirmsAllRequirements([statement]), false)
    assert.deepEqual(confirmedCandidateStatements([statement]), [])
  }
})

test('a job-description or formatting instruction is not blanket experience confirmation', () => {
  for (const instruction of ['Add all keywords', 'Make this 98% match', 'Required skills: AWS, GCP']) {
    assert.equal(explicitlyConfirmsAllRequirements([instruction]), false)
  }
})

test('the job description is never mislabeled as candidate evidence without a confirmation', () => {
  const prompt = candidateEvidenceInput('Contract To Perm and Right To Hire are required', [])
  assert.match(prompt, /JOB DESCRIPTION \(target requirements, not candidate evidence\)/)
  assert.doesNotMatch(prompt, /ORIGINAL SUBMITTED TEXT/)
  assert.match(prompt, /Job-description requirements[\s\S]*are never candidate evidence/)
})

test('candidate-confirmed skills may be mapped into existing projects without changing identity facts', () => {
  const prompt = candidateEvidenceInput('JD asks for Canton and AWS', ['I have experience with Canton and AWS'])
  assert.match(prompt, /mapped naturally into relevant existing project bullets across the selected resume's roles/)
  assert.match(prompt, /never borrow another account's resume or profile/)
  assert.match(prompt, /new employer, project, title, date, location, contact, metric, credential/)
  assert.match(prompt, /conflicts with resume education, employment dates, employer, tenure or credential status/)
  assert.match(prompt, /JOB DESCRIPTION \(target requirements, not candidate evidence\)/)
  assert.doesNotMatch(prompt, /ORIGINAL SUBMITTED TEXT/)
})


test("resume writer permits only explicit candidate-confirmed cross-role skills", () => {
  const tailor = readFileSync(new URL("../../src/lib/tailor.ts", import.meta.url), "utf8")
  const claude = readFileSync(new URL("../../src/lib/claude.ts", import.meta.url), "utf8")
  assert.doesNotMatch(tailor, /Write every known JD term into the current role and the previous roles/)
  assert.doesNotMatch(tailor, /the candidate claims this JD skill set/)
  assert.doesNotMatch(claude, /The candidate claims this JD skill set/)
  assert.match(claude, /explicit first-person candidate confirmations/)
  assert.match(claude, /mapped into a relevant existing project bullet across roles, including earlier roles/)
  assert.match(claude, /do not require same-role source proof/i)
  assert.match(claude, /NO AUTOMATIC CROSS-ROLE TRANSFER/)
  assert.match(claude, /never invent a new project, employer, action, outcome, date, title, location, contact or metric/)
  assert.doesNotMatch(claude, /General first-person confirmations may support skills\/profile evidence, but they do not assign/)
  assert.doesNotMatch(claude, /role-specific confirmation/i)
  assert.doesNotMatch(tailor, /General first-person confirmations may support the skills\/profile section but must never be assigned/)
  assert.match(tailor, /const confirmedJdKws = explicitlyConfirmsAllRequirements/)
  assert.match(tailor, /coveredJdKeywords\(candidateStatements\.join\("\\n"\), jdKws\)/)
  assert.match(tailor, /confirmedInRole/)
  assert.match(tailor, /new Set\(confirmedJdKws\)/)
  assert.match(tailor, /candidate-confirmed skills may also be mapped into relevant existing project bullets across roles/)
  assert.match(tailor, /ROLE #\$\{i\}: preserve and develop only these JD skills supported by the original bullets for this role:[\s\S]*If neither role-specific source evidence nor an explicit candidate confirmation exists, leave the requirement as a gap[\s\S]*Explicitly candidate-confirmed skills may also be mapped into relevant existing project bullets across roles/)
  assert.match(tailor, /return adapt\(\{ \.\.\.call, preferences: \[call\.preferences, rolePlan\]/)
  assert.doesNotMatch(tailor, /tailor-gap-fill|profilePrefs|hasProfilePartContent/)
  assert.doesNotMatch(tailor, /write EACH of these JD terms into the current and previous project bullets/)
  assert.doesNotMatch(tailor, /Security and IAM work repeats across projects/)
  assert.match(tailor, /const candidateEvidence = \[text, \.\.\.candidateStatements\]\.join/)
  assert.match(tailor, /coveredJdKeywords\(candidateEvidence, \[k\]\)\.has\(k\)/)
  assert.match(tailor, /jdKwsPrompt = \[\.\.\.new Set\(\[\.\.\.jdKwsPrompt, \.\.\.freshUnique\]\)\]/)
  assert.match(tailor, /const requiredExperienceTerms = jdKwsPrompt\.filter/)
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


test('role-scoped final weave inputs never borrow a JD term from another employer', () => {
  const terms = ['Splunk', 'Okta', 'Canton']
  const roles = [
    { bullets: [{ idx: 1, text: 'Used Splunk for SIEM alert triage' }] },
    { bullets: [{ idx: 2, text: 'Managed Okta access reviews' }] },
  ]
  const current = [
    { idx: 1, text: 'Managed SIEM alert triage' },
    { idx: 2, text: 'Managed access reviews' },
  ]
  const cover = (text, required) => new Set(required.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const gaps = roleScopedMissingTerms(roles, current, terms, cover)
  assert.deepEqual(gaps, [
    { roleIndex: 0, terms: ['Splunk'] },
    { roleIndex: 1, terms: ['Okta'] },
  ])
})

test('final caller scopes deterministic weaving per employer and restores cross-role terms', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /for \(const \{ roleIndex, terms \} of roleGaps\)/)
  assert.match(tailor, /roleScopedMissingTerms\(zones\.roles, current\.edits\.bullets \|\| \[\], requiredExperienceTerms, coveredJdKeywords\)/)
  assert.match(tailor, /weaveExperienceRepresentation\(\s*\[\{ bullets: sourceBullets \}\]/)
  assert.doesNotMatch(tailor, /zones\.roles\.map\(r => \(\{ bullets: r\.bullets/)
  assert.match(tailor, /restoreUnsupportedRoleEdits\(/)
})

test('confirmed skills cross roles only when the existing project context is relevant', () => {
  const roles = [
    { bullets: [{ idx: 1, text: 'Removed local admin rights and hardened Windows endpoints.' }] },
    { bullets: [{ idx: 2, text: 'Built Salesforce email campaigns and marketing automation.' }] },
    { bullets: [{ idx: 3, text: 'Supported distributed ledger settlement and blockchain transaction controls.' }] },
  ]
  const edits = [
    { idx: 1, text: 'Removed local admin rights and hardened Windows endpoints using CyberArk EPM.' },
    { idx: 2, text: 'Built Salesforce email campaigns and marketing automation using CyberArk EPM.' },
    { idx: 3, text: 'Supported distributed ledger settlement and blockchain transaction controls on Canton.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(
    edits,
    roles,
    ['CyberArk EPM', 'Canton'],
    cover,
    new Set(['CyberArk EPM', 'Canton']),
  )
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [
    edits[0],
    { idx: 2, text: roles[1].bullets[0].text },
    edits[2],
  ])
  assert.deepEqual(guarded.blockedTerms, ['CyberArk EPM'])
})

test('CyberArk EPM does not transfer into generic CRM administration or compliance-audit projects', () => {
  const roles = [
    { bullets: [{ idx: 7, text: 'Managed Salesforce CRM profiles, permission sets, marketing automation and account administration.' }] },
    { bullets: [{ idx: 8, text: 'Reviewed audit evidence and compliance controls for finance reporting.' }] },
    { bullets: [{ idx: 9, text: 'Removed local administrator rights and enforced least-privilege policies on Windows endpoints.' }] },
  ]
  const edits = [
    { idx: 7, text: 'Managed Salesforce CRM profiles, permission sets, marketing automation and account administration using CyberArk EPM.' },
    { idx: 8, text: 'Reviewed audit evidence and compliance controls for finance reporting using CyberArk EPM.' },
    { idx: 9, text: 'Removed local administrator rights and enforced least-privilege policies on Windows endpoints using CyberArk EPM.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['CyberArk EPM'], cover, new Set(['CyberArk EPM']))
  assert.equal(guarded.reverted, 2)
  assert.deepEqual(guarded.edits, [
    { idx: 7, text: roles[0].bullets[0].text },
    { idx: 8, text: roles[1].bullets[0].text },
    edits[2],
  ])
  assert.deepEqual(guarded.blockedTerms, ['CyberArk EPM'])
})

test('an unknown confirmed skill is not transferred into a project without source or family evidence', () => {
  const roles = [{ bullets: [{ idx: 4, text: 'Coordinated routine business operations and vendor updates.' }] }]
  const edits = [{ idx: 4, text: 'Coordinated routine business operations and vendor updates using MuleSoft.' }]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['MuleSoft'], cover, new Set(['MuleSoft']))
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [{ idx: 4, text: roles[0].bullets[0].text }])
  assert.deepEqual(guarded.blockedTerms, ['MuleSoft'])
})

test('role-scoped generated gap pass never asks every employer for the same global terms', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /roleScopedMissingTerms\(zones\.roles, view\.roles\.flatMap\(r => r\.bullets\), freshUnique, coveredJdKeywords\)/)
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


test('confirmed cloud skills do not transfer through generic marketing-automation wording', () => {
  const roles = [
    { bullets: [{ idx: 5, text: 'Built Salesforce email campaigns and marketing automation.' }] },
    { bullets: [{ idx: 6, text: 'Deployed containerized workloads to cloud infrastructure through CI/CD.' }] },
  ]
  const edits = [
    { idx: 5, text: 'Built Salesforce email campaigns and marketing automation using AWS.' },
    { idx: 6, text: 'Deployed containerized workloads to cloud infrastructure through CI/CD on AWS.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['AWS'], cover, new Set(['AWS']))
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [
    { idx: 5, text: roles[0].bullets[0].text },
    edits[1],
  ])
  assert.deepEqual(guarded.blockedTerms, ['AWS'])
})

test('CyberArk EPM does not transfer into generic IAM privilege or mail allowlist projects', () => {
  const roles = [
    { bullets: [{ idx: 10, text: 'Reviewed privileged access assignments and quarterly IAM access recertification for finance applications.' }] },
    { bullets: [{ idx: 11, text: 'Maintained email allowlist and greylist controls for marketing communications.' }] },
    { bullets: [{ idx: 12, text: 'Hardened Windows endpoints and controlled application allowlisting for local administrator accounts.' }] },
  ]
  const edits = [
    { idx: 10, text: 'Reviewed privileged access assignments and quarterly IAM access recertification for finance applications using CyberArk EPM.' },
    { idx: 11, text: 'Maintained email allowlist and greylist controls for marketing communications using CyberArk EPM.' },
    { idx: 12, text: 'Hardened Windows endpoints and controlled application allowlisting for local administrator accounts using CyberArk EPM.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['CyberArk EPM'], cover, new Set(['CyberArk EPM']))
  assert.equal(guarded.reverted, 2)
  assert.deepEqual(guarded.edits, [
    { idx: 10, text: roles[0].bullets[0].text },
    { idx: 11, text: roles[1].bullets[0].text },
    edits[2],
  ])
  assert.deepEqual(guarded.blockedTerms, ['CyberArk EPM'])
})


test('SIEM skills require log or alert project context, not generic audit/compliance wording', () => {
  const roles = [
    { bullets: [{ idx: 21, text: 'Reviewed audit evidence and compliance controls for finance reporting.' }] },
    { bullets: [{ idx: 22, text: 'Correlated SIEM logs and investigated security alerts across monitored systems.' }] },
  ]
  const edits = [
    { idx: 21, text: 'Reviewed audit evidence and compliance controls for finance reporting using Splunk.' },
    { idx: 22, text: 'Correlated SIEM logs and investigated security alerts across monitored systems using Splunk.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['Splunk'], cover, new Set(['Splunk']))
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [roles[0].bullets[0], edits[1]])
  assert.deepEqual(guarded.blockedTerms, ['Splunk'])
})

test('SIEM context recognizes plural log, event, detection, alert and incident evidence without accepting audit-only work', () => {
  const roles = [
    { bullets: [{ idx: 31, text: 'Correlated SIEM logs and investigated security alerts across monitored systems.' }] },
    { bullets: [{ idx: 32, text: 'Reviewed SIEM events, detections, correlations, threats and incidents.' }] },
    { bullets: [{ idx: 33, text: 'Reviewed audit evidence and compliance controls for finance reporting.' }] },
  ]
  const edits = [
    { idx: 31, text: 'Correlated SIEM logs and investigated security alerts across monitored systems using Splunk.' },
    { idx: 32, text: 'Reviewed SIEM events, detections, correlations, threats and incidents using Splunk.' },
    { idx: 33, text: 'Reviewed audit evidence and compliance controls for finance reporting using Splunk.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['Splunk'], cover, new Set(['Splunk']))
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [edits[0], edits[1], roles[2].bullets[0]])
  assert.deepEqual(guarded.blockedTerms, ['Splunk'])
})

test('endpoint tools require endpoint/EDR context rather than a generic security assessment', () => {
  const roles = [
    { bullets: [{ idx: 23, text: 'Performed security risk assessments and documented compliance control gaps.' }] },
    { bullets: [{ idx: 24, text: 'Managed Windows endpoint protection and triaged EDR threat alerts.' }] },
  ]
  const edits = [
    { idx: 23, text: 'Performed security risk assessments and documented compliance control gaps using Defender.' },
    { idx: 24, text: 'Managed Windows endpoint protection and triaged EDR threat alerts using Defender.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(edits, roles, ['Defender'], cover, new Set(['Defender']))
  assert.equal(guarded.reverted, 1)
  assert.deepEqual(guarded.edits, [roles[0].bullets[0], edits[1]])
  assert.deepEqual(guarded.blockedTerms, ['Defender'])
})
