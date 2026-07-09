/* ════════════════════════════════════════════════════════
   CareerKit — app.js
   4 tabs: Jobs · Library · Tailor · Tracker
══════════════════════════════════════════════════════════ */

/* ── Tab switching ──────────────────────────────────────────────────────────── */
const TAB_IDS = ["jobs", "library", "tailor", "tracker"];

const tabPanels = Object.fromEntries(
  TAB_IDS.map(id => [id, document.getElementById(`tab-${id}`)])
);

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    TAB_IDS.forEach(id => { tabPanels[id].hidden = true; });
    tabPanels[tab].hidden = false;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (tab === "jobs")    loadJobs();
    if (tab === "library") loadLibrary();
    if (tab === "tailor")  loadSelectOptions();
    if (tab === "tracker") loadTracker();
  });
});

/* ── Toast ──────────────────────────────────────────────────────────────────── */
const toast = document.getElementById("toast");
let toastTimer;

function showToast(msg, type = "info") {
  toast.textContent = msg;
  toast.className = "toast show" + (type === "error" ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}

/* ════════════════════════════════════════════════════════
   JOBS TAB
══════════════════════════════════════════════════════════ */

let allJobs = [];
let jobsFilter = "all";
let jobsQuery  = "";
let savedJobIds = new Set(JSON.parse(localStorage.getItem("savedJobs") || "[]"));

const jobsLoading  = document.getElementById("jobs-loading");
const jobsGrid     = document.getElementById("jobs-grid");
const jobsEmpty    = document.getElementById("jobs-empty");
const jobsStats    = document.getElementById("jobs-stats");
const jobsCount    = document.getElementById("jobs-showing-count");
const jobsSource   = document.getElementById("jobs-source-label");
const jobsBadge    = document.getElementById("jobs-count-badge");

// Filter chips
document.getElementById("visa-filters").querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    jobsFilter = chip.dataset.filter;
    renderJobs();
  });
});

// Search
document.getElementById("jobs-search").addEventListener("input", e => {
  jobsQuery = e.target.value.toLowerCase();
  renderJobs();
});

async function loadJobs(force = false) {
  if (allJobs.length && !force) { renderJobs(); return; }

  jobsLoading.style.display = "grid";
  jobsGrid.style.display = "none";
  jobsEmpty.hidden = true;
  jobsStats.style.display = "none";

  try {
    const res = await fetch("/api/jobs");
    allJobs = await res.json();
    jobsSource.textContent = allJobs.length > 5 ? `Live · ${allJobs.length} jobs` : "Sample data";
  } catch {
    allJobs = [];
    jobsSource.textContent = "Offline";
  }

  jobsLoading.style.display = "none";
  jobsStats.style.display = "flex";
  renderJobs();
}

function renderJobs() {
  const q = jobsQuery;
  const f = jobsFilter;

  const visible = allJobs.filter(j => {
    if (f === "h1b")    return j.visa?.h1b;
    if (f === "gc")     return j.visa?.gc;
    if (f === "opt")    return j.visa?.opt;
    if (f === "c2c")    return j.visa?.c2c;
    if (f === "remote") return j.remote;
    return true;
  }).filter(j => {
    if (!q) return true;
    const haystack = [j.title, j.company, j.location, ...(j.tags || [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  jobsCount.textContent = `${visible.length} job${visible.length !== 1 ? "s" : ""}`;

  if (!visible.length) {
    jobsGrid.style.display = "none";
    jobsEmpty.hidden = false;
    return;
  }

  jobsEmpty.hidden = true;
  jobsGrid.style.display = "grid";
  jobsGrid.innerHTML = "";

  visible.forEach((j, idx) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.style.animationDelay = `${Math.min(idx * 0.04, 0.4)}s`;

    const isSaved = savedJobIds.has(String(j.id));
    const logoHtml = j.logo
      ? `<img src="${j.logo}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<span>${(j.company || "?")[0].toUpperCase()}</span>`;

    const visaBadges = [
      j.visa?.h1b && `<span class="visa-badge vb-h1b">H1B</span>`,
      j.visa?.gc  && `<span class="visa-badge vb-gc">GC</span>`,
      j.visa?.opt && `<span class="visa-badge vb-opt">OPT</span>`,
      j.visa?.c2c && `<span class="visa-badge vb-c2c">C2C</span>`,
      j.remote    && `<span class="visa-badge vb-remote">Remote</span>`,
    ].filter(Boolean).join("");

    const atsLabel = j.ats !== "unknown" ? `<span class="ats-badge">${j.ats}</span>` : "";
    const salary   = j.salary ? `<span class="job-salary">${j.salary}</span>` : "";

    card.innerHTML = `
      <div class="job-card-top">
        <div class="job-logo">${logoHtml}</div>
        <div class="job-meta">
          <div class="job-title">${esc(j.title)}</div>
          <div class="job-company">${esc(j.company)}</div>
          <div class="job-location">${esc(j.location)}</div>
        </div>
      </div>
      <div class="job-tags">
        ${(j.tags || []).map(t => `<span class="job-tag">${esc(t)}</span>`).join("")}
      </div>
      <div class="job-footer">
        <div class="visa-badges">${visaBadges}</div>
        ${atsLabel}
        ${salary}
      </div>
      <div class="job-actions">
        <a href="${j.url}" target="_blank" rel="noopener" class="btn btn-apply-ext">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Apply
        </a>
        <button class="btn btn-save-job ${isSaved ? "saved" : ""}" data-job-idx="${idx}" title="${isSaved ? "Remove from saved" : "Save job"}">
          <svg viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          ${isSaved ? "Saved" : "Save"}
        </button>
        <button class="btn btn-ghost btn-sm" data-job-idx="${idx}" data-action="track">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Track
        </button>
      </div>`;

    // Save job
    card.querySelector(".btn-save-job").addEventListener("click", () => {
      const id = String(j.id);
      if (savedJobIds.has(id)) savedJobIds.delete(id);
      else savedJobIds.add(id);
      localStorage.setItem("savedJobs", JSON.stringify([...savedJobIds]));
      renderJobs();
    });

    // Track job
    card.querySelector("[data-action='track']").addEventListener("click", () => {
      openAppModal({ title: j.title, company: j.company, url: j.url, salary: j.salary, location: j.location, ats: j.ats });
    });

    jobsGrid.appendChild(card);
  });

  // Update badge
  const count = allJobs.length;
  if (count > 0) {
    jobsBadge.textContent = count;
    jobsBadge.style.display = "flex";
  }
}

/* ════════════════════════════════════════════════════════
   LIBRARY TAB
══════════════════════════════════════════════════════════ */

const fileInput   = document.getElementById("file-input");
const dropZone    = document.getElementById("drop-zone");
const resumeGrid  = document.getElementById("resume-grid");
const libEmpty    = document.getElementById("library-empty");
const uploadProg  = document.getElementById("upload-progress");
const progFill    = document.getElementById("progress-fill");
const progLabel   = document.getElementById("progress-label");

dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  uploadFiles([...e.dataTransfer.files]);
});
dropZone.addEventListener("click", e => {
  if (e.target.tagName !== "LABEL" && e.target.tagName !== "INPUT") fileInput.click();
});
fileInput.addEventListener("change", () => uploadFiles([...fileInput.files]));

async function uploadFiles(files) {
  const docx = files.filter(f => f.name.endsWith(".docx"));
  if (!docx.length) { showToast("Please upload .docx files", "error"); return; }

  uploadProg.hidden = false;
  let done = 0;

  for (const file of docx) {
    progLabel.textContent = `Uploading ${file.name}…`;
    progFill.style.width = `${Math.round((done / docx.length) * 100)}%`;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/resumes/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.tagging ? `"${file.name}" uploaded — tagging in background…` : `"${file.name}" uploaded`);
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, "error");
    }
    done++;
  }

  progFill.style.width = "100%";
  progLabel.textContent = "Done!";
  setTimeout(() => { uploadProg.hidden = true; progFill.style.width = "0%"; }, 1200);
  fileInput.value = "";
  loadLibrary();
}

async function loadLibrary() {
  const res  = await fetch("/api/resumes");
  const rows = await res.json();

  resumeGrid.innerHTML = "";
  libEmpty.hidden = rows.length > 0;

  if (rows.some(r => !r.tagged_at && window.HAS_KEY)) setTimeout(loadLibrary, 4000);

  rows.forEach(r => {
    const keywords = r.keywords ? JSON.parse(r.keywords) : [];
    const card = document.createElement("div");
    card.className = "resume-card";
    card.innerHTML = `
      <div class="resume-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="resume-card-name">${esc(r.filename)}</div>
      <div class="resume-card-tags">
        ${r.tagged_at
          ? `<span class="tag tag-domain">${esc(r.domain || "Other")}</span>`
          : `<span class="tag tag-tagging">${window.HAS_KEY ? "tagging…" : "needs key"}</span>`}
      </div>
      <div class="resume-card-footer">
        <span class="resume-card-keywords">${keywords.slice(0, 5).join(" · ")}</span>
        <button class="btn-delete" data-id="${r.id}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>`;
    resumeGrid.appendChild(card);
  });

  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      await fetch(`/api/resumes/${btn.dataset.id}`, { method: "DELETE" });
      showToast("Resume removed");
      loadLibrary();
    });
  });
}

loadLibrary();

/* ════════════════════════════════════════════════════════
   TAILOR TAB
══════════════════════════════════════════════════════════ */

const jdInput       = document.getElementById("jd-input");
const resumeSelect  = document.getElementById("resume-select");
const tailorBtn     = document.getElementById("tailor-btn");
const resultIdle    = document.getElementById("result-idle");
const resultLoading = document.getElementById("result-loading");
const resultCard    = document.getElementById("result-card");

const ringFill       = document.getElementById("ring-fill");
const scoreNum       = document.getElementById("score-num");
const scoreName      = document.getElementById("score-resume-name");
const changesList    = document.getElementById("changes-list");
const dlDocx         = document.getElementById("dl-docx");
const dlPdf          = document.getElementById("dl-pdf");
const feedbackSec    = document.getElementById("feedback-section");
const feedbackChips  = document.getElementById("feedback-chips");
const feedbackCustom = document.getElementById("feedback-custom");
const submitFeedback = document.getElementById("submit-feedback");

let activeTailorId = null;
const CIRCUMFERENCE = 2 * Math.PI * 34;

async function loadSelectOptions() {
  const res = await fetch("/api/resumes");
  const rows = await res.json();
  resumeSelect.innerHTML = '<option value="">— auto-pick best match —</option>';
  rows.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.filename;
    resumeSelect.appendChild(opt);
  });
}

function showState(state) {
  resultIdle.hidden    = state !== "idle";
  resultLoading.hidden = state !== "loading";
  resultCard.hidden    = state !== "result";
}

function animateScore(score) {
  let current = 0;
  const step = Math.ceil(score / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, score);
    scoreNum.textContent = current;
    if (current >= score) clearInterval(timer);
  }, 25);

  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  requestAnimationFrame(() => {
    ringFill.style.strokeDashoffset = offset;
    ringFill.style.stroke =
      score >= 80 ? "#10b981" :
      score >= 60 ? "#7c3aed" : "#ea580c";
  });
}

tailorBtn.addEventListener("click", async () => {
  const jd = jdInput.value.trim();
  if (!jd) { showToast("Paste a job description first", "error"); return; }
  if (!window.HAS_KEY) { showToast("Add Claude API key to .env and restart", "error"); return; }

  showState("loading");
  feedbackSec.hidden = true;
  activeTailorId = null;

  const body = { jd };
  if (resumeSelect.value) body.resume_id = parseInt(resumeSelect.value);

  try {
    const res  = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    activeTailorId = data.tailor_id;
    scoreNum.textContent = "0";
    ringFill.style.strokeDashoffset = CIRCUMFERENCE;
    scoreName.textContent = data.resume_name;

    changesList.innerHTML = "";
    (data.what_changed || []).forEach(c => {
      const li = document.createElement("li");
      li.textContent = c;
      changesList.appendChild(li);
    });

    showState("result");
    setTimeout(() => animateScore(data.score || 0), 100);
    dlDocx.onclick = () => downloadFile("docx");
    dlPdf.onclick  = () => downloadFile("pdf");
  } catch (err) {
    showState("idle");
    showToast(err.message, "error");
  }
});

function downloadFile(fmt) {
  if (!activeTailorId) return;
  window.open(`/api/tailor/${activeTailorId}/download/${fmt}`);
  setTimeout(() => { feedbackSec.hidden = false; }, 800);
}

feedbackChips.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => chip.classList.toggle("selected"));
});

submitFeedback.addEventListener("click", async () => {
  if (!activeTailorId) return;
  const tags = [...feedbackChips.querySelectorAll(".chip.selected")].map(c => c.dataset.tag);
  const custom = feedbackCustom.value.trim();
  if (!tags.length && !custom) { showToast("Pick at least one option", "error"); return; }

  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tailor_id: activeTailorId, tags, custom }),
  });
  if (res.ok) {
    showToast("Feedback saved — applied to future tailoring ✓");
    feedbackSec.hidden = true;
    feedbackCustom.value = "";
    feedbackChips.querySelectorAll(".chip.selected").forEach(c => c.classList.remove("selected"));
  } else {
    showToast("Couldn't save feedback", "error");
  }
});

/* ════════════════════════════════════════════════════════
   TRACKER TAB
══════════════════════════════════════════════════════════ */

const STATUSES = ["saved", "applied", "interview", "offer", "rejected"];
let allApplications = [];

const trackerBadge = document.getElementById("tracker-count-badge");

async function loadTracker() {
  try {
    const res = await fetch("/api/applications");
    allApplications = await res.json();
    renderTracker();
  } catch {
    showToast("Couldn't load tracker", "error");
  }
}

function renderTracker() {
  const apps = allApplications;
  const trackerEmpty = document.getElementById("tracker-empty");

  // Update stats
  document.getElementById("stat-total").textContent    = apps.length;
  document.getElementById("stat-applied").textContent  = apps.filter(a => a.status === "applied").length;
  document.getElementById("stat-interview").textContent = apps.filter(a => a.status === "interview").length;
  document.getElementById("stat-offer").textContent    = apps.filter(a => a.status === "offer").length;
  document.getElementById("stat-rejected").textContent = apps.filter(a => a.status === "rejected").length;

  // Badge
  if (apps.length) {
    trackerBadge.textContent = apps.length;
    trackerBadge.style.display = "flex";
  }

  // Empty state
  trackerEmpty.hidden = apps.length > 0;

  // Render columns
  STATUSES.forEach(status => {
    const colCards = document.getElementById(`col-${status}`);
    const colCount = document.getElementById(`col-count-${status}`);
    const group = apps.filter(a => a.status === status);
    colCount.textContent = group.length;
    colCards.innerHTML = "";

    group.forEach(app => {
      const card = document.createElement("div");
      card.className = "kanban-card";

      const nextStatus = STATUSES[STATUSES.indexOf(status) + 1];
      card.innerHTML = `
        <div class="kc-title">${esc(app.title)}</div>
        <div class="kc-company">${esc(app.company)}</div>
        <div class="kc-meta">
          ${app.salary ? `<span class="kc-salary">${esc(app.salary)}</span>` : ""}
          <span class="kc-date">${fmtDate(app.created_at)}</span>
          ${app.url ? `<a href="${esc(app.url)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--text-3)">↗ Link</a>` : ""}
        </div>
        ${app.notes ? `<div style="font-size:11.5px;color:var(--text-3);margin-top:6px;line-height:1.4">${esc(app.notes)}</div>` : ""}
        <div class="kc-actions">
          ${nextStatus ? `<button class="btn btn-status-move" data-id="${app.id}" data-status="${nextStatus}">→ ${capitalize(nextStatus)}</button>` : ""}
          <button class="btn btn-kc-delete" data-id="${app.id}" title="Delete">✕</button>
        </div>`;

      // Move status
      const moveBtn = card.querySelector(".btn-status-move");
      if (moveBtn) {
        moveBtn.addEventListener("click", async () => {
          await updateApp(app.id, { status: moveBtn.dataset.status });
        });
      }

      // Delete
      card.querySelector(".btn-kc-delete").addEventListener("click", async () => {
        if (!confirm(`Remove "${app.title}" from tracker?`)) return;
        await fetch(`/api/applications/${app.id}`, { method: "DELETE" });
        showToast("Application removed");
        loadTracker();
      });

      colCards.appendChild(card);
    });
  });
}

async function updateApp(id, fields) {
  await fetch(`/api/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  loadTracker();
}

/* ── Add Application Modal ──────────────────────────────────────────────────── */
const appModal    = document.getElementById("app-modal");
const modalTitle  = document.getElementById("modal-title-input");
const modalCo     = document.getElementById("modal-company");
const modalUrl    = document.getElementById("modal-url");
const modalStatus = document.getElementById("modal-status");
const modalSalary = document.getElementById("modal-salary");
const modalNotes  = document.getElementById("modal-notes");

function openAppModal(prefill = {}) {
  modalTitle.value  = prefill.title   || "";
  modalCo.value     = prefill.company || "";
  modalUrl.value    = prefill.url     || "";
  modalStatus.value = prefill.status  || "applied";
  modalSalary.value = prefill.salary  || "";
  modalNotes.value  = prefill.notes   || "";
  appModal.hidden = false;

  // Switch to tracker tab so after saving it's visible
  if (!prefill._noSwitch) {
    document.querySelector('[data-tab="tracker"]').click();
  }
}

function closeModal() { appModal.hidden = true; }

document.getElementById("add-app-btn").addEventListener("click", () => openAppModal({ _noSwitch: true }));
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
appModal.addEventListener("click", e => { if (e.target === appModal) closeModal(); });

document.getElementById("modal-save").addEventListener("click", async () => {
  const title = modalTitle.value.trim();
  const company = modalCo.value.trim();
  if (!title || !company) { showToast("Title and company are required", "error"); return; }

  const body = {
    title, company,
    url:    modalUrl.value.trim(),
    status: modalStatus.value,
    salary: modalSalary.value.trim(),
    notes:  modalNotes.value.trim(),
  };

  const res = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    closeModal();
    showToast("Application added ✓");
    loadTracker();
  } else {
    showToast("Couldn't save", "error");
  }
});

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function esc(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function fmtDate(iso = "") {
  if (!iso) return "";
  const d = new Date(iso.replace(" ","T") + "Z");
  return d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }
