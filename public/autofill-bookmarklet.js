// MarketFit Autofill Bookmarklet — prototype
// Save as a bookmark, click it on any Greenhouse/Lever/Workday application page.
// Pulls your profile from MarketFit and fills the form using the recovered
// setNativeValue procedure (React/Vue-safe).
//
// REA source: docs/research/simplify-autofill-recon.md (10th session)

(function () {
  'use strict';

  // ── Profile: fetched from MarketFit (falls back to prompt on first run) ──
  const PROFILE_KEY = 'mf_autofill_profile';

  function getProfile() {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }

  // ── ATS detection ──
  const ATS_PATTERNS = {
    greenhouse: /greenhouse\.io/i,
    lever: /lever\.co/i,
    workday: /myworkdayjobs\.com|workday/i,
  };

  function detectAts() {
    const host = window.location.hostname;
    for (const [k, p] of Object.entries(ATS_PATTERNS)) {
      if (p.test(host)) return k;
    }
    return 'generic';
  }

  // ── Field maps (subset — full maps in src/lib/ats-field-maps.ts) ──
  const FIELD_MAPS = {
    greenhouse: {
      first_name: 'firstName', last_name: 'lastName', email: 'email',
      phone: 'phone', 'candidate-location': 'city',
    },
    lever: {
      name: 'fullName', email: 'email', phone: 'phone',
      location: 'city', org: 'employer', 'urls[LinkedIn]': 'linkedin',
    },
    workday: {
      firstName: 'firstName', lastName: 'lastName', city: 'city',
      'phone-number': 'phone', phoneNumber: 'phone',
    },
    generic: {},
  };

  // ── The 5-step React/Vue-safe value injection (recovered via REA) ──
  function setNativeValue(el, value) {
    if (!el || value == null || value === '') return false;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (!!value !== el.checked) el.click();
      return true;
    }
    if (el instanceof HTMLSelectElement) {
      for (const o of el.options) {
        if (o.text.toLowerCase().includes(String(value).toLowerCase()) ||
            o.value.toLowerCase().includes(String(value).toLowerCase())) {
          el.value = o.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }
    // React's value tracker must be reset or it ignores the change
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue('');
    el.setAttribute('value', value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ── Field discovery: match inputs by id/name/placeholder/aria-label ──
  function findField(param) {
    const norm = param.toLowerCase();
    return Array.from(document.querySelectorAll('input, select, textarea')).find(el => {
      const attrs = [
        el.id, el.name, el.placeholder,
        el.getAttribute('aria-label'),
        el.getAttribute('data-qa'),
        el.getAttribute('data-automation-id'),
      ].map(a => (a || '').toLowerCase());
      return attrs.some(a => a && a.includes(norm));
    });
  }

  // ── Main ──
  function run(profile) {
    const ats = detectAts();
    const map = FIELD_MAPS[ats] || FIELD_MAPS.generic;
    let filled = 0, missed = [];
    for (const [htmlKey, profileKey] of Object.entries(map)) {
      const value = profile[profileKey];
      if (!value) continue;
      const el = findField(htmlKey);
      if (el && setNativeValue(el, value)) filled++;
      else missed.push(htmlKey);
    }
    const msg = `MarketFit Autofill (${ats}): filled ${filled} field${filled === 1 ? '' : 's'}` +
      (missed.length ? `\nMissed: ${missed.join(', ')}` : '') +
      '\n\nReview before submitting — you are responsible for every answer.';
    alert(msg);
  }

  // ── Entry ──
  let profile = getProfile();
  if (!profile) {
    // First run: fetch from MarketFit API if logged in, else prompt
    fetch('/api/user/profile', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.profile) {
          profile = data.profile;
          try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
          run(profile);
        } else {
          alert('MarketFit Autofill: open MarketFit in this browser first so I can read your profile, then click the bookmark again.');
        }
      })
      .catch(() => alert('MarketFit Autofill: could not reach MarketFit. Open it in this browser first.'));
  } else {
    run(profile);
  }
})();
