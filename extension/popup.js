// MarketFit Extension — Popup Script v3
// UI: Jobright-inspired — job card, accordion sections, resume selector, inline profile form

const DEFAULT_URL = "https://marketfit.app"
let appUrl      = DEFAULT_URL
let cachedProfile = null
let selectedResume = null   // { name, date, token }
let lastToken   = ""
let lastResumeName = "Resume"
let isTailoring = false
let detectedJob = null      // { title, company, url }
let renderedResumes = []    // the exact list currently shown (app + local, merged)

// ────────────────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get(["appUrl", "claudeKey"])
  appUrl = stored.appUrl || DEFAULT_URL

  // Sync URL fields
  setEl("setup-url-input", appUrl)
  setEl("sett-url", appUrl)
  setEl("sett-key", stored.claudeKey || "", "value")
  setHref("open-app-link", appUrl)
  setHref("open-app-t", appUrl + "/dashboard")
  setHref("jobs-link", appUrl + "/dashboard/jobs")

  // Tab switching
  document.querySelectorAll(".tab-pill").forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab))
  })

  // Header buttons
  on("btn-feedback",     () => chrome.tabs.create({ url: appUrl + "/feedback" }))
  on("btn-settings-icon",() => switchTab("settings"))
  on("btn-expand",       () => chrome.tabs.create({ url: appUrl + "/dashboard" }))

  // Status "Change" links
  on("s-change-f", () => switchTab("settings"))
  on("s-change-t", () => switchTab("settings"))

  // Accordion rows
  document.querySelectorAll(".accord-row").forEach(row => {
    row.addEventListener("click", () => toggleAccord(row))
  })

  // Profile form
  on("pf-save-btn", saveInlineProfile)
  on("pf-edit-btn", showProfileEditor)

  // Fill CTA
  on("autofill-main-btn", doQuickFill)
  on("continue-next-btn", scrollPageDown)
  on("autofill-another",  resetFillPanel)
  on("scan-cancel-btn",   resetFillPanel)

  // Resume + CL generation
  on("gen-resume-btn", generateResume)
  on("gen-cl-btn",     generateCoverLetter)

  // Setup
  on("connect-btn", saveSetupUrl)

  // Settings
  on("sett-save", saveSettings)

  // Tailor tab
  on("grab-btn",            grabJD)
  on("tailor-btn",          doTailor)
  on("btn-re-tailor",       () => showTailorInput())
  on("autofill-from-tailor",doAutoFillFromToken)

  document.getElementById("jd-input")?.addEventListener("input", onJdInput)

  // Check connectivity + auto-load profile
  await checkConnectivity()

  // Pull pending JD from content script (floating button case)
  try {
    const sess = await chrome.storage.session.get(["pendingJd", "onAppPage"])
    if (sess.pendingJd?.length > 50 && !sess.onAppPage) {
      switchTab("tailor")
      document.getElementById("jd-input").value = sess.pendingJd
      onJdInput()
      chrome.storage.session.remove(["pendingJd", "onAppPage"])
    }
  } catch {}
})

// ────────────────────────────────────────────────────────────────────────────
// TAB SWITCHING
// ────────────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll(".tab-pill").forEach(t =>
    t.classList.toggle("on", t.dataset.tab === tab)
  )
  hide("panel-setup"); hide("panel-fill"); hide("panel-tailor"); hide("panel-settings")

  if (tab === "fill")     show("panel-fill")
  else if (tab === "tailor")   show("panel-tailor")
  else if (tab === "settings") show("panel-settings")
}

// ────────────────────────────────────────────────────────────────────────────
// CONNECTIVITY
// ────────────────────────────────────────────────────────────────────────────

async function checkConnectivity() {
  updateStatus("connecting")
  let live = false
  try {
    const r = await fetch(appUrl + "/api/health", { signal: AbortSignal.timeout(3000) })
    if (r.ok) live = true
  } catch {}
  if (!live) {
    try {
      await fetch(appUrl, { signal: AbortSignal.timeout(3000), mode: "no-cors" })
      live = true
    } catch {}
  }

  if (live) {
    updateStatus("live")
    await loadFillPanel()
  } else {
    updateStatus("offline")
    showSetupPanel()
  }
  return live
}

function updateStatus(state) {
  const text = state === "live" ? appUrl
    : state === "connecting" ? "Connecting to " + appUrl + "…"
    : "Cannot reach " + appUrl + " — check connection or URL in Settings"
  const cls = state === "live" ? "s-dot live" : state === "offline" ? "s-dot err" : "s-dot"
  ;["s-dot-f","s-dot-t"].forEach(id => { const el = ge(id); if (el) el.className = cls })
  ;["s-url-f","s-url-t"].forEach(id => setEl(id, text))
}

function showSetupPanel() {
  hide("panel-fill"); hide("panel-tailor"); hide("panel-settings")
  show("panel-setup")
  document.querySelectorAll(".tab-pill").forEach(t => t.classList.remove("on"))
}

// ────────────────────────────────────────────────────────────────────────────
// FILL PANEL — main load sequence
// ────────────────────────────────────────────────────────────────────────────

async function loadFillPanel() {
  // Make sure the fill panel is visible (could have been hidden by showSetupPanel)
  hide("panel-setup"); hide("panel-tailor"); hide("panel-settings")
  show("panel-fill")
  document.querySelectorAll(".tab-pill").forEach(t =>
    t.classList.toggle("on", t.dataset.tab === "fill")
  )

  show("fill-loading")
  hide("fill-scanning"); hide("fill-job-card"); hide("fill-connections")
  hide("fill-noprofile"); hide("fill-cta"); hide("fill-progress")
  hide("accord-autofill"); hide("accord-resume"); hide("accord-cl"); hide("fill-nojob")

  // 1. Load profile
  await loadProfile()

  // 2. Detect job from current tab
  await detectCurrentJob()

  // 3. Load recent resumes
  await loadRecentResumes()

  hide("fill-loading")

  if (!cachedProfile) {
    // Show inline profile form
    show("fill-noprofile")
    if (detectedJob) { show("fill-job-card"); show("fill-connections") }
    return
  }

  // Profile exists — show full UI
  renderProfileInfo()
  show("fill-cta")
  show("accord-autofill"); show("accord-resume"); show("accord-cl")

  if (detectedJob) {
    renderJobCard()
    show("fill-job-card"); show("fill-connections")
  } else {
    show("fill-nojob")
  }

  // Enable fill button
  ge("autofill-main-btn").disabled = false
}

// ────────────────────────────────────────────────────────────────────────────
// PROFILE
// ────────────────────────────────────────────────────────────────────────────

async function loadProfile() {
  // A locally-saved profile is the source of truth — autofill works with NO login
  // and even if the app isn't running.
  try {
    const d = await chrome.storage.local.get(["mf_profile"])
    if (d.mf_profile && (d.mf_profile.full_name || d.mf_profile.email)) {
      cachedProfile = d.mf_profile
      return true
    }
  } catch {}
  // First run: prefill contact details from the app (extracted from the newest
  // résumé), then persist locally so it's editable and offline-safe. Attach the
  // signed-in session (set by web-bridge.js after login) if we have one, so this
  // pulls the user's real saved profile instead of an unauthenticated fallback.
  try {
    const s = await chrome.storage.local.get(["mf_session"])
    const token = s.mf_session?.access_token
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res  = await fetch(appUrl + "/api/profile", { signal: AbortSignal.timeout(6000), headers })
    const data = await res.json().catch(() => ({}))
    if (data.profile && (data.profile.full_name || data.profile.email)) {
      cachedProfile = data.profile
      try { await chrome.storage.local.set({ mf_profile: cachedProfile }) } catch {}
      return true
    }
  } catch {}
  return false
}

function renderProfileInfo() {
  const p   = cachedProfile || {}
  const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "—"
  const filled = [name, p.email, p.phone, p.location].filter(Boolean)

  // Sub-text on accordion
  setEl("autofill-sub", name + (p.title ? " · " + p.title : ""))

  // Detailed info inside accordion body
  const info = ge("autofill-info-display")
  if (info) {
    info.innerHTML = [
      ["Name",     name],
      ["Email",    p.email     || "—"],
      ["Phone",    p.phone     || "—"],
      ["Location", p.location  || "—"],
      ["LinkedIn", p.linkedin  || "—"],
      ["Visa",     p.visa_status || p.work_auth?.[0] || "—"],
    ].map(([k, v]) =>
      `<div style="display:flex;gap:6px;padding:3px 0"><span style="font-weight:600;width:60px;color:var(--text-muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em">${k}</span><span>${escHtml(String(v))}</span></div>`
    ).join("")
  }

  // Show/hide red dot
  const incomplete = filled.length < 3
  ge("autofill-badge")?.classList.toggle("hidden", !incomplete)
}

// Prefill the inline form inputs from the current profile (used when editing).
function prefillProfileForm() {
  const p = cachedProfile || {}
  const set = (id, v) => { const el = ge(id); if (el) el.value = v || "" }
  const nameParts = (p.full_name || "").split(/\s+/)
  set("pf-first", p.first_name || nameParts[0] || "")
  set("pf-last",  p.last_name  || nameParts.slice(1).join(" ") || "")
  set("pf-email", p.email)
  set("pf-phone", p.phone)
  set("pf-loc",   p.location)
  set("pf-linkedin", p.linkedin)
  set("pf-portfolio", p.portfolio || p.github)
  const wa = ge("pf-workauth")
  if (wa) wa.value = (Array.isArray(p.work_auth) ? p.work_auth[0] : p.work_auth) || p.visa_status || ""
}

// Reveal the inline profile form to edit an existing (possibly sparse) profile.
function showProfileEditor() {
  prefillProfileForm()
  hide("fill-cta"); hide("accord-autofill"); hide("accord-resume"); hide("accord-cl")
  hide("fill-job-card"); hide("fill-connections"); hide("fill-nojob")
  const msg = ge("pf-msg"); if (msg) msg.textContent = ""
  show("fill-noprofile")
}

async function saveInlineProfile() {
  const btn = ge("pf-save-btn")
  btn.textContent = "Saving…"; btn.disabled = true
  const pf_msg = ge("pf-msg")

  const first     = ge("pf-first")?.value.trim()     || ""
  const last      = ge("pf-last")?.value.trim()      || ""
  const email     = ge("pf-email")?.value.trim()     || ""
  const phone     = ge("pf-phone")?.value.trim()     || ""
  const location  = ge("pf-loc")?.value.trim()       || ""
  const linkedin  = ge("pf-linkedin")?.value.trim()  || ""
  const workauth  = ge("pf-workauth")?.value.trim()  || ""
  const portfolio = ge("pf-portfolio")?.value.trim() || ""

  if (!first || !email) {
    pf_msg.style.color = "var(--red)"
    pf_msg.textContent = "First name and email are required."
    btn.textContent = "Save & Continue →"; btn.disabled = false
    return
  }

  // Merge over anything already known (keeps title/skills the app extracted) and
  // save LOCALLY — no login required, persists on this device, powers every autofill.
  cachedProfile = {
    ...(cachedProfile || {}),
    full_name: (first + " " + last).trim(),
    first_name: first, last_name: last,
    email, phone, location, linkedin,
    ...(workauth  ? { work_auth: [workauth], visa_status: workauth } : {}),
    ...(portfolio ? { portfolio } : {}),
  }
  try { await chrome.storage.local.set({ mf_profile: cachedProfile }) } catch {}

  pf_msg.style.color = "var(--green)"
  pf_msg.textContent = "✓ Saved on this device."
  await new Promise(r => setTimeout(r, 500))
  hide("fill-noprofile")
  renderProfileInfo()
  show("fill-cta"); show("accord-autofill"); show("accord-resume"); show("accord-cl")
  ge("autofill-main-btn").disabled = false
  if (detectedJob) { show("fill-job-card"); show("fill-connections") }
  else { show("fill-nojob") }
  btn.textContent = "Save & Continue →"; btn.disabled = false
}

// ────────────────────────────────────────────────────────────────────────────
// JOB DETECTION
// ────────────────────────────────────────────────────────────────────────────

async function detectCurrentJob() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome")) return

    let result
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_JOB" })
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      await new Promise(r => setTimeout(r, 250))
      result = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_JOB" })
    }

    if (result?.title) {
      detectedJob = { title: result.title, company: result.company || "", url: tab.url }
    }
  } catch {}
}

function renderJobCard() {
  if (!detectedJob) return
  setEl("jc-title", detectedJob.title)
  setEl("jc-company", detectedJob.company || extractDomain())
  setEl("jc-industry", detectedJob.industry || "")
  setEl("jc-meta", detectedJob.meta || "")

  // Compute match score from profile skills vs job title keywords
  const score = computeMatchScore(detectedJob.title + " " + (detectedJob.description || ""))
  const badge = ge("jc-match")
  badge.textContent = score + "%"
  badge.className = "match-pct" + (score >= 75 ? "" : score >= 55 ? " mid" : " low")

  // Render connection avatars (decorative — use initials from profile)
  const pills = ge("conn-pills")
  if (pills && cachedProfile) {
    const colors = ["#16a34a","#2563eb","#d97706","#7c3aed","#dc2626"]
    const initials = (cachedProfile.full_name || "U").split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase()
    pills.innerHTML = [initials, "L", "K", "S", "W"].slice(0, 4).map((l, i) =>
      `<div class="conn-av" style="background:${colors[i % colors.length]}">${l}</div>`
    ).join("")
  }
}

function computeMatchScore(jobText) {
  if (!cachedProfile) return 0
  const skills = [
    ...(cachedProfile.skills || []),
    cachedProfile.title || "",
    ...(cachedProfile.work_auth || []),
  ].join(" ").toLowerCase()
  const jt = jobText.toLowerCase()
  const keywords = skills.split(/\W+/).filter(w => w.length > 3)
  if (!keywords.length) return 72  // default decent score
  const hits = keywords.filter(k => jt.includes(k)).length
  return Math.min(98, Math.max(45, Math.round(40 + (hits / Math.max(keywords.length, 1)) * 55)))
}

function extractDomain() {
  // detectedJob.url is captured in detectCurrentJob(); chrome.tabs.query is async
  // in MV3 so the old sync `[tab] = query(...)` always yielded undefined.
  try {
    return new URL(detectedJob?.url || "").hostname.replace("www.", "")
  } catch { return "Job Board" }
}

// ────────────────────────────────────────────────────────────────────────────
// RECENT RESUMES
// ────────────────────────────────────────────────────────────────────────────

async function loadRecentResumes() {
  let resumes = []
  // Try loading from chrome.storage.local first (extension-level cache)
  try {
    const data = await chrome.storage.local.get(["recentResumes"])
    resumes = data.recentResumes || []
  } catch {}

  // Also try loading from app (if it has generated resumes)
  try {
    const res  = await fetch(appUrl + "/api/resumes/recent?limit=3", { signal: AbortSignal.timeout(4000) })
    if (res.ok) {
      const data = await res.json()
      const appResumes = (data.resumes || []).map(r => ({
        name: r.name || r.filename || "Resume",
        date: r.created_at || r.date || new Date().toISOString(),
        token: r.token || "",
        role: r.role || "",
      }))
      // Merge and de-dupe by name
      const merged = [...appResumes]
      for (const r of resumes) {
        if (!merged.find(m => m.name === r.name)) merged.push(r)
      }
      resumes = merged.slice(0, 3)
    }
  } catch {}

  renderResumeList(resumes)
}

function renderResumeList(resumes) {
  const list = ge("resume-list")
  if (!list) return

  // Remember exactly what we render so selectResume() indexes the SAME list
  // (the displayed list is app+local merged; chrome.storage.local holds only local).
  renderedResumes = resumes.slice(0, 3)

  if (!resumes.length) {
    list.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);padding:4px 0 8px">No resumes yet. Generate one below.</div>`
    return
  }

  list.innerHTML = resumes.slice(0, 3).map((r, i) => {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
    return `
    <div class="resume-item${i === 0 ? " sel" : ""}" data-index="${i}" onclick="selectResume(${i})">
      <div class="resume-thumb">📄</div>
      <div class="resume-info">
        <div class="resume-name">${escHtml(r.name)}</div>
        <div class="resume-date">${r.role ? escHtml(r.role) + " · " : ""}${dateStr}</div>
      </div>
      <div class="resume-sel-dot"></div>
    </div>`
  }).join("")

  // Auto-select first
  if (resumes.length) {
    selectedResume = resumes[0]
    updateResumeAccordionLabel(resumes[0].name)
  }
}

function selectResume(index) {
  document.querySelectorAll(".resume-item").forEach((el, i) => {
    el.classList.toggle("sel", i === index)
  })
  // Index into the list we actually rendered, not chrome.storage.local — they can
  // differ (the rendered list merges app-generated resumes with local ones).
  selectedResume = renderedResumes[index] || null
  if (selectedResume) updateResumeAccordionLabel(selectedResume.name)
}

function updateResumeAccordionLabel(name) {
  const chip = ge("resume-chip")
  const sub  = ge("resume-accord-sub")
  if (chip) { chip.textContent = name; chip.classList.remove("hidden") }
  if (sub)  { sub.textContent = name }
  ge("resume-badge")?.classList.remove("hidden")
}

// Store a newly generated resume at the front of the list
async function addToRecentResumes(resume) {
  try {
    const data = await chrome.storage.local.get(["recentResumes"])
    let list = data.recentResumes || []
    // Remove duplicate by name
    list = list.filter(r => r.name !== resume.name)
    list.unshift(resume)
    await chrome.storage.local.set({ recentResumes: list.slice(0, 10) })
    renderResumeList(list.slice(0, 3))
  } catch {}
}

// ────────────────────────────────────────────────────────────────────────────
// QUICK FILL (autofill from profile)
// ────────────────────────────────────────────────────────────────────────────

async function doQuickFill() {
  const btn = ge("autofill-main-btn")
  const alert = ge("fill-main-alert")
  btn.disabled  = true
  btn.textContent = "Scanning page…"
  alert.className = "hidden"

  // Show AI scanning state
  hide("fill-cta")
  show("fill-scanning")

  try {
    if (!cachedProfile) {
      const ok = await loadProfile()
      if (!ok) throw new Error("Profile not found. Fill in your profile first.")
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error("No active tab found.")

    // Build a download URL for the selected resume so content.js can attach the
    // actual .docx to the form's file input (the missing half of one-click apply).
    const resumeToken = selectedResume?.token || ""
    const resumeName  = selectedResume?.name  || "Resume"
    const resumeUrl   = resumeToken
      ? `${appUrl}/api/tailor/file?token=${encodeURIComponent(resumeToken)}&fmt=docx&name=${encodeURIComponent(resumeName)}`
      : ""

    const msg = { type: "AUTOFILL", profile: cachedProfile, resumeToken, resumeUrl, resumeName }

    let resp
    try {
      resp = await chrome.tabs.sendMessage(tab.id, msg)
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      await new Promise(r => setTimeout(r, 350))
      resp = await chrome.tabs.sendMessage(tab.id, msg)
    }

    hide("fill-scanning")

    const filled         = resp?.filled   ?? 0
    const required       = resp?.required ?? filled
    const fields         = resp?.fields   ?? []
    const optional       = resp?.optional ?? []
    const needsAttention = resp?.needsAttention ?? []

    // A form can be "correctly handled" with zero auto-filled fields — e.g. a
    // page that's ENTIRELY sponsorship/EEO questions we deliberately never
    // guess at. Only show the "no fillable fields" error when there's truly
    // nothing to report at all.
    if (filled > 0 || needsAttention.length > 0) {
      showFillProgress(filled, required, fields, optional, needsAttention)
      if (resp?.resumeAttached) {
        alert.className = "alert alert-ok"
        alert.textContent = "📎 Resume attached. Review every field before you submit."
        alert.classList.remove("hidden")
      }
    } else {
      show("fill-cta")
      btn.disabled  = false
      btn.textContent = "⚡ Account Creation & Autofill"
      alert.className = "alert alert-err"
      alert.textContent = "No fillable fields found on this page. Navigate to an application form."
      alert.classList.remove("hidden")
    }

  } catch (e) {
    hide("fill-scanning")
    show("fill-cta")
    btn.disabled  = false
    btn.textContent = "⚡ Account Creation & Autofill"
    alert.className = "alert alert-err"
    alert.textContent = "✗ " + (e.message || "Could not fill the form.")
    alert.classList.remove("hidden")
  }
}

function showFillProgress(filled, required, fields, optional, needsAttention = []) {
  const pct = required > 0 ? Math.round((filled / required) * 100) : 100

  setEl("fp-label", `${filled}/${required} required fields filled`)
  setEl("fp-pct", pct + "%")
  ge("fp-bar").style.width = pct + "%"

  // Build checklist
  const list = ge("fp-list")
  if (list) {
    let html = ""
    if (fields.length) {
      html += `<div class="fp-section">Required</div>`
      html += fields.map(f =>
        `<div class="fp-row"><span class="ok">●</span><span>${escHtml(f)}</span></div>`
      ).join("")
    }
    if (optional.length) {
      html += `<div class="fp-section">Optional</div>`
      html += optional.map(f =>
        `<div class="fp-row"><span class="skip">—</span><span style="color:var(--text-muted)">${escHtml(f)}</span></div>`
      ).join("")
    }
    // Sponsorship / EEO / nuanced work-status questions we deliberately never
    // auto-answer — surfaced so the user doesn't miss them before submitting.
    if (needsAttention.length) {
      html += `<div class="fp-section" style="color:#d97706">Needs your review</div>`
      html += needsAttention.map(f =>
        `<div class="fp-row"><span style="color:#d97706">⚠</span><span style="color:#92400e">${escHtml(f)}</span></div>`
      ).join("")
    }
    list.innerHTML = html
  }

  show("fill-progress")
  hide("fill-cta")
  hide("fill-nojob")
}

function resetFillPanel() {
  hide("fill-scanning"); hide("fill-progress")
  ge("autofill-main-btn").disabled = false
  ge("autofill-main-btn").textContent = "⚡ Account Creation & Autofill"
  ge("fill-main-alert").className = "hidden"
  if (cachedProfile) {
    show("fill-cta")
  }
}

function scrollPageDown() {
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" }),
      })
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATE RESUME
// ────────────────────────────────────────────────────────────────────────────

async function generateResume() {
  const btn = ge("gen-resume-btn")
  const msg = ge("gen-resume-msg")
  btn.disabled = true
  btn.innerHTML = '<span class="spin">⟳</span> Generating…'
  msg.className = ""
  msg.innerHTML = ""

  try {
    // Get JD from page or use job title
    const jd = detectedJob ? (detectedJob.title + " " + (detectedJob.description || "")) : ""
    const role = detectedJob?.title || "Custom Role"

    const res = await fetch(appUrl + "/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd: jd || role, filepath: "", claudeKey: "" }),
      signal: AbortSignal.timeout(90000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "Generation failed")

    const token    = data.token || ""
    const filename = data.matched?.filename || ("Resume — " + role)
    const newResume = { name: filename, date: new Date().toISOString(), token, role }

    await addToRecentResumes(newResume)
    selectedResume = newResume
    updateResumeAccordionLabel(filename)

    // Set download link
    const base = appUrl + "/api/tailor/file"
    const link = `${base}?token=${encodeURIComponent(token)}&fmt=docx&name=${encodeURIComponent(filename)}`
    msg.innerHTML = `<div class="alert alert-ok">✓ Resume generated — <a href="${link}" target="_blank" download style="color:var(--green-txt);font-weight:700">Download .docx</a></div>`
    btn.disabled  = false
    btn.innerHTML = "✦ Generate Another"

  } catch (e) {
    msg.innerHTML = `<div class="alert alert-err">✗ ${escHtml(e.message || "Generation failed. Is MarketFit running?")}</div>`
    btn.disabled  = false
    btn.innerHTML = "✦ Generate Custom Resume for This Role"
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATE COVER LETTER
// ────────────────────────────────────────────────────────────────────────────

async function generateCoverLetter() {
  const btn = ge("gen-cl-btn")
  const msg = ge("gen-cl-msg")
  btn.disabled = true
  btn.innerHTML = '<span class="spin">⟳</span> Generating…'
  msg.className = ""
  msg.innerHTML = ""

  try {
    const jd   = detectedJob?.title || "this role"
    const res  = await fetch(appUrl + "/api/cover-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd, profile: cachedProfile }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error("Generation failed")
    const data = await res.json().catch(() => ({}))
    const token = data.token || ""
    const name  = "Cover Letter — " + (detectedJob?.company || "Role")

    ge("cl-sub").textContent = name
    ge("cl-badge")?.classList.remove("hidden")

    const base = appUrl + "/api/tailor/file"
    const link = token ? `${base}?token=${encodeURIComponent(token)}&fmt=docx&name=${encodeURIComponent(name)}` : "#"
    msg.innerHTML = `<div class="alert alert-ok">✓ Cover letter ready — <a href="${link}" target="_blank" download style="color:var(--green-txt);font-weight:700">Download</a></div>`
    btn.disabled  = false
    btn.innerHTML = "✦ Regenerate Cover Letter"
  } catch (e) {
    msg.innerHTML = `<div class="alert alert-err">✗ ${escHtml(e.message || "Could not generate cover letter")}</div>`
    btn.disabled  = false
    btn.innerHTML = "✦ Generate Cover Letter for This Role"
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ACCORDION
// ────────────────────────────────────────────────────────────────────────────

function toggleAccord(row) {
  const bodyId = row.dataset.body
  const body   = ge(bodyId)
  if (!body) return
  const isOpen = body.classList.contains("open")
  body.classList.toggle("open", !isOpen)
  row.classList.toggle("open", !isOpen)
}

// ────────────────────────────────────────────────────────────────────────────
// SETUP
// ────────────────────────────────────────────────────────────────────────────

async function saveSetupUrl() {
  const val = ge("setup-url-input")?.value.trim().replace(/\/$/, "")
  if (!val) return
  appUrl = val
  await chrome.storage.sync.set({ appUrl })
  ge("sett-url") && (ge("sett-url").value = appUrl)
  setHref("open-app-link", appUrl)
  setHref("open-app-t", appUrl + "/dashboard")
  setHref("jobs-link", appUrl + "/dashboard/jobs")
  const msg = ge("setup-msg")
  msg.style.color = "var(--text-soft)"; msg.textContent = "Checking connection…"
  const live = await checkConnectivity()
  if (!live) {
    msg.style.color = "var(--red)"
    msg.textContent = "✗ Could not reach " + appUrl
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────────────────────

async function saveSettings() {
  const url = ge("sett-url")?.value.trim().replace(/\/$/, "") || appUrl
  const key = ge("sett-key")?.value.trim() || ""
  appUrl = url
  const toSave = { appUrl: url }
  if (key) toSave.claudeKey = key
  await chrome.storage.sync.set(toSave)
  setHref("open-app-link", appUrl)
  setHref("open-app-t", appUrl + "/dashboard")
  setHref("jobs-link", appUrl + "/dashboard/jobs")
  const msg = ge("sett-msg")
  msg.style.color = "var(--green)"; msg.textContent = "✓ Saved — checking connection…"
  await checkConnectivity()
  setTimeout(() => { msg.textContent = ""; msg.style.color = "" }, 3000)
}

// ────────────────────────────────────────────────────────────────────────────
// TAILOR — Grab JD
// ────────────────────────────────────────────────────────────────────────────

async function grabJD() {
  const btn = ge("grab-btn")
  btn.disabled  = true
  btn.innerHTML = '<span class="spin">⟳</span> Grabbing…'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error("No active tab")
    let jd = ""
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_JD" })
      jd = res?.jd || ""
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      await new Promise(r => setTimeout(r, 300))
      const res = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_JD" })
      jd = res?.jd || ""
    }
    if (jd?.length > 50) {
      ge("jd-input").value = jd
      onJdInput()
      showTailorMsg("ok", `✓ Grabbed ${jd.length} characters from the page.`)
    } else {
      showTailorMsg("error", "Couldn't extract the JD from this page. Paste it manually.")
    }
  } catch {
    showTailorMsg("error", "Could not read this page. Try pasting the JD manually.")
  }
  btn.disabled  = false
  btn.innerHTML = "⚡ Grab from page"
}

function onJdInput() {
  const val = ge("jd-input")?.value || ""
  const len = val.trim().length
  const cc  = ge("char-count")
  if (cc) cc.textContent = len + " characters"
  ge("tailor-btn") && (ge("tailor-btn").disabled = len < 50 || isTailoring)
}

// ────────────────────────────────────────────────────────────────────────────
// TAILOR — AI resume generation
// ────────────────────────────────────────────────────────────────────────────

async function doTailor() {
  const jd = ge("jd-input")?.value.trim()
  if (!jd || jd.length < 50) {
    showTailorMsg("error", "Paste a job description (at least a few lines) first.")
    return
  }
  if (isTailoring) return

  isTailoring = true
  clearTailorMsg()
  setTailorProgress(0, "")
  showTailorProgressUI(true)

  const btn = ge("tailor-btn")
  btn.disabled  = true
  btn.innerHTML = '<span class="spin">⟳</span> Tailoring your resume…'

  const steps = [
    [800,  15, "Reading job description keywords…"],
    [2500, 35, "Matching best resume from library…"],
    [5000, 55, "Rewriting experience bullets…"],
    [9000, 72, "Updating skills & summary…"],
    [14000,85, "Finalizing your tailored resume…"],
    [20000,92, "Generating document…"],
  ]
  const timers = steps.map(([d, p, m]) => setTimeout(() => setTailorProgress(p, m), d))

  let claudeKey = ""
  try { const s = await chrome.storage.sync.get(["claudeKey"]); claudeKey = s.claudeKey || "" } catch {}

  try {
    const res = await fetch(appUrl + "/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd, filepath: "", claudeKey }),
      signal: AbortSignal.timeout(90000),
    })
    timers.forEach(clearTimeout)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showTailorMsg("error", data.error || "Tailoring failed. Check that MarketFit is running.")
      resetTailorBtn(); return
    }
    setTailorProgress(100, "Done! ✓")
    lastToken      = data.token || ""
    lastResumeName = data.matched?.filename || "Resume"
    await addToRecentResumes({ name: lastResumeName, date: new Date().toISOString(), token: lastToken, role: data.matched?.category || "" })
    await new Promise(r => setTimeout(r, 600))
    showTailorResult({ token: lastToken, name: lastResumeName, category: data.matched?.category || "", score: data.score || 85 })
  } catch (e) {
    timers.forEach(clearTimeout)
    const msg = String(e).includes("abort") || String(e).includes("timeout")
      ? "Request timed out. AI tailoring can take up to 30s — try again."
      : "Connection error. Make sure MarketFit is running at " + appUrl
    showTailorMsg("error", msg)
    resetTailorBtn()
  }
}

function setTailorProgress(pct, msg) {
  const pb = ge("prog-bar"); const pm = ge("prog-msg")
  if (pb) pb.style.width = pct + "%"
  if (pm) pm.textContent  = msg
}
function showTailorProgressUI(show) {
  ge("prog-wrap")?.classList.toggle("hidden", !show)
  ge("prog-msg")?.classList.toggle("hidden", !show)
}
function resetTailorBtn() {
  isTailoring = false
  showTailorProgressUI(false)
  const btn = ge("tailor-btn")
  if (btn) { btn.disabled = false; btn.innerHTML = "✨ Tailor & Download Resume" }
}
function showTailorInput() {
  isTailoring = false
  showTailorProgressUI(false)
  show("tailor-input-view"); hide("tailor-result-view")
  const btn = ge("tailor-btn")
  if (btn) { btn.disabled = false; btn.innerHTML = "✨ Tailor & Download Resume" }
  ge("jd-input") && (ge("jd-input").value = "")
  onJdInput()
}

function showTailorResult({ token, name, category, score }) {
  // Arc
  const arc = ge("r-arc")
  if (arc) {
    const r = 23; const c = 2 * Math.PI * r
    arc.setAttribute("stroke-dasharray", `${(score / 100) * c} ${c}`)
    arc.setAttribute("stroke", score >= 90 ? "#16a34a" : score >= 80 ? "#1d6fc4" : "#d97706")
  }
  setEl("r-score", score)
  setEl("r-name", name)
  setEl("r-cat", category.split(" / ").pop())

  const base  = appUrl + "/api/tailor/file"
  const tok   = encodeURIComponent(token)
  const ename = encodeURIComponent(name)
  const docx  = ge("dl-docx"); const pdf = ge("dl-pdf")
  if (docx) { docx.href = `${base}?token=${tok}&fmt=docx&name=${ename}`; docx.download = name + ".docx" }
  if (pdf)  { pdf.href  = `${base}?token=${tok}&fmt=pdf&name=${ename}` }

  show("tailor-result-view"); hide("tailor-input-view")
}

// ────────────────────────────────────────────────────────────────────────────
// AUTOFILL FROM TAILOR TOKEN
// ────────────────────────────────────────────────────────────────────────────

async function doAutoFillFromToken() {
  const btn  = ge("autofill-from-tailor")
  const res2 = ge("tailor-fill-result")
  btn.disabled = true
  btn.textContent = "Filling…"
  res2.className = ""
  res2.innerHTML = ""

  try {
    // Same session header as the /api/profile call above. That route no longer
    // serves resume-derived data to anonymous callers — the ?token= branch used
    // to reach the tailored-output directory with no auth and no allow-list.
    const s2 = await chrome.storage.local.get(["mf_session"])
    const tok2 = s2.mf_session?.access_token
    const res = await fetch(`${appUrl}/api/profile?token=${encodeURIComponent(lastToken)}`, {
      signal: AbortSignal.timeout(10000),
      headers: tok2 ? { Authorization: `Bearer ${tok2}` } : {},
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) throw new Error("Sign in to the dashboard first, then retry.")
    if (!res.ok || !data.profile) throw new Error(data.error || "Could not fetch profile")

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error("No active tab")

    // We just tailored this resume — attach that exact .docx to the form too.
    const resumeUrl = `${appUrl}/api/tailor/file?token=${encodeURIComponent(lastToken)}&fmt=docx&name=Resume`
    const msg = { type: "AUTOFILL", profile: data.profile, resumeUrl, resumeName: "Resume" }

    let resp
    try {
      resp = await chrome.tabs.sendMessage(tab.id, msg)
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      await new Promise(r => setTimeout(r, 300))
      resp = await chrome.tabs.sendMessage(tab.id, msg)
    }

    const count = resp?.filled ?? 0
    const attached = resp?.resumeAttached ? " 📎 Resume attached." : ""
    res2.className = "alert " + (count > 0 ? "alert-ok" : "alert-err")
    res2.textContent = count > 0 ? `✓ Filled ${count} fields.${attached} Review before submitting.` : "No fillable fields found on this page."
    if (count > 0) { btn.textContent = "✓ Filled"; }
    else { btn.disabled = false; btn.textContent = "⚡ Auto-fill Application" }
  } catch (e) {
    ge("tailor-fill-result").className = "alert alert-err"
    ge("tailor-fill-result").textContent = "✗ " + (e.message || "Fill failed")
    btn.disabled  = false
    btn.textContent = "⚡ Auto-fill Application"
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TAILOR MSG HELPERS
// ────────────────────────────────────────────────────────────────────────────

function showTailorMsg(type, text) {
  const el = ge("tailor-msg-area")
  if (!el) return
  el.className   = "alert " + (type === "error" ? "alert-err" : "alert-ok")
  el.textContent = text
}
function clearTailorMsg() {
  const el = ge("tailor-msg-area")
  if (el) { el.className = ""; el.textContent = "" }
}

// ────────────────────────────────────────────────────────────────────────────
// UTILS
// ────────────────────────────────────────────────────────────────────────────

function ge(id) { return document.getElementById(id) }
function show(id) { ge(id)?.classList.remove("hidden") }
function hide(id) { ge(id)?.classList.add("hidden") }
function on(id, fn) { ge(id)?.addEventListener("click", fn) }
function setEl(id, text) {
  const el = ge(id); if (!el) return
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = String(text)
  else el.textContent = text
}
function setHref(id, href) { const el = ge(id); if (el) el.href = href }
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}
