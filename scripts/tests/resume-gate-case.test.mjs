// Gate change: job-post terms the resume lacks go onto a labelled skills line instead of a refusal.
// Invented example data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRoundTrip } from '../../src/lib/resume-round-trip-guard.ts'
import { buildKeywordReport, normTerm } from '../../src/lib/resume-keyword-report.ts'
import * as M from '../../src/lib/resume-skills-line.ts'
const { planSkillsLine, applySkillsPlan, JOB_POST_LABEL } = M
// Tests 1-11 pin the labelled-line-in-file prototype, so they opt in explicitly (the default is now reply-only label).
const L = { labelInFile: true }

const RESUME = `Jordan Example
jordan.example@example.com | (555) 010-2233 | linkedin.com/in/jordan-example
Austin, TX

Summary
Cloud security engineer with 6 years protecting AWS workloads.

Skills
Cloud: AWS, Azure, Terraform
Security: SIEM, Splunk, Vulnerability Management

Experience
Acme Widgets — Cloud Security Engineer, Jan 2021 – Present
• Built Splunk detections for AWS CloudTrail events.
• Ran vulnerability management for 400 hosts with Terraform baselines.
Initech — Security Analyst, 06/2018 – Dec 2020
• Triaged SIEM alerts and wrote incident reports.

Education
B.S. Computer Science, 2018
`

const bulletLines = text => text.split('\n').filter(l => /^\s*[•\-*]/.test(l))
const has = (line, term) => ` ${normTerm(line)} `.includes(` ${normTerm(term)} `)
const labelled = text => text.split('\n').filter(l => l.trim().startsWith(`${JOB_POST_LABEL}:`))

test('production case: gcp security + gcp iam -> file is sent, not refused', () => {
  const jobTerms = ['AWS', 'Splunk', 'gcp security', 'gcp iam', 'Terraform']
  const plan = planSkillsLine({ jobTerms, resumeText: RESUME, supportedTerms: [] })
  assert.equal(plan.send, true, `refused: ${plan.reason}`)
  assert.deepEqual(plan.addedTerms.map(normTerm).sort(), ['gcp iam', 'gcp security'])
  assert.match(plan.skillsLine, new RegExp(`^${JOB_POST_LABEL}: `))
})

test('production case: added terms are on the labelled skills line and NOT in experience bullets', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp security', 'gcp iam', 'AWS'], resumeText: RESUME, options: L })
  const out = applySkillsPlan(RESUME, plan)
  const lab = labelled(out)
  assert.equal(lab.length, 1, 'exactly one labelled job-post line')
  for (const t of ['gcp security', 'gcp iam']) {
    assert.ok(has(lab[0], t), `${t} on labelled line`)
    for (const b of bulletLines(out)) assert.ok(!has(b, t), `${t} must not be in bullet: ${b}`);
  }
  // the line sits inside the Skills section, before Experience
  const lines = out.split('\n')
  const iSkills = lines.indexOf('Skills'), iExp = lines.indexOf('Experience'), iLab = lines.indexOf(lab[0])
  assert.ok(iSkills < iLab && iLab < iExp, 'labelled line is in the Skills section')
})

test('round-trip guard still passes: name/contact/dates unchanged', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp security', 'gcp iam', 'Kubernetes'], resumeText: RESUME, options: L })
  const out = applySkillsPlan(RESUME, plan)
  const rt = checkRoundTrip(RESUME, out)
  assert.equal(rt.ok, true, rt.problems.join('; '))
  // nothing outside the one inserted line changed
  const added = out.split('\n').filter(l => !RESUME.split('\n').includes(l))
  assert.equal(added.length, 1)
  assert.equal(out.split('\n').length, RESUME.split('\n').length + 1)
})

test('terms already covered are not duplicated', () => {
  const plan = planSkillsLine({ jobTerms: ['AWS', 'aws', 'Splunk', 'SIEM', 'gcp iam', 'GCP IAM'], resumeText: RESUME, options: L })
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, ['gcp iam'])
  const out = applySkillsPlan(RESUME, plan)
  const lab = labelled(out)[0]
  assert.ok(!has(lab, 'AWS') && !has(lab, 'Splunk') && !has(lab, 'SIEM'))
  // covered term AWS appears exactly as often as before
  const count = (s, w) => (s.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length
  assert.equal(count(out, 'AWS'), count(RESUME, 'AWS'))
})

test('all terms covered -> sent unchanged, no labelled line', () => {
  const plan = planSkillsLine({ jobTerms: ['AWS', 'Splunk'], resumeText: RESUME })
  assert.equal(plan.send, true)
  assert.equal(plan.skillsLine, null)
  assert.equal(applySkillsPlan(RESUME, plan), RESUME)
})

test('empty term list -> file sent unchanged', () => {
  for (const jobTerms of [[], undefined, ['', '  ']]) {
    const plan = planSkillsLine({ jobTerms, resumeText: RESUME })
    assert.equal(plan.send, true)
    assert.deepEqual(plan.addedTerms, [])
    assert.equal(applySkillsPlan(RESUME, plan), RESUME)
  }
})

test('junk terms are filtered out (GC, EAD, H1, candidates, clearance, degree, years)', () => {
  const junk = ['GC', 'EAD', 'H1', 'H1B', 'candidates', 'US Citizen', 'Top Secret', "Bachelor's degree", '5+ years', 'Remote', 'Dental', 'Senior']
  const plan = planSkillsLine({ jobTerms: [...junk, 'gcp iam'], resumeText: RESUME, options: L })
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, ['gcp iam'])
  for (const j of junk) assert.ok(plan.filteredOut.includes(j), `${j} filtered`);
  const out = applySkillsPlan(RESUME, plan)
  for (const j of ['EAD', 'H1', 'candidates']) assert.ok(!has(labelled(out)[0], j));
})

test('supported-gap terms are also placed, labelled, and listed separately', () => {
  const plan = planSkillsLine({ jobTerms: ['Wiz', 'gcp iam'], resumeText: RESUME, supportedTerms: ['Wiz'] })
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, ['Wiz', 'gcp iam'])
  assert.deepEqual(plan.fromCandidateWords, ['Wiz'])
  assert.deepEqual(plan.fromJobPostOnly, ['gcp iam'])
})

test('after placement every kept job term is covered (100% of kept terms)', () => {
  const jobTerms = ['AWS', 'gcp security', 'gcp iam', 'Chronicle SIEM', 'GC', 'C++']
  const plan = planSkillsLine({ jobTerms, resumeText: RESUME, options: L })
  const out = applySkillsPlan(RESUME, plan)
  const kept = jobTerms.filter(t => !plan.filteredOut.includes(t))
  const r = buildKeywordReport({ jobTerms: kept, resumeText: out })
  assert.equal(r.coveragePct, 100, JSON.stringify(r.unsupportedGap))
})

test('resume with no Skills heading + addSkillsSection:true: line is added before Experience, guard still passes', () => {
  const noSkills = RESUME.replace(/Skills\nCloud: AWS, Azure, Terraform\nSecurity: SIEM, Splunk, Vulnerability Management\n\n/, '')
  const plan = planSkillsLine({ jobTerms: ['gcp iam'], resumeText: noSkills, options: { ...L, addSkillsSection: true } })
  const out = applySkillsPlan(noSkills, plan)
  assert.equal(labelled(out).length, 1)
  assert.ok(out.indexOf(`${JOB_POST_LABEL}:`) < out.indexOf('Experience'))
  assert.ok(checkRoundTrip(noSkills, out).ok)
})

test('a term carrying a date-like or contact-like token is never added (guard safety)', () => {
  const plan = planSkillsLine({ jobTerms: ['FY2027', 'Windows 2019', 'hr@example.com', 'gcp iam'], resumeText: RESUME })
  assert.deepEqual(plan.addedTerms, ['gcp iam'])
  assert.ok(checkRoundTrip(RESUME, applySkillsPlan(RESUME, plan)).ok)
})

// ---------------------------------------------------------------------------
// Round 2 (2026-10-29 ~10:15 PM CT): locked skills, already-covered, no skills section,
// term in an experience bullet, on/off switches. Written BEFORE the implementation.
// ---------------------------------------------------------------------------
const NO_SKILLS = RESUME.replace(/Skills\nCloud: AWS, Azure, Terraform\nSecurity: SIEM, Splunk, Vulnerability Management\n\n/, '')
const SRC_BULLET = '• Built Splunk detections for AWS CloudTrail events.'
const count = (s, t) => { const h = ` ${normTerm(s)} `, n = ` ${normTerm(t)} `; let c = 0, i = 0; while ((i = h.indexOf(n, i)) >= 0) { c++; i += n.length - 1; } return c; }
const fn = name => { assert.equal(typeof M[name], 'function', `${name}() is not implemented yet`); return M[name]; }

test('policy defaults: one-line switches for Eshwar\'s two open questions', () => {
  assert.ok(M.DEFAULT_POLICY, 'DEFAULT_POLICY exported')
  assert.deepEqual(
    { enabled: M.DEFAULT_POLICY.enabled, labelInFile: M.DEFAULT_POLICY.labelInFile, addSkillsSection: M.DEFAULT_POLICY.addSkillsSection, captionUnplaced: M.DEFAULT_POLICY.captionUnplaced },
    { enabled: true, labelInFile: false, addSkillsSection: false, captionUnplaced: true })
})

test('(a) skills locked: file unchanged, terms reported as unplaced, reason skills_locked, sent with caption list', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp security', 'gcp iam', 'AWS'], resumeText: RESUME, skillsLocked: true })
  assert.equal(plan.reason, 'skills_locked')
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, [])
  assert.deepEqual(plan.unplacedTerms.map(normTerm).sort(), ['gcp iam', 'gcp security'])
  assert.equal(applySkillsPlan(RESUME, plan), RESUME, 'locked skills section is not edited')
  assert.match(plan.caption, /gcp security/); assert.match(plan.caption, /gcp iam/)
})

test('(a) skills locked + policy forbids caption-only terms -> not sent, reason still skills_locked', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp iam'], resumeText: RESUME, skillsLocked: true, options: { captionUnplaced: false } })
  assert.equal(plan.reason, 'skills_locked')
  assert.equal(plan.send, false)
  assert.equal(plan.blockedBy, 'policy')
})

test('(a) skills locked + exported file fails round-trip guard -> not sent', () => {
  const bad = RESUME.replace('(555) 010-2233', '(555) 010-9999')
  const plan = planSkillsLine({ jobTerms: ['gcp iam'], resumeText: RESUME, skillsLocked: true, exportedText: bad })
  assert.equal(plan.reason, 'skills_locked')
  assert.equal(plan.send, false)
  assert.equal(plan.blockedBy, 'round_trip')
  assert.ok(plan.guardProblems.length > 0)
})

test('(a) skills locked via deliver(): writer\'s bullet edit with the term is reverted, never in bullets', () => {
  const draft = RESUME.replace(SRC_BULLET, '• Built Splunk detections for AWS CloudTrail events and gcp iam reviews.')
  const d = fn('deliver')({ jobTerms: ['gcp iam'], sourceText: RESUME, draftText: draft, skillsLocked: true })
  assert.equal(d.send, true)
  assert.equal(d.reason, 'skills_locked')
  assert.equal(d.text, RESUME)
  assert.match(d.caption, /gcp iam/)
})

test('(b) term already on the skills line: counted as covered, never duplicated', () => {
  const jobTerms = ['terraform', 'Vulnerability Management', 'splunk', 'gcp iam']
  const plan = planSkillsLine({ jobTerms, resumeText: RESUME })
  assert.deepEqual(plan.report.covered, ['terraform', 'Vulnerability Management', 'splunk'])
  assert.deepEqual(plan.addedTerms, ['gcp iam'])
  const out = applySkillsPlan(RESUME, plan)
  for (const t of ['terraform', 'Vulnerability Management', 'splunk']) assert.equal(count(out, t), count(RESUME, t), t);
  assert.equal(count(out, 'gcp iam'), 1)
})

test('(b) writer already appended the term to an existing skills line: no second copy', () => {
  const draft = RESUME.replace('Security: SIEM, Splunk, Vulnerability Management', 'Security: SIEM, Splunk, Vulnerability Management, gcp iam')
  const d = fn('deliver')({ jobTerms: ['gcp iam', 'gcp security'], sourceText: RESUME, draftText: draft, options: L })
  assert.equal(d.send, true)
  assert.equal(count(d.text, 'gcp iam'), 1)
  assert.equal(count(d.text, 'gcp security'), 1)
})

test('(c) no skills section (default): no section added, reason no_skills_section, sent unchanged with caption list', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp iam', 'gcp security'], resumeText: NO_SKILLS })
  assert.equal(plan.reason, 'no_skills_section')
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, [])
  assert.deepEqual(plan.unplacedTerms, ['gcp iam', 'gcp security'])
  assert.equal(applySkillsPlan(NO_SKILLS, plan), NO_SKILLS)
  assert.match(plan.caption, /gcp iam, gcp security/)
})

test('(d) term in an experience bullet: bullet reverts to source text, term goes to the labelled line', () => {
  const draft = RESUME.replace(SRC_BULLET, '• Built Splunk detections for AWS CloudTrail and gcp security events.')
  const d = fn('deliver')({ jobTerms: ['gcp security', 'AWS'], sourceText: RESUME, draftText: draft, options: L })
  assert.equal(d.send, true, d.reason)
  assert.ok(d.text.split('\n').includes(SRC_BULLET), 'bullet back to source text')
  assert.equal(d.revertedBullets.length, 1)
  for (const b of bulletLines(d.text)) assert.ok(!has(b, 'gcp security'), b);
  assert.equal(labelled(d.text).length, 1)
  assert.ok(has(labelled(d.text)[0], 'gcp security'))
  assert.ok(checkRoundTrip(RESUME, d.text).ok)
})

test('(d) brand-new writer bullet carrying a job-post-only term is dropped, other writer edits kept', () => {
  const draft = RESUME
    .replace(SRC_BULLET, `${SRC_BULLET}\n• Led the gcp iam rollout for 40 projects.`)
    .replace('• Triaged SIEM alerts and wrote incident reports.', '• Triaged SIEM alerts and wrote clear incident reports.')
  const d = fn('deliver')({ jobTerms: ['gcp iam'], sourceText: RESUME, draftText: draft, options: L })
  assert.equal(d.send, true)
  assert.ok(!d.text.includes('Led the gcp iam rollout'))
  assert.ok(d.text.includes('wrote clear incident reports'), 'unrelated writer edit kept')
  assert.ok(has(labelled(d.text)[0], 'gcp iam'))
})

test('(d) a term backed by the candidate\'s own words may stay in a bullet', () => {
  const draft = RESUME.replace(SRC_BULLET, '• Built Splunk detections for AWS CloudTrail events and Wiz findings.')
  const d = fn('deliver')({ jobTerms: ['Wiz'], sourceText: RESUME, draftText: draft, supportedTerms: ['I triaged Wiz findings'] })
  assert.equal(d.revertedBullets.length, 0)
  assert.ok(d.text.includes('and Wiz findings'))
})

test('(e) enabled:false restores the old refusal', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp security', 'gcp iam'], resumeText: RESUME, options: { enabled: false } })
  assert.equal(plan.send, false)
  assert.equal(plan.reason, 'unverified_jd_terms')
  assert.equal(applySkillsPlan(RESUME, plan), RESUME)
  const ok = planSkillsLine({ jobTerms: ['AWS'], resumeText: RESUME, options: { enabled: false } })
  assert.equal(ok.send, true)
})

test('(e) default label is reply-only: terms join the last skills line unlabelled, caption is labelled', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp security', 'gcp iam'], resumeText: RESUME })
  const out = applySkillsPlan(RESUME, plan)
  assert.ok(!out.includes(`${JOB_POST_LABEL}:`), 'no label text in the file')
  assert.ok(out.split('\n').includes('Security: SIEM, Splunk, Vulnerability Management, gcp security, gcp iam'))
  assert.equal(out.split('\n').length, RESUME.split('\n').length, 'no new line')
  assert.match(plan.caption, /^Added to your skills from the job post: gcp security, gcp iam/)
  assert.ok(checkRoundTrip(RESUME, out).ok)
})

test('(e) addSkillsSection:true flips the no-skills answer in one line', () => {
  const plan = planSkillsLine({ jobTerms: ['gcp iam'], resumeText: NO_SKILLS, options: { addSkillsSection: true } })
  assert.equal(plan.send, true)
  assert.deepEqual(plan.addedTerms, ['gcp iam'])
  const out = applySkillsPlan(NO_SKILLS, plan)
  assert.ok(out.indexOf('gcp iam') < out.indexOf('Experience'))
  assert.ok(checkRoundTrip(NO_SKILLS, out).ok)
})

test('80-term job post: labelled lines capped at 25 terms each, every term lands, guard passes', () => {
  const jobTerms = Array.from({ length: 82 }, (_, i) => `Toolkit${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`)
  const plan = planSkillsLine({ jobTerms, resumeText: RESUME, options: L })
  const out = applySkillsPlan(RESUME, plan)
  const lab = labelled(out)
  assert.equal(lab.length, 4)
  for (const l of lab) assert.ok(l.split(':')[1].split(',').length <= 25);
  assert.equal(buildKeywordReport({ jobTerms, resumeText: out }).coveragePct, 100)
  assert.ok(checkRoundTrip(RESUME, out).ok)
})
