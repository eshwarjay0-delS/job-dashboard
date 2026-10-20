// The shipped extension/content.js on the real forms of five more application systems, saved on 20 Oct 2026
// (scripts/fixtures/ats: the form only, no job text). Found on them: a Recruitee "Are you a U.S. citizen?" answered No
// because a note beside it said "security clearance"; JazzHR's City box given "St. Louis, MO" with State left empty;
// its disability form's signature filled with the person's name; Yes/No questions drawn as selects never answered;
// and required questions left empty not pointed out at all (a privacy-policy box on iCIMS and Teamtailor).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const CONTENT = read('extension/content.js')
const PROFILE = {
  full_name: 'Test Person', first_name: 'Test', last_name: 'Person', email: 'test.person@example.com', phone: '+1 555 010 0199',
  location: 'St. Louis, MO', linkedin: 'https://linkedin.com/in/test-person', years_experience: '8', work_auth: 'green_card',
  visa_status: 'Green Card', relo_ok: true, has_clearance: false,
}
const opened = []
test.after(() => { for (const w of opened) w.close() })

async function fill(fixture, url, profile = PROFILE) {
  const dom = new JSDOM(read(`scripts/fixtures/ats/${fixture}`), { url, runScripts: 'outside-only', pretendToBeVisual: true })
  const { window } = dom
  opened.push(window)
  const store = { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} }
  window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage(_m, cb) { if (typeof cb === 'function') cb({}) }, lastError: null }, storage: { sync: store, local: store, session: store } }
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, set(v) { this.textContent = v }, configurable: true })
  window.CSS = window.CSS || {}
  if (!window.CSS.escape) window.CSS.escape = (v) => String(v).replace(/([^A-Za-z0-9_-])/g, '\\$1')
  window.fetch = async () => ({ ok: true, json: async () => ({}) })
  window.eval(CONTENT)
  const result = await window.__mfSidebarBridge.runAutofillFlow(profile, null, null)
  return { window, d: window.document, result, ats: window.__mfSidebarBridge.getATS() }
}

const text = (n) => (n?.textContent || '').replace(/\s+/g, ' ').trim()
// A control by what its label or its placeholder says.
function box(d, re) {
  for (const el of d.querySelectorAll('form input, form select, form textarea')) {
    const words = [el.id && text(d.querySelector(`label[for="${el.id}"]`)), el.getAttribute('placeholder'), el.closest('label') && text(el.closest('label').cloneNode(true)),
      text(el.closest('.form-group')?.querySelector('label'))]
    if (words.some(w => w && re.test(w))) return el
  }
  throw new Error(`no field says ${re}`)
}
const chosen = (sel) => sel.options[sel.selectedIndex]?.text.trim() || ''
const flagged = (result, re) => result.needsAttention.some(q => re.test(q))

test('JazzHR (Cambridge International): city and state apart, Yes/No selects answered from the profile, protected and unknown questions left and listed', async () => {
  const { d, result, ats } = await fill('jazzhr-cambridge.html', 'https://cambridgeinternationalsystems.applytojob.com/apply/jMPJcx1wCY/Cyber-Security-Analyst')
  assert.equal(ats, 'jazzhr')
  assert.equal(box(d, /^First Name/).value, 'Test')
  assert.equal(box(d, /^Email Address/).value, PROFILE.email)
  assert.equal(d.querySelector('input[placeholder="City"]').value, 'St. Louis', 'the city alone, as there is a box for the state')
  assert.equal(d.querySelector('input[placeholder="State/Province"]').value, 'Missouri')
  assert.equal(chosen(box(d, /willing to relocate/)), 'Yes', 'a Yes/No question drawn as a select')
  assert.equal(chosen(box(d, /current clearance level/)), 'No Clearance')
  // Never answered: citizenship, sponsorship, "denied or revoked", self-identification, and the signature on that form.
  for (const re of [/U\.S\. Citizen\?/, /require sponsorship/, /security clearance eligibility/, /essential functions/])
    assert.equal(chosen(box(d, re)), '-- No answer --', `${re} is the person's to answer`)
  assert.equal(d.querySelector('input[id*="eeoc_disability_signature"]').value, '', 'a self-identification form is never signed')
  assert.equal(chosen(box(d, /^Gender/)), 'Decline to answer')
  // Pointed out by their own words, not by the first words of a label or the options inside it.
  for (const re of [/U\.S\. Citizenship/, /require sponsorship/, /^Gender$/, /^Race\/Ethnicity$/, /^Veteran status$/, /How did you hear/, /security clearance eligibility/])
    assert.ok(flagged(result, re), `pointed out: ${re}`)
  assert.ok(!result.needsAttention.some(q => /GenderDecline|DeclineFemale/.test(q)), 'no label with its options run into it')
})

test('JazzHR (IntelliPro): city and state apart, nothing else guessed', async () => {
  const { d, result } = await fill('jazzhr-intellipro.html', 'https://intellipro.applytojob.com/apply/ciw5EIsshz/Network-DevOps-Engineer')
  assert.equal(d.querySelector('input[placeholder="City"]').value, 'St. Louis')
  assert.equal(d.querySelector('input[placeholder="State/Province"]').value, 'Missouri')
  assert.equal(box(d, /^Phone/).value, PROFILE.phone)
  assert.equal(result.needsAttention.length, 0, 'nothing is left that the person has to answer')
})

test('Recruitee: "Are you a U.S. citizen?" is not answered because a note beside it says "security clearance"', async () => {
  const { d, result } = await fill('breezy-recruitee-teamtailor-aikido.html', 'https://aikido.recruitee.com/o/security-engineer/c/new')
  assert.equal(d.querySelectorAll('input[type=radio]:checked').length, 0, 'no radio answered: citizenship and sponsorship are the person\'s')
  assert.equal(d.querySelector('input[type=checkbox]:checked'), null)
  assert.equal(box(d, /^Full name/).value, 'Test Person')
  assert.ok(flagged(result, /U\.S\. citizen/) && flagged(result, /require sponsorship/), 'both pointed out')
  assert.ok(flagged(result, /near Boston or DC/), 'a required question with Yes and No boxes is asked once, by its question')
  assert.ok(!result.needsAttention.some(q => /^(Yes|No)$/.test(q)))
})

test('Teamtailor: a required address and the privacy-policy box are left and pointed out', async () => {
  const { d, result } = await fill('breezy-recruitee-teamtailor-detectify.html', 'https://detectify.teamtailor.com/jobs/6035290/applications/new')
  assert.equal(box(d, /^First name/).value, 'Test')
  assert.equal(d.querySelector('input[type=checkbox]:checked'), null, 'consent is the person\'s act')
  assert.ok(flagged(result, /^Address$/), result.needsAttention.join(' | '))
  assert.ok(flagged(result, /I agree that I have read the Privacy/i))
})

test('iCIMS: the email gate gets the email, and each required consent box is left and pointed out', async () => {
  const peraton = await fill('icims-peraton.html', 'https://careers-peraton.icims.com/jobs/172450/cirt-tier-2-analyst/login?in_iframe=1')
  assert.equal(peraton.ats, 'icims')
  assert.equal(peraton.d.querySelector('input[name=css_loginName]').value, PROFILE.email)
  assert.equal(peraton.d.querySelectorAll('input[type=checkbox]:checked').length, 0)
  assert.ok(flagged(peraton.result, /I accept the Privacy Policy/) && flagged(peraton.result, /Peraton Job Application Privacy Notice/))
  const gdms = await fill('icims-gdms.html', 'https://careers-gdms.icims.com/jobs/75183/siprnet-network-engineer/login?in_iframe=1')
  assert.ok(flagged(gdms.result, /I agree/))
})

test('Greenhouse (the older embedded form of Tanium and Abnormal): contact details, links and the preferred names; sponsorship and self-ID left', async () => {
  for (const [file, url] of [['greenhouse-classic-tanium.html', 'https://job-boards.greenhouse.io/tanium/jobs/1'], ['greenhouse-classic-abnormal.html', 'https://job-boards.greenhouse.io/abnormal/jobs/1']]) {
    const { d, result, ats } = await fill(file, url)
    assert.equal(ats, 'greenhouse')
    assert.equal(d.getElementById('first_name').value, 'Test')
    assert.equal(d.getElementById('email').value, PROFILE.email)
    for (const re of [/immigration|sponsor/i, /^Gender/, /Veteran Status/]) assert.ok(flagged(result, re), `${file}: pointed out ${re}`)
    for (const id of ['gender', 'veteran_status']) if (d.getElementById(id)) assert.equal(d.getElementById(id).value, '')
  }
})

test('a citizen with a note-and-question like Recruitee\'s is still never answered by the clearance rule', async () => {
  const html = `<!doctype html><html><body><form action="/apply"><div class="q"><label>Are you a U.S. citizen? (Note: U.S. citizenship is required for this position due to government contract specifications or federal security clearance mandates) *</label>
    <label><input type="radio" name="c" value="true" required> Yes</label><label><input type="radio" name="c" value="false" required> No</label></div>
    <div class="q"><label>Do you currently hold an active security clearance? *</label>
    <label><input type="radio" name="k" value="true" required> Yes</label><label><input type="radio" name="k" value="false" required> No</label></div>
    <div class="q"><label>Have you ever had a security clearance denied or revoked? *</label>
    <label><input type="radio" name="r" value="true" required> Yes</label><label><input type="radio" name="r" value="false" required> No</label></div></form></body></html>`
  const dom = new JSDOM(html, { url: 'https://example.com/apply', runScripts: 'outside-only', pretendToBeVisual: true })
  const { window } = dom
  opened.push(window)
  const store = { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} }
  window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage(_m, cb) { if (typeof cb === 'function') cb({}) }, lastError: null }, storage: { sync: store, local: store, session: store } }
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, set(v) { this.textContent = v }, configurable: true })
  window.CSS = window.CSS || {}
  if (!window.CSS.escape) window.CSS.escape = (v) => String(v).replace(/([^A-Za-z0-9_-])/g, '\\$1')
  window.fetch = async () => ({ ok: true, json: async () => ({}) })
  window.eval(CONTENT)
  await window.__mfSidebarBridge.runAutofillFlow({ ...PROFILE, has_clearance: true }, null, null)
  const on = (name) => [...window.document.querySelectorAll(`input[name=${name}]`)].filter(r => r.checked).map(r => r.value)
  assert.deepEqual(on('c'), [], 'citizenship is never answered')
  assert.deepEqual(on('k'), ['true'], 'the clearance the person holds is answered from the profile')
  assert.deepEqual(on('r'), [], '"ever denied or revoked" is a different question with the same word in it')
})
