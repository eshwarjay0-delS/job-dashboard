import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { candidateEvidenceInput, confirmedCandidateStatements, explicitlyConfirmsAllRequirements, missingRoleEvidenceTerms, roleScopedMissingTerms, roleScopedConfirmedSkillTerms, restoreUnsupportedRoleEdits } from '../../src/lib/resume-evidence.ts'
for (const input of ['Add Kafka and AWS', 'Make this match Kubernetes', 'Do I have Splunk?', 'I have no experience with GCP', 'I have never used Drata', 'I haven\'t used AWS', 'I haven\'t worked with Splunk', 'Required skills: Snowflake', 'Include F5 in the skills section']) {
  test(`editing instruction or missing experience is not evidence: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), []))
}
for (const input of ['I have experience with AWS and Terraform', 'I personally deployed CyberArk EPM', 'My experience includes SOX testing', 'Confirmed skills: Python', 'Confirmed experience: SOX testing']) {
  test(`explicit experience is retained: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), [input]))
}
test('coordinated non-candidate attribution does not confirm later skills', () => {
  const cases = [
    'I used AWS, and my team used GCP',
    'I used AWS and my colleague deployed GCP',
    'I used AWS, the client used GCP',
    'I used AWS and our organization uses GCP',
    'I used AWS and we used GCP',
    'I used AWS, GCP was used by my team',
    'I used AWS and GCP was used by others',
    'I used AWS and GCP was used by someone else',
    'I used AWS, GCP was deployed by an external vendor',
    'I used AWS and GCP was configured by a contractor',
    'I used AWS and GCP was handled by another team',
    'I used AWS and GCP was used by a third-party contractor',
    'I used AWS and GCP was used by contractors',
    'I used AWS and GCP was handled by subcontractors',
    'I used AWS and GCP was handled by my contractors',
    'I used AWS and GCP was deployed by our subcontractors',
    'I used AWS and GCP was handled by their external vendors',
    'I used AWS and GCP was handled by my contractors',
    'I used AWS and GCP was deployed by our subcontractors',
    'I used AWS and GCP was handled by their external vendors',
    'I used AWS and GCP was used by consultants',
    'I used AWS and GCP was used by vendors',
    'I used AWS and GCP was used by clients',
    'I used AWS and GCP was used by external teams',
    'I used AWS and GCP was used by outside consultants',
    'I used AWS and GCP was used by third-party vendors',
    'I used AWS and GCP was used by colleagues',
    'I used AWS and GCP was used by people from a vendor',
    'I used AWS and GCP was used by the SOC',
  ]
  for (const input of cases) assert.deepEqual(confirmedCandidateStatements([input]), ['I used AWS'], input)
  assert.deepEqual(confirmedCandidateStatements(['I used AWS and GCP']), ['I used AWS and GCP'])
})

test('active non-candidate actors do not confirm their skills', () => {
  const cases = [
    'I used AWS and someone used GCP',
    'I used AWS and somebody deployed GCP',
    'I used AWS and anyone configured GCP',
    'I used AWS and contractors deployed GCP',
    'I used AWS and a contractor deployed GCP',
    'I used AWS and subcontractors managed GCP',
    'I used AWS and consultants configured GCP',
    'I used AWS and a consultant configured GCP',
    'I used AWS and vendors operated GCP',
    'I used AWS and employees used GCP',
    'I used AWS and other people used GCP',
    'I used AWS and another person deployed GCP',
    'I used AWS and outside consultants deployed GCP',
    'I used AWS and third-party contractors configured GCP',
    'I used AWS, a vendor deployed GCP',
    'I used AWS and my contractors deployed GCP',
    'I used AWS and my team used GCP',
    'I used AWS and people from a vendor used GCP',
    'I used AWS and the SOC used GCP',
  ]
  for (const statement of cases) {
    assert.deepEqual(confirmedCandidateStatements([statement]), ['I used AWS'], statement)
  }
  for (const statement of ['I used AWS and GCP', 'I have experience with AWS and Terraform']) {
    assert.deepEqual(confirmedCandidateStatements([statement]), [statement], statement)
  }
})

for (const input of [
  'I have maybe used AWS',
  'I used AWS, maybe',
  'I used AWS, I think',
  'My experience includes AWS, possibly',
  'I have experience with AWS?',
  'Confirmed skills: AWS, maybe',
]) {
  test(`uncertain or question-form confirmation is not evidence: ${input}`, () => assert.deepEqual(confirmedCandidateStatements([input]), []))
}

for (const input of [
  'I have experience with all required skills?',
  'I have experience with all required skills, maybe',
  'I have experience with all required skills, I think',
  'I might have experience with all required skills',
]) {
  test(`uncertain or question-form blanket confirmation is rejected: ${input}`, () => assert.equal(explicitlyConfirmsAllRequirements([input]), false))
}

test('an exception cannot confirm every requirement', () => {
  assert.equal(explicitlyConfirmsAllRequirements(['I have experience with all required skills except GCP']), false)
  assert.deepEqual(confirmedCandidateStatements(['I have experience with all required skills except GCP']), [])
  assert.deepEqual(confirmedCandidateStatements(['I used AWS but not GCP']), ['I used AWS'])
})

test('no and lack exceptions narrow a positive confirmation instead of confirming the excluded skill', () => {
  for (const statement of ['I used AWS and no GCP', 'I used AWS and lack GCP', 'I used AWS and lacking GCP']) {
    assert.deepEqual(confirmedCandidateStatements([statement]), ['I used AWS'])
  }
})

test('negative contractions narrow a mixed confirmation and repeated skills reject contradictions', () => {
  for (const statement of [
    "I used AWS and don't know GCP",
    "I used AWS and haven't used GCP",
    "I used AWS and can't use GCP",
    "I used AWS and cannot use GCP",
  ]) {
    assert.deepEqual(confirmedCandidateStatements([statement]), ['I used AWS'])
  }
  assert.deepEqual(confirmedCandidateStatements(["I used AWS and don't know AWS"]), [])
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
  const evidence = readFileSync(new URL("../../src/lib/resume-evidence.ts", import.meta.url), "utf8")
  assert.doesNotMatch(tailor, /Write every known JD term into the current role and the previous roles/)
  assert.doesNotMatch(tailor, /the candidate claims this JD skill set/)
  assert.doesNotMatch(claude, /The candidate claims this JD skill set/)
  assert.match(claude, /explicit candidate confirmations are evidence for the confirmed skills/)
  assert.match(evidence, /only explicit candidate confirmations can support a skill/)
  assert.doesNotMatch(evidence, /only explicit first-person candidate confirmations/)
  assert.doesNotMatch(claude, /explicit first-person candidate confirmations|explicit first-person candidate confirmation of that skill/)
  assert.doesNotMatch(tailor, /explicit first-person candidate confirmations|explicit first-person confirmations support/)
  assert.match(claude, /mapped into a relevant existing project bullet across roles, including earlier roles/)
  assert.match(claude, /do not require same-role source proof/i)
  assert.match(claude, /NO AUTOMATIC CROSS-ROLE TRANSFER/)
  assert.match(claude, /never invent a new project, employer, action, outcome, date, title, location, contact or metric/)
  assert.doesNotMatch(claude, /General first-person confirmations may support skills\/profile evidence, but they do not assign/)
  assert.doesNotMatch(claude, /role-specific confirmation/i)
  assert.doesNotMatch(tailor, /General first-person confirmations may support the skills\/profile section but must never be assigned/)
  assert.match(tailor, /const confirmedJdKws = explicitlyConfirmsAllRequirements/)
  assert.match(tailor, /coveredJdKeywords\(candidateStatements\.join\("\\n"\), jdKws\)/)
  assert.match(tailor, /confirmedRelevant/)
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

test('confirmed skills missing from a role are deterministic gap candidates only when project context fits', () => {
  const terms = ['CyberArk EPM']
  const confirmed = ['CyberArk EPM']
  const roles = [
    { bullets: [{ idx: 1, text: 'Removed local admin rights and hardened Windows endpoints.' }] },
    { bullets: [{ idx: 2, text: 'Built Salesforce email campaigns and marketing automation.' }] },
  ]
  const current = roles.flatMap(role => role.bullets)
  const cover = (text, required) => new Set(required.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  assert.deepEqual(roleScopedConfirmedSkillTerms(roles[0].bullets, terms, confirmed, cover), ['CyberArk EPM'])
  assert.deepEqual(roleScopedConfirmedSkillTerms(roles[1].bullets, terms, confirmed, cover), [])
  assert.deepEqual(roleScopedMissingTerms(roles, current, terms, cover, confirmed), [
    { roleIndex: 0, terms: ['CyberArk EPM'] },
  ])
})

test('final caller scopes deterministic weaving per employer and restores cross-role terms', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(tailor, /for \(const \{ roleIndex, terms \} of roleGaps\)/)
  assert.match(tailor, /roleScopedMissingTerms\(zones\.roles, current\.edits\.bullets \|\| \[\], requiredExperienceTerms, coveredJdKeywords, confirmedJdKws\)/)
  assert.match(tailor, /roleScopedConfirmedSkillTerms\(r\.bullets, listed, confirmedJdKws, coveredJdKeywords\)/)
  assert.match(tailor, /confirmedRelevant\.includes\(k\)/)
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


test('writer prompt treats the JD as target context, never as candidate evidence', () => {
  const prompt = readFileSync(new URL('../../src/lib/claude.ts', import.meta.url), 'utf8')
  assert.match(prompt, /FOUNDATION: the JD defines the target, not the candidate's history/)
  assert.match(prompt, /The JD is a target requirement, not a candidate statement/)
  assert.match(prompt, /explicitly confirmed skills/)
  assert.match(prompt, /The JD alone, a formatting request or a target score never confirms experience/)
  assert.match(prompt, /Do not create a project, employer, action, outcome, date, title, location, metric or contact/)
  assert.doesNotMatch(prompt, /The candidate claims this JD skill set/)
  assert.doesNotMatch(prompt, /Do not refuse a term because the source omitted it/)
  assert.doesNotMatch(prompt, /spread the JD's tools across EVERY role below/)
})

test('negative My experience, My skills and My background statements are never confirmations', () => {
  const negatives = [
    'My background lacks AWS',
    "My skills don't include Splunk",
    'My experience includes no Okta',
    'My skills do not include Terraform',
    'Confirmed skills: no Azure',
    'Confirmed experience: without Python',
  ]
  for (const statement of negatives) assert.deepEqual(confirmedCandidateStatements([statement]), [], statement)
  const positives = [
    'My experience includes AWS, but not GCP',
    'My skills include Splunk, but not Sentinel',
    'Confirmed skills: Azure, but not AWS',
  ]
  for (const statement of positives) {
    const accepted = confirmedCandidateStatements([statement])
    assert.equal(accepted.length, 1, statement)
    assert.match(accepted[0], /AWS|Splunk|Azure/)
    assert.doesNotMatch(accepted[0], /GCP|Sentinel/)
  }
})

test('generic user/security wording alone cannot transfer IAM, and data/service alone cannot transfer Python', () => {
  const roles = [
    { bullets: [{ idx: 40, text: 'Handled user support, general security and data service tickets.' }] },
    { bullets: [{ idx: 41, text: 'Provisioned identities, access groups and MFA for application accounts.' }] },
    { bullets: [{ idx: 42, text: 'Provided data service support and routine ticket coordination.' }] },
    { bullets: [{ idx: 43, text: 'Automated API integrations and ETL scripts for recurring data workflows.' }] },
  ]
  const edits = [
    { idx: 40, text: 'Handled user support, general security and data service tickets using Okta.' },
    { idx: 41, text: 'Provisioned identities, access groups and MFA for application accounts using Okta.' },
    { idx: 42, text: 'Provided data service support and routine ticket coordination using Python.' },
    { idx: 43, text: 'Automated API integrations and ETL scripts for recurring data workflows using Python.' },
  ]
  const cover = (text, terms) => new Set(terms.filter(term => text.toLowerCase().includes(term.toLowerCase())))
  const guarded = restoreUnsupportedRoleEdits(
    edits, roles, ['Okta', 'Python'], cover, new Set(['Okta', 'Python']),
  )
  assert.equal(guarded.reverted, 2)
  assert.deepEqual(guarded.edits, [
    roles[0].bullets[0],
    edits[1],
    roles[2].bullets[0],
    edits[3],
  ])
  assert.deepEqual(guarded.blockedTerms, ['Okta', 'Python'])
})


test('a skill repeated in an exception invalidates a contradictory confirmation', () => {
  const contradictory = [
    'My experience includes AWS and GCP, but I have not used GCP',
    'Confirmed skills: Azure, AWS and Terraform, excluding AWS',
    "I have experience with Splunk and Sentinel, but I haven't used Sentinel",
  ]
  for (const statement of contradictory) assert.deepEqual(confirmedCandidateStatements([statement]), [], statement)

  // Shared context words do not count as a repeated skill.
  assert.deepEqual(
    confirmedCandidateStatements(['I used AWS for security monitoring, but not Splunk for monitoring']),
    ['I used AWS for security monitoring'],
  )
})

test('missing-skill statements are never confirmations, and mixed lists keep only the positive terms', () => {
  const negatives = [
    'My skills are missing AWS',
    'My experience is missing Splunk',
    'My background is missing Okta',
    'Confirmed skills: missing Azure',
  ]
  for (const statement of negatives) assert.deepEqual(confirmedCandidateStatements([statement]), [], statement)

  assert.deepEqual(
    confirmedCandidateStatements(['Confirmed skills: AWS, missing GCP']),
    ['Confirmed skills: AWS'],
  )
  assert.deepEqual(
    confirmedCandidateStatements(['My experience includes AWS, but not GCP']),
    ['My experience includes AWS'],
  )
})

test('modifier-bearing team attribution does not confirm later skills', () => {
  const statements = [
    'I used AWS and my engineering team used GCP',
    'I used AWS and the SOC team deployed GCP',
    'I used AWS and our security team managed GCP',
    'I used AWS and the IT team configured GCP',
    'I used AWS and the operations team deployed GCP',
    'I used AWS, GCP was used by the engineering team',
  ]
  for (const statement of statements) {
    assert.deepEqual(confirmedCandidateStatements([statement]), ['I used AWS'], statement)
  }
  assert.deepEqual(confirmedCandidateStatements(['I used AWS and GCP']), ['I used AWS and GCP'])
})


test('temporal connectors preserve candidate attribution while rejecting team-owned later clauses', () => {
  const negative = [
    'I used AWS, then my team used GCP',
    'I used AWS and then my team used GCP',
    'I used AWS, and then our colleagues deployed GCP',
    'I used AWS, then GCP was deployed by a vendor',
    'I used AWS and then GCP was handled by our team',
  ]
  for (const input of negative) assert.deepEqual(confirmedCandidateStatements([input]), ['I used AWS'], input)
  const positive = [
    'I used AWS, then I deployed GCP',
    'I used AWS and then I deployed GCP',
  ]
  for (const input of positive) assert.deepEqual(confirmedCandidateStatements([input]), [input], input)
})


test('progressive and negated passive attribution does not confirm non-candidate skills', () => {
  const cases = [
    'I used AWS and GCP is being used by my team',
    'I used AWS and GCP were being used by contractors',
    'I used AWS and GCP was not managed by my team',
    'I used AWS and GCP was not being deployed by our team',
    "I used AWS and GCP isn't being configured by a colleague",
    'I used AWS and GCP has not been handled by vendors',
    "I used AWS and GCP hasn't been deployed by a contractor",
    'I used AWS and GCP had been handled by the SOC',
  ]
  for (const input of cases) assert.deepEqual(confirmedCandidateStatements([input]), ['I used AWS'], input)
  assert.deepEqual(confirmedCandidateStatements(['I used AWS and GCP']), ['I used AWS and GCP'])
})

test('ambiguous relative clauses attributed to non-candidate actors cannot confirm skills', () => {
  const negatives = [
    'I used AWS and GCP, which my team used',
    'I used AWS and GCP, which the engineering team used',
    'I used AWS and GCP, that my team used',
    'I used AWS and GCP, which contractors deployed',
    'I used AWS and GCP, which was used by my team',
    'I used AWS and GCP, that was handled by a vendor',
    'I used AWS and GCP that my team used',
    'I used AWS and GCP which the SOC used',
  ]
  for (const input of negatives) assert.deepEqual(confirmedCandidateStatements([input]), [], input)
  const positives = [
    'I used AWS and GCP, which I used',
    'I used AWS and GCP that I configured',
  ]
  for (const input of positives) assert.deepEqual(confirmedCandidateStatements([input]), [input], input)
})

