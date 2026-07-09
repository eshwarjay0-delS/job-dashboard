// MarketFit Extension — sidebar.js
// The Jobright-style in-page sidebar. Injected as a SECOND content script into
// the same ATS pages as content.js (see manifest.json — same content_scripts
// entry, loaded after content.js so window.__mfSidebarBridge already exists).
// Wires the already-built sidebar.css markup to real data: job context, H1B
// badge, match score, profile + resume list, and a live-ish fill checklist.
//
// Design choice: this file never guesses at content.js internals — it only
// calls the small, explicit bridge content.js exports (window.__mfSidebarBridge)
// and the extension's own messaging/storage APIs. If content.js isn't present
// (e.g. loaded standalone somehow) this file quietly no-ops.
;(function () {
  if (document.getElementById("careeeros-sidebar")) return   // already injected
  const bridge = window.__mfSidebarBridge
  if (!bridge) return   // content.js didn't run on this page — nothing to hook into
  // With all_frames:true (see content.js's injectFloatingButton for the same
  // reasoning), this also runs inside embedded ATS iframes. A 380px fixed
  // sidebar needs real room — in a small embed it would just cover the form
  // it's supposed to help with. Skip there; the fill engine itself is
  // unaffected (autofill is triggered from the top frame's panel/popup either
  // way — chrome.tabs.sendMessage reaches every frame's listener).
  const inSmallFrame = window.self !== window.top && (window.innerWidth < 560 || window.innerHeight < 480)
  if (inSmallFrame) return

  // ── Small helpers ──────────────────────────────────────────────────────────
  function esc(s) {
    const d = document.createElement("div")
    d.textContent = String(s == null ? "" : s)
    return d.innerHTML
  }
  function timeNow() {
    const d = new Date()
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }
  function getAppUrl() {
    return new Promise(resolve => {
      try {
        chrome.storage.sync.get(["appUrl"], s => resolve((s.appUrl || "https://marketfit.app").replace(/\/$/, "")))
      } catch { resolve("https://marketfit.app") }
    })
  }
  function getProfile() {
    return new Promise(resolve => {
      try { chrome.runtime.sendMessage({ type: "GET_PROFILE" }, res => resolve(res?.profile || null)) }
      catch { resolve(null) }
    })
  }

  // ── Static shell (no dynamic data interpolated — safe as innerHTML) ────────
  const root = document.createElement("div")
  root.id = "careeeros-sidebar"
  root.innerHTML = `
    <div id="mf-header">
      <div class="mf-header-top">
        <div class="mf-logo">
          <div class="mf-logo-icon">⚡</div>
          <div class="mf-logo-name">Market<span>Fit</span></div>
        </div>
        <button id="mf-close-btn" type="button" title="Close">✕</button>
      </div>
      <div class="mf-badge-row" id="mf-ats-badge-row"></div>
    </div>
    <div id="mf-job-context">
      <div class="mf-company" id="mf-company">—</div>
      <div class="mf-role" id="mf-role">Detecting job…</div>
      <div class="mf-match-row" id="mf-match-row"></div>
    </div>
    <div id="mf-body">
      <div id="mf-login-prompt">
        <div class="mf-login-icon">🔒</div>
        <div class="mf-login-title">Sign in to unlock Quick Fill</div>
        <div class="mf-login-sub">Connect your MarketFit account to pull your saved profile and resumes right into this panel.</div>
        <button class="mf-login-btn" id="mf-login-btn" type="button">Sign in →</button>
      </div>
      <div id="mf-profile-section" style="display:none">
        <div class="mf-section-label">Your Profile</div>
        <div class="mf-profile-card">
          <div class="mf-profile-name" id="mf-profile-name">—</div>
          <div class="mf-profile-email" id="mf-profile-email"></div>
        </div>
      </div>
      <div id="mf-resume-section" style="display:none">
        <div class="mf-section-label">Resume</div>
        <select class="mf-resume-select" id="mf-resume-select"><option value="">No resumes found</option></select>
      </div>
      <div id="mf-progress-section">
        <div class="mf-progress-bar-bg"><div class="mf-progress-bar-fill" id="mf-progress-fill"></div></div>
        <div class="mf-field-checklist" id="mf-field-checklist"></div>
      </div>
      <div id="mf-controls" style="display:none">
        <button class="mf-autofill-btn" id="mf-autofill-btn" type="button">⚡ Start Autofill</button>
      </div>
      <div id="mf-receipt">
        <div class="mf-receipt-title">⚠ Review before filling</div>
        <div class="mf-receipt-sub" id="mf-receipt-sub">Nothing on the page changes until you confirm.</div>
        <div class="mf-receipt-rows" id="mf-receipt-rows"></div>
        <div class="mf-receipt-actions">
          <button class="mf-receipt-cancel" id="mf-receipt-cancel" type="button">Cancel</button>
          <button class="mf-receipt-confirm" id="mf-receipt-confirm" type="button">✓ Looks good — fill form</button>
        </div>
      </div>
      <div id="mf-status-log">
        <div class="mf-section-label">Activity</div>
        <div class="mf-log-entries" id="mf-log-entries"></div>
      </div>
    </div>
    <div id="mf-footer">
      <button class="mf-footer-link" id="mf-footer-tailor" type="button">📄 Tailor resume</button>
      <div class="mf-footer-sep"></div>
      <button class="mf-footer-link" id="mf-footer-dashboard" type="button">Open dashboard →</button>
    </div>
  `
  document.body.appendChild(root)

  const toggle = document.createElement("button")
  toggle.id = "careeeros-toggle"
  toggle.type = "button"
  toggle.textContent = "MARKETFIT"
  document.body.appendChild(toggle)

  function openSidebar() { root.classList.add("open"); toggle.classList.add("hidden") }
  function closeSidebar() { root.classList.remove("open"); toggle.classList.remove("hidden") }
  toggle.addEventListener("click", openSidebar)
  document.getElementById("mf-close-btn").addEventListener("click", closeSidebar)

  function log(msg, kind = "info") {
    const list = document.getElementById("mf-log-entries")
    if (!list) return
    const entry = document.createElement("div")
    entry.className = `mf-log-entry ${kind}`
    const time = document.createElement("span")
    time.className = "mf-log-time"
    time.textContent = timeNow()
    const text = document.createElement("span")
    text.className = "mf-log-msg"
    text.textContent = msg
    entry.appendChild(time)
    entry.appendChild(text)
    list.insertBefore(entry, list.firstChild)
    while (list.children.length > 30) list.removeChild(list.lastChild)
  }

  // ── ATS badge ────────────────────────────────────────────────────────────
  const ats = bridge.getATS ? bridge.getATS() : "generic"
  const atsRow = document.getElementById("mf-ats-badge-row")
  if (atsRow) {
    const badge = document.createElement("span")
    badge.className = "mf-badge green"
    badge.innerHTML = `<span class="dot"></span> ${esc(ats)}`
    atsRow.appendChild(badge)
  }

  // Only auto-open on an actual application page — elsewhere (a listing page)
  // stay collapsed as the toggle tab so we don't cover content the user hasn't
  // asked to interact with yet.
  const onApplicationPage = bridge.isApplicationPage ? bridge.isApplicationPage() : false
  if (onApplicationPage) openSidebar()

  // ── Job context: company / title (scraped, so escape before any HTML use —
  // here we use textContent throughout, which is inherently safe) ────────────
  let job = null
  try { job = bridge.detectJob ? bridge.detectJob() : null } catch { job = null }
  const companyEl = document.getElementById("mf-company")
  const roleEl = document.getElementById("mf-role")
  if (job && (job.title || job.company)) {
    companyEl.textContent = job.company || "Unknown company"
    roleEl.textContent = job.title || ""
    log(`Detected: ${job.title || "role"} at ${job.company || "this company"}`, "info")
  } else {
    companyEl.textContent = "No job detected"
    roleEl.textContent = "Open a job posting or application page"
  }

  // ── H1B badge (canonical scorer via the same public endpoint /api/h1b uses) ─
  // Relayed through the background service worker — see background.js — a direct
  // fetch() here gets silently CORS-blocked (no Access-Control-Allow-Origin on
  // the response) since this sidebar runs in the job-board page's own origin.
  async function loadH1B() {
    if (!job || !job.company) return
    try {
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "GET_H1B", company: job.company }, res => resolve(res?.data || null))
      })
      const row = document.getElementById("mf-match-row")
      if (!row || !data?.label) return
      const badge = document.createElement("span")
      badge.className = `mf-badge ${data.status === "likely" ? "green" : data.status === "possible" ? "yellow" : ""}`
      badge.textContent = `H1B: ${data.label}`
      badge.title = data.reason || ""
      row.appendChild(badge)
    } catch { /* H1B badge is a nice-to-have — never block the rest of the panel */ }
  }

  // ── Match score (needs a real JD + a signed-in profile; skips quietly if
  // either is missing, or if the server has no LLM key configured) ──────────
  // Relayed through the background service worker — same CORS reason as
  // loadH1B above.
  async function loadMatchScore(profile) {
    if (!profile) return
    let jd = ""
    try { jd = bridge.scrapeJobDescription ? bridge.scrapeJobDescription() : "" } catch { jd = "" }
    if (!jd || jd.length < 50) return
    try {
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: "GET_MATCH_SCORE",
          body: {
            jd: jd.slice(0, 3000),
            profile: {
              skills: profile.skills || [],
              yearsExp: profile.years_experience || 0,
              location: profile.location || "",
              education: profile.education || "",
            },
          },
        }, res => resolve(res?.data || null))
      })
      if (!data || typeof data.total !== "number") return
      const row = document.getElementById("mf-match-row")
      if (!row) return
      const pill = document.createElement("span")
      pill.className = `mf-match-score ${data.total >= 70 ? "high" : "medium"}`
      pill.textContent = `${data.total}% match`
      row.insertBefore(pill, row.firstChild)
      log(`Match score: ${data.total}%`, "info")
    } catch { /* match score is best-effort — the panel still works without it */ }
  }

  // ── Profile + resume list (only when signed in) ─────────────────────────────
  let cachedProfile = null
  let resumeFiles = []
  async function loadProfileAndResumes() {
    const profile = await getProfile()
    cachedProfile = profile
    const loginPrompt = document.getElementById("mf-login-prompt")
    const profileSection = document.getElementById("mf-profile-section")
    const resumeSection = document.getElementById("mf-resume-section")
    const controls = document.getElementById("mf-controls")

    if (!profile || !(profile.full_name || profile.email)) {
      loginPrompt.classList.add("visible")
      return
    }
    loginPrompt.classList.remove("visible")
    profileSection.style.display = ""
    resumeSection.style.display = ""
    controls.style.display = ""

    document.getElementById("mf-profile-name").textContent = profile.full_name || "Your profile"
    document.getElementById("mf-profile-email").textContent = profile.email || ""

    loadMatchScore(profile)

    // Relayed through the background service worker, same as GET_PROFILE above —
    // a direct fetch() from this sidebar's content-script context gets silently
    // blocked by the browser (the API sends no CORS headers for this origin), so
    // this always fell back to an empty list even when the account had resumes.
    try {
      resumeFiles = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "GET_USER_RESUMES" }, res => resolve(Array.isArray(res?.files) ? res.files : []))
      })
    } catch { resumeFiles = [] }

    // Resumes tailored via the extension's OWN popup — stored in chrome.storage.local
    // (not the website's localStorage, which the popup and dashboard don't share; this
    // IS shared across every extension context, no network call, so no CORS concerns).
    // NOTE: this only covers tailoring done through the popup's quick-tailor feature,
    // not the main dashboard's Tailor Resume page (that writes to the website's own
    // localStorage, which this extension has no access to from any context).
    let recentTailored = []
    try {
      const data = await chrome.storage.local.get(["recentResumes"])
      recentTailored = (data.recentResumes || []).slice(0, 3)
    } catch { recentTailored = [] }

    const select = document.getElementById("mf-resume-select")
    select.innerHTML = ""
    if (recentTailored.length === 0 && resumeFiles.length === 0) {
      const opt = document.createElement("option")
      opt.value = ""
      opt.textContent = "No resumes uploaded yet"
      select.appendChild(opt)
    } else {
      // Recently tailored first (token-based — served by /api/tailor/file, not
      // /api/resumes/download) so the freshest work is always at the top, ahead
      // of the full library below.
      recentTailored.forEach(r => {
        const opt = document.createElement("option")
        opt.value = "token:" + r.token
        opt.textContent = `🕐 ${r.name}${r.role ? " — " + r.role : ""}`
        select.appendChild(opt)
      })
      resumeFiles
        .slice()
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .forEach(f => {
          const opt = document.createElement("option")
          opt.value = "path:" + f.filepath
          opt.textContent = f.filename
          select.appendChild(opt)
        })
    }
  }

  // ── Autofill trigger — calls the SAME engine the popup uses (content.js's
  // runAutofillFlow), just invoked directly instead of via chrome.tabs.sendMessage
  // (content scripts can't call chrome.tabs — that API is background/popup-only). ─
  // ── Pre-fill review ("receipt") — mirrors the "every change shown to you,
  // never silently sent" pattern: pause after resolving exactly what WOULD be
  // filled, before touching the page, so a wrong resume pick or stale profile
  // value gets caught here instead of after the form is already full. Also the
  // gate any future real-submit flow reuses — nothing should ever submit
  // without this same confirm step running first. ──
  function triLabel(v) { return v === true ? "Yes" : v === false ? "No" : "" }
  // Greenhouse/Lever only, for now — see content.js's runAutofillFlow for why.
  const AUTO_SUBMIT_ATS = new Set(["greenhouse", "lever"])
  function showReceipt(fillProfile, resumeName, willAutoSubmit) {
    const rows = document.getElementById("mf-receipt-rows")
    rows.innerHTML = ""
    const items = [
      ["Name", fillProfile.full_name],
      ["Email", fillProfile.email],
      ["Phone", fillProfile.phone],
      ["Resume", resumeName],
      ["Work authorization", fillProfile.work_auth || fillProfile.visa_status],
      ["Willing to relocate", triLabel(fillProfile.relo_ok)],
      ["Open to remote", triLabel(fillProfile.remote_ok)],
      ["Can start immediately", triLabel(fillProfile.start_immediately)],
      ["Reliable transportation", triLabel(fillProfile.has_transportation)],
      ["Security clearance", triLabel(fillProfile.has_clearance)],
    ].filter(([, v]) => v)
    for (const [label, value] of items) {
      const row = document.createElement("div")
      row.className = "mf-receipt-row"
      const labelEl = document.createElement("span")
      labelEl.className = "mf-receipt-label"
      labelEl.textContent = label
      const valueEl = document.createElement("span")
      valueEl.className = "mf-receipt-value"
      valueEl.textContent = value
      row.appendChild(labelEl)
      row.appendChild(valueEl)
      rows.appendChild(row)
    }
    // The single most consequential line on this panel — whether confirming
    // fills the form for you to send yourself, or actually sends it. Must be
    // impossible to miss, not folded into a regular row.
    document.getElementById("mf-receipt-sub").textContent = willAutoSubmit
      ? "This will SUBMIT the real application — not just fill the form."
      : "Nothing on the page changes until you confirm."
    document.getElementById("mf-receipt-confirm").textContent = willAutoSubmit
      ? "✓ Looks good — fill & submit"
      : "✓ Looks good — fill form"
    document.getElementById("mf-receipt").classList.add("visible")
    document.getElementById("mf-receipt").classList.toggle("submit-mode", !!willAutoSubmit)
  }
  function hideReceipt() { document.getElementById("mf-receipt").classList.remove("visible") }
  function waitForReceiptConfirm() {
    return new Promise(resolve => {
      const confirmBtn = document.getElementById("mf-receipt-confirm")
      const cancelBtn  = document.getElementById("mf-receipt-cancel")
      function cleanup() {
        confirmBtn.removeEventListener("click", onConfirm)
        cancelBtn.removeEventListener("click", onCancel)
        hideReceipt()
      }
      function onConfirm() { cleanup(); resolve(true) }
      function onCancel()  { cleanup(); resolve(false) }
      confirmBtn.addEventListener("click", onConfirm)
      cancelBtn.addEventListener("click", onCancel)
    })
  }

  const autofillBtn = document.getElementById("mf-autofill-btn")
  autofillBtn.addEventListener("click", async () => {
    if (!cachedProfile) return
    autofillBtn.disabled = true
    autofillBtn.classList.add("running")
    autofillBtn.textContent = "⏳ Preparing…"
    log("Preparing autofill…", "info")
    try {
      const appUrl = await getAppUrl()
      const select = document.getElementById("mf-resume-select")
      const resumeName = select.selectedOptions[0]?.textContent || ""
      // Parse the "path:" / "token:" prefix set when populating the dropdown —
      // library files are served via /api/resumes/download (filepath), recently
      // popup-tailored ones via /api/tailor/file (token).
      const raw = select.value || ""
      const isToken = raw.startsWith("token:")
      const isPath = raw.startsWith("path:")
      const refValue = isToken ? raw.slice(6) : isPath ? raw.slice(5) : ""
      const resumeUrl = isToken
        ? `${appUrl}/api/tailor/file?token=${encodeURIComponent(refValue)}&fmt=docx`
        : isPath
          ? `${appUrl}/api/resumes/download?filepath=${encodeURIComponent(refValue)}&name=${encodeURIComponent(resumeName || "Resume")}`
          : null

      // A specific resume is selected → pull title/skills/years_experience from
      // THAT file's actual text, so different resume variants (e.g. "AppSec
      // Engineer" vs "Cloud Security") fill with their own talking points instead
      // of one fixed profile. Contact info (name/email/phone/linkedin/location)
      // deliberately stays from the constant account profile — it shouldn't vary
      // by which resume file happens to be selected, and several of the user's
      // resume variants carry different/stale emails, which we never want to fill.
      let fillProfile = cachedProfile
      if (refValue) {
        try {
          const msg = isToken ? { type: "GET_PROFILE", token: refValue } : { type: "GET_PROFILE", filepath: refValue }
          const resumeSpecific = await new Promise(resolve => {
            chrome.runtime.sendMessage(msg, res => resolve(res?.profile || null))
          })
          if (resumeSpecific) {
            fillProfile = {
              ...cachedProfile,
              title: resumeSpecific.title || cachedProfile.title,
              skills: (resumeSpecific.skills && resumeSpecific.skills.length) ? resumeSpecific.skills : cachedProfile.skills,
              years_experience: resumeSpecific.years_experience || cachedProfile.years_experience,
            }
          }
        } catch { /* fall back to cachedProfile — resume-specific fields are a nice-to-have */ }
      }

      const willAutoSubmit = AUTO_SUBMIT_ATS.has(ats)
      showReceipt(fillProfile, resumeName || "(no resume selected)", willAutoSubmit)
      log(willAutoSubmit
        ? "Review the details below — confirming will submit the real application."
        : "Review the details below, then confirm to fill the form.", "info")
      const confirmed = await waitForReceiptConfirm()
      if (!confirmed) {
        log("Cancelled — nothing on the page was touched.", "warning")
        autofillBtn.classList.remove("running")
        autofillBtn.textContent = "⚡ Start Autofill"
        return
      }

      autofillBtn.textContent = willAutoSubmit ? "⏳ Filling & submitting…" : "⏳ Filling…"
      document.getElementById("mf-progress-section").classList.add("visible")
      const result = await bridge.runAutofillFlow(fillProfile, resumeUrl, resumeName, willAutoSubmit)

      const checklist = document.getElementById("mf-field-checklist")
      checklist.innerHTML = ""
      const allFields = [...(result.fields || []), ...(result.optional || [])]
      allFields.forEach(name => {
        const item = document.createElement("div")
        item.className = "mf-field-item filled"
        item.innerHTML = `<span class="mf-field-dot">✓</span>`
        const label = document.createElement("span")
        label.textContent = name
        item.appendChild(label)
        checklist.appendChild(item)
      })
      ;(result.needsAttention || []).forEach(name => {
        const item = document.createElement("div")
        item.className = "mf-field-item error"
        item.innerHTML = `<span class="mf-field-dot">!</span>`
        const label = document.createElement("span")
        label.textContent = `${name} — needs your review`
        item.appendChild(label)
        checklist.appendChild(item)
      })
      document.getElementById("mf-progress-fill").style.width = "100%"

      autofillBtn.classList.remove("running")
      if (result.submitted) {
        autofillBtn.classList.add("success")
        autofillBtn.textContent = "✓ Application submitted!"
        log("Submitted — logged in your Applications tracker.", "success")
      } else if (willAutoSubmit) {
        // The receipt promised a real submit and it didn't happen — this must
        // never look like a plain green success, or the user could walk away
        // believing they applied when they didn't (the exact silent-failure
        // Tsenta's own "Failed" tracker status exists to prevent).
        autofillBtn.classList.add("error")
        autofillBtn.textContent = "⚠ Filled but NOT submitted"
        const reason = (result.needsAttention || []).length > 0
          ? "a flagged question above needs your answer first"
          : "couldn't find the real Submit button automatically"
        log(`Filled ${result.filled ?? 0} fields, but did not submit — ${reason}. Review the form and submit it yourself.`, "warning")
      } else {
        autofillBtn.classList.add("success")
        autofillBtn.textContent = `✓ Filled ${result.filled ?? 0} fields`
        log(`Filled ${result.filled ?? 0} fields${result.resumeAttached ? " + attached resume" : ""}`, "success")
      }
      if ((result.needsAttention || []).length) {
        log(`${result.needsAttention.length} question(s) need your review — see checklist above`, "warning")
      }
    } catch (err) {
      autofillBtn.classList.remove("running")
      autofillBtn.classList.add("error")
      autofillBtn.textContent = "✕ Fill failed — try again"
      log(`Autofill error: ${err?.message || err}`, "error")
    } finally {
      autofillBtn.disabled = false
      setTimeout(() => {
        autofillBtn.classList.remove("success", "error")
        autofillBtn.textContent = "⚡ Start Autofill"
      }, 4000)
    }
  })

  // ── Footer actions ───────────────────────────────────────────────────────
  document.getElementById("mf-login-btn")?.addEventListener("click", async () => {
    const appUrl = await getAppUrl()
    window.open(`${appUrl}/login`, "_blank")
  })
  document.getElementById("mf-footer-dashboard").addEventListener("click", async () => {
    const appUrl = await getAppUrl()
    window.open(`${appUrl}/dashboard`, "_blank")
  })
  document.getElementById("mf-footer-tailor").addEventListener("click", async () => {
    let jd = ""
    try { jd = bridge.scrapeJobDescription ? bridge.scrapeJobDescription() : "" } catch { jd = "" }
    const appUrl = await getAppUrl()
    if (jd) {
      try {
        await navigator.clipboard.writeText(jd)
        log("Job description copied — paste it into Tailor Resume on the dashboard.", "info")
      } catch { /* clipboard permission can fail silently on some sites — link still opens */ }
    }
    window.open(`${appUrl}/dashboard/resume`, "_blank")
  })

  // ── Kick off data loads ──────────────────────────────────────────────────
  loadH1B()
  loadProfileAndResumes()
})()
