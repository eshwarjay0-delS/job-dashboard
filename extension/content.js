// MarketFit Extension — Content Script v3
// ATS-aware autofill: Greenhouse, Lever, Workday, Ashby, SmartRecruiters,
// BambooHR, Jobvite, Taleo, iCIMS, LinkedIn Easy Apply, generic
// Works alongside Simplify — fills fields Simplify misses (resume-variant data)

// ────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fill a text/email/tel/url/textarea input.
 * Uses native value setter to bypass React/Vue/Angular controlled-input diffing,
 * then fires the event chain frameworks listen for.
 */
function fillText(el, value) {
  if (!value || !el || el.readOnly || el.disabled) return false
  if (el.value === value) return false  // already filled with same value
  const proto = el.tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  if (setter) setter.call(el, value)
  else el.value = value
  // Fire the full event chain — frameworks pick different ones
  el.dispatchEvent(new Event("focus",  { bubbles: true }))
  el.dispatchEvent(new Event("input",  { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
  el.dispatchEvent(new Event("blur",   { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "End" }))
  return true
}

/** Fill a <select> — matches by option text or value (case-insensitive) */
function fillSelect(el, searchText) {
  if (!searchText || !el || el.disabled) return false
  const lower = searchText.toLowerCase()
  const opts  = [...el.options]
  const match = opts.find(o => o.text.toLowerCase() === lower || o.value.toLowerCase() === lower)
             ?? opts.find(o => o.text.toLowerCase().includes(lower) || lower.includes(o.text.toLowerCase().trim()))
  if (!match || el.selectedIndex === match.index) return false
  el.selectedIndex = match.index
  el.dispatchEvent(new Event("input",  { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
  return true
}

/** Click a radio button — finds radio group by label keyword, then selects yes/no */
function fillRadio(labelKeyword, yesNo) {
  const radios = [...document.querySelectorAll("input[type='radio']")]
  for (const r of radios) {
    if (r.checked || r.disabled) continue
    const parts = [r.value, r.name]
    const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`)
    if (lbl) parts.push(lbl.innerText)
    const fieldset = r.closest("fieldset, .field, .form-group, [class*='question'], [class*='field']")
    if (fieldset) {
      const legend = fieldset.querySelector("legend, label, h3, h4, .question-label, [class*='label']")
      if (legend) parts.push(legend.innerText)
    }
    const ctx = parts.join(" ").toLowerCase()
    if (!ctx.includes(labelKeyword.toLowerCase())) continue
    const val      = (r.value || "").toLowerCase()
    const labelTxt = (document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || "").toLowerCase()
    if (val === yesNo.toLowerCase() || labelTxt === yesNo.toLowerCase()
        || (yesNo === "Yes" && (val.includes("yes") || val === "true"  || val === "1"))
        || (yesNo === "No"  && (val.includes("no")  || val === "false" || val === "0"))) {
      r.click()
      r.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }
  }
  return false
}

function sleepMs(ms) { return new Promise(res => setTimeout(res, ms)) }

/** Normalize profile first/last — prefer explicit fields, fall back to splitting full_name */
function splitName(profile) {
  const first = profile.first_name || (profile.full_name || "").trim().split(/\s+/)[0] || ""
  const last  = profile.last_name  || (profile.full_name || "").trim().split(/\s+/).slice(1).join(" ") || ""
  return { first, last }
}

/** One selector → one fill, tracking into `filledSet` */
function fillOne(selector, value, filledSet) {
  if (!value) return 0
  let n = 0
  for (const el of [...document.querySelectorAll(selector)].slice(0, 1)) {
    if (fillText(el, value)) { n++; if (filledSet) filledSet.add(el) }
  }
  return n
}

// ────────────────────────────────────────────────────────────────────────────
// ATS DETECTION
// ────────────────────────────────────────────────────────────────────────────

function getATS() {
  const url  = window.location.href
  if (/greenhouse\.io|grnh\.se|boards\.greenhouse/i.test(url))   return "greenhouse"
  if (/lever\.co/i.test(url))                                     return "lever"
  if (/workday\.com|myworkdayjobs\.com|wd[135]\./i.test(url))    return "workday"
  if (/icims\.com/i.test(url))                                    return "icims"
  if (/bamboohr\.com/i.test(url))                                 return "bamboohr"
  if (/smartrecruiters\.com/i.test(url))                          return "smartrecruiters"
  if (/ashbyhq\.com/i.test(url))                                  return "ashby"
  if (/jobvite\.com|jvp\.io/i.test(url))                         return "jobvite"
  if (/taleo\.net/i.test(url))                                    return "taleo"
  if (/successfactors\.com/i.test(url))                           return "successfactors"
  if (/linkedin\.com/i.test(url))                                 return "linkedin"
  if (/rippling\.com/i.test(url))                                 return "rippling"
  if (/workable\.com/i.test(url))                                 return "workable"
  if (/eightfold\.ai/i.test(url))                                 return "eightfold"
  if (/gusto\.com\/careers/i.test(url))                           return "gusto"
  // DOM-based fallback for embedded/white-label ATS
  if (document.querySelector("[data-qa='submit-app-button'], form#application_form, #greenhouse-form")) return "greenhouse"
  if (document.querySelector(".lever-job-posting, [data-form-type='lever']"))                          return "lever"
  if (document.querySelector("[data-automation-id], [data-uxi-element-id]"))                           return "workday"
  if (document.querySelector("[data-qa='jvAts'], .jv-form-control"))                                  return "jobvite"
  if (document.querySelector(".iCIMS_InfoMsg, [class*='iCIMS'], #iCIMS_Content"))                     return "icims"
  return "generic"
}

function isApplicationPage() {
  const url  = window.location.href
  const ats  = getATS()
  if (ats !== "generic" && ats !== "linkedin") return true
  if (ats === "linkedin" && /\/easy-apply|easyApply/i.test(url)) return true
  if (document.querySelector(".jobs-easy-apply-content, [data-test-modal='easy-apply-modal']")) return true
  if (/\/apply|\/application|apply-now|\/submit/i.test(url)) return true
  if (document.querySelector(
    "form[action*='apply'], input[name='first_name'], input[name='email'][autocomplete]"
  )) return true
  return false
}

// ────────────────────────────────────────────────────────────────────────────
// ATS-SPECIFIC FILL FUNCTIONS
// Each receives a `filled` Set to track what it touches → generic won't double-fill
// ────────────────────────────────────────────────────────────────────────────

function fillGreenhouse(profile, filled) {
  const { first, last } = splitName(profile)
  let n = 0
  const map = [
    ['#first_name, input[name="job_application[first_name]"]',              first],
    ['#last_name,  input[name="job_application[last_name]"]',               last],
    ['#email,      input[name="job_application[email]"]',                   profile.email],
    ['#phone,      input[name="job_application[phone_number]"]',            profile.phone],
    ['#job_application_location, input[name="job_application[location]"]',  profile.location],
    ['input[id*="linkedin"], input[name*="linkedin"]',                      profile.linkedin],
    ['input[id*="github"],   input[name*="github"]',                        profile.github],
    ['input[id*="website"],  input[id*="portfolio"], input[name*="website"], input[name*="portfolio"]', profile.portfolio],
  ]
  for (const [sel, val] of map) n += fillOne(sel, val, filled)
  const cl = document.querySelector(
    'textarea[id*="cover_letter"], textarea[name*="cover_letter"], textarea#cover_letter_text'
  )
  if (cl && profile.bio && fillText(cl, profile.bio)) { n++; filled.add(cl) }
  return n
}

function fillLever(profile, filled) {
  const n0 = [
    ['input[name="name"]',                                                     profile.full_name],
    ['input[name="email"]',                                                    profile.email],
    ['input[name="phone"]',                                                    profile.phone],
    ['input[name="urls[LinkedIn]"], input[name="urls[Linkedin]"]',             profile.linkedin],
    ['input[name="urls[GitHub]"],   input[name="urls[Github]"]',               profile.github],
    ['input[name="urls[Portfolio]"],input[name="urls[Website]"]',              profile.portfolio],
  ].reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
  const cl = document.querySelector(
    'textarea[name="comments"], textarea[id*="additional"], textarea[id*="cover"]'
  )
  let extra = 0
  if (cl && profile.bio && fillText(cl, profile.bio)) { extra = 1; filled.add(cl) }
  return n0 + extra
}

// ── Workday helpers ──────────────────────────────────────────────────────────

/** Select a Workday custom-dropdown option (the styled divs, not native <select>).
 *  Workday uses a button with [data-automation-id*="selectWidget"] + list items. */
function fillWorkdayDropdown(containerSel, optionText) {
  const container = document.querySelector(containerSel)
  if (!container) return false
  // Click the dropdown trigger to open it
  const trigger = container.querySelector(
    'button, [role="combobox"], [data-automation-id*="selectInput"], [data-automation-id*="dateSectionMonth"]'
  ) || container
  trigger.click()
  // Give it a tick then find + click the right option
  const tryClick = () => {
    const lower = optionText.toLowerCase()
    const options = [
      ...document.querySelectorAll('[data-automation-id*="listItem"], [role="option"], .css-item')
    ]
    const match = options.find(o => (o.textContent || "").trim().toLowerCase().includes(lower))
    if (match) { match.click(); return true }
    return false
  }
  if (tryClick()) return true
  // Retry after short delay (Workday is slow to open dropdowns)
  return new Promise(res => setTimeout(() => res(tryClick()), 250))
}

/** Fill a Workday <select> or aria-select widget by text match. */
function fillWorkdaySelect(containerSel, value) {
  if (!value) return false
  // Try native <select> first (some Workday pages use them)
  const sel = document.querySelector(`${containerSel} select`)
  if (sel && fillSelect(sel, value)) return true
  // Try aria combobox input
  const input = document.querySelector(
    `${containerSel} input[role="combobox"], ${containerSel} input[aria-autocomplete]`
  )
  if (input) {
    fillText(input, value)
    // Trigger option list
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }))
    const tryPick = () => {
      const lower = value.toLowerCase()
      const opt = [...document.querySelectorAll('[role="option"]')]
        .find(o => (o.textContent || "").trim().toLowerCase().includes(lower))
      if (opt) { opt.click(); return true }
      return false
    }
    if (tryPick()) return true
    setTimeout(tryPick, 300)
    return true
  }
  return false
}

async function fillWorkday(profile, filled) {
  // Workday uses data-automation-id attributes throughout.
  // We parse the profile location into components for field-by-field matching.
  const { first, last } = splitName(profile)

  // Parse location: "4461 McPherson Ave, St. Louis, MO 63108" or "St. Louis, MO" or "St. Louis, Missouri"
  const loc    = profile.location || ""
  const parts  = loc.split(",").map(s => s.trim())
  // Detect if first part looks like a street address (contains a number)
  let street = "", city = "", state = "", zip = ""
  if (parts.length >= 3 && /^\d/.test(parts[0])) {
    street = parts[0]
    city   = parts[1] || ""
    const rest = (parts[2] || "").trim().split(/\s+/)
    state  = rest[0] || ""
    zip    = rest[1] || ""
  } else if (parts.length >= 2) {
    city  = parts[0]
    const rest = (parts[1] || "").trim().split(/\s+/)
    state = rest[0] || ""
    zip   = rest[1] || ""
  } else {
    city = loc
  }

  // State abbreviation → full name map (most common)
  const STATE_NAMES = {
    AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
    CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
    IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
    ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
    MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
    NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
    OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
    SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
    WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",
  }
  // Normalise state: if we got "MO" → "Missouri", if already "Missouri" leave it
  const stateKey = state.toUpperCase()
  const stateFull = STATE_NAMES[stateKey] || state  // use full if already full

  // ── 1. Text fields (order matters — fill name before phone so focus sequence is natural) ──
  const textMap = /** @type {[string, string][]} */ ([
    // First / Last name
    ['[data-automation-id="legalNameSection_firstName"] input, [data-automation-id*="firstName"] input, input[aria-label*="First Name" i], input[placeholder*="First" i]', first],
    ['[data-automation-id="legalNameSection_lastName"]  input, [data-automation-id*="lastName"]  input, input[aria-label*="Last Name" i],  input[placeholder*="Last" i]',  last],
    // Address
    ['[data-automation-id*="addressLine1"] input, [data-automation-id*="streetAddress"] input, input[aria-label*="Address Line 1" i], input[aria-label*="Street" i]', street || loc],
    // City
    ['[data-automation-id*="city"] input, input[aria-label*="City" i], input[placeholder*="City" i]', city],
    // Postal code
    ['[data-automation-id*="postalCode"] input, [data-automation-id*="zipCode"] input, input[aria-label*="Postal" i], input[aria-label*="ZIP" i], input[aria-label*="Zip" i], input[placeholder*="ZIP" i]', zip],
    // Email
    ['[data-automation-id*="email"] input, input[type="email"], input[aria-label*="Email" i]', profile.email],
    // Phone
    ['[data-automation-id*="phone"] input, input[aria-label*="Phone Number" i], input[type="tel"]', profile.phone],
    // LinkedIn
    ['[data-automation-id*="linkedin"] input, input[aria-label*="LinkedIn" i]', profile.linkedin],
    // Website / Portfolio
    ['[data-automation-id*="website"] input, [data-automation-id*="portfolio"] input, input[aria-label*="Website" i]', profile.portfolio || profile.linkedin],
  ])

  let n = 0
  for (const [sel, val] of textMap) {
    if (!val) continue
    for (const el of [...document.querySelectorAll(sel)].slice(0, 1)) {
      if (filled.has(el)) continue
      el.dispatchEvent(new Event("focus", { bubbles: true }))
      if (fillText(el, val)) { n++; filled.add(el) }
    }
  }

  // ── 2. Native <select> dropdowns ──
  const selects = [...document.querySelectorAll("select")]
  for (const sel of selects) {
    if (filled.has(sel)) continue
    const hint = getFieldHint(sel)
    if (/country|territory/i.test(hint)) {
      if (fillSelect(sel, "United States") || fillSelect(sel, "US")) { n++; filled.add(sel) }
    } else if (/state|province/i.test(hint) && stateFull) {
      if (fillSelect(sel, stateFull) || fillSelect(sel, state)) { n++; filled.add(sel) }
    } else if (/phone.*type|device.*type|type.*phone/i.test(hint)) {
      if (fillSelect(sel, "Mobile") || fillSelect(sel, "Cell")) { n++; filled.add(sel) }
    } else if (/country.*code|phone.*code|calling.*code/i.test(hint)) {
      if (fillSelect(sel, "United States") || fillSelect(sel, "+1")) { n++; filled.add(sel) }
    }
  }

  // ── 3. Workday aria-combobox dropdowns (state, country, phone type) ──
  // AWAITED so the caller's count is accurate and the generic pass (which runs
  // right after) doesn't race these same fields — previously this used a bare
  // setTimeout that fired after autoFillForm() had already returned, so these
  // fills were silently uncounted and could double-fire against fillGeneric.
  const comboSelectors = /** @type {[string, string][]} */ ([
    ['[data-automation-id*="countryDropdown"], [data-automation-id*="country"]', "United States"],
    ['[data-automation-id*="stateDropdown"], [data-automation-id*="state"], [data-automation-id*="province"]', stateFull || state],
    ['[data-automation-id*="phoneDeviceType"], [data-automation-id*="phoneType"]', "Mobile"],
    ['[data-automation-id*="countryPhoneCode"]', "United States (+1)"],
  ])
  for (const [containerSel, val] of comboSelectors) {
    if (!val) continue
    const container = document.querySelector(containerSel)
    if (!container) continue
    // Try native select inside
    const nativeSel = container.querySelector("select")
    if (nativeSel && !filled.has(nativeSel)) {
      if (fillSelect(nativeSel, val)) { n++; filled.add(nativeSel); continue }
    }
    // Try aria combobox
    const combo = container.querySelector('input[role="combobox"], [data-automation-id*="selectInput"]')
    if (combo && combo instanceof HTMLElement && !filled.has(combo)) {
      filled.add(combo)  // claim it now so fillGeneric can't race it while we wait
      combo.click()
      combo.dispatchEvent(new Event("focus", { bubbles: true }))
      await sleepMs(280)  // Workday's option list renders async
      const lower = val.toLowerCase()
      const opt = [...document.querySelectorAll('[role="option"], [data-automation-id*="listItem"]')]
        .find(o => (o.textContent || "").trim().toLowerCase().includes(lower))
      if (opt) { /** @type {HTMLElement} */ (opt).click(); n++ }
    }
  }

  return n
}

function fillAshby(profile, filled) {
  const map = [
    ['input[name="name"]',                                                            profile.full_name],
    ['input[name="email"]',                                                           profile.email],
    ['input[name="phone"]',                                                           profile.phone],
    ['input[name="location"],  input[placeholder*="location" i]',                    profile.location],
    ['input[name="linkedinUrl"],input[name="linkedin"]',                              profile.linkedin],
    ['input[name="githubUrl"],  input[name="github"]',                               profile.github],
    ['input[name="websiteUrl"], input[name="portfolioUrl"], input[name="portfolio"]', profile.portfolio],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillSmartRecruiters(profile, filled) {
  const { first, last } = splitName(profile)
  const map = [
    ['input[name="firstName"]',                               first],
    ['input[name="lastName"]',                                last],
    ['input[name="email"]',                                   profile.email],
    ['input[name="phoneNumber"], input[name="phone"]',        profile.phone],
    ['input[name="location"], input[placeholder*="city" i]',  profile.location],
    ['input[name="web-sources-LINKEDIN_URL"]',                profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillBambooHR(profile, filled) {
  const { first, last } = splitName(profile)
  const map = [
    ['input[id="firstName"], input[name="firstName"]', first],
    ['input[id="lastName"],  input[name="lastName"]',  last],
    ['input[id="email"],     input[name="email"]',     profile.email],
    ['input[id="phone"],     input[name="phone"]',     profile.phone],
    ['input[id="location"],  input[name="location"]',  profile.location],
    ['input[id="linkedinUrl"]',                        profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillJobvite(profile, filled) {
  const { first, last } = splitName(profile)
  const map = [
    ['input[id="jv-first-name"], input[id="firstName"]',  first],
    ['input[id="jv-last-name"],  input[id="lastName"]',   last],
    ['input[id="jv-email"],      input[id="email"]',      profile.email],
    ['input[id="jv-phone"],      input[id="phone"]',      profile.phone],
    ['input[id="jv-location"],   input[name="location"]', profile.location],
    ['input[id="jv-linkedin"],   input[name="linkedinUrl"]', profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillICIMS(profile, filled) {
  // iCIMS has several selector patterns across versions
  const { first, last } = splitName(profile)
  const map = [
    ['input[id*="Applicant.FirstName"], input[name*="firstName"], #iCIMS_FirstName',   first],
    ['input[id*="Applicant.LastName"],  input[name*="lastName"],  #iCIMS_LastName',    last],
    ['input[id*="Applicant.Email"],     input[name*="email"],     #iCIMS_Email',       profile.email],
    ['input[id*="Applicant.Phone"],     input[name*="phone"],     #iCIMS_PhoneHome',   profile.phone],
    ['input[id*="linkedin"],            input[name*="linkedin"]',                       profile.linkedin],
    ['input[id*="Address.City"],        input[name*="city"]',     (profile.location || "").split(",")[0]?.trim()],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillLinkedInEasyApply(profile, filled) {
  // LinkedIn Easy Apply — modal form with aria-labels
  const { first, last } = splitName(profile)
  const map = [
    ['[aria-label*="First name" i], input[id*="firstName"]',      first],
    ['[aria-label*="Last name" i],  input[id*="lastName"]',       last],
    ['[aria-label*="Email" i][type="email"]',                      profile.email],
    ['[aria-label*="Phone" i][type="tel"]',                       profile.phone],
    ['[aria-label*="LinkedIn" i], [aria-label*="linkedin" i]',    profile.linkedin],
    ['[aria-label*="City" i], [aria-label*="location" i]',        profile.location],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillTaleo(profile, filled) {
  // Oracle Taleo — two flavours: Enterprise (data-field attrs) and Business Edition (name pattern)
  const { first, last } = splitName(profile)
  const map = [
    // Enterprise: input names often follow field_<camelCase> or camelCase directly
    ['input[name="field_firstName"],  input[name="firstName"],   input[data-field="firstName"],  input[id*="firstName"]',   first],
    ['input[name="field_lastName"],   input[name="lastName"],    input[data-field="lastName"],   input[id*="lastName"]',    last],
    ['input[name="field_email"],      input[name="email"],       input[data-field="email"],      input[id*="email"]',       profile.email],
    ['input[name="field_phoneNumber"],input[name="phoneNumber"], input[data-field="phoneNumber"],input[id*="phone"]',       profile.phone],
    ['input[name="field_city"],       input[name="city"],        input[data-field="city"]',      (profile.location || "").split(",")[0]?.trim()],
    ['input[name="field_zip"],        input[name="zip"],         input[data-field="postalCode"]',  (profile.location || "").split(/\s+/).pop() || ""],
    // Business Edition: suffix _txtField
    ['input[id="firstName_txtField"]',  first],
    ['input[id="lastName_txtField"]',   last],
    ['input[id="email_txtField"]',      profile.email],
    ['input[id="phone_txtField"]',      profile.phone],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillSuccessFactors(profile, filled) {
  // SAP SuccessFactors — uses compound widget components; inner inputs often have
  // data-id or aria-label attributes. Web UI v12+ uses Shadow DOM partials but
  // the outer inputs are still accessible from the top frame.
  const { first, last } = splitName(profile)
  const map = [
    ['input[data-id="firstName"],  input[name="firstName"],  input[aria-label*="First Name" i]',  first],
    ['input[data-id="lastName"],   input[name="lastName"],   input[aria-label*="Last Name" i]',   last],
    ['input[data-id="email"],      input[name="email"],      input[aria-label*="Email" i]',        profile.email],
    ['input[data-id="cellPhone"],  input[name="phone"],      input[aria-label*="Phone" i]',        profile.phone],
    ['input[data-id="address1"],   input[name="address"]',                                         (profile.location || "").split(",")[0]?.trim()],
    ['input[data-id="city"],       input[name="city"]',                                            (profile.location || "").split(",")[1]?.trim() || ""],
    ['input[data-id="linkedIn"],   input[name="linkedIn"],   input[aria-label*="LinkedIn" i]',     profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillWorkable(profile, filled) {
  // Workable — React-powered ATS; fields follow standard name/id attrs + aria-labels.
  // Both single-page and multi-step (accordion) forms use the same pattern.
  const { first, last } = splitName(profile)
  const map = [
    ['input[name="firstname"], input[id="firstname"], input[aria-label*="First name" i], input[placeholder*="First name" i]', first],
    ['input[name="lastname"],  input[id="lastname"],  input[aria-label*="Last name" i],  input[placeholder*="Last name" i]',  last],
    ['input[name="email"],     input[id="email"],     input[type="email"]',               profile.email],
    ['input[name="phone"],     input[id="phone"],     input[type="tel"], input[aria-label*="Phone" i]', profile.phone],
    ['input[name="address"],   input[name="location"],input[aria-label*="Location" i],   input[placeholder*="Location" i]',  profile.location],
    ['input[name="linkedin"],  input[id="linkedin"],  input[aria-label*="LinkedIn" i]',   profile.linkedin],
    ['input[name="website"],   input[id="website"],   input[aria-label*="Website" i],   input[aria-label*="Portfolio" i]',   profile.portfolio || profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

function fillRippling(profile, filled) {
  // Rippling — uses data-testid attributes and custom React class patterns.
  // Job applications hosted at rippling.com/careers or company-branded sub-paths.
  const { first, last } = splitName(profile)
  const map = [
    ['input[data-testid*="first"],    input[data-testid="firstName"], input[name="firstName"], input[placeholder*="First" i]', first],
    ['input[data-testid*="last"],     input[data-testid="lastName"],  input[name="lastName"],  input[placeholder*="Last" i]',  last],
    ['input[data-testid*="email"],    input[data-testid="email"],     input[name="email"],     input[type="email"]',           profile.email],
    ['input[data-testid*="phone"],    input[data-testid="phone"],     input[name="phone"],     input[type="tel"]',             profile.phone],
    ['input[data-testid*="city"],     input[data-testid="city"],      input[name="city"],      input[aria-label*="City" i]',   (profile.location || "").split(",")[0]?.trim()],
    ['input[data-testid*="linkedin"], input[name="linkedin"],         input[aria-label*="LinkedIn" i]',                       profile.linkedin],
  ]
  return map.reduce((acc, [sel, val]) => acc + fillOne(sel, val, filled), 0)
}

// ────────────────────────────────────────────────────────────────────────────
// GENERIC FILL — catches custom questions and non-ATS pages
// ────────────────────────────────────────────────────────────────────────────

const FIELD_MAP = [
  { keys: ["first name", "firstname", "first_name", "fname", "given name", "forename", "given-name"],         field: "first_name" },
  { keys: ["last name",  "lastname",  "last_name",  "lname", "surname", "family name", "family_name"],        field: "last_name"  },
  { keys: ["full name",  "fullname",  "full_name",  "your name", "applicant name", "candidate name",
            "legal name", "legal full name", "your full name"],                                               field: "full_name"  },
  { keys: ["email", "e-mail", "email address", "email_address", "work email", "personal email",
            "contact email"],                                                                                  field: "email"      },
  { keys: ["phone", "telephone", "mobile", "cell", "phone number", "tel", "contact number",
            "mobile number", "phone_number"],                                                                  field: "phone"      },
  { keys: ["city", "location", "current location", "your city", "where do you live", "city, state",
            "city/state", "where are you", "based in"],                                                       field: "location"   },
  { keys: ["linkedin", "linkedin url", "linkedin profile", "linkedin.com", "linkedinUrl",
            "linkedin_url"],                                                                                   field: "linkedin"   },
  { keys: ["github", "github url", "github profile", "github.com"],                                          field: "github"     },
  { keys: ["portfolio", "website", "personal website", "portfolio url", "personal url",
            "your website", "personal site", "website url"],                                                  field: "portfolio"  },
  { keys: ["title", "job title", "current title", "current role", "position title",
            "professional title", "your title"],                                                              field: "title"      },
  // Visa-candidate fields — the questions almost every application asks. These fill
  // TEXT inputs only (the user's own stated data); Yes/No sponsorship radios are
  // intentionally NOT auto-answered here (a wrong legal answer would hurt the user).
  { keys: ["work authorization", "authorized to work", "work eligibility", "employment authorization",
            "authorization status", "work status", "eligible to work"],                                       field: "work_auth"       },
  { keys: ["visa status", "visa type", "current visa", "immigration status", "visa"],                         field: "visa_status"     },
  { keys: ["salary expectation", "expected salary", "desired salary", "salary requirement",
            "compensation expectation", "desired compensation", "expected compensation"],                     field: "salary"          },
  { keys: ["years of experience", "years experience", "total experience", "total years",
            "experience (years)", "yrs of experience", "yrs experience"],                                     field: "years_experience" },
  // Separate first/last name fields — MUST come before the "name" catch-all below,
  // else a "First name" box (its label contains "name") wrongly gets the FULL name.
  { keys: ["first name", "given name", "legal first name", "preferred first name", "preferred name", "forename", "first_name"], field: "first_name" },
  { keys: ["last name", "surname", "family name", "legal last name", "last_name"],                                              field: "last_name"  },
  { keys: ["name"],                                                                                           field: "full_name"  }, // widest — must be last
]

// Known work-auth codes → human-readable labels for text fields.
const WORK_AUTH_LABELS = {
  h1b: "H-1B", opt_cpt: "OPT/CPT", opt: "OPT", cpt: "CPT",
  green_card: "Green Card", gc: "Green Card", citizen: "U.S. Citizen",
  w2: "W2", c2c: "C2C", no_sponsorship: "No sponsorship required",
}
function humanizeAuth(v) {
  if (!v) return ""
  const key = String(v).toLowerCase().replace(/[\s-]+/g, "_")
  return WORK_AUTH_LABELS[key] || String(v)
}
function buildSalary(profile) {
  const fmt = (n) => "$" + Number(n).toLocaleString("en-US")
  const min = profile.salary_min, max = profile.salary_max
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return fmt(min)
  if (max) return fmt(max)
  return ""
}

function getFieldHint(el) {
  const parts = [
    el.name        || "",
    el.id          || "",
    el.placeholder || "",
    el.getAttribute("aria-label")     || "",
    el.getAttribute("autocomplete")   || "",
    el.getAttribute("data-field")     || "",
    el.getAttribute("data-label")     || "",
    el.getAttribute("data-testid")    || "",
    el.getAttribute("data-cy")        || "",
    el.getAttribute("data-field-id")  || "",
  ]
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (lbl) parts.push(lbl.innerText)
  }
  const parent = el.closest(
    ".field, .form-group, .input-group, [class*='field'], [class*='form'], [class*='Field'], " +
    ".form-control, .MuiFormControl-root, [class*='question'], [class*='Question'], " +
    ".jobs-easy-apply-form-element, [data-test-form-element]"
  )
  if (parent) {
    const lbl = parent.querySelector("label, .label, [class*='label'], [class*='Label']")
    if (lbl) parts.push(lbl.innerText)
    const legend = parent.querySelector("legend, h3, h4, .question, [class*='question']")
    if (legend) parts.push(legend.innerText)
  }
  return parts.join(" ").toLowerCase()
}

function fillGeneric(profile, alreadyFilled = new Set()) {
  const { first, last } = splitName(profile)
  const values = {
    full_name:  profile.full_name  || "",
    first_name: first,
    last_name:  last,
    email:      profile.email      || "",
    phone:      profile.phone      || "",
    location:   profile.location   || "",
    linkedin:   profile.linkedin   || "",
    github:     profile.github     || "",
    portfolio:  profile.portfolio  || "",
    title:      profile.title      || "",
    work_auth:  humanizeAuth(profile.work_auth || profile.visa_status),
    visa_status: humanizeAuth(profile.visa_status || profile.work_auth),
    salary:      buildSalary(profile),
    years_experience: String(profile.years_experience || profile.yearsExperience || ""),
  }

  const inputs = [
    ...document.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button'])" +
      ":not([type='file']):not([type='checkbox']):not([type='radio'])" +
      ":not([type='search']):not([type='range']):not([type='color']), " +
      "textarea:not([aria-hidden='true'])"
    )
  ]

  let n = 0
  for (const el of inputs) {
    if (el.readOnly || el.disabled || alreadyFilled.has(el)) continue
    const hint = getFieldHint(el)
    for (const { keys, field } of FIELD_MAP) {
      if (keys.some(k => hint.includes(k))) {
        const val = values[field]
        // No data for this interpretation (e.g. hint matched "github" but the
        // profile has no github) — keep trying later, looser mappings.
        if (!val) continue
        if (fillText(el, val)) { n++; alreadyFilled.add(el) }
        // Whether we just filled it or it ALREADY held this exact value
        // (fillText no-ops on equal values), this element is now claimed —
        // stop before a looser mapping overwrites it. Without this break, a
        // re-run (multi-step wizard re-fill, second click) let the widest
        // ["name"]→full_name catch-all stomp an already-correct "First name"
        // box with the full name.
        break
      }
    }
  }

  // Select dropdowns — country, state
  for (const sel of [...document.querySelectorAll("select:not([disabled])")]) {
    if (alreadyFilled.has(sel)) continue
    const hint = getFieldHint(sel)
    if (/country/i.test(hint)) {
      if (fillSelect(sel, "United States") || fillSelect(sel, "US")) { n++; alreadyFilled.add(sel) }
    }
  }

  return n
}

// ── Safe work-authorization radio — every ATS, not just Workday ─────────────
// We auto-answer ONLY the "legally authorized to work" radio, and ONLY when the
// profile's work_auth status unambiguously means "authorized without sponsorship."
// We deliberately do NOT auto-answer protected EEO / demographic self-ID questions
// (veteran status, disability) or the sponsorship Yes/No radio — guessing those is
// often wrong for the user and is a real liability. This used to run only inside
// fillWorkday(); Greenhouse/Lever/Ashby/SmartRecruiters etc. ask the identical
// question and never got it.
//
// FIXED real-harm bug: this previously answered "Yes" for EVERY work_auth value,
// including "Need Sponsorship" — which by definition means the candidate is NOT
// currently authorized to work without an employer sponsoring a visa. Auto-filling
// "Yes" there mis-stated the candidate's legal work authorization on a real
// application. "Need Sponsorship" and an unset/unknown status are now left
// unanswered — ATTENTION_RE (a few lines below) already matches "legally
// authorized"/"work authoriz", so detectAttentionFields() automatically surfaces
// the skipped question in the "needs your review" checklist instead of guessing.
// work_auth arrives in at least THREE different shapes depending on where the
// profile was set (Settings' dropdown: "H-1B Visa", "STEM OPT" / the setup
// wizard: "H-1B", "OPT (STEM)", "Need Sponsorship" / stored data: "green_card"
// snake_case) — none of which fully agree, and Settings has no "Need
// Sponsorship" option at all. Matching by NORMALIZED KEYWORD, not an exact-value
// list, is what makes this work regardless of which surface wrote the value.
// "sponsor" is checked FIRST as a disqualifier so "Need Sponsorship" never
// matches "citizen"/"green card"/etc by coincidence. "C2C" is deliberately NOT
// treated as authorized — it describes a contracting arrangement, not an
// immigration status, so it tells us nothing about legal work authorization.
function fillWorkAuthRadio(profile) {
  const status = (profile?.work_auth || "").toLowerCase().replace(/[_.]/g, " ").replace(/\s+/g, " ").trim()
  if (!status || /sponsor/.test(status)) return 0 // unset, or explicitly needs sponsorship → leave for the user
  const authorized = /citizen|green ?card|\bh-?1b\b|\bopt\b|\bcpt\b|tn visa|\b[lo]-?1\b|\bj-?1\b/.test(status)
  if (!authorized) return 0 // unrecognized/ambiguous (e.g. "C2C") → leave for the user, never guess
  return fillRadio("authorized", "Yes") ? 1 : 0
}

// ── Application-preference radios — relocate / start date / transportation /
// clearance. Unlike sponsorship or EEO questions, these are logistics facts
// the user stated themselves once (Settings → Application Preferences), not a
// guess — same trust level as work_auth above. Still opt-in per field: a
// value of null/undefined ("not answered yet" — see /api/profile's tri-state
// handling) skips the question entirely rather than defaulting to "No".
function fillPreferenceRadio(labelKeyword, value) {
  if (value === null || value === undefined) return 0
  return fillRadio(labelKeyword, value ? "Yes" : "No") ? 1 : 0
}
function fillRelocateRadio(profile)         { return fillPreferenceRadio("relocat", profile?.relo_ok) }
function fillStartImmediatelyRadio(profile) { return fillPreferenceRadio("immediately", profile?.start_immediately) }
function fillTransportationRadio(profile)   { return fillPreferenceRadio("transportation", profile?.has_transportation) }
function fillClearanceRadio(profile)        { return fillPreferenceRadio("clearance", profile?.has_clearance) }

// ── Required-attestation checkboxes ("I certify the above is true", etc.) ───
// Safe to auto-check: this is a factual attestation about the application
// itself, not a marketing opt-in or a protected disclosure. We deliberately do
// NOT touch checkboxes about EEO self-identification, marketing/email opt-ins,
// or anything not matching this narrow attestation pattern.
const ATTEST_RE = /\b(certify|attest|acknowledge that|represent that|to the best of my knowledge|true and (accurate|complete)|information (provided|contained) (herein|above|in this application) is (true|accurate))\b/i
function fillCertificationCheckboxes(alreadyFilled) {
  let n = 0
  for (const cb of document.querySelectorAll('input[type="checkbox"]:not([disabled]):not(:checked)')) {
    if (alreadyFilled && alreadyFilled.has(cb)) continue
    const hint = getFieldHint(cb)
    if (!ATTEST_RE.test(hint)) continue
    cb.click()
    cb.dispatchEvent(new Event("change", { bubbles: true }))
    if (cb.checked) { n++; if (alreadyFilled) alreadyFilled.add(cb) }
  }
  return n
}

// ── "Needs your attention" — nuanced/protected questions we deliberately never
// auto-answer, surfaced so the user notices them instead of silently skipping.
// Real-world example that motivated this (fetched from a live Greenhouse posting):
// "Are you legally authorized to work?" is NOT always a Yes/No radio — one real
// form phrased it as a 4-way employment-status question ("Not working" / "On
// contract seeking full-time" / "On contract seeking c2c/c2h" / "Working
// full-time seeking opportunities"). Our safe Yes/No fill correctly finds no
// match there and does nothing — but the user could easily miss that the
// question exists at all if nothing points it out.
const ATTENTION_RE = /\b(sponsor|sponsorship|visa|veteran|disability|race|ethnicity|hispanic|latino|gender( identity)?|sexual orientation|legally authorized|work authoriz)/i

function radioGroupLabel(radios) {
  const first = radios[0]
  const fieldset = first.closest("fieldset, .field, .form-group, [class*='question'], [class*='field']")
  const legend = fieldset?.querySelector("legend, label, h3, h4, .question-label, [class*='label']")
  return (legend?.innerText || first.name || "").trim().replace(/\s+/g, " ").slice(0, 60)
}

function detectAttentionFields(alreadyFilled) {
  const flagged = []
  // Radio groups (by name attribute) with no option checked
  const seenNames = new Set()
  for (const r of document.querySelectorAll("input[type='radio']")) {
    if (!r.name || seenNames.has(r.name)) continue
    seenNames.add(r.name)
    const group = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(r.name)}"]`)]
    if (group.some(g => g.checked)) continue
    const hint = getFieldHint(r) + " " + radioGroupLabel(group)
    if (ATTENTION_RE.test(hint)) flagged.push(radioGroupLabel(group) || "Work authorization / EEO question")
  }
  // Selects still at their placeholder/default option
  for (const sel of document.querySelectorAll("select:not([disabled])")) {
    if (alreadyFilled && alreadyFilled.has(sel)) continue
    if (sel.selectedIndex > 0 && sel.value) continue  // already has a real value
    const hint = getFieldHint(sel)
    if (ATTENTION_RE.test(hint)) flagged.push(inferFieldName(sel) || "Sponsorship / EEO question")
  }
  return flagged.filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 6)
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN AUTOFILL ORCHESTRATOR
// ────────────────────────────────────────────────────────────────────────────

// ── Infer a human-readable field name from an element ───────────────────────
function inferFieldName(el) {
  const candidates = [
    el.getAttribute("aria-label"),
    el.getAttribute("placeholder"),
    el.name,
    el.id,
  ].filter(Boolean)
  const label = (() => {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (lbl) return lbl.innerText.trim()
    }
    const parent = el.closest(".field, .form-group, [class*='field'], [class*='Field'], [data-automation-id]")
    if (parent) {
      const lbl = parent.querySelector("label, [class*='label'], [class*='Label']")
      if (lbl) return lbl.innerText.trim()
    }
    return null
  })()
  if (label) return label.replace(/\s*\*\s*$/, "").slice(0, 30)
  const raw = (candidates[0] || "").replace(/[-_]/g, " ")
  return raw.charAt(0).toUpperCase() + raw.slice(1, 30)
}

// Runs one fill pass without letting it take down the whole autofill run.
// Jobright-style behavior: keep trying every remaining field/pass even if one
// throws (a single malformed react-select widget, an unexpected null, etc.)
// — previously an uncaught throw here aborted autoFillForm() entirely, which
// also meant the caller's sendResponse never fired (see the AUTOFILL handler).
async function safePass(label, fn) {
  try { return (await fn()) || 0 }
  catch (e) { console.error(`[MarketFit] ${label} pass failed:`, e); return 0 }
}

async function autoFillForm(profile) {
  if (!profile) return { count: 0, fields: [] }
  const ats    = getATS()
  const filled = new Set()   // shared across ATS-specific + generic so nothing double-fills
  let   n      = 0

  switch (ats) {
    case "greenhouse":      n += await safePass(ats, () => fillGreenhouse(profile, filled));     break
    case "lever":           n += await safePass(ats, () => fillLever(profile, filled));          break
    case "workday":         n += await safePass(ats, () => fillWorkday(profile, filled));         break
    case "ashby":           n += await safePass(ats, () => fillAshby(profile, filled));           break
    case "smartrecruiters": n += await safePass(ats, () => fillSmartRecruiters(profile, filled)); break
    case "bamboohr":        n += await safePass(ats, () => fillBambooHR(profile, filled));        break
    case "jobvite":         n += await safePass(ats, () => fillJobvite(profile, filled));         break
    case "icims":           n += await safePass(ats, () => fillICIMS(profile, filled));           break
    case "linkedin":        n += await safePass(ats, () => fillLinkedInEasyApply(profile, filled)); break
    case "taleo":           n += await safePass(ats, () => fillTaleo(profile, filled));           break
    case "successfactors":  n += await safePass(ats, () => fillSuccessFactors(profile, filled));  break
    case "workable":        n += await safePass(ats, () => fillWorkable(profile, filled));        break
    case "rippling":        n += await safePass(ats, () => fillRippling(profile, filled));        break
  }

  // Safe on every ATS, not just Workday — same "authorized to work = Yes" only
  // policy (sponsorship / EEO radios are never touched).
  n += await safePass("workAuthRadio", () => fillWorkAuthRadio(profile))
  n += await safePass("relocateRadio", () => fillRelocateRadio(profile))
  n += await safePass("startImmediatelyRadio", () => fillStartImmediatelyRadio(profile))
  n += await safePass("transportationRadio", () => fillTransportationRadio(profile))
  n += await safePass("clearanceRadio", () => fillClearanceRadio(profile))

  // Generic pass catches ATS custom questions + non-ATS pages.
  n += await safePass("generic", () => fillGeneric(profile, filled))

  // Required-attestation checkboxes ("I certify the above is true, etc.") —
  // run last so it only catches what the ATS-specific + generic passes left.
  n += await safePass("certCheckboxes", () => fillCertificationCheckboxes(filled))

  // Build human-readable checklist from filled elements
  const fieldNames = [...filled]
    .map(el => inferFieldName(el))
    .filter((v, i, a) => v && a.indexOf(v) === i)  // dedupe
    .slice(0, 20)

  // Sponsorship/EEO/nuanced-status questions we deliberately never auto-answer
  // — surfaced so the user notices them instead of silently skipping past.
  const needsAttention = detectAttentionFields(filled)

  if (n > 0 || needsAttention.length) showFillToast(n, ats, fieldNames, needsAttention)

  // ── Telemetry — fire-and-forget; never throws ─────────────────────────────
  // Logs per-ATS fill stats so we can prioritize future adapter fixes.
  // Uses the app origin stored in chrome.storage; no user PII is sent.
  ;(async () => {
    try {
      const s = await chrome.storage.sync.get(["appUrl"])
      const appUrl = (s.appUrl || "https://marketfit.app").replace(/\/$/, "")
      await fetch(appUrl + "/api/autofill-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ats,
          fieldsFilledCount:   n,
          attentionFieldCount: needsAttention.length,
          attentionFields:     needsAttention,
          pageHostname:        window.location.hostname,
        }),
      })
    } catch { /* telemetry is always best-effort */ }
  })()

  return { count: n, fields: fieldNames, ats, needsAttention }
}

// ── Continuous re-fill for multi-step application wizards ──────────────────
// Workday/Greenhouse/Lever applications are almost always spread across
// several pages (Personal Info → Experience → Voluntary Disclosures → Review).
// Without this, autofill only ever touches whatever fields exist at the
// moment the user clicks — every subsequent page is empty until they
// remember to re-open the popup and click Autofill again. This watches the
// DOM for new form fields (the signal that the user advanced a step, or that
// a section/accordion expanded) and silently re-runs the same fill pass.
let _refillObserver = null
let _refillTimer = null
let _refillRunsLeft = 50  // safety valve against a pathologically mutating page

function armContinuousRefill(profile) {
  if (_refillObserver) return  // already armed for this page load
  _refillObserver = new MutationObserver(() => {
    if (_refillTimer) clearTimeout(_refillTimer)
    _refillTimer = setTimeout(() => runRefillPass(profile), 700)
  })
  _refillObserver.observe(document.body, { childList: true, subtree: true })
}

async function runRefillPass(profile) {
  if (_refillRunsLeft-- <= 0 || !_refillObserver) return
  // Disconnect while we fill — our own input/change/blur dispatches and any
  // resulting re-renders would otherwise immediately re-trigger this observer.
  _refillObserver.disconnect()
  try {
    // autoFillForm() shows its own checklist toast whenever it fills anything
    // (n > 0) — no separate notification needed here.
    await autoFillForm(profile)
  } catch { /* best-effort — never break the page */ }
  if (_refillObserver) _refillObserver.observe(document.body, { childList: true, subtree: true })
}

// ────────────────────────────────────────────────────────────────────────────
// JOB DESCRIPTION SCRAPER
// ────────────────────────────────────────────────────────────────────────────

function scrapeJobDescription() {
  const url  = window.location.href

  if (url.includes("linkedin.com")) {
    const el = document.querySelector(
      ".jobs-description-content__text, .jobs-box__html-content, " +
      ".description__text, [class*='job-description'], .jobs-description__container"
    )
    if (el) return el.innerText.trim()
  }
  if (url.includes("indeed.com")) {
    const el = document.querySelector(
      "#jobDescriptionText, .jobsearch-jobDescriptionText, [class*='JobDescription'], [data-testid='job-description']"
    )
    if (el) return el.innerText.trim()
  }
  if (url.includes("glassdoor.com")) {
    const el = document.querySelector("[class*='JobDescription'], [class*='jobDescription'], .desc")
    if (el) return el.innerText.trim()
  }
  if (url.includes("ziprecruiter.com")) {
    const el = document.querySelector(".job_description, [class*='job-description'], .jobDescriptionSection")
    if (el) return el.innerText.trim()
  }
  if (url.includes("dice.com")) {
    const el = document.querySelector("[data-cy='jobDescription'], .job-details, #jobDescription")
    if (el) return el.innerText.trim()
  }
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
    const el = document.querySelector("#content, .content, .job-description, [id*='description']")
    if (el) return el.innerText.trim()
  }
  if (url.includes("lever.co")) {
    const el = document.querySelector(".posting-headline, .section-wrapper, .content-wrapper")
    if (el) return el.innerText.trim()
  }
  if (url.includes("ashbyhq.com")) {
    const el = document.querySelector("[class*='description'], [class*='job-post'], [class*='content']")
    if (el && el.innerText.length > 100) return el.innerText.trim()
  }

  // Generic: try known selectors
  const selectors = [
    "#content", "#job-description", ".job-description", ".posting-requirements",
    "[class*='description']", "[id*='description']", "article.posting",
    ".application-description", "[data-automation='jobDescription']",
    ".lever-job-description", ".greenhouse-job-description",
    "[class*='jobDetails']", "[class*='job-details']",
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim().length > 100) return el.innerText.trim()
  }

  // Last resort: largest text block on the page
  let best = ""
  document.querySelectorAll("div, section, article").forEach(el => {
    const txt = el.innerText || ""
    if (txt.length > best.length && txt.length < 20000) best = txt
  })
  return best.length > 200 ? best.trim() : ""
}

// ────────────────────────────────────────────────────────────────────────────
// FILL TOAST — visual confirmation overlay
// ────────────────────────────────────────────────────────────────────────────

function showFillToast(count, ats, fieldNames = [], needsAttention = []) {
  document.getElementById("co-fill-toast")?.remove()
  const atsLabel = ats && ats !== "generic"
    ? ats.charAt(0).toUpperCase() + ats.slice(1)
    : "Form"

  // Build checklist rows (max 8 shown)
  const checkRows = fieldNames.slice(0, 8).map(f =>
    `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:10.5px;color:#374151">
       <span style="color:#16a34a;font-size:11px;flex-shrink:0">✓</span>
       <span>${f}</span>
     </div>`
  ).join("")
  const moreCount = fieldNames.length > 8 ? fieldNames.length - 8 : 0

  // Fields we deliberately never auto-answer (sponsorship, EEO, nuanced work
  // status) — flagged so the user notices them instead of missing them.
  const attentionRows = needsAttention.map(f =>
    `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:10.5px;color:#92400e">
       <span style="color:#d97706;font-size:11px;flex-shrink:0">⚠</span>
       <span>${f}</span>
     </div>`
  ).join("")

  const headerLine = count > 0
    ? `${count}/${count} fields filled`
    : needsAttention.length
      ? "Review needed before you submit"
      : "0 fields filled"

  const toast = document.createElement("div")
  toast.id = "co-fill-toast"
  toast.innerHTML = `
    <div style="
      position:fixed; bottom:82px; right:20px; z-index:2147483647;
      background:#ffffff; border-radius:14px; padding:0;
      box-shadow:0 8px 32px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.06);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      min-width:230px; max-width:280px;
      animation:coIn .3s cubic-bezier(.34,1.56,.64,1) both;
      overflow:hidden;
    ">
    <style>
      @keyframes coIn  { from{opacity:0;transform:translateY(16px) scale(.95)} to{opacity:1;transform:none} }
      @keyframes coOut { to{opacity:0;transform:translateY(8px)} }
    </style>
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid #f0f2f5">
      <div style="
        width:30px;height:30px;border-radius:8px;flex-shrink:0;
        background:linear-gradient(145deg,#2483e0,#1d6fc4,#1558a0);
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:900;color:#fff;letter-spacing:-.3px;
        box-shadow:0 3px 10px rgba(29,111,196,.35);
      ">MF</div>
      <div style="flex:1">
        <div style="font-size:12.5px;font-weight:700;color:#1a2035">
          ${headerLine}
        </div>
        <div style="font-size:10.5px;color:#6b7a99;margin-top:1px">MarketFit · ${atsLabel}</div>
      </div>
      <button id="co-toast-close" style="
        background:none;border:none;cursor:pointer;color:#9aa4bc;
        font-size:17px;line-height:1;padding:0;flex-shrink:0;
      ">×</button>
    </div>
    <!-- Progress bar -->
    <div style="height:3px;background:#e4e8ef">
      <div style="height:100%;width:100%;background:linear-gradient(90deg,#16a34a,#22c55e)"></div>
    </div>
    ${checkRows ? `
    <!-- Checklist -->
    <div style="padding:9px 13px">
      ${checkRows}
      ${moreCount ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px">+${moreCount} more fields</div>` : ""}
    </div>` : ""}
    ${attentionRows ? `
    <!-- Needs attention -->
    <div style="padding:9px 13px;border-top:1px solid #f0f2f5;background:#fffbeb">
      <div style="font-size:9.5px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Needs your review</div>
      ${attentionRows}
    </div>` : ""}
    </div>
  `
  document.body.appendChild(toast)
  document.getElementById("co-toast-close")?.addEventListener("click", () => toast.remove())
  setTimeout(() => {
    if (!toast.isConnected) return
    const inner = toast.querySelector("div")
    if (inner) inner.style.animation = "coOut .3s ease both"
    setTimeout(() => toast.remove(), 310)
  }, 6000)
}

function showInfoToast(message) {
  document.getElementById("co-fill-toast")?.remove()
  const toast = document.createElement("div")
  toast.id = "co-fill-toast"
  toast.innerHTML = `
    <div style="
      position:fixed; bottom:82px; right:20px; z-index:2147483647;
      background:#ffffff; border-radius:14px; padding:13px 15px;
      box-shadow:0 8px 32px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.06);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      max-width:270px; font-size:13px; font-weight:600; color:#6b7a99;
      animation:coIn .3s cubic-bezier(.34,1.56,.64,1) both;
    ">
    <style>@keyframes coIn{from{opacity:0;transform:translateY(16px) scale(.95)}to{opacity:1;transform:none}}</style>
    ${message}
    </div>`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3500)
}

// ────────────────────────────────────────────────────────────────────────────
// FLOATING BUTTON
// Two modes: "Autofill Form" on ATS pages, "Tailor Resume" on job listings
// ────────────────────────────────────────────────────────────────────────────

function injectFloatingButton() {
  if (document.getElementById("co-float-btn")) return
  // With all_frames:true, content.js also runs inside embedded ATS iframes
  // (e.g. a company career page embedding a Greenhouse "job_app" widget).
  // `position:fixed` is clipped to the IFRAME's own box, so a floating button
  // in a small embed would render cropped/invisible. Skip it there — the fill
  // engine itself still runs fine in that frame via the popup-triggered path
  // (chrome.tabs.sendMessage reaches every frame's listener, not just the top
  // one), only the in-page floating trigger needs enough room to make sense.
  const inSmallFrame = window.self !== window.top && (window.innerWidth < 480 || window.innerHeight < 480)
  if (inSmallFrame) return
  const onAppPage = isApplicationPage()

  const btn = document.createElement("div")
  btn.id = "co-float-btn"

  const labelText  = onAppPage ? "Autofill Form" : "Tailor Resume"
  const badgeText  = onAppPage ? "⚡ Quick Fill"  : "⚡ 12 sec"
  const badgeBg    = onAppPage ? "#f0fdf4"        : "#eff6ff"
  const badgeBdr   = onAppPage ? "#bbf7d0"        : "#bfdbfe"
  const badgeColor = onAppPage ? "#16a34a"        : "#1d6fc4"

  btn.innerHTML = `
    <div id="co-float-inner" style="
      position:fixed; bottom:24px; right:24px; z-index:2147483647;
      display:flex; align-items:center; gap:9px; padding:10px 18px 10px 10px;
      background:#ffffff; color:#1a2035; border-radius:50px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      font-size:13px; font-weight:700; cursor:pointer;
      box-shadow:0 4px 24px rgba(26,32,53,.14),0 1px 4px rgba(26,32,53,.08),0 0 0 1.5px #e4e8ef;
      user-select:none; transition:transform .15s ease,box-shadow .15s ease;
      letter-spacing:-.02em;
    ">
      <div style="
        width:28px;height:28px;border-radius:8px;flex-shrink:0;
        background:linear-gradient(145deg,#2483e0,#1d6fc4,#1558a0);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:900;color:#fff;letter-spacing:-.3px;
        box-shadow:0 2px 8px rgba(29,111,196,.35),inset 0 1px 0 rgba(255,255,255,.22);
      ">MF</div>
      <span style="color:#1a2035">${labelText}</span>
      <span style="
        font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;
        background:${badgeBg};border:1px solid ${badgeBdr};color:${badgeColor};
        white-space:nowrap;letter-spacing:.04em;
      ">${badgeText}</span>
    </div>
  `

  const inner = btn.querySelector("#co-float-inner")
  inner.addEventListener("mouseenter", () => {
    inner.style.transform  = "translateY(-2px) scale(1.01)"
    inner.style.boxShadow  = "0 8px 32px rgba(26,32,53,.18),0 2px 8px rgba(26,32,53,.1),0 0 0 1.5px #bfdbfe"
  })
  inner.addEventListener("mouseleave", () => {
    inner.style.transform  = ""
    inner.style.boxShadow  = "0 4px 24px rgba(26,32,53,.14),0 1px 4px rgba(26,32,53,.08),0 0 0 1.5px #e4e8ef"
  })

  inner.addEventListener("click", () => {
    const labelSpan = inner.querySelector("span:first-of-type")
    if (onAppPage) {
      // One-click autofill: ask background for profile, fill directly — no popup round-trip
      const original = labelSpan ? labelSpan.textContent : ""
      if (labelSpan) labelSpan.textContent = "Filling…"
      // If the background worker never calls back (asleep service worker, a
      // fetch that hangs instead of rejecting, an unhandled throw before its
      // sendResponse), the button previously stayed stuck on "Filling…"
      // forever with zero feedback. Race it against a timeout so the button
      // always recovers and the user always sees *something*.
      let settled = false
      const resetLabel = () => { if (labelSpan && !settled) { settled = true; labelSpan.textContent = original } }
      const timeoutId = setTimeout(() => {
        if (settled) return
        resetLabel()
        showInfoToast("MarketFit: No response from the app — is it running?")
      }, 8000)
      chrome.runtime.sendMessage({ type: "GET_PROFILE" }, async (resp) => {
        if (settled) return  // timeout already fired and reported failure
        clearTimeout(timeoutId)
        resetLabel()
        console.log("[MarketFit] GET_PROFILE response:", resp)
        try {
          if (resp && resp.profile) {
            const result = await autoFillForm(resp.profile)
            console.log("[MarketFit] autoFillForm result:", result)
            if (!result.count) showInfoToast("MarketFit: No fillable fields detected on this page")
            armContinuousRefill(resp.profile)
          } else {
            // Profile not reachable — open popup so user can connect
            chrome.runtime.sendMessage({ type: "OPEN_POPUP", onAppPage })
          }
        } catch (e) {
          console.error("[MarketFit] one-click autofill failed:", e)
          showInfoToast("MarketFit: Autofill hit an error — check the console")
        }
      })
    } else {
      // Job listing: grab JD, open popup for tailor flow
      const jd = scrapeJobDescription()
      if (jd) chrome.runtime.sendMessage({ type: "SAVE_JD", jd })
      chrome.runtime.sendMessage({ type: "OPEN_POPUP", onAppPage })
    }
  })

  document.body.appendChild(btn)
}

// Inject after page settles (SPA pages need the extra delay)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(injectFloatingButton, 1200))
} else {
  setTimeout(injectFloatingButton, 1200)
}

// Re-inject on SPA navigation (Workday, LinkedIn use hash/history routing)
let _lastUrl = window.location.href
setInterval(() => {
  const now = window.location.href
  if (now !== _lastUrl) {
    _lastUrl = now
    document.getElementById("co-float-btn")?.remove()
    setTimeout(injectFloatingButton, 1500)
    // Multi-step wizards (Workday especially) often change the URL (hash or
    // history) between steps. Reset the re-fill watcher so it re-arms fresh
    // for the new step instead of staying disconnected/stale.
    if (_refillObserver) { _refillObserver.disconnect(); _refillObserver = null }
    if (_refillTimer) { clearTimeout(_refillTimer); _refillTimer = null }
    _refillRunsLeft = 50
  }
}, 1000)

// ────────────────────────────────────────────────────────────────────────────
// MESSAGE LISTENER
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// JOB DETECTION — extract structured job info from listing pages
// ────────────────────────────────────────────────────────────────────────────

function detectJob() {
  const url = window.location.href

  // LinkedIn job listing
  if (url.includes("linkedin.com")) {
    const title   = document.querySelector(".job-details-jobs-unified-top-card__job-title, h1.t-24, .jobs-unified-top-card__job-title")?.innerText?.trim()
    const company = document.querySelector(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name")?.innerText?.trim()
    const meta    = document.querySelector(".job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description")?.innerText?.trim()
    if (title) return { title, company: company || "", meta: meta || "", industry: "Tech" }
  }

  // Indeed
  if (url.includes("indeed.com")) {
    const title   = document.querySelector("[data-testid='jobsearch-JobInfoHeader-title'], h1[class*='jobTitle'], .icl-u-xs-mb--xs")?.innerText?.trim()
    const company = document.querySelector("[data-testid='inlineHeader-companyName'], [class*='companyName']")?.innerText?.trim()
    if (title) return { title, company: company || "", meta: "", industry: "" }
  }

  // Glassdoor
  if (url.includes("glassdoor.com")) {
    const title   = document.querySelector("[class*='JobTitle'], h1[data-test='jobTitle'], [data-test='job-title']")?.innerText?.trim()
    const company = document.querySelector("[class*='EmployerName'], [data-test='employerName']")?.innerText?.trim()
    if (title) return { title, company: company || "", meta: "", industry: "" }
  }

  // Greenhouse
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
    const title   = document.querySelector("h1.app-title, h1.job-title, #header h1, h1")?.innerText?.trim()
    const company = document.querySelector(".company-name, [class*='company'], #logo-link")?.innerText?.trim()
                  || new URL(url).hostname.replace("www.", "").replace(".greenhouse.io", "")
    if (title) return { title, company: company || "", meta: "", industry: "" }
  }

  // Lever
  if (url.includes("lever.co")) {
    const title   = document.querySelector(".posting-headline h2, h2, [class*='title']")?.innerText?.trim()
    const company = document.querySelector(".main-header-logo, .posting-categories .location")?.innerText?.trim()
                  || new URL(url).pathname.split("/")[1]?.replace(/-/g, " ")
    if (title) return { title, company: company || "", meta: "", industry: "" }
  }

  // Workday
  if (/workday\.com|myworkdayjobs\.com/.test(url)) {
    const title   = document.querySelector("[data-automation-id='jobPostingHeader'] h2, [data-automation-id='jobPostingHeader']")?.innerText?.trim()
                  || document.querySelector("h2, h1")?.innerText?.trim()
    const company = new URL(url).hostname.split(".")[0]
    if (title) return { title, company: company || "", meta: "", industry: "" }
  }

  // Generic: try to find a prominent h1 near job-related keywords
  const h1 = document.querySelector("h1")?.innerText?.trim()
  if (h1 && h1.length < 100) {
    const pg = (document.title + " " + url).toLowerCase()
    if (/job|career|position|role|apply|hiring/.test(pg)) {
      return { title: h1, company: document.querySelector("title")?.innerText?.split(/[-|–]/)[0]?.trim() || "", meta: "", industry: "" }
    }
  }

  return null
}

// ────────────────────────────────────────────────────────────────────────────
// RESUME FILE ATTACHMENT
// Fetches the selected/tailored resume (.docx) via the background worker and
// drops it onto the application form's file input — the missing half of
// "one-click apply". Best-effort: never throws into the text-fill path.
// ────────────────────────────────────────────────────────────────────────────

function base64ToBlob(b64, type) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: type || "application/octet-stream" })
}

/** Pick the most likely resume upload input on the page (not the cover-letter one). */
function findResumeFileInput() {
  const inputs = [...document.querySelectorAll("input[type='file']")].filter(el => !el.disabled)
  if (!inputs.length) return null
  const scored = inputs.map(el => {
    const hint = (getFieldHint(el) + " " + (el.getAttribute("accept") || "")).toLowerCase()
    return { el, resume: /resume|\bcv\b|curriculum/.test(hint), cover: /cover|letter/.test(hint) }
  })
  // Prefer an explicit resume field; otherwise the first non-cover-letter input.
  return (scored.find(s => s.resume && !s.cover)
       || scored.find(s => !s.cover)
       || scored[0]).el
}

/** Programmatically set a File on a file input and fire the events frameworks watch. */
function setInputFile(input, file) {
  try {
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event("input",  { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
    return input.files && input.files.length === 1
  } catch {
    return false
  }
}

async function attachResumeFile(resumeUrl, resumeName) {
  if (!resumeUrl) return { attached: false, reason: "no_url" }
  const input = findResumeFileInput()
  if (!input) return { attached: false, reason: "no_file_input" }
  // Ask the background worker for the bytes (it holds the cross-origin permission).
  const resp = await new Promise(resolve => {
    try { chrome.runtime.sendMessage({ type: "GET_RESUME", url: resumeUrl }, resolve) }
    catch { resolve(null) }
  })
  if (!resp || !resp.ok || !resp.b64) return { attached: false, reason: resp?.error || "fetch_failed" }
  const blob = base64ToBlob(resp.b64, resp.type)
  const safe = (resumeName || "Resume").replace(/[^a-z0-9_\-. ]/gi, "_")
  const file = new File([blob], safe + ".docx", { type: resp.type })
  const ok   = setInputFile(input, file)
  return { attached: ok, reason: ok ? "ok" : "set_failed" }
}

// ── Real submission — Greenhouse & Lever only ────────────────────────────────
// The two ATSes with the simplest, most predictable single-page-form DOM among
// everything this extension supports. Deliberately NOT a hardcoded button ID
// ("#submit_app" etc.) — Greenhouse alone has more than one job-board renderer
// with different markup, and a fixed selector silently no-ops the moment
// either changes it. Match by submit-button role + visible text instead,
// scoped to the actual application form (found the same way the field-fill
// functions above find it) so this can never click something elsewhere on
// the page (a newsletter signup, a "Save for later" button, etc.).
const APPLICATION_FORM_ANCHOR_SEL = {
  greenhouse: '#first_name, input[name="job_application[first_name]"]',
  lever:      'input[name="name"]',
}
function findSubmitButton(ats) {
  const anchorSel = APPLICATION_FORM_ANCHOR_SEL[ats]
  const anchor = anchorSel && document.querySelector(anchorSel)
  const form = anchor?.closest("form")
  // No identifiable application form → don't guess at a document-wide search.
  // The page didn't look like what we expect for this ATS, so err toward not
  // submitting rather than risk clicking an unrelated button.
  if (!form) return null
  const candidates = [...form.querySelectorAll("button[type='submit'], input[type='submit'], button:not([type])")]
  for (const el of candidates) {
    if (el.disabled) continue
    const text = (el.value || el.textContent || "").trim().toLowerCase()
    if (!text) continue
    if (/save|draft|preview|autofill|cancel|back|previous/.test(text)) continue
    if (/submit|apply now|send application/.test(text)) return el
  }
  return null
}
function submitApplication(ats) {
  const btn = findSubmitButton(ats)
  if (!btn) return false
  btn.click()
  return true
}

// A submitted application happened on e.g. boards.greenhouse.io — the
// dashboard's Applications tracker (jd_applications_v2) lives in
// localStorage on marketfit.app/localhost, a different origin this content
// script has no access to. Queue it in chrome.storage.local (extension-wide,
// not origin-scoped) instead; web-bridge.js drains this queue into the
// tracker the next time the dashboard itself loads — same cross-context
// hand-off already used for auth session sync (see listenForWebAuth).
function queueSubmittedApplication(job) {
  try {
    chrome.storage.local.get(["pendingApplications"], (s) => {
      const pending = Array.isArray(s.pendingApplications) ? s.pendingApplications : []
      pending.push({
        id: "ext_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        company: job?.company || "Unknown company",
        role: job?.title || "Unknown role",
        location: "",
        stage: "applied",
        appliedDate: new Date().toISOString(),
        notes: "Submitted via MarketFit extension",
        url: window.location.href,
        visa: "",
        priority: "mid",
      })
      chrome.storage.local.set({ pendingApplications: pending })
    })
  } catch { /* tracker sync is best-effort — the real submission already happened */ }
}

// Runs a full autofill pass + optional resume attach + continuous-refill arm,
// and returns the popup/sidebar checklist shape. Extracted from the AUTOFILL
// message handler so the in-page sidebar can call it directly (same isolated
// world as content.js — see the window.__mfSidebarBridge export below) without
// duplicating the required/optional classification or resume-attach logic.
//
// autoSubmit (default false — every existing caller keeps today's fill-only
// behavior unchanged): when true, ALSO clicks the real Submit button after a
// clean fill, but only when every safety condition holds —
//   - the ATS is Greenhouse or Lever (see above — nothing else is supported yet)
//   - at least one field was actually filled (not a broken/unrecognized page)
//   - nothing was flagged in needsAttention (a sponsorship/EEO/ambiguous
//     question left unanswered means the form isn't safely submittable as-is;
//     the user resolves that one manually and submits it themselves instead
//     of risking an incomplete or wrong real submission)
// Callers must have already gotten explicit per-application user confirmation
// before ever passing autoSubmit — this function does not ask.
async function runAutofillFlow(profile, resumeUrl, resumeName, autoSubmit) {
  const result   = await autoFillForm(profile)
  const count    = result.count
  const fields   = result.fields || []
  // Classify fields into required vs optional for the UI checklist
  const OPTIONAL_KEYS = ["github", "portfolio", "website", "bio", "cover"]
  const required = fields.filter(f => !OPTIONAL_KEYS.some(k => f.toLowerCase().includes(k)))
  const optional = fields.filter(f =>  OPTIONAL_KEYS.some(k => f.toLowerCase().includes(k)))

  // Attach the resume file too, when a resume URL was passed.
  let resumeAttached = false
  if (resumeUrl) {
    try {
      const r = await attachResumeFile(resumeUrl, resumeName)
      resumeAttached = r.attached
      if (resumeAttached) showInfoToast("📎 Resume attached to the form")
    } catch { /* keep the text-fill result regardless */ }
  }

  armContinuousRefill(profile)

  const needsAttention = result.needsAttention || []
  let submitted = false
  if (autoSubmit && count > 0 && needsAttention.length === 0) {
    const ats = getATS()
    if (ats === "greenhouse" || ats === "lever") {
      try {
        submitted = submitApplication(ats)
        if (submitted) { try { queueSubmittedApplication(detectJob()) } catch {} }
      } catch { submitted = false }
    }
  }

  // NOTE: `required` here was previously sent as the raw total `count`
  // (a bug) — the popup's checklist showed the wrong "required fields"
  // number. Now sends the actual required-field count.
  return {
    filled: count, required: required.length, fields: required, optional, resumeAttached,
    needsAttention, submitted,
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SCRAPE_JD") {
    sendResponse({ jd: scrapeJobDescription() })
  }
  if (msg.type === "DETECT_JOB") {
    sendResponse(detectJob() || {})
  }
  if (msg.type === "AUTOFILL") {
    runAutofillFlow(msg.profile, msg.resumeUrl, msg.resumeName)
      .then(sendResponse)
      .catch(e => {
        // Without this, a throw anywhere in the fill pass (any single ATS
        // adapter, a malformed react-select widget, etc.) silently drops the
        // response — the popup/sidebar hangs forever with no feedback, and
        // Chrome logs "message channel closed before a response was received"
        // instead of the real error. Always resolve so the caller can show
        // something instead of nothing.
        console.error("[MarketFit] autofill failed:", e)
        sendResponse({ filled: 0, required: 0, fields: [], optional: [], resumeAttached: false, needsAttention: [], error: String(e) })
      })
    return true  // MUST return true: response is sent asynchronously above
  }
  if (msg.type === "PING") {
    sendResponse({ ok: true, ats: getATS(), onAppPage: isApplicationPage() })
  }
  return true  // keep the message channel open for async responses
})

// ── In-page sidebar bridge ───────────────────────────────────────────────────
// sidebar.js is injected as a second content script into the same isolated
// world (see manifest.json — same content_scripts entry, loaded after this
// file), so it can call these directly instead of round-tripping through
// chrome.tabs.sendMessage (which content scripts can't call — that API is
// background/popup-only). Every function here already exists above; this is
// a read-only export, not new logic.
window.__mfSidebarBridge = {
  runAutofillFlow,
  scrapeJobDescription,
  detectJob,
  getATS,
  isApplicationPage,
}
