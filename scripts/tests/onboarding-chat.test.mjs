// Setup is a conversation, the resume first (13 Oct 2026).
//
// Asked for: one question at a time like a chat, the resume first, the profile filled from it only after the person
// says yes (otherwise they fill it in themselves on the Profile page), then only what is needed: the mobile number (it
// connects WhatsApp), Gmail (more than one inbox), and the kinds of work, with the branches of a kind to tick. A small
// dossier is written for the person at the end.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOMAINS, MOST_BRANCHES, domainById, validBranches, suggestFromResume, readContact, tidyContact, hasContact, nextStep, validSetup, STEPS, NO_CONTACT } from '../../src/lib/onboarding.ts'
import { CATEGORY_FOLDERS } from '../../src/lib/resumeOrganization.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const facts = (more = {}) => ({ phoneVerified: false, phoneRequired: true, inboxes: 0, complete: false, ...more })
const dana = { name: 'Dana Whitfield', title: 'Senior SOC Analyst', email: 'dana@example.com', phone: '314-555-0100', location: 'Saint Louis, MO', linkedin: 'linkedin.com/in/danaw' }

test('the questions come in one order: resume, may I use it, mobile, Gmail, kind of work', () => {
  assert.deepEqual(STEPS, ['resume', 'confirm', 'phone', 'gmail', 'roles', 'done'])
  assert.equal(nextStep({}, facts()), 'resume')
  // The resume was read: the person is asked before anything from it is used.
  assert.equal(nextStep({ read: dana }, facts()), 'confirm')
  // Nothing could be read from it (a scan): there is nothing to ask consent for, so the resume question stays.
  assert.equal(nextStep({ read: NO_CONTACT, resumeName: 'scan.pdf' }, facts()), 'resume')
  for (const consent of ['yes', 'no']) assert.equal(nextStep({ read: dana, consent }, facts()), 'phone', consent)
  assert.equal(nextStep({ consent: 'no' }, facts()), 'phone', 'no resume to hand: they fill the profile in themselves and carry on')
  assert.equal(nextStep({ consent: 'yes' }, facts({ phoneVerified: true })), 'gmail')
  assert.equal(nextStep({ consent: 'yes', gmailDone: true }, facts({ phoneVerified: true })), 'roles')
  assert.equal(nextStep({ consent: 'yes', gmailDone: true, domain: 'cybersecurity', branches: [] }, facts({ phoneVerified: true })), 'roles', 'a kind of work with nothing ticked is not an answer')
  assert.equal(nextStep({ consent: 'yes', gmailDone: true, domain: 'cybersecurity', branches: ['AWS Security'] }, facts({ phoneVerified: true })), 'done')
  // The number cannot be skipped while a code can be sent.
  assert.equal(nextStep({ consent: 'yes', phoneLater: true, gmailDone: true, domain: 'cybersecurity', branches: ['AWS Security'] }, facts()), 'phone')
  // When a code cannot be sent, the person is told once and carries on.
  assert.equal(nextStep({ consent: 'yes' }, facts({ phoneRequired: false })), 'phone')
  assert.equal(nextStep({ consent: 'yes', phoneLater: true }, facts({ phoneRequired: false })), 'gmail')
  // Someone already set up is asked nothing, whatever is on file.
  assert.equal(nextStep({}, facts({ complete: true })), 'done')
})

test('a kind of work has its branches, and cybersecurity\'s are the folders Files sorts resumes into', () => {
  assert.ok(DOMAINS.length >= 5)
  const cyber = domainById('cybersecurity')
  assert.ok(cyber.branches.length >= 18, 'cybersecurity is many kinds of work, not one')
  for (const b of cyber.branches) assert.ok(CATEGORY_FOLDERS.includes(b), b + ' is a folder in Files')
  for (const b of ['SIEM and Incident Response', 'Identity and Access Management', 'GRC and IT Risk', 'AWS Security']) assert.ok(cyber.branches.includes(b), b)
  assert.ok(!cyber.branches.includes('General Security') && !cyber.branches.includes('Data and Software Engineering'))
  const ids = DOMAINS.map(d => d.id); assert.equal(new Set(ids).size, ids.length)
  for (const d of DOMAINS) { assert.ok(d.branches.length >= 6, d.label); assert.equal(new Set(d.branches).size, d.branches.length, d.label) }
  // Only branches of the kind chosen are kept, each once, and no more than the most a person may tick.
  assert.deepEqual(validBranches('cybersecurity', ['AWS Security', 'AWS Security', 'Backend Engineering', 7, null, '<script>']), ['AWS Security'])
  assert.deepEqual(validBranches('nope', ['AWS Security']), []); assert.deepEqual(validBranches('cybersecurity', 'AWS Security'), [])
  assert.equal(validBranches('cybersecurity', cyber.branches).length, MOST_BRANCHES)
})

test('the resume says which kind of work to offer first', () => {
  const soc = 'Dana Whitfield\nSenior SOC Analyst\nRan alert triage in Splunk, tuned SIEM content, led incident response and wrote SOAR playbooks. Threat hunting with MITRE ATT&CK and Sigma rules.'
  const s = suggestFromResume(soc)
  assert.equal(s.domain, 'cybersecurity'); assert.equal(s.branches[0], 'SIEM and Incident Response'); assert.ok(s.branches.length <= 3)
  const devops = suggestFromResume('Platform Engineer\nDevOps with CI/CD on Jenkins and ArgoCD, Helm charts, site reliability on call.')
  assert.equal(devops.domain, 'cloud-devops'); assert.deepEqual(devops.branches, ['DevOps and Platform Engineering'])
  // A resume that points to nothing offers nothing: the person picks.
  assert.deepEqual(suggestFromResume('Office manager. Kept the diary and ordered the stationery.'), { domain: '', branches: [] })
  assert.deepEqual(suggestFromResume(''), { domain: '', branches: [] })
})

test('contact details are read from the plain words of a PDF, and only what is there', () => {
  const c = readContact('Dana Whitfield\nSenior SOC Analyst | Splunk | SIEM\ndana.whitfield@example.com | (314) 555-0100 | Saint Louis, MO\nhttps://www.linkedin.com/in/dana-whitfield\n\nSUMMARY\nAnalyst with 8 years in security operations from 2016 - 2024.')
  assert.deepEqual(c, { name: 'Dana Whitfield', title: 'Senior SOC Analyst', email: 'dana.whitfield@example.com', phone: '(314) 555-0100', location: 'Saint Louis, MO', linkedin: 'linkedin.com/in/dana-whitfield' })
  // A year range is not a phone number; a line of skills is not a name; nothing is made up.
  const thin = readContact('RESUME\nPython, AWS, Terraform\nWorked 2016 - 2024 at a bank.')
  assert.equal(thin.phone, ''); assert.equal(thin.email, ''); assert.equal(thin.name, '')
  assert.deepEqual(readContact(''), NO_CONTACT)
  assert.ok(hasContact(c) && !hasContact(NO_CONTACT) && !hasContact(tidyContact(null)))
  assert.equal(tidyContact({ name: '  Dana   Whitfield \n', email: 'DANA@Example.com', phone: 5 }).name, 'Dana Whitfield')
  assert.equal(tidyContact({ email: 'DANA@Example.com' }).email, 'dana@example.com'); assert.equal(tidyContact({ phone: 5 }).phone, '')
  assert.equal(tidyContact({ name: 'x'.repeat(500) }).name.length, 80)
})

test('what is kept of a setup cannot hold a kind of work or a branch that does not exist', () => {
  const kept = validSetup({ consent: 'maybe', domain: 'cybersecurity', branches: ['AWS Security', 'Made Up'], read: { name: 'Dana', extra: 'x' }, suggested: { domain: 'nope', branches: ['x'] }, phoneLater: 'yes', gmailDone: true, admin: true, resumeName: 'r.docx' })
  assert.deepEqual(kept, { resumeName: 'r.docx', read: { ...NO_CONTACT, name: 'Dana' }, gmailDone: true, domain: 'cybersecurity', branches: ['AWS Security'] })
  for (const junk of [null, undefined, 'x', 5, []]) assert.deepEqual(validSetup(junk), {})
})

test('nothing from the resume reaches the profile before the person says yes, and nothing they wrote is replaced', () => {
  const api = read('src/app/api/onboarding/route.ts'), upload = read('src/app/api/onboarding/resume/route.ts'), page = read('src/app/dashboard/setup/page.tsx')
  // The upload only shows what it read. It writes no profile.
  assert.ok(!upload.includes('.from("profiles")'), 'sending the resume writes nothing to the profile')
  assert.ok(upload.includes('read: hasContact(contact) ? contact : null'))
  // Saying yes fills only what is empty; saying no writes nothing.
  assert.ok(api.includes('if (read.name && !at.profile?.full_name?.trim()) patch.full_name = read.name'))
  assert.ok(api.includes('} else if (action === "decline_resume") {\n    setup = { ...setup, consent: "no" }'))
  // The mobile number read from the resume is offered only after a yes.
  assert.ok(api.includes('suggested: setup.consent === "yes" ? setup.read?.phone || "" : ""'))
  // Only the columns named are written, so a step never erases what another saved.
  assert.ok(api.includes('.upsert({ id: user.id, email: user.email, ...patch }, { onConflict: "id" })'))
  // Setup cannot be finished past an unanswered question, and the number cannot be skipped while a code can be sent.
  assert.ok(api.includes('if (step !== "done") return NextResponse.json({ ...answer(at), ok: false, error: "There is one more question to answer first." }, { status: 409'))
  assert.ok(api.includes('if (facts.phoneRequired && !facts.phoneVerified) return NextResponse.json({ error: "Verify your mobile number to carry on." }, { status: 409'))
  // The person's own dossier is written at the end: what the resume shows and the kinds of work chosen.
  assert.ok(api.includes('await saveDossierProfile(hash, {') && api.includes('fields: join(had?.fields, setup.branches)'))
  // The page asks one thing at a time and keeps no answers of its own.
  assert.ok(page.includes('fetch("/api/onboarding", { cache: "no-store" })') && page.includes('fetch("/api/onboarding/resume", { method: "POST", body: fd })'))
  assert.ok(page.includes('role="log" aria-live="polite"'))
  assert.ok(page.includes('accept=".docx,.pdf,'), 'a Word file or a PDF')
  for (const said of ['First, your resume: a Word file or a PDF.', 'Shall I fill your profile with this?', 'No, I will fill it in myself', 'Your mobile number next. It connects WhatsApp', 'You can add more than one inbox.', 'Which parts of {chosen.label.toLowerCase()}? Tick every one that fits.', 'LinkedIn search comes later and needs nothing from you now.']) assert.ok(page.includes(said), said)
  // The old form's fields are gone: nothing asks for a salary, a list of cities or a work authorization.
  for (const gone of ['minSalary', 'targetLocs', 'yearsExp', 'Set Up Your Workspace']) assert.ok(!page.includes(gone), gone)
})
