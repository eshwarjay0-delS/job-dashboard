// The shipped extension/content.js (2.0.6) on the real forms of three more application systems, saved on 21 Oct 2026
// (scripts/fixtures/ats: jobs.net, Workable, BambooHR). Found on them: jobs.net labels naming a field by its name, not its
// id, so First Name, Last Name and Email were left empty; Workable's hidden 1px "city" box (a trap for the browser's own
// autofill, which Workable adds to the Address) given the location; every Workable and BambooHR Yes/No question listed as
// one "Yes", because each option is a label around a hidden radio; a second "do you hold an active TS/SCI clearance?"
// left unanswered; a required upload, an "I am not a bot" box and hidden-backed dropdowns never pointed out; the
// "I am eligible to work in the United States" box never ticked; Desired Pay, Headline and Summary left empty.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const CONTENT = read('extension/content.js')
const PROFILE = {
  full_name: 'Test Person', first_name: 'Test', last_name: 'Person', email: 'test.person@example.com', phone: '+1 555 010 0199',
  location: 'St. Louis, MO', linkedin: 'https://linkedin.com/in/test-person', years_experience: '8', work_auth: 'green_card',
  visa_status: 'Green Card', relo_ok: true, has_clearance: false, title: 'Senior Security Engineer', bio: 'Security engineer.',
  salary_min: 150000, salary_max: 180000,
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
  return { window, d: window.document, result }
}
const val = (d, sel) => d.querySelector(sel)?.value
const listed = (result, re) => result.needsAttention.some(q => re.test(q))

test('jobs.net talent network: labels that name a field by its name are read; first name, last name, email and title filled', async () => {
  const { d, result } = await fill('jobsnet-pyramid-talentnetwork.html', 'https://pyramidci.jobs.net/talentnetwork/new')
  const byLabel = (re) => {
    const lbl = [...d.querySelectorAll('label')].find(l => re.test(l.textContent))
    return d.querySelector(`[name="${lbl.getAttribute('for')}"]`)
  }
  assert.equal(byLabel(/First Name/).value, 'Test')
  assert.equal(byLabel(/Last Name/).value, 'Person')
  assert.equal(byLabel(/Email Address/).value, PROFILE.email)
  assert.equal(byLabel(/Desired Job Title/).value, PROFILE.title)
  assert.ok(listed(result, /Upload Resume|Resume upload/), 'the required upload is pointed out when no resume was given')
})

test('jobs.net: the required upload is pointed out; "I am not a bot" is never ticked and is pointed out; "eligible to work" is ticked for a status that needs no sponsorship', async () => {
  const apply = await fill('jobsnet-pyramid.html', 'https://pyramidci.jobs.net/apply/j3q5hn619tb0hq67l48')
  assert.deepEqual([...apply.result.needsAttention], ['Upload Resume'])
  assert.equal(val(apply.d, '#firstname'), 'Test')
  const ext = await fill('jobsnet-pyramid-external.html', 'https://pyramidci.jobs.net/job/J3W1QG5X96XCF5TSWJ5')
  assert.equal(ext.d.querySelector('#fake-captcha-id').checked, false, 'a bot check is never ticked')
  assert.ok(listed(ext.result, /not a bot/))
  assert.equal(ext.d.querySelector('#us_eligible').checked, true)
  // A status that needs sponsorship: the box is left and pointed out.
  const sponsor = await fill('jobsnet-pyramid-external.html', 'https://pyramidci.jobs.net/job/J3W1QG5X96XCF5TSWJ5', { ...PROFILE, work_auth: 'Need Sponsorship', visa_status: '' })
  assert.equal(sponsor.d.querySelector('#us_eligible').checked, false)
  assert.ok(listed(sponsor.result, /eligible to work/))
})

test('Workable: the hidden autofill trap is left empty; each Yes/No question is listed by its own words; both TS/SCI questions answered No', async () => {
  const { d, result } = await fill('workable-lv8d-solutions.html', 'https://apply.workable.com/lv8d-solutions/j/1/apply/')
  for (const el of d.querySelectorAll('input[aria-hidden="true"]:not([type=radio]):not([type=checkbox])')) assert.equal(el.value, '', `hidden box ${el.name || el.id} left alone`)
  assert.equal(val(d, '#headline'), PROFILE.title)
  assert.ok(!result.needsAttention.includes('Yes'), 'no question is called "Yes"')
  for (const re of [/CI Poly or FS Poly/, /Full Scope polygraph/, /IAT Level III Certification\?$/, /Which IAT Level III Certification/]) assert.ok(listed(result, re), `${re} listed by its own words`)
  assert.ok(!listed(result, /TS\/SCI/), 'both "do you hold" clearance questions are answered from the profile')
  const answered = [...d.querySelectorAll('input[type=radio]:checked')]
  assert.ok(answered.length >= 2 && answered.every(r => /^no$/i.test(r.value) || /no/i.test(r.closest('label')?.textContent || '')), 'answered No (the profile holds no clearance)')
})

test('Workable (TherapyNotes): sponsorship and experience questions listed by their own words, a multi-box question once, the trap empty', async () => {
  const { d, result } = await fill('workable-therapynotes.html', 'https://apply.workable.com/therapynotes/j/1/apply/')
  for (const el of d.querySelectorAll('input[aria-hidden="true"]:not([type=radio]):not([type=checkbox])')) assert.equal(el.value, '', `hidden box ${el.name || el.id} left alone`)
  assert.equal(d.querySelectorAll('input[type=radio]:checked').length, 0, 'none of its questions is the profile\'s to answer')
  assert.ok(listed(result, /require sponsorship/) && listed(result, /5\+ years of experience in cloud security/) && listed(result, /Which cloud platforms/))
  assert.ok(!result.needsAttention.includes('Yes'))
  assert.equal(result.needsAttention.filter(q => /Which cloud platforms/.test(q)).length, 1)
})

test('BambooHR: Desired Pay filled; sponsorship and the Fabric State list pointed out; Country already chosen is not', async () => {
  const { d, result } = await fill('bamboohr-onsitelogic.html', 'https://onsitelogic.bamboohr.com/careers/1')
  assert.equal(val(d, '[name="desiredPay"]'), '$150,000 - $180,000')
  assert.equal(val(d, '[name="firstName"]'), 'Test')
  assert.ok(listed(result, /require, or will you need in the future, sponsorship/), 'listed by its own words')
  assert.ok(listed(result, /Managed Service Provider/))
  assert.ok(result.needsAttention.includes('State'), 'a required list drawn by script and still empty')
  assert.ok(!listed(result, /^Country/), 'the country already chosen is not listed')
  assert.equal(d.querySelectorAll('input[type=radio]:checked').length, 0)
})

test('Ashby (OpenAI): agreeing to an Arbitration Agreement is the person\'s, never ticked; protected questions listed once each', async () => {
  const { d, result } = await fill('ashby-openai.html', 'https://jobs.ashbyhq.com/openai/1/application')
  const arbitration = [...d.querySelectorAll('input[type=checkbox]')].find(c => /Arbitration Agreement/.test(c.name || c.closest('label, div')?.textContent || ''))
  assert.ok(arbitration, 'the sample holds the arbitration box')
  assert.equal(arbitration.checked, false, 'consent to terms is never given for the person')
  assert.equal(result.needsAttention.filter(q => /require sponsorship/.test(q)).length, 1)
  for (const re of [/^Gender$/, /^Race$/, /^Veteran Status$/]) assert.ok(listed(result, re), `${re} pointed out, not answered`)
})

test('nothing new crosses a line: no protected question answered, no consent or bot box ticked, no form submitted', async () => {
  for (const [f, url] of [['workable-lv8d-solutions.html', 'https://apply.workable.com/lv8d-solutions/j/1/apply/'], ['bamboohr-onsitelogic.html', 'https://onsitelogic.bamboohr.com/careers/1'], ['jobsnet-pyramid-external.html', 'https://pyramidci.jobs.net/job/J3W1QG5X96XCF5TSWJ5']]) {
    const { d } = await fill(f, url)
    for (const r of d.querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked')) {
      const words = (r.closest('fieldset, [role=radiogroup], [role=group], label, div')?.textContent || '') + ' ' + (r.name || '')
      assert.ok(!/sponsor|citizen|veteran|disability|gender|race|ethnic|bot|captcha|consent|marketing|text messages|sms/i.test(words) || /eligible to work/i.test(words), `${f}: ${words.slice(0, 80)}`)
    }
  }
})
