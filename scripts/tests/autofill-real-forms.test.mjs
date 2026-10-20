// The shipped extension/content.js, run on real application forms saved on 20 Oct 2026 (scripts/fixtures/ats: the form
// only, no job text). Until then autofill had been tested only on forms written for the test, and on the first real ones
// it gave the Country box the first name, typed the city into "Are you Hispanic/Latino?" and into a Yes/No question,
// gave the person's own name to "If yes, please identify the person you are related to", and signed the disability
// self-identification form. What a person must answer is now left to them and pointed out instead.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const CONTENT = read('extension/content.js')
const PROFILE = {
  full_name: 'Test Person', first_name: 'Test', last_name: 'Person', email: 'test.person@example.com', phone: '+1 555 010 0199',
  location: 'St. Louis, MO', linkedin: 'https://linkedin.com/in/test-person', github: 'https://github.com/test-person',
  portfolio: 'https://test-person.dev', title: 'Senior Security Engineer', bio: 'Security engineer.', skills: ['python'],
  years_experience: '8', work_auth: 'green_card', visa_status: 'Green Card', relo_ok: true, has_clearance: false,
}

// Every page is closed at the end, failed test or not: the fill leaves timers and observers running on it.
const opened = []
test.after(() => { for (const w of opened) w.close() })

function page(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true })
  const { window } = dom
  opened.push(window)
  const store = { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} }
  window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage(_m, cb) { if (typeof cb === 'function') cb({}) }, lastError: null }, storage: { sync: store, local: store, session: store } }
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, set(v) { this.textContent = v }, configurable: true })
  window.CSS = window.CSS || {}
  if (!window.CSS.escape) window.CSS.escape = (v) => String(v).replace(/([^A-Za-z0-9_-])/g, '\\$1')
  // Nothing leaves the page in a test: the fill's usage note would otherwise go to the live app.
  window.fetch = async () => ({ ok: true, json: async () => ({}) })
  window.eval(CONTENT)
  return window
}

async function fill(fixture, url) {
  const window = page(read(`scripts/fixtures/ats/${fixture}`), url)
  const result = await window.__mfSidebarBridge.runAutofillFlow(PROFILE, null, null)
  return { window, d: window.document, result, ats: window.__mfSidebarBridge.getATS() }
}

// A control by the words of its question, as a person reads the form.
function asked(d, re) {
  const say = (n) => (n?.textContent || '').replace(/\s+/g, ' ').trim()
  for (const el of d.querySelectorAll('form input, form select, form textarea')) {
    const words = [el.id && say(d.querySelector(`label[for="${el.id}"]`)), el.getAttribute('aria-label'),
      say(el.closest('.application-question')?.querySelector('.application-label')), say(el.closest('.js-form-item, .form-item')?.querySelector('label'))]
    if (words.some(w => w && re.test(w))) return el
  }
  throw new Error(`no field asks ${re}`)
}
const empty = (el) => (el.tagName === 'SELECT' ? el.selectedIndex <= 0 : !el.value)

test('Greenhouse job board (Cloudflare): contact details filled; typeaheads, sponsorship and self-ID left and pointed out', async () => {
  const { window, d, result, ats } = await fill('greenhouse-cloudflare.html', 'https://job-boards.greenhouse.io/cloudflare/jobs/8097321')
  assert.equal(ats, 'greenhouse')
  assert.equal(d.getElementById('first_name').value, 'Test')
  assert.equal(d.getElementById('last_name').value, 'Person')
  assert.equal(d.getElementById('email').value, PROFILE.email)
  assert.equal(d.getElementById('phone').value, PROFILE.phone)
  // Typeaheads: nothing to choose from in a saved page, so nothing is left typed in them.
  for (const id of ['country', 'candidate-location', 'gender', 'hispanic_ethnicity', 'veteran_status'])
    assert.equal(d.getElementById(id).value, '', `${id} is not answered by typing`)
  assert.ok(empty(asked(d, /require immigration sponsorship/)), 'sponsorship is the person\'s to answer')
  assert.ok(empty(asked(d, /live in one of the following hubs/)), 'a Yes/No question is not given the city')
  assert.ok(empty(asked(d, /^Legal Name \(if different/)), 'only if different: left empty')
  for (const re of [/require immigration/, /^Gender$/, /Hispanic\/Latino/, /^Veteran Status$/])
    assert.ok(result.needsAttention.some(q => re.test(q)), `pointed out: ${re}`)
  window.close()
})

test('a careers site in front of Greenhouse (Okta): a follow-up about relatives is never given the person\'s own name', async () => {
  const { window, d, result } = await fill('okta-careers.html', 'https://www.okta.com/company/careers/ga/corporate-counsel-u-s-federal-defense-and-national-security-compliance-8088417/')
  assert.equal(asked(d, /^First Name/).value, 'Test')
  assert.equal(asked(d, /^Email/).value, PROFILE.email)
  assert.ok(empty(asked(d, /^If yes, please identify name of person/)), 'the follow-up is left empty')
  assert.ok(empty(asked(d, /^If yes, please describe/)))
  for (const re of [/^Veteran Status/, /^Race/, /^Gender/]) assert.ok(empty(asked(d, re)), `${re} untouched`)
  assert.ok(result.needsAttention.some(q => /U\.S\. Person/.test(q)))
  window.close()
})

test('Lever (Palantir): authorized Yes and clearance No from the profile; sponsorship, pronunciation and the self-ID signature left', async () => {
  const { window, d, result, ats } = await fill('lever-palantir.html', 'https://jobs.lever.co/palantir/bc803bd5-7793-452d-9ae5-9301ee24615a/apply')
  assert.equal(ats, 'lever')
  assert.equal(d.querySelector('input[name="name"]').value, 'Test Person')
  assert.equal(d.querySelector('input[name="email"]').value, PROFILE.email)
  assert.equal(d.querySelector('input[name="urls[LinkedIn]"]').value, PROFILE.linkedin)
  const checked = (re) => [...asked(d, re).closest('.application-question').querySelectorAll('input[type=radio]')].filter(r => r.checked).map(r => r.value)
  assert.deepEqual(checked(/legally authorized to work/), ['Yes'])
  assert.deepEqual(checked(/active US security clearance/), ['No'])
  assert.deepEqual(checked(/require sponsorship/), [], 'sponsorship is the person\'s to answer')
  assert.ok(empty(asked(d, /^Name Pronunciation/)), 'not given the full name')
  assert.equal(d.querySelector('input[name="eeo[disabilitySignature]"]').value, '', 'the self-identification form is never signed')
  assert.ok(empty(d.querySelector('select[name="eeo[veteran]"]')) && empty(d.querySelector('select[name="eeo[disability]"]')))
  assert.ok(result.needsAttention.some(q => /require sponsorship/.test(q)), 'pointed out by its question')
  assert.ok(!result.needsAttention.some(q => /^(Yes|No)$/.test(q)), 'a question is named by its words, not its first answer')
  window.close()
})

test('Lever (Spotify): a country list asked as "location" is chosen; a link is not given twice; self-ID left and pointed out', async () => {
  const { window, d, result } = await fill('lever-spotify.html', 'https://jobs.lever.co/spotify/223f9722-3579-4ff2-b123-e4cc7b0c1a64/apply')
  const where = asked(d, /^What is your location\?/)
  assert.equal(where.options[where.selectedIndex].text.trim(), 'United States')
  assert.equal(d.querySelector('input[name="urls[Portfolio]"]').value, PROFILE.portfolio)
  assert.equal(d.querySelector('input[name="urls[Other]"]').value, '', 'the portfolio already went in its own box')
  assert.equal([...d.querySelectorAll('input[name="pronouns"]')].filter(x => x.checked).length, 0, 'pronouns are the person\'s to give')
  assert.equal([...d.querySelectorAll('input[name^="surveysResponses"]')].filter(r => r.checked).length, 0, 'no self-ID answer')
  assert.ok(result.needsAttention.some(q => /gender/i.test(q)) && result.needsAttention.some(q => /ethnicity/i.test(q)))
  window.close()
})

test('a typeahead is answered by choosing its option, and emptied again when no option matches', async () => {
  const window = page(`<!doctype html><html><body><form>
    <label id="country-label" for="country">Country</label>
    <input id="country" class="select__input" role="combobox" aria-autocomplete="list" aria-controls="country-list" type="text" value="">
    <div id="country-list"></div>
    <label id="gender-label" for="gender">Gender</label>
    <input id="gender" class="select__input" role="combobox" aria-autocomplete="list" type="text" value="">
    <label for="first_name">First Name</label><input id="first_name" type="text">
    <label for="li">Please provide your LinkedIn profile URL</label><input id="li" type="text">
    <label for="more">If yes, please provide details</label><input id="more" type="text">
  </form></body></html>`, 'https://job-boards.greenhouse.io/acme/jobs/1')
  const d = window.document
  const box = d.getElementById('country')
  let chosen = ''
  // What react-select does: options appear as the person types; clicking one is the answer.
  box.addEventListener('input', () => {
    const list = d.getElementById('country-list')
    list.innerHTML = ''
    for (const name of ['United Kingdom', 'United States', 'United Arab Emirates'].filter(n => n.toLowerCase().startsWith(box.value.toLowerCase()) && box.value)) {
      const o = d.createElement('div'); o.setAttribute('role', 'option'); o.textContent = name
      o.addEventListener('click', () => { chosen = name }); list.append(o)
    }
  })
  await window.__mfSidebarBridge.runAutofillFlow(PROFILE, null, null)
  assert.equal(chosen, 'United States', 'the matching option is clicked')
  assert.equal(d.getElementById('first_name').value, 'Test')
  assert.equal(d.getElementById('li').value, PROFILE.linkedin, 'a question that asks for a link plainly is answered')
  assert.equal(d.getElementById('more').value, '', 'a follow-up to a yes is not')
  assert.equal(d.getElementById('gender').value, '', 'a self-ID typeahead is never typed into')

  // No option matches: what was typed is taken back out.
  const lone = page(`<!doctype html><html><body><form><label for="country">Country</label>
    <input id="country" class="select__input" role="combobox" aria-autocomplete="list" type="text" value=""></form></body></html>`,
    'https://job-boards.greenhouse.io/acme/jobs/2')
  await lone.__mfSidebarBridge.runAutofillFlow(PROFILE, null, null)
  assert.equal(lone.document.getElementById('country').value, '')
  window.close(); lone.close()
})
