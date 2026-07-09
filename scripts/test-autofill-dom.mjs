// Simulated-DOM test for the extension's autofill engine (extension/content.js).
//
// WHY THIS EXISTS: the #1 open unknown in TODO.md is that autofill has never been
// click-through tested — no agent session can drive a real Chrome with the unpacked
// extension. This harness is the next-best thing: it loads the REAL content.js
// (unmodified, same file the extension ships) into a jsdom page containing a
// realistic Greenhouse-style application form, runs the REAL fill flow via the
// window.__mfSidebarBridge export, and asserts fields actually get filled, the
// work-auth radio is answered, EEO/sponsorship questions are left alone but
// surfaced, and the multi-step MutationObserver re-fill works.
//
// It is NOT a substitute for a real-browser test (no real React re-rendering,
// no real ATS quirks) — but it upgrades confidence from "syntax-checked only"
// to "engine verified against a realistic DOM".
//
// Run:  node scripts/test-autofill-dom.mjs      (exit 0 = all pass)

import { JSDOM } from "jsdom"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contentJs = readFileSync(path.join(__dirname, "..", "extension", "content.js"), "utf8")

// ── Minimal chrome.* stub — just enough for content.js's top-level code ──────
function makeChromeStub() {
  return {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage(_msg, cb) { if (typeof cb === "function") cb({}) },
      lastError: null,
    },
    storage: {
      // Real chrome.storage.*.get supports BOTH callback and promise calling
      // conventions (a Promise is returned when no callback is passed) — sidebar.js
      // calls storage.local.get with await and no callback, so the stub must too.
      sync:    { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} },
      local:   { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} },
      session: { get(_k, cb) { const r = {}; if (cb) { cb(r); return } return Promise.resolve(r) }, set() {} },
    },
  }
}

// jsdom's innerText support has historically lagged real browsers. The engine
// reads label.innerText in several places — shim it to textContent when absent
// (close enough for plain-text labels, which is all these fixtures use).
function shimInnerText(window) {
  const proto = window.HTMLElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, "innerText")
  if (!desc) {
    Object.defineProperty(proto, "innerText", {
      get() { return this.textContent },
      set(v) { this.textContent = v },
    })
  } else {
    // Probe: some implementations exist but return undefined pre-layout
    const probe = window.document.createElement("div")
    probe.textContent = "x"
    if (probe.innerText !== "x") {
      Object.defineProperty(proto, "innerText", {
        get() { return this.textContent },
        set(v) { this.textContent = v },
      })
    }
  }
}

// ── Fixture: realistic Greenhouse-style application form ─────────────────────
const GREENHOUSE_FORM = `<!doctype html><html><head><title>Job Application for Senior Security Engineer at TestCo</title></head>
<body>
  <h1 class="app-title">Senior Security Engineer</h1>
  <div class="company-name">at TestCo</div>
  <form id="application_form" action="/testco/jobs/123/applications">
    <div class="field">
      <label for="first_name">First Name *</label>
      <input type="text" id="first_name" name="job_application[first_name]">
    </div>
    <div class="field">
      <label for="last_name">Last Name *</label>
      <input type="text" id="last_name" name="job_application[last_name]">
    </div>
    <div class="field">
      <label for="email">Email *</label>
      <input type="email" id="email" name="job_application[email]">
    </div>
    <div class="field">
      <label for="phone">Phone *</label>
      <input type="tel" id="phone" name="job_application[phone_number]">
    </div>
    <div class="field">
      <label for="job_application_location">Location (City)</label>
      <input type="text" id="job_application_location" name="job_application[location]">
    </div>
    <div class="field">
      <label for="question_linkedin">LinkedIn Profile</label>
      <input type="text" id="question_linkedin" name="job_application[answers_attributes][0][text_value]">
    </div>
    <div class="field">
      <label for="resume">Resume/CV *</label>
      <input type="file" id="resume" name="job_application[resume]">
    </div>
    <div class="field">
      <label for="cover_letter_text">Cover Letter</label>
      <textarea id="cover_letter_text" name="job_application[cover_letter]"></textarea>
    </div>

    <!-- Custom questions -->
    <div class="field question">
      <label>Are you legally authorized to work in the United States? *</label>
      <div>
        <input type="radio" id="auth_yes" name="question_auth" value="Yes"><label for="auth_yes">Yes</label>
        <input type="radio" id="auth_no"  name="question_auth" value="No"><label for="auth_no">No</label>
      </div>
    </div>
    <div class="field question">
      <label>Will you now or in the future require sponsorship for employment visa status? *</label>
      <div>
        <input type="radio" id="spons_yes" name="question_sponsorship" value="Yes"><label for="spons_yes">Yes</label>
        <input type="radio" id="spons_no"  name="question_sponsorship" value="No"><label for="spons_no">No</label>
      </div>
    </div>
    <div class="field question">
      <label for="years_exp">How many years of experience do you have? *</label>
      <input type="text" id="years_exp" name="question_years_of_experience">
    </div>
    <div class="field question">
      <label>Are you willing to relocate for this role? *</label>
      <div>
        <input type="radio" id="reloc_yes" name="question_relocate" value="Yes"><label for="reloc_yes">Yes</label>
        <input type="radio" id="reloc_no"  name="question_relocate" value="No"><label for="reloc_no">No</label>
      </div>
    </div>
    <div class="field question">
      <label>Do you have an active government security clearance? *</label>
      <div>
        <input type="radio" id="clear_yes" name="question_clearance" value="Yes"><label for="clear_yes">Yes</label>
        <input type="radio" id="clear_no"  name="question_clearance" value="No"><label for="clear_no">No</label>
      </div>
    </div>
    <div class="field question">
      <label>Can you start immediately? *</label>
      <div>
        <input type="radio" id="start_yes" name="question_start" value="Yes"><label for="start_yes">Yes</label>
        <input type="radio" id="start_no"  name="question_start" value="No"><label for="start_no">No</label>
      </div>
    </div>

    <!-- EEO block — must NEVER be auto-answered -->
    <div class="field question">
      <label for="gender">Gender</label>
      <select id="gender" name="eeo_gender">
        <option value="">Please select</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="decline">I don't wish to answer</option>
      </select>
    </div>
    <div class="field question">
      <label for="race">Race/Ethnicity (Hispanic or Latino?)</label>
      <select id="race" name="eeo_race">
        <option value="">Please select</option>
        <option value="hispanic">Hispanic or Latino</option>
        <option value="not_hispanic">Not Hispanic or Latino</option>
      </select>
    </div>
    <div class="field question">
      <label for="veteran">Veteran Status</label>
      <select id="veteran" name="eeo_veteran">
        <option value="">Please select</option>
        <option value="not_veteran">I am not a protected veteran</option>
        <option value="veteran">I identify as a veteran</option>
      </select>
    </div>
    <div class="field question">
      <label for="disability">Disability Status</label>
      <select id="disability" name="eeo_disability">
        <option value="">Please select</option>
        <option value="yes">Yes, I have a disability</option>
        <option value="no">No, I do not have a disability</option>
      </select>
    </div>

    <!-- Checkboxes: attestation SHOULD be checked, marketing opt-in must NOT -->
    <div class="field">
      <input type="checkbox" id="certify" name="certify">
      <label for="certify">I certify that the information provided in this application is true and accurate.</label>
    </div>
    <div class="field">
      <input type="checkbox" id="marketing" name="marketing_opt_in">
      <label for="marketing">Email me about future job openings and career tips.</label>
    </div>

    <button type="submit" data-qa="submit-app-button">Submit Application</button>
  </form>
</body></html>`

// Generic (non-ATS) careers form — exercises the FIELD_MAP/label-hint pass.
const GENERIC_FORM = `<!doctype html><html><head><title>Careers — Apply</title></head>
<body>
  <form>
    <div class="form-group"><label for="g_name">Full Name</label><input id="g_name" type="text"></div>
    <div class="form-group"><label for="g_email">Email Address</label><input id="g_email" type="email"></div>
    <div class="form-group"><label for="g_phone">Phone Number</label><input id="g_phone" type="text"></div>
    <div class="form-group"><label for="g_city">City</label><input id="g_city" type="text"></div>
    <div class="form-group"><label for="g_li">LinkedIn URL</label><input id="g_li" type="text"></div>
    <div class="form-group"><label for="g_visa">Visa Status</label><input id="g_visa" type="text"></div>
    <div class="form-group"><label for="g_salary">Expected Salary</label><input id="g_salary" type="text"></div>
    <div class="form-group"><label for="g_country">Country</label>
      <select id="g_country"><option value="">Select…</option><option value="CA">Canada</option><option value="US">United States</option></select>
    </div>
  </form>
</body></html>`

const PROFILE = {
  full_name: "Eshwar Janjirala",
  first_name: "Eshwar",
  last_name: "Janjirala",
  email: "jayeshwar24@gmail.com",
  phone: "+1 646 820 3671",
  location: "St. Louis, MO",
  linkedin: "https://linkedin.com/in/jayy-eshwar",
  github: "https://github.com/eshwar",
  portfolio: "https://eshwar.dev",
  title: "Senior Security Engineer",
  bio: "Security engineer with 8+ years across AppSec and OT security.",
  skills: ["python", "burp suite"],
  years_experience: "8",
  work_auth: "green_card",
  visa_status: "Green Card",
  salary_min: 150000,
  salary_max: 180000,
  // relo_ok/has_clearance ARE answered (tri-state true/false — see
  // /api/profile); start_immediately/has_transportation are deliberately left
  // unset here to exercise the "unanswered → skip, don't guess" path.
  relo_ok: true,
  has_clearance: false,
}

// ── Tiny assertion collector ─────────────────────────────────────────────────
const results = []
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${name}${cond || !detail ? "" : ` — ${detail}`}`)
}

async function loadEngine(html, url) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true })
  const { window } = dom
  window.chrome = makeChromeStub()
  shimInnerText(window)
  if (!window.CSS?.escape) {
    window.CSS = window.CSS || {}
    window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_ -￿-]/g, (c) => `\\${c}`)
  }
  window.eval(contentJs)
  if (!window.__mfSidebarBridge) throw new Error("content.js did not export __mfSidebarBridge")
  return { dom, window }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 1. Greenhouse-style application form ━━")
{
  const { window } = await loadEngine(GREENHOUSE_FORM, "https://boards.greenhouse.io/testco/jobs/123")
  const d = window.document
  const bridge = window.__mfSidebarBridge

  check("getATS() detects greenhouse", bridge.getATS() === "greenhouse", `got "${bridge.getATS()}"`)
  check("isApplicationPage() is true", bridge.isApplicationPage() === true)

  const result = await bridge.runAutofillFlow(PROFILE, null, null)

  check("first name filled",   d.getElementById("first_name").value === "Eshwar", `got "${d.getElementById("first_name").value}"`)
  check("last name filled",    d.getElementById("last_name").value === "Janjirala", `got "${d.getElementById("last_name").value}"`)
  check("email filled",        d.getElementById("email").value === PROFILE.email, `got "${d.getElementById("email").value}"`)
  check("phone filled",        d.getElementById("phone").value === PROFILE.phone, `got "${d.getElementById("phone").value}"`)
  check("location filled",     d.getElementById("job_application_location").value === PROFILE.location, `got "${d.getElementById("job_application_location").value}"`)
  check("linkedin filled (custom question)", d.getElementById("question_linkedin").value === PROFILE.linkedin, `got "${d.getElementById("question_linkedin").value}"`)
  check("cover letter filled from bio", d.getElementById("cover_letter_text").value === PROFILE.bio, `got "${d.getElementById("cover_letter_text").value.slice(0, 40)}"`)
  check("years-of-experience custom question filled", d.getElementById("years_exp").value === "8", `got "${d.getElementById("years_exp").value}"`)

  check("work-auth radio answered YES", d.getElementById("auth_yes").checked === true)
  check("work-auth NO not selected",    d.getElementById("auth_no").checked === false)

  check("sponsorship radio NOT auto-answered (yes)", d.getElementById("spons_yes").checked === false)
  check("sponsorship radio NOT auto-answered (no)",  d.getElementById("spons_no").checked === false)

  check("relocate radio answered YES (relo_ok: true)",   d.getElementById("reloc_yes").checked === true)
  check("relocate NO not selected",                      d.getElementById("reloc_no").checked === false)
  check("clearance radio answered NO (has_clearance: false)", d.getElementById("clear_no").checked === true)
  check("clearance YES not selected",                     d.getElementById("clear_yes").checked === false)
  check("start-immediately left unanswered (profile has no value)",
    d.getElementById("start_yes").checked === false && d.getElementById("start_no").checked === false)

  for (const id of ["gender", "race", "veteran", "disability"]) {
    check(`EEO select "${id}" untouched`, d.getElementById(id).selectedIndex <= 0, `selectedIndex=${d.getElementById(id).selectedIndex}`)
  }

  check("attestation checkbox checked", d.getElementById("certify").checked === true)
  check("marketing opt-in NOT checked", d.getElementById("marketing").checked === false)

  check("file input untouched by text pass", d.getElementById("resume").value === "")

  check("filled count ≥ 8", result.filled >= 8, `filled=${result.filled}`)
  const na = result.needsAttention || []
  check("needsAttention flags sponsorship question", na.some((s) => /sponsor/i.test(s)), JSON.stringify(na))
  check("needsAttention flags at least one EEO select", na.some((s) => /gender|race|veteran|disability|ethnic/i.test(s)), JSON.stringify(na))
  check("needsAttention does NOT flag the answered work-auth radio", !na.some((s) => /legally authorized/i.test(s)), JSON.stringify(na))

  // ── Multi-step wizard: simulate a new field appearing (step 2) ──────────────
  const step2 = d.createElement("div")
  step2.className = "field"
  step2.innerHTML = `<label for="step2_email">Email *</label><input type="email" id="step2_email" name="step2_email">`
  d.querySelector("form").appendChild(step2)
  await sleep(1600) // MutationObserver debounce is 700ms
  check("multi-step re-fill fills newly-added field", d.getElementById("step2_email").value === PROFILE.email, `got "${d.getElementById("step2_email").value}"`)

  // Idempotence: run again, nothing should double-fire or error
  const again = await bridge.runAutofillFlow(PROFILE, null, null)
  check("second run is idempotent (fills nothing new except radio/cb no-ops)", again.filled === 0, `filled=${again.filled}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// Regression test for the real-harm bug fixed this session: fillWorkAuthRadio()
// used to answer "Yes" for EVERY work_auth value, including "Need Sponsorship" —
// which by definition means the candidate is NOT authorized to work without an
// employer sponsoring a visa. This proves the fix across all three real-world
// value shapes the app actually produces (setup wizard / Settings dropdown /
// stored snake_case), not just the "confidently authorized" case above.
console.log("\n━━ 1b. Work-auth radio: sponsorship-needed / snake_case / Settings-shape profiles ━━")
for (const [label, workAuth] of [
  ["setup wizard shape", "Need Sponsorship"],
  ["unset", ""],
  ["ambiguous contracting arrangement", "C2C"],
]) {
  const { window } = await loadEngine(GREENHOUSE_FORM, "https://boards.greenhouse.io/testco/jobs/123")
  const d = window.document
  const bridge = window.__mfSidebarBridge
  const result = await bridge.runAutofillFlow({ ...PROFILE, work_auth: workAuth, visa_status: workAuth }, null, null)

  check(`[${label}] work-auth radio left UNANSWERED (never guesses "Yes")`,
    d.getElementById("auth_yes").checked === false && d.getElementById("auth_no").checked === false)
  const na = result.needsAttention || []
  check(`[${label}] needsAttention DOES flag the unanswered work-auth question`,
    na.some((s) => /legally authorized/i.test(s)), JSON.stringify(na))
}
// Also confirm the Settings-shape ("H-1B Visa", "STEM OPT" — different wording
// than the setup wizard's "H-1B"/"OPT (STEM)") still correctly answers Yes.
for (const [label, workAuth] of [["Settings dropdown shape", "H-1B Visa"], ["Settings STEM OPT shape", "STEM OPT"]]) {
  const { window } = await loadEngine(GREENHOUSE_FORM, "https://boards.greenhouse.io/testco/jobs/123")
  const d = window.document
  const bridge = window.__mfSidebarBridge
  await bridge.runAutofillFlow({ ...PROFILE, work_auth: workAuth, visa_status: workAuth }, null, null)
  check(`[${label}] work-auth radio answered YES`, d.getElementById("auth_yes").checked === true)
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 2. Generic (non-ATS) careers form ━━")
{
  const { window } = await loadEngine(GENERIC_FORM, "https://careers.example.com/apply")
  const d = window.document
  const bridge = window.__mfSidebarBridge

  check("getATS() falls back to generic", bridge.getATS() === "generic", `got "${bridge.getATS()}"`)

  const result = await bridge.runAutofillFlow(PROFILE, null, null)

  check("full name via label hint",  d.getElementById("g_name").value === PROFILE.full_name, `got "${d.getElementById("g_name").value}"`)
  check("email via label hint",      d.getElementById("g_email").value === PROFILE.email)
  check("phone via label hint",      d.getElementById("g_phone").value === PROFILE.phone)
  check("city via label hint",       d.getElementById("g_city").value === PROFILE.location, `got "${d.getElementById("g_city").value}"`)
  check("linkedin via label hint",   d.getElementById("g_li").value === PROFILE.linkedin)
  check("visa status humanized",     d.getElementById("g_visa").value === "Green Card", `got "${d.getElementById("g_visa").value}"`)
  check("salary built from min/max", d.getElementById("g_salary").value === "$150,000 - $180,000", `got "${d.getElementById("g_salary").value}"`)
  check("country select → United States", d.getElementById("g_country").value === "US", `got "${d.getElementById("g_country").value}"`)
  check("generic filled count ≥ 7", result.filled >= 7, `filled=${result.filled}`)
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 3. Lever-style application form ━━")
{
  const LEVER_FORM = `<!doctype html><html><head><title>TestCo - Senior Security Engineer</title></head><body>
    <div class="posting-headline"><h2>Senior Security Engineer</h2></div>
    <form>
      <div class="field"><label>Full name *</label><input name="name" type="text"></div>
      <div class="field"><label>Email *</label><input name="email" type="email"></div>
      <div class="field"><label>Phone</label><input name="phone" type="text"></div>
      <div class="field"><label>LinkedIn URL</label><input name="urls[LinkedIn]" type="text"></div>
      <div class="field"><label>GitHub URL</label><input name="urls[GitHub]" type="text"></div>
      <div class="field"><label>Additional information</label><textarea name="comments"></textarea></div>
    </form>
  </body></html>`
  const { window } = await loadEngine(LEVER_FORM, "https://jobs.lever.co/testco/1234-senior-security-engineer/apply")
  const d = window.document
  const bridge = window.__mfSidebarBridge

  check("getATS() detects lever", bridge.getATS() === "lever", `got "${bridge.getATS()}"`)
  const result = await bridge.runAutofillFlow(PROFILE, null, null)
  check("lever full name",  d.querySelector('input[name="name"]').value === PROFILE.full_name, `got "${d.querySelector('input[name="name"]').value}"`)
  check("lever email",      d.querySelector('input[name="email"]').value === PROFILE.email)
  check("lever phone",      d.querySelector('input[name="phone"]').value === PROFILE.phone)
  check("lever linkedin",   d.querySelector('input[name="urls[LinkedIn]"]').value === PROFILE.linkedin)
  check("lever github",     d.querySelector('input[name="urls[GitHub]"]').value === PROFILE.github)
  check("lever cover/comments from bio", d.querySelector('textarea[name="comments"]').value === PROFILE.bio)
  check("lever filled count ≥ 6", result.filled >= 6, `filled=${result.filled}`)
  // Full-name box must survive a second pass (same catch-all-overwrite class of bug)
  await bridge.runAutofillFlow(PROFILE, null, null)
  check("lever full name intact after 2nd pass", d.querySelector('input[name="name"]').value === PROFILE.full_name, `got "${d.querySelector('input[name="name"]').value}"`)
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 4. Workday-style application form ━━")
{
  const WORKDAY_FORM = `<!doctype html><html><head><title>Careers</title></head><body>
    <form>
      <div data-automation-id="legalNameSection_firstName"><label>First Name</label><input type="text" aria-label="First Name"></div>
      <div data-automation-id="legalNameSection_lastName"><label>Last Name</label><input type="text" aria-label="Last Name"></div>
      <div data-automation-id="addressSection_addressLine1"><label>Address Line 1</label><input type="text" aria-label="Address Line 1"></div>
      <div data-automation-id="addressSection_city"><label>City</label><input type="text" aria-label="City"></div>
      <div data-automation-id="contactInformation_email"><label>Email</label><input type="email" aria-label="Email"></div>
      <div data-automation-id="contactInformation_phone"><label>Phone Number</label><input type="text" aria-label="Phone Number"></div>
      <div class="field"><label for="wd_state">State</label>
        <select id="wd_state" aria-label="State">
          <option value="">Select One</option><option value="CA">California</option><option value="MO">Missouri</option><option value="TX">Texas</option>
        </select>
      </div>
      <div data-automation-id="phoneDeviceType">
        <label>Phone Device Type</label>
        <input role="combobox" aria-label="Phone Device Type" type="text">
      </div>
      <ul style="display:none">
        <li role="option" id="wd_opt_mobile">Mobile</li>
        <li role="option" id="wd_opt_home">Home</li>
      </ul>
    </form>
  </body></html>`
  const { window } = await loadEngine(WORKDAY_FORM, "https://testco.wd5.myworkdayjobs.com/en-US/careers/job/apply")
  const d = window.document
  const bridge = window.__mfSidebarBridge

  check("getATS() detects workday", bridge.getATS() === "workday", `got "${bridge.getATS()}"`)

  // Track whether the engine actually clicks the right combobox option
  let mobileClicked = false
  d.getElementById("wd_opt_mobile").addEventListener("click", () => { mobileClicked = true })

  const result = await bridge.runAutofillFlow(PROFILE, null, null)
  const q = (sel) => d.querySelector(sel)
  check("workday first name",  q('[data-automation-id="legalNameSection_firstName"] input').value === "Eshwar")
  check("workday last name",   q('[data-automation-id="legalNameSection_lastName"] input').value === "Janjirala")
  check("workday address line gets location", q('[data-automation-id="addressSection_addressLine1"] input').value === PROFILE.location, `got "${q('[data-automation-id="addressSection_addressLine1"] input').value}"`)
  check("workday city parsed from location", q('[data-automation-id="addressSection_city"] input').value === "St. Louis", `got "${q('[data-automation-id="addressSection_city"] input').value}"`)
  check("workday email",       q('[data-automation-id="contactInformation_email"] input').value === PROFILE.email)
  check("workday phone",       q('[data-automation-id="contactInformation_phone"] input').value === PROFILE.phone)
  check("workday state select MO→Missouri", d.getElementById("wd_state").value === "MO", `got "${d.getElementById("wd_state").value}"`)
  check("workday combobox clicked 'Mobile' option", mobileClicked === true)
  check("workday filled count ≥ 7", result.filled >= 7, `filled=${result.filled}`)
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 5. In-page sidebar (sidebar.js) smoke test ━━")
{
  const sidebarJs = readFileSync(path.join(__dirname, "..", "extension", "sidebar.js"), "utf8")
  const dom = new JSDOM(GREENHOUSE_FORM, { url: "https://boards.greenhouse.io/testco/jobs/123", runScripts: "outside-only", pretendToBeVisual: true })
  const { window } = dom
  const d = window.document

  // chrome stub with working GET_PROFILE / GET_USER_RESUMES / GET_H1B /
  // GET_MATCH_SCORE — all four are relayed through the background service
  // worker in the real extension (see background.js) because a direct fetch()
  // from this content-script context gets silently CORS-blocked against the
  // real app's API (none of these routes send Access-Control-Allow-Origin).
  // Resume-specific fields a real /api/profile?filepath= extraction would return —
  // deliberately DIFFERENT from PROFILE's title/skills/years_experience (but same
  // contact info shape) so the merge behavior is actually observable in the test,
  // not just "didn't crash".
  const RESUME_SPECIFIC_PROFILE = {
    ...PROFILE,
    title: "AppSec Engineer (from resume)",
    skills: ["burp suite", "sast", "dast"],
    years_experience: "5",
    email: "wrong-resume-email@example.com", // must NOT win — contact info stays constant
  }
  window.chrome = makeChromeStub()
  // A resume tailored via the extension's own popup (chrome.storage.local,
  // NOT the website's localStorage — shared across every extension context,
  // no network call, so no CORS concerns either) — should appear at the top
  // of the sidebar's resume picker, ahead of the library.
  window.chrome.storage.local.get = (_keys) => Promise.resolve({
    recentResumes: [{ name: "Tailored Resume", date: "2026-07-08T00:00:00.000Z", token: "tok123", role: "AppSec Engineer" }],
  })
  window.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg?.type === "GET_PROFILE") {
      cb && cb({ profile: (msg.filepath || msg.token) ? RESUME_SPECIFIC_PROFILE : PROFILE })
      return
    }
    if (msg?.type === "GET_USER_RESUMES") {
      cb && cb({ files: [{ filename: "Cyber Resume", filepath: "C:/tmp/cyber.docx", size: "12 KB", uploadedAt: "2026-07-01T00:00:00.000Z" }] })
      return
    }
    if (msg?.type === "GET_H1B") {
      cb && cb({ data: { status: "likely", label: "H1B Sponsor Likely", color: "#15803d", reason: "test data" } })
      return
    }
    if (msg?.type === "GET_MATCH_SCORE") { cb && cb({ data: { total: 82 } }); return }
    cb && cb({})
  }
  shimInnerText(window)
  if (!window.CSS?.escape) {
    window.CSS = window.CSS || {}
    window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
  }
  // fetch() is no longer used by sidebar.js's app-API calls (all relayed above),
  // so nothing left to stub here — kept as a safety net for anything untouched.
  window.fetch = async (_url, _opts) => ({ ok: false, json: async () => ({}) })

  window.eval(contentJs)
  // Spy on the bridge BEFORE sidebar.js evals — it captures its own local
  // `const bridge = window.__mfSidebarBridge` reference at eval time, so the
  // wrap must land on the window property first for sidebar.js to pick it up.
  let capturedFillProfile = null
  let capturedResumeUrl = null
  const realRunAutofillFlow = window.__mfSidebarBridge.runAutofillFlow
  window.__mfSidebarBridge.runAutofillFlow = (profile, resumeUrl, ...rest) => {
    capturedFillProfile = profile
    capturedResumeUrl = resumeUrl
    return realRunAutofillFlow(profile, resumeUrl, ...rest)
  }
  window.eval(sidebarJs)
  await sleep(400) // let init promises (profile, resumes, h1b) settle

  const root = d.getElementById("careeeros-sidebar")
  check("sidebar injected", !!root)
  check("sidebar auto-opened on application page", root?.classList.contains("open") === true)
  check("toggle tab injected", !!d.getElementById("careeeros-toggle"))
  check("job title detected into panel", d.getElementById("mf-role")?.textContent === "Senior Security Engineer", `got "${d.getElementById("mf-role")?.textContent}"`)
  check("ATS badge shows greenhouse", d.getElementById("mf-ats-badge-row")?.textContent.includes("greenhouse") === true)
  check("H1B badge rendered from API", d.getElementById("mf-match-row")?.textContent.includes("H1B") === true, `row: "${d.getElementById("mf-match-row")?.textContent}"`)
  check("login prompt hidden when profile present", d.getElementById("mf-login-prompt")?.classList.contains("visible") !== true)
  check("profile card populated", d.getElementById("mf-profile-name")?.textContent === PROFILE.full_name)
  const select = d.getElementById("mf-resume-select")
  check("resume selector populated from API", select && select.options.length === 2 && select.options[1].textContent === "Cyber Resume", `options=${select?.options.length}, opt1="${select?.options[1]?.textContent}"`)
  check("recently-tailored resume listed first, ahead of the library", select?.options[0]?.textContent === "🕐 Tailored Resume — AppSec Engineer", `opt0="${select?.options[0]?.textContent}"`)
  check("recently-tailored option value carries its token", select?.options[0]?.value === "token:tok123", `got "${select?.options[0]?.value}"`)
  check("default selection is the (freshest) recently-tailored entry", select?.value === "token:tok123", `selected="${select?.value}"`)

  // Click Start Autofill → pauses on the receipt review, fills nothing yet.
  d.getElementById("mf-autofill-btn").click()
  await sleep(300)
  const receipt = d.getElementById("mf-receipt")
  check("receipt shown before anything is filled", receipt?.classList.contains("visible") === true)
  check("nothing filled yet while receipt is open", d.getElementById("first_name").value === "", `got "${d.getElementById("first_name").value}"`)
  const receiptText = d.getElementById("mf-receipt-rows")?.textContent || ""
  check("receipt shows the name that will be filled", receiptText.includes(PROFILE.full_name), receiptText)
  check("receipt shows the selected resume", receiptText.includes("Tailored Resume"), receiptText)

  // Confirm → now the real engine fills the real form.
  d.getElementById("mf-receipt-confirm").click()
  await sleep(900)
  check("receipt hides after confirm", d.getElementById("mf-receipt")?.classList.contains("visible") !== true)
  check("sidebar autofill filled the form", d.getElementById("first_name").value === "Eshwar", `got "${d.getElementById("first_name").value}"`)
  check("sidebar button reports success", d.getElementById("mf-autofill-btn").textContent.includes("Filled"), `text="${d.getElementById("mf-autofill-btn").textContent}"`)
  check("checklist rendered", (d.getElementById("mf-field-checklist")?.children.length || 0) >= 5, `items=${d.getElementById("mf-field-checklist")?.children.length}`)
  check("needs-review items flagged in checklist", d.getElementById("mf-field-checklist")?.textContent.includes("needs your review") === true)

  // Resume-specific fields (title/skills/years_experience) must come from the
  // SELECTED resume's own extraction, not the constant account profile — while
  // contact info (email here) must NOT be overwritten by whatever the resume
  // extraction happened to find, since that varies per resume file and would
  // otherwise submit an application with the wrong/inconsistent email.
  check("resume-specific title wins over account profile", capturedFillProfile?.title === "AppSec Engineer (from resume)", `got "${capturedFillProfile?.title}"`)
  check("resume-specific skills win over account profile", JSON.stringify(capturedFillProfile?.skills) === JSON.stringify(["burp suite", "sast", "dast"]), `got ${JSON.stringify(capturedFillProfile?.skills)}`)
  check("resume-specific years_experience wins over account profile", capturedFillProfile?.years_experience === "5", `got "${capturedFillProfile?.years_experience}"`)
  check("contact email stays constant from account profile, not resume extraction", capturedFillProfile?.email === PROFILE.email, `got "${capturedFillProfile?.email}"`)

  // The default-selected entry here is the recently-tailored (token-based) one —
  // its download must hit /api/tailor/file?token=, NOT /api/resumes/download
  // (which only understands library filepaths, not tailored-output tokens).
  check("token-based selection builds the /api/tailor/file URL", /\/api\/tailor\/file\?token=tok123/.test(capturedResumeUrl || ""), `got "${capturedResumeUrl}"`)
}

// ═════════════════════════════════════════════════════════════════════════════
// Previously-untested ATS adapters. Each fixture uses that adapter's EXACT
// selectors at its real URL so getATS() routes to it (not the generic fallback).
// This is the same "test untested code → catch real bugs" move that already
// caught the name-corruption and location-score bugs.
console.log("\n━━ 6. Other ATS adapters (Ashby / SmartRecruiters / BambooHR / iCIMS / Jobvite) ━━")
{
  const ADAPTERS = [
    {
      ats: "ashby", url: "https://jobs.ashbyhq.com/testco/1234/application",
      html: `<form>
        <input name="name"><input name="email" type="email"><input name="phone">
        <input name="linkedinUrl"><input name="githubUrl">
      </form>`,
      expect: [
        ['input[name="name"]', PROFILE.full_name],
        ['input[name="email"]', PROFILE.email],
        ['input[name="phone"]', PROFILE.phone],
        ['input[name="linkedinUrl"]', PROFILE.linkedin],
        ['input[name="githubUrl"]', PROFILE.github],
      ],
    },
    {
      ats: "smartrecruiters", url: "https://jobs.smartrecruiters.com/testco/1234",
      html: `<form>
        <input name="firstName"><input name="lastName"><input name="email" type="email">
        <input name="phoneNumber"><input name="web-sources-LINKEDIN_URL">
      </form>`,
      expect: [
        ['input[name="firstName"]', "Eshwar"],
        ['input[name="lastName"]', "Janjirala"],
        ['input[name="email"]', PROFILE.email],
        ['input[name="phoneNumber"]', PROFILE.phone],
        ['input[name="web-sources-LINKEDIN_URL"]', PROFILE.linkedin],
      ],
    },
    {
      ats: "bamboohr", url: "https://testco.bamboohr.com/careers/1234",
      html: `<form>
        <input id="firstName"><input id="lastName"><input id="email" type="email">
        <input id="phone"><input id="linkedinUrl">
      </form>`,
      expect: [
        ['#firstName', "Eshwar"],
        ['#lastName', "Janjirala"],
        ['#email', PROFILE.email],
        ['#phone', PROFILE.phone],
        ['#linkedinUrl', PROFILE.linkedin],
      ],
    },
    {
      ats: "icims", url: "https://careers-testco.icims.com/jobs/1234/login",
      html: `<form>
        <input id="iCIMS_FirstName"><input id="iCIMS_LastName"><input id="iCIMS_Email" type="email">
        <input id="iCIMS_PhoneHome">
      </form>`,
      expect: [
        ['#iCIMS_FirstName', "Eshwar"],
        ['#iCIMS_LastName', "Janjirala"],
        ['#iCIMS_Email', PROFILE.email],
        ['#iCIMS_PhoneHome', PROFILE.phone],
      ],
    },
    {
      ats: "jobvite", url: "https://jobs.jobvite.com/testco/job/1234/apply",
      html: `<form>
        <input id="jv-first-name"><input id="jv-last-name"><input id="jv-email" type="email">
        <input id="jv-phone"><input id="jv-location">
      </form>`,
      expect: [
        ['#jv-first-name', "Eshwar"],
        ['#jv-last-name', "Janjirala"],
        ['#jv-email', PROFILE.email],
        ['#jv-phone', PROFILE.phone],
        ['#jv-location', PROFILE.location],
      ],
    },
  ]

  for (const spec of ADAPTERS) {
    const { window } = await loadEngine(`<!doctype html><html><body>${spec.html}</body></html>`, spec.url)
    const d = window.document
    const bridge = window.__mfSidebarBridge
    check(`getATS() detects ${spec.ats}`, bridge.getATS() === spec.ats, `got "${bridge.getATS()}"`)
    await bridge.runAutofillFlow(PROFILE, null, null)
    for (const [sel, want] of spec.expect) {
      const el = d.querySelector(sel)
      check(`${spec.ats}: ${sel} filled`, el && el.value === want, `got "${el?.value}"`)
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━ 7. Real submit — Greenhouse & Lever only, gated on a clean fill ━━")
{
  const MINI_GREENHOUSE = (extraFieldHtml = "") => `<!doctype html><html><body>
    <form id="application_form">
      <input type="text" id="first_name" name="job_application[first_name]">
      <input type="text" id="last_name"  name="job_application[last_name]">
      <input type="email" id="email"     name="job_application[email]">
      ${extraFieldHtml}
      <button type="button" id="save_draft">Save as draft</button>
      <button type="submit" id="submit_app">Submit Application</button>
    </form>
  </body></html>`

  // ── 7a. Clean form, autoSubmit:true → real click on Submit, queued to the tracker ──
  {
    const { window } = await loadEngine(MINI_GREENHOUSE(), "https://boards.greenhouse.io/testco/jobs/999")
    const d = window.document
    window.chrome = makeChromeStub()
    let submitClicked = false, draftClicked = false
    d.getElementById("submit_app").addEventListener("click", () => { submitClicked = true })
    d.getElementById("save_draft").addEventListener("click", () => { draftClicked = true })
    let savedLocal = null
    window.chrome.storage.local.set = (obj) => { savedLocal = obj }
    window.chrome.storage.local.get = (_keys, cb) => cb({})
    window.eval(contentJs)
    const bridge = window.__mfSidebarBridge
    const result = await bridge.runAutofillFlow(PROFILE, null, null, true)

    check("clean form + autoSubmit:true → result.submitted is true", result.submitted === true)
    check("clean form + autoSubmit:true → the real Submit button was clicked", submitClicked === true)
    check("the Save-as-draft button was NOT clicked (correctly excluded by text match)", draftClicked === false)
    check("submitted application queued to chrome.storage.local for the dashboard tracker",
      Array.isArray(savedLocal?.pendingApplications) && savedLocal.pendingApplications.length === 1,
      JSON.stringify(savedLocal))
  }

  // ── 7b. A flagged question (sponsorship) left unanswered → must NEVER auto-submit ──
  {
    const withSponsorship = MINI_GREENHOUSE(`
      <div class="field question">
        <label>Will you now or in the future require sponsorship for employment visa status? *</label>
        <div>
          <input type="radio" id="spons_yes" name="question_sponsorship" value="Yes"><label for="spons_yes">Yes</label>
          <input type="radio" id="spons_no"  name="question_sponsorship" value="No"><label for="spons_no">No</label>
        </div>
      </div>`)
    const { window } = await loadEngine(withSponsorship, "https://boards.greenhouse.io/testco/jobs/999")
    const d = window.document
    window.chrome = makeChromeStub()
    let submitClicked = false
    d.getElementById("submit_app").addEventListener("click", () => { submitClicked = true })
    window.eval(contentJs)
    const bridge = window.__mfSidebarBridge
    const result = await bridge.runAutofillFlow(PROFILE, null, null, true)

    check("unresolved sponsorship question → needsAttention is non-empty", (result.needsAttention || []).length > 0, JSON.stringify(result.needsAttention))
    check("unresolved sponsorship question → result.submitted is false (never guesses its way to a real submit)", result.submitted === false)
    check("unresolved sponsorship question → Submit was never clicked", submitClicked === false)
  }

  // ── 7c. autoSubmit not passed (every other caller in this codebase, incl. popup.js
  //        via the AUTOFILL message handler) → unchanged fill-only behavior ──
  {
    const { window } = await loadEngine(MINI_GREENHOUSE(), "https://boards.greenhouse.io/testco/jobs/999")
    const d = window.document
    window.chrome = makeChromeStub()
    let submitClicked = false
    d.getElementById("submit_app").addEventListener("click", () => { submitClicked = true })
    window.eval(contentJs)
    const bridge = window.__mfSidebarBridge
    const result = await bridge.runAutofillFlow(PROFILE, null, null) // no 4th arg — matches every pre-existing call site

    check("no autoSubmit arg → result.submitted is false (default stays fill-only)", result.submitted === false)
    check("no autoSubmit arg → Submit was never clicked", submitClicked === false)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
const failures = results.filter((r) => !r.pass)
console.log(`\n━━ RESULT: ${results.length - failures.length}/${results.length} passed ━━`)
if (failures.length) {
  console.log("Failures:")
  for (const f of failures) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`)
}
// content.js starts a 1s setInterval (SPA URL watcher) that would keep the
// process alive forever — exit explicitly with a meaningful code instead.
process.exit(failures.length ? 1 : 0)
