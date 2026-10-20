// Which saved resume is the same kind of role as a job (title first, niche second), and what a short message about the
// last job asks for. Owner, 20 Oct 2026: "Resume mapping isn't accurate ... it should've selected something categorized
// more of security Analyst ... always start by picking that all."
import test from 'node:test'
import assert from 'node:assert/strict'

const R = await import('../../src/lib/role-match.ts')

const cand = (name, extra = {}) => ({ candidate: { path: `/u/${name}.docx`, email: 'a@x.com', folder: '', name, depth: 0, keywords: [], at: 1, ...extra }, shows: 0, of: 10 })

test('Salesforce roles use title-first selection without confusing administrators or unrelated developers', () => {
  assert.equal(R.titleFit('Salesforce Developer', 'Senior Salesforce Developer'), 5)
  assert.equal(R.titleFit('Salesforce Developer', 'SFDC Developer'), 5)
  const ranked = [cand('Software Developer'), cand('Salesforce Administrator'), cand('SFDC Developer'), cand('Salesforce Developer (CPQ / Revenue Cloud)')]
  assert.deepEqual(R.narrowByRole(ranked, 'Salesforce Developer').pool.map(r => r.candidate.name), ['SFDC Developer', 'Salesforce Developer (CPQ / Revenue Cloud)'])
  assert.deepEqual(R.narrowByRole(ranked, 'Salesforce Administrator').pool.map(r => r.candidate.name), ['Salesforce Administrator'])
  assert.ok(R.titleFit('Salesforce Developer', 'Software Developer') < 4)
  assert.ok(R.titleFit('Salesforce Developer', 'Salesforce Administrator') < 4)
  assert.equal(R.narrowByRole([cand('Software Developer'), cand('Salesforce Administrator')], 'Salesforce Developer').narrowed, false, 'no matching title retains the fallback pool')
})

test('titles are compared as kinds of role, not as words', () => {
  const fit = R.titleFit
  assert.equal(fit('Security Analyst', 'Cyber Security Analyst'), 5)
  assert.equal(fit('Cybersecurity Analyst', 'Information Security Analyst'), 5)
  assert.equal(fit('Senior Security Analyst - Northpier', 'Security Analyst II'), 5, 'levels and companies are not the role')
  assert.equal(fit('Security Analyst', 'SOC Analyst'), 4, 'the same role with a speciality')
  assert.equal(fit('Application Security Engineer', 'AppSec Engineer'), 5)
  assert.ok(fit('Security Analyst', 'AppSec Engineer') < 4, 'a different kind of work')
  assert.ok(fit('Security Analyst', 'Identity and Access Management Engineer') < 4)
  assert.ok(fit('Security Analyst', 'AI Security Engineer') < 4)
  assert.ok(fit('IAM Engineer', 'AppSec Engineer') < 4, 'two different specialities are not the same role')
  assert.ok(fit('Data Engineer', 'Software Engineer') < 4)
  assert.equal(fit('Cloud Engineer', 'Cloud Engineer (AWS)'), 5)
  assert.equal(fit('Resume', 'Eshwar Janjirala'), 0)
})

test('the role a job post asks for is read from a label, from "looking for", or from its first line', () => {
  const recruiter = `Hi,\n\nI'm an I.T. recruiter at InfoPeople Corp.\n\nThe client is looking for a extremely skilled Security Analyst. The position is located in New York, NY.\n\nRole: Security Analyst\nLocation: New York, NY (Hybrid)\nDuration: 12 Months`
  assert.equal(R.roleOfJob(recruiter), 'Security Analyst')
  assert.equal(R.roleOfJob('Hi,\n\nThe client is looking for a extremely skilled Security Analyst. Location: NY'), 'Security Analyst')
  assert.equal(R.roleOfJob('Application Security Engineer. You will run threat modeling, Burp Suite testing and OWASP Top 10 reviews.'), 'Application Security Engineer')
  assert.equal(R.roleOfJob('Job Title: Senior SOC Analyst (Remote) - 6 month contract\nLocation: Remote'), 'Senior SOC Analyst')
  assert.equal(R.roleOfJob('Role: You will lead a team of five engineers across three time zones and report to the CTO'), '')
  assert.equal(R.roleOfJob('Thanks for your time yesterday, here is the plan'), '')
  assert.equal(R.isGenericSecurityRole('Cyber Security Analyst'), true)
  assert.equal(R.isGenericSecurityRole('SOC Analyst'), false)
  assert.equal(R.isGenericSecurityRole('Software Engineer'), false)
})

test('step one of a pick: every resume with the job\'s title, all of them, and only when there are some', () => {
  const ranked = [cand('AI Security Lead', { title: 'AI Security Engineer', folder: 'AI Security and Governance' }), cand('AppSec', { title: 'Application Security Engineer' }),
    cand('Cyber Security Analyst', { folder: 'Identity and Access Management' }), cand('Cybersecurity Analyst Cloud', { title: 'Cyber Security Analyst' }), cand('IAM', { title: 'IAM Engineer' })]
  const { pool, narrowed } = R.narrowByRole(ranked, 'Security Analyst')
  assert.deepEqual(pool.map(r => r.candidate.name), ['Cyber Security Analyst', 'Cybersecurity Analyst Cloud'], 'both resumes titled for it, whatever folder each sits in')
  assert.equal(narrowed, true)
  // Nothing of that title: nothing is left out.
  const none = R.narrowByRole(ranked.filter(r => !/Analyst/.test(r.candidate.name)), 'Security Analyst')
  assert.equal(none.pool.length, 3); assert.equal(none.narrowed, false)
  // No role read from the post: nothing is left out either.
  assert.equal(R.narrowByRole(ranked, '').pool.length, 5)
})

test('a resume is read by the title in its name, however the name is written', () => {
  const ranked = ['Eshwar Janjirala - Cyber Security Analyst', 'Jayeshwar_CyberSecurityAnalyst_2024', 'Resume_AppSec_Engineer_v3.docx', 'Eshwar_Resume', 'Cloud DevOps Engineer', 'IAM-Engineer'].map(n => cand(n))
  const names = (role) => R.narrowByRole(ranked, role).pool.map(r => r.candidate.name)
  assert.deepEqual(names('Security Analyst'), ['Eshwar Janjirala - Cyber Security Analyst', 'Jayeshwar_CyberSecurityAnalyst_2024'])
  assert.deepEqual(names('Application Security Engineer'), ['Resume_AppSec_Engineer_v3.docx'])
  assert.deepEqual(names('DevOps Engineer'), ['Cloud DevOps Engineer'], 'DevOps is one word, not two')
  assert.equal(R.titleFit('Security Analyst', 'Eshwar_Resume'), 0)
})

test('a resume named by the person: by its title, its name or its folder', () => {
  const ranked = [cand('AI + AppSec', { title: 'Application Security Engineer', folder: 'AI Security and Governance' }),
    cand('Cyber Security Analyst', { folder: 'Identity and Access Management' }), cand('SOC lead', { folder: 'SIEM and Incident Response' })]
  assert.deepEqual(R.matchHint(ranked, 'Cybersecurity Analyst').map(r => r.candidate.name), ['Cyber Security Analyst'])
  assert.deepEqual(R.matchHint(ranked, 'soc').map(r => r.candidate.name), ['SOC lead'])
  assert.deepEqual(R.matchHint(ranked, 'AppSec').map(r => r.candidate.name), ['AI + AppSec'])
  assert.deepEqual(R.matchHint(ranked, 'identity and access').map(r => r.candidate.name), ['Cyber Security Analyst'])
  assert.deepEqual(R.matchHint(ranked, 'Kubernetes Engineer'), [], 'nothing of that name: said so, not guessed')
  assert.deepEqual(R.titlesOf(ranked), ['Application Security Engineer', 'Cyber Security Analyst', 'SOC lead'])
})

test('a short message about the last job is an instruction, exactly as written in the screenshot', () => {
  const said = 'Make another one with selecting Cybersecurity Analyst resume'
  assert.equal(said.length, 60, 'the length that made it a "job post"')
  assert.deepEqual(R.parseInstruction(said), { hint: 'Cybersecurity Analyst', again: false })
  assert.deepEqual(R.parseInstruction('redo with the SOC resume'), { hint: 'SOC', again: false })
  assert.deepEqual(R.parseInstruction('Please use the AppSec one'), { hint: 'AppSec', again: false })
  assert.deepEqual(R.parseInstruction('Try my Cloud Security Engineer resume instead'), { hint: 'Cloud Security Engineer', again: false })
  assert.deepEqual(R.parseInstruction('make another one'), { hint: '', again: true })
  assert.deepEqual(R.parseInstruction('Make another one with a different resume'), { hint: '', again: true })
  assert.deepEqual(R.parseInstruction('Cybersecurity Analyst resume please'), { hint: 'Cybersecurity Analyst', again: false })
  for (const notOne of ['Thanks', 'hello there', 'We need one more security engineer who knows Splunk and CrowdStrike for a contract in Dallas',
    'Need a Splunk engineer for 6 months contract remote', 'Looking for SOC analyst', 'Build one data pipeline in Python and Spark for a 6 month contract']) assert.equal(R.parseInstruction(notOne), null, notOne)
  const post = 'Use your Python skills to build detections.\nResponsibilities: triage alerts.\nRequirements: 5 years of experience with Splunk.'
  assert.equal(R.parseInstruction(post), null, 'a job post is never an instruction')
  assert.equal(R.parseInstruction('Use Python and Spark to build ETL pipelines for our data platform team; resume parsing experience is a plus for this role'), null, 'a short job post that starts with a verb and says "resume" is still a post (over 120 characters)')
  assert.deepEqual(R.parseInstruction('Please make another one using the Cloud Security Engineer resume instead of the AppSec one'), { hint: 'Cloud Security Engineer', again: false })
})

test('a job post that ends with "use the X resume" is the post and the name', () => {
  const post = 'Security Analyst\nRole: Security Analyst\nLocation: New York, NY\nDuration: 12 Months\nTechnical skills: EC2, Docker, SQL'
  assert.deepEqual(R.splitTailInstruction(`${post}\nuse the Cybersecurity Analyst resume`), { jd: post, hint: 'Cybersecurity Analyst' })
  assert.deepEqual(R.splitTailInstruction(`${post}\n1`), { jd: `${post}\n1`, hint: '' })
  assert.deepEqual(R.splitTailInstruction(post), { jd: post, hint: '' })
})

test('a short question about the bot\'s own work is read as one; a job post or an instruction is not', () => {
  for (const q of ['Why did you pick that resume?', 'why did you choose the IAM one', 'how come you used the AppSec resume', 'Which resume did you use?', 'what resume did you pick for that one']) assert.equal(R.parseQuestion(q), 'why', q)
  for (const q of ['What resumes do I have?', 'show me my resumes', 'which resumes are saved', 'list my resumes']) assert.equal(R.parseQuestion(q), 'list', q)
  for (const no of ['Thanks', 'use the SOC resume', 'show me the SOC resume', 'Why would a Security Analyst need Kotlin? Looking for someone with Java, Kotlin and SQL experience for a 12 month contract in New York']) assert.equal(R.parseQuestion(no), null, no)
})
