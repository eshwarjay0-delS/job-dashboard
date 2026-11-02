// marketfit-voice-v2
"use strict";
/* Kompas — single-page app: Login → Dashboard → Create-Session wizard → Copilot.
   The copilot listens to mic + computer audio, transcribes (Groq Whisper) and
   answers in text (Claude), using the session's company/JD/resume/preferences as
   context — the same context idea as the resume feature. Audio + answers sit
   behind seams so the UI works even with no backend. */

const $ = (id) => document.getElementById(id);

/* ---- self-update: deploys are offered; only the user can reload ----
   The deploy stamps window.PERFACT_BUILD into index.html and writes /version.json. */
const BUILD = window.PERFACT_BUILD || "dev";
if ($("releaseBuild")) $("releaseBuild").textContent = "Release " + BUILD.replace(/^kompas-/, "");
// The label names the exact commit and build time the server stamped into version.json at build time
// (scripts/stamp-version.mjs). Without a stamp (local, or an older build) the hand-set BUILD label above stays.
async function showReleaseStamp() {
  try {
    const el = $("releaseBuild");
    if (!el || BUILD === "dev" || location.protocol === "file:") return;
    const v = await (await fetch("version.json?t=" + Date.now(), { cache: "no-store" })).json();
    if (!v || !/^[0-9a-f]{7}$/i.test(String(v.commit || ""))) return;
    const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(v.builtAt || "")) ? " · built " + String(v.builtAt).slice(0, 16).replace("T", " ") + " UTC" : "";
    el.textContent = "Release " + v.commit + at;
    el.dataset.commit = v.commit;
    el.title = "Build " + (v.build || BUILD) + ", commit " + v.commit + ". Both Kompas entry points use this release. Session history stays in this browser.";
  } catch {}
}
showReleaseStamp();
async function checkForUpdate() {
  if (BUILD === "dev" || location.protocol === "file:") return;
  try {
    // The page's own stamp, next to index.html: the root /version.json was a different file, so the update pill showed forever.
    const v = await (await fetch("version.json?t=" + Date.now(), { cache: "no-store" })).json();
    if (!v || !v.build || v.build === BUILD) return;
    // Inactivity, a hidden screen or a deploy is never consent to discard work.
    if ($("updatePill")) return;
    const b = document.createElement("button");
    b.id = "updatePill"; b.className = "update-pill"; b.textContent = "⟳ Update ready — reload";
    b.title = "Update when your session is finished. Reloading stops listening.";
    b.onclick = () => location.reload();
    document.body.append(b);
  } catch {}
}
setInterval(checkForUpdate, 60000);
async function showCapabilityVersion() {
  try {
    const c = await (await fetch("/api/capabilities", { cache: "no-store" })).json();
    const el = $("credits");
    if (!el || !c || !c.version) return;
    el.classList.remove("hidden");
    el.textContent = "Kompas " + c.version;
    el.title = (c.policy ? c.policy + ". " : "") + (c.cycle || "");
  } catch {}
}
showCapabilityVersion();
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(); });

// A failed write used to be ignored, so a session, resume or preference that did not fit was gone
// on the next open. Retry after dropping the bulky transcript logs, then after shortening copies
// of resume text that the docs store already keeps. The keys stay perfact.*.
function slimForStore(k, v) {
  if (k === "sessions" && Array.isArray(v)) return v.map(s => {
    if (!s || typeof s !== "object") return s;
    const next = { ...s };
    if (next.resumeId && next.resume && next.resume.length > 500) next.resume = next.resume.slice(0, 500);
    if (Array.isArray(next.docIds) && next.docIds.length && next.documents && next.documents.length > 500) next.documents = next.documents.slice(0, 500);
    return next;
  });
  return v;
}
function dropOldLogs() {
  const names = [];
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (name && name.startsWith("perfact.log.")) names.push(name);
  }
  names.slice(0, Math.max(1, names.length - 1)).forEach(name => localStorage.removeItem(name));
}
let accountSessionSync = null;
let cloudArchive = null;
const LS = {
  get(k, d) { try { const v = localStorage.getItem("perfact." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) {
    const key = "perfact." + k;
    const before = k === "sessions" ? this.get(k, []) : null;
    const write = () => { localStorage.setItem(key, JSON.stringify(v)); return true; };
    let ok = false;
    try { ok = write(); } catch {}
    if (!ok) { try { dropOldLogs(); ok = write(); } catch {} }
    // No silent shortening of resumes, JDs or personal AI instructions.
    if (!ok && k === "sessions") {
      const banner = document.getElementById("cloudSyncStatus");
      if (banner) { banner.textContent = "Offline storage full. Your complete session is being sent to your account. Check Sync before closing."; banner.classList.remove("hidden"); }
    }
    if (k === "sessions" && accountSessionSync && !accountSessionSync.applying) accountSessionSync.localWrite(before, v);
  },
};

/* ------------------------------- router ---------------------------------- */
const VIEWS = ["login", "dashboard", "transcripts", "qbank", "feedback", "resume", "documents", "wizard", "copilot"];
const SIDE_VIEWS = ["dashboard", "transcripts", "qbank", "feedback", "resume", "documents"];   // pages framed by the sidebar
function show(name) {
  for (const v of VIEWS) $("view-" + v)?.classList.toggle("hidden", v !== name);
  $("sideNav")?.classList.toggle("hidden", !!window.kompasDesktop || !SIDE_VIEWS.includes(name));
  document.querySelectorAll(".side-item[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === name));
  window.kompasDesktop?.setLive(name === "copilot");               // desktop: answer hotkeys only while the live screen is open
  window.kompasDesktop?.setScreen?.(name);                         // desktop: the window resizes to fit this screen
  window.scrollTo(0, 0);
}

/* -------------------------------- state ----------------------------------- */
let sessions = LS.get("sessions", []);
let current = null;          // the session config the copilot is running against

/* --------------------------------- auth ----------------------------------- */
$("loginBtn").onclick = () => {
  const email = $("loginEmail").value.trim();
  if (!email) { $("loginEmail").focus(); return; }
  LS.set("user", { email });
  openDashboard();
};
$("logoutBtn").onclick = () => { accountSessionSync?.signOutLocal(); LS.set("user", null); show("login"); };

/* ------------------------------ dashboard --------------------------------- */
function openDashboard() {
  sessions = LS.get("sessions", []);
  renderSessions();
  renderGetStarted();
  show("dashboard");
  if (accountSessionSync) void accountSessionSync.refresh();
}
/* First-run checklist: resume → session → start; each step ticks itself off, hidden once all three are done or dismissed. */
function renderGetStarted() {
  const hasResume = docsGet().some(d => d.kind === "resume" && d.text && !d.error) || sessions.some(s => (s.resume || "").trim().length > 100);   // uploaded, or pasted in the wizard
  const hasSession = sessions.length > 0;
  const started = !!LS.get("started", false) || sessions.some(s => (s.transcripts || []).length);
  $("gsResume").classList.toggle("done", hasResume);
  $("gsSession").classList.toggle("done", hasSession);
  $("gsStart").classList.toggle("done", started);
  $("getStarted").classList.toggle("hidden", !!LS.get("gsHidden", false) || (hasResume && hasSession && started));
}
$("gsHide").onclick = () => { LS.set("gsHidden", true); $("getStarted").classList.add("hidden"); };
$("gsResumeBtn").onclick = () => openResume("dashboard");
$("gsSessionBtn").onclick = () => openWizard();
$("navSessions").onclick = () => openDashboard();
$("navTranscripts").onclick = () => openTranscripts();
/* Transcripts page: every session that has a saved run, newest first. */
function openTranscripts() {
  sessions = LS.get("sessions", []);
  const list = $("txList"); list.innerHTML = "";
  // Show the complete account session catalog here, not only sessions that
  // already contain a transcript. Otherwise successfully synchronized sessions
  // disappear from this page and look as though cloud history was lost.
  const visibleSessions = sessions.filter(s => s && s.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("txEmpty").classList.toggle("hidden", visibleSessions.length > 0);
  for (const s of visibleSessions) {
    const row = document.createElement("div");
    row.className = "doc-item";
    row.innerHTML = `<div class="doc-ico">☰</div><div class="doc-main"><div class="doc-name"></div><div class="doc-meta"></div></div><div class="doc-actions"><button class="btn">Open</button></div>`;
    row.querySelector(".doc-name").textContent = (s.role || "Untitled role") + (s.company ? " · " + s.company : "");
    const hasTranscript = Array.isArray(s.transcripts) && s.transcripts.length > 0;
    row.querySelector(".doc-meta").textContent = (s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Saved session") + (hasTranscript ? " · Transcript available" : " · No transcript recorded");
    const open = row.querySelector(".btn");
    open.textContent = hasTranscript ? "Open" : "No transcript";
    open.disabled = !hasTranscript;
    if (hasTranscript) open.onclick = () => viewTranscripts(s);
    list.append(row);
  }
  show("transcripts");
  if (accountSessionSync) void accountSessionSync.refresh();
}
/* ---- a session's life: Start → Stop → Continue, until explicitly Ended ----
   Historical policy (superseded 2026-10-20), owner 2026-10-01: Continue for 30 minutes; after that the
   session ends by itself. A stopped session can also be ended from its card. The transcript is kept either way. An ended session
   is over (his second decision the same day: "Clicking on end doesn't continue anymore. Only view transcript would be visible"):
   its card offers its transcript and nothing to start. A session has one transcript, however often it was stopped and continued.
   On the session record: runAt (a run exists), pausedAt (when its live box closed), endedAt + endedBy ("you" | "clock"). */
// Superseded 2026-10-20: absence, Stop and a lost heartbeat never end a session.
// Only the explicit End action finalizes it. Preserve historical clock-ended records.
const liveKey = (id) => id + ":live";
const kompasDeviceId = (() => {
  const key = "perfact.device.id";
  let id = localStorage.getItem(key);
  if (!id) { id = "device-" + (globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2)); try { localStorage.setItem(key,id); } catch {} }
  return id;
})();
const sessionOpen = (s) => !!s.runAt && !s.endedAt;
const liveOpenFor = (s) => !!current && current.id === s.id && !$("view-copilot").classList.contains("hidden");
const clockTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayTime = (t) => (new Date(t).toDateString() === new Date().toDateString() ? "" : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }) + ", ") + clockTime(t);
function lastHeardAt(id) { try { const log = JSON.parse(localStorage.getItem("perfact.log." + id) || "[]"); return (log.length && log[log.length - 1].at) || 0; } catch { return 0; } }
// A live box says it is open every few seconds, so another window of Kompas does not take its session for a stopped one.
const beatKey = (id) => "perfact.live." + id;
let beatTimer = 0, beatId = "";
function beat(on) {
  clearInterval(beatTimer);
  if (beatId) { try { localStorage.removeItem(beatKey(beatId)); } catch {} beatId = ""; }
  if (!on || !current || !current.id) return;
  beatId = current.id;
  const tick = () => { try { localStorage.setItem(beatKey(beatId), String(Date.now())); } catch {} };
  tick(); let lastCloudBeat = 0;
  beatTimer = setInterval(() => {
    tick();
    if (current && current.id === beatId && sessionOpen(current) && Date.now() - lastCloudBeat > 15000) {
      lastCloudBeat = Date.now();
      current.lastActiveAt = lastCloudBeat;
      saveSession(current, true);
    }
  }, 5000);
}
// 90 seconds, not 15: a window in the background is only allowed to run its timers about once a minute
const liveElsewhere = (s) => {
  if (liveOpenFor(s)) return false;
  if (s.runDeviceId && s.runDeviceId !== kompasDeviceId && s.runAt && !s.pausedAt)
    return Date.now() - (Number(s.lastActiveAt) || Number(s.runAt) || 0) < 90000;
  try { return Date.now() - Number(localStorage.getItem(beatKey(s.id)) || 0) < 90000; }
  catch { return false; }
};
// A run's transcript, made from its event log: the entry for the session's list and the stored text. null when nothing was heard or answered.
function runTranscript(s, log, ended) {
  const heard = log.filter(e => e.t === "line").length, answers = log.filter(e => e.t === "answer" && !e.noQuestion).length;
  if (!heard && !answers) return null;
  const at = log[0].at, key = `${s.id}:tx:${at}`;
  return { key, entry: { key, at, ended, heard, answers }, rec: { at, ended, text: transcriptText(s, log), log: log.slice() } };   // log = training data
}
function listTranscript(record, entry) { record.transcripts = [...(record.transcripts || []).filter(t => t.key !== entry.key), entry].slice(-20); }
function closeRun(s, at, by) {
  // The run's stored log becomes its transcript before it is cleared, so a window that went without a Stop loses nothing.
  const key = "perfact.log." + s.id; let raw = null, log = [];
  try { raw = localStorage.getItem(key); log = JSON.parse(raw || "[]"); } catch {}
  const t = Array.isArray(log) && log.length ? runTranscript(s, log, Math.min(at, Date.now())) : null;
  if (t) listTranscript(s, t.entry);
  s.endedAt = at; s.endedBy = by; s.runAt = null; s.pausedAt = null;
  if (current && current.id === s.id && !liveOpenFor(s)) { clearTimeout(logSaveT); sessionLog = []; }   // nothing left over from the closed run writes its log back
  // Stored a moment later (the store may not be ready while the page is still loading). The log goes only once its transcript is
  // stored, and only if it is still that run's log; the next Start is then a new run, with its own transcript.
  setTimeout(async () => {
    if (t) await DossierDB.put(t.key, t.rec);
    try { if (localStorage.getItem(key) === raw) localStorage.removeItem(key); } catch {}
    DossierDB.put(liveKey(s.id), null);
  }, 0);
}
// Discover interrupted runs without expiring their saved transcript or answers.
function sweepSessions() {
  const now = Date.now(); let changed = false;
  for (const s of sessions) {
    if (!sessionOpen(s)) continue;
    if (!s.pausedAt) { if (liveOpenFor(s) || liveElsewhere(s)) continue; s.pausedAt = lastHeardAt(s.id) || now; changed = true; }   // the window went without a Stop: counted from the last thing heard
  }
  if (changed) LS.set("sessions", sessions);
}
// A card can be older than the store (a save elsewhere, another window), so both buttons act on the record as it is stored now.
function continueSession(s) {
  sessions = LS.get("sessions", []); const x = sessions.find(v => v.id === s.id);
  if (!x || !sessionOpen(x) || liveElsewhere(x)) { renderSessions(); return; }   // Respect explicit End and another active window.
  x.pausedAt = null; LS.set("sessions", sessions);
  launchCopilot(x, { resume: true });
}
const miniSending = new Set();
const miniAttempts = new Map();
// Stop is only a PAUSE. Explicit End seals the mini dossier into the server
// Bible while keeping all transcript text in the local archive.
async function syncMiniDossier(s) {
  if (!s || !s.id || !s.endedAt || s.bibleSyncedAt || miniSending.has(s.id)) return;
  miniSending.add(s.id); miniAttempts.set(s.id, Date.now());
  try {
    const transcript = await sessionTranscript(s);
    const qa = (Array.isArray(transcript && transcript.log) ? transcript.log : [])
      .filter(e => e && e.t === "answer" && !e.failed && !e.noQuestion &&
        String(e.question || "").trim() && String(e.text || "").trim())
      .map(e => ({ q: String(e.question).slice(0, 8000), a: String(e.text).slice(0, 16000) }))
      .slice(0, 200);
    if (!qa.length) return; // no generated Q&A; raw transcript remains preserved locally
    const res = await fetch("/api/kompas/dossier/mini", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: String(s.id), field: String(s.role || "general"), qa }),
    });
    if (!res.ok || !(await res.json()).ok) return; // pending; retry on a later open
    const all = LS.get("sessions", []), row = all.find(x => x.id === s.id);
    if (row && row.endedAt && !row.bibleSyncedAt) {
      row.bibleSyncedAt = Date.now(); LS.set("sessions", all); sessions = all;
    }
  } catch { /* Offline or expired sign-in: keep local transcript for retry. */ }
  finally { miniSending.delete(s.id); }
}
function endSession(s) {
  sessions = LS.get("sessions", []); const x = sessions.find(v => v.id === s.id);
  if (x && sessionOpen(x) && !liveElsewhere(x)) {
    closeRun(x, Date.now(), "you"); LS.set("sessions", sessions);
    void syncMiniDossier(x);
  }
  renderSessions();
}
// Another window changed the sessions: this one takes the new list, so it never writes an old one back.
window.addEventListener("storage", (e) => {
  if (e.key !== "perfact.sessions") return;
  sessions = LS.get("sessions", []);
  if (!$("view-dashboard").classList.contains("hidden")) renderSessions();
});
function renderSessions() {
  sweepSessions();
  const list = $("sessionList");
  list.innerHTML = "";
  $("emptySessions").classList.toggle("hidden", sessions.length > 0);
  list.classList.toggle("hidden", sessions.length === 0);
  for (const s of sessions) {
    const card = document.createElement("div");
    card.className = "session-card";
    card.innerHTML = `
      <div class="sc-role"></div>
      <div class="sc-co"></div>
      <div class="sc-meta"></div>
      <div class="sc-state hidden"></div>
      <div class="sc-actions">
        <button class="btn primary sc-start">Start</button>
        <button class="btn ghost sc-end hidden">End</button>
        <button class="btn ghost sc-tx hidden">Transcript</button>
        <button class="btn ghost sc-edit hidden">Edit setup</button>
        <button class="btn ghost sc-del">Delete</button>
      </div>`;
    card.querySelector(".sc-role").textContent = s.role || "Untitled role";
    card.querySelector(".sc-co").textContent = s.company || (s.type === "mock" ? "Mock practice" : "Live interview");
    card.querySelector(".sc-meta").textContent = new Date(s.createdAt).toLocaleString() + " · " + (s.interviewer || "engineer").replace("_", " ") + " · " + (s.difficulty || "standard");
    const startBtn = card.querySelector(".sc-start"), state = card.querySelector(".sc-state");
    if (sessionOpen(s) && !s.pausedAt && liveElsewhere(s)) {               // running in another window of Kompas: nothing to press here
      startBtn.classList.add("hidden"); card.querySelector(".sc-del").classList.add("hidden");
      state.textContent = "Open in another window."; state.classList.remove("hidden"); card.classList.add("open");
    } else if (sessionOpen(s)) {                                           // stopped; no automatic expiry
      const at = s.pausedAt || Date.now();
      startBtn.textContent = "Continue"; startBtn.onclick = () => continueSession(s);
      state.textContent = `Stopped ${clockTime(at)}. Continue when ready, or End session.` + (s.note ? ` ${s.note.split("\n").length} answers kept from the call.` : ""); state.classList.remove("hidden");
      const end = card.querySelector(".sc-end"); end.classList.remove("hidden"); end.onclick = () => endSession(s);
      card.querySelector(".sc-del").classList.add("hidden");               // a session is ended before it is deleted
      card.classList.add("open");
      // Only a session that can still be continued offers setup editing: the
      // card itself opens the editor, and so does the Edit setup button. Clicks
      // on the card's own buttons keep their existing actions.
      const edit = card.querySelector(".sc-edit"); edit.classList.remove("hidden"); edit.onclick = () => openEditWizard(s);
      card.onclick = (e) => { if (e.target.closest("button")) return; openEditWizard(s); };
    } else if (s.endedAt) {                                                // ended is final: nothing to start or continue, only its transcript to read
      startBtn.classList.add("hidden"); card.classList.add("ended");
      state.textContent = `Ended ${dayTime(s.endedAt)}${s.endedBy === "clock" ? ", 30 minutes after it was stopped" : ""}.`; state.classList.remove("hidden");
    } else {
      startBtn.onclick = () => { sessions = LS.get("sessions", []); launchCopilot(sessions.find(v => v.id === s.id) || s); };   // the record as it is stored now
    }
    const tx = card.querySelector(".sc-tx"), nTx = (s.transcripts || []).length;
    if (nTx) { tx.classList.remove("hidden"); tx.onclick = () => viewTranscripts(s); }   // one session, one transcript, however many times it was stopped and continued
    card.querySelector(".sc-del").onclick = () => { sessions = sessions.filter(x => x.id !== s.id); LS.set("sessions", sessions); renderSessions(); };
    list.append(card);
  }
  // A failed network request does not lose a mini: each completed local
  // transcript can be retried after reconnect. Rate-limit retries per tab.
  for (const s of sessions.filter(x => x.endedAt && !x.bibleSyncedAt).slice(0, 3)) {
    if (Date.now() - (miniAttempts.get(s.id) || 0) > 60000) void syncMiniDossier(s);
  }
}
$("newSessionBtn").onclick = openWizard;
$("newSessionBtn2").onclick = openWizard;

/* -------------------------------- wizard ---------------------------------- */
let step = 0;
let draft = null;
// The setup is cached as it is typed, so uploading a resume (which leaves the wizard) or closing it does not throw
// the job details away (owner, 7 Oct 2026: "The details entered so far should be cached and continued filling. So
// the user won't start everything from scratch"). Cleared only when a session is actually created.
const DRAFT_KEY = "wizdraft";
const wizardOpen = () => !$("view-wizard")?.classList.contains("hidden");
function saveWizardDraft() {
  if (!draft || !wizardOpen() || !$("company")) return;
  if (draft.editId) return;   // an edit writes the session on Save & continue, never the new-session draft cache
  LS.set(DRAFT_KEY, {
    jobLink: $("jobLink")?.value || "", company: $("company").value, role: $("role").value, jd: $("jd").value,
    instructions: $("instructions")?.value || "", type: draft.type, length: draft.length, tone: draft.tone, mode: draft.mode,
    interviewer: $("interviewerSelect")?.value, difficulty: $("difficultySelect")?.value, dossierSize: $("dossierSize")?.value,
    autoAnswer: $("autoAnswer")?.checked, saveTranscript: $("saveTranscript")?.checked,
    resumeId: selectedResumeId, docIds: [...selectedDocIds], at: Date.now(),
  });
}
function clearWizardDraft() { LS.set(DRAFT_KEY, null); }
function applyWizardDraft() {
  const s = LS.get(DRAFT_KEY, null);
  if (!s || !(s.company || s.role || s.jd || s.jobLink || s.instructions || s.resumeId || (s.docIds || []).length)) return;
  if ($("jobLink")) $("jobLink").value = s.jobLink || "";
  $("company").value = s.company || ""; $("role").value = s.role || ""; $("jd").value = s.jd || "";
  if ($("instructions")) $("instructions").value = s.instructions || "";
  if (s.type) { draft.type = s.type; document.querySelectorAll(".choice").forEach(c => c.classList.toggle("on", c.dataset.type === s.type)); }
  if (s.length) { draft.length = s.length; segSet("lengthSeg", s.length); }
  if (s.tone) { draft.tone = s.tone; segSet("toneSeg", s.tone); }
  if (s.mode) { draft.mode = s.mode; segSet("modeSeg", s.mode); if ($("interviewerSelect")) showCodingLevels($("interviewerSelect"), s.mode); }
  if (s.interviewer && $("interviewerSelect")) $("interviewerSelect").value = keptLevel(s.interviewer, s.mode);
  if (s.difficulty && $("difficultySelect")) $("difficultySelect").value = s.difficulty;
  if (s.dossierSize && $("dossierSize")) $("dossierSize").value = s.dossierSize;
  if (typeof s.autoAnswer === "boolean") { draft.autoAnswer = s.autoAnswer; $("autoAnswer").checked = s.autoAnswer; }
  if (typeof s.saveTranscript === "boolean") { draft.saveTranscript = s.saveTranscript; $("saveTranscript").checked = s.saveTranscript; }
  if (s.resumeId && docsGet().some(d => d.id === s.resumeId)) selectedResumeId = s.resumeId;
  selectedDocIds = new Set((s.docIds || []).filter(id => docsGet().some(d => d.id === id)));
}
function openWizard() {
  const prev = sessions[0] || {};
  draft = { type: "live", length: prev.length || "balanced", tone: prev.tone || "professional", model: prev.model || "claude-haiku-4-5", language: "en", autoAnswer: !!prev.autoAnswer, saveTranscript: prev.saveTranscript !== false };
  step = 0;
  // A new session starts with a blank job. The answer preferences he already saved stay.
  ["jobLink", "company", "role", "jd", "resume"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("instructions")) $("instructions").value = prev.instructions || "";
  $("resume")?.classList.add("hidden"); if ($("resume")) $("resume").value = "";   // paste box stays folded until asked for, and empty so a stale paste cannot override the picked resume
  document.querySelectorAll(".choice").forEach(c => c.classList.toggle("on", c.dataset.type === "live"));
  segSet("lengthSeg", draft.length); segSet("toneSeg", draft.tone); segSet("modeSeg", prev.mode || "technical");
  $("model").value = draft.model; $("autoAnswer").checked = draft.autoAnswer; $("saveTranscript").checked = draft.saveTranscript;
  if ($("interviewerSelect")) { showCodingLevels($("interviewerSelect"), prev.mode); $("interviewerSelect").value = keptLevel(prev.interviewer, prev.mode); }
  if ($("difficultySelect")) $("difficultySelect").value = prev.difficulty || "standard";
  if ($("dossierSize")) $("dossierSize").value = prev.dossierSize || "auto";
  selectedResumeId = (docsGet().find(d => d.kind === "resume" && d.primary && d.text)
                    || docsGet().find(d => d.kind === "resume" && d.text) || {}).id || "";
  selectedDocIds = new Set();
  applyWizardDraft();                 // continue a setup left unfinished, instead of starting from scratch
  renderResumeSelect();
  renderDocPicker();
  gotoStep(0);
  show("wizard");
}
// Edit the setup of a session that can still be continued, then continue it
// with the edited setup. Only the stopped/open cards offer this (renderSessions
// wires it in the sessionOpen branch); ended sessions are final and a session
// open in another window cannot be continued here. The wizard is reused in edit
// mode (draft.editId): fields pre-fill from the stored session, the new-session
// draft cache is left untouched (saveWizardDraft guard), and cancelling changes
// nothing because the session is only written on Save & continue.
function openEditWizard(s) {
  const stored = (LS.get("sessions", []) || []).find(v => v.id === s.id) || s;
  draft = { type: stored.type || "live", length: stored.length || "balanced", tone: stored.tone || "professional", model: stored.model || "claude-haiku-4-5", language: "en", autoAnswer: !!stored.autoAnswer, saveTranscript: stored.saveTranscript !== false, editId: stored.id };
  step = 0;
  if ($("jobLink")) $("jobLink").value = stored.jobLink || "";
  $("company").value = stored.company || ""; $("role").value = stored.role || ""; $("jd").value = stored.jd || "";
  if ($("instructions")) $("instructions").value = stored.instructions || "";
  document.querySelectorAll(".choice").forEach(c => c.classList.toggle("on", c.dataset.type === draft.type));
  segSet("lengthSeg", draft.length); segSet("toneSeg", draft.tone); segSet("modeSeg", stored.mode || "technical");
  draft.mode = stored.mode || "technical";
  $("model").value = draft.model; $("autoAnswer").checked = draft.autoAnswer; $("saveTranscript").checked = draft.saveTranscript;
  if ($("interviewerSelect")) { showCodingLevels($("interviewerSelect"), draft.mode); $("interviewerSelect").value = keptLevel(stored.interviewer, draft.mode); }
  if ($("difficultySelect")) $("difficultySelect").value = stored.difficulty || "standard";
  if ($("dossierSize")) $("dossierSize").value = stored.dossierSize || "auto";
  selectedResumeId = (stored.resumeId && docsGet().some(d => d.id === stored.resumeId)) ? stored.resumeId : "";
  if (!selectedResumeId && stored.resume) { $("resume").value = stored.resume; $("resume").classList.remove("hidden"); }
  else { $("resume").value = ""; $("resume").classList.add("hidden"); }
  selectedDocIds = new Set((stored.docIds || []).filter(id => docsGet().some(d => d.id === id)));
  renderResumeSelect();
  renderDocPicker();
  gotoStep(0);
  show("wizard");
}
// Save & continue for an edited session: only the setup fields move; the
// lifecycle (id, createdAt, runAt, pausedAt, transcripts, ended state) is
// untouched, and continuability is re-checked at save time, exactly as
// continueSession guards it. The edited session then continues as-is.
function finishEditWizard() {
  const id = draft.editId;
  sessions = LS.get("sessions", []);
  const x = sessions.find(v => v.id === id);
  if (!x || !sessionOpen(x) || liveElsewhere(x)) { renderSessions(); openDashboard(); return; }
  x.type = draft.type;
  x.jobLink = $("jobLink").value.trim();
  x.company = $("company").value.trim();
  x.role = $("role").value.trim();
  x.jd = $("jd").value.trim();
  x.resume = resolveResumeText();
  x.documents = resolveDocumentsText();
  x.docIds = [...selectedDocIds];
  x.resumeId = selectedResumeId;
  x.model = $("model").value;
  x.language = "en";
  x.length = draft.length;
  x.tone = draft.tone;
  x.mode = draft.mode || "technical";
  x.instructions = $("instructions").value;
  x.autoAnswer = $("autoAnswer").checked;
  x.autoMode = $("autoAnswer").checked;
  x.saveTranscript = $("saveTranscript").checked;
  x.interviewer = ($("interviewerSelect") || {}).value || "engineer";
  x.difficulty = ($("difficultySelect") || {}).value || "standard";
  x.dossierSize = ($("dossierSize") || {}).value || "auto";
  LS.set("sessions", sessions);
  draft = null;
  continueSession(x);
}
function gotoStep(n) {
  step = Math.max(0, Math.min(2, n));
  document.querySelectorAll(".wiz-pane").forEach(p => p.classList.toggle("hidden", +p.dataset.pane !== step));
  document.querySelectorAll(".wiz-step").forEach(s => s.classList.toggle("on", +s.dataset.step <= step));
  $("wizBack").textContent = step === 0 ? "Cancel" : "Back";
  $("wizNext").textContent = step === 2 ? (draft && draft.editId ? "Save & continue" : "Create & Start") : "Next";
}
$("wizClose").onclick = openDashboard;
$("wizBack").onclick = () => { if (step === 0) openDashboard(); else gotoStep(step - 1); };
$("wizNext").onclick = () => { if (step < 2) gotoStep(step + 1); else finishWizard(); };
document.querySelectorAll(".choice").forEach(c => c.onclick = () => {
  document.querySelectorAll(".choice").forEach(x => x.classList.remove("on"));
  c.classList.add("on"); draft.type = c.dataset.type; saveWizardDraft();
});
function segSet(id, val) { const box = $(id); if (!box) return; [...box.children].forEach(b => b.classList.toggle("on", b.dataset.v === val)); }
["lengthSeg", "toneSeg", "modeSeg"].forEach(id => { const box = $(id); if (box) box.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; [...box.children].forEach(x => x.classList.remove("on")); b.classList.add("on"); draft[{ lengthSeg: "length", toneSeg: "tone", modeSeg: "mode" }[id]] = b.dataset.v;
  // the interview type suggests who is asking: Behavioural -> Technical HR, Technical -> Engineer, Coding -> Architect (Developer offered beside it)
  if (id === "modeSeg" && $("interviewerSelect")) { showCodingLevels($("interviewerSelect"), b.dataset.v); const who = { behavioural: "engineer", technical: "engineer", coding: "architect", final: "director" }[b.dataset.v]; if (who) $("interviewerSelect").value = who; } saveWizardDraft(); }; });
// The typed fields and dropdowns autosave as they change; the segmented controls and resume/document pickers
// call saveWizardDraft from their own handlers (clicks, not input events).
["input", "change"].forEach(ev => document.querySelectorAll(".wiz-pane").forEach(p => p.addEventListener(ev, saveWizardDraft)));

function finishWizard() {
  if (draft && draft.editId) return finishEditWizard();
  const s = {
    id: "s" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
    createdAt: Date.now(),
    type: draft.type,
    jobLink: $("jobLink").value.trim(),
    company: $("company").value.trim(),
    role: $("role").value.trim(),
    jd: $("jd").value.trim(),
    resume: resolveResumeText(),
    documents: resolveDocumentsText(),
    docIds: [...selectedDocIds],
    resumeId: selectedResumeId,
    model: $("model").value,
    language: "en",
    length: draft.length,
    tone: draft.tone,
    mode: draft.mode || "technical",
    instructions: $("instructions").value,
    autoAnswer: $("autoAnswer").checked,
    autoMode: $("autoAnswer").checked,
    saveTranscript: $("saveTranscript").checked,
    interviewer: ($("interviewerSelect") || {}).value || "engineer",
    difficulty: ($("difficultySelect") || {}).value || "standard",
    dossierSize: ($("dossierSize") || {}).value || "auto",
  };
  sessions.unshift(s);
  LS.set("sessions", sessions);
  clearWizardDraft();              // the setup became a session; the next new session starts clean
  launchCopilot(s);
}

/* ------------------------------- copilot (live, v2) ------------------------------------------
   Everything here is real time. Audio is cut by voice-activity detection — a phrase is sent the
   moment the speaker pauses, never on a fixed timer — so silence is never transcribed (that is
   where Whisper's phantom "you" came from). Captions appear while they are still talking.
   Answers stream token by token, grounded on the persona dossier retrieved locally. */
let ledger = null;              // Water-Algorithm rotation state for the running session
let cards = [];
let idx = 0;
let transcript = [];            // [{ who, text, at }]
let transcriptionEpoch = 0;
let transcriptionOrder = Promise.resolve();
// The whole session in order — every line heard, every question typed, every answer (and each
// regeneration) — for Get transcript. Clear doesn't touch it; a reload mid-interview picks it back up.
let sessionLog = [];
let logSaveT = 0;
// One structured reason per keep / drop / cut / gate decision (slice 2). Only the reason, the source and the length of
// the words, never the words themselves.
function logDecision(reason, source, text) { try { logEvent(decisionEvent(reason, source, text)); } catch {} }
function logEvent(ev) {
  sessionLog.push({ at: Date.now(), ...ev }); if (sessionLog.length > 4000) sessionLog.shift();
  // written only while that session's live box is open: an event that lands after the box closed must not bring a closed run's log back
  clearTimeout(logSaveT); logSaveT = setTimeout(() => { if (current && current.id && liveOpenFor(current)) { try { localStorage.setItem("perfact.log." + current.id, JSON.stringify(sessionLog)); } catch {} if (Date.now() - liveSavedAt > 15000) saveLive(); } }, 800);
}
// What is on the live screen, kept so that Continue brings it back: the cards, which one is showing, and what was heard.
// A card's in-flight state (a request, a stream, a fill in progress) is not kept.
const CARD_TRANSIENT = new Set(["streaming", "anchorFlight", "_flight", "_ledgerAt", "req"]);
let liveSavedAt = 0;
function saveLive(withLog) {
  const s = current; if (!s || !s.id) return Promise.resolve();
  let plain; try { plain = JSON.parse(JSON.stringify(cards, (k, v) => (CARD_TRANSIENT.has(k) || typeof v === "function" ? undefined : v))); } catch { plain = cards.map(c => ({ question: c.question, answer: c.answer })); }
  cards.forEach((c, i) => { if (c.streaming && plain[i]) plain[i].meta = "Stopped before this answer finished. Press AI Answer to run it again."; });   // a half-written answer is not shown later as a finished one
  liveSavedAt = Date.now();
  return DossierDB.put(liveKey(s.id), { at: liveSavedAt, cards: plain, idx, transcript: transcript.slice(-600), ...(withLog ? { log: sessionLog.slice() } : {}) });
}
async function restoreLive(s) {
  const snap = await DossierDB.get(liveKey(s.id));
  if (current !== s || !snap || !Array.isArray(snap.cards) || !snap.cards.length) return;
  if (Array.isArray(snap.log) && snap.log.length >= sessionLog.length) sessionLog = snap.log;
  cards = snap.cards; idx = Math.max(0, Math.min(cards.length - 1, Number(snap.idx) || 0));
  transcript = Array.isArray(snap.transcript) ? snap.transcript : [];
  heardSeq = answeredSeq = transcript.reduce((n, t) => Math.max(n, Number(t.seq) || 0), heardSeq);   // what came back is already dealt with: only what is heard from now on is pending
  updatePending(); renderDrawer(); renderCard();
  if (current) seedIdentity(current);   // a resumed run gets its intro card too, so Prev always has somewhere to go
}
// The live box is closing: the run stays open for Continue. The session is marked first (that part cannot wait when the window
// itself is going), the screen is stored after.
async function pauseRun() {
  const s = current; if (!s || !s.id) return;
  if (!s.runAt && !sessionLog.some(e => e.t === "line" || (e.t === "answer" && !e.noQuestion))) return;   // opened and left with nothing heard or answered (a depth step or a copy is not a run): the card stays as it was
  try { localStorage.setItem("perfact.log." + s.id, JSON.stringify(sessionLog)); } catch {}
  s.runAt = s.runAt || (sessionLog[0] && sessionLog[0].at) || Date.now(); s.pausedAt = Date.now(); s.endedAt = null; s.endedBy = null;
  saveSession(s, true);
  await saveLive(true);
}
// A run begins when capture has really started. Starting an ended session again is a new run.
function markRun() {
  const s = current; if (!s || !s.id) return;
  if (!s.runAt || s.endedAt) s.runAt = Date.now();
  s.endedAt = null; s.endedBy = null; s.pausedAt = null;
  s.runDeviceId = kompasDeviceId; s.lastActiveAt = Date.now(); saveSession(s, true);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function cfgOf(s) { return { company: s.company, role: s.role, jd: s.jd, resume: s.resume, documents: s.documents, instructions: s.instructions, language: s.language }; }
function liveConfig() {
  const s = current || {};
  const who = ($("liveInterviewer") && $("liveInterviewer").value) || s.interviewer || "engineer";
  return { ...cfgOf(s), length: s.length || "balanced", tone: s.tone, mode: s.mode || "technical", interviewer: who, difficulty: s.difficulty || "standard" };
}
// Where a session stands (runAt, pausedAt, endedAt, endedBy) is changed only by the lifecycle code (life = true), and its list of
// transcripts only by the code that stores one. Any other save keeps what the store holds, so an object read earlier (the session
// that was last open, a prep result that comes back late) cannot bring a closed run back or drop a transcript.
const LIFE_KEYS = ["runAt", "pausedAt", "endedAt", "endedBy"];
function saveSession(s, life) {
  const all = LS.get("sessions", []); const i = all.findIndex(x => x.id === s.id);
  if (i < 0) return;
  for (const k of life ? ["transcripts"] : ["transcripts", ...LIFE_KEYS]) { if (all[i][k] === undefined) delete s[k]; else s[k] = all[i][k]; }
  all[i] = { ...all[i], ...s }; LS.set("sessions", all); sessions = all;
}

function launchCopilot(s, opts = {}) {
  transcriptionEpoch++;
  transcriptionOrder = Promise.resolve();
  current = s;
  if (s.resumeId) {                        // a session saved before the 12,000-character cut was lifted: take the full resume
    const d = docsGet().find(x => x.id === s.resumeId);
    if (d && d.text && d.text.length > (s.resume || "").length) { s.resume = d.text.slice(0, RESUME_MAX); saveSession(s); }
  }
  transcript = []; ledger = null;
  sessionLog = [];
  try {                                  // a run that is still open (Continue, or the update reload): keep its log. A new run never takes an old log.
    const prev = JSON.parse(localStorage.getItem("perfact.log." + s.id) || "[]");
    if (sessionOpen(s) && Array.isArray(prev) && prev.length && Date.now() - prev[prev.length - 1].at < 3 * 3600e3) sessionLog = prev;
    else if (!sessionOpen(s)) localStorage.removeItem("perfact.log." + s.id);
  } catch {}
  cards = [{ question: "Preparing…", answer: ["Forming your identity and persona from the four factors…"] }];
  idx = 0;
  $("ovTitle").textContent = "Kompas";
  if ($("liveInterviewer")) { showCodingLevels($("liveInterviewer"), s.mode); $("liveInterviewer").value = keptLevel(s.interviewer, s.mode); }
  renderDepth();
  resetLiveState();
  setAuto(s.autoMode === true);          // default OFF: nothing answers until you press AI Answer
  setPersonaChip(s);
  renderConnect(s);                      // Parakeet-style connect step before listening
  renderDrawer();
  renderCard();
  show("copilot");
  beat(true);
  // Continue: the answers and what was heard come back first, and the transcript goes on as the same run. The prep step follows,
  // so it fills the restored screen and is not overwritten by it.
  if (opts.resume) restoreLive(s).catch(() => {}).then(() => { if (current === s) preparePack(s); });
  else preparePack(s);
}
function personaLabel(seniority, role) {       // "Senior" + "Senior Cybersecurity Engineer" -> no duplicate
  seniority = String(seniority || "").trim(); role = String(role || "").trim();
  return seniority && !role.toLowerCase().startsWith(seniority.toLowerCase()) ? `${seniority} ${role}`.trim() : role || seniority;
}
function setPersonaChip(s) {
  const chip = $("personaChip"); if (!chip) return;
  const p = s && s.prep && s.prep.persona;
  const label = p && (p.role || p.seniority) ? personaLabel(p.seniority, p.role) : (s && s.role) || "";
  chip.textContent = label; chip.classList.toggle("hidden", !label);
  chip.title = p && p.voice ? "Voice: " + p.voice : "";
}
// Deterministic reuse (owner, 2026-09-30: cut AI wherever it isn't needed). The same resume, JD, documents and
// instructions produce the same prep; with the same interviewer, the same persona file. Reused, never regenerated.
function hashText(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
function factorsKey(s) { const c = cfgOf(s); return hashText(JSON.stringify([c.company, c.role, c.jd, c.resume, c.documents, c.instructions])); }
function twinSession(s, test) { const k = factorsKey(s); return (LS.get("sessions", []) || []).find(x => x.id !== s.id && factorsKey(x) === k && test(x)); }
// Opening book (owner, 2026-09-30: "both, book capped at 10"). After prep, the 10 most likely questions — your
// introduction plus the prep bank's core questions — are answered in the background, one at a time, paused while you
// are live or an answer is running, and stored per session. At answer time a strict match at the same depth is served
// in ~1 ms ("⚡ book"); anything else goes to the live engine.
let book = { sid: null, items: [] };
const BOOK_MAX = 10;
const bookWords = (t) => new Set((String(t).toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).filter(w => !FSTOP.has(w) && !/^(what|when|where|which|with|have|your|about|would|could|should|tell|explain|describe|please|there|their|this|that|some|give|walk)$/.test(w)).map(w => w.slice(0, 5)));
function bookMatch(q, depthKey) {
  if (personalLogistics(q)) return null;                             // never a cached answer for personal logistics
  const A = bookWords(q); if (!A.size) return null;
  // a plain intro only — "introduce yourself AND explain why X / a typical day / your education" needs a live answer (self-play)
  const intro = /\b(introduce|introduction|about yourself|walk me through your (background|resume|career))\b/i.test(q)
    && q.split(/\s+/).length <= 14 && !/\b(and|then|also|plus|starting with)\b[^?]*\b(why|explain|describe|walk|typical|education|fit|what|how|clients|activities|experience with)\b/i.test(q);
  const nums = (t) => (String(t).match(/\d[\d/.,]*/g) || []).join("|");
  let best = null, bestScore = 0;
  for (const it of book.items) {
    if (it.depthKey !== depthKey) continue;
    if (intro && it.intro) return it;
    const B = bookWords(it.q); let n = 0; for (const w of A) if (B.has(w)) n++;
    if (A.size - n > 1) continue;                                    // more than one key word of theirs isn't in the book question: a different question
    if (nums(q) && nums(q) !== nums(it.q)) continue;                 // different numbers: a different question
    const sc = n / Math.max(A.size, B.size);
    if (n >= 2 && sc > bestScore) { bestScore = sc; best = it; }
  }
  return bestScore >= 0.75 ? best : null;
}
async function readAnswerStream(res) {
  const txt = await res.text(); let text = "", meta = {};
  for (const fr of txt.split("\n\n")) { if (!fr.startsWith("data:")) continue; let ev; try { ev = JSON.parse(fr.slice(5)); } catch { continue; }
    if (ev.type === "delta") text += ev.text; else if (ev.type === "replace") text = ev.text; else if (ev.type === "done" || ev.type === "meta") meta = { ...meta, ...ev }; }
  return { text, meta };
}
async function buildBook(s) {
  if (location.protocol === "file:" || !s.prep) return;
  const key = s.id + ":book:personal-evidence-v2";
  let saved = await DossierDB.get(key);
  if (!(saved && saved.items && saved.items.length)) {                // same factors + interviewer: reuse that book
    const twin = twinSession(s, x => (x.interviewer || "engineer") === (s.interviewer || "engineer"));
    const theirs = twin && await DossierDB.get(twin.id + ":book:personal-evidence-v2");
    if (theirs && theirs.items && theirs.items.length) { saved = { ...theirs }; await DossierDB.put(key, saved); }
  }
  book = { sid: s.id, items: (saved && saved.items) || [] };
  const qs = ["Tell me about yourself."].concat(((s.prep && s.prep.questions) || []).map(q => q.q).filter(Boolean)).filter((q) => !personalLogistics(q)).slice(0, BOOK_MAX);
  const depthKey = `${s.interviewer || "engineer"}|${s.mode || "technical"}|${s.length || ""}`;
  for (const q of qs) {
    if (current !== s || dossierAbort) return;
    if (book.items.some(it => it.q === q && it.depthKey === depthKey)) continue;
    while (current === s && (running || answerCtl || aiBusy)) await new Promise(r => setTimeout(r, 3000));   // never compete with a live answer
    if (current !== s) return;
    try {
      const res = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ stream: true, client: BUILD, question: q, transcript: "", config: liveConfig(), prep: { ...slimPrep(), questions: [] }, retrieved: retrieve(q, 4), ledger: null }) });
      const { text, meta } = await readAnswerStream(res);
      if (meta.busy || meta.degraded || !text.trim() || /qwen-backup/.test((meta.timing && meta.timing.lane) || "")) { await new Promise(r => setTimeout(r, Math.max(20000, meta.retryAfterMs || 0))); continue; }   // only full-quality answers go in the book
      book.items.push({ q, text, depthKey, intro: /about yourself/i.test(q), at: Date.now() });
      await DossierDB.put(key, { v: 1, items: book.items });
    } catch {}
    await new Promise(r => setTimeout(r, 20000));                    // pacing: Groq's per-minute budget stays free for you
  }
}
// Auth: a 401 from /api/prep or /api/answer used to mean instant ejection to
// the login page. That was the "works for a while, then authentication gets
// in the way" bug: sessions lapse quietly while the app sits idle, and the
// first action afterwards met a dead token. Now the client first asks the
// server to renew the session (the refresh cookie does the work), retries
// once, and when renewal truly fails it waits silently (see
// waitForAuthSilently below) — it never shows auth UI mid-session.
let __lastAuthRefresh = 0;
let __authRefreshFlight = null;
function isAuthError(e) {
  const m = String((e && e.message) || e || "");
  return /\b401\b/.test(m) || /sign in/i.test(m);
}
async function tryRefreshAuth() {
  // Coalesce simultaneous prep, answer, focus and keepalive renewals.
  // The Electron shell exclusively owns its refresh family: never fall back
  // to stale webview cookies, which could revoke the desktop session.
  if (__authRefreshFlight) return __authRefreshFlight;
  __authRefreshFlight = (async () => {
    try {
      if (window.kompasDesktop) {
        if (typeof window.kompasDesktop.refreshAuth !== "function") return false;
        const renewed = await window.kompasDesktop.refreshAuth();
        if (renewed) { __lastAuthRefresh = Date.now(); return true; }
        return false;
      }
      // Cross-tab: two tabs renewing at once rotate the same cookie family
      // and one tab's renewal invalidates the other's. Serialize renewals
      // across tabs when the lock API exists; same-tab callers already
      // coalesce on __authRefreshFlight above. Desktop never reaches here:
      // the bridge branch above returns first.
      const run = async () => {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (res.ok) { __lastAuthRefresh = Date.now(); return true; }
        return false;
      };
      const locks = (typeof navigator !== "undefined" && navigator.locks) || null;
      if (locks) return await locks.request("kompas-auth-refresh", { mode: "exclusive" }, run);
      return await run();
    } catch {}
    return false;
  })();
  try { return await __authRefreshFlight; }
  finally { __authRefreshFlight = null; }
}
async function recoverLiveAuth() {
  if (await tryRefreshAuth()) return true;
  for (const delay of [800, 2400]) {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (await tryRefreshAuth()) return true;
  }
  return false;
}
// Idle is where sessions used to die: renew quietly whenever the user comes
// back to this window, and every 20 minutes while it stays open, so the next
// action never meets an expired token.
function keepAuthAlive() {
  if (document.hidden && !window.kompasDesktop) return;
  if (Date.now() - __lastAuthRefresh < 10 * 60 * 1000) return;
  void tryRefreshAuth();
}
try {
  document.addEventListener("visibilitychange", () => { if (!document.hidden) keepAuthAlive(); });
  window.addEventListener("focus", keepAuthAlive);
  setInterval(keepAuthAlive, 60 * 1000);
} catch {}
// Silent auth (owner, 1 Nov 2026): auth UI must never appear mid-session —
// no pill, no sign-in prompt, no auth error text in front of a meeting or
// demo. When renewal truly fails, the session waits silently: a cheap
// authenticated probe runs every 30s, and the moment auth heals, the failed
// answer resumes by itself. The user never sees, taps, or explains anything
// auth-shaped. This supersedes the 31 Oct user-controlled reconnect pill.
// Self-contained: no module-level consts it depends on.
let __authWaitTimer = null;
let __authWaiting = false;
let __authPendingRetries = [];
function healAuthSilently() {
  if (__authWaitTimer) { clearInterval(__authWaitTimer); __authWaitTimer = null; }
  __authWaiting = false;
  const retries = __authPendingRetries; __authPendingRetries = [];
  for (const retry of retries) {
    if (!retry || !retry.card) continue;
    const n = (retry.card.__authAutoRetries || 0) + 1;
    retry.card.__authAutoRetries = n;
    if (n <= 3) {
      try { generateAnswer(retry.question, retry.card, retry.opts || {}); } catch {}
    } else {
      try {
        if (typeof retry.card.answer !== "string" || !retry.card.answer.trim() || retry.card.answer.trim() === "…") retry.card.answer = ["Still waiting for the session. Press AI Answer again to retry."];
        if (cards[idx] === retry.card) renderCard();
      } catch {}
    }
  }
}
function waitForAuthSilently(retry) {
  if (retry && retry.card && !__authPendingRetries.some(r => r.card === retry.card)) __authPendingRetries.push(retry);
  if (__authWaiting) return;
  __authWaiting = true;
  if (__authWaitTimer) return;
  let tries = 0;
  let slow = false;
  const tick = async () => {
    tries++;
    try {
      try { await tryRefreshAuth(); } catch {}
      const res = await fetch("/api/kompas/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deriveOnly: true, question: "ping" }) });
      if (res.ok) { healAuthSilently(); return; }
    } catch {}
    // Never drop the wait: after 20 fast probes, keep probing every 5 minutes
    // for as long as the page stays open. A failed answer resumes the moment
    // auth heals, whenever that is. (Owner, 1 Nov 2026: never log out.)
    if (!slow && tries >= 20) {
      slow = true;
      clearInterval(__authWaitTimer);
      __authWaitTimer = setInterval(tick, 5 * 60 * 1000);
    }
  };
  __authWaitTimer = setInterval(tick, 30 * 1000);
}
async function preparePack(s) {
  if (location.protocol === "file:") { seedIdentity(s); status("Serve the deployed app for live prep + answers.", "live"); return; }
  if (s.prep && s.prep.v !== 2) { s.prep = null; saveSession(s); }   // pre-v2 prep had [blank]s: rebuild it
  if (!s.prep) { const twin = twinSession(s, x => x.prep && x.prep.v === 2); if (twin) { s.prep = twin.prep; saveSession(s); status("Prepared.", "live"); } }
  if (!s.prep) {
    status("Preparing — forming identity + persona from the four factors…", "live");
    try {
      const res = await fetch("/api/prep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: cfgOf(s) }) });
      const pack = await res.json();
      if (!res.ok || !Array.isArray(pack.questions)) throw new Error(pack.error || ("prep " + res.status));
      s.prep = pack; s.__authRetried = false; saveSession(s); healAuthSilently();
    } catch (e) {
      if (isAuthError(e)) {                                            // 401: renew the session silently and retry once — wait silently if renewal fails
        if (!s.__authRetried && await recoverLiveAuth()) { s.__authRetried = true; preparePack(s); return; }
        waitForAuthSilently(null); return;
      }
      if (current !== s) return;
      const ph = cards.findIndex(c => c.question === "Preparing…");
      if (ph >= 0) { cards[ph] = { question: "Ready", answer: ["Prep is retrying in the background — you can Start now; answers still generate live."] }; if (ph === idx) renderCard(); }
      status("Prep failed: " + (e && e.message || e) + " — retrying…", "err");
      setTimeout(() => { if (current === s && !s.prep) preparePack(s); }, 4000);
      return;
    }
  }
  if (current !== s) return;
  setPersonaChip(s);
  seedIdentity(s);
  status("Prepared.", "live");
  buildPersonaFile(s).finally(() => { if (current === s) { buildDossier(s); buildBook(s); } });   // persona file first (highest value), then the dossier — both off the clock
}
// Fill the placeholder card with the intro — never wipe answers already on screen (prep can
// finish after the interview has started).
function speakerFirst(s) {
  const lines = String((s && s.resume) || "").split(/\n/).map(l => l.trim()).filter(Boolean).slice(0, 8);
  const title = /^(Senior|Junior|Staff|Lead|Principal|Security|Cyber|Software|Network|Cloud|Data|Director|Manager|Engineer|Analyst|Developer|Architect|Associate|Internal)$/;
  for (const line of lines) {
    const m = line.match(/\b([A-Z][a-z]{2,})\s+[A-Z][a-z]{2,}\b/);
    if (m && !title.test(m[1])) return m[1];
  }
  return "";
}
function seedIdentity(s) {
  window.__speakerName = speakerFirst(s);
  let id = s.prep && s.prep.identity;
  if (id && window.KompasCorrect && window.KompasCorrect.asSpeaker) id = window.KompasCorrect.asSpeaker(id, window.__speakerName);
  const intro = { question: "Your introduction", answer: id ? id.split(/(?<=\.)\s+|\n+/).map(x => x.trim()).filter(Boolean) : ["Press Start — answers appear here."] };
  const ph = cards.findIndex(c => /^(Preparing…|Ready)$/.test(c.question));
  if (ph >= 0) cards[ph] = intro;
  else if (!cards.some(c => c.question === "Your introduction")) { cards.unshift(intro); idx++; }
  if (cards.length === 1) idx = 0;
  renderCard();
}
// Stop, ← and the Connect dialog's Back all leave the same way: capture off, the transcript saved, the run kept for Continue, the box closed.
let leaving = false;
function sessionRecap(list) {
  const rows = (list || []).filter((c) => {
    const q = String(c && c.question || "").replace(/\s+/g, " ").trim();
    const a = typeof (c && c.answer) === "string" ? c.answer.trim() : "";
    return q.length > 0 && a.length > 40 && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(q);
  });
  return rows.slice(-6).map((c) => {
    const q = String(c.question).replace(/\s+/g, " ").trim();
    const first = String(c.answer).split(/\n/)[0].replace(/\s+/g, " ").trim();
    return q + " — " + first;
  }).join("\n");
}
async function leaveLive() {
  if (leaving) return; leaving = true;                                     // a second click while the run is being stored does nothing
  try {
    if (follow.on) setFollow(false);                                       // Follow along holds its own microphone: it goes off with the box
    if (running && captures.length) { status("Saving the last words…", "live"); try { await flushHeard(2000); } catch {} }   // a phrase still being written down lands in the transcript
    if (running) await stop(false);
    const note = sessionRecap(cards);
    if (note && current) { current.note = note; saveSession(current, true); }
    dropScreen();
    await saveRunTranscript(); await pauseRun();
    beat(false); dossierAbort = true; resetLiveState(); openDashboard();
  } finally { leaving = false; }
}
let wrapping = false;
async function wrapSession() {
  if (leaving || wrapping) return;
  wrapping = true;
  const view = $("view-copilot");
  const button = $("startBtn");
  button.disabled = true;
  button.textContent = "Wrapping up";
  view?.classList.add("wrapping");
  status("Session wrapped up.", "live");
  await new Promise((r) => setTimeout(r, 680));
  try { await leaveLive(); }
  finally {
    wrapping = false;
    view?.classList.remove("wrapping");
    const dash = $("view-dashboard");
    dash?.classList.add("arriving");
    setTimeout(() => dash?.classList.remove("arriving"), 700);
    button.disabled = false;
  }
}
// The shared tab or screen is let go when the box closes, so the browser stops showing that it is being shared.
function dropScreen() { if (displayVideo) { try { displayVideo.stop(); } catch {} displayVideo = null; } }
$("exitCopilot").onclick = leaveLive;
window.addEventListener("pagehide", () => {
  if (current && !$("view-copilot").classList.contains("hidden")) { saveRunTranscript(); pauseRun(); }
  beat(false);
  // The whole list is not written here any more: every change is already saved when it is made, and a window that had been idle
  // would write an old list over what another window saved since.
  try { docsSet(docsGet()); } catch {}
});

/* ---- Q&A cards ---- */
function lines(answer) { return (Array.isArray(answer) ? answer : String(answer || "").split(/\n+/)).map(l => String(l).replace(/^[-•*\s]+/, "").trim()).filter(Boolean); }
// Answers are always complete sentences: an old dossier answer's "[the tool you used]" is
// folded into plain words, never shown as a fill-in box.
function unbracket(s) {
  // Only fill-in PLACEHOLDERS are folded away ("[the EDR product you used]" -> "the EDR product",
  // "[blank]" / "[the reduction and timeline]" -> dropped). Real bracket content — "[Event ID 4625]",
  // "logs[idx]", "[::1]", "[a-z]" — is left exactly as written, and nothing else is touched.
  const isPlaceholder = (x) => /\b(you|your)\b/i.test(x) || /^(the|a|an|some|specific|insert)\s/i.test(x)
    || /^\s*(blank|tbd|tba|n\/?a|x|n|metric|number|percent(age)?|date|year|company|employer|tool|name|value|amount|timeframe|duration)\s*$/i.test(x)
    || /^[a-z]+(?:\s+[a-z]+){1,8}$/.test(x.trim());
  let hit = false;
  const out = String(s || "").replace(/\[([^\]\n]{1,90})\]/g, (m, inner) => {
    if (/^(?:pause|beat|breath)$/i.test(String(inner).trim())) return m;   // a spoken pause, not a fill-in
    if (!isPlaceholder(inner)) return m;
    hit = true;
    if (!/\b(you|your)\b/i.test(inner)) return "";
    const t = inner.replace(/\s+(that |which |who )?(you|your)\b.*$/i, "").replace(/^(your|the)\s+/i, "the ").trim();
    return t.split(/\s+/).length >= 2 && !/^(how|what|when|why|where)\b/i.test(t) ? t : "";
  });
  if (!hit) return out;
  return out.replace(/\bby\s*%/g, "").replace(/(^|\s)%/g, "$1")
    .replace(/[,;]\s*([.!?;:])/g, "$1").replace(/ +([,.;:!?])(?=\s|$)/g, "$1").replace(/ {2,}/g, " ");
}
// `__keyword__` = main keyword · *italic* = the word to stress out loud · (pause), [beat] and [breath] = stop and breathe
const PAUSE_MARK = "(?:\\((?:pause|beat|breath)\\)|\\[(?:pause|beat|breath)\\])";
function inline(li, text) {
  // `__keyword__` is the live emphasis mark (asterisks were stripped or shown raw). `**` still accepted.
  for (const part of unbracket(text).split(new RegExp("(`[^`\\n]{1,120}`|__[^_\\n]{1,80}__|\\*\\*[^*\\n]{1,80}\\*\\*|\\*[^*\\s][^*\\n]{0,80}\\*|==[^=\\n]{1,80}==|" + PAUSE_MARK + ")", "i"))) {
    if (!part) continue;
    let el = null;
    if (/^`[^`]+`$/.test(part)) {
      const words = part.slice(1, -1);
      if (window.kompasDesktop) el = document.createTextNode(words);
      else { el = document.createElement("code"); el.textContent = words; }
    }
    else if (/^__[^_].*__$/.test(part) || /^\*\*[^*]+\*\*$/.test(part)) {
      el = document.createElement("strong");
      el.textContent = part.replace(/^__|__$/g, "").replace(/^\*\*|\*\*$/g, "");
    }
    else if (/^==[^=].*==$/.test(part)) { el = document.createElement("strong"); el.textContent = part.slice(2, -2); }
    else if (/^\*[^*]+\*$/.test(part)) { el = document.createElement("em"); el.textContent = part.slice(1, -1); }
    else if (new RegExp("^" + PAUSE_MARK + "$", "i").test(part)) { el = document.createElement("span"); el.className = "pause"; el.textContent = "pause"; }
    li.append(el || document.createTextNode(part));
  }
}
// Passage lines render as prose and "- " lines as bullets. A markdown heading is dropped, not shown as a side heading.
function sayAnswer(text) {
  if (!window.KompasCorrect) return text;
  const cleaned = window.KompasCorrect.correct(text);
  const bulleted = /(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+/.test(String(text || ""));
  return bulleted && window.KompasCorrect.speak ? window.KompasCorrect.speak(cleaned) : cleaned;
}
function answerLines(answer) {
  // He is rehearsing as himself. The stored introduction can still say his name; the line he reads cannot.
  if (Array.isArray(answer)) answer = answer.map(t => String(t).trim()).filter(Boolean).join("\n");
  if (window.KompasCorrect && window.KompasCorrect.asSpeaker) answer = window.KompasCorrect.asSpeaker(String(answer || ""), window.__speakerName);
  if (window.KompasCorrect) answer = sayAnswer(answer);
  if (Array.isArray(answer)) return answer.map(t => ({ t: String(t).trim().replace(/^(?:[-•]|\*(?!\*))\s*/, "").trim(), kind: "bullet" })).filter(x => x.t);
  // Code is visual content even when narration remains spoken. Never execute it.
  const out = []; let code = null, prose = [];
  const flush = () => { if (prose.length) out.push(...proseLines(prose.join("\n"))); prose = []; };
  for (const raw of String(answer || "").split("\n")) {
    if (/^\s*```/.test(raw)) {
      if (code) { out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang }); code = null; }
      else { flush(); code = { lang: raw.replace(/^\s*```/, "").trim(), lines: [] }; }
      continue;
    }
    if (code) { code.lines.push(raw); }
    else prose.push(raw);
  }
  flush();
  if (code) out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang });
  return out;
}
function proseLines(text) {
  return String(text || "").replace(/\*{4,}/g, "").replace(/\*\*\s+\*\*/g, " ").split(/\n+/).map(l => l.trim())
    .filter(l => l && !/^(EXPERIENCE|DESIGN|INTRODUCTION|DRILL-DOWN|SIMPLE|CONSOLIDATED)\b[A-Z /&-]*:?$/.test(l) && !/^<[A-Z][^>]*>$/.test(l))   // never show a template label
    .map(l => {
    if (/^#{1,6}\s+\S/.test(l)) return null;
    const b = l.match(/^(?:(?:[-•]|\*(?!\*)|\d+[.)])\s+)+(.*)$/);      // "- - text" too
    if (b) return { t: b[1], kind: "bullet" };
    if (new RegExp("^" + PAUSE_MARK + "\\.?$", "i").test(l)) return { t: l, kind: "pauseline" };
    return { t: l, kind: "passage" };
  }).filter(Boolean);
}
function renderCard() {
  const c = cards[idx]; if (!c) return;
  // Where you are in the book, and ends that look like ends (owner, 27 Oct 2026: Prev/Next "aren't working" at the first
  // and last card, where they did nothing and showed nothing).
  if ($("cardCount")) $("cardCount").textContent = cards.length > 1 ? `${idx + 1} of ${cards.length}` : "";
  if ($("prevBtn")) $("prevBtn").disabled = idx <= 0;
  if ($("nextBtn")) $("nextBtn").disabled = idx >= cards.length - 1;
  const draft = ($("manualInput") && $("manualInput").value || "").trim();
  $("question").textContent = draft || c.question;
  $("question").title = draft ? "Typed. Press AI Answer to include it." : (c.heard || "");
  const ul = $("answer"), keep = ul.scrollTop;
  const lines = answerLines(c.answer);   // rendering is read-only (book rule, 23 Oct): showing a card never rewrites its stored answer, so flipping back and forth cannot lose or flatten a generated response
  ul.innerHTML = "";
  lines.forEach(({ t, kind, lang }) => {
    const li = document.createElement("li");
    if (kind === "code") {
      li.className = "codeblock"; const pre = document.createElement("pre"), code = document.createElement("code");
      if (lang) pre.dataset.lang = lang; code.textContent = t; pre.append(code); li.append(pre); ul.append(li); return;
    }
    if (kind === "head") return;
    if (kind === "passage") li.className = "passage";
    else if (kind === "pauseline") li.className = "pauseline";
    inline(li, t);
    ul.append(li);
  });
  if (c.meta === "Personal logistics, not answered" && !lines.length) {   // the quiet card (owner, 29 Oct): one muted line, no answer text
    const li = document.createElement("li"); li.className = "skipnote"; li.style.opacity = "0.55"; li.style.fontStyle = "italic";
    li.textContent = "Personal logistics, not answered"; ul.append(li);
  }
  $("card").classList.toggle("streaming", !!c.streaming);
  wrapWords(ul);                                     // every word is addressable, for Follow along
  ul.scrollTop = keep;   // rendering never moves the pane (owner, 27 Oct 2026: while it generates "the screen should just stay on top")
  if (typeof followRendered === "function") followRendered(c);
}
// Wrap each word of the answer in <span class="w"> (skipping the pause pills) so Follow along can mark
// what you've already said, typing-test style.
function wrapWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement && n.parentElement.closest(".pause, pre") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const parts = n.nodeValue.split(/(\s+)/); if (parts.length < 2 && !parts[0]) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) { frag.append(document.createTextNode(p)); continue; }
      const s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.append(s);
    }
    n.replaceWith(frag);
  }
}
function animateCard() { const card = $("card"); card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
const toTop = () => { const ul = $("answer"); if (ul) ul.scrollTop = 0; const c = $("card"); if (c) c.classList.remove("q-away"); };   // a new question opens at the top, where the question line is visible
$("prevBtn").onclick = () => { if (idx > 0) { idx--; renderCard(); toTop(); animateCard(); } };
$("nextBtn").onclick = () => { if (idx < cards.length - 1) { idx++; renderCard(); toTop(); animateCard(); } };
function addCard(question, answer) { const c = { question, answer }; cards.push(c); idx = cards.length - 1; renderCard(); toTop(); animateCard(); return c; }
// A page holds a finished answer: not streaming, and more than the "…" placeholder.
function hasAnswer(c) { const t = (typeof c.answer === "string" ? c.answer : (c.answer || []).join("\n")).trim(); return !c.streaming && t.length > 8 && !/^[.…\s]+$/.test(t); }
// Takes an empty page out of the book. The only page stays (the live view always shows one); returns whether it went.
function dropPage(c) {
  const i = cards.indexOf(c);
  if (i < 0 || cards.length < 2) return false;
  const shown = idx === i;
  cards.splice(i, 1);
  if (idx > i || (shown && idx > 0)) idx--;   // the page you were on stays in view; a removed page in view gives way to the one before it
  idx = Math.min(idx, cards.length - 1);
  renderCard();
  if (shown) toTop();   // reading another page: its place is not moved
  return true;
}
// Copy / Export give what the screen shows: no placeholders, headings as headings, no markdown noise.
function plainAnswer(answer) {
  return answerLines(answer).map(({ t, kind, lang }) => {
    if (kind === "code") return "```" + (lang || "") + "\n" + t + "\n```";
    const x = unbracket(t).replace(/\*\*/g, "").replace(/__/g, "").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2").replace(new RegExp("\\s*" + PAUSE_MARK + "\\s*", "gi"), " ").trim();
    return kind === "head" ? `\n${x}` : kind === "bullet" ? `• ${x}` : kind === "pauseline" ? "" : x;
  }).filter(Boolean).join("\n").trim();
}

function status(msg, tone) { const s = $("status"); s.textContent = msg; s.className = "statusline" + (tone ? " " + tone : ""); }

/* ---- clock (mm:ss) ---- */
let clockTimer = null, startedAt = 0;
function fmtClock(ms) { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0"); }
function startClock() { startedAt = Date.now(); const tick = () => { $("clock").textContent = fmtClock(Date.now() - startedAt); }; tick(); clockTimer = setInterval(tick, 250); }
function stopClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }

/* ---- sources (both ON by default), theme, drawer ---- */
// Computer-audio support is independent of the screen-question capture action.
// The native Electron display handler already permits getDisplayMedia; hiding the
// screen action on desktop made the completed screen review and answering path unreachable.
const NO_SYS_AUDIO = window.kompasDesktop?.systemAudio === false;
const srcOn = { mic: true, sys: !NO_SYS_AUDIO };
if (NO_SYS_AUDIO) $("sysBtn").classList.add("hidden");
if (window.kompasDesktop) {
  $("screenBtn").classList.remove("hidden");
  $("screenCaptureAnswerBtn")?.classList.remove("hidden");
}
function syncSrc() {
  $("micBtn").classList.toggle("on", srcOn.mic); $("sysBtn").classList.toggle("on", srcOn.sys);
  $("micBtn").title = "Microphone (you) — " + (srcOn.mic ? "on" : "off");
  $("sysBtn").title = "Computer audio (interviewer) — " + (srcOn.sys ? "on" : "off");
}
$("micBtn").onclick = async () => { srcOn.mic = !srcOn.mic; syncSrc(); if (running) { if (srcOn.mic) await startMic(); else stopSource("You"); reportSources(); } };
$("sysBtn").onclick = async () => { srcOn.sys = !srcOn.sys; syncSrc(); if (running) { if (srcOn.sys) await startSys(); else stopSource("Them"); reportSources(); } };
syncSrc();
/* Look: paper stays the default. Opacity fades backgrounds only. Letters, including bold words, stay full ink. */
const LOOK_FONTS = {
  times: '"Times New Roman", Times, Georgia, "Nimbus Roman", serif',
  lora: '"Lora", Georgia, "Times New Roman", serif',
  manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
};
function applyLook() {
  const desk = !!window.kompasDesktop;
  const theme = !desk && LS.get("theme", "light") === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  const font = LOOK_FONTS[LS.get("font", "times")] ? LS.get("font", "times") : "times";
  document.documentElement.style.setProperty("--serif", LOOK_FONTS[font]);
  const text = Math.min(40, Math.max(12, Number(LS.get("textSize", 16)) || 16));
  document.documentElement.style.setProperty("--text-size", text + "px");
  const tab = [2, 4, 8].includes(Number(LS.get("tabSize", 4))) ? Number(LS.get("tabSize", 4)) : 4;
  document.documentElement.style.setProperty("--tab-size", String(tab));
  const fade = $("lookFade");
  if (fade) fade.closest(".look-row")?.classList.toggle("hidden", desk);
  if (!desk) {
    const a = Math.min(1, Math.max(0.15, Number(LS.get("opacity", 1)) || 1));
    document.documentElement.style.setProperty("--panel-a", String(a));
    if (fade && document.activeElement !== fade) fade.value = String(Math.round(a * 100));
  }
  const fontSel = $("lookFont"); if (fontSel) fontSel.value = font;
  const textSel = $("lookText"); if (textSel && document.activeElement !== textSel) textSel.value = String(text);
  const textN = $("textSizeN"); if (textN) textN.textContent = String(text);
  const tabSel = $("lookTab"); if (tabSel) tabSel.value = String(tab);
  $("themeLight")?.classList.toggle("on", theme === "light");
  $("themeDark")?.classList.toggle("on", theme === "dark");
}
applyLook();
$("lookFade")?.addEventListener("input", (e) => { const a = Number(e.target.value) / 100; LS.set("opacity", a); applyLook(); });
$("lookFont")?.addEventListener("change", (e) => { LS.set("font", e.target.value); applyLook(); });
$("lookText")?.addEventListener("input", (e) => { LS.set("textSize", Number(e.target.value)); applyLook(); });
function stepText(dir) {
  const next = Math.min(40, Math.max(12, (Number(LS.get("textSize", 16)) || 16) + dir));
  LS.set("textSize", next); applyLook();
}
$("textMinus")?.addEventListener("click", () => stepText(-2));
$("textPlus")?.addEventListener("click", () => stepText(2));
window.addEventListener("kompas-text-size", () => applyLook());
const answerPane = $("answer");
function syncQuestion() { const card = $("card"); if (card && answerPane && answerPane.scrollTop > 2) card.classList.add("q-away"); }   // scrolling down hides the question; only an overscroll gesture brings it back
answerPane?.addEventListener("scroll", syncQuestion, { passive: true });
// Overscroll reveal (owner, 26 Oct): at the very top, one more scroll up shows the
// question again — reaching the top alone never does. Wheel-up at the top reveals
// at once (the arriving wheel event itself cannot, it sees the pane above the top).
// Touch is two-phase (27 Oct): the drag must START at the top, so a drag that
// arrives at the top mid-stroke never reveals, however far it pulls past it —
// scrolling up to read must not pop the question back. Scrolling down anywhere on
// the card hides it, smoothly, so only the response box stays in view.
function touchReveal(startTop, top, pull) { return startTop <= 0 && top <= 0 && pull > 24; }
// Touch reveal wiring ends here.
$("card")?.addEventListener("wheel", (e) => { const card = $("card"); if (!card) return; if (e.deltaY > 0) card.classList.add("q-away"); else if (e.deltaY < 0 && answerPane && answerPane.scrollTop <= 0) card.classList.remove("q-away"); }, { passive: true });
let touchStartY = 0, touchStartTop = 0;
$("card")?.addEventListener("touchstart", (e) => { touchStartY = (e.touches[0] && e.touches[0].clientY) || 0; touchStartTop = answerPane ? answerPane.scrollTop : 0; }, { passive: true });
$("card")?.addEventListener("touchmove", (e) => { const card = $("card"); if (!card) return; const y = (e.touches[0] && e.touches[0].clientY) || 0; if (answerPane && touchReveal(touchStartTop, answerPane.scrollTop, y - touchStartY)) card.classList.remove("q-away"); else if (touchStartY - y > 24) card.classList.add("q-away"); }, { passive: true });
$("lookTab")?.addEventListener("change", (e) => { LS.set("tabSize", Number(e.target.value)); applyLook(); });
// The model that writes answers. Empty is the server's own lanes; the server ignores anything not on its list.
const LIVE_MODELS = ["", "gpt-5.6-luna"];
const liveModel = () => { const m = LS.get("liveModel", ""); return LIVE_MODELS.includes(m) ? m : ""; };
if ($("liveModel")) $("liveModel").value = liveModel();
$("liveModel")?.addEventListener("change", (e) => LS.set("liveModel", LIVE_MODELS.includes(e.target.value) ? e.target.value : ""));
$("themeLight")?.addEventListener("click", () => { LS.set("theme", "light"); applyLook(); });
$("themeDark")?.addEventListener("click", () => { LS.set("theme", "dark"); applyLook(); });
$("collapseBtn").onclick = () => $("overlay").classList.toggle("collapsed");
$("hideBtn").onclick = () => $("overlay").classList.toggle("collapsed");
$("transcriptBtn").onclick = () => $("drawer").classList.toggle("hidden");
$("personaBtn").onclick = () => openPersonaFile();
$("clearBtn").onclick = () => { if (window.KompasScreenReset) window.KompasScreenReset(); cards = [{ question: "Cleared.", answer: ["Ask something, or let the call fill this in."] }]; idx = 0; transcript = []; lastCaption = ""; captionAnnounced = false; answeredSeq = heardSeq; updatePending(); renderDrawer(); renderCard(); status("Cleared."); };
// Three asking levels. On the desktop, each level keeps its own answer for the
// question on screen, and a switch shows that answer or starts it at once.
// v3 drops answers stored before the question-depth correction.
const DESKTOP_RESPONSE_LEVELS = ["engineer", "architect", "director"];
const desktopResponses = () => !!window.kompasDesktop;
const desktopResponseKey = (card) => `three-level-v4|${askingLevel()}|${liveConfig().mode}|${liveConfig().length || ""}|${String(card && (card.anchorQ || card.question) || "").trim()}`;
const LADDER_THREE = ["engineer", "architect", "director"];
const ladderFor = () => LADDER_THREE;
let LADDER = LADDER_THREE;
function showCodingLevels(sel, mode) {
  if (!sel) return;
  sel.querySelectorAll("option[data-coding]").forEach(o => { o.hidden = mode !== "coding"; o.disabled = mode !== "coding"; });
  void mode;
}
// A session saved on a level that is no longer offered opens on the nearest one kept, never on a blank list.
function keptLevel(v, mode) {
  const near = { hr: "engineer", technical_hr: "engineer", analyst: "engineer", developer: "architect", peer: "engineer", supervisor: "director", lead: "director" };
  return ladderFor(mode).includes(v) ? v : near[v] || "engineer";
}
function renderDepth() {
  const box = $("depthBars"); if (!box) return;
  const who = $("liveInterviewer").value, i = LADDER.indexOf(who);
  if (box.children.length !== LADDER.length) { box.replaceChildren(); LADDER.forEach((_, k) => { const b = document.createElement("i"); b.style.height = (5 + k * 1.6).toFixed(1) + "px"; box.append(b); }); }
  [...box.children].forEach((b, k) => b.classList.toggle("on", i >= 0 && k <= i));
  const label = $("liveInterviewer").selectedOptions[0].textContent;
  $("depthMeter").title = i >= 0 ? `Answer depth ${i + 1} of ${LADDER.length}: ${label} — ↑ lighter · ↓ deeper. A stored level is instant.` : "Peer mirrors the level already selected.";
  $("whoUp").disabled = i === 0; $("whoDown").disabled = i === LADDER.length - 1;
}
let regenTimer = null;
let shownLevel = "engineer";
function levelKey() { return `${askingLevel()}|${liveConfig().mode}|${liveConfig().length || ""}`; }
function stashShown(card) {
  if (!card || !shownLevel || card.streaming) return;
  const text = typeof card.answer === "string" ? card.answer.trim() : "";
  if (text.length < 40) return;
  card.byDepth = card.byDepth || {};
  card.byDepth[`${shownLevel}|${liveConfig().mode}|${liveConfig().length || ""}`] = { answer: card.answer, meta: card.meta || "" };
  if (desktopResponses()) {   // the desktop store too, keyed by the level being left — without this, a level switch on desktop could strand the answer that was on screen (book rule, 23 Oct)
    card.desktopByDepth = card.desktopByDepth || {};
    const q = String(card.anchorQ || card.question || "").trim();
    card.desktopByDepth[`three-level-v4|${shownLevel}|${liveConfig().mode}|${liveConfig().length || ""}|${q}`] = { answer: card.answer, meta: card.meta || "" };
  }
}
function showCachedLevel(card) {
  const hit = card && card.byDepth && card.byDepth[levelKey()];
  if (!hit || !hit.answer) return false;
  card.answer = hit.answer;
  card.meta = hit.meta || "cached";
  card.streaming = false;
  if (cards[idx] === card) renderCard();
  return true;
}
function sayAloud(s) {
  return String(s || "")
    .replace(/&amp;/gi, " and ")
    .replace(/\bx-amp\b/gi, "and")
    .replace(/&gt;=/gi, " at least ")
    .replace(/&lt;=/gi, " at most ")
    .replace(/&gt;/gi, " greater than ")
    .replace(/&lt;/gi, " less than ")
    .replace(/&quot;|&#39;|&apos;/gi, "")
    .replace(/>=\s*(\d+)/g, "at least $1")
    .replace(/<=\s*(\d+)/g, "at most $1")
    .replace(/>\s*(\d+)/g, "greater than $1")
    .replace(/<\s*(\d+)/g, "less than $1")
    .replace(/\s+&\s+/g, " and ")
    .replace(/[ \t]*;[ \t]*/g, " ")
    .replace(/\band\s+and\b/gi, "and")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[ \t]{2,}/g, " ");
}
function regenerateForAudience() {
  if (typeof logAction === "function") logAction("regen", { to: $("liveInterviewer").value });
  const c = cards[idx], label = $("liveInterviewer").selectedOptions[0].textContent;
  if (c && c.req) { const previous = c.req; c.req = null; try { previous.abort(); } catch {} if (typeof answerCtl !== "undefined" && answerCtl === previous) answerCtl = null; }   // only this page's request: another page's answer keeps streaming
  if (c) c.streaming = false;
  if (!c || /^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(c.question) || !String(c.question).trim()) { status("Now answering for: " + label, "live"); return; }
  if (desktopResponses()) {
    const hit = c.desktopByDepth && c.desktopByDepth[desktopResponseKey(c)];
    if (c.req) { const previous = c.req; c.req = null; previous.abort(); }
    if (hit) { c.answer = hit.answer; c.streaming = false; c.meta = hit.meta; renderCard(); status("Shown for " + label, "live"); return; }
    if (c.desktopWarm && c.desktopWarm[desktopResponseKey(c)]) { c.answer = ["Preparing…"]; c.streaming = true; renderCard(); status("Preparing " + label, "live"); return; }
    c.answer = ["Preparing…"];
    c.anchorFlight = "";
    // A level change answers the question already on the card, whole, at the new level (owner, 27 Oct 2026: "Changing
    // the mode or level just gave me introduction"). Unpinned, the server re-cut a question out of everything heard,
    // which opened with the introduction, and answered that instead.
    if (c.heard) generateAnswer(c.heard, c, { consolidated: true, earlier: c.earlier || "", derived: c.anchorQ || c.question, regen: true, pinned: true });
    else generateAnswer(c.question, c, { regen: true, derived: c.question, pinned: true });
    return;
  }
  if (showCachedLevel(c)) { status("Shown for " + label + " — no model call.", "live"); return; }
  if (paintFromAnchors(c)) { status("Shown for " + label + " — no model call.", "live"); return; }
  const need = window.KompasDiamond && window.KompasDiamond.plan(askingLevel(), c.anchors || {}, window.__peerOf);
  const out = window.KompasFlight && need && window.KompasFlight.pending(c, need.from);
  if (out) {                                                      // that anchor is already being written: wait for it, never a second call
    status("Preparing that answer…", "live");
    out.catch(() => {}).then(() => { if (cards[idx] === c && !paintFromAnchors(c)) regenerateForAudience(); });
    return;
  }
  if (c.anchorFlight) { status("Preparing that answer…", "live"); return; }
  status("Preparing the matching answer…", "live");
  if (c.heard) generateAnswer(c.heard, c, { consolidated: true, earlier: c.earlier || "", derived: c.question, regen: true, pinned: true });
  else if (!/^🖥/.test(c.question)) generateAnswer(c.question, c, { regen: true, derived: c.question, pinned: true });
}
function audienceChanged() {
  stashShown(cards[idx]);
  shownLevel = $("liveInterviewer").value;
  if (current) { current.interviewer = shownLevel; saveSession(current); }
  renderDepth();
  clearTimeout(regenTimer);
  regenerateForAudience();
}
$("liveInterviewer").onchange = () => audienceChanged();
function stepInterviewer(dir) {
  const sel = $("liveInterviewer");
  let i = LADDER.indexOf(sel.value);
  if (i < 0) i = dir > 0 ? LADDER.indexOf("engineer") - 1 : LADDER.indexOf("engineer") + 1;   // from Peer, step onto the ladder mid-way
  const next = Math.max(0, Math.min(LADDER.length - 1, i + dir));
  if (LADDER[next] === sel.value) return;
  sel.value = LADDER[next];
  status(`Depth ${next + 1}/${LADDER.length}: ${sel.selectedOptions[0].textContent}${dir > 0 ? " — deeper" : " — lighter"}`, "live");
  audienceChanged();
}
$("whoUp").onclick = () => stepInterviewer(-1);
$("whoDown").onclick = () => stepInterviewer(1);
renderDepth();

function warmDesktopLevels(card, question) {
  if (!desktopResponses() || !card) return;
  const mode = liveConfig().mode, length = liveConfig().length || "";
  const q = String(question || card.anchorQ || card.question || "").trim();
  if (q.length < 8) return;
  card.desktopByDepth = card.desktopByDepth || {};
  card.desktopWarm = card.desktopWarm || {};
  for (const level of DESKTOP_RESPONSE_LEVELS) {
    if (level === askingLevel()) continue;
    const key = `three-level-v4|${level}|${mode}|${length}|${q}`;
    if (card.desktopByDepth[key] || card.desktopWarm[key]) continue;
    const ctl = new AbortController();
    card.desktopWarm[key] = ctl;
    fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ stream: false, client: BUILD, question: q, config: { ...liveConfig(), interviewer: level, level, responseCalibration: "three-level-v1" }, prep: slimPrep(), history: recentQA(card) }) })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const text = data && data.text;
        if (!text || !String(text).trim()) return;
        card.desktopByDepth[key] = { answer: sayAnswer(sayAloud(text)), meta: "warm" };   // symbols as words, then his corrections
        if (cards[idx] === card && desktopResponseKey(card) === key) {
          card.answer = card.desktopByDepth[key].answer;
          card.streaming = false;
          card.meta = "warm";
          renderCard();
          const label = $("liveInterviewer").selectedOptions[0];
          status("Shown for " + (label ? label.textContent : level), "live");
        }
      })
      .catch(() => {})
      .finally(() => { if (card.desktopWarm) delete card.desktopWarm[key]; });
  }
}
/* ---- start / stop ---- */
let running = false;
$("startBtn").onclick = () => running ? wrapSession() : start();

function providerLeak(text) {
  return /\bopenrouter\b|\btry again in\s+\d|\btokens per minute\b|\bOPENROUTER_[A-Z0-9_]+\b|\banswer engine is at its limit\b|\bpaid provider is temporarily\b|\bpaid answer service returned\b/i.test(String(text || ""));
}
function isUnavailableAnswer(meta, text) {
  return !!meta.degraded && /answer engine is busy|answer engine hit an error|answer engine is at its limit|press AI Answer again|paid answer service returned|engine unavailable|groq's free/i.test(String(text || ""));
}
function beforeSessionNotice(message) {
  const m = String(message || "");
  if (/credit|402|quota|allowance/i.test(m)) return "Session has not started. The answer service has no credit left.";
  if (/sign in|401|403|not signed/i.test(m)) return "Session has not started. Sign in again, then check again.";
  return "Session has not started. The answer service is not ready. Check again before starting.";
}
let sessionReadyUntil = 0;
let sessionCheckPending = false;
async function checkSessionReadiness() {
  if (sessionCheckPending) return;
  sessionCheckPending = true;
  const button = $("startBtn");
  button.disabled = true;
  button.textContent = "Checking…";
  status("Connecting…", "live");
  try {
    const response = await fetch("/api/answer", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ preflight: true }), signal: AbortSignal.timeout(50000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ready !== true) throw new Error(result.error || "The answer service is not ready. Please check again before starting.");
    sessionReadyUntil = Date.now() + 30000;
    button.textContent = "Start session";
    status("Answer service ready. Press Start session to connect your audio.", "live");
  } catch (error) {
    sessionReadyUntil = 0;
    button.textContent = "Check again";
    status(beforeSessionNotice(error.message), "err");
  } finally { button.disabled = false; sessionCheckPending = false; }
}

async function start() {
  if (Date.now() >= sessionReadyUntil) { await checkSessionReadiness(); return; }
  sessionReadyUntil = 0;
  const generation = sourceGeneration.You;
  primeAudio();                       // inside the click, so the browser lets audio run
  if (!srcOn.mic && !srcOn.sys) { srcOn.mic = srcOn.sys = true; syncSrc(); }
  running = true;
  $("startBtn").textContent = "Stop"; $("startBtn").classList.add("on");
  document.querySelector(".rec").classList.add("live");
  status("Starting capture…", "live");
  captureErrors = [];
  const opening = [];
  if (srcOn.sys) opening.push(startSys());
  if (srcOn.mic) opening.push(startMic());
  await Promise.allSettled(opening);
  if (!running || generation !== sourceGeneration.You) return;
  if (!captures.length) { status(captureErrors.join(" · ") || "Nothing to capture.", "err"); stop(false); return; }
  startClock();
  markRun();
  reportSources();
  // Phone mic-only sessions: say so plainly — the mic hears both sides,
  // because phones have no separate call-audio capture (owner, 31 Oct 2026).
  // The tip element is optional: guard the DOM call so extracted-function
  // tests with minimal $ stubs (classList without remove) still pass.
  if (!captures.some(c => c.who === "Them") && (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function")) {
    const phoneTipEl = $("phoneTip");
    if (phoneTipEl && phoneTipEl.classList && typeof phoneTipEl.classList.remove === "function") phoneTipEl.classList.remove("hidden");
  }
}
async function stop(say = true) {
  running = false;
  $("startBtn").textContent = "Start"; $("startBtn").classList.remove("on");
  document.querySelector(".rec").classList.remove("live"); stopClock();
  const finishing = [stopSource("You"), stopSource("Them")];
  $("startBtn").disabled = true;
  await Promise.allSettled([...finishing, ...finals]);
  $("startBtn").disabled = false;
  if (say && transcriptionFailedEpoch !== transcriptionEpoch) status("Stopped — finished processing captured speech.");
  await saveRunTranscript();
}
function reportSources() {
  if (!running) return;
  const on = captures.map(c => c.who === "You" ? "your mic" : "call audio");
  status(`Listening — ${on.join(" + ") || "nothing"}${captureErrors.length ? " · " + captureErrors.join(" · ") : ""}. ${autoOn ? "Auto: when the speaker goes quiet, everything heard becomes one question and gets answered." : "Press AI Answer (Ctrl+Enter) — everything heard becomes one question, answered in full."}`, captureErrors.length ? "err" : "live");
}

/* ---- capture: voice-activity detection per source ---- */
let sourceGeneration = { You: 0, Them: 0 };
let captures = [];           // { who, stream, owner, rec, chunks, ... }
let captureErrors = [];
let audioCtx = null;
let displayVideo = null;     // kept from the call-audio share, reused by Analyse Screen
const VAD = { SILENCE_MS: 1100, MIN_SPEECH_MS: 160, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000, INTERIM_MS: 3000 };
const LEVEL_WORKLET = "class L extends AudioWorkletProcessor{constructor(){super();this.a=0;this.n=0}process(i){const c=i[0]&&i[0][0];if(c){let s=0;for(let k=0;k<c.length;k++)s+=c[k]*c[k];this.a+=s;this.n+=c.length;if(this.n>=1024){this.port.postMessage(Math.sqrt(this.a/this.n));this.a=0;this.n=0}}return true}}registerProcessor('perfact-level',L);";
function pickMime() { for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch {} } return ""; }
const MIME = pickMime();
function audioNeedsResume(state) { return state === "suspended" || state === "interrupted"; }
function primeAudio() {
  try {
    if (!audioCtx || audioCtx.state === "closed") audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioNeedsResume(audioCtx.state)) audioCtx.resume().catch(() => {});
    window.__kompasAudio = audioCtx;
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (running && document.visibilityState === "visible") primeAudio();
});
window.addEventListener("focus", () => { if (running) primeAudio(); });
async function getCtx() {
  primeAudio();
  if (audioNeedsResume(audioCtx.state)) { try { await audioCtx.resume(); } catch {} }
  if (!audioCtx._lvl) {
    try { const url = URL.createObjectURL(new Blob([LEVEL_WORKLET], { type: "text/javascript" })); await audioCtx.audioWorklet.addModule(url); URL.revokeObjectURL(url); audioCtx._lvl = "worklet"; }
    catch { audioCtx._lvl = "analyser"; }
  }
  return audioCtx;
}
function micError(e) {
  const n = e && e.name;
  if (n === "NotAllowedError") return "blocked — allow the microphone in the address bar";
  if (n === "NotFoundError") return "no microphone found";
  if (n === "NotReadableError") return "in use by another app (close Zoom's mic test / other tabs)";
  return (e && e.message) || String(e);
}
async function startMic() {
  const generation = sourceGeneration.You;
  if (captures.some(c => c.who === "You")) return;
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    await attachSource(mic, "You", null, generation);
  } catch (e) { if (generation !== sourceGeneration.You || !running) return; captureErrors.push("Mic: " + micError(e)); srcOn.mic = false; syncSrc(); }
}
async function startSys() {
  const generation = sourceGeneration.Them;
  if (captures.some(c => c.who === "Them")) return;
  // Phones have no system-audio capture: getDisplayMedia does not exist on
  // mobile browsers. Never attempt it there — the phone mic hears both sides,
  // and attempting it only produced a raw TypeError. (Owner, 31 Oct 2026:
  // mobile audio never arrived the way desktop call audio does.)
  // typeof navigator is the guard: the bare identifier throws where no
  // navigator exists at all (test VMs), while typeof alone is safe.
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    captureErrors.push("Call audio: not available on phones — the phone mic hears both sides");
    srcOn.sys = false; syncSrc(); return;
  }
  try {
    // systemAudio and selfBrowserSurface belong to the browser share dialog. Electron answers "Not supported"
    // to that pair before main.js can hand back the output-mix loopback, so the desktop asks for video and
    // audio only and the handler supplies the computer's sound.
    const disp = window.kompasDesktop
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include", selfBrowserSurface: "exclude" });
    const audio = disp.getAudioTracks();
    if (!audio.length) {
      disp.getTracks().forEach(t => t.stop());
      captureErrors.push("Call audio: none shared — choose the meeting TAB and tick “Share tab audio” (or Entire screen + “Share system audio”)");
      srcOn.sys = false; syncSrc(); return;
    }
    await attachSource(new MediaStream(audio), "Them", disp, generation);
  } catch (e) { if (generation !== sourceGeneration.Them || !running) return; captureErrors.push("Call audio: " + (e && e.name === "NotAllowedError" ? "share cancelled" : (e && e.message || e))); srcOn.sys = false; syncSrc(); }
}
// Silence warning, shared by both capture tracks (parity, 1 Nov 2026): the microphone warned after 20 s of
// silence, but the shared-audio track warned never, so a quiet or wrongly shared tab failed silently with no
// on-screen word. The helper is pure so the rule is testable: same 20 s threshold, same once-per-silence flag
// (vadStep already resets zeroWarned when sound returns), one message per track.
function silenceWarningFor(cap, now) {
  if (!cap || cap.zeroWarned) return null;
  if (now - (cap.lastAudibleAt || now) <= 20000) return null;
  if (cap.who === "You") return "Kompas is hearing silence from the microphone. Check the input device in your system sound settings, then keep talking.";
  if (cap.who === "Them") return "Kompas is hearing silence from the shared audio. Check the shared tab is playing sound and tab audio is shared, then keep playing.";
  return null;
}
async function attachSource(stream, who, owner, generation = sourceGeneration[who]) {
  const stale = () => !running || generation !== sourceGeneration[who] || !srcOn[who === "You" ? "mic" : "sys"] || captures.some(c => c.who === who);
  const releaseTracks = () => { stream.getTracks().forEach(t => t.stop()); owner?.getTracks().forEach(t => t.stop()); };
  if (stale()) { releaseTracks(); return; }
  let ctx;
  try { ctx = await getCtx(); } catch (error) { releaseTracks(); throw error; }
  if (stale()) { releaseTracks(); return; }
  if (who === "Them") displayVideo = owner?.getVideoTracks()[0] || null;
  const src = ctx.createMediaStreamSource(stream);
  const cap = { who, stream, owner, src, stopped: false, rec: null, chunks: [], segStart: 0, speechMs: 0, lastVoice: 0, lastTick: 0, voiced: false, noise: 0.001, interimAt: 0, inflight: 0, lastVadAt: performance.now(), lastAudibleAt: performance.now(), zeroWarned: false, watchdog: null, an: null };
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  // Parity (owner, 1 Nov 2026): the mic gets browser auto-gain, the raw
  // system loopback gets none, so quiet call audio sat under the VAD floor
  // and dropped every 6 s while the mic transcribed fine. A Them-only tap
  // gain lifts the measured level (never the recorded stream) into the same
  // working range. VAD thresholds untouched; Whisper input untouched.
  let tap = null;
  try { if (who === "Them" && typeof ctx.createGain === "function") { tap = ctx.createGain(); tap.gain.value = 4; src.connect(tap); } } catch { tap = null; }
  const tapSrc = tap || src;
  tapSrc.connect(an); cap.an = an; cap.tap = tap;
  if (ctx._lvl === "worklet") {
    const node = new AudioWorkletNode(ctx, "perfact-level");
    node.port.onmessage = (e) => vadStep(cap, e.data);
    const sink = ctx.createGain(); sink.gain.value = 0;
    tapSrc.connect(node); node.connect(sink); sink.connect(ctx.destination);
    cap.node = node; cap.sink = sink;
  } else {
    const buf = new Float32Array(an.fftSize);
    cap.timer = setInterval(() => { an.getFloatTimeDomainData(buf); let s = 0; for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k]; vadStep(cap, Math.sqrt(s / buf.length)); }, 30);
    cap.node = an;
  }
  // Capture watchdog (owner report, 21 Oct 2026: "sometimes it picks up
  // nothing even when I scream into the microphone"): if the level meter
  // stalls or the audio context suspends mid-session, vadStep never runs,
  // no phrase is ever marked as speech, and everything is silently
  // discarded. The watchdog revives the context, falls back to the analyser
  // meter when the worklet stops reporting, and says so on screen when the
  // microphone itself is delivering silence.
  cap.watchdog = setInterval(() => {
    if (cap.stopped || !running) return;
    if (audioCtx && audioNeedsResume(audioCtx.state)) primeAudio();
    const now = performance.now();
    if (now - (cap.lastVadAt || 0) > 3000 && !cap.timer && cap.an) {
      const buf = new Float32Array(cap.an.fftSize);
      cap.timer = setInterval(() => { cap.an.getFloatTimeDomainData(buf); let s = 0; for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k]; vadStep(cap, Math.sqrt(s / buf.length)); }, 30);
    }
    const warn = silenceWarningFor(cap, now);
    if (warn) {
      cap.zeroWarned = true;
      status(warn, "err");
    }
  }, 1000);
  const tracks = owner ? owner.getTracks() : stream.getAudioTracks();
  for (const track of tracks) {
    track.addEventListener("ended", () => {
      if (cap.stopped) return;
      void stopSource(who);
      srcOn[who === "You" ? "mic" : "sys"] = false; syncSrc();
      captureErrors.push(who === "You" ? "Microphone disconnected. Reconnect it and press the mic button." : "Call sharing ended. Press the speaker button to share audio again.");
      reportSources();
      if (!captures.length) void stop(false);
    });
    if (track.kind === "audio") {
      track.addEventListener("mute", () => { if (!cap.stopped && running) status(`${who === "You" ? "Microphone" : "Call audio"} is interrupted. Check the device or return to this tab.`, "err"); });
      track.addEventListener("unmute", () => { if (!cap.stopped) reportSources(); });
    }
  }
  captures.push(cap);
  try { startSegment(cap); } catch (error) { captureErrors.push("Audio recorder: " + (error.message || "could not start")); await stopSource(who); throw error; }
}
function stopSource(who) {
  sourceGeneration[who]++;
  const finishing = [];
  for (const cap of captures.filter(c => c.who === who)) {
    cap.stopped = true; stopCaptions(cap);
    finishing.push(endSegment(cap, cap.voiced, false));
    try { cap.src.disconnect(); cap.node && cap.node.disconnect(); cap.sink && cap.sink.disconnect(); cap.tap && cap.tap.disconnect(); } catch {}
    if (cap.timer) clearInterval(cap.timer);
    if (cap.watchdog) clearInterval(cap.watchdog);
    try { cap.stream.getTracks().forEach(t => t.stop()); } catch {}
    try { cap.owner && cap.owner.getTracks().forEach(t => t.stop()); } catch {}
    meter(who, 0, false);
  }
  captures = captures.filter(c => c.who !== who);
  if (who === "Them") displayVideo = null;
  return Promise.allSettled(finishing);
}
// Who can open a question (slice 2, 29 Oct 2026): askSource() maps each capture through roleOfSource(), so computer
// audio is the interviewer and, while it is captured, mic words never open a question. With no computer audio the mic
// is the only voice, so it keeps opening questions as before, labelled "mic-only" in the session log. If the mapping
// ever throws, the old rule answers.
let lastSourceMode = "";
function questionSource() {
  let pick;
  try { pick = askSource(captures.map(c => c.who)); } catch { return captures.some(c => c.who === "Them") ? "Them" : "You"; }
  if (pick.mode !== lastSourceMode && captures.length) { lastSourceMode = pick.mode; logDecision(pick.reason, pick.source, ""); }
  return pick.source;
}

function startSegment(cap) {
  cap.chunks = []; cap.segStart = performance.now(); cap.speechMs = 0; cap.voiced = false; cap.interimAt = 0;
  let rec; try { rec = new MediaRecorder(cap.stream, MIME ? { mimeType: MIME } : undefined); } catch (error) { cap.rec = null; throw error; }
  const chunks = cap.chunks;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onerror = () => {
    if (cap.stopped || cap.rec !== rec) return;
    captureErrors.push("Audio recorder interrupted. Reconnect using the mic or speaker button.");
    srcOn[cap.who === "You" ? "mic" : "sys"] = false; syncSrc();
    void stopSource(cap.who); reportSources();
    if (!captures.length) void stop(false);
  };
  try { rec.start(250); } catch (error) { cap.rec = null; throw error; }
  cap.rec = rec;
}
const finals = new Set();              // final transcriptions still in flight (AI Answer waits for them)
function segmentKept(speech, keep, force) {
  return !!(keep && (Number(speech) >= 160 || !!force));
}
function flushAction(cap, now) {
  if ((cap.speechMs || 0) >= 60) return "keep";
  const segStart = cap.segStart == null ? now : cap.segStart;
  const lastVad = cap.lastVadAt == null ? now : cap.lastVadAt;
  if (cap.rec && now - segStart > 1500 && now - lastVad > 3000) return "rescue";
  return "wait";
}
function endSegment(cap, keep, restart = true, force = false) {
  const rec = cap.rec, chunks = cap.chunks, speech = cap.speechMs;
  const epoch = transcriptionEpoch;
  const prompt = whisperPrompt();
  const spokenAt = spokenWallTime(cap.lastVoice, performance.now(), Date.now());   // when the words were said, not when the text came back
  if (restart && !cap.stopped) {
    try { startSegment(cap); } catch {
      cap.rec = null;
      status("Audio recording stopped unexpectedly. Press Stop, then Start to reconnect.", "err");
      queueMicrotask(() => stopSource(cap.who));
    }
  }
  else cap.rec = null;
  if (!rec) return Promise.resolve();
  let settle;
  const done = new Promise(r => { settle = r; });
  finals.add(done); done.then(() => finals.delete(done));
  rec.onstop = () => {
    if (!segmentKept(speech, keep, force)) return settle();
    const blob = new Blob(chunks, { type: rec.mimeType || MIME || "audio/webm" });
    if (blob.size) transcribe(blob, cap.who, { final: true, epoch, prompt, speechMs: speech, spokenAt }).then(settle, settle); else settle();
  };
  try { rec.stop(); } catch { settle(); }
  const watchdog = setTimeout(() => {
    if (epoch === transcriptionEpoch) status("Audio processing stalled. Check your connection and retry AI Answer.", "err");
    settle(false);
  }, 42000);
  done.then(() => clearTimeout(watchdog));
  return done;
}
// AI Answer pressed mid-sentence: cut every open phrase now and wait (briefly) for its words.
async function flushHeard(maxMs = 43000) {
  for (const cap of captures) {
    const act = flushAction(cap, performance.now());
    if (act === "keep") endSegment(cap, true, true, cap.speechMs < VAD.MIN_SPEECH_MS);
    else if (act === "rescue") endSegment(cap, true, true, true);
  }
  const wait = [...finals];
  if (!wait.length) return;
  let timer;
  try {
    const results = await Promise.race([Promise.all(wait), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Still processing your last words. Retry AI Answer shortly.")), maxMs);
    })]);
    if (results.some(result => result === false)) throw new Error("Some speech could not be transcribed. Please repeat it or type it before requesting an answer.");
  } finally { clearTimeout(timer); }
}
// Five dictation levels, each one decided before the next is trusted.
// 1. A scream is speech on the first sample, and it pulls a climbed floor back down.
// 2. A short start (a question word, a soft onset) is transcribed at the idle recycle, not dropped.
// r4 (item 24): the server reports every guard repair (landed / partial / discarded / failed) but the card never showed
// it, so a repair that failed looked the same as one that landed. Empty when no repair was needed or no status came back.
function repairBadge(r) {
  if (!r || !r.status || r.status === "not-needed") return "";
  const lost = r.survived === false ? " (lost in trim)" : "";
  return ({ landed: " · ✓ repair landed", partial: " · ◐ repair partial", discarded: " · ✗ repair discarded", failed: " · ✗ repair failed", "no-key": " · ✗ repair skipped (no key)" }[r.status] || "") + (r.status === "landed" || r.status === "partial" ? lost : "");
}

// 3. Phrase repair and the security lexicon live in fixPhrases and whisperPrompt.
// 4. An empty decode of real speech is sent once more with a bare prompt.
// 5. heardDraft shows what landed, and a greeting does not become the question.
function dictateStep(cap, rms, now, vad) {
  const V = vad || { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 };
  let noise = Number(cap.noise) || 0.001, speechMs = cap.speechMs || 0, voiced = !!cap.voiced;
  let lastVoice = cap.lastVoice || 0, lastTick = cap.lastTick || 0;
  // Slice 12: the floor also learns a steady level it is stuck under. Over each 1.5 s the quietest level is kept; when even
  // that sits well above the floor (a fan, line hiss, call comfort noise), the floor moves halfway up to it. Speech always
  // dips between words, so speech over a quiet room leaves the floor where it was.
  let floorMin = Number.isFinite(cap.floorMin) ? Math.min(cap.floorMin, rms) : rms, floorAt = Number.isFinite(cap.floorAt) ? cap.floorAt : now;
  if (now - floorAt >= 1500) {
    if (floorMin > noise * 1.5 && floorMin < 0.05) noise = noise + (floorMin - noise) * 0.5;
    floorMin = rms; floorAt = now;
  }
  const scream = rms >= 0.08 || (noise > 0.008 && rms > noise * 6);
  if (scream && noise > rms * 0.2) noise = Math.max(0.001, rms * 0.12);
  const threshold = Math.max(0.003, noise * 2.5);
  const speaking = scream || rms > threshold;
  if (!speaking && rms < threshold * 0.7) noise = noise * 0.995 + rms * 0.005;
  const dt = lastTick ? Math.min(speaking ? 400 : 100, Math.max(0, now - lastTick)) : 20;
  lastTick = now;
  if (speaking) { lastVoice = now; speechMs += dt; if (scream || speechMs > 120) voiced = true; }
  const segLen = now - (cap.segStart == null ? now : cap.segStart);
  let action = "listen";
  if (voiced && now - lastVoice > V.SILENCE_MS) action = "end";
  else if (segLen > V.MAX_SEG_MS) action = voiced ? "end" : "drop";
  else if (!voiced && segLen > V.IDLE_RECYCLE_MS) action = speechMs >= 60 ? "rescue" : "drop";
  return { noise, speechMs, voiced, lastVoice, lastTick, speaking, scream, action, floorMin, floorAt };
}
// Audio-silence watchdog hooks (slice 5d, 29 Oct 2026), the web side of desktop-patches/audio-silence-watchdog.md.
// The desktop's 3 s audio pulse reads them; nothing on this page reads or calls them. They can never break capture:
//  - window.__kompasLevels = { peak, at }: the louder of mic / call audio over the last ~1 s, written from the RMS
//    the VAD already computes. Writing it is read-only for capture and every write sits in try/catch.
//  - window.__kompasTracks: [mic track, call-audio track] that are attached now (a source that is off is left out).
//  - window.__kompasRestartCapture(): stops and re-acquires the sources attached now and rewires the AudioContext.
//    Only on an explicit call, only while capturing, one restart at a time, never throws, never navigates or
//    touches sign-in. The call-audio share is re-acquired only on the desktop (a browser would ask for the share
//    dialog again); there the page restarts the mic only.
//  - window.__kompasLiveActivity (getter): true while any capture runs or any card streams an answer, false
//    otherwise. The shell's release-aware restore reads it before reloading: a reload happens only on an
//    explicit false. A getter, never a stored flag, so it cannot go stale; on any error it reports busy
//    (fail-closed: no reload).
function installWatchdogHooks(win, deps) {
  const LEVEL_WINDOW_MS = 1000;
  const recent = { You: { rms: 0, at: 0 }, Them: { rms: 0, at: 0 } };
  let restarting = false;
  const tap = (who, rms) => {
    try {
      if (who !== "You" && who !== "Them") return;
      const v = Number(rms);
      if (!Number.isFinite(v) || v < 0) return;
      const at = Date.now();
      recent[who] = { rms: v, at };
      let peak = 0;
      for (const k of ["You", "Them"]) if (at - recent[k].at <= LEVEL_WINDOW_MS && recent[k].rms > peak) peak = recent[k].rms;
      win.__kompasLevels = { peak: Math.min(1, peak), at };
    } catch {}
  };
  try {
    Object.defineProperty(win, "__kompasTracks", {
      configurable: true,
      get() {
        try {
          const out = [];
          for (const who of ["You", "Them"]) {
            const cap = deps.captures().find((c) => c && c.who === who && !c.stopped);
            const track = cap && cap.stream && cap.stream.getAudioTracks ? cap.stream.getAudioTracks()[0] : null;
            if (track) out.push(track);
          }
          return out;
        } catch { return []; }
      },
    });
  } catch {}
  try {
    Object.defineProperty(win, "__kompasLiveActivity", {
      configurable: true,
      get() {
        try {
          if (deps.captures().some((c) => c && !c.stopped)) return true;
          if (deps.cards().some((c) => c && c.streaming)) return true;
          return false;
        } catch { return true; }
      },
    });
  } catch {}
  win.__kompasRestartCapture = () => {
    try {
      if (restarting || !deps.running()) return false;
      const who = deps.captures().filter((c) => c && !c.stopped).map((c) => c.who);
      const restart = [...new Set(who)].filter((w) => w === "You" || (w === "Them" && deps.desktop()));
      if (!restart.length) { try { deps.primeAudio(); } catch {} return false; }
      restarting = true;
      Promise.resolve().then(async () => {
        for (const w of restart) {
          try { await deps.stopSource(w); } catch {}
          try { deps.primeAudio(); } catch {}
          if (!deps.running()) break;
          try { await (w === "You" ? deps.startMic() : deps.startSys()); } catch {}
        }
        try { deps.reportSources(); } catch {}
      }).catch(() => {}).finally(() => { restarting = false; });
      return true;
    } catch { restarting = false; return false; }
  };
  return tap;
}
let kompasLevelTap = () => {};
try {
  kompasLevelTap = installWatchdogHooks(window, {
    captures: () => captures, running: () => running, desktop: () => !!window.kompasDesktop,
    cards: () => cards,
    stopSource: (w) => stopSource(w), startMic: () => startMic(), startSys: () => startSys(),
    primeAudio: () => primeAudio(), reportSources: () => reportSources(),
  });
} catch {}
function vadStep(cap, rms) {
  if (cap.stopped || !running) return;
  try { kompasLevelTap(cap.who, rms); } catch {}   // slice 5d: watchdog level, read only
  const now = performance.now();
  cap.lastVadAt = now;
  if (rms > 0.004) { cap.lastAudibleAt = now; cap.zeroWarned = false; }
  const step = dictateStep(cap, rms, now, VAD);
  cap.noise = step.noise; cap.speechMs = step.speechMs; cap.voiced = step.voiced;
  cap.lastVoice = step.lastVoice; cap.lastTick = step.lastTick; cap.floorMin = step.floorMin; cap.floorAt = step.floorAt;
  meter(cap.who, rms, step.speaking);
  if (step.action === "end") return endSegment(cap, true, true, step.scream || step.speechMs >= 60);
  if (step.action === "rescue") return endSegment(cap, true, true, true);
  if (step.action === "drop") return endSegment(cap, false);
  if (cap.voiced && cap.who === questionSource() && cap.speechMs > 1200 && now - cap.interimAt > VAD.INTERIM_MS && !cap.inflight && now > interimOffUntil) {
    cap.interimAt = now; startCaptions(cap);                                             // live caption while still talking (in-page, no Whisper call)
  }
}
let meterFrame = { You: 0, Them: 0 };
function meter(who, rms, speaking) {
  const now = performance.now(); if (now - meterFrame[who] < 50 && speaking === undefined) return; meterFrame[who] = now;
  const el = $(who === "You" ? "micLvl" : "sysLvl"); if (el) el.style.width = Math.min(100, rms * 700).toFixed(0) + "%";
  const b = $(who === "You" ? "micBtn" : "sysBtn"); if (b) b.classList.toggle("speaking", !!speaking);
}

/* ---- transcription ---- */
let interimOffUntil = 0;
let transcriptionFailedEpoch = -1;
function whisperPrompt(opt) {
  const SPEECH_LEXICON = ["V-Cert", "Venafi TPP", "Luna HSM", "PKCS#10", "SIEM", "SOAR", "EDR", "XDR", "MITRE ATT&CK", "Kerberos", "Active Directory", "domain controller", "DNS hijacking", "Group Policy", "lateral movement", "privilege escalation", "threat hunting", "incident response", "vulnerability management", "zero trust", "SAML", "OAuth", "PKI", "Kubernetes", "Terraform", "STAR method", "firewall", "WAF", "Splunk", "CrowdStrike", "Microsoft Sentinel", "Microsoft Defender", "Okta", "CyberArk", "Venafi", "Nessus", "Qualys", "SOC analyst", "phishing", "ransomware", "malware", "endpoint security", "Azure"];
  const s = current || {};
  const learned = (s.voiceVocabulary || []).filter(t => typeof t === "string").slice(-40);
  const terms = [...new Set((`${s.role || ""} ${s.jd || ""} ${(s.resume || "").slice(0, 3000)}`.match(/\b[A-Z][A-Za-z0-9+#./-]{1,}\b/g) || []))].slice(0, 45);
  // The terms Whisper must be able to hear lead. The previous line follows,
  // with its commas turned into spaces so it cannot swallow the first term.
  // The word "Vocabulary" is not sent: Whisper echoes a prompt label back as speech.
  const bare = !!(opt && opt.bare);
  const prev = bare ? "" : (typeof transcript !== "undefined" && transcript.length ? String(transcript[transcript.length - 1].text || "") : "").replace(/\s+/g, " ").replace(/[,;]/g, " ").trim().slice(-110);
  const core = ["V-Cert", "Venafi TPP", "Luna HSM", "PKCS#10", "Gemalto", "Fifth Third", "CyberArk", "PowerShell", "Kerberos", "SIEM", "domain controller", "MITRE ATT&CK", "Kubernetes", "Terraform", "PKI", "STAR method"];
  const rest = SPEECH_LEXICON.filter(t => !core.includes(t));
  return [...new Set([...core, ...(prev ? [prev] : []), ...learned, ...terms, ...rest])].join(", ").slice(0, 550);
}
// Level 4: a phrase with real speech and no words is decoded once more, without the previous line in the prompt.
function dictationRetry(clean, speechMs, attempt) {
  return !String(clean || "").trim() && Number(speechMs) >= 60 && attempt === 0;
}
// Speech activity gates silence before upload; short replies are meaningful speech.
const HALLU = /^(thanks for watching|thank you for watching)[.!?,]*$/i;
function cleanTranscript(t) {
  t = String(t || "").replace(/\s+/g, " ").trim();
  if (!t || HALLU.test(t) || /^[.,!?\s-]+$/.test(t)) return "";
  if (/^[([].*[)\]]$/.test(t)) return "";          // [Music], (silence)
  return t;
}
// Owner, 2026-09-30 (chose "browser for captions"): the grey live caption comes from the in-page recogniser listening
// to that speaker's own stream — free and instant; Whisper only transcribes each finished phrase. Chrome's recogniser
// can only hear the microphone, so the interviewer's call audio needs this one. No recogniser = no live caption.
function startCaptions(cap) {
  if (cap.capStarting || cap.capRec) return; cap.capStarting = true;
  voskLoad().then(model => {
    if (cap.stopped || !running) return;
    const ctx = new AudioContext(), src = ctx.createMediaStreamSource(cap.stream), node = ctx.createScriptProcessor(2048, 1, 1);
    const rec = new model.KaldiRecognizer(ctx.sampleRate);
    rec.on("partialresult", (m) => { const t = m && m.result && m.result.partial; if (t && running && !cap.stopped) showCaption(cap.who, t, true); });
    node.onaudioprocess = (e) => { try { rec.acceptWaveform(e.inputBuffer); } catch {} };
    src.connect(node); node.connect(ctx.destination);
    Object.assign(cap, { capCtx: ctx, capNode: node, capRec: rec });
  }).catch(() => {}).finally(() => { cap.capStarting = false; });
}
function stopCaptions(cap) {
  try { cap.capNode && cap.capNode.disconnect(); } catch {} try { cap.capCtx && cap.capCtx.close(); } catch {} try { cap.capRec && cap.capRec.remove(); } catch {}
  cap.capNode = cap.capCtx = cap.capRec = null;
}
function interim(cap) {
  const chunks = cap.chunks.slice(); if (chunks.length < 3) return;
  const blob = new Blob(chunks, { type: (cap.rec && cap.rec.mimeType) || MIME || "audio/webm" });
  if (blob.size > 4000) transcribe(blob, cap.who, { final: false, cap });
}
async function transcribe(blob, who, opt) {
  const epoch = opt.epoch ?? transcriptionEpoch;
  const cap = opt.cap; if (cap) cap.inflight++;
  const previous = transcriptionOrder;
  let release;
  if (opt.final) transcriptionOrder = new Promise(resolve => { release = resolve; });
  let clean = "", failure = "";
  try {
    // One bounded retry preserves the same audio after a temporary connection or server failure.
    for (let attempt = 0; attempt < (opt.final ? 2 : 1); attempt++) {
      if (epoch !== transcriptionEpoch) break;
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 18000);
      let retry = false, delay = 500;
      try {
        const res = await fetch("/api/transcribe", { method: "POST", signal: ctl.signal,
          headers: { "content-type": "application/octet-stream", "x-audio-mime": blob.type || "audio/webm", "x-whisper-prompt": encodeURIComponent(opt.prompt ?? whisperPrompt()), "x-speech-lang": String((typeof current !== "undefined" && current && current.language) || "en").slice(0, 2).toLowerCase() }, body: blob });
        if (!res.ok) {
          retry = res.status === 429 || res.status >= 500;
          const retrySeconds = Number(res.headers?.get("retry-after"));
          if (res.status === 429) {
            interimOffUntil = performance.now() + 60000;
            if (retrySeconds > 2) retry = false;
            delay = Math.min(2000, Math.max(500, retrySeconds * 1000 || 500));
          }
          failure = `Transcription unavailable (${res.status}). This phrase was not transcribed; please repeat it or type it.`;
        } else {
          clean = cleanTranscript((await res.json()).text);
          if (!clean && dictationRetry(clean, opt.speechMs || 0, attempt)) {
            opt.prompt = whisperPrompt({ bare: true });
            retry = true;
            delay = 250;
            failure = "";
            if (epoch === transcriptionEpoch) status("Hearing the phrase again…", "live");
          } else {
            failure = clean ? "" : "No clear words were recognized in that phrase. Please repeat it or type it.";
            break;
          }
        }
      } catch (error) {
        retry = true;
        failure = error.name === "AbortError" ? "Transcription timed out. Please repeat the phrase or type it." : "Could not transcribe audio. Check your connection, then repeat the phrase.";
      } finally { clearTimeout(timeout); }
      if (!retry || attempt || !opt.final) break;
      if (failure && epoch === transcriptionEpoch) status("Connection interrupted. Retrying the captured phrase…", "live");
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    if (opt.final) await priorOrTimeout(previous);
    if (epoch !== transcriptionEpoch) return;
    if (failure && opt.final) { transcriptionFailedEpoch = epoch; status(failure, "err"); return false; }
    if (!clean) return;
    if (opt.final) { transcriptionFailedEpoch = -1; onTranscript(who, clean, false, opt.spokenAt); }
    else if (running) showCaption(who, clean, true);
  } finally { if (cap) cap.inflight--; if (release) release(); }
}

// Gap B3 (30 Oct 2026): phrases were committed strictly in order, so one stalled upload (18 s, a 0.5 s pause, 18 s again)
// held every later phrase back by about 36.5 s. A phrase now waits for the one before it for at most ORDER_WAIT_MS, then
// goes ahead; the slow one is still shown when it arrives. Capture order holds whenever the earlier phrase is on time.
const ORDER_WAIT_MS = 4000;
function priorOrTimeout(previous, ms = ORDER_WAIT_MS) {
  let timer;
  return Promise.race([Promise.resolve(previous).catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, ms); })]).finally(() => clearTimeout(timer));
}
/* ---- what was heard → captions, drawer, questions ---- */
const Q_CUE = /\?\s*$|^(so,? )?(what|how|why|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|let's|lets)\b|\b(tell me|walk me|how would you|what would you|why did you|can you|could you|would you|have you|do you|are you|what is|what are|your experience|about yourself|introduce)\b/i;
let lastQ = { card: null, at: 0 };
let capTimer = null;
// The interviewer heard again through your speakers (owner, 27 Oct 2026: "The You starts to appear whenever them
// speaking"). The mic's echo cancellation only removes what this page plays, not the meeting app, so the call came back
// as You. While the call audio carries speech, or did a moment ago, no You caption is shown; a You line that repeats
// what Them just said (half or more of its words) is not yours and is dropped (onTranscript).
let themLines = [];   // what the call audio said in the last 30 s, interim and final
function noteThem(text, spokenAt) { const at = Date.now(); themLines = themLines.filter(l => at - l.at < 30000); themLines.push({ text: String(text || ""), at, spokenAt: Number.isFinite(spokenAt) ? spokenAt : undefined }); }
function themSpeaking() { const now = performance.now(); return captures.some(c => c.who === "Them" && !c.stopped && (c.voiced || now - (c.lastVoice || 0) < 1500)); }
function echoOfThem(text) { const recent = themLines.filter(l => Date.now() - l.at < 30000).map(l => l.text).join(" "); return recent ? echoShare(text, recent) : 0; }
// ── Source-aware intake (29 Oct 2026) ──
// Computer audio is the interviewer, the microphone is you, and typed text is your own question. Speaker bleed: the
// interviewer comes back through the mic a moment later. A mic line that repeats what the call audio said within about
// 1.5 seconds is bleed, even a short one like "And why?" that the 30-second echo rule cannot judge, so it never opens a
// question. Your own answer, said later or in other words, is kept.
function roleOfSource(source) { const SOURCE_ROLE = { system: "Them", computer: "Them", loopback: "Them", them: "Them", mic: "You", microphone: "You", you: "You", typed: "You (typed)" }; return SOURCE_ROLE[String(source || "").trim().toLowerCase()] || "You"; }
function bleedWords(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9'+#]+/g, " ").split(/\s+/).filter(w => w.length > 1 || /\d/.test(w)); }
function micBleed(text, at, lines, spokenAt) {
  const words = bleedWords(text); if (words.length < 2) return false;
  const near = (lines || []).filter(l => bleedNear(l, at, spokenAt));   // about 1.5 s
  if (!near.length) return false;
  const bag = new Set(bleedWords(near.map(l => l.text).join(" ")));
  return words.filter(w => bag.has(w)).length / words.length >= 0.6;
}
// Slice 2 (29 Oct 2026). askSource: computer audio, when captured, is the only voice that opens a question; with mic only,
// the mic does (labelled). spokenWallTime: when the last word of a clip was said, on the wall clock, or null.
function askSource(whos) {
  if (Array.from(whos || []).some(w => roleOfSource(w) === "Them")) return { source: roleOfSource("system"), mode: "call", reason: "source-computer-audio-is-interviewer" };
  return { source: roleOfSource("mic"), mode: "mic-only", reason: "source-mic-only-fallback" };
}
function spokenWallTime(lastVoicePerf, nowPerf, nowWall) {
  const lv = Number(lastVoicePerf), np = Number(nowPerf), nw = Number(nowWall);
  if (!Number.isFinite(lv) || !Number.isFinite(np) || !Number.isFinite(nw) || lv <= 0 || lv > np || np - lv > 30000) return null;
  return nw - (np - lv);
}
// The leak window, judged by when words were said where both sides know it, and by when text came back otherwise.
function bleedNear(line, at, spokenAt) {
  if (!line) return false;
  if (Math.abs(Number(at) - Number(line.at)) <= 1500) return true;
  return Number.isFinite(spokenAt) && Number.isFinite(line.spokenAt) && Math.abs(spokenAt - line.spokenAt) <= 1500;
}
const TURN_CLOSING = /^(?:(?:ok(?:ay)?|great|perfect|cool|nice|thanks|thank you|got it|sounds good|all right|alright|awesome|makes sense|that makes sense|good|right)[\s,.!]*)+$/i;
// Turn gate: answer now, wait (a clause is still open, or no ask yet), or skip (filler, thanks). Any fault answers.
function turnGate(text) {
  try {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return { outcome: "skip", reason: "empty" };
    const pre = typeof gateNoAnswerNeeded === "function" ? gateNoAnswerNeeded(t) : null;   // slice 3: audio checks, statements
    if (pre) return pre;
    if (Q_CUE.test(t) || opensNewAsk(t)) return clauseStillOpen(t) ? { outcome: "wait", reason: "clause-open" } : { outcome: "answer", reason: "question" };
    if (isNoiseLine(t)) return { outcome: "skip", reason: "filler" };
    if (TURN_CLOSING.test(t)) return { outcome: "skip", reason: "closing" };
    return { outcome: "wait", reason: "no-ask-yet" };
  } catch { return { outcome: "answer", reason: "gate-error-fail-open" }; }
}
function decisionEvent(reason, source, text) { return { t: "decision", reason: String(reason || "unknown").slice(0, 60), source: String(source || ""), len: String(text || "").length }; }
// Answer anyway: a manual press within 15 s of a turned-away press, with nothing new heard or typed, answers those lines.
function answerAnywayLines(held, o) {
  if (!held || !o || o.fromAuto || o.pending || o.typed || !Array.isArray(held.lines) || !held.lines.length) return null;
  return Number(o.now) - Number(held.at) <= 15000 ? held.lines : null;
}
// ── end source-aware intake ──
// One section: the line being said shows inside the question box, under the question. A new question from Them brings
// a tucked-away box back (never while an answer is still being written on that page); your own speech never moves it.
function showCaption(who, text, isInterim) {
  const el = $("caption"); if (!el) return;
  if (who === "Them") noteThem(text);
  else if (themSpeaking() || echoOfThem(text) >= 0.5) return;
  el.classList.remove("hidden"); el.classList.toggle("interim", !!isInterim);
  $("capWho").textContent = who === "You" ? "You" : "Them"; $("capText").textContent = text;
  const box = el.closest(".q"); if (box) { box.classList.add("live"); box.scrollTop = box.scrollHeight; }
  const card = $("card");
  if (who === "Them" && card && card.classList.contains("q-away") && !(cards[idx] && cards[idx].streaming)) card.classList.remove("q-away");
  clearTimeout(capTimer); capTimer = setTimeout(() => { el.classList.add("hidden"); if (box) box.classList.remove("live"); }, 9000);
}
// A chat, not a log (owner, 27 Oct 2026: "make it more like chat modes like back and forth real time clarity"): Them
// on the left, You on the right. A speaker's lines run on in one bubble until the other side speaks or 20 s pass, and a
// lone filler ("and", "um") joins the bubble before it instead of standing on its own row. The stored transcript is
// unchanged: this is only how the drawer shows it.
const DRAWER_FILLER = /^(?:and|so|but|or|um+|uh+|er|erm|okay|ok|yeah|yes|right|hmm+|like)[.,!?]*$/i;
function appendDrawer(who, text, at) {
  const body = $("drawerBody"); if (!body) return;
  const first = body.firstElementChild; if (first && first.classList.contains("muted")) body.innerHTML = "";
  const words = String(text || "").replace(/\s+/g, " ").trim(); if (!words) return;
  const side = who === "You" ? "you" : "them", when = Number(at) || Date.now(), last = body.lastElementChild;
  if (last && last.classList.contains("tl") && last.classList.contains(side) && (DRAWER_FILLER.test(words) || when - Number(last.dataset.at || 0) < 20000)) {
    const span = last.querySelector("span"); span.textContent = span.textContent + " " + words;
    last.dataset.at = String(when);
  } else {
    const d = document.createElement("div"); d.className = "tl " + side; d.dataset.at = String(when);
    d.innerHTML = "<b></b><span></span>"; d.querySelector("b").textContent = side === "you" ? "You" : "Them"; d.querySelector("span").textContent = words;
    body.append(d);
  }
  body.scrollTop = body.scrollHeight;
}
function renderDrawer() { const body = $("drawerBody"); if (!body) return; body.innerHTML = '<div class="muted small">Nothing heard yet.</div>'; transcript.forEach(t => appendDrawer(t.who, t.text, t.at)); }
// Nothing is answered phrase-by-phrase. Everything heard piles up; AI Answer (or Auto, once the
// speaker goes quiet) merges it, derives ONE big question from all of it, and answers that in full.
let heardSeq = 0, answeredSeq = 0, flushing = false, autoOn = false, autoTimer = null;
const AUTO_QUIET_MS = 2200;
function pendingHeard() { return transcript.filter(t => t.seq > answeredSeq); }
function updatePending() {
  const n = pendingHeard().length, b = $("pendCount"); if (!b) return;
  b.textContent = n; b.classList.toggle("hidden", !n);
  $("answerBtn").title = n ? `Answer everything heard since the last answer — ${n} line${n > 1 ? "s" : ""} (Ctrl+Enter)` : "Answer the latest question again (Ctrl+Enter)";
}
function setAuto(on) {
  autoOn = !!on; const b = $("autoBtn");
  if (b) {
    b.classList.toggle("on", autoOn); b.setAttribute("aria-pressed", autoOn ? "true" : "false");
    const st = $("autoState"); if (st) st.textContent = autoOn ? "ON" : "OFF";
    b.title = autoOn ? "Auto-answer is ON: when the speaker goes quiet after a question, everything heard becomes one question and is answered" : "Auto-answer is OFF: keeps gathering what's said — press AI Answer to turn all of it into one question and answer it";
  }
  if (!autoOn) clearTimeout(autoTimer);
}
$("autoBtn").onclick = () => {
  setAuto(!autoOn);
  if (current) { current.autoMode = autoOn; current.autoAnswer = autoOn; saveSession(current); }
  if ($("autoAnswer")) $("autoAnswer").checked = autoOn;
  status(autoOn ? "Auto on — answers once the speaker goes quiet after a question." : "Auto off — gathering everything said. Press AI Answer to turn it into one question and answer it.", "live");
  if (autoOn) scheduleAuto();
};
// Only the INTERVIEWER's question can arm Auto. With call audio captured, your own mic lines are you
// reading the answer aloud — they must never trigger (and cut off) a new answer. Mic-only: the mic
// is the question source, as before.
// Same cut as src/lib/kompasAnswer.ts. A short follow-up is not the previous question,
// and an unfinished clause is not ready to answer.
function shortFollowUp(text) {
  const t = String(text || "").replace(/^(?:You|Them):\s*/gi, " ").replace(/\s+/g, " ").trim();
  return /^(?:(?:and|so|but|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:how come|how so|why not|why though|and why|and how|go deeper|dig deeper|explain that|explain this|explain it|say that again|why|how)(?:\s+though)?[.?!]*$/i.test(t);
}
// "Go deeper on that exception" names a subject, so it is not the two-word follow-up, and it is still a new ask.
// A typed "And why?" after an answer gets its own card (#32), and it is about the question on that page: the follow-up
// is attached to the open question instead of standing alone with no subject.
function typedFollowUpQuestion(typed, openQuestion) {
  const t = String(typed || "").replace(/\s+/g, " ").trim(), q = String(openQuestion || "").replace(/\s+/g, " ").trim();
  if (!t || !q || !shortFollowUp(t) || /^(Preparing|Ready|Cleared\.|No question yet|Deriving)/.test(q)) return "";
  // A typed statement ("go deeper", "more on the vault part") is kept as typed; only a typed question gets a "?" (slice 2).
  const asks = /^(?:(?:and|so|but|ok(?:ay)?)[, ]+)?(?:what|why|how|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has)\b/i;
  const end = (x) => /[?.!]$/.test(x) ? "" : asks.test(x) ? "?" : ".";
  return q + end(q) + " " + t.charAt(0).toUpperCase() + t.slice(1) + end(t);
}
// Slice 12 (owner, 30 Oct 2026 8:50 AM CT: questions "passed fully as if it never heard"): an ask that opens with a
// filler ("Okay so what happens...", "uh who is...") or does not open with a question word ("I'd love to hear about...",
// "Kerberos versus NTLM.") never armed Auto, and a press after an answer took it for a re-press of the page on screen.
const ASK_LEAD = /^(?:(?:ok(?:ay)?|alright|all right|so|and|but|um+|uh+|hmm+|well|now|right|yeah|yes|great|cool|perfect|got it|thanks|thank you)[,.!]?\s+)+/i;
const ASK_INDIRECT = /^(?:i'?d (?:love|like) to (?:hear|know|understand|learn)|i would (?:love|like) to (?:hear|know|understand|learn)|i'?m (?:curious|interested|wondering)|i am (?:curious|interested|wondering)|curious (?:about|how|what|why|whether|if)|interested in (?:how|what|why|your)|i was (?:wondering|curious)|i wonder\b|i want to (?:hear|know|understand)|help (?:me|us) understand|(?:run|talk|take|bring) (?:me|us) through|go through (?:how|what|why|your)|let me hear|paint (?:me|us) a picture|remind me|(?:any |your )?thoughts on|your (?:take|view|thinking) on|(?:any |what'?s your )?experience with|please (?:explain|describe|tell|walk|share|talk|elaborate|go over|clarify)|go ahead and (?:explain|describe|tell|walk|share|talk)|elaborate on|(?:the )?difference between|(?:maybe |let'?s )?start (?:with|by)|next (?:one|question|topic)[,:]?\s+\S)|^[\w#+./-]+(?: [\w#+./-]+){0,3} (?:versus|vs\.?) [\w#+./-]+[.?!]*$|\b(?:how|what|why|when|where) (?:did|do|would|will|have|can|could) you\b/i;
function opensNewAsk(text) {
  const t = String(text || "").replace(/^(?:You|Them):\s*/gi, " ").replace(/\s+/g, " ").trim();
  if (shortFollowUp(t)) return true;
  if (/^(?:(?:and|so|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:go deeper|dig deeper|elaborate|explain that|explain this|explain it|walk me through|say that again)\b/i.test(t)) return true;
  try {
    const bare = t.replace(ASK_LEAD, "");
    return (bare !== t && !!bare && Q_CUE.test(bare)) || ASK_INDIRECT.test(bare);
  } catch { return false; }
}
// Slice 12: the question is formed from the last 8 lines heard since the last answer. When more than 8 lines followed the
// interviewer's ask (his own words, a long setup), the ask fell out and the turn was dropped. The latest unanswered ask
// still opens the window, up to 16 lines. Any fault keeps the 8-line window.
function formationWindow(lines, isAsk, n = 8, cap = 16) {
  const all = Array.from(lines || []), win = all.slice(-n);
  try {
    if (win.some(isAsk)) return win;
    for (let i = all.length - n - 1; i >= Math.max(0, all.length - cap); i--) if (isAsk(all[i])) return all.slice(i);
  } catch {}
  return win;
}
// Slice 12b: the question's start is the start of its turn, not eight lines
// back (owner, 1 Nov 2026: "detect the start of the question... you already
// have the whole transcript"). A speaker who takes the floor frames the ask
// first — setup, context, pausing fillers — and the ask follows in the same
// turn; cutting at eight lines kept only the tail, which reads to the other
// end as if the question was never heard. The window opens at the latest
// unanswered ask and walks back through the same turn: same-speaker lines
// and short acknowledgements belong to it; a long line from the other side
// (the floor changed hands) or a pure next-question marker ends it. No ask
// in the lines falls back to the 8-line window, unchanged. Any fault keeps
// the 8-line window. Self-contained: no module-level consts it depends on.
function turnWordCount(text) { try { return String(text || "").split(/\s+/).filter(Boolean).length; } catch { return 0; } }
function isTurnMarker(text) {
  try { return /^\s*(next question|moving on to the next question|on to the next question|let'?s (?:move|go) on|let'?s (?:move|go) to the next question|moving on)[.?!…\s]*$/i.test(String(text || "").trim()); } catch { return false; }
}
function turnWindow(lines, source, isAsk) {
  const all = Array.from(lines || []);
  try {
    let ask = -1;
    for (let i = all.length - 1; i >= 0; i--) { const t = all[i]; if (t && t.who === source && (Q_CUE.test(t.text) || opensNewAsk(t.text))) { ask = i; break; } }
    if (ask < 0) return formationWindow(all, isAsk);
    let start = ask;
    while (start > 0) {
      const prev = all[start - 1];
      if (!prev) break;
      if (isTurnMarker(prev.text)) break;
      if (prev.who !== source && turnWordCount(prev.text) > 4) break;
      start--;
    }
    return all.slice(start);
  } catch { return formationWindow(all, isAsk); }
}
// Re-press recovery (owner, 1 Nov 2026): a re-press means the last answer
// missed, so the question is re-formed from the whole turn that holds it —
// the transcript back to the turn's start — not from the stripped page
// alone, which could never recover framing the first window cut. The walk
// stops at a floor change or a next-question marker, so it never re-forms
// the whole interview: the 27 Oct bounded-chain contract, narrowed to one
// turn by the owner's 1 Nov direction. An unknown anchor returns null and
// the caller falls back to the page chain, never worse.
function recoverTurn(allLines, anchorSeq, source) {
  try {
    const all = Array.from(allLines || []);
    let anchor = -1;
    for (let i = 0; i < all.length; i++) if (all[i] && all[i].seq === anchorSeq) { anchor = i; break; }
    if (anchor < 0) return null;
    let start = anchor;
    while (start > 0) {
      const prev = all[start - 1];
      if (!prev) break;
      if (isTurnMarker(prev.text)) break;
      if (prev.who !== source && turnWordCount(prev.text) > 4) break;
      start--;
    }
    return all.slice(start);
  } catch { return null; }
}
function clauseStillOpen(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || /[?.!…]["']?$/.test(t)) return false;
  if (/^(?:how|what|why|when|where|which|who|can|could|would|will|do|does|did|have|has|are|is|tell|walk|describe|explain|give)\b/i.test(t)) return true;
  return /\b(?:a|an|the|to|of|for|with|and|or|but|about|on|in|into|from|by|at|as|your|my|our|their|between|would|could|should)\s*$/i.test(t);
}
// Gap B1 (30 Oct 2026): speech-to-text often drops the final "?", so every unpunctuated line that opened with a question
// word ("What is your experience with Kubernetes") counted as an open clause and Auto waited 7 s instead of 2.2 s. A line
// that looks complete (a short follow-up, or four or more words that do not end on a dangling word such as "the", "with",
// "your", "me", "is") now gets the normal quiet wait. A line that really trails off keeps the long hold. Any fault keeps it.
const DANGLING_END = /\b(?:a|an|the|to|of|for|with|and|or|but|nor|about|on|in|into|onto|from|by|at|as|your|my|our|their|his|her|its|between|among|through|like|than|versus|vs|if|whether|because|since|so|that's|is|are|was|were|be|been|am|would|could|should|can|will|shall|may|might|must|me|us|you|we|they|i|um+|uh+|er|erm|how|what|why|when|where|which|who|whom|whose|some|any|more|most|both|either|each|every|such|also|really|very|just|e\.?g|i\.?e)\s*[,;:\u2014\u2013-]*$/i;
function looksComplete(text) {
  try {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    if (shortFollowUp(t)) return true;
    if (/[,;:\u2014\u2013-]$/.test(t)) return false;
    return t.split(" ").length >= 4 && !DANGLING_END.test(t);
  } catch { return false; }
}
function autoWaitMs(tail) {
  try {
    if (looksComplete(tail)) return AUTO_QUIET_MS;
    const t = String(tail || "").replace(/\s+/g, " ").trim();
    if (t && !/[?.!…]["']?$/.test(t) && DANGLING_END.test(t)) return 7000;   // trails off on "if", "and", "the"…
  } catch {}
  return clauseStillOpen(tail) ? 7000 : AUTO_QUIET_MS;
}
function repeatsPriorQuestion(text, previous) {
  if (repeatsPriorQuestionV2(text, previous)) return true;
  try { return !shortFollowUp(text) && repeatsPriorQuestionV3(text, previous); } catch { return false; }   // slice 3: only ever adds a repeat
}
function repeatsPriorQuestionV2(text, previous) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const stop = new Set("the a an and or of to in on for with you your yours we our it its is are was were do does did have has had can could would should will just like really very this that those these what how why when where which who about from into".split(" "));
  const a = norm(text), b = norm(previous);
  if (!a || !b) return false;
  if (shortFollowUp(text)) return false;
  if (a === b) return true;
  const words = (s) => norm(s).split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  const aw = words(text), bw = new Set(words(previous));
  if (!aw.length || aw.some((w) => !bw.has(w))) return false;
  return aw.filter((w) => bw.has(w)).length / aw.length >= 0.85;
}
// Kept equal to splitDistinctAsks in src/lib/kompasAnswer.ts. A multi-part ask stays one
// question. Two questions in one breath become two.
const SPLIT_LEAD = /^(?:(?:ok(?:ay)?|so|and|also|now|then|next|finally|right|alright|all right|well|yes|yeah|uh+|um+|please|great|perfect|cool|sure)[,.!]?\s+)+/i;
// demo-final: SPLIT_NOISE and the small-talk lines mirror SPOKEN_NOISE / SMALL_TALK / noiseOnly in src/lib/kompasAnswer.ts (AQ stress rounds 2-10).
const SPLIT_NOISE = /^(?:ok(?:ay)?|hi|hello|hey|thanks|thank you|yeah|yep|yes|no|nope|uh+|um+|hmm+|uh[- ]?huh|mm+[- ]?hmm+|m+hm+|mm+|ah+|oh+|i see|bye|goodbye|good morning|good afternoon|good evening|how are you|what'?s up|cool|sure|right|alright|all right|got it|sounds good)[.!?]*$/i;
const SPLIT_SMALL_TALK_LEAD = "(?:(?:yeah|yes|ok(?:ay)?|right|alright|all right|so|well|hmm+|mm+|oh|ah|nice|great|good|perfect|cool|sure|sorry|wow|excellent|awesome|thanks)[,.!]?\\s+)*";
const SPLIT_SMALL_TALK_CORE = [
  "that'?s (?:a |an |really |very )?(?:tough|hard|good|great|fair|interesting|helpful|fine|clear|nice|solid|cool|tricky)(?: one| question| point| answer| idea| example)?",
  "that (?:makes sense|helps|is helpful|is interesting|works)",
  "makes (?:total |perfect )?sense", "fair enough", "good,? good", "very good", "all good", "no worries", "sounds good",
  "(?:thanks|thank you)(?: so much| for that)?", "i see(?: what you mean)?", "i hear you", "got it", "understood", "noted",
  "interesting(?: point| one)?", "(?:i )?(?:really )?like that(?: answer| idea| one| example)?", "(?:i )?appreciate (?:that|it)",
  "let'?s (?:dive in|get started|begin|start|move on|keep going|continue|jump in|jump right in)",
  "give me (?:a|one) (?:second|sec|moment|minute)", "(?:just )?(?:one|a) (?:second|sec|moment)", "hold on", "bear with me",
  "let me (?:pull up|find|check|grab|look at) (?:my|the) (?:notes|screen|list|questions|next question)",
  "(?:my|the) (?:dog|cat|kid|kids|baby|neighbou?r) (?:is|are) (?:barking|crying|loud|here|making noise)",
  "the weather (?:has been|is|was) [a-z ]{2,30}", "(?:you'?re|you are) breaking up(?: a (?:bit|little))?", "okay cool", "cool cool", "nice one",
  // Round 6 (29 Oct 2026): five more interviewer asides were formed into questions and answered.
  "that'?s (?:basically |about |pretty much )?(?:the team|it|all|everything|the role|the setup)", "right,? right",
  "(?:we'?ll|let'?s|i'?ll) circle back (?:on|to) (?:that|it|this)",
  "(?:my|the|your) (?:screen|video|audio|connection|internet|wi-?fi|mic) (?:froze|dropped|cut out|lagged|glitched|is lagging)(?: for a (?:second|sec|moment|bit))?",
  "i'?m (?:just )?(?:writing|noting|jotting) (?:that|this|it) down", "let me (?:write|note|jot) (?:that|this|it) down",
  // Round 8 (29 Oct 2026): five more asides were formed into questions and answered ("mm-hm", "got it, thanks", "I'm going
  // to mute for a second", "let me check the time", "sorry, someone just walked in"). Whole-utterance only, no "?".
  "(?:mm-?hm+|uh-?huh|mhm+)(?:,? (?:okay|ok|right|sure|yeah|got it))?", 
  // Round 10: meeting housekeeping.
  "(?:i'?m|i am) (?:going to|gonna|about to) share my screen", "(?:sorry,? )?(?:i'?m|i was|you'?re|you were) (?:on|still on) mute",
  "can (?:everyone|everybody|you|you all) (?:hear|see) me(?: okay| alright| now| well| fine)?", "got it,? (?:thanks|thank you)", "(?:i'?m|i am) (?:going to|gonna) (?:mute|go on mute)(?: for a (?:second|sec|moment|bit|minute))?",
  "let me (?:check|look at) the (?:time|clock)", "someone (?:just )?(?:walked|came) in",
];
const SPLIT_SMALL_TALK = new RegExp(`^${SPLIT_SMALL_TALK_LEAD}(?:${SPLIT_SMALL_TALK_CORE.join("|")})[.!]*$`, "i");
function splitSmallTalk(t) { return !!t && !/\?/.test(t) && t.split(/\s+/).length <= 14 && SPLIT_SMALL_TALK.test(t); }
const SPLIT_OPENER = /^(?:how|what|why|when|where|which|who|whom|whose)\b(?!\s+to\b)|^(?:can|could|would|will|should|do|does|did|are|have|has)\s+(?:you|we)\b|^(?:tell|walk|take|talk|show|give|explain|describe|define|compare|contrast|differentiate|distinguish|design|build|implement|configure|architect|plan|outline|list|name|state|share|write|draft|map|diagnose|troubleshoot|debug|identify|recommend|propose|justify|estimate|summari[sz]e|discuss|evaluate|assess|analy[sz]e|elaborate|expand|go|dig|introduce|imagine|suppose|pick|choose|select|rank|prioriti[sz]e|break|weigh|defend|verify|validate|test|measure|quantify|detail|clarify|demonstrate|illustrate|cover|include|keep|focus|assume|consider|avoid|limit|stay|mention|start|end|finish|continue)\b/i;
const SPLIT_START = /^(?:what|why|how|when|where|which|who|can you|could you|would you|will you|do you|did you|have you|are you|tell me|walk me|describe)\b/i;
const SPLIT_CONTINUES = /^(?:what if|what about (?:that|this|it)|how about (?:that|this)|why (?:is|was|did|would) (?:that|it|this)|how (?:did|would|do) (?:that|it|this)|which of (?:those|these|them)|walk me through (?:that|this|it))\b/i;
const SPLIT_PROPER_STOP = new Set("what how why when where which who tell walk have has can could would will did does are the and but for you your yeah okay right great thanks this that those these".split(" "));
const SPLIT_TOPIC_STOP = new Set("about after again also been before being could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours explain describe tell".split(" "));
function splitNoise(text) {
  const t = String(text || "").replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gi, " ").replace(/\s+/g, " ").trim();
  return !t || SPLIT_NOISE.test(t) || splitSmallTalk(t);
}
function splitTopicWords(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter((w) => w.length >= 4 && !SPLIT_TOPIC_STOP.has(w));
}
function splitProper(sentence) {
  return (String(sentence || "").match(/\b[A-Z][A-Za-z0-9+#.-]{2,}\b/g) || []).map((w) => w.toLowerCase()).filter((w) => !SPLIT_PROPER_STOP.has(w));
}
function splitHead(sentence) {
  const m = String(sentence || "").replace(SPLIT_LEAD, "").match(/^what (?:is|are)\s+(?:an?|the\s+)?(?:meaning of\s+)?([a-z0-9][\w+#.-]*(?:\s+[a-z0-9][\w+#.-]*){0,3})/i);
  return m ? m[1].toLowerCase().replace(/[?.!\s]+$/g, "").trim() : "";
}
// Slice 3 (29 Oct 2026), round-2 production failures. Every rule below only runs inside the v3 pass, and
// splitDistinctAsks returns the v2 cut whenever the v3 pass throws or would change a single heard word.
const SPLIT_ORDINAL = /^(?:(?:first|second|third|fourth|fifth)(?:ly)?|lastly|number (?:one|two|three|four|five))\b[,:]?\s*/i;
const SPLIT_TAG = /,\s*(?:right|correct|yes|no|yeah|true|isn't it|aren't you|don't you|didn't you|haven't you|wasn't it)\?\s*$/i;
const SPLIT_POLITE = /^(?:i'?d (?:love|like|be (?:curious|interested|keen)) to (?:hear|know|learn|understand)|i would (?:love|like) to (?:hear|know)|i'?m curious (?:about|how|what|why|to hear))\b/i;
const SPLIT_AUDIO_CHECK = /^(?:(?:hello|hi|hey)[,.!]?\s+)?(?:(?:can|could) you (?:hear|see) me(?:\s+(?:ok(?:ay)?|now|alright|all right|well|clearly))?|(?:am i|are you) (?:audible|on mute|muted|still there|there)|is my (?:audio|mic|microphone|video|sound) (?:ok(?:ay)?|working|coming through)|(?:are|is) (?:you|my audio) (?:breaking up|cutting out))[?.!]*$/i;
const SPLIT_CONTEXT_FOLLOW = /^(?:what about|how about)\s+(?:with\s+|in\s+|for\s+|on\s+)?[\w+#.-]+(?:\s+[\w+#.-]+){0,3}\s*\?*$|^(?:can|could) you (?:give|share) (?:me |us )?(?:an?|one|some) (?:\w+ )?examples?\b|^(?:for example|for instance|like what|such as)\??$|^what (?:was|were) the (?:outcome|result|results|impact|lesson|lessons|takeaway)\b|^what happened (?:next|after|then)\b|^(?:and )?then what\b|^what did you learn\b|^(?:how|what|why|when|where) (?:does|do|did|is|are|was|were|would|can|could|will) (?:it|they|that|this|those|these)\b/i;
function splitAskBody(sentence) { return String(sentence || "").replace(SPLIT_LEAD, "").replace(SPLIT_ORDINAL, "").replace(SPLIT_LEAD, "").trim(); }
function splitSetsAsk(sentence) {
  const bare = String(sentence || "").replace(SPLIT_LEAD, "").trim();
  if (!bare || splitNoise(bare) || SPLIT_AUDIO_CHECK.test(bare)) return false;
  const body = splitAskBody(sentence);
  return SPLIT_OPENER.test(body) || (/\?\s*$/.test(body) && SPLIT_START.test(body)) || SPLIT_TAG.test(bare) || SPLIT_POLITE.test(body);
}
// "What is Zscaler? I would say Zscaler is a cloud proxy.": an ask, then four or more words of answer, nothing asked since.
function splitAnswerBetween(prevText) {
  const ss = String(prevText || "").trim().split(/(?<=[.?!])\s+/).filter(Boolean);
  let last = -1;
  ss.forEach((s, i) => { if (splitSetsAsk(s)) last = i; });
  if (last < 0 || last >= ss.length - 1) return false;
  const after = ss.slice(last + 1);
  return after.every((s) => !/\?\s*$/.test(s) && !SPLIT_OPENER.test(splitAskBody(s))) && after.join(" ").split(/\s+/).length >= 4;
}
// v3 rules, checked before the v2 rules: true = new card, false = same card, null = let v2 decide.
function splitSeparateV3(next, prevText) {
  const bare = String(next || "").replace(SPLIT_LEAD, "").trim();
  if (!bare) return null;
  const body = splitAskBody(next);
  if (SPLIT_ORDINAL.test(bare) && !/^first(?:ly)?\b/i.test(bare) && (SPLIT_OPENER.test(body) || /\?\s*$/.test(body))) return true;
  if (SPLIT_AUDIO_CHECK.test(bare)) return false;
  const prevProper = new Set(splitProper(prevText));
  const prevTopic = new Set(splitTopicWords(prevText));
  // "And what about SailPoint, have you used it?" names a new subject and asks its own question.
  const named = bare.match(/^what about\s+([\w+#.-]+(?:\s+[\w+#.-]+){0,2}),\s*(?:have|do|did|can|could|would|are|were|is|was) you\b/i);
  if (named && named[1].toLowerCase().split(/\s+/).some((w) => w.length >= 3 && !prevTopic.has(w) && !prevProper.has(w))) return true;
  if (SPLIT_CONTEXT_FOLLOW.test(bare)) return false;
  const fresh = splitProper(bare).some((n) => !prevProper.has(n));
  const prevWords = new Set(splitTopicWords(prevText));
  const freshWords = splitTopicWords(bare).filter((w) => !prevWords.has(w));
  const politeNoise = new Set("love like hear know learn understand curious interested keen also".split(" "));
  if (SPLIT_POLITE.test(bare) && (fresh || (freshWords.some((w) => !politeNoise.has(w)) && !/\b(?:that|this|it|those|these|more)\b/i.test(bare)))) return true;
  if (/\?\s*$/.test(bare) && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && freshWords.length > 0 && !/\b(?:that|this|it|those|these|the same)\b/i.test(bare) && splitAnswerBetween(prevText)) return true;
  return null;
}
// Turn gate pre-check: audio checks and statements built like questions. Unsure, or any fault, says nothing (null).
const GATE_PSEUDO_ASK = /^(?:(?:so|and|okay|ok|well|now)[, ]+)*(?:how|what|why|who|where|when) (?:we|we're|we are|they|they're|our team|our company|the team|this team) [^?]*\b(?:is|are|was|were)\b[^?]*[.!]$/i;
const GATE_ASK_ANNOUNCED = /^(?:(?:thank you|thanks|great|okay|ok|so|and|now)[,.!]?\s+)*(?:my|the) next question is (?:around|about|on|regarding)\b[^?]*[.!]?$/i;
function gateNoAnswerNeeded(text) {
  try {
    const t = String(text || "").replace(/^(?:You|Them):\s*/gi, " ").replace(/\s+/g, " ").trim();
    if (!t) return null;
    const parts = t.split(/(?<=[.?!])\s+/).map((s) => s.replace(SPLIT_LEAD, "").trim()).filter(Boolean);
    if (parts.length && parts.every((s) => SPLIT_AUDIO_CHECK.test(s) || splitNoise(s))) return parts.some((s) => SPLIT_AUDIO_CHECK.test(s)) ? { outcome: "skip", reason: "audio-check" } : null;
    if (parts.length === 1 && GATE_PSEUDO_ASK.test(t)) return { outcome: "skip", reason: "statement-not-ask" };
    if (GATE_ASK_ANNOUNCED.test(t)) return { outcome: "wait", reason: "ask-announced" };
    return null;
  } catch { return null; }
}
// Cross-turn repeat (slice 3): "Sorry, what is CyberArk?", "..., again?", "... please.", "Can you tell me how Kerberos
// works?". Filler is dropped and plurals are folded, and both questions must hold exactly the same words, so a question
// with one new word is never hidden.
const REPEAT_FILLER = new Set("sorry again please said repeat let tell me can could you just once more question asked asking ask".split(" "));
function repeatsPriorQuestionV3(text, previous) {
  const stop = new Set("the a an and or of to in on for with you your yours we our it its is are was were do does did have has had can could would should will just like really very this that those these what how why when where which who about from into".split(" "));
  const bag = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim().split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w) && !REPEAT_FILLER.has(w)).map((w) => w.length > 4 ? w.replace(/([^s])s$/, "$1") : w));
  const a = bag(text), b = bag(previous);
  if (!a.size || a.size !== b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}
function splitSeparate(next, prevText, v3, v4) {
  if (v4) { const r = splitSeparateV4(next, prevText); if (r !== null) return r; }
  if (v3) { const r = splitSeparateV3(next, prevText); if (r !== null) return r; }
  const bare = String(next || "").replace(SPLIT_LEAD, "").trim();
  if (!bare || shortFollowUp(bare) || SPLIT_CONTINUES.test(bare)) return false;
  // "Go deeper" stays with the question it follows. "Go deeper on that exception" is the next question.
  if (/^(?:(?:and|so|ok(?:ay)?|right|well|then|now)[, ]+)*(?:go deeper|dig deeper|elaborate|explain that|explain this|explain it|walk me through|explain (?:the|your|that|this)\s+(?:[\w+#.-]+\s+){1,4}(?:part|piece|bit|side|step)\b)\b/i.test(bare)) {
    const press = new Set("deeper dig elaborate explain walk through that this part piece side step more".split(" "));
    const prevWords = new Set(splitTopicWords(prevText));
    const fresh = splitTopicWords(bare).filter((w) => !press.has(w) && !prevWords.has(w));
    if (fresh.length > 0) return true;
  }
  // "Tell me about yourself. What questions do you have?" is two asks. A design followed by an explanation stays one.
  const prevBare = ((String(prevText || "").trim().split(/(?<=[.?!])\s+/).pop() || prevText).replace(SPLIT_LEAD, "")).replace(/[.?!]+$/, "").trim();
  if (/^(?:tell me about yourself|introduce yourself|walk (?:me|us) through your (?:career|background))\b/i.test(prevBare)
      && /^(?:what questions (?:do|would|might|can) you have|any questions(?: for (?:us|me|the team))?|do you have any questions)\b/i.test(String(bare).replace(/[.?!]+$/, ""))) return true;
  const prevSentence = (String(prevText || "").trim().split(/(?<=[.?!])\s+/).pop() || prevText).trim();
  // A piece that ends on a dash was continued, not finished: "Describe the high-level architecture of a SIEM —" is
  // the lead of the question that follows it, so the wh-piece after it completes the same card. Without this the
  // card showed only "what are the core components?" and the answer went generic (1 Nov 2026, live video question).
  if (/[—–]\s*$/.test(prevSentence)) return false;
  // "Tell me about yourself. Why do you want this job?": an opening ask about you is its own card (same as the server).
  if (SPLIT_INTRO.test(String(prevSentence).replace(SPLIT_LEAD, "")) && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && (/\?\s*$/.test(bare) || !/[.?!]\s*$/.test(prevSentence))) return true;
  if (/\b(?:that|this|it|those|these|the same)\b/i.test(bare) && splitProper(bare).length === 0) return false;
  if (!SPLIT_START.test(bare)) return false;
  const prevProper = new Set(splitProper(prevText));
  const nextProper = splitProper(bare);
  const parallel = /^(?:how|what) (?:do|did|would|could) you\b/i;
  if (parallel.test(bare) && parallel.test(String(prevSentence).replace(SPLIT_LEAD, ""))) return nextProper.some((n) => !prevProper.has(n));
  if (nextProper.some((n) => !prevProper.has(n))) return true;
  const a = splitHead(prevSentence), b = splitHead(bare);
  if (a && b && a !== b) return true;
  const prevWords = new Set(splitTopicWords(prevText));
  const fresh = splitTopicWords(bare).filter((w) => !prevWords.has(w));
  if (/^(?:have you|do you|did you|can you|could you|would you|tell me|walk me|describe)\b/i.test(bare) && fresh.length > 0) return true;
  const prevEnded = /\?\s*$/.test(prevSentence) || (/^(?:tell me about|walk me through)\b/i.test(String(prevSentence).replace(SPLIT_LEAD, "")) && /\.\s*$/.test(prevSentence) && /\?\s*$/.test(bare)) || (!/[.?!]\s*$/.test(prevSentence) && SPLIT_START.test(String(prevSentence).replace(SPLIT_LEAD, "")));   // a mid-sentence cut piece
  return prevEnded && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && fresh.length > 0;
}
// Same as the server (29 Oct 2026): no full stops from speech-to-text ("what is cyberark what is okta"). A new question
// starts mid-sentence only at a strong opener after a finished ask of three words or more, never after a word that
// keeps the clause going ("and why", "handle what happens", "a time when"). Failsafe: never drop a word.
const SPLIT_INTRO = /^(?:tell me (?:a (?:little |bit )?(?:bit )?)?about yourself|introduce yourself|(?:walk|take) me through (?:your )?(?:resume|background|career|cv)|tell me about your (?:background|career))\b/i;
const SPLIT_MID_ASK = /\b(?:(?:go|dig) deeper on\b|explain the (?:[\w+#.-]+\s+){1,4}part\b|(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|do|does|did|would|could|can|will|should|has|have)\b|what's\b|tell me about\b|walk me through\b|can you (?:tell|walk|explain|describe)\b|could you (?:tell|walk|explain|describe)\b)/gi;
const SPLIT_MID_KEEPS = /\b(?:and|or|but|so|nor|then|me|us|them|him|her|know|knows|explain|describe|tell|ask|asked|asking|understand|see|show|about|on|of|in|for|to|than|that|is|are|was|were|wonder|sure|decide|decided|mean|matters|handle|exactly|just|like|into|from|with|by|at|as|if|whether|because|a|an|the|time|moment|day|case|cases|place|reason|point)\s*$/i;
const SPLIT_MID_OPEN = /\b(?:if|whether|unless|(?:how|where|when|what) (?:you|we|they))\b/i;   // "how you would migrate what is left": the clause is still open
function splitMidAsks(sentence) {
  if (/[.?!]\s*\S/.test(sentence)) return [sentence];
  const cuts = [];
  SPLIT_MID_ASK.lastIndex = 0;
  for (let m; (m = SPLIT_MID_ASK.exec(sentence));) {
    if (m.index === 0) continue;
    const left = sentence.slice(cuts.length ? cuts[cuts.length - 1] : 0, m.index).trim();
    const bareLeft = left.replace(SPLIT_LEAD, "");
    if (bareLeft.split(/\s+/).length < 3 || !SPLIT_START.test(bareLeft) || SPLIT_MID_KEEPS.test(left) || SPLIT_MID_OPEN.test(bareLeft.replace(/^\S+\s+/, ""))) continue;
    cuts.push(m.index);
  }
  if (!cuts.length) return [sentence];
  const out = [];
  let from = 0;
  for (const at of cuts) { out.push(sentence.slice(from, at).trim()); from = at; }
  out.push(sentence.slice(from).trim());
  return out.filter(Boolean);
}
// Slice 4 (29 Oct 2026): punctuation-stripped runs ("what is pam okay what is iga um what is oidc") and "Explain the
// CyberArk CPM. Explain the PSM.". Every rule below only runs inside the v4 pass, and splitDistinctAsks returns the
// slice-3 cut whenever the v4 pass throws or would change a single heard word.
const SPLIT_MID_ASK4 = /\b(?:(?:go|dig) deeper on\b|explain the (?:[\w+#.-]+\s+){1,4}part\b|(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|do|does|did|would|could|can|will|should|has|have)\b|what's\b|tell me about\b|walk me through\b|(?:can|could) you (?:tell|walk|explain|describe)\b|(?:have|did) you (?:ever )?(?:used|use|worked|work|implemented|deployed|managed|led|built|configured|administered|run)\b|do you (?:have|use|know)\b|explain (?:the|your)\s)/gi;
// Filler that sits between two asks: "okay", "um", "so", "and then (after that)", "next". "and" alone is not one,
// so "tell me about zscaler and why did you choose it" keeps its clause.
const SPLIT_BRIDGE_WORDS = "um+|uh+|so|okay|ok|alright|and then(?: after that)?|and (?:um+|uh+)|then|next|now|also|(?:and )?after that";
const SPLIT_BRIDGE_ORD = "second(?:ly)?|third(?:ly)?|fourth(?:ly)?|lastly|number (?:two|three|four|five)";
const SPLIT_BRIDGE_TAIL = new RegExp("(?:\\b(?:" + SPLIT_BRIDGE_WORDS + "|" + SPLIT_BRIDGE_ORD + ")\\s+)+$", "i");
const SPLIT_BRIDGE_LEAD = new RegExp("^(?:(?:" + SPLIT_BRIDGE_WORDS + ")[,]?\\s+)+", "i");
// A piece may start where a strong opener follows a finished ask of three words or more, with the filler before the
// opener moved onto the new piece. The pieces are rejoined unless the separate rules say the next one is new.
function splitMidAsksV4(sentence) {
  if (/[.?!]\s*\S/.test(sentence)) return [sentence];
  const cuts = [];
  SPLIT_MID_ASK4.lastIndex = 0;
  for (let m; (m = SPLIT_MID_ASK4.exec(sentence));) {
    if (m.index === 0) continue;
    const from = cuts.length ? cuts[cuts.length - 1] : 0;
    const left = sentence.slice(from, m.index);
    const tail = left.match(SPLIT_BRIDGE_TAIL);
    const coreLen = tail ? left.length - tail[0].length : left.length;
    const core = left.slice(0, coreLen).trim();
    const bareCore = core.replace(SPLIT_LEAD, "").replace(SPLIT_ORDINAL, "").replace(SPLIT_LEAD, "");
    // "explain the cyberark cpm explain the psm": an "explain the" piece only after a finished "explain the" piece.
    if (/^explain (?:the|your)\s$/i.test(m[0]) && !(/^explain (?:the|your)\s/i.test(bareCore) && bareCore.split(/\s+/).length >= 3 && !SPLIT_MID_KEEPS.test(core))) continue;
    if (/^explain (?:the|your)\s$/i.test(m[0])) { if (from + coreLen > from) cuts.push(from + coreLen); continue; }
    if (!bareCore || /,\s*$/.test(core) || bareCore.split(/\s+/).length < 3 || !SPLIT_START.test(bareCore) || SPLIT_MID_KEEPS.test(core) || SPLIT_MID_OPEN.test(bareCore.replace(/^\S+\s+/, ""))) continue;
    if (from + coreLen > from) cuts.push(from + coreLen);
  }
  if (!cuts.length) return [sentence];
  const out = [];
  let from = 0;
  for (const at of cuts) { out.push(sentence.slice(from, at).trim()); from = at; }
  out.push(sentence.slice(from).trim());
  return out.filter(Boolean);
}
// true = new card, false = same card, null = let the slice-3 rules decide.
function splitSeparateV4(next, prevText) {
  const raw = String(next || "").trim();
  // "and then after that what is okta", "um have you used saviynt": judge the ask without the bridge filler.
  const stripped = raw.replace(SPLIT_BRIDGE_LEAD, "").replace(/^,\s*/, "").trim();
  // "um second how does it rotate passwords": a numbered ask after the bridge is the next card (as in slice 3).
  const ord = stripped.match(SPLIT_ORDINAL);
  if (ord && stripped !== raw && !/^first(?:ly)?\b/i.test(stripped) && SPLIT_OPENER.test(stripped.slice(ord[0].length).replace(SPLIT_LEAD, ""))) return true;
  if (stripped && stripped !== raw && stripped.split(/\s+/).length >= 3 && /^(?:what|why|how|when|where|which|who|have you|did you|do you|can you|could you|tell me|walk me)\b/i.test(stripped)) return splitSeparate(stripped, prevText, true);
  // "Explain the CyberArk CPM. Explain the PSM.": an "explain the X" after a finished explain or question sentence,
  // where X is all new words, is the next card. "Explain that part", "Explain the trust part" stay.
  const prevSentence = (String(prevText || "").trim().split(/(?<=[.?!])\s+/).pop() || "").trim();
  const ex = raw.replace(SPLIT_LEAD, "").match(/^explain (?:the|your)\s+([\w+#.-]+(?:\s+[\w+#.-]+){0,3})\s*[.?!]?$/i);
  if (ex && (/[.?!]\s*$/.test(prevSentence) || /^explain (?:the|your)\s/i.test(prevSentence.replace(SPLIT_LEAD, ""))) && /^(?:explain|describe|what|how|why|tell me|walk me)\b/i.test(prevSentence.replace(SPLIT_LEAD, "")) && !/\b(?:that|this|it|those|these|same|part|piece|bit|side|step|more|further|again)\b/i.test(ex[1])) {
    const prevW = new Set(String(prevText || "").toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean));
    const obj = ex[1].toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !/^(?:and|the|how|why|your)$/.test(w));
    if (obj.length && obj.every((w) => !prevW.has(w))) return true;
  }
  return null;
}
function splitSpokenWords(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9+#']+/g, " ").trim(); }
function splitDistinctAsksBy(text, midCut, v3, v4) {
  const raw = String(text || "");
  const clean = (typeof fixPhrases === "function" ? fixPhrases(raw) : raw).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const said = clean.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const sentences = midCut ? said.flatMap(v4 ? splitMidAsksV4 : splitMidAsks) : said;
  const groups = [[]];
  let asked = false;
  for (const sentence of sentences) {
    const bare = sentence.replace(SPLIT_LEAD, "").trim();
    if (!bare || splitNoise(bare) || splitNoise(sentence)) continue;
    const prev = groups[groups.length - 1].join(" ");
    if (asked && splitSeparate(sentence, prev, v3, v4)) { groups.push([sentence]); asked = true; continue; }
    groups[groups.length - 1].push(sentence);
    if (v3 ? splitSetsAsk(sentence) : (bare && !splitNoise(bare) && (SPLIT_OPENER.test(bare) || (/\?\s*$/.test(bare) && SPLIT_START.test(bare))))) asked = true;
  }
  return groups.map((g) => g.join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
}
// Slice 5b (29 Oct 2026), from the blind dossier bank. A pass over the slice-4 cards that only regroups whole
// pieces: on a fault or any changed word the slice-4 cut stands.
//  - "what dashboards or data tools || have you used": a what/which piece with no verb is finished by the next one.
//  - "how do you speak about controls to people || who do not have a security background": "who" right after a
//    word for people, with no filler between, is that clause. "where do guardrails belong who can modify" still cuts.
//  - Two finished "?" asks, each 7 words or more, that share no topic word and do not point back, are two cards.
//    "How do you assess the business impact? How do you understand root cause?" (6 words) stays one card.
const SPLIT5_STOP = new Set("what how why when where which who whom whose you your yours the and for with that this from have does did would could should into about there their them they been being were was are is can will what's tell walk give describe explain me us our ever just really also more most some any many much very".split(" "));
const SPLIT5_VERB = /\b(?:is|are|was|were|do|does|did|have|has|had|would|could|should|can|will|make|makes|look|looks|use|used|prevent|prevented|show|shows)\b/i;
const SPLIT5_OPEN = /^(?:what|how|why|when|where|which|who|is there|are there|are you|were you|was there|is it|do you|did you|have you|has your|can you|could you|would you|tell me|walk me|describe)\b/i;
const SPLIT5_BACK = /\b(?:it|its|that|this|they|them|their|those|these|the same|such)\b/i;
function split5Words(s) { return String(s || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 4 && !SPLIT5_STOP.has(w)).map((w) => w.length > 4 ? w.replace(/([^s])s$/, "$1") : w); }
function split5Lead(s) { return String(s || "").replace(/^(?:(?:um+|uh+|so|okay|ok|and|then|next|now|also|alright)[,]?\s+)+/i, "").trim(); }
function split5Pair(a, b) {
  const x = split5Lead(a), y = split5Lead(b);
  if (!/\?\s*$/.test(x) || !/\?\s*$/.test(y)) return false;
  if (!SPLIT5_OPEN.test(x) || !SPLIT5_OPEN.test(y)) return false;
  if (x.split(/\s+/).length < 7 || y.split(/\s+/).length < 7) return false;
  if (SPLIT5_BACK.test(y)) return false;
  const left = new Set(split5Words(x));
  return split5Words(y).every((w) => !left.has(w));
}
function splitCardsV5(cards) {
  const merged = [];
  for (const card of cards) {
    const prev = merged.length ? merged[merged.length - 1] : "";
    const bare = split5Lead(card);
    const prevBare = split5Lead(prev);
    const fragment = prev && !/[.?!]\s*$/.test(prev) && /^(?:what|which|how many|how much)\s/i.test(prevBare) && prevBare.split(/\s+/).length <= 6 && !SPLIT5_VERB.test(prevBare.replace(/^\S+\s+/, ""))
      && /^(?:have|did|do|would|could|can|will) you\b/i.test(bare);
    const clause = prev && !/[.?!]\s*$/.test(prev) && /^who\s/i.test(card) && /\b(?:people|someone|anyone|everyone|those|users|staff|person|persons|stakeholders|engineers|owners|managers|leaders|executives|employees|members|colleagues|peers|clients|customers|vendors)\s*$/i.test(prev);
    if (fragment || clause) merged[merged.length - 1] = prev + " " + card;
    else merged.push(card);
  }
  const out = [];
  for (const card of merged) {
    const ss = card.split(/(?<=[?])\s+/).filter(Boolean);
    let cur = ss[0] || "";
    for (let i = 1; i < ss.length; i++) {
      if (split5Pair(ss[i - 1], ss[i])) { out.push(cur.trim()); cur = ss[i]; } else cur += " " + ss[i];
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
// Slice 6 (30 Oct 2026): spoken filler at a question's start or end ("Um so what…", "…, right?", "you know,",
// "What what…", "How do you, sorry, what…") hid the question opener. The cut is run again on a detection copy with
// that filler left out. The shown and saved text is never changed: cards are cut from the original words, only at
// a "?" "." or "!" the speaker's text already has, and only when every sentence-end cut of slice 5 is kept.
// Any fault, lost word or doubt returns the slice-5 cut.
const FILL6_LEAD = /^(?:um+|uh+|so|okay|ok|alright|like|yeah|well|and)$/i;
const FILL6_OPEN = /^(?:what|why|how|when|where|which|who|whose|can|could|would|will|do|does|did|is|are|was|were|have|has|tell|walk|describe|explain|give|should)$/i;
const fill6Bare = (t) => String(t).replace(/^[^\w']+|[^\w']+$/g, "").toLowerCase();
const fill6Norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "");
const fill6End = (t) => /[.?!]["')\]]*$/.test(t);
function fill6Detect(tokens) {
  const det = tokens.slice();
  const sentOf = [], touched = new Set();
  const falseStart = [];
  let sent = 0;
  for (let i = 0; i < tokens.length; i++) { sentOf.push(sent); if (fill6End(tokens[i])) sent++; }
  const drop = (i) => { det[i] = null; touched.add(sentOf[i]); };
  for (let s = 0; s < tokens.length; s++) {
    if (s > 0 && !fill6End(tokens[s - 1])) continue;
    let i = s;
    // a false start: "How do you, sorry, what…" / "What was, um, how…"
    for (let k = 1; k <= 3 && i + k + 1 < tokens.length; k++) {
      const end = tokens[i + k - 1], f = tokens[i + k];
      if (fill6End(end)) break;
      if (/,$/.test(end) && /^(?:sorry|um+|uh+|i mean),$/i.test(f) && FILL6_OPEN.test(fill6Bare(tokens[i + k + 1])) && FILL6_OPEN.test(fill6Bare(tokens[i]))) {
        for (let j = i; j <= i + k; j++) drop(j);
        falseStart.push(i + k + 1);
        i += k + 1; break;
      }
    }
    // leading filler run: "Um so", "Okay, um,", "Yeah and", "Like" — only before an opener; a lone "and" stays
    let j = i;
    while (j < tokens.length && !fill6End(tokens[j]) && FILL6_LEAD.test(fill6Bare(tokens[j]))) j++;
    if (j > i && j < tokens.length && FILL6_OPEN.test(fill6Bare(tokens[j])) && !(j - i === 1 && fill6Bare(tokens[i]) === "and")) {
      for (let x = i; x < j; x++) drop(x);
      i = j;
    }
    // "What what is…": a doubled opener
    if (i + 1 < tokens.length && FILL6_OPEN.test(fill6Bare(tokens[i])) && fill6Bare(tokens[i]) === fill6Bare(tokens[i + 1]) && !/[,.?!]$/.test(tokens[i])) drop(i);
  }
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (det[i] === null || det[i + 1] === null) continue;
    if (fill6Bare(tokens[i]) === "you" && /^know,$/i.test(tokens[i + 1]) && i + 2 < tokens.length && !fill6End(tokens[i + 1])) { drop(i); drop(i + 1); }
  }
  for (let i = 1; i < tokens.length; i++) {
    if (/^right\?$/i.test(tokens[i]) && det[i - 1] !== null && /,$/.test(tokens[i - 1])) { drop(i); det[i - 1] = tokens[i - 1].replace(/,$/, "?"); }
  }
  for (let i = 0; i < det.length; i++) {
    if (det[i] === null) continue;
    let p = i - 1; while (p >= 0 && det[p] === null) p--;
    if ((p < 0 || fill6End(det[p])) && (i === 0 || det[i - 1] === null)) det[i] = det[i].charAt(0).toUpperCase() + det[i].slice(1);
  }
  return { det, sentOf, touched, falseStart };
}
// Maps cards back onto token indices; null if any card is not a whole run of the given tokens.
function fill6Bounds(cards, toks) {
  const bounds = []; let at = 0;
  for (const c of cards) {
    const n = String(c).trim().split(/\s+/).filter(Boolean).length;
    const want = fill6Norm(String(c)), have = toks.slice(at, at + n).map(fill6Norm).join("");
    if (!n || want !== have) return null;
    at += n; bounds.push(at);
  }
  return at === toks.length ? bounds.slice(0, -1) : null;
}
function splitCardsFiller6(text, cut5, cutAgain) {
  try {
    const tokens = String(text).trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 4) return cut5;
    const { det, falseStart } = fill6Detect(tokens);
    if (det.every((t, i) => t === tokens[i])) return cut5;
    const keptIdx = [], detToks = [];
    det.forEach((t, i) => { if (t !== null) { keptIdx.push(i); detToks.push(t); } });
    const b6det = fill6Bounds(cutAgain(detToks.join(" ")), detToks);
    const b5 = fill6Bounds(cut5, tokens);
    if (!b6det || !b5) return cut5;
    const b6 = [];
    for (const b of b6det) {
      const o1 = keptIdx[b - 1], o2 = keptIdx[b];
      let cut = -1;
      for (let p = o2 - 1; p >= o1; p--) if (fill6End(tokens[p])) { cut = p + 1; break; }
      if (cut < 0) return cut5;
      b6.push(cut);
    }
    for (const b of b5) {
      if (b6.includes(b)) continue;
      // a slice-5 cut may only be dropped when it sits just after a false start ("What was, um, what methods || do you…")
      if (fill6End(tokens[b - 1]) || !falseStart.some((f) => b > f && b - f <= 6)) return cut5;
    }
    if (b6.length === b5.length && b6.every((b, k) => b === b5[k])) return cut5;
    const out = []; let from = 0;
    for (const b of [...b6, tokens.length]) { out.push(tokens.slice(from, b).join(" ")); from = b; }
    return fill6Norm(out.join(" ")) === fill6Norm(tokens.join(" ")) ? out : cut5;
  } catch { return cut5; }
}
function splitDistinctAsks(text) {
  const cut5 = splitDistinctAsksV5(text);
  return splitCardsFiller6(text, cut5, splitDistinctAsksV5);   // slice 6: never worse than slice 5 (falls back on doubt)
}
function splitDistinctAsksV5(text) {
  const cut4 = splitDistinctAsksV4(text);
  try {
    const cut5 = splitCardsV5(cut4);
    return splitSpokenWords(cut5.join(" ")) === splitSpokenWords(cut4.join(" ")) ? cut5 : cut4;   // slice 5b failsafe: the slice-4 cut on any lost word
  } catch { return cut4; }
}
function splitDistinctAsksV4(text) {
  const v3 = splitDistinctAsksV3(text);
  try {
    const cut4 = splitDistinctAsksBy(text, true, true, true);
    return splitSpokenWords(cut4.join(" ")) === splitSpokenWords(v3.join(" ")) ? cut4 : v3;   // slice 4 failsafe: the slice-3 cut on any lost word
  } catch { return v3; }
}
function splitDistinctAsksV3(text) {
  const before = splitDistinctAsksBy(text, false);
  let v2 = before;
  try {
    const after = splitDistinctAsksBy(text, true);
    v2 = splitSpokenWords(after.join(" ")) === splitSpokenWords(before.join(" ")) ? after : before;   // failsafe: no word lost
  } catch { return before; }
  try {
    const v3 = splitDistinctAsksBy(text, true, true);
    return splitSpokenWords(v3.join(" ")) === splitSpokenWords(v2.join(" ")) ? v3 : v2;   // slice 3 failsafe: the v2 cut on any lost word
  } catch { return v2; }
}
// personal-logistics parity: start — a copy of src/lib/kompasRelevance.ts (owner rule, 29 Oct 2026): cached answers (book,
// anchors) are painted here without a server call, so the page skips the same asks. Parity: kompas-logistics-client.test.mjs.
const PERSONAL_LOGISTICS = /\b(?:visa|sponsorship|sponsor (?:me|you)|work authori[sz]ation|authori[sz]ed to work|h-?1b|green card|ead|citizenship|(?:u\.?\s*s\.?|u\s+s|united states|american|a|an)\s+citizens?|salary|compensation|ctc|pay (?:range|rate|expectations?)|(?:hourly|day|bill|your|desired|expected) rate|relocat(?:e|ion)(?!\s+(?:the|a|an|our|this|that|these|those|it|its|data|workloads?|services?|servers?|apps?|applications?|secrets?|keys?|credentials?|certificates?|certs?|accounts?|hosts?|clusters?|subnets?)\b)|(?:your|home|current|mailing|residential) address|where (?:are|do) you (?:currently )?(?:based|located|live|living|staying)|current(?:ly)? location|(?:your|earliest|possible|expected) start date|when (?:can|could|would) you (?:start|join)|how soon can you (?:start|join)|available to (?:start|join)|notice period|weeks'? notice|your availability(?! (?:targets?|slas?|slos?|goals?|metrics?|numbers?|requirements?)\b)|are you (?:currently )?available(?! (?:zones?|regions?)\b))\b|^\s*(?:(?:what is |what's )?(?:your )?availability|citizen|notice|start date)[.?!]*$/i
const NOT_PERSONAL = /\b(?:was|were|did|had|tell me about (?!your (?:visa|salary|notice|availability|relocation))|how (?:do|does|did|would|is|are)|why|explain|describe|walk (?:me|us) through|design|implement|build|difference|zones?|limit(?:ing|s)?|work at|experience|worked|projects?)\b|\b(?:and|also|plus)\b[^.?!]*\b(?:what|how|why|tell|explain|describe|walk)\b/i
const PERSONAL_MOVE = /(?<!\b(?:data ?cent(?:er|re)|server|workload|application|app|service|cloud|vault|database|office|team)\s)\brelocat(?:e|es|ed|ing|ion)\b(?!\s+(?:the|a|an|our|this|that|these|those|it|its|of|data|workloads?|services?|servers?|apps?|applications?|vault|psm|databases?|secrets?|keys?|credentials?|certificates?|certs?|accounts?|hosts?|clusters?|subnets?)\b)|\bwhere (?:are|do) you (?:currently )?(?:based|located|live|living|staying)\b|\b(?:you are|you're) (?:currently )?(?:based|located)\b|\byour current(?:ly)? location\b|\bwhy are you based\b/i
const UNSPLIT_COMPOUND = /\b(?:and|also|plus)\b[^.?!]*\b(?:what|how|why|tell|explain|describe|walk)\b/i
function personalLogistics(text) {
  const t = String(text || "").trim()
  if (!t || t.split(/\s+/).length > 16) return false
  if (PERSONAL_MOVE.test(t)) return !UNSPLIT_COMPOUND.test(t)
  return PERSONAL_LOGISTICS.test(t) && !NOT_PERSONAL.test(t)
}
function withoutLogistics(text) {
  const s = String(text || "")
  const parts = s.split(/,?\s+(?:and|also|plus)(?:\s+(?:um+|uh+|so|then|also|and),?)*\s+(?=(?:tell|explain|describe|how|what|why|walk|can|could|do|have|are|where|when|would)\b)/i)
  if (parts.length === 1) return personalLogistics(s) ? "" : s
  const kept = parts.filter((p) => !personalLogistics(p))
  return kept.length === parts.length ? s : kept.join(" and ").trim()
}
// personal-logistics parity: end
const armsAuto = () => pendingHeard().some(t => t.who === questionSource() && (Q_CUE.test(t.text) || opensNewAsk(t.text)));
function scheduleAuto() {
  clearTimeout(autoTimer);
  noteTurnGate();
  if (!autoOn || !armsAuto()) return;
  const tail = pendingHeard().filter(t => t.who === questionSource()).map(t => t.text).join(" ");
  const wait = autoWaitMs(tail);
  autoTimer = setTimeout(function fire() {
    if (!autoOn || !armsAuto()) return;
    if (captures.some(c => c.voiced && c.who === questionSource()) || finals.size || answerCtl) { autoTimer = setTimeout(fire, 700); return; }   // the interviewer still talking / still answering (slice 12: your own mic never holds the answer back)
    aiAnswer(true);
  }, wait);
}
// Turn gate (slice 2): each new heard line from the question source gets answer / wait / no answer needed, logged with
// its reason. It only labels; it never stops an answer. "No answer needed" says so and points to AI Answer, which
// always answers ("Answer anyway").
function noteTurnGate() {
  try {
    const src = questionSource(), last = pendingHeard().filter(t => t.who === src).slice(-1)[0];
    if (!last || last.seq === gateSeenSeq) return;
    gateSeenSeq = last.seq;
    const g = turnGate(last.text);
    logDecision("gate-" + g.outcome + ":" + g.reason, src, last.text);
    if (g.outcome === "skip" && !answerCtl) status("Heard — no answer needed. Press AI Answer to answer anyway.", "live");
  } catch { /* the gate only labels; a fault here never blocks an answer */ }
}
let gateSeenSeq = 0;
function resetLiveState() {           // a new or exited session starts clean: no leaked stream, timer or badge
  for (const c of inflight) { try { c.abort(); } catch {} }
  inflight.clear();
  if (answerCtl) { try { answerCtl.abort(); } catch {} answerCtl = null; }
  clearTimeout(autoTimer);
  heardSeq = 0; answeredSeq = 0;
  lastCaption = ""; captionAnnounced = false;
  updatePending();
}
// Misheard terms (owner, 2026-09-30: "yes — and dependency keywords and other related or used words as well").
// Vocabulary = acronyms/CamelCase terms in the resume, JD, documents, prep and the answers on screen, plus the PAM /
// security ecosystem and its integration dependencies. Code only, no AI:
//  - an ALL-CAPS word one letter from exactly one known acronym becomes it ("CBM" -> CPM, "PDA" -> PTA);
//  - two words that together are one letter from a known long term become it ("cyber arc" -> CyberArk);
//  - a long lowercase word one letter from a known long term becomes it ("sentinal" -> Sentinel);
//  - a lowercased CamelCase term gets its real casing ("powershell" -> PowerShell). Short English words are never touched.
const DOMAIN_TERMS = "CyberArk PAS PVWA CPM PSM PSMP PTA EPM AIM CCP PACLI PAReplicate PrivateArk Vault LDAP LDAPS SAML OAuth OIDC RADIUS Kerberos NTLM MFA SSO SIEM SOAR EDR XDR Splunk Sentinel QRadar ServiceNow PowerShell Python REST API SSH RDP WinRM Azure AWS GCP Entra IAM PAM IGA SailPoint Okta BeyondTrust Delinea Thycotic HashiCorp Terraform Ansible Jenkins Kubernetes AKS EKS Docker Linux Unix Windows SQL Oracle SAP NIST SOX PCI HIPAA ISO CIS MITRE STRIDE OWASP SAST DAST Fortify Qualys Wiz CrowdStrike Defender Syslog SNMP TLS PKI HSM KMS JSON YAML GitHub GitLab ServiceNow Jira Confluence VMware vCenter ESXi Zscaler Venafi Saviynt".split(" ");
// Real acronyms are already right: a heard "CSA" or "CSV" is never "corrected" into CSF (self-play false positives, 2026-09-30).
const KNOWN_ACRONYMS = new Set("AAA ACL AD AES AI AKS ALB AMI API APT ARP ASA ASN AWS AZ BGP BIA BYOD CA CASB CCPA CCP CDN CI CD CIA CIDR CIS CISA CISM CISO CISSP CLI CMDB CMMC CPU CRL CSA CSF CSP CSPM CSR CSRF CSV CTI CVE CVSS CWPP DAST DDoS DHCP DKIM DLP DMARC DMZ DNS DNSSEC DoD DoS DR DRP EC2 ECS EDR EKS ELB EPM ERP ETL FIDO FIM FIPS GCP GDPR GPO GRC HA HIDS HIPAA HIPS HMAC HR HSM HTTP HTTPS IaaS IaC IAM ICS IDP IdP IDS IGA IOC IOT IoT IP IPS IPsec IR ISMS ISO IT ITGC ITIL ITSM JIT JML JSON JWT KMS KPI KQL LAN LAPS LDAP LDAPS LLM MAC MDM MDR MFA ML MSSP MTTD MTTR NAC NAT NDR NGFW NIST NOC NTLM NTP OIDC OKR OS OSI OSINT OT OTP OWASP PaaS PAM PCI PHI PII PIM PKI PLC POC PSM PTA QA RACI RADIUS RASP RBAC RCA RDP REST RPO RSA RTO SaaS SAML SAST SBOM SCA SCADA SCIM SDLC SIEM SLA SMB SMTP SNMP SOAR SOC SOP SOX SPF SPL SQL SSDLC SSH SSL SSO SSPM STIX STRIDE TCP TLS TPM TTP TTPs UBA UDP UEBA URL USB UTM VLAN VM VPC VPN WAF WAN XDR XML XSS YAML ZTNA ISE IRM DN IEC STP IPC QMS LIMS CUCM BSOD RAM ROM GPU SSD HDD PC MDE DPA EOL SME PMO POA&M SSP ATO FedRAMP".split(" ").map(x => x.toUpperCase()));
const HEADER_WORDS = /^(SUMMARY|SKILLS|PROJECTS?|EXPERIENCE|EDUCATION|CERTIFICATIONS?|PROFILE|OBJECTIVE|RESPONSIBILITIES|ACHIEVEMENTS|PROFESSIONAL|TECHNICAL|CORE|COMPETENCIES|TOOLS|REFERENCES)$/;
let termCache = { key: "", list: [] };
function termVocab() {
  const s = current || {}, key = `${s.id}|${cards.length}`;
  if (termCache.key === key) return termCache.list;
  const src = [s.resume, s.jd, s.documents, s.instructions, JSON.stringify((s.prep && s.prep.identity) || ""), ...cards.map(c => typeof c.answer === "string" ? c.answer : "")].join(" ");
  const found = src.match(/\b[A-Za-z][A-Za-z0-9+&-]*[A-Z][A-Za-z0-9+&-]*\b/g) || [];
  const set = new Map();
  for (const t of DOMAIN_TERMS) set.set(t.toLowerCase(), t);                          // the ecosystem list always counts
  for (const t of found) {
    const up = (t.match(/[A-Z]/g) || []).length, allCaps = /^[A-Z0-9&+-]+$/.test(t);
    if (HEADER_WORDS.test(t) || (allCaps && t.length > 6)) continue;                  // section headers and shouted words are not terms
    if (t.length >= 2 && t.length <= 20 && up >= 2 && !set.has(t.toLowerCase())) set.set(t.toLowerCase(), t);
  }
  const freq = {}; for (const t of found) freq[t] = (freq[t] || 0) + 1;                // how often each term appears in HIS material
  termCache = { key, list: [...set.values()], freq }; return termCache.list;
}
function edits1(a, b) {                                  // true when a and b differ by at most one edit
  if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return e + (a.length - i) + (b.length - j) <= 1;
}
// Phrase-level rescue for the multi-word garbles Whisper repeats on security
// vocabulary — token-level fixTerms cannot see across words ("domain control
// her"). Deliberately narrow: every pattern is anchored to a domain phrase,
// so ordinary sentences pass through untouched.
// Slice 5a: this list and REPAIRS in src/lib/kompasDictation.ts are ONE list, entry for entry (same pattern, order
// and output). scripts/tests/kompas-spelling-parity.test.mjs fails if they drift: change both in the same patch.
const PHRASE_FIXES = [
  [/\bdomain control(?:ler|er| her| a)\b/gi, "domain controller"],
  [/\b(?:mitre|miter|myter) attack\b/gi, "MITRE ATT&CK"],
  [/\b(?:kerberose|curberos|kerbraus)\b/gi, "Kerberos"],
  [/\bsock (analyst|team|center|centre|manager|lead)\b/gi, "SOC $1"],
  [/\b(?:seem|seam|sim) (tool|platform|solution|system|logs?|integration|implementation|deployment|monitoring|dashboard|alerts?|correlation|engine|instance|rules?)\b/gi, "SIEM $1"],
  [/(?<=\b(?:with|using|used|use|via|into|on|in|our|their|about|from|for|migrated\s+to|migrating\s+to|experience\s+with|worked\s+with|worked\s+on)\s+(?:the\s+)?)(?:seem|seam|sim)\b/gi, "SIEM"],
  [/\boh auth\b/gi, "OAuth"],
  [/\bcrowd strike\b/gi, "CrowdStrike"],
  [/\blatteral movement\b/gi, "lateral movement"],
  [/\bprivilege excalation\b/gi, "privilege escalation"],
  [/\bactive directory\b/gi, "Active Directory"],
  [/\bvee\s+cert\b/gi, "V-Cert"],
  [/\bwe\s+cert\b/gi, "V-Cert"],
  [/\bv[-\s]?cert\b/gi, "V-Cert"],
  [/\bvenaf(?:i|ee|y)(?:\s+tpp)?\b/gi, (m) => /tpp/i.test(m) ? "Venafi TPP" : "Venafi"],
  [/\bluna hsm\b/gi, "Luna HSM"],
  [/\bpkcs\s*(?:number|no\.?|#)?\s*ten\b/gi, "PKCS#10"],
  [/\bpkcs\s+(?:number|no\.?)\s+10\b/gi, "PKCS#10"],
  [/\bpkcs\s*#?\s*10\b/gi, "PKCS#10"],
  [/\bgemalto\b/gi, "Gemalto"],
  [/\bpower\s*shell\b/gi, "PowerShell"],
  [/\bbase\s+64\b(?!\s*-?\s*bits?\b)/gi, "Base64"],
  [/\brest\s+api\b/gi, "REST API"],
  [/\bgroup\s+policy\b/gi, "Group Policy"],
  [/\bsingle\s+sign[\s-]?on\b/gi, "single sign-on"],
  [/\bmulti[\s-]factor\b/gi, "multi-factor"],
  [/\bticket\s+granting\b/gi, "ticket-granting"],
  [/\bpass\s+the\s+hash\b(?!\s+brown\b)/gi, "pass-the-hash"],
  [/\bpass\s+the\s+ticket\b/gi, "pass-the-ticket"],
  [/\bcyber[\s-]+ar[ck]\b/gi, "CyberArk"],                                           // "cyber-arc" on his 27 Oct card
  [/\b(?:shkivs|shkives|sh\s+keys|s\s+h\s+keys|ssh\s+keys)\b/gi, "SSH keys"],      // "Shkivs" reached his question and the answer, 27 Oct
  [/\b(?:shkiv|sh\s+key|s\s+h\s+key|ssh\s+key)\b/gi, "SSH key"],
  [/\bmicro\s+soft\s+sentinel\b/gi, "Microsoft Sentinel"],
  [/\bqualys\b/gi, "Qualys"],
  [/\bnessus\b/gi, "Nessus"],
  [/\bsplunk\b/gi, "Splunk"],
  [/\bfifth\s+third\b/gi, "Fifth Third"],
  [/\b(?:zee|see)\s+scaler\b/gi, "Zscaler"],
  [/\bven\s+a\s+fi\b/gi, "Venafi"],
  [/\bu\s+s\s+citizen\b/gi, "U.S. citizen"],
  [/\bnist\s+c\s*s\s*f\b/gi, "NIST CSF"],
  [/(?<=\b(?:(?:using|used|use|via|into|like|vs|versus|from|our|their|integrate|integrated|integrating|configured|deployed|implemented|administered|cyberark|okta|sailpoint|saviynt|jira)\s+(?:with\s+|to\s+)?|(?:(?:track|tracked|tracking|log|logged|logging|ticket|tickets|ticketed|raise|raised|submit|submitted|document|documented)\s+(?:(?:it|this|that|them|these|those|one|a\s+ticket|the\s+ticket)\s+)?|(?:open|opened|file|filed|record|recorded|create|created|request|requested)\s+(?:it|this|that|them|these|those|one|a\s+ticket|the\s+ticket)\s+)in\s+))service\s+now\b|\bservice\s+now(?=\s+(?:tickets?|itsm|itom|cmdb|instances?|workflows?|platform|integration|admin|modules?|incidents?|change|requests?|catalog|grc|secops|irm|api|discovery|flows?)\b)/gi, "ServiceNow"],   // slice 5a: tool context only, so "the service now is slow" stays; "track it / log it / ticket in service now" is tool context
  [/\bgoogle\s+sec\s*ops\b/gi, "Google SecOps"],
  [/(?<=\b(?:at|for|join|joining|joined|about|with|to)\s+)big\s+in\s*tro\b(?!\s+(?:to|for|of|and|speech|video|slide|moment)\b)|(?<=\bgive\s+(?:me|us)\s+a\s+)big\s+in\s*tro(?=\s*[.?!]?\s*$)/gi, "Big Intro"],   // slice 5a: the company name only, so "a big intro" stays; a bare "give me a big intro" (master test) is still the name
  [/\bsaviant\b/gi, "Saviynt"],
  [/\bsavvy\s+ent\b/gi, "Saviynt"],
  [/\bcooper\s+nett(?:y|ie)s\b/gi, "Kubernetes"],
  [/\bkuber\s*netes\b/gi, "Kubernetes"],
  [/\bkube\s*netes\b/gi, "Kubernetes"],
  [/\bkubernet(?:ee|i)s\b/gi, "Kubernetes"],
  [/\bkubernetes\b/gi, "Kubernetes"],
  [/\b(?:pee\s+kay\s+eye|p\.?\s*k\.?\s*i\.?)\b/gi, "PKI"],
  [/\bterra\s+form\b/gi, "Terraform"],
  [/\bterror\s+form\b/gi, "Terraform"],
  [/\bteraform\b/gi, "Terraform"],
  [/\bterraform\b/gi, "Terraform"],
  // demo-final: mirrors the server repair AQ added in kompasDictation.ts (stress round 2/6), kept entry for entry.
  [/\bresid(?:ue|ual)?\s+(?:jewel|jewell|joule|you all|all|al)\s+(risks?)\b/gi, "residual $1"],
  [/\bstart\s+method\b/gi, "STAR method"],
  [/\bs\.?\s*t\.?\s*a\.?\s*r\.?\s+method\b/gi, "STAR method"],
  [/\bstar\s+method\b/gi, "STAR method"],
  // Mishearings found on 29 Oct 2026 (voice slice). Each one is anchored to its domain words.
  [/\bsail\s+point\b/gi, "SailPoint"],
  [/(?<=\b(?:did|does|with|into|using|use|used|like|from|vs|versus|deploy|deployed|implemented|chose|picked|cyberark|our|the|a)\s+)beyond\s+trust\b|\bbeyond\s+trust(?=\s+(?:pam|password|privileged|remote|vault|endpoint|suite|platform|deployment|rollout|compare[sd]?)\b)/gi, "BeyondTrust"],   // only next to tool words, so "went beyond trust" stays
  [/\bhashi\s+corp\b/gi, "HashiCorp"],
  [/\bz\s+scaler\b/gi, "Zscaler"],
  [/\bcyber\s*arch\b/gi, "CyberArk"],
  [/\bmy\s+tree\s+attack\b/gi, "MITRE ATT&CK"],
  [/\bresid(?:ue)?\s+jewel\s+risk\b/gi, "residual risk"],
  [/\bdev\s+sec\s+ops\b/gi, "DevSecOps"],
  [/\bsoc\s+(?:two|2)\b|\bsock\s+(?:two|2)(?=\s+(?:audits?|reports?|type|compliance|controls?|certification|readiness|attestation|program|framework)\b)/gi, "SOC 2"],   // "a sock two days ago" stays
  [/\bnist\s+eight\s+hundred\s+(?:dash\s+)?fifty[\s-]three\b/gi, "NIST 800-53"],
  [/\b(?:in\s*tra|entra)\s+i\.?\s*d\b/gi, "Entra ID"],
  [/\bpost\s+gres\s*q\s*l\b/gi, "PostgreSQL"],
  [/\bjay\s+son\s+web\s+tokens?\b/gi, "JSON Web Token"],
  [/\bo\s+i\s+d\s+c\b/gi, "OIDC"],
  [/\bsam\s+el\s+(assertion|token|response|sso|federation)\b/gi, "SAML $1"],
  [/\bans\s+ible\b/gi, "Ansible"],
  [/(?<=\b(?:use|used|using|in|on|with|from|our|into|self-hosted|hosted|via|of)\s+)git\s+lab\b|\bgit\s+lab(?=\s+(?:runners?|ci|pipelines?|repos?|repository|server|instance|issues?|merge|projects?)\b)/gi, "GitLab"],   // "go git lab results" stays
  [/\b(?:get|git)\s+hub\s+(actions|repo|repository|workflow)\b/gi, "GitHub $1"],
  [/\bec\s+two\s+(instances?)\b/gi, "EC2 $1"],
  [/\bs\s+three\s+(buckets?)\b/gi, "S3 $1"],
  [/\bdocker\s+file\b/gi, "Dockerfile"],
];
function fixPhrases(text) {
  let t = String(text || "");
  for (const [re, rep] of PHRASE_FIXES) t = t.replace(re, rep);
  return t;
}
function fixTerms(text) {
  const vocab = termVocab(); if (!vocab.length) return text;
  const lower = new Map(vocab.map(t => [t.toLowerCase(), t]));
  const acr = vocab.filter(t => /^[A-Z0-9&]{3,6}$/.test(t)), long = vocab.filter(t => t.length >= 7);
  const toks = String(text).split(/(\s+)/);
  const core = (t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  const swap = (t, word) => t.replace(core(t), word);
  for (let k = 0; k < toks.length; k += 2) {
    const w = core(toks[k]); if (!w) continue;
    const lw = w.toLowerCase();
    if (lower.has(lw)) { const v = lower.get(lw); if (v !== w && v.length >= 6 && /[a-z]/.test(v) && (v.match(/[A-Z]/g) || []).length >= 2) toks[k] = swap(toks[k], v); continue; }   // "powershell" -> PowerShell (multi-capital names only)
    if (/^[A-Z0-9]{2,6}$/.test(w) && (KNOWN_ACRONYMS.has(w) || w.length < 3)) continue;   // a real acronym is already right; 2 letters is too little to judge
    if (/^[A-Z0-9]{2,6}$/.test(w)) {                                                  // "CBM" -> CPM, only when one acronym fits
      // only toward a term HIS material uses twice or more — or once, when this same line also names one of his terms (context)
      const ctx = toks.some((t2, k2) => k2 !== k && lower.has(core(t2).toLowerCase()) && core(t2).length >= 3);
      const c = acr.filter(a => edits1(a, w) && ((termCache.freq[a] || 0) >= 2 || (ctx && (termCache.freq[a] || 0) >= 1))).sort((x, y) => (termCache.freq[y] || 0) - (termCache.freq[x] || 0));
      const f0 = c.length && (termCache.freq[c[0]] || 0), f1 = c.length > 1 ? (termCache.freq[c[1]] || 0) : -1;
      if (c.length === 1 || (c.length > 1 && f0 >= 2 && f0 >= 2 * Math.max(1, f1))) toks[k] = swap(toks[k], c[0]);   // a tie goes to the term his material uses far more
      continue;
    }
    const nxt = k + 2 < toks.length ? core(toks[k + 2]) : "";
    if (nxt) {                                                                         // "cyber arc" -> CyberArk
      const joined = (w + nxt).toLowerCase(), c = long.filter(t => edits1(t.toLowerCase(), joined));
      if (c.length === 1 && !lower.has(nxt.toLowerCase())) { toks[k] = swap(toks[k], c[0]); toks[k + 1] = ""; toks[k + 2] = toks[k + 2].replace(core(toks[k + 2]), ""); k += 2; continue; }
    }
    if (w.length >= 7 && /^[a-z]+$/.test(w)) { const c = long.filter(t => edits1(t.toLowerCase(), lw)); if (c.length === 1) toks[k] = swap(toks[k], c[0]); }   // "sentinal" -> Sentinel
  }
  return toks.join("").replace(/\s{2,}/g, " ");
}
function heardDraft(lines, screen, answerText) {
  const noise = /^(?:ok(?:ay)?|hi|hello|hey|thanks|thank you|yeah|yep|yes|no|nope|uh+|um+|hmm+)[.!?]*$/i;
  const bag = new Set(String(answerText || "").toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length >= 3));
  const bits = [];
  for (const t of lines || []) {
    if (!t) continue;
    const text = String(t.text || "").replace(/\s+/g, " ").trim();
    if (!text || noise.test(text)) continue;
    if (t.who === "You" && bag.size) {
      const words = text.toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length >= 3);
      if (words.length && words.filter(w => bag.has(w)).length / words.length >= 0.5) continue;
    }
    bits.push(text);
  }
  // The Heard line is a live caption, not the record (the drawer holds every
  // line): show the last four phrases, rolling forward as new lines arrive.
  const q = bits.slice(-4).join(" ");
  return q.length > 600 ? "…" + q.slice(-600) : q;
}
// Caption capture (owner, 1 Nov 2026, titled "caption capture"): when the
// desktop shell detects a live-caption box anywhere, its text flows here
// automatically — no share, no Whisper, no extra tap. Each caption update
// repeats the tail of the previous one, so only the new words enter the
// transcript, as interviewer lines, through the same onTranscript path
// every heard line takes: term correction, question forming, Auto, and
// AI Answer all work on captions exactly as on transcribed audio. The
// caption to question-box leg is synchronous, so it lands in well under a
// second; the shell polls the caption box at most every 250 ms (bridge
// contract: the shell sends "kompas:caption" with the box text; the page
// owns dedup). Self-contained: captionNewPart is pure, with its stopword
// list inlined, so suites can extract it alone.
function captionNewPart(last, text) {
  try {
    const stop = ["the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on"];
    const cur = String(text || "").replace(/\s+/g, " ").trim();
    if (!cur) return { part: "", next: String(last || "") };
    const prev = String(last || "").replace(/\s+/g, " ").trim();
    if (!prev) return { part: cur, next: cur };
    if (cur === prev) return { part: "", next: prev };
    if (cur.startsWith(prev + " ")) return { part: cur.slice(prev.length).trim(), next: cur };
    if (prev.startsWith(cur + " ")) return { part: "", next: prev };
    const prevWords = prev.split(" "), curWords = cur.split(" ");
    let overlap = 0;
    const max = Math.min(prevWords.length, curWords.length, 40);
    for (let k = max; k >= 1; k--) {
      const a = prevWords.slice(-k).map(w => w.toLowerCase()).join(" ");
      const b = curWords.slice(0, k).map(w => w.toLowerCase()).join(" ");
      if (a === b && !(k === 1 && stop.includes(b))) { overlap = k; break; }
    }
    if (overlap > 0) return { part: curWords.slice(overlap).join(" ").trim(), next: cur };
    return { part: cur, next: cur };
  } catch { return { part: String(text || "").trim(), next: String(text || "").trim() }; }
}
let lastCaption = "";
let captionSubscribed = false, captionAnnounced = false;
function onCaptionText(text) {
  try {
    if (!running) return;
    const r = captionNewPart(lastCaption, text);
    lastCaption = r.next;
    if (!r.part) return;
    if (!captionAnnounced) { captionAnnounced = true; status("Caption capture connected — captions flow into the question box.", "live"); }
    onTranscript("Them", r.part, false, Date.now());
  } catch {}
}
function onTranscript(who, text, lookedAgain, spokenAt) {
  text = fixTerms(fixPhrases(text));
  if (who === "Them") noteThem(text, spokenAt);
  else if (who === "You" && captures.some(c => c.who === "Them")) {
    if (micBleed(text, Date.now(), themLines, spokenAt)) { logDecision("drop-mic-bleed", who, text); logEvent({ t: "echo", who, text, bleed: true }); return; }   // the call audio through the mic within 1.5 s
    if (echoOfThem(text) >= 0.5) { logDecision("drop-mic-echo", who, text); logEvent({ t: "echo", who, text }); return; }   // the interviewer through your speakers, not you
    if (!lookedAgain && themSpeaking()) { setTimeout(() => { if (running) onTranscript(who, text, true, spokenAt); }, 2000); return; }   // their words may still be on the way: look again
  }
  logDecision(who === questionSource() ? "keep-can-open" : "keep-context", who, text);
  if (who === "You" && follow.on && !follow.sr) followHear(text, true);   // Follow along without live recognition
  transcript.push({ who, text, at: Date.now(), seq: ++heardSeq });
  if (!answerCtl) {
    const shown = cards[idx] && (typeof cards[idx].answer === "string" ? cards[idx].answer : "");
    const draft = heardDraft(pendingHeard(), cards[idx] && cards[idx].question, shown);
    if (draft) status("Heard: " + draft, "live");
  }
  logEvent({ t: "line", who, text });
  appendDrawer(who, text, Date.now());
  showCaption(who, text, false);
  updatePending();
  if (!flushing) scheduleAuto();
}

/* ---- answers: streamed, grounded on the dossier ---- */
let answerCtl = null;
const inflight = new Set();   // every answer request still running, one per page (a page finishes even after the next question starts)
let answerEpoch = 0;            // bumps on every answer request: an automatic retry only fires if nothing newer started
function slimPrep() { const p = current && current.prep; return p ? { identity: p.identity, persona: p.persona, projects: p.projects } : {}; }
function buildTranscript() { return transcript.slice(-80).map(t => `${t.who}: ${t.text}`).join("\n"); }
function heardAsQuestion(lines) { return lines.map(t => t.text).join(" ").replace(/\s+/g, " ").trim().slice(0, 4000); }
function preserveSpokenQuestion(fullTurn, derived) {
  // The source turn is the display authority when the speaker asked ONE question.
  // The AI derive stage may compress that to only its tail ("...and why?"),
  // even though the transcript already contains the introduction and constraints.
  // Only a single, validated spoken question calls this helper; don't use it for
  // independent multi-question turns or typed questions.
  const source = String(fullTurn || "").replace(/\s+/g, " ").trim();
  const proposed = String(derived || "").replace(/\s+/g, " ").trim();
  if (!source || !proposed) return proposed || source;
  const sWords = source.split(/\s+/).filter(Boolean).length;
  const dWords = proposed.split(/\s+/).filter(Boolean).length;
  // A concise server reformulation is fine only when it has retained most of
  // what the interviewer actually said. If it lost a meaningful lead, keep
  // the literal captured turn for both the visible card and the answer engine.
  if (sWords >= 12 && sWords - dWords >= 7 && dWords <= Math.floor(sWords * 0.72))
    return source;
  return proposed;
}
function lastAsk(lines) {
  const them = lines.filter(t => t.who === "Them" || t.who === "You (typed)");
  const src = them.length ? them : lines;
  return String((src[src.length - 1] && src[src.length - 1].text) || "").replace(/\s+/g, " ").trim().slice(0, 600);
}
// ── Question intake ────────────────────────────────────────────────────
// Owner, 2026-10-21: the question that gets answered is a CONCATENATION of
// every source — the typed box, the computer audio (Them) and the mic —
// composed at AI Answer time. (Auto fires that same button path; it never
// answers on its own.) Three rules ride on top:
//  1. With computer audio captured, your mic lines are you SPELLING OUT
//     the answer on screen. They never form a question — at most a few
//     keywords ride along as context. (Mic-only sessions differ: there
//     the mic IS the question source, minus the same echo drop.)
//  2. A greeting or stray fragment ("HELLO") is not a question from any
//     source. Noise never becomes a card.
//  3. When no source produced a real question but the fragments carry
//     real keywords, the caller tackles them into the lane — the
//     question already on screen — instead of answering the noise raw.
const INTAKE_STOP = new Set("the a an and or of to in on for with you your yours we our it its is are was were do does did have has had can could would should will shall may might i me my he she they them his her their this that these those as at by from be been being am yeah okay ok yes no so well just like really very".split(" "));
function intakeWords(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9+#&'-]+/g, " ").split(/\s+/).filter(w => w.length >= 3 && !INTAKE_STOP.has(w)); }
// A typed line that stands on its own is a new question, not a re-press of the one on screen.
// Gluing it onto the old question overwrote that card and kept answering the old topic
// (owner, 21 Oct 2026: "the questions isn't updating", "kept on giving the same answer").
// A lone keyword ("Kerberos") is its own question. It is not glued onto the card already on screen.
function typedStandsAlone(text) { const t = String(text || "").trim(); return !!t && !isNoiseLine(t) && (Q_CUE.test(t) || intakeWords(t).length >= 1); }
function intakeTerms(text) {
  const out = [];
  for (const raw of String(text || "").split(/\s+/)) {
    const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (w.length < 3 || INTAKE_STOP.has(w.toLowerCase())) continue;
    if (w.length >= 5 || /^[A-Z0-9&]{3,6}$/.test(w) || /[a-z][A-Z]/.test(w) || /\d/.test(w)) out.push(w);
  }
  return [...new Set(out)].slice(0, 8);
}
function echoShare(text, answerText) {
  const words = intakeWords(text); if (!words.length || !answerText) return 0;
  const bag = new Set(intakeWords(answerText));
  return words.filter(w => bag.has(w)).length / words.length;
}
// Closing pleasantries of a call, judged one sentence at a time (review of 398f299: "Thanks for the overview. What
// drove the move to Azure?" was swallowed whole). Bare thanks are noise lines; these carry the sign-off itself.
const SIGN_OFF = /\b(?:hard stop|(?:take|taking|took) the time|thank(?:s| you) (?:so much |again )?for (?:your time|the time|taking|making|joining|speaking|talking|coming|having me|the opportunity|the chat|the conversation)|(?:nice|great|good|pleasure|lovely) (?:talking|speaking|meeting|chatting) (?:to|with) you|have a (?:great|good|nice|lovely) (?:day|evening|weekend|one|rest)|(?:be|get|getting) (?:in touch|back to you)|(?:about|on|with|regarding) (?:the )?next steps|(?:will|'ll) reach out|(?:that'?s|those are|that is) all (?:the questions|my questions|i have|from me|for today|we have)|that'?s it (?:from|for) (?:me|my side|my end|today|now)|(?:right |just )?at time|out of time|wrap (?:it |things )?up|(?:bye|goodbye)\b)/i;
// A courtesy answer to a closing: "Thanks, you too.", "Take care."
const COURTESY = /^(?:(?:ok(?:ay)?|yeah|yes|sure|great|alright|thanks?|thank you)[,.!\s]+)*(?:you too|likewise|same (?:here|to you)|take care|talk (?:to you )?soon|sounds good|cheers|appreciate it|bye(?: now)?|goodbye)[.!\s]*$/i;
// Asks that do not open like a question: "My question is how you'd...", "The other thing I wanted to ask is when...".
const ASK_PHRASE = /\b(?:my question is|the (?:real |other |next |last |main |follow[- ]?up )?question is|(?:i )?wanted to ask|i want to ask|i'd like to ask|let me ask|what i want to (?:know|understand)|(?:the )?thing i'm trying to get at|the follow[- ]?up is|part (?:one|two|three) is)\b/i;
function sentencesOf(text) { return String(text || "").split(/(?<=[.?!])\s+/).map(x => x.trim()).filter(Boolean); }
function closingSentence(x) {
  if (isNoiseLine(x) || COURTESY.test(x)) return true;
  if (!SIGN_OFF.test(x)) return false;
  const rest = x.replace(new RegExp(SIGN_OFF.source, "gi"), " ").trim();
  return !/\?/.test(x) && !Q_CUE.test(rest) && !ASK_PHRASE.test(rest);
}
function askSentence(x) { return !closingSentence(x) && (Q_CUE.test(x) || /\?/.test(x) || ASK_PHRASE.test(x)); }
const NOISE_WORDS = new Set("hi hello hey ok okay yeah yes no uh um hmm thanks thank you right alright sure good great nice bye there everyone all guys".split(" "));
function isNoiseLine(text) { const ws = String(text || "").toLowerCase().replace(/[^a-z\s]+/g, " ").split(/\s+/).filter(Boolean); return ws.length >= 1 && ws.length <= 4 && ws.every(w => NOISE_WORDS.has(w)); }
function composeIntake(lines, opts = {}) {
  const answerText = opts.answerText || "";
  const micIsSource = !!opts.micIsSource;
  const typed = String(opts.typedText || "").trim();
  const currentQ = String(opts.currentQuestion || "").trim();
  const anchorQ = currentQ && !/^(Preparing\u2026|Ready|Cleared\.|No question yet|Deriving)/.test(currentQ) ? currentQ : "";
  const primary = [], micContext = [], keywords = [];
  const dropped = { echo: 0, noise: 0 };
  const seen = new Set();
  const pushKw = (text) => { for (const k of intakeTerms(text)) if (!keywords.includes(k) && keywords.length < 8) keywords.push(k); };
  const allLines = [...(opts.previous || []).map(t => ({ ...t, who: t.who === "Them" ? "Them (earlier)" : t.who })), ...(lines || [])];
  for (const t of allLines) {
    const text = String(t.text || "").trim(); if (!text) continue;
    const dedupeKey = text.toLowerCase(); if (seen.has(dedupeKey)) continue; seen.add(dedupeKey);
    if (t.who === "Them" || t.who === "Them (earlier)") { if (isNoiseLine(text)) { dropped.noise++; continue; } primary.push({ who: t.who, text }); pushKw(text); continue; }
    if (t.who === "You (typed)") { primary.push({ who: "You (typed)", text }); pushKw(text); continue; }
    // Mic ("You") from here on.
    if (echoShare(text, answerText) >= 0.5) { dropped.echo++; pushKw(text); continue; }   // spelling out the on-screen answer
    if (isNoiseLine(text)) { dropped.noise++; continue; }
    if (micIsSource && (Q_CUE.test(text) || intakeWords(text).length >= 1)) { primary.push({ who: "You", text }); pushKw(text); continue; }
    micContext.push(text); pushKw(text);   // his own words: context/keywords only, never the question
  }
  if (typed) { primary.unshift({ who: "You (typed)", text: typed }); pushKw(typed); }
  const primaryText = primary.map(p => p.text).join(" ");
  const contentWords = intakeWords(primaryText).length;
  const hasCue = Q_CUE.test(primaryText);
  const longestLineWords = primary.reduce((m, p) => Math.max(m, intakeWords(p.text).length), 0);
  const typedStrong = primary.some(p => p.who === "You (typed)" && (Q_CUE.test(p.text) || intakeWords(p.text).length >= 1));
  if (anchorQ) pushKw(anchorQ);
  const topicLine = primary.some(p => !isNoiseLine(p.text) && intakeWords(p.text).length >= 1 && !Q_CUE.test(p.text) && intakeWords(p.text).length < 6);
  const worthy = primary.length > 0 && (hasCue || typedStrong || longestLineWords >= 6 || topicLine || !!anchorQ);
  const heardLines = primary.map(p => `${p.who}: ${p.text}`);
  if (micContext.length) heardLines.push(`You (context keywords): ${micContext.join(" ").slice(0, 300)}`);
  if (anchorQ) heardLines.push(`Current question (on screen): ${anchorQ}`);
  return {
    worthy, hasCue, contentWords, keywords, dropped, anchorQ,
    heard: heardLines.join("\n"),
    derived: primary.length ? primary.filter(p => !anchorQ || p.text !== anchorQ).map(p => p.text).join(" ").replace(/\s+/g, " ").trim().slice(0, 4000) : "",   // the formed question is the WHOLE of what was asked, every line in order — never just the last line (owner, 23 Oct: a 100-word question collapsed to its last 10 words on the card). The question already on screen is the lane, not new material, so it is not copied into the formed question a second time.
    primaryCount: primary.length, micContextCount: micContext.length,
    noiseOnly: primary.length === 0 && micContext.length === 0 && keywords.length === 0,
  };
}
// ── end question intake ──
// The last two answered questions before this card (owner, 2026-09-30): the next question may follow up on them.
function recentQA(card) {
  const i = cards.indexOf(card), prev = (i < 0 ? cards : cards.slice(0, i)).filter(c => c && c.question && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(c.question) && typeof c.answer === "string" && c.answer.trim().length > 40);
  return prev.slice(-2).map(c => ({ q: String(c.question).slice(0, 240), a: headAndTail(plainAnswer(c.answer), 2400) }));
}
// An earlier answer's conclusion is at its end. Measured 26 Oct 2026 (evaluation round 2): with only the first 900
// characters sent, the next follow-up never saw the root cause the previous turn reached and changed it. The server
// keeps up to 6000 characters of a prior answer the same way (src/lib/kompasHistory.ts).
function headAndTail(text, limit) {
  const t = String(text || "").trim();
  if (t.length <= limit) return t;
  const half = Math.floor((limit - 5) / 2);
  return t.slice(0, half) + " […] " + t.slice(-half);
}
const consolidatedNeedsDerive = (opts) => !!opts.consolidated && !opts.derived;   // AI Answer: match after the question is derived
// The derive request. A re-ask tells the server so: the page being re-asked is the previous turn, and its own setup
// must not be read as his reply to it.
function deriveBody(question, card, opts) { return { deriveOnly: true, client: BUILD, question, transcript: opts.earlier || "", history: recentQA(card), reask: !!opts.reask }; }
// The question fields of the answer request. A question the code cut already formed is pinned, so the server answers
// it as formed instead of cutting the heard text a second time (review of 398f299: the second cut glued his reply and
// the "You (context keywords)" label back in front of the question the model was told to answer).
function questionFields(question, derivedQ, derivedBy, opts) { return { question, derived: derivedQ || undefined, pinned: !!opts.pinned || derivedBy === "code", again: !!opts.reask }; }
function askingLevel() {
  const who = ($("liveInterviewer") && $("liveInterviewer").value) || "engineer";
  if (who !== "peer") window.__peerOf = who;
  return who;
}
function anchorFacts() {
  const s = current || {};
  return { role: s.role || (s.prep && s.prep.persona && s.prep.persona.role) || "", resume: ["answer-policy:2026-10-15-personal-evidence", s.resume || "", s.jd || "", s.instructions || ""].join("\n") };
}
function paintFromAnchors(card) {
  if (desktopResponses() || !card || !card.anchors || !window.KompasLevels || !window.KompasDiamond) return false;
  if (personalLogistics(card.anchorQ || "") || personalLogistics(card.question || "")) return false;   // never a cached answer for personal logistics
  const level = askingLevel();
  const plan = window.KompasDiamond.plan(level, card.anchors, window.__peerOf);
  if (!plan.ready) return false;
  const shown = sayAnswer(window.KompasLevels.textFor(card.anchors, level, window.__peerOf, liveConfig().mode));
  if (!shown) return false;
  card.answer = shown;
  card.streaming = false;
  card.meta = "cached";
  if (cards[idx] === card) renderCard();
  if (!plan.otherReady) fillAnchor(card, plan.other);
  return true;
}
// What went wrong reads every anchor the moment it lands: the repair is applied before it is shown or stored, and
// the findings travel to the other anchor's request for the same question (see nextContext).
function criticise(card, anchor, text) {
  const C = window.KompasCorrect, J = window.KompasJev, q = card.anchorQ || card.question;
  if (!C || !C.review) return C ? C.correct(text) : text;
  const r = C.review(text, q);
  const other = anchor === "engineer" ? "director" : "engineer";
  const sib = card.anchors && card.anchors[other];
  const drift = J && J.storyDrift && sib && sib.prose ? J.storyDrift(sib.prose, r.text) : null;
  if (drift) r.faults.push({ id: "drift", say: `Engineer and Director tell different stories (${drift.a} and ${drift.b}).` });
  card.critic = card.critic || {};
  card.critic[anchor] = r.faults;
  if (r.faults.length) logEvent({ t: "critic", question: q, anchor, faults: r.faults.map(f => f.id), say: r.faults.map(f => f.say + (f.missing ? " " + f.missing.join("; ") : "")) });
  return r.text;
}
// Both anchors of one question are written from the same ledger, and the second sees the first (with what went wrong on it).
function nextContext(card, anchor) {
  const F = window.KompasFlight, C = window.KompasCorrect;
  const question = card.anchorQ || card.question;
  if (!F) return { ledger, history: recentQA(card) };
  const other = anchor === "engineer" ? "director" : "engineer";
  const note = C && C.criticNote ? C.criticNote((card.critic && card.critic[other]) || []) : "";
  return { ledger: F.ledgerFor(card, question, ledger), history: F.siblingHistory(card, anchor, recentQA(card), note) };
}
function fillAnchor(card, anchor) {
  if (desktopResponses() || !card || !window.KompasAnchors || !window.KompasLevels || !window.KompasDiamond) return null;
  if (!window.KompasDiamond.ANCHORS.includes(anchor)) return null;
  if (card.anchors && card.anchors[anchor] && card.anchors[anchor].prose) return null;
  const write = async () => {
    try {
      const question = card.anchorQ || card.question;
      const ctx = nextContext(card, anchor);
      const text = await window.KompasAnchors.fetchProse(question, anchor, {
        client: BUILD, config: { ...liveConfig(), level: askingLevel() }, prep: { ...slimPrep(), questions: [] },
        retrieved: retrieve(question, 4), ledger: ctx.ledger, history: ctx.history,
      });
      if (!text) return;
      const shaped = window.KompasLevels.fromProse(criticise(card, anchor, text), anchor);
      if (!shaped) return;
      card.anchors = card.anchors || {};
      card.anchors[anchor] = shaped;
      const facts = anchorFacts();
      if (cards[idx] === card) paintFromAnchors(card);
      await window.KompasAnchors.save(question, facts.role, facts.resume, card.anchors, current && current.id);
    } catch {}
  };
  return window.KompasFlight ? window.KompasFlight.once(card, anchor, write) : write();
}
function serveBook(card, hit, depthKey) {
  answerCtl = null;                                                   // nothing is in flight: the book answered
  card.answer = hit.text; card.streaming = false; card.meta = "⚡ book · 0.00s · written ahead of the interview";
  card.byDepth = card.byDepth || {}; card.byDepth[depthKey] = { answer: card.answer, meta: card.meta };
  if (cards[idx] === card) renderCard();
  logEvent({ t: "answer", question: card.question, derived: card.question, book: true, depth: $("liveInterviewer").selectedOptions[0].textContent, text: hit.text, meta: card.meta, depthKey });
  status("Answered.", "live");
  if (cards[idx] === card) { const c = $("card"); if (c) c.classList.add("q-away"); }
  if (window.KompasDiamond) {
    card.anchorQ = card.question;
    for (const a of window.KompasDiamond.questionPlan(card.anchors || {}).levels) fillAnchor(card, a);
  }
}
async function generateAnswer(question, card, opts = {}) {
  if (card && card.screenTask) opts = { ...opts, source: "screen" };
  card = card || addCard(question, ["…"]);
  let timer;
  const request = generateAnswerRequest(question, card, opts);
  const ctl = card.req;
  try {
    await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Answer request timed out")), 60000);
    })]);
  } catch (error) {
    if (card.req !== ctl) return;
    // Invalidate first: an aborted/late read cannot overwrite the visible recovery message.
    card.req = null;
    ctl?.abort();
    card.streaming = false;
    const partial = typeof card.answer === "string" && card.answer.trim();
    if (!partial) card.answer = ["The answer could not finish. Your question is saved on this card. Press AI Answer to retry."];
    card.meta = partial ? "Incomplete answer. Press AI Answer to retry." : "Answer interrupted. Retry available.";
    if (cards[idx] === card) renderCard();
    status(error.message || "Answer interrupted. Please retry.", "err");
  } finally {
    clearTimeout(timer);
    if (answerCtl === ctl) answerCtl = null;
  }
}
function nextStallTry(retries) { const tries = (retries || 0) + 1; return tries <= 2 ? tries : 0; }   // a stalled request retries twice, then says so plainly instead of sitting on "…" forever
async function generateAnswerRequest(question, card, opts = {}) {
  question = String(question || "").trim(); if (!question) return;
  card = card || addCard(question, ["…"]);
  if (location.protocol === "file:") { card.answer = ["(Preview) Serve the deployed app for grounded answers."]; renderCard(); return; }
  // One page, one request (owner, 27 Oct 2026: paging back showed earlier answers as "half ass generation or completely
  // invisible"). A new question used to abort whatever was streaming, so the page before it kept half its answer. Now
  // only this page's own earlier request is replaced; another page finishes in the background.
  if (card.req) { try { card.req.abort(); } catch {} }
  const ctl = new AbortController(); answerCtl = ctl; card.req = ctl; inflight.add(ctl);   // card.req: which request owns this card now
  const hardTimer = setTimeout(() => { try { ctl.abort(); } catch {} }, 120000);   // no request may run past 2 min — a silent hang here used to wedge the answer latch and mute every later press and typed Enter
  if (card === follow.card) { follow.pos = 0; follow.livePos = 0; }
  const t0 = performance.now(); let first = 0, text = "", meta = {};
  const depthLabel = () => { const o = $("liveInterviewer").selectedOptions[0]; return o ? o.textContent : ""; };
  const logAnswer = (extra) => logEvent({ t: "answer", question: card.question, derived: derivedQ || meta.derived || "", typed: !consolidated, regen: !!opts.derived, depth: depthLabel(), text: typeof card.answer === "string" ? card.answer : (card.answer || []).join("\n"), meta: card.meta || "", original: card.original || undefined, ...extra });
  const consolidated = !!opts.consolidated;
  const epoch = ++answerEpoch;
  const directDesktop = desktopResponses(); let responseKey = "";
  const depthKey = `${$("liveInterviewer").value}|${liveConfig().mode}|${liveConfig().length || ""}`;
  if (!directDesktop && !opts.reask && !opts.pinned && !opts.regen && !consolidatedNeedsDerive(opts) && book.sid === (current && current.id)) {   // opening book: typed / known questions. A pinned press is a live ask.
    const hit = bookMatch(question, depthKey);
    if (hit) { serveBook(card, hit, depthKey); return; }
  }
  if (opts.regen && paintFromAnchors(card)) {                              // the two anchors already hold this level
    if (answerCtl) { try { answerCtl.abort(); } catch {} answerCtl = null; }
    status("Answered.", "live");
    return;
  }
  // Regenerating (depth change) or retrying: the answer on screen stays until the new one starts arriving.
  const prevAnswer = card.answer, prevMeta = card.meta;
  const keepOld = !!opts.retries && !opts.regen && !(Array.isArray(prevAnswer) && /^(…|Groq|The answer lane)/.test(String(prevAnswer[0] || "")));
  if (!keepOld) card.answer = ["…"];
  card.streaming = true; card.meta = keepOld ? `regenerating at ${depthLabel()} depth…` : ""; if (cards[idx] === card) renderCard();
  // A timer abort is not a supersede: the request died on our own watchdog, so
  // retry it (twice) instead of leaving a "…" card with a stale status forever.
  const stallRetry = () => {
    const tries = nextStallTry(opts.retries);
    if (!tries) {
      const partial = typeof card.answer === "string" && card.answer.trim().length > 8 && card.answer.trim() !== "…";
      const prevReal = (typeof prevAnswer === "string" && prevAnswer.trim().length > 8 && prevAnswer.trim() !== "…") || (Array.isArray(prevAnswer) && prevAnswer.join("\n").trim().length > 8 && !/^(…|Preparing…)$/.test(String(prevAnswer[0] || "").trim()));
      if (!partial && prevReal) card.answer = prevAnswer; else if (!partial && keepOld) card.answer = prevAnswer;
      card.streaming = false; if (cards[idx] === card) renderCard();
      status("Answer stalled — press AI Answer to try again.", "live"); return;
    }
    status("Retrying…", "live");
    setTimeout(() => { if (answerEpoch === epoch && card.req === ctl) generateAnswer(question, card, { ...opts, derived: derivedQ || opts.derived, derivedBy, retries: tries }); }, 800);
  };
  const named = String((card && card.question) || "").replace(/\s+/g, " ").trim();
  status(named && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(named) ? "Answering: " + named : (consolidated ? "Deriving the question and answering…" : "Answering…"), "live");
  const plainHeard = consolidated ? question.replace(/^(Them|You):\s*/gm, "") : question;
  // Relevance first: work out what the interviewer actually asked, THEN pull the persona-file and
  // dossier material that matches that question — not whatever words happened to be in the ramble.
  let derivedQ = opts.derived || "", derivedBy = opts.derived ? (opts.derivedBy || "kept") : "";   // regenerating: the question is already known
  if (consolidated && !derivedQ) {
    try {
      const deriveTimer = setTimeout(() => { try { ctl.abort(); } catch {} }, 30000);
      const dr = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify(deriveBody(question, card, opts)) });
      const dj = await dr.json(); clearTimeout(deriveTimer);
      if (card.req !== ctl) return;
      if (dj.noQuestion) {
        const kept = String(card.question || "").trim();
        if (kept && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving|Answering what|From what was heard)/.test(kept)) {
          derivedQ = kept;
        } else {
          card.streaming = false;
          if (answerCtl === ctl) answerCtl = null;
          if (!dropPage(card)) { card.answer = []; card.question = "No question yet"; if (cards[idx] === card) renderCard(); }   // nothing to answer: no blank page left in the book
          status("Listening for the next question.", "live");
          return;
        }
      }
      if (dj.derived) { derivedQ = card.singleSpokenTurn ? preserveSpokenQuestion(card.fullSpokenQuestion, dj.derived) : dj.derived; card.question = derivedQ; if (cards[idx] === card) renderCard(); }
      derivedBy = dj.derivedBy || "ai";
      const hit = !directDesktop && book.sid === (current && current.id) && bookMatch(derivedQ, depthKey);
      if (hit) { if (answerCtl === ctl) answerCtl = null; serveBook(card, hit, depthKey); return; }
    } catch (e) {
      if (e && e.name === "AbortError") { if (card.req === ctl) { card.streaming = false; stallRetry(); } return; }
    }
  }
  const qText = String(derivedQ || question).trim();
  card.anchorQ = qText;
  if (directDesktop) responseKey = desktopResponseKey(card);
  let writeAnchor = askingLevel();
  if (!directDesktop && window.KompasAnchors && qText.length >= 8) {
    const facts = anchorFacts();
    try {
      const pack = await Promise.race([window.KompasAnchors.load(qText, facts.role, facts.resume, current && current.id), new Promise((r) => setTimeout(() => r(null), 15000))]);   // anchors are an enhancement: never let their load hang the answer
      if (pack && pack.anchors) {
        card.anchors = card.anchors || {};
        for (const k of ["engineer", "director"]) if (pack.anchors[k] && !(card.anchors[k] && card.anchors[k].prose)) card.anchors[k] = pack.anchors[k];
      }
    } catch {}
    if (card.req !== ctl) return;
    if (!opts.reask && paintFromAnchors(card)) {
      if (answerCtl === ctl) answerCtl = null;
      status("Answered.", "live");
      return;
    }
    const planNow = window.KompasDiamond && window.KompasDiamond.plan(askingLevel(), card.anchors || {}, window.__peerOf);
    if (planNow) writeAnchor = planNow.from;
  }
  if (!directDesktop && window.KompasJev && !window.KompasJev.allowModel(writeAnchor, { hit: false, model: true })) {
    if (answerCtl === ctl) answerCtl = null;
    status("Answered.", "live");
    return;
  }
  const already = !directDesktop && window.KompasFlight && window.KompasFlight.pending(card, writeAnchor);
  if (already) {                                                      // the background write of this anchor is still out: it is the answer
    status("Preparing that answer…", "live");
    try { await already; } catch {}
    if (ctl.signal.aborted || card.req !== ctl) return;
    if (!opts.reask && paintFromAnchors(card)) { if (answerCtl === ctl) answerCtl = null; status("Answered.", "live"); return; }
  }
  card.anchorFlight = writeAnchor;
  const release = !directDesktop && window.KompasFlight ? window.KompasFlight.hold(card, writeAnchor) : () => {};
  const ctx = directDesktop ? { ledger, history: recentQA(card) } : nextContext(card, writeAnchor);
  const retrieved = retrieve(derivedQ || plainHeard, consolidated ? 5 : 4);
  const prep = { ...slimPrep(), questions: retrieved.length ? [] : ((current && current.prep && current.prep.questions) || []).slice(0, 30) };
  // Smooth streaming: throttle renders to animation frames instead of
  // re-rendering the full card DOM on every token (was causing visible jank).
  let renderQueued = false;
  const show = (t) => {
    if (card.req !== ctl || isUnavailableAnswer({ degraded: true }, t) || providerLeak(t)) return;
    const spoken = sayAloud(t).trim();
    card.answer = spoken ? spoken : ["…"];
    if (cards[idx] !== card || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; if (cards[idx] === card) renderCard(); });
  };
  const recoverAnswer = (code = "", retryAfterMs = 1000) => {
    const partial = typeof card.answer === "string" && card.answer.trim().length > 8 && card.answer.trim() !== "…";
    card.streaming = false;
    const prevReal = (typeof prevAnswer === "string" && prevAnswer.trim().length > 8 && prevAnswer.trim() !== "…") || (Array.isArray(prevAnswer) && prevAnswer.join("\n").trim().length > 8 && !/^(…|Preparing…)$/.test(String(prevAnswer[0] || "").trim()));
    if (!partial && prevReal) card.answer = prevAnswer;   // a failed (re)generation never takes the last good answer with it (book rule, 23 Oct)
    else if (!partial && keepOld) card.answer = prevAnswer;
    card.meta = partial || keepOld ? (card.meta || prevMeta || "") : "";
    const permanent = /AUTH|CREDITS|FORBIDDEN|NOT_CONFIGURED/.test(code);
    const tries = (opts.retries || 0) + 1;
    const retry = !permanent && tries <= 2 && retryAfterMs <= 15000;
    if (cards[idx] === card) renderCard();
    status("Reconnecting.", "live");
    logAnswer({ failed: code || "provider_unavailable", retrying: retry });
    sessionReadyUntil = 0;
    if (retry) setTimeout(() => {
      if (answerEpoch === epoch && card.req === ctl)
        generateAnswer(question, card, { ...opts, derived: derivedQ || opts.derived, derivedBy, retries: tries, regen: opts.regen || keepOld });
    }, Math.max(500, retryAfterMs));
  };
  let fetchTimer = null;
  try {
    let responded = false;
    fetchTimer = setTimeout(() => { if (!responded && card.req === ctl) { try { ctl.abort(); } catch {} } }, 45000);   // no response headers in 45s means the fetch itself hung: fail into the retry, not the 2-minute wall
    const res = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ stream: true, client: BUILD, liveModel: liveModel() || undefined, consolidated, ...questionFields(question, derivedQ, derivedBy, opts), transcript: consolidated ? (opts.earlier || "") : buildTranscript(), config: { ...liveConfig(), interviewer: writeAnchor, level: askingLevel(), ...(directDesktop ? { responseCalibration: "three-level-v1" } : {}) }, prep, retrieved, ledger: ctx.ledger, history: ctx.history }) });
    responded = true; clearTimeout(fetchTimer);
    if (!res.ok || !res.body) {
      const failure = await res.json().catch(() => ({}));
      throw Object.assign(new Error(failure.error || "Paid answer service returned " + res.status), { providerFailure: true, code: failure.code || (res.status === 401 || res.status === 403 ? "AUTH" : ""), retryAfterMs: failure.retryAfterMs });
    }
    if (!(res.headers.get("content-type") || "").includes("event-stream")) {
      const data = await res.json(); text = data.text || ""; first = performance.now() - t0; meta = data;
    } else {
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", lastChunkAt = Date.now(), pendingRead = reader.read();
      while (true) {
        const chunk = await Promise.race([pendingRead, new Promise(res2 => setTimeout(() => res2("idle"), 4000))]);
        if (chunk === "idle") {   // stream inactivity watchdog: a silently stalled connection must fail loudly and retry, never hang the session
          if (Date.now() - lastChunkAt > 25000) throw Object.assign(new Error("The answer stream stalled — no data for 25 seconds."), { code: "STALL", retryAfterMs: 800 });
          continue;
        }
        pendingRead = reader.read();
        const { done, value } = chunk; if (done) break;
        lastChunkAt = Date.now();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          if (!frame.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(frame.slice(5)); } catch { continue; }
          if (ev.type === "meta") { meta = { ...meta, ...ev }; if (ev.derived && card.req === ctl && (consolidated || opts.pinned) && !opts.derived) { const displayQ = card.singleSpokenTurn ? preserveSpokenQuestion(card.fullSpokenQuestion, ev.derived) : ev.derived; card.question = displayQ; if (cards[idx] === card) { renderCard(); status("Answering: " + displayQ, "live"); } } }
          else if (ev.type === "delta") { if (!first) first = performance.now() - t0; text += ev.text; show(text); }
          else if (ev.type === "replace") { if (!first) first = performance.now() - t0; text = ev.text; show(text); }
          else if (ev.type === "wait") { if (card.req === ctl) status("Reconnecting.", "live"); }
          else if (ev.type === "done") meta = { ...meta, ...ev };
        }
      }
    }
    if (card.req !== ctl) return;                                      // a newer request took this card over
    if (meta.error || meta.unavailable || meta.busy || meta.quiet || isUnavailableAnswer(meta, text) || providerLeak(text)) {
      recoverAnswer(meta.code || (meta.daily ? "CREDITS" : ""), meta.retryAfterMs || 1000);
      return;
    }
    if (meta.ledger) ledger = meta.ledger;
    card.streaming = false;
    if (meta.noQuestion) {
      card.streaming = false;
      card.answer = keepOld ? prevAnswer : [];
      card.meta = meta.skipped === "logistics" ? "Personal logistics, not answered" : "";   // owner rule 29 Oct: a quiet card says why, with no answer text
      if (cards[idx] === card) renderCard();
      status(meta.skipped === "logistics" ? "Personal logistics, not answered. Still listening." : "Still listening.", "live");
      return;
    }
    if (!text.trim()) throw new Error("The answer engine returned an empty response. Please retry.");
    show(text);
    if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.replace(/\s+/g, " ").trim().slice(0, 4000);   // the full heard question, never its last line (owner, 23 Oct)
    const kind = ({ 0: "intro", 1: "story", 2: "reasoning", 3: "drill-down", 4: "your experience" }[meta.tier] || "") + (meta.length && ["closed", "which", "theirq", "logistics"].includes(meta.length.kind) ? " · short form" : "") + (meta.derived ? " · from everything heard" : "") + (meta.voice ? ` · voice ${meta.voice.passed}/${meta.voice.total}` : "");
    const spoken = (s) => s >= 90 ? `${Math.round(s / 60)} min` : `${s}s`;
    const len = meta.length && meta.length.secs ? ` · ~${spoken(meta.length.secs[0])}–${spoken(meta.length.secs[1])} spoken` : "";
    card.meta = `⚡ ${(first / 1000).toFixed(2)}s · ${((performance.now() - t0) / 1000).toFixed(2)}s${kind ? " · " + kind : ""}${len}${retrieved.length ? " · dossier" : ""}${meta.checked ? " · ✓ fact-checked" : ""}${repairBadge(meta.repair)}`;
    if (cards[idx] === card) renderCard();
    logAnswer({ derived: meta.derived || derivedQ || "", derivedBy: derivedBy || "", kind: meta.length && meta.length.kind, tier: meta.tier, lane: meta.timing && meta.timing.lane, voice: meta.voice && `${meta.voice.passed}/${meta.voice.total}`, ms: Math.round(performance.now() - t0), depthKey });
    if (!meta.degraded && !/backup model/.test(card.meta)) { card.byDepth = card.byDepth || {}; card.byDepth[depthKey] = { answer: card.answer, meta: card.meta }; }
    if (directDesktop && !meta.degraded) {
      card.desktopByDepth = card.desktopByDepth || {};
      card.desktopByDepth[responseKey] = { answer: sayAloud(typeof card.answer === "string" ? card.answer : text), meta: card.meta };
      warmDesktopLevels(card, card.anchorQ || qText);
    }
    if (!directDesktop && window.KompasLevels && text && !meta.degraded) {
      const fixed = criticise(card, writeAnchor, text);
      const shaped = window.KompasLevels.fromProse(fixed, writeAnchor);
      if (shaped) {
        card.anchors = card.anchors || {};
        card.anchors[writeAnchor] = shaped;
        const facts = anchorFacts();
        if (window.KompasAnchors) window.KompasAnchors.save(card.anchorQ || qText, facts.role, facts.resume, card.anchors, current && current.id);
        const shown = sayAnswer(window.KompasLevels.textFor(card.anchors, askingLevel(), window.__peerOf, liveConfig().mode));
        const repaired = !!window.KompasCorrect && fixed !== window.KompasCorrect.correct(text);
        if (shown && (askingLevel() !== writeAnchor || repaired)) {
          card.answer = shown;
          if (card.byDepth && card.byDepth[depthKey]) card.byDepth[depthKey].answer = shown;
          if (cards[idx] === card) renderCard();
        }
        const other = writeAnchor === "engineer" ? "director" : "engineer";
        if (!card.anchors[other]) fillAnchor(card, other);
      }
    }
    status("Answered.", "live");
    healAuthSilently();
    if (cards[idx] === card) { const c = $("card"); if (c) c.classList.add("q-away"); }   // generated: the question collapses away, only the response box stays
  } catch (e) {
    if (isAuthError(e)) {                                              // 401: renew the session silently and re-ask — wait silently if renewal fails
      if (await recoverLiveAuth()) { recoverAnswer("", 800); return; }
      recoverAnswer("AUTH"); waitForAuthSilently({ question, card, opts: { ...opts, derived: derivedQ || opts.derived, derivedBy } }); return;
    }
    if (card.req !== ctl) return;                                      // aborted because this same card was re-asked
    card.streaming = false;
    if (e && e.name === "AbortError") {
      if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.replace(/\s+/g, " ").trim().slice(0, 4000);
      stallRetry(); return;
    }
    if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.replace(/\s+/g, " ").trim().slice(0, 4000);
    recoverAnswer(e && e.code || "", e && e.retryAfterMs || 1000);
  } finally { inflight.delete(ctl); clearTimeout(hardTimer); clearTimeout(fetchTimer); release(); if (card.req === ctl && card.anchorFlight === writeAnchor) card.anchorFlight = ""; if (answerCtl === ctl) answerCtl = null; }
}

/* ---- manual, AI Answer, screen, copy, export, shortcuts ---- */
$("sendBtn").onclick = sendManual;
function setChat(open) {
  $("barAsk").classList.toggle("hidden", !open);
  $("chatBtn").classList.toggle("on", open);
  $("chatBtn").setAttribute("aria-pressed", String(open));
  if (!open) $("copilotTip").classList.add("hidden");
  if (open) $("manualInput").focus();
}
$("chatBtn").onclick = () => setChat($("barAsk").classList.contains("hidden"));
$("manualInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  if (e.currentTarget.tagName === "TEXTAREA" && e.shiftKey) return;   // a textarea keeps Shift+Enter for a newline
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  sendManual();
});
function sendManual() { void aiAnswer(false); }   // the typed box joins the AI Answer intake (box + mic + computer audio concatenated)
$("manualInput").addEventListener("input", () => { if (cards[idx]) renderCard(); });
function pressQuestion(typed, intake, screen) {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  let typedClean = clean(typed), derived = clean(intake && intake.derived);
  if (typedClean && isNoiseLine(typedClean)) typedClean = "";
  if (derived && isNoiseLine(derived)) derived = "";
  const low = (s) => s.toLowerCase();
  if (typedClean && derived && low(derived).includes(low(typedClean))) typedClean = "";   // the formed question already carries the typed words — keep the whole, never the fragment (owner, 23 Oct)
  else if (typedClean && derived && low(typedClean).includes(low(derived))) derived = "";
  const lane = String(screen || "").trim();
  if (derived && lane && low(lane).includes(low(derived)) && !shortFollowUp(derived)) derived = "";   // the old question is the lane, never a second copy in front of it. A short follow-up still names a word the old question used.
  const bits = [typedClean, derived].filter(Boolean);
  let q = bits.join(" ").trim();
  // "Go deeper" follows the question on screen. "What exactly is least privilege?" names its own subject, so it does not.
  const followMark = /\b(?:go deeper|more detail|elaborate|what exactly|how did you know|say that again)\b/i;
  const namesOwnSubject = (text) => {
    const rest = text.replace(followMark, " ").replace(/\b(?:that|this|it|those|these|there|then)\b/gi, " ");
    const stop = new Set("what how why when where which who the are was were does did you your about with from into onto and but for".split(" "));
    return rest.toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).some((w) => w.length >= 4 && !stop.has(w));
  };
  const followUp = q && q.split(/\s+/).length <= 9 && (followMark.test(q) || shortFollowUp(q)) && !namesOwnSubject(q);
  if (q && lane && followUp) q = lane.replace(/[?.!\s]+$/, "") + " — " + q;
  if (!q && intake && intake.keywords && intake.keywords.length) q = intake.keywords.slice(0, 8).join(" ");
  return q || "";
}
function showPressed(card, q) {
  if (card && q) card.question = q;
  if (card && cards[idx] === card) renderCard();
  toTop();
  if (q) status("Answering: " + q, "live");
}
$("answerBtn").onclick = () => aiAnswer(false);
let aiBusy = false, aiBusySince = 0;
let answerAnywayHeld = null;   // the lines a manual press just turned away, for "Answer anyway"
// Plain reason when a press finds nothing to answer (owner, 1 Nov 2026:
// "no question detected" with no reason is a dead end — say which link is
// missing: no capture at all, the call-audio share ended, silence on the
// shared track, or sound heard but nothing transcribed yet). Pure: the
// caller computes the four flags from live state. Self-contained: no
// module-level consts it depends on.
function emptyPressReason(anyCapture, wantSys, hasThemCap, themSilent) {
  if (!anyCapture) return "Nothing is capturing right now — press Start, or type a question.";
  if (wantSys && !hasThemCap) return "Call audio sharing ended — press the speaker button to share it again.";
  if (hasThemCap && themSilent) return "Kompas hears silence from the shared audio — check the shared tab is playing sound and tab audio is shared, then keep playing.";
  if (hasThemCap) return "Kompas hears the call audio but nothing has been transcribed yet — keep playing, then press AI Answer again.";
  return "Nothing heard yet — press Start, or type a question.";
}
async function aiAnswer(fromAuto, options = {}) {
  if (aiBusy) {
    if (Date.now() - aiBusySince > 150000) aiBusy = false;   // a wedged latch must never mute the button (or a typed Enter) forever
    else { status("Still working on the last answer — one moment.", "live"); return; }
  }
  aiBusy = true; aiBusySince = Date.now(); clearTimeout(autoTimer);
  try {
    const sessionEpoch = transcriptionEpoch;
    if ((running && captures.length) || finals.size) {
      flushing = true; if (!fromAuto) status("Catching your last words…", "live");
      try { await flushHeard(options.captionOnce ? 250 : 1500); } catch { /* words already written still get answered */ }
      finally { flushing = false; }
    }
    if (sessionEpoch !== transcriptionEpoch) return;
    // Turn window (owner, 1 Nov 2026, supersedes the 26 Oct 8-line rule):
    // the question is formed from its whole turn, back to the turn's start
    // — framing, setup and pausing fillers included — not from the last
    // eight lines. Older turns stay in the transcript and reach the answer
    // as earlier context; they are not re-formed into questions.
    let pending = turnWindow(pendingHeard(), questionSource(), t => t.who === questionSource() && (Q_CUE.test(t.text) || opensNewAsk(t.text)));
    const box = $("manualInput");
    const typedText = box ? box.value.trim() : "";
    // Answer anyway (slice 2): a press right after "Nothing question-like" answers those same lines.
    let anyway = false;
    try { const back = answerAnywayLines(answerAnywayHeld, { fromAuto, pending: pending.length, typed: typedText, now: Date.now() }); if (back) { pending = back; anyway = true; logDecision("answer-anyway", questionSource(), back.map(t => t.text).join(" ")); } } catch {}
    answerAnywayHeld = null;
    if (transcriptionFailedEpoch === sessionEpoch && !pending.length && !typedText) {
      setChat(true);
      status("The last phrase could not be transcribed. Please repeat it or type it here.", "err");
      return;
    }
    if (pending.length || typedText) {
      const cur = cards[idx];
      const answerText = [cur, cards[idx - 1]].filter(Boolean).map(c => typeof c.answer === "string" ? plainAnswer(c.answer) : "").join(" ");
      // Re-press rule (owner, 21 Oct 2026): pressing AI Answer again after an
      // answer exists means that answer missed. Combine EVERYTHING heard —
      // previous lines, mic words, the newest computer audio — with the
      // question already on screen, let the engine form the question from the
      // whole, and answer that. Frequency of pressing is the miss signal.
      const answeredText = typeof cur.answer === "string" ? cur.answer : (cur && cur.answer || []).join("\n");
      const typedOwn = !!typedText && typedStandsAlone(typedText);   // a typed question of its own gets its own card
      // A new question in what was heard since the last answer is a new page, not a re-press. Owner's live session, 27 Oct
      // 2026: every press after the first counted as a re-press of the page on screen, so the old question was formed and
      // answered again ("could you explain what dependency confusion is?" got the host-header answer; "multiple tools
      // reporting the same vulnerability" got the password-reset answer). A press with nothing new asked still re-asks.
      // Each sentence is judged on its own: "Thanks for the overview. What drove the move to Azure?" is a new question, and
      // "My question is how you'd isolate a runner" asks without opening like a question (review of 398f299).
      const newAsk = !typedText && pending.some(t => sentencesOf(t.text).some(x => (askSentence(x) || opensNewAsk(x)) && !repeatsPriorQuestion(x, cur && cur.question || "")));
      // The sign-off is not a re-press (27 Oct 2026): "I do have a hard stop ... thank you for taking the time" heard
      // after an answer re-asked the page on screen and answered it again. Only closing sentences and fillers, no ask.
      if (!anyway && !typedText && pending.some(t => sentencesOf(t.text).some(x => SIGN_OFF.test(x) || COURTESY.test(x))) && pending.every(t => sentencesOf(t.text).every(closingSentence))) {
        answeredSeq = heardSeq; updatePending();
        logDecision("skip-sign-off", questionSource(), pending.map(t => t.text).join(" "));
        if (!fromAuto) { answerAnywayHeld = { lines: pending.slice(), at: Date.now() }; status("Nothing question-like in that — press AI Answer again to answer anyway.", "live"); }
        return;
      }
      const isRepress = !fromAuto && !typedOwn && !newAsk && !!cur && answeredText.trim().length > 8 && !/^[.…\s]+$/.test(answeredText.trim()) && !!cur.question && !/^(Preparing\u2026|Ready|Cleared\.|No question yet|Deriving)/.test(cur.question);
      if (isRepress) {
        // The re-ask is formed from the lines that formed the page on screen plus what was heard since, never from the
        // whole interview (baseline contract, 27 Oct 2026): with forty earlier lines and the on-screen question stripped,
        // the cut took the LAST OLD question in that history and answered it again, and a typed re-press pinned all
        // forty lines as its question. The formation lines stay the first page's, so a chain of re-asks stays bounded.
        const combined = composeIntake(pending, { typedText, answerText, micIsSource: questionSource() === "You", currentQuestion: cur.question });
        if (typedText) { box.value = ""; logEvent({ t: "line", who: "You (typed)", text: typedText }); }
        answeredSeq = heardSeq; updatePending();
        const q = pressQuestion(typedText, combined, cur.question) || cur.question;
        // A re-press is a fresh ask, not a pinned replay: with no typed text the
        // material is still a transcript, so it goes through the same derive cut
        // and no-question gate as a fresh heard press. The card keeps its old
        // question until the cut lands. Typed re-presses stay pinned whole.
        const heardOnly = !typedText;
        const formed = String(cur.formed || "").replace(/^You \(context keywords\):[^\n]*$/gm, "").trim() || `You: ${cur.question}`;
        const since = combined.heard.replace(/^Current question \(on screen\):[^\n]*$/gm, "").trim();
        // Tapping AI Answer again is itself the signal more concatenation is needed: each tap chains what the last
        // page heard, so what was heard on an earlier tap survives even after it falls out of the formation window,
        // and a part missed at one instance comes back on the next tap. Since 1 Nov 2026 the chain is the turn, not
        // the stripped page alone: a re-press re-forms from the transcript back to the turn's start (recoverTurn),
        // so framing the first window cut comes back. The walk stops at a floor change or a next-question marker,
        // so it never re-forms the whole interview. A card without an anchor keeps the page chain.
        let heard = [(cur.heard || formed), since].filter(Boolean).join("\n").trim();
        let recoverSeq = null;
        if (heardOnly && cur.formSeq != null) {
          try {
            const rec = recoverTurn(transcript, cur.formSeq, questionSource());
            if (rec && rec.length) { heard = rec.map(t => `${t.who}: ${t.text}`).join("\n"); recoverSeq = rec[0].seq; }
          } catch {}
        }
        // The re-ask goes on the next page (book rule, 27 Oct 2026): the page it re-asks keeps its question and finished
        // answer instead of being wiped to "…" and rewritten in place.
        const page = addCard(cur.question, ["…"]);
        page.heard = heard; page.earlier = cur.earlier || ""; page.formed = cur.formed; page.singleSpokenTurn = cur.singleSpokenTurn; page.fullSpokenQuestion = cur.fullSpokenQuestion;
        if (recoverSeq != null) page.formSeq = recoverSeq;
        showPressed(page, heardOnly ? cur.question : q);
        return await generateAnswer(heard, page, { consolidated: true, earlier: "", derived: heardOnly ? undefined : q, reask: true, pinned: !heardOnly });
      }
      const intake = composeIntake(pending, { typedText, answerText, micIsSource: questionSource() === "You" });
      if (typedText) { box.value = ""; logEvent({ t: "line", who: "You (typed)", text: typedText }); }
      answeredSeq = heardSeq; updatePending();
      logDecision(intake.noiseOnly ? "skip-noise" : "intake", questionSource(), pending.map(t => t.text).join(" "));
      if (intake.noiseOnly && !anyway) {
        if (!fromAuto) { answerAnywayHeld = { lines: pending.slice(), at: Date.now() }; status("Nothing question-like in that — press AI Answer again to answer anyway.", "live"); }
        return;
      }
      const cutSeq = pending.length ? pending[0].seq : heardSeq + 1;
      const earlier = transcript.filter(t => t.seq < cutSeq).slice(-40).map(t => `${t.who}: ${t.text}`).join("\n");
      if (!intake.worthy) {
        // No real question from any source, but the fragments carry real
        // keywords: tackle them into the lane instead of answering noise.
        if (fromAuto) return;
        const lane = (cur && cur.question && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(cur.question)) ? cur.question : "";
        const q = pressQuestion("", intake, lane) || ("From what was heard: " + intake.keywords.join(", "));
        const heard = intake.heard + (lane ? `\nLane (the question already on screen — stay on it): ${lane}` : "");
        const card = addCard(q, ["…"]);
        card.heard = heard; card.earlier = earlier;
        card.formSeq = pending.length ? pending[0].seq : null;
        showPressed(card, q);
        return await generateAnswer(heard, card, { consolidated: true, earlier, derived: q, pinned: true });
      }
      // Heard-only questions are messy transcripts, not clean questions: let
      // the server cut the actual ask (derive step + unpinned cut) instead of
      // pinning the whole concatenation to the card. Typed questions stay
      // pinned whole — the typed words already are the question.
      const heard = intake.heard.replace(/\nCurrent question \(on screen\):[^\n]*/g, "").trim();
      const followTyped = typedText && cur && hasAnswer(cur) ? typedFollowUpQuestion(typedText, cur.question) : "";   // "And why?" typed after an answer: own card, same subject
      const said = followTyped || pressQuestion(typedText, intake, "") || intake.derived || heardAsQuestion(pending);
      const heardOnly = !typedText;
      // Typed words are the question, and two questions in the box are two asks.
      // A design followed by an explanation stays one. The microphone uses the same cut.
      const spans = splitDistinctAsks(heardOnly ? (intake.derived || said || "") : (typedText || said || ""));
      // Merge with slice 3: a typed "And why? …" after an answer keeps its subject on the first card.
      if (!heardOnly && followTyped && spans.length > 1) spans[0] = typedFollowUpQuestion(spans[0], cur.question) || spans[0];
      if (spans.length > 1) {
        const who = heardOnly ? (questionSource() === "You" ? "You" : "Them") : "You";
        for (const span of spans) {
          const shown = heardOnly ? span : (withoutLogistics(span) || span);   // a typed compound shows only its non-logistics part
          const spanHeard = who + ": " + span;
          const card = addCard(heardOnly ? "Deriving…" : shown, ["…"]);
          if (shown !== span) card.original = span;
          card.heard = spanHeard;
          card.earlier = earlier;
          card.formed = spanHeard;
          card.formSeq = pending.length ? pending[0].seq : null;
          showPressed(card, heardOnly ? "Deriving…" : shown);
          await generateAnswer(spanHeard, card, { consolidated: true, earlier, derived: heardOnly ? undefined : shown, pinned: !heardOnly });
        }
        return;
      }
      const shownSaid = heardOnly ? said : (withoutLogistics(said) || said);   // the typed words, minus a logistics clause
      const card = addCard(heardOnly ? "Deriving…" : (shownSaid || "Answering what was just heard…"), ["…"]);
      if (shownSaid !== said) card.original = said;
      card.heard = heard; card.earlier = earlier; card.formed = heard;
      card.singleSpokenTurn = heardOnly;
      card.fullSpokenQuestion = heardOnly ? String(spans[0] || said).replace(/\s+/g, " ").trim() : "";
      card.formSeq = pending.length ? pending[0].seq : null;
      showPressed(card, card.question);
      return await generateAnswer(heard, card, { consolidated: true, earlier, derived: heardOnly ? undefined : shownSaid, pinned: !heardOnly });
    }
    if (fromAuto) return;
    const c = cards[idx];
    if (c && /^(Your introduction)$/.test(c.question)) return await generateAnswer("Tell me about yourself", c);
    // Pressing AI Answer again re-forms the question from everything heard
    // for this card plus its earlier context, and answers that — the press
    // itself says the last answer missed (owner, 21 Oct 2026). Re-deriving
    // the old heard text alone is what showed "No question yet".
    if (c && c.question && !/^(Preparing\u2026|Ready|Cleared\.|No question yet|Deriving)/.test(c.question)) {
      // A finished page stays as it is; asking it again opens the next page. A page with no answer yet is asked again in place.
      const page = hasAnswer(c) ? addCard(c.question, ["…"]) : c;
      if (page !== c) { page.heard = c.heard; page.earlier = c.earlier; page.formed = c.formed; page.singleSpokenTurn = c.singleSpokenTurn; page.fullSpokenQuestion = c.fullSpokenQuestion; }
      showPressed(page, c.question);
      return await generateAnswer(c.question, page, { reask: true, pinned: true, derived: c.question });
    }
    if (c && c.heard) return await generateAnswer(c.heard, c, { consolidated: true, earlier: c.earlier || "" });
    const themCap = captures.find(c => c.who === "Them");
    status(emptyPressReason(captures.length > 0, !!(typeof srcOn !== "undefined" && srcOn.sys), !!themCap, !!(themCap && (performance.now() - (themCap.lastAudibleAt || 0) > 20000))), "live");
    setChat(true);
  } catch (error) {
    status(error.message || "Could not prepare an answer. Please retry.", "err");
  } finally { aiBusy = false; }
}
$("screenBtn").onclick = analyseScreen;
// One visible desktop action for captured questions. It uses the same verified
// capture → region review → grounded answer path as the existing menu/shortcut.
if ($("screenCaptureAnswerBtn")) $("screenCaptureAnswerBtn").onclick = analyseScreen;
async function grabFrame() {
  // A companion extension may hand the page a frame it captured without a
  // picker (tab capture needs no share dialog). One frame, one use: it is
  // consumed here and cleared, so a stale frame can never answer twice.
  // The attribute crosses the extension's isolated world; the page reads it
  // straight from the document, so no listener or message bridge is needed.
  if (typeof document !== "undefined" && document.documentElement && typeof document.documentElement.getAttribute === "function") {
    const extFrame = document.documentElement.getAttribute("data-kompas-ext-frame");
    if (typeof extFrame === "string" && extFrame) {
      if (typeof document.documentElement.removeAttribute === "function") document.documentElement.removeAttribute("data-kompas-ext-frame");
      if (extFrame.indexOf("data:image/") === 0) return extFrame;
      throw new Error("The companion capture did not return a readable frame. Press Screen Answer again.");
    }
  }
  // Windows Kompas 0.8+ returns a fresh, bounded in-memory JPEG. This avoids
  // trying to extract the image from the system-audio loopback display track.
  // If the native capture refuses (for example before the live view has registered), the stream path still runs.
  let nativeError = null;
  if (typeof window !== "undefined" && window.kompasDesktop?.captureScreen) {
    try { return await window.kompasDesktop.captureScreen(); } catch (e) { nativeError = e; }
  }
  let track = displayVideo && displayVideo.readyState === "live" ? displayVideo : null;
  if (!track) {
    let s;
    try { s = await screenStream(); }
    catch (e) { if (nativeError && e && e.name !== "NotAllowedError") throw new Error((nativeError.message || String(nativeError)) + " " + (e.message || "")); throw e; }
    track = s.getVideoTracks()[0]; displayVideo = track;
  }
  const video = document.createElement("video"); video.muted = true; video.playsInline = true;
  try {
    video.srcObject = new MediaStream([track]); await video.play();
    if (video.readyState < 2) await new Promise(r => { video.onloadeddata = r; setTimeout(r, 1500); });
    if (track.readyState !== "live" || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error("No readable screen frame yet. Please retry.");
    const w = video.videoWidth, h = video.videoHeight, k = Math.min(1, 1600 / w);
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const context = c.getContext("2d");
    if (!context) throw new Error("Screen capture is unavailable in this browser.");
    context.drawImage(video, 0, 0, c.width, c.height);
    // A window that opted out of capture comes back as one flat colour, usually black. Sample the
    // frame here so it is named as such instead of being sent to vision as if it held a question.
    // Any real content — text on a background — breaks the flatness, so it is never flagged. The
    // check lives inside grabFrame because suites run this function on its own.
    const pixels = context.getImageData(0, 0, c.width, c.height).data;
    let flat = pixels.length > 0;
    if (flat) {
      const r0 = pixels[0], g0 = pixels[1], b0 = pixels[2];
      const step = 4 * Math.max(1, Math.floor(pixels.length / 4 / 4096));
      for (let i = 0; i < pixels.length; i += step) { if (Math.abs(pixels[i] - r0) > 12 || Math.abs(pixels[i + 1] - g0) > 12 || Math.abs(pixels[i + 2] - b0) > 12) { flat = false; break; } }
    }
    if (flat) throw new Error("This window opted out of screen capture, so its content comes back blank. Running as administrator does not change that — share the window another way, or type the question.");
    return c.toDataURL("image/jpeg", 0.72);
  } finally { video.onloadeddata = null; video.pause(); video.srcObject = null; }
}
// A fresh screen stream for Screen Answer. Owner report, 27 Oct 2026: desktop 0.7 showed "Could not start video
// source" (NotReadableError: Windows refused to start the stream for that Kompas process; the same request in a clean
// Electron 44.5.1 process with 0.7's handler and window settings captured 1920x1080 every time). One fresh retry, on
// desktop asked the way call audio asks (the handler always serves that), its audio let go at once; then a sentence
// that says what happened and what to do.
async function screenStream() {
  const desktop = typeof window !== "undefined" && !!window.kompasDesktop;
  // Windows first (owner, 1 Nov 2026): the Screen Answer button captures
  // windows before screens or tabs. The window hint is a preference, not a
  // promise — a browser that refuses it falls back to the plain call, and a
  // cancelled picker is never retried.
  let last = null;
  for (const video of [{ displaySurface: "window" }, true]) {
    try { return await navigator.mediaDevices.getDisplayMedia({ video, audio: false }); }
    catch (e) { last = e; if (e && e.name === "NotAllowedError") throw e; }
  }
  const e = last;
  await new Promise(r => setTimeout(r, 400));
  try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: desktop });
      s.getAudioTracks().forEach(t => t.stop());
      return s;
    } catch (again) {
      if (again && again.name === "NotAllowedError") throw again;
      const why = again && again.message || e.message;
      // A desktop build with no native capture is an old one (28 Oct 2026: the website's links opened a 7 Oct
      // development runtime, so reopening only reopened it). The new build takes the links once it is opened.
      if (desktop && !window.kompasDesktop.captureScreen)
        throw new Error("This Kompas window is an older desktop build (" + (window.kompasDesktop.version || "before 0.8") + ") that cannot capture the screen (" + why + "). Close it, then open Kompas once from the Kompas icon on your desktop. From then on the website opens the new build.");
      throw new Error(desktop
        ? "Windows would not start screen capture in this Kompas window (" + why + "). Close Kompas fully and open it again, then press Screen Answer."
        : "The browser could not start the screen share (" + why + "). Stop any other screen share, then try again.");
    }
}
function stripScreenChrome(question) {
  const stripped = String(question || "").replace(/^Question \d+ \([^)\n]{0,80}\):\s*/gm, "").trim();
  return stripped || String(question || "").trim();
}
// A captured screen can hold more than one question. Each Question N block is
// its own ask, options included. One block stays one ask. No review dialog.
function screenQuestionPieces(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const headed = text.split(/(?=Question \d+ \([^)\n]{0,80}\):)/).map((s) => s.trim()).filter(Boolean);
  const parts = (headed.length > 1 ? headed : [text]).map((s) => stripScreenChrome(s)).filter(Boolean);
  return parts.length ? parts : [stripScreenChrome(text)];
}
async function analyseScreen() {
  if (aiBusy) { status("Still working on the last answer.", "live"); return; }
  aiBusy = true; aiBusySince = Date.now();
  const screenSession = current && current.id;
  let screenOwnsAnswer = true;
  const card = addCard("🖥 Reading the screen…", ["…"]); card.streaming = true; renderCard();
  const t0 = performance.now();
  try {
    // The Screen Capture press is the consent to hide Kompas itself while the
    // frame is grabbed, so the overlay never pollutes the shot. Hidden only
    // for the grab, restored right after, even when the grab fails.
    const overlayEl = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("overlay") : null;
    const canHide = !!(overlayEl && overlayEl.style);
    const prevVisibility = canHide ? overlayEl.style.visibility : "";
    if (canHide) overlayEl.style.visibility = "hidden";
    let image;
    try { image = await grabFrame(); } finally { if (canHide) overlayEl.style.visibility = prevVisibility; }
    const res = await fetch("/api/screen", { signal: AbortSignal.timeout(30000), method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, prep: slimPrep(), config: liveConfig() }) });
    const data = await res.json();
    if ((current && current.id) !== screenSession || !cards.includes(card)) throw new Error("Session changed. Capture the screen again in the active session.");
    if (!res.ok) throw new Error(data.error || "Screen analysis failed. Please retry.");
    if (data.needsReview === true) {
      // No dialog, ever: a review payload from an older deployment answers
      // directly from its tasks, the same as a fresh direct answer.
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (!tasks.length) throw new Error("No screen question was returned. Please retry.");
      const pieces = tasks.map((t) => {
        const formatted = (typeof window !== "undefined" && window.KompasScreenCore && typeof window.KompasScreenCore.format === "function")
          ? window.KompasScreenCore.format([t])
          : t.question;
        return stripScreenChrome(String(formatted || "").trim());
      }).filter(Boolean);
      if (!pieces.length) throw new Error("No screen question was returned. Please retry.");
      card.question = pieces[0]; card.screenTask = true;
      await generateAnswer(pieces[0], card, { pinned: true, derived: pieces[0], source: "screen" });
      for (const piece of pieces.slice(1)) {
        if ((current && current.id) !== screenSession || !cards.includes(card)) return;
        const next = addCard(piece, ["…"]); next.screenTask = true;
        await generateAnswer(piece, next, { pinned: true, derived: piece, source: "screen" });
      }
      return;
    } else if (data.needsAnswer === true) {
      if (typeof data.question !== "string" || !data.question.trim()) throw new Error("No screen question was returned. Please retry.");
      const pieces = screenQuestionPieces(data.question);
      if (!pieces.length) throw new Error("No screen question was returned. Please retry.");
      card.question = pieces[0]; card.screenTask = true;
      await generateAnswer(pieces[0], card, { pinned: true, derived: pieces[0], source: "screen" });
      for (const piece of pieces.slice(1)) {
        if ((current && current.id) !== screenSession || !cards.includes(card)) return;
        const next = addCard(piece, ["…"]); next.screenTask = true;
        await generateAnswer(piece, next, { pinned: true, derived: piece, source: "screen" });
      }
      return;
    }
    if (!data.needsReview) {
      if (typeof data.text !== "string" || !data.text.trim()) throw new Error("No screen answer was returned. Please retry.");
      card.question = "🖥 " + (data.question || "On screen"); card.answer = data.text;
    }
  } catch (e) { if (!card.screenTask) card.question = "🖥 Screen"; card.answer = ["Couldn't capture the screen — " + (e && e.name === "NotAllowedError" ? "share was cancelled" : (e && e.message || e))]; }
  finally { if (screenOwnsAnswer) aiBusy = false; }
  card.streaming = false; card.meta = ((performance.now() - t0) / 1000).toFixed(1) + "s · vision";
  if (cards[idx] === card) renderCard();
}
// The review dialog normally arrives with the page. A stale cached page can
// reach the review step without it, which used to fail the whole capture.
// Recover by loading the two review scripts in order and trying again;
// only if that fails does the capture report that the review could not open.
async function ensureScreenReview() {
  if (typeof window !== "undefined" && window.KompasScreenReview) return true;
  if (typeof document === "undefined") return false;
  const parent = document.head || document.body;
  if (!parent || typeof parent.appendChild !== "function") return false;
  for (const src of ["screen-core.js", "screen-review.js"]) {
    const loaded = await new Promise((resolve) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.onload = () => resolve(true);
      tag.onerror = () => resolve(false);
      parent.appendChild(tag);
    });
    if (!loaded) return false;
  }
  return typeof window !== "undefined" && !!window.KompasScreenReview;
}
/* ---- Follow along: tracks the words YOU speak, typing-test style ----
   Owner, 2026-09-29: "it should work the way thetypingtest.com works — the order of characters the user
   speaks out is traced and followed along." With Follow along on, the browser's live speech recognition
   (Chrome/Edge) listens to your microphone in parallel — its own stream, so Kompas's capture and
   transcription are untouched — and each spoken word is matched against the answer from where you are:
   words you've said turn soft green, the word you're on is marked, and the pane scrolls only when your
   place moves past the middle. No timer. Scroll by hand and it holds off for a few seconds. Where live
   recognition isn't available it follows Kompas's own transcript of your mic (slower, phrase by phrase). */
const follow = { on: false, pos: 0, livePos: 0, words: [], card: null, rec: null, holdUntil: 0, sr: false,
  heard: 0, trail: [], lastEvent: 0, ghost: 0, tick: 0 };   // heard = words recognised; trail = [time, pos] for pace
const FSTOP = new Set("a an the and or but of to in on at for with by from as is are was were be been it its this that i we you my our so then just".split(" "));
const fnorm = (w) => String(w || "").toLowerCase().replace(/[’']/g, "").replace(/%/g, "").replace(/[^a-z0-9]+/g, "");
function fsame(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;         // tuned/tuning, detection/detections
  if (Math.min(a.length, b.length) >= 3 && Math.abs(a.length - b.length) === 1 && (a.startsWith(b) || b.startsWith(a))) return true;   // "pas" / "pass"
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
  let i = 0, j = 0, edits = 0;                                                                    // one-edit tolerance (ASR spelling)
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++edits > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
// Walk spoken words forward through the answer from position `from`; return the new position.
// Context alignment (owner, 2026-09-30: "look at 2-3 right words before and after to find where I am; words may be
// dropped at the start and end"). Each update aligns the LAST 8 spoken words against the text near your place and
// anchors where the whole run fits best: misheard, dropped or extra words cost a little, matches earn more (content
// words most). No AI — about 60 positions x 20 steps, microseconds per update.
function alignScore(W, S, j) {
  let si = S.length - 1, wi = j, score = 0, misses = 0;
  const floor = Math.max(0, j - S.length * 2 - 3);
  while (si >= 0 && wi >= floor && misses <= 4) {
    if (fsame(W[wi], S[si])) { score += FSTOP.has(S[si]) ? 1 : 3; si--; wi--; }
    else if (si > 0 && fsame(W[wi], S[si - 1] + S[si])) { score += 3; si -= 2; wi--; }   // "cyber arc" = CyberArk, "pay replicate" = PAReplicate
    else if (si > 0 && fsame(W[wi], S[si - 1])) { si--; misses++; score -= 0.5; }   // a spoken word the text doesn't have
    else { wi--; misses++; score -= 0.5; }                                            // a text word skipped (by you or the recogniser)
  }
  return score;
}
function followAdvance(from, spoken) {
  const W = follow.words, S = spoken.map(fnorm).filter(Boolean).slice(-8);
  if (!S.length || !W.length) return from;
  const last = S[S.length - 1], prev = S[S.length - 2];
  let best = -1, bestScore = -Infinity;
  // Pace (owner, 2026-09-30: "tracing is always important with pace of words"): where you should be by now, from
  // your measured words-per-minute; candidates near that point win ties, and a far jump needs more matched words.
  const expect = Math.max(from, Math.round(from + followWpm() / 60 * Math.max(0, (performance.now() - (follow.lastEvent || performance.now())) / 1000)));
  let bestNeed = 0;
  for (let j = Math.max(0, from - 4); j < Math.min(W.length, from + 60); j++) {
    if (!(fsame(W[j], last) || (prev && (fsame(W[j], prev) || fsame(W[j], prev + last))))) continue;               // anchor: the newest word (or the one before)
    const sc = alignScore(W, S, j) - Math.abs(j - expect) * 0.04 - (j < from - 1 ? 2 : 0);   // near where your pace says you are
    if (sc > bestScore) { bestScore = sc; best = j; bestNeed = Math.max(0, j - from - 12) / 12; }   // every 12 words beyond the next dozen needs one more point
  }
  const need = (S.length >= 3 ? 4 : FSTOP.has(last) ? 99 : 3) + bestNeed;            // one lone "the" never moves you; big leaps need proof
  let p = best >= 0 && bestScore >= need ? Math.max(from, best + 1) : from;
  // Relocate (owner, 2026-09-30: "still staying at that one place"): nothing matched near your place — search the WHOLE
  // answer for the run you just said and jump there when at least three content words line up (you started lower, or skipped).
  if (p === from && S.filter(w => !FSTOP.has(w)).length >= 3) {
    let gBest = -1, gScore = -Infinity;
    for (let j = 0; j < W.length; j++) {
      if (!(fsame(W[j], last) || (prev && (fsame(W[j], prev) || fsame(W[j], prev + last))))) continue;
      const sc = alignScore(W, S, j) - Math.abs(j - from) * 0.01;
      if (sc > gScore) { gScore = sc; gBest = j; }
    }
    if (gBest >= 0 && gScore >= 8) p = gBest + 1;
  }
  while (p < W.length && !W[p]) p++;                                                  // never park on a bare dash
  return p;
}
// Owner, 2026-09-29: while following, the pane shrinks to a six-line window (was three: "way too small"); once the first two lines are
// spoken, the line you are on is held on line two and the text glides up under you, to the very end. The glide is
// a critically damped spring on requestAnimationFrame (browser smooth-scroll restarts on every word and stutters).
const glide = { target: 0, raf: 0, last: 0 };
function glideTo(ul, top) {
  if (Date.now() < follow.holdUntil) return;
  glide.target = Math.max(0, Math.min(top, ul.scrollHeight - ul.clientHeight));
  if (document.hidden) { ul.scrollTop = glide.target; followEase(); return; }
  if (glide.raf) return;
  glide.last = performance.now();
  const step = (now) => {
    const dt = Math.min(32, now - glide.last); glide.last = now;
    if (Date.now() < follow.holdUntil) { glide.raf = 0; followEase(); return; }
    const diff = glide.target - ul.scrollTop;
    if (Math.abs(diff) < 0.2 || !follow.on) { if (follow.on) ul.scrollTop = glide.target; glide.raf = 0; followEase(); return; }
    // The scroll is the animation, as on groq.com: ink is read from where the line is, not from a timer.
    ul.scrollTop += diff * (1 - Math.exp(-dt / 280));
    followEase();
    glide.raf = requestAnimationFrame(step);
  };
  glide.raf = requestAnimationFrame(step);
}
function followEase() {
  const ul = $("answer");
  const words = ul.querySelectorAll("span.w");
  if (!follow.on) {
    words.forEach(el => el.style.removeProperty("color"));
    const old = ul.querySelector(":scope > .read-head"); if (old) old.remove();
    return;
  }
  const n = words.length;
  if (!n) return;
  const tops = new Array(n);
  for (let i = 0; i < n; i++) tops[i] = words[i].getBoundingClientRect().top;
  const dark = ul.closest(".overlay") && ul.closest(".overlay").classList.contains("dark");
  const ink = dark ? [244, 244, 245] : [21, 20, 15], paper = dark ? [90, 90, 96] : [214, 210, 200];
  const tone = (fade) => {
    const u = fade <= 0 ? 0 : fade >= 1 ? 1 : fade * fade * (3 - 2 * fade);
    return "rgb(" + ink.map((a, k) => Math.round(a + (paper[k] - a) * u)).join(",") + ")";
  };
  const lines = [];
  for (let i = 0; i < n;) {
    const top = tops[i];
    let j = i + 1;
    while (j < n && Math.abs(tops[j] - top) < 3) j++;
    lines.push({ start: i, end: j });
    i = j;
  }
  const at = Math.min(Math.max(follow.pos, follow.livePos) + (follow.ghost || 0), n - 1);
  let cur = 0;
  for (let L = 0; L < lines.length; L++) if (at >= lines[L].start && at < lines[L].end) { cur = L; break; }
  const here = lines[cur];
  const along = (at - here.start) / Math.max(1, here.end - here.start);
  lines.forEach((line, L) => {
    const count = line.end - line.start;
    for (let w = 0; w < count; w++) {
      let fade = 1;
      if (L < cur) fade = 0;
      else if (L === cur) fade = 0;
      else if (L === cur + 1 || L === cur + 2) {
        // The next two lines stay readable. Both take ink from the left as this line is spoken: the nearer one
        // ends in full ink, the one after ends where the nearer one began, so a line change has no jump.
        const place = (w + 0.5) / count;
        const ahead = place - along;
        const t = ahead <= 0 ? 0 : Math.min(1, ahead / 0.22);
        fade = L === cur + 1 ? 0.32 * t : 0.32 + 0.22 * t;
      }
      words[line.start + w].style.setProperty("color", tone(fade), "important");
    }
  });
  const curLi = words[at] && words[at].closest("li");
  if (!curLi) return;
  let mark = ul.querySelector(":scope > .read-head");
  if (!mark) { mark = document.createElement("i"); mark.className = "read-head"; mark.setAttribute("aria-hidden", "true"); ul.append(mark); }
  mark.style.transform = "translate3d(0," + (curLi.offsetTop + 5) + "px,0)";
}
function followFrames(now) {
  if (!follow.on) { follow.frame = 0; return; }
  followEase(now);
  follow.frame = requestAnimationFrame(followFrames);
}
const READ_LINE = ["read-now", "read-past", "read-1", "read-2", "read-3", "read-far"];
function followPaint() {
  const ul = $("answer"), spans = ul.querySelectorAll("span.w"), lis = ul.querySelectorAll(":scope > li");
  const at = Math.min(follow.words.length, Math.max(follow.pos, follow.livePos) + (follow.ghost || 0));
  ul.classList.toggle("following", follow.on);
  if (!follow.on) {
    lis.forEach(li => { li.classList.remove(...READ_LINE); delete li.dataset.read; });
    if (follow.painted) spans.forEach(sp => sp.classList.remove("said", "cur"));
    follow.painted = 0;
    followEase();
    if (follow.frame) { cancelAnimationFrame(follow.frame); follow.frame = 0; }
    return;
  }
  // The line you are speaking stays full ink. Each line further ahead steps lighter, the way the Groq page does.
  const cur = spans[Math.min(at, Math.max(0, spans.length - 1))];
  const curLi = cur ? cur.closest("li") : null;
  let ci = 0;
  lis.forEach((li, i) => { if (li === curLi) ci = i; });
  lis.forEach((li, i) => {
    const d = i - ci;
    const name = d === 0 ? "read-now" : d < 0 ? "read-past" : d === 1 ? "read-1" : d === 2 ? "read-2" : d === 3 ? "read-3" : "read-far";
    if (li.dataset.read === name) return;
    li.classList.remove(...READ_LINE);
    li.classList.add(name);
    li.dataset.read = name;
  });
  follow.painted = at;
  followEase();
  if (!follow.frame) follow.frame = requestAnimationFrame(followFrames);
  if (Date.now() < follow.holdUntil) return;
  if (!cur) return;
  const lh = parseFloat(getComputedStyle(cur).lineHeight) || 26;
  // Position in the scrolled content, from screen coordinates (offsetTop broke when a paragraph became the offset
  // parent — the line never looked past line two, so nothing scrolled on the owner's screen).
  const r = cur.getBoundingClientRect(), ur = ul.getBoundingClientRect();
  const lineTop = r.top - ur.top + ul.scrollTop;
  // Owner, 2026-09-30: 7-8 lines on screen; as you approach the end of line 3 the text starts to move, slowly enough
  // not to be noticed. Your reading point is continuous — the line you're on plus how far along it you are — so the
  // text creeps up a fraction of a line with every word instead of jumping a line at a time.
  const along = Math.min(1, Math.max(0, (r.left - ur.left) / Math.max(1, ul.clientWidth - 24)));
  const y = lineTop + along * lh;
  // The line you are on sits just under the one you finished, and the lines still to come fill the rest.
  glideTo(ul, y > lh * 1.15 ? y - lh * 1.15 : 0);
}
function followRendered(c) {                        // called by renderCard: keep the word list and marks current
  if (c !== follow.card) { follow.card = c; follow.pos = 0; follow.livePos = 0; }
  follow.words = [...$("answer").querySelectorAll("span.w")].map(sp => fnorm(sp.textContent));
  follow.painted = 0;                                  // fresh spans: repaint from the first word
  if (follow.on && vosk.rec && vosk.ctx) voskRecognizer();   // the on-device recogniser listens for THIS answer's words
  if (follow.on) followPaint();
}
function followWpm() {                                // your pace over the last ~20 s of reading (140 until measured)
  const t = follow.trail; if (t.length < 2) return 140;
  const a = t[0], b = t[t.length - 1], mins = (b[0] - a[0]) / 60000;
  return mins > 0.05 ? Math.max(60, Math.min(260, (b[1] - a[1]) / mins)) : 140;
}
function followHear(text, final) {
  if (!follow.on || !follow.words.length) return;
  const spoken = String(text || "").split(/\s+/).filter(Boolean);
  const hl = $("followHeard"); if (hl) { hl.textContent = "hearing: " + spoken.slice(-8).join(" "); hl.hidden = false; }   // what the recogniser caught, live
  const before = Math.max(follow.pos, follow.livePos);
  if (final) { follow.pos = followAdvance(follow.pos, spoken); follow.livePos = follow.pos; follow.heard += spoken.length; }
  else follow.livePos = followAdvance(follow.pos, spoken);                                       // interim: provisional, not committed
  const now = performance.now(), at = Math.max(follow.pos, follow.livePos);
  follow.lastEvent = now; follow.ghost = 0;                                                      // the truth replaces any bridge
  if (at > before) { follow.trail.push([now, at]); while (follow.trail.length > 2 && now - follow.trail[0][0] > 20000) follow.trail.shift(); }
  followPaint(); followUI();
}
// Between recognition events (~100-300 ms apart) the cursor keeps moving at your pace — at most 2 words past the
// last confirmed word, and only while you are still talking (an event in the last 0.8 s). The next event corrects it.
function followBridge() {
  if (!follow.on || !follow.lastEvent) return;
  const since = performance.now() - follow.lastEvent;
  if (since > 800) { if (follow.ghost) { follow.ghost = 0; followPaint(); } return; }
  const g = Math.min(follow.engine === "on-device" ? 1 : 2, Math.floor(followWpm() / 60 * since / 1000));   // on-device events are frequent: bridge less
  if (g !== follow.ghost) { follow.ghost = g; followPaint(); }
}
// On-device tracker (owner, 2026-09-30: "the tracing is still behind my pace"). Chrome's recogniser confirms a word
// ~200-500 ms after it is spoken. Vosk runs in the page, limited to the words of the answer on screen, so it only has
// to tell which of THOSE words you just said: partial results every ~100 ms, nothing leaves the laptop. The model
// (~41 MB) downloads once and is cached; until it is ready, and if it ever fails, Chrome's recogniser carries on.
const VOSK_JS = "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js";
const VOSK_MODEL = "https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz";
const vosk = { model: null, loading: null, rec: null, ctx: null, node: null, stream: null, grammarFor: "" };
function voskLoad() {
  if (vosk.model) return Promise.resolve(vosk.model);
  if (vosk.loading) return vosk.loading;
  vosk.loading = new Promise((res, rej) => {
    const go = () => window.Vosk.createModel(VOSK_MODEL).then(m => { vosk.model = m; res(m); }, rej);
    if (window.Vosk) return go();
    const sc = document.createElement("script"); sc.src = VOSK_JS; sc.onload = go; sc.onerror = () => rej(new Error("vosk script")); document.head.append(sc);
  }).catch(e => { vosk.loading = null; throw e; });
  return vosk.loading;
}
function voskGrammar() { return JSON.stringify([...new Set(follow.words.filter(w => /^[a-z']+$/.test(w)))].concat("[unk]")); }
function voskRecognizer() {
  const g = voskGrammar();
  if (vosk.rec && vosk.grammarFor === g) return;
  try { vosk.rec && vosk.rec.remove(); } catch {}
  let r; try { r = new vosk.model.KaldiRecognizer(vosk.ctx.sampleRate, g); } catch { r = new vosk.model.KaldiRecognizer(vosk.ctx.sampleRate); }
  r.on("partialresult", (m) => { const t = m && m.result && m.result.partial; if (t) followHear(t, false); });
  r.on("result", (m) => { const t = m && m.result && m.result.text; if (t) followHear(t, true); });
  vosk.rec = r; vosk.grammarFor = g;
}
async function voskStart() {
  await voskLoad();
  if (!follow.on) return false;
  vosk.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  vosk.ctx = new AudioContext();
  voskRecognizer();
  const src = vosk.ctx.createMediaStreamSource(vosk.stream);
  vosk.node = vosk.ctx.createScriptProcessor(1024, 1, 1);           // ~21 ms blocks: low latency
  vosk.node.onaudioprocess = (e) => { try { vosk.rec && vosk.rec.acceptWaveform(e.inputBuffer); } catch {} };
  src.connect(vosk.node); vosk.node.connect(vosk.ctx.destination);   // silent output; keeps the processor running
  return true;
}
function voskStop() {
  try { vosk.node && vosk.node.disconnect(); } catch {}
  try { vosk.stream && vosk.stream.getTracks().forEach(t => t.stop()); } catch {}
  try { vosk.ctx && vosk.ctx.close(); } catch {}
  try { vosk.rec && vosk.rec.remove(); } catch {}
  vosk.node = vosk.stream = vosk.ctx = vosk.rec = null; vosk.grammarFor = "";
}
function followListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  follow.sr = !!SR;
  if (!SR) { status("Follow along is using your mic's transcript — live word tracking needs Chrome or Edge.", "live"); return; }
  const r = new SR();
  r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  // Chrome's on-device recognition: lower latency, nothing leaves the laptop. Installed once when offered.
  try {
    if ("processLocally" in r && SR.available) SR.available({ langs: ["en-US"], processLocally: true }).then(st => {
      if (st === "available") r.processLocally = true;
      else if (st === "downloadable" && SR.install) SR.install({ langs: ["en-US"], processLocally: true }).catch(() => {});
    }).catch(() => {});
  } catch {}
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) followHear(t, true); else interim += " " + t;
    }
    if (interim.trim()) followHear(interim, false);
  };
  r.onerror = (ev) => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { follow.sr = false; status("Follow along needs microphone permission for live word tracking — using your mic's transcript instead.", "err"); } };
  r.onend = () => { if (follow.on && follow.rec === r && follow.sr) setTimeout(() => { if (follow.on && follow.rec === r) { try { r.start(); } catch {} } }, 300); };   // recognition ends on silence: keep listening
  try { r.start(); } catch {}
  follow.rec = r;
}
function followUI() {
  const b = $("followBtn"); if (!b) return;
  const done = Math.min(follow.words.length, Math.max(follow.pos, follow.livePos));
  b.textContent = follow.on ? (follow.lastEvent ? `● ${done}/${follow.words.length} · ${Math.round(followWpm())} wpm` : "● Following you") + (follow.engine === "on-device" ? " ⚡" : "") : "▶ Follow along";
  b.classList.toggle("on", follow.on); b.setAttribute("aria-pressed", follow.on ? "true" : "false");
  b.title = follow.on ? "Tracking the words you speak — click to stop (F)" : "Follow along: highlights the answer as you speak it and keeps your place in view (F)";
}
function setFollow(on) {
  follow.on = !!on;
  if (typeof logAction === "function") logAction(on ? "follow-start" : "follow-stop", on ? {} : { spoken: follow.heard, reached: Math.max(follow.pos, follow.livePos), of: follow.words.length, wpm: Math.round(followWpm()) });
  clearInterval(follow.tick);
  if (glide.raf) { cancelAnimationFrame(glide.raf); glide.raf = 0; } glide.target = 0;   // a new run never inherits the last glide
  if (follow.on) { follow.heard = 0; follow.trail = []; follow.lastEvent = 0; follow.ghost = 0; follow.tick = setInterval(followBridge, 50); }
  if (follow.on) {
    follow.pos = 0; follow.livePos = 0; follow.painted = 0; $("answer").scrollTop = 0; follow.card = cards[idx]; follow.words = [...$("answer").querySelectorAll("span.w")].map(sp => fnorm(sp.textContent));
    followListen();                                                  // Chrome's recogniser right away
    status(vosk.model ? "Follow along: on-device tracking." : "Follow along: preparing on-device tracking (one-time ~41 MB download)…", "live");
    voskStart().then(ok => {                                         // then the on-device one takes over
      if (!ok || !follow.on) { voskStop(); return; }
      if (follow.rec) { const r = follow.rec; follow.rec = null; follow.sr = false; try { r.stop(); } catch {} }
      follow.engine = "on-device"; followUI(); status("Follow along: on-device tracking — your place follows your voice word by word.", "live");
    }).catch(() => { follow.engine = "browser"; followUI(); });
  } else {
    if (follow.rec) { const r = follow.rec; follow.rec = null; try { r.stop(); } catch {} }
    voskStop(); follow.engine = "";
    if ($("followHeard")) $("followHeard").hidden = true;
  }
  followUI(); followPaint();
}
$("followBtn").onclick = () => setFollow(!follow.on);
(() => {                                           // your own scrolling wins: a glide already under way stops, and Follow along waits
  const ul = $("answer"); if (!ul) return;
  const hold = () => {
    if (!follow.on) return;
    follow.holdUntil = Date.now() + 8000;
    if (glide.raf) { cancelAnimationFrame(glide.raf); glide.raf = 0; }
  };
  ["wheel", "touchstart", "touchmove", "mousedown"].forEach(ev => ul.addEventListener(ev, hold, { passive: true }));
})();
followUI();

function logAction(kind, extra) { logEvent({ t: "action", kind, card: (cards[idx] || {}).question, ...(extra || {}) }); }
$("copyBtn").onclick = async () => {
  logAction("copy");
  const c = cards[idx]; if (!c) return;
  try { await navigator.clipboard.writeText(`${c.question}\n\n${plainAnswer(c.answer)}`); status("Copied.", "live"); }
  catch { status("The browser blocked clipboard access.", "err"); }
};
$("exportBtn").onclick = () => {
  const s = current || {};
  const out = [`# Kompas session — ${s.role || ""}${s.company ? " @ " + s.company : ""}`, "", `Exported ${new Date().toLocaleString()}`, "", "## Q&A", ""];
  cards.forEach(c => {
    out.push(`### ${c.question}`);
    answerLines(c.answer).forEach(({ t, kind, lang }) => { if (kind === "code") { out.push("```" + (lang || ""), t, "```"); return; } const x = unbracket(t).replace(new RegExp("\\s*" + PAUSE_MARK + "\\s*", "gi"), " ").trim(); if (!x || kind === "pauseline") return; out.push(kind === "head" ? `#### ${x}` : kind === "bullet" ? `- ${x}` : x); });
    out.push("");
  });
  out.push("## Transcript", ""); transcript.forEach(t => out.push(`**${t.who}:** ${t.text}`));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/markdown" }));
  a.download = `kompas-session-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};
function transcriptText(s, log) {
  s = s || {}; const sessionLog = log || [];
  const tm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const out = ["Kompas Timeline Export", `Session: ${s.role || "Untitled role"}${s.company ? " @ " + s.company : ""}`, `Build: ${BUILD}`, `Exported: ${new Date().toLocaleString()}`, ""];
  if (!sessionLog.length) out.push("(Nothing heard or answered yet in this session.)", "");
  for (const e of sessionLog) {
    if (e.t === "line") { out.push(`[${tm(e.at)}] ${e.who === "Them" ? "Them (interviewer)" : e.who}`, e.text, ""); continue; }
    const head = `[${tm(e.at)}] AI${e.depth ? " — " + e.depth : ""}${e.regen ? " (regenerated)" : ""}${e.typed ? " (typed question)" : ""}`;
    if (e.noQuestion) { out.push(head, "No question detected in what was heard.", ""); continue; }
    if (e.busy) { out.push(head, `Answer-lane rate limit — retried automatically after ${Math.ceil((e.retryAfterMs || 0) / 1000)}s.`, ""); continue; }
    const q = [e.derived, e.question].find(x => typeof x === "string" && x && x !== "undefined") || "";
    if (!q && !String(e.text || "").trim()) continue;
    out.push(head, `💬 Question: ${q}`, "", "---", "", `⭐️ Answer: ${String(e.text || "").trim()}`);
    if (e.failed) out.push("", `(engine unreachable: ${e.failed})`);
    out.push("");
  }
  return out.join("\n");
}
function transcriptName(s, at) {
  const d = new Date(at || Date.now()), z = (n) => String(n).padStart(2, "0");
  return `kompas_${((s && s.role) || "session").replace(/[^a-z0-9]+/gi, "-")}_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}.txt`;
}
function downloadText(name, text) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function getTranscript() {
  const s = current || {};
  downloadText(transcriptName(s), transcriptText(s, sessionLog));
  const nL = sessionLog.filter(e => e.t === "line").length, nA = sessionLog.filter(e => e.t === "answer" && !e.noQuestion).length;
  status(`Transcript saved to Downloads — ${nL} line${nL === 1 ? "" : "s"} heard, ${nA} answer${nA === 1 ? "" : "s"}.`, "live");
}
// Owner, 2026-09-29: "when I end the session the transcript is saved by default, same as Parakeet, for me to download
// and view." Stop, ← Dashboard or closing the tab saves this run's timeline; the dashboard card lists every saved run.
async function saveRunTranscript() {
  const s = current; if (!s || !s.id || !sessionLog.length) return;
  const t = runTranscript(s, sessionLog, Date.now()); if (!t) return;
  // The session's list first: that part is done at once, so the run is listed even when the window is closing. The text follows.
  const all = LS.get("sessions", []), i = all.findIndex(x => x.id === s.id);
  if (i >= 0) { listTranscript(all[i], t.entry); s.transcripts = all[i].transcripts; LS.set("sessions", all); sessions = all; }
  await DossierDB.put(t.key, t.rec);
}
// One session, one transcript (owner, 2026-10-01: "only have one transcript, 2 transcripts are so confusing"). Every stored run of the
// session is read and put in order of time, so the viewer, the download and What went wrong all see a single transcript.
async function sessionTranscript(s) {
  const runs = ((s && s.transcripts) || []).slice().sort((a, b) => a.at - b.at); if (!runs.length) return null;
  const recs = (await Promise.all(runs.map(t => DossierDB.get(t.key)))).filter(Boolean);
  if (!recs.length) {
    // The entry is saved synchronously on leave but the text put is async:
    // a window killed mid-close leaves a row with no text. The raw run log
    // still in this browser rebuilds it; only when that log is gone too is
    // the transcript really lost.
    try { const raw = localStorage.getItem("perfact.log." + s.id); const log = JSON.parse(raw || "[]"); if (Array.isArray(log) && log.length) return { at: log[0].at, log, text: transcriptText(s, log) }; } catch {}
    return null;
  }
  if (recs.every(r => Array.isArray(r.log) && r.log.length)) {
    const seen = new Set(), log = recs.flatMap(r => r.log).sort((a, b) => a.at - b.at)
      .filter(e => { const k = e.at + "|" + e.t + "|" + (e.text || e.question || ""); if (seen.has(k)) return false; seen.add(k); return true; });
    return { at: log[0].at, log, text: transcriptText(s, log) };
  }
  return { at: recs[0].at, log: null, text: recs.map(r => String(r.text || "").trim()).join("\n\n\n") };   // older runs kept only their text
}
async function viewTranscripts(s) {
  if (!((s && s.transcripts) || []).length) return;
  const t = await sessionTranscript(s);
  const body = $("pvBody"); body.innerHTML = "";
  const pre = document.createElement("pre"); pre.textContent = t ? t.text : "This transcript is no longer stored in this browser."; body.append(pre);
  $("pvTitle").textContent = `Transcript — ${s.role || "session"}${t ? " · " + new Date(t.at).toLocaleString() : ""}`;
  $("pvDownload").onclick = (e) => { if (!t) return; if (e.shiftKey && t.log) return downloadText(transcriptName(s, t.at).replace(/\.txt$/, ".training.jsonl"), t.log.map(x => JSON.stringify(x)).join("\n")); downloadText(transcriptName(s, t.at), t.text); };
  $("pvDownload").title = "Download the transcript (Shift+click: the training data, one JSON record per line)";
  $("previewModal").classList.remove("hidden");
}
$("getTranscriptBtn").onclick = getTranscript;
document.addEventListener("keydown", (e) => {
  if ($("view-copilot").classList.contains("hidden")) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement && document.activeElement.tagName) || "");
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    if (document.activeElement === $("manualInput") && $("manualInput").value.trim()) sendManual();   // your typed question wins
    else $("answerBtn").click();
  }
  else if (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s")) { e.preventDefault(); analyseScreen(); }
  else if (typing) return;
  else if (window.kompasDesktop && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    setChat(true);
    const inp = $("manualInput");
    inp.value += e.key;
    inp.focus();
    const end = inp.value.length;
    try { inp.setSelectionRange(end, end); } catch {}
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }
  else if (e.key === "/") { e.preventDefault(); setChat(true); }
  else if (e.key === "t" || e.key === "T") $("drawer").classList.toggle("hidden");
  else if (e.key === "f" || e.key === "F") setFollow(!follow.on);
  else if (e.key === "p" || e.key === "P") openPersonaFile();
  else if (e.key === "ArrowDown") { e.preventDefault(); stepInterviewer(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); stepInterviewer(-1); }
  else if (e.key === "ArrowLeft") $("prevBtn").click();
  else if (e.key === "ArrowRight") $("nextBtn").click();
});

/* ===================== persona dossier: 100–1000 pages, built off the clock =====================
   Hundreds of /api/section calls fan out over interviewer × difficulty × category × project, two
   provider lanes at once, deduplicated, stored in IndexedDB. The live call retrieves from whatever
   is built so far (BM25), so the copilot is useful from the first second and sharper every minute. */
const DossierDB = {
  _p: null,
  open() { if (this._p) return this._p; this._p = new Promise((res, rej) => { const r = indexedDB.open("perfact-dossier", 2); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains("d")) db.createObjectStore("d"); if (!db.objectStoreNames.contains("levels")) db.createObjectStore("levels"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return this._p; },
  async get(id) {
    let local = null;
    try { const db = await this.open(); local = await new Promise(res => { const rq = db.transaction("d", "readonly").objectStore("d").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); } catch {}
    // A session opened on a second device has no local IndexedDB transcript.
    if (local) return local;
    const remote = cloudArchive && await cloudArchive.pull(id);
    if (remote) await this.put(id, remote, true);
    return remote || null;
  },
  async put(id, v, onlyLocal = false) {
    try { const db = await this.open(); await new Promise(res => { const tx = db.transaction("d", "readwrite"); tx.objectStore("d").put(v, id); tx.oncomplete = res; tx.onerror = res; }); } catch {}
    if (!onlyLocal && cloudArchive) cloudArchive.queue(id);
  },
};
// Keep a synced copy of completed transcripts and paused-run cards. The
// browser's IndexedDB remains the offline fallback; uploads retry after login
// and never mix recordings between different verified MarketFit accounts.
cloudArchive = (() => {
  const keyPattern = /^([A-Za-z0-9:_-]{1,128}):(live|tx:[0-9]+)$/;
  const pending = new Set();
  const generations = new Map(); // new recording edits arriving during upload must not be dropped
  let flushing = false;
  const storageKey = () => "perfact.cloud.artifacts." + accountSessionSync.owner;
  const authorization = () => {
    const token = supabaseAccessToken();
    return { "content-type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  };
  const persist = () => {
    if (!accountSessionSync?.owner) return;
    try { localStorage.setItem(storageKey(), JSON.stringify([...pending].slice(-400))); } catch {}
  };
  function queue(key) {
    if (!keyPattern.test(key || "") || !accountSessionSync?.owner) return;
    generations.set(key,(generations.get(key)||0)+1);
    pending.add(key); persist(); void replay();
  }
  async function pull(key) {
    if (!keyPattern.test(key || "") || !accountSessionSync?.owner) return null;
    try {
      const url = "/api/kompas/account-artifacts?key=" + encodeURIComponent(key);
      const res = await fetch(url, { credentials: "same-origin", headers: authorization(), cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.ok ? (data.data || null) : null;
    } catch { return null; }
  }
  async function replay() {
    if (!accountSessionSync?.owner || flushing) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "[]");
      if (Array.isArray(saved)) saved.forEach(k => { if (keyPattern.test(k)) pending.add(k); });
    } catch {}
    if (!pending.size) return;
    flushing = true;
    try {
      await accountSessionSync.flush(); // Session row must exist before artifact FK.
      for (const key of [...pending].slice(0, 15)) {
        const generation = generations.get(key)||0;
        const snap = await DossierDB.get(key);
        if (!snap || typeof snap !== "object") { pending.delete(key); continue; }
        const res = await fetch("/api/kompas/account-artifacts", {
          method: "POST", credentials: "same-origin", headers: authorization(),
          body: JSON.stringify({ key, data: snap }), cache: "no-store",
        });
        if (!res.ok) break; // Offline, over size limit or queued parent; retry later.
        const answer = await res.json();
        if (!answer.ok) break;
        if ((generations.get(key)||0)===generation) pending.delete(key);
        persist();
      }
    } catch {} finally { flushing = false; persist(); }
  }
  return {queue,pull,replay};
})();
const INTERVIEWER_KEYS = ["engineer", "architect", "director"];   // the four levels offered (owner, 5 Oct 2026)
const CATEGORIES = ["identity & background", "behavioral (STAR)", "technical deep-dive", "scenario & troubleshooting", "system & architecture design", "tools & stack specifics", "failure & lessons", "conflict & collaboration", "leadership & ownership", "gaps & weaknesses", "motivation & culture fit", "closing & questions to ask"];
const PAGES_BY_DIFFICULTY = { easy: 100, standard: 250, hard: 500, expert: 1000 };
const WORDS_PER_PAGE = 500;
let dossier = { items: [], words: 0, target: 0, done: [] };
let dossierAbort = false, dossierRunningFor = null;

function countWords(it) { return (it.q + " " + (it.a || []).join(" ")).split(/\s+/).length; }
function planSections(s) {
  const primary = s.interviewer || "engineer", diff = s.difficulty || "standard";
  const others = INTERVIEWER_KEYS.filter(k => k !== primary);
  const projects = (s.prep && s.prep.projects) || [];
  const diffs = { easy: ["easy", "standard"], standard: ["standard", "hard", "easy"], hard: ["hard", "standard", "expert"], expert: ["expert", "hard", "standard"] }[diff] || ["standard"];
  const specs = [];
  for (const cat of CATEGORIES) specs.push({ interviewer: primary, difficulty: diff, category: cat });
  for (const p of projects) { specs.push({ interviewer: primary, difficulty: diff, category: "behavioral (STAR)", projectId: p.id }); specs.push({ interviewer: primary, difficulty: diff, category: "technical deep-dive", projectId: p.id }); }
  for (const d of diffs) for (const who of [primary, ...others]) for (const cat of CATEGORIES) { if (who === primary && d === diff) continue; specs.push({ interviewer: who, difficulty: d, category: cat }); }
  for (const d of diffs) for (const who of others) for (const p of projects) specs.push({ interviewer: who, difficulty: d, category: "technical deep-dive", projectId: p.id });
  return specs.map(sp => ({ ...sp, count: 10 }));
}
function qKey(q) { return String(q).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 3).slice(0, 9).join(" "); }

/* ===================== the PERSONA FILE (per session, Markdown) =====================
   Modelled on the owner's GRID FILE: who you are, the projects with arcs and spoken versions, the
   moments the room was watching, the JD's own domain, tools, operations, a question bank seeded from
   his ~1,850 REAL interviewer questions ranked for this JD, and before/on the call. Written part by
   part by /api/persona in the background, kept in IndexedDB. Every "### " unit is a retrieval item,
   ranked ahead of the dossier — relevance to what the interviewer asked is the top priority. */
let persona = { v: 1, sid: null, parts: {}, done: 0, total: 0, items: [] };
let dossierOff = false, slowUntil = 0, personaLane = "";
// Persona parts written on Groq are paced and wait out a live call. Before the first reply the writer is unknown: one
// part is sent to find out, so a live call never holds the file at 0 parts when GPT Luna is the writer.
const writerOnGroq = () => personaLane === "groq";
function personaPlan(s) {
  const projects = (s.prep && s.prep.projects) || [];
  const plan = [{ key: "cover", part: "cover" }, { key: "who", part: "who" }];
  for (let i = 0; i < projects.length; i += 3) plan.push({ key: "projects-" + i, part: "projects", projectIds: projects.slice(i, i + 3).map(p => p.id), projectOffset: i });
  plan.push({ key: "moments", part: "moments" }, { key: "domain", part: "domain" }, { key: "tools", part: "tools" });
  for (let b = 0; b < 4; b++) plan.push({ key: "qbank-" + b, part: "qbank", batch: b, total: 32 });
  plan.push({ key: "call", part: "call" });
  return plan;
}
function personaMarkdown(s) {
  if (persona.parts.uploaded) return persona.parts.uploaded;          // your own file (Claude-written, or your GRID FILE) wins
  const order = personaPlan(s).map(p => p.key);
  return order.map(k => persona.parts[k]).filter(Boolean).join("\n\n---\n\n");
}
// Load a persona file you already have — one Claude wrote for this session, or your own GRID FILE as
// Markdown. It becomes this session's persona file: shown in the viewer and used first for answers.
async function loadPersonaUpload(file) {
  const s = current; if (!s || !file) return;
  const md = (await file.text()).replace(/\r\n/g, "\n").trim();
  if (!md) return;
  persona = { v: 1, sid: s.id, parts: { uploaded: md }, done: 1, total: 1, items: [] };
  persona.items = personaItems(md); indexDossier();
  await DossierDB.put(s.id + ":persona", { v: 1, parts: persona.parts, done: 1, total: 1 });
  status("Persona file loaded.", "live");
  openPersonaFile();
}
// Split the Markdown into retrieval units: one per "### " heading, carrying its body text.
// Split the Markdown into retrieval units: one per "### " heading. Owner, 2026-09-29: "Always take
// first person responses." Only the SPOKEN blocks (SAY THIS, WHAT IT GAVE YOU, THE STRONGEST THING TO
// SAY, WHAT YOU'D SAY ABOUT IT) can become answer text; coaching notes (WHY THIS SHAPE, WHY IT WORKS,
// WHERE TO USE IT, THE ARC, WHAT IT IS…) only help retrieval and are never shown as an answer.
const SPOKEN_LABELS = /^(SAY THIS|WHAT IT GAVE YOU|THE STRONGEST THING TO SAY|WHAT YOU'?D SAY ABOUT IT|WHAT YOU WOULD SAY ABOUT IT|OUTCOME)$/i;
const META_LINE = /\b(the candidate|this (introduction|answer|response|opening|story|shape)|establishes the|the panel will|interviewers? (will|listen|want)|why this (works|shape))\b/i;
function personaItems(md) {
  const items = []; let part = "", cur = null, label = "";
  for (const line of String(md || "").split("\n")) {
    const h1 = line.match(/^#{1,2}\s+(.+)/), h3 = line.match(/^###\s+(.+)/);
    if (h3) { if (cur) items.push(cur); cur = { q: h3[1].replace(/^Q\d+\s*·\s*[A-Z]+\s*·\s*/, "").replace(/^Follow-up\s*·\s*/i, "").trim(), spoken: [], notes: [], category: part }; label = ""; continue; }
    if (h1 && !h3) { if (cur) { items.push(cur); cur = null; } part = h1[1].trim(); continue; }
    if (!cur || !line.trim()) continue;
    const lab = line.trim().match(/^\*\*([A-Z][A-Za-z '’&/-]+?)\*\*:?\s*(.*)$/);
    if (lab && /^[A-Z '’&/-]+$/.test(lab[1])) { label = lab[1].replace("’", "'"); if (lab[2]) (SPOKEN_LABELS.test(label) ? cur.spoken : cur.notes).push(lab[2]); continue; }
    const t = line.replace(/^\s*[-•]\s+/, "").trim();
    if (SPOKEN_LABELS.test(label) && !META_LINE.test(t)) cur.spoken.push(t); else cur.notes.push(t);
  }
  if (cur) items.push(cur);
  // Only answer material is retrievable: the cover, the claims checklist and Part IX (call prep for the
  // candidate) are for reading, not for answering an interviewer.
  const notAnswers = (it) => /^PART IX\b/i.test(it.category) || /\bFILE\b/.test(it.category) || !it.category
    || /^(confirm before the call|the hard line on claims|the spine|before the call|the first ninety seconds|if you blank|questions to ask them|the close)$/i.test(it.q);
  return items.filter(it => !notAnswers(it) && it.spoken.length)
    .map(it => ({ q: it.q, a: it.spoken, ctx: it.notes.join(" ").slice(0, 600), category: it.category || "persona file", source: "persona", interviewer: "any", difficulty: "any" }))
    .filter(it => it.q && it.a.join(" ").split(/\s+/).length >= 12);
}
async function buildPersonaFile(s) {
  if (location.protocol === "file:" || !s.prep) return;
  const plan = personaPlan(s);
  let saved = await DossierDB.get(s.id + ":persona");
  if (!(saved && saved.parts && Object.keys(saved.parts).length)) {           // same factors + interviewer: copy the finished file
    const twin = twinSession(s, x => (x.interviewer || "engineer") === (s.interviewer || "engineer"));
    const theirs = twin && await DossierDB.get(twin.id + ":persona");
    if (theirs && theirs.parts && Object.keys(theirs.parts).length) { saved = { ...theirs }; await DossierDB.put(s.id + ":persona", saved); }
  }
  persona = saved && saved.v === 1 && saved.parts ? { ...saved, sid: s.id } : { v: 1, sid: s.id, parts: {}, done: 0, total: 0, items: [] };
  if (persona.parts.uploaded) {                     // the owner loaded their own persona file: nothing to write
    persona.done = persona.total = 1; persona.items = personaItems(persona.parts.uploaded); indexDossier(); return;
  }
  persona.total = plan.length; persona.done = plan.filter(p => persona.parts[p.key]).length;
  persona.items = personaItems(personaMarkdown(s)); indexDossier();
  const queue = plan.filter(p => !persona.parts[p.key]).map(p => ({ ...p, tries: 0 }));
  let backoff = 0;
  const worker = async () => {
    while (!dossierAbort && current === s && queue.length) {
      // live answer first. When Groq is the writer it shares its per-minute budget with your answers, so it is paced
      // and waits out a live call; GPT Luna and local Claude have their own quota and keep writing.
      while ((answerCtl || aiBusy || Date.now() < slowUntil || (running && writerOnGroq())) && !dossierAbort) await sleep(400);
      const job = queue.shift();
      if (!job) break;
      let ok = false;
      try {
        const r = await fetch("/api/persona", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ config: cfgOf(s), prep: slimPrepOf(s), part: job.part, projectIds: job.projectIds, projectOffset: job.projectOffset, batch: job.batch, total: job.total, interviewer: s.interviewer || "engineer" }) });
        const data = await r.json();
        if (data && data.lane) personaLane = data.lane;
        if (data && data.lane === "groq") slowUntil = Date.now() + 60000;   // one part a minute: Groq's quota belongs to live answers
        if (data && (data.md || data.done)) {
          ok = true;
          if (data.md) persona.parts[job.key] = data.md;
          persona.done = plan.filter(p => persona.parts[p.key] || (p.key === job.key && data.done)).length;
          if (current === s) { persona.items = personaItems(personaMarkdown(s)); indexDossier(); }
          await DossierDB.put(s.id + ":persona", { v: 1, parts: persona.parts, done: persona.done, total: persona.total });
        }
      } catch {}
      if (ok) backoff = 0;
      else { backoff = Math.min(20000, backoff ? backoff * 1.6 : 3000); if (job.tries++ < 2) queue.push(job); await sleep(backoff); }
    }
  };
  const first = worker();
  while (!personaLane && queue.length && !dossierAbort && current === s) await sleep(300);
  await Promise.all([first, worker(), worker()]);
}
function openPersonaFile() {
  const s = current; if (!s) return;
  const md = personaMarkdown(s);
  $("pvTitle").textContent = `Persona file — ${s.role || "session"}${persona.total && persona.done < persona.total ? ` (${persona.done}/${persona.total} parts written)` : ""}`;
  const body = $("pvBody"); body.innerHTML = "";
  const bar = document.createElement("div"); bar.className = "pf-bar";
  bar.innerHTML = `<span>${persona.parts.uploaded ? "Your own persona file is loaded." : "Written from your resume, JD, documents and instructions."}</span><label class="mini pf-load">Load your own .md<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden></label>`;
  bar.querySelector("input").onchange = (e) => loadPersonaUpload(e.target.files && e.target.files[0]);
  body.append(bar);
  const box = document.createElement("div"); box.className = "md";
  box.innerHTML = md ? renderMarkdown(md) : "<p>The persona file is still being written — it appears here part by part.</p>";
  body.append(box);
  $("pvDownload").onclick = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `persona-file-${(s.role || "session").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  $("previewModal").classList.remove("hidden");
}
// Small, safe Markdown renderer for the persona file (headings, bold, italics, lists, rules, paragraphs).
function renderMarkdown(md) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inl = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  const out = []; let list = false;
  for (const raw of String(md).split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.+)/), li = line.match(/^\s*[-•]\s+(.+)/);
    if (!li && list) { out.push("</ul>"); list = false; }
    if (h) out.push(`<h${h[1].length + 1}>${inl(h[2])}</h${h[1].length + 1}>`);
    else if (li) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inl(li[1])}</li>`); }
    else if (/^-{3,}$/.test(line.trim())) out.push("<hr>");
    else if (line.trim()) out.push(`<p>${inl(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("\n");
}
async function buildDossier(s) {
  if (dossierRunningFor === s.id) return;
  if (dossierOff) return;   // the dossier is written by Claude locally; nothing to do on the hosted site
  dossierRunningFor = s.id; dossierAbort = false;
  const size = s.dossierSize && s.dossierSize !== "auto" ? Number(s.dossierSize) : (PAGES_BY_DIFFICULTY[s.difficulty || "standard"] || 250);
  const saved = await DossierDB.get(s.id);
  const kept = saved && Array.isArray(saved.items) ? saved.items.filter(it => it && String(it.q || "").trim()) : [];
  dossier = kept.length ? { ...saved, v: 2, items: kept, done: saved.done || [] } : { v: 2, items: [], words: 0, target: size, done: [] };
  dossier.target = size; dossier.done = dossier.done || [];
  if (!dossier.items.length && s.prep && Array.isArray(s.prep.questions)) {
    dossier.items = s.prep.questions.map(q => ({ q: q.q, a: q.answer || [], tier: q.tier || 2, category: q.group || "core", interviewer: "any", difficulty: "any", projectId: q.projectId || "" }));
  }
  if (!dossier.md && dossier.items.length && window.KompasDossierMd) dossier.md = window.KompasDossierMd.dossierMarkdown({ interviewer: s.interviewer || "engineer", difficulty: s.difficulty || "standard", category: "core", items: dossier.items });
  dossier.words = dossier.items.reduce((n, it) => n + countWords(it), 0);
  indexDossier();
  const plan = planSections(s);
  const queue = plan.map((sp, i) => ({ sp, i, tries: 0 })).filter(x => !dossier.done.includes(x.i));
  const seen = new Set(dossier.items.map(it => qKey(it.q)));
  let backoff = 0;
  const worker = async () => {
    while (!dossierAbort && current === s && queue.length && dossier.words / WORDS_PER_PAGE < size) {
      while ((answerCtl || aiBusy) && !dossierAbort) await sleep(400);   // live answer first — never compete for the model quota
      const job = queue.shift();
      const avoid = dossier.items.filter(it => it.category === job.sp.category).slice(-25).map(it => it.q.slice(0, 90));
      let got = false;
      try {
        const r = await fetch("/api/section", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ config: cfgOf(s), prep: slimPrepOf(s), spec: job.sp, avoid }) });
        const data = await r.json();
        if (data && data.unavailable) { dossierOff = true; queue.length = 0; break; }   // hosted: the dossier is Claude's job, locally
        if (Array.isArray(data.items) && data.items.length) {
          got = true;
          const fresh = data.items.filter(it => { const k = qKey(it.q); if (!k || seen.has(k)) return false; seen.add(k); return true; });
          dossier.items.push(...fresh); dossier.words += fresh.reduce((n, it) => n + countWords(it), 0);
          if (data.md) dossier.md = [dossier.md, data.md].filter(Boolean).join("\n\n");
          else if (window.KompasDossierMd) dossier.md = window.KompasDossierMd.dossierMarkdown({ interviewer: job.sp.interviewer, difficulty: job.sp.difficulty, category: job.sp.category, items: fresh });
          dossier.done.push(job.i);
          dossier.sessionKey = (window.KompasLevels && window.KompasLevels.sessionDossierKey(s.id)) || ("perfact.dossier." + s.id);
          indexDossier(); await DossierDB.put(s.id, dossier);
        }
      } catch {}
      if (got) backoff = 0;
      else { backoff = Math.min(15000, backoff ? backoff * 1.6 : 2000); if (job.tries++ < 2) queue.push(job); await sleep(backoff); }  // rate limit: back off, retry later
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (dossierRunningFor === s.id) dossierRunningFor = null;
}
function slimPrepOf(s) { const p = s.prep || {}; return { identity: p.identity, persona: p.persona, projects: p.projects }; }

/* BM25 retrieval over the dossier — local, so it costs no network time on the live turn */
const STOP = new Set("the a an and or but of to in on for with at by from as is are was were be been being it its this that these those you your yours i me my we our they them their he she his her what how why when where which who whom do does did can could would should will shall may might must have has had about into over under than then there here so if not no yes just also very tell walk give describe explain time".split(" "));
let postings = new Map(), docLen = [], avgLen = 1, N = 0;
function tokens(s) { return (String(s || "").toLowerCase().match(/[a-z0-9][a-z0-9+#.-]+/g) || []).filter(w => !STOP.has(w)); }
let indexed = [];                                  // persona-file units first, then dossier answers
function indexDossier() {
  indexed = [...(persona && persona.sid === (current && current.id) ? persona.items : []), ...dossier.items];
  postings = new Map(); docLen = []; N = indexed.length; let total = 0;
  indexed.forEach((it, d) => {
    const toks = [...tokens(it.q), ...tokens(it.q), ...tokens(it.category), ...tokens((it.a || []).join(" ")).slice(0, 40), ...tokens(it.ctx || "").slice(0, 20)];
    docLen[d] = toks.length; total += toks.length;
    const tf = new Map(); for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, f] of tf) { let arr = postings.get(t); if (!arr) postings.set(t, arr = []); arr.push([d, f]); }
  });
  avgLen = N ? total / N : 1;
}
function retrieve(question, k = 4) {
  if (!N) return [];
  const scores = new Map(), K1 = 1.4, B = 0.75;
  for (const t of new Set(tokens(question))) {
    const list = postings.get(t); if (!list) continue;
    const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
    for (const [d, f] of list) scores.set(d, (scores.get(d) || 0) + idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * docLen[d] / avgLen)));
  }
  const who = (current && current.interviewer) || "engineer", diff = (current && current.difficulty) || "standard";
  // the persona file is the candidate's own prepared material for THIS job: it outranks the dossier
  return [...scores].map(([d, sc]) => { const it = indexed[d]; return [d, sc * (it.source === "persona" ? 1.6 : 1) * (it.interviewer === who ? 1.25 : 1) * (it.difficulty === diff ? 1.1 : 1)]; })
    .sort((a, b) => b[1] - a[1]).slice(0, k).filter(([, sc]) => sc > 1.2)
    .map(([d]) => { const it = indexed[d]; return { q: it.q, a: it.a, projectId: it.projectId, tier: it.tier, source: it.source }; });
}

/* ===================== Resume + Documents (two sections) ==================
   Any file -> text extracted on-device (PDF via pdf.js, DOCX via mammoth, else
   decoded). Metadata+text live in localStorage; the raw file lives in IndexedDB
   so it can be viewed on-screen and downloaded. kind:'resume' (factor ①) and
   kind:'doc' (factor ③) are two separate sections. */
function docsGet() { return LS.get("docs", []); }
function docsSet(v) { LS.set("docs", v); }
let selectedDocIds = new Set();   // attached documents for the session
let selectedResumeId = "";        // the resume used for the session
const MAX_DOC_CHARS = 40000;

/* A resume is kept 15 days from upload, then auto-removed; the days before, the user is warned (owner, 7 Oct 2026:
   "resume uploaded should be directly. Unless! notify the user. Every 15 days before resumes will be auto-removed").
   The clock is addedAt, already on every item. Nothing silent: the row shows the days left, a banner warns near the
   end, and a boot/open sweep does the removal. */
const DAY_MS = 86400000;
const RESUME_TTL_DAYS = 15;
const RESUME_WARN_DAYS = 3;
let justRemovedResumes = [];      // names removed by the last sweep, shown once in the Resume banner
function resumeDaysLeft(d) { const at = Number(d.addedAt) || 0; return at ? Math.ceil((at + RESUME_TTL_DAYS * DAY_MS - Date.now()) / DAY_MS) : null; }
function pruneExpiredResumes() {
  const now = Date.now(), docs = docsGet();
  const expired = docs.filter(d => (d.kind || "doc") === "resume" && Number(d.addedAt) && now - d.addedAt >= RESUME_TTL_DAYS * DAY_MS);
  if (!expired.length) return 0;
  const ids = new Set(expired.map(d => d.id));
  docsSet(docs.filter(d => !ids.has(d.id)));
  for (const d of expired) { FileDB.del(d.id); selectedDocIds.delete(d.id); if (selectedResumeId === d.id) selectedResumeId = ""; }
  justRemovedResumes = expired.map(d => d.name);
  return expired.length;
}
function renameDoc(id, name) { const v = (name || "").trim(); if (!v) return; docsSet(docsGet().map(d => d.id === id ? { ...d, name: v } : d)); renderSection("resume"); }

/* raw files in IndexedDB, keyed by doc id — so we can view + download them */
const FileDB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open("perfact-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async put(id, blob) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(blob, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async get(id) { try { const db = await this.open(); return await new Promise((res) => { const tx = db.transaction("files", "readonly"); const rq = tx.objectStore("files").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); } catch { return null; } },
  async del(id) { try { const db = await this.open(); return await new Promise((res) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").delete(id); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch {} },
};

async function extractText(file) {
  const name = (file.name || "").toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith(".pdf")) return (await extractPdf(buf)).trim();
  if (name.endsWith(".docx")) {
    if (!window.mammoth) throw new Error("DOCX reader not loaded");
    const { value } = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return (value || "").trim();
  }
  if (name.endsWith(".doc")) throw new Error("legacy .doc — export as PDF/DOCX");
  try { return new TextDecoder().decode(buf).trim(); } catch { return ""; }
}
let _pdfjs = null;
async function extractPdf(buf) {
  if (!_pdfjs) {
    _pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs");
    _pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
  }
  const pdf = await _pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map(i => i.str).join(" ") + "\n";
  }
  return out;
}
function fmtSize(n) { return n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

/* ---- upload (per kind) ---- */
async function handleFiles(fileList, kind) {
  const files = [...fileList]; if (!files.length) return;
  let finished = 0, failed = 0, lastOkResumeId = "";
  for (const file of files) {
    const id = "d" + Date.now() + Math.round(Math.random() * 1e4);
    const docs = docsGet();
    docs.unshift({ id, kind, name: file.name, mime: file.type || "", size: file.size, text: "", chars: 0, primary: false, processing: true, addedAt: Date.now() });
    docsSet(docs); renderSection(kind);
    try { await FileDB.put(id, file); } catch {}
    try {
      let text = await extractText(file);
      if (text.length > MAX_DOC_CHARS) text = text.slice(0, MAX_DOC_CHARS);
      const cur = docsGet(), i = cur.findIndex(d => d.id === id);
      if (i >= 0) {
        cur[i].text = text; cur[i].chars = text.length; cur[i].processing = false;
        if (!text) { cur[i].error = "no text found"; failed++; }
        else {
          if (kind === "resume" && !cur.some(d => d.kind === "resume" && d.primary)) cur[i].primary = true;
          if (kind === "resume") lastOkResumeId = id;
          finished++;
        }
        docsSet(cur); renderSection(kind);
        if (kind === "resume" && text && typeof window.qbankFromResume === "function") window.qbankFromResume(cur[i]);   // a new resume seeds the Question Bank (background)
      } else failed++;
    } catch (e) {
      failed++;
      const cur = docsGet(), i = cur.findIndex(d => d.id === id);
      if (i >= 0) { cur[i].processing = false; cur[i].error = String(e && e.message || e).slice(0, 40); docsSet(cur); renderSection(kind); }
    }
  }
  // A finished resume upload stays on the Resume view so the success tick and rename field are there to use;
  // the just-uploaded resume becomes the one the wizard will use. Documents behave as before.
  if (finished > 0 && failed === 0) {
    if (kind === "resume") { if (lastOkResumeId) selectedResumeId = lastOkResumeId; renderSection("resume"); }
    else openDashboard();
  }
}

/* ---- render one section (resume | doc) ---- */
function renderSection(kind) {
  const list = $(kind === "resume" ? "resumeList" : "docList"); if (!list) return;
  const items = docsGet().filter(d => (d.kind || "doc") === kind);
  $(kind === "resume" ? "resumeEmpty" : "emptyDocs").classList.toggle("hidden", items.length > 0);
  list.innerHTML = "";
  for (const d of items) {
    const el = document.createElement("div");
    el.className = "doc-item";
    el.innerHTML = `<div class="doc-ico">${d.error ? "⚠" : "📄"}</div>
      <div class="doc-main"><div class="doc-name"></div><div class="doc-meta"></div></div>
      <div class="doc-actions">
        <button class="btn ghost act-view">View</button>
        <button class="btn ghost act-dl">Download</button>
        ${kind === "resume" ? '<button class="btn ghost act-primary">Set active</button>' : ""}
        <button class="btn ghost act-del">Delete</button>
      </div>`;
    const nameEl = el.querySelector(".doc-name");
    nameEl.textContent = d.name;
    // Uploaded resumes can be renamed in place, so the right one is easy to recognise later (owner, 7 Oct 2026:
    // "give open text field they can use to rename").
    if (kind === "resume" && !d.processing && !d.error) {
      const inp = document.createElement("input");
      inp.className = "doc-name doc-rename"; inp.value = d.name; inp.title = "Rename this resume"; inp.setAttribute("aria-label", "Resume name");
      const commit = () => renameDoc(d.id, inp.value);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
      inp.addEventListener("change", commit);
      inp.addEventListener("blur", commit);
      nameEl.replaceWith(inp);
    }
    const bits = [`<span>${fmtSize(d.size)}</span>`];
    if (d.processing) bits.push(`<span class="chip processing">reading…</span>`);
    else if (d.error) bits.push(`<span class="chip err">${d.error}</span>`);
    else bits.push(`<span>${(d.chars || 0).toLocaleString()} chars</span>`);
    if (kind === "resume" && !d.processing && !d.error) {
      bits.push(`<span class="chip ok">✓ saved</span>`);                       // the tick for a finished upload
      const left = resumeDaysLeft(d);
      if (left !== null) bits.push(`<span class="chip ${left <= RESUME_WARN_DAYS ? "warn" : ""}">${left <= 0 ? "removing now" : "auto-removes in " + left + (left === 1 ? " day" : " days")}</span>`);
    }
    if (kind === "resume" && d.primary) bits.push(`<span class="chip primary">active</span>`);
    el.querySelector(".doc-meta").innerHTML = bits.join("");
    el.querySelector(".act-view").onclick = () => viewDoc(d);
    el.querySelector(".act-dl").onclick = () => downloadDoc(d);
    el.querySelector(".act-del").onclick = () => deleteDoc(d.id, kind);
    if (kind === "resume") {
      const pb = el.querySelector(".act-primary");
      if (d.primary || d.error || d.processing) pb.style.display = "none";
      else pb.onclick = () => setActiveResume(d.id);
    }
    list.append(el);
  }
  if (kind === "resume") renderResumeNotice(items);
}
// One banner above the list: what the last sweep removed, and anything due to go in the next few days.
function renderResumeNotice(items) {
  const box = $("resumeNotice"); if (!box) return;
  const soon = items.filter(d => !d.processing && !d.error).map(d => ({ d, left: resumeDaysLeft(d) }))
    .filter(x => x.left !== null && x.left <= RESUME_WARN_DAYS).sort((a, b) => a.left - b.left);
  const lines = [];
  if (justRemovedResumes.length) { lines.push(`Auto-removed after ${RESUME_TTL_DAYS} days: ${justRemovedResumes.join(", ")}.`); justRemovedResumes = []; }
  if (soon.length) lines.push(`Auto-removes soon — ${soon.map(x => `${x.d.name} (${x.left <= 0 ? "today" : x.left + (x.left === 1 ? " day" : " days")})`).join(", ")}. Re-upload to reset the 15 days.`);
  box.textContent = lines.join(" ");
  box.classList.toggle("hidden", !lines.length);
}
function setActiveResume(id) { docsSet(docsGet().map(d => d.kind === "resume" ? { ...d, primary: d.id === id } : d)); renderSection("resume"); }
function deleteDoc(id, kind) { docsSet(docsGet().filter(d => d.id !== id)); selectedDocIds.delete(id); if (selectedResumeId === id) selectedResumeId = ""; FileDB.del(id); renderSection(kind || "doc"); }

/* ---- view (on-screen) + download ---- */
async function downloadDoc(d) {
  const blob = (await FileDB.get(d.id)) || new Blob([d.text || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = d.name || "document"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
let _pvUrl = null;
async function viewDoc(d) {
  const body = $("pvBody"); $("pvTitle").textContent = d.name; body.innerHTML = "";
  if (_pvUrl) { URL.revokeObjectURL(_pvUrl); _pvUrl = null; }
  const blob = await FileDB.get(d.id);
  const name = (d.name || "").toLowerCase();
  const mime = (blob && blob.type) || d.mime || "";
  if (blob && (name.endsWith(".pdf") || mime === "application/pdf")) {
    _pvUrl = URL.createObjectURL(blob);
    const f = document.createElement("iframe"); f.src = _pvUrl; body.append(f);
  } else if (blob && mime.startsWith("image/")) {
    _pvUrl = URL.createObjectURL(blob);
    const im = document.createElement("img"); im.src = _pvUrl; body.append(im);
  } else {
    const pre = document.createElement("pre"); pre.textContent = d.text || "(no extractable text — use Download to open the original)"; body.append(pre);
  }
  $("pvDownload").onclick = () => downloadDoc(d);
  $("previewModal").classList.remove("hidden");
}
function closePreview() { $("previewModal").classList.add("hidden"); if (_pvUrl) { URL.revokeObjectURL(_pvUrl); _pvUrl = null; } $("pvBody").innerHTML = ""; }
$("pvClose").onclick = closePreview;
$("previewModal").addEventListener("click", (e) => { if (e.target.id === "previewModal") closePreview(); });

/* ---- dropzones ---- */
function wireZone(dzId, inputId, browseId, kind) {
  const dz = $(dzId), input = $(inputId); if (!dz) return;
  $(browseId).onclick = (e) => { e.stopPropagation(); input.click(); };
  dz.onclick = () => input.click();
  input.onchange = () => { handleFiles(input.files, kind); input.value = ""; };
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", e => { if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files, kind); });
}
wireZone("resumeDropzone", "resumeFileInput", "resumeBrowseBtn", "resume");
wireZone("dropzone", "fileInput", "browseBtn", "doc");

/* ---- nav ---- */
let docsReturn = "dashboard";
function openResume(from) { docsReturn = from || "dashboard"; $("resumeBackBtn").classList.toggle("hidden", docsReturn !== "wizard"); pruneExpiredResumes(); renderSection("resume"); show("resume"); }
function openDocuments(from) { docsReturn = from || "dashboard"; $("docsBackBtn").classList.toggle("hidden", docsReturn !== "wizard"); renderSection("doc"); show("documents"); }
$("resumeNavBtn").onclick = () => openResume("dashboard");
$("docsNavBtn").onclick = () => openDocuments("dashboard");
$("resumeBackBtn").onclick = backFromMaterials;
$("docsBackBtn").onclick = backFromMaterials;
function backFromMaterials() { if (docsReturn === "wizard") { renderResumeSelect(); renderDocPicker(); show("wizard"); saveWizardDraft(); } else openDashboard(); }

/* ---- wizard: resume select (①) + attached-documents picker (③) ---- */
function renderResumeSelect() {
  const sel = $("resumeSelect"); if (!sel) return;
  const docs = docsGet().filter(d => d.kind === "resume" && d.text && !d.error);
  sel.innerHTML = `<option value="">Choose a resume</option>`;
  for (const d of docs) { const o = document.createElement("option"); o.value = d.id; o.textContent = d.name + (d.primary ? " (active)" : ""); sel.append(o); }
  sel.value = selectedResumeId || "";
  sel.onchange = () => { selectedResumeId = sel.value; };
}
function renderDocPicker() {
  const box = $("docPicker"); if (!box) return;
  const docs = docsGet().filter(d => (d.kind || "doc") === "doc" && d.text && !d.error);
  box.innerHTML = "";
  $("pickBulk")?.classList.toggle("hidden", docs.length < 2);
  if (!docs.length) return;
  for (const d of docs) {
    const row = document.createElement("label");
    row.className = "doc-pick" + (selectedDocIds.has(d.id) ? " on" : "");
    row.innerHTML = `<input type="checkbox" ${selectedDocIds.has(d.id) ? "checked" : ""}/><span class="dp-name"></span><span class="dp-meta"></span>`;
    row.querySelector(".dp-name").textContent = d.name;
    row.querySelector(".dp-meta").textContent = (d.chars || 0).toLocaleString() + " chars";
    const cb = row.querySelector("input");
    cb.onchange = () => { cb.checked ? selectedDocIds.add(d.id) : selectedDocIds.delete(d.id); row.classList.toggle("on", cb.checked); };
    box.append(row);
  }
}
$("pickAll").onclick = () => { docsGet().filter(d => (d.kind || "doc") === "doc" && d.text && !d.error).forEach(d => selectedDocIds.add(d.id)); renderDocPicker(); saveWizardDraft(); };
$("pickClear").onclick = () => { selectedDocIds.clear(); renderDocPicker(); saveWizardDraft(); };
$("pickUpload").onclick = () => openDocuments("wizard");
$("resumeUpload").onclick = () => openResume("wizard");
const RESUME_MAX = 40000;
function resolveResumeText() {
  const pasted = $("resume").value.trim();
  // The whole resume (the server fits it to each question). 12,000 cut off every role before the current one.
  if (pasted) return pasted.slice(0, RESUME_MAX);
  const d = docsGet().find(x => x.id === selectedResumeId);
  return d ? (d.text || "").slice(0, RESUME_MAX) : "";
}
function resolveDocumentsText() {
  const picked = docsGet().filter(d => selectedDocIds.has(d.id) && (d.kind || "doc") === "doc");
  return picked.map(d => `--- ${d.name} ---\n${d.text}`).join("\n\n").slice(0, 16000);
}

/* --------------------------------- boot ----------------------------------- */
// The verified Supabase account, never the local demo email, owns cloud sessions.
accountSessionSync = window.KompasSessionCloud?.create({
  storage: localStorage,
  fetcher: (url, opts) => fetch(url, opts),
  authToken: () => supabaseAccessToken(),
  read: () => LS.get("sessions", []),
  write: rows => LS.set("sessions", rows),
  render: () => {
    sessions = LS.get("sessions", []);
    if (!$("view-dashboard").classList.contains("hidden")) { renderSessions(); renderGetStarted(); }
    if (!$("view-transcripts").classList.contains("hidden")) openTranscripts();
  },
  notify: state => {
    const banner = $("cloudSyncStatus"), importBtn = $("importLocalSessions");
    if (!banner) return;
    if (state.state === "synced") {
      banner.textContent = state.legacy ? state.legacy + " earlier sessions are on this device only. Import them once into this signed-in account to make them available everywhere." : "Sessions synchronized across your signed-in devices.";
      if (cloudArchive) void cloudArchive.replay();
    } else if (state.state === "importing") {
      banner.textContent = "Importing your earlier sessions and verifying they are saved to this account…";
    } else if (state.state === "import-failed") {
      banner.textContent = state.message;
    } else { banner.textContent = state.message || "Offline: local sessions will sync on reconnect."; }
    if (importBtn) {
      importBtn.classList.toggle("hidden", !state.legacy);
      importBtn.disabled = state.state === "importing";
      importBtn.textContent = state.state === "importing" ? "Importing…" : "Import local sessions";
    }
    banner.classList.remove("hidden");
  },
});
$("importLocalSessions")?.addEventListener("click", async () => {
  const prior = (() => { try { return JSON.parse(localStorage.getItem("perfact.cloud.legacy") || "[]"); } catch { return []; } })();
  if (await accountSessionSync?.importLegacy()) {
    for (const s of prior) {
      for (const t of (s.transcripts || [])) if (t.key) cloudArchive?.queue(t.key);
      if (s.id) cloudArchive?.queue(liveKey(s.id));
    }
    void accountSessionSync.refresh();
  }
});
if (!LS.get("user")) LS.set("user", { email: "you@perfact.app" });
pruneExpiredResumes();           // a resume past its 15 days is removed on launch, even if the Resume view is never opened
openDashboard();
accountSessionSync?.start();

/* ---- live screen: one clean row; secondary tools live in the ⋯ menu ---- */
(() => {
  const btn = $("moreBtn"), menu = $("moreMenu");
  const close = () => { menu.classList.add("hidden"); btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = (e) => { e.stopPropagation(); const open = menu.classList.toggle("hidden") === false; btn.setAttribute("aria-expanded", String(open)); };
  menu.addEventListener("click", (e) => { if (e.target.closest("button.mi")) close(); });   // depth steps keep it open
  document.addEventListener("click", (e) => { if (!e.target.closest(".more-wrap")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // first time in the copilot: one line on how it works, until dismissed
  $("copilotTip").classList.toggle("hidden", !!LS.get("tipSeen", false));
  $("tipClose").onclick = () => { LS.set("tipSeen", true); $("copilotTip").classList.add("hidden"); };
  $("phoneTipClose").onclick = () => { $("phoneTip").classList.add("hidden"); };
  $("startBtn").addEventListener("click", () => LS.set("started", true));
})();

/* ---- Connect card (shown before listening): where the call is decides what to pick in the share dialog ---- */
const CONNECT_STEPS = {
  web: ["Press <b>Connect &amp; start</b> and allow the microphone.", "In the share window pick the <b>tab</b> with your meeting and switch on <b>Share tab audio</b>.", "When they finish a question, press <b>AI Answer</b>."],
  desktop: ["Press <b>Connect &amp; start</b>. The Kompas app on this computer opens this session.", "Allow the microphone there. The speaker control hears the call.", "When they finish a question, press <b>AI Answer</b>."],
  phone: ["Put the phone on <b>speaker</b> near your computer.", "Press <b>Connect &amp; start</b> and allow the microphone. Kompas hears both of you through it.", "When they finish a question, press <b>AI Answer</b>."],
};
function renderConnect(s) {
  const desktop = !!window.kompasDesktop;
  const app = desktop ? "desktop" : LS.get("connectApp", "web");
  document.querySelectorAll(".cn-app").forEach(b => b.classList.toggle("on", b.dataset.app === app));
  // The desktop exe is already the decision: microphone plus the output mix. No Browser / Desktop app / Phone choice.
  const steps = NO_SYS_AUDIO
    ? ["Play the call through your <b>speakers</b>, not headphones, so the microphone hears the interviewer.", "Press <b>Connect &amp; start</b>. Kompas listens through your microphone.", "When they finish a question, press <b>AI Answer</b> (Ctrl+Enter while Kompas is focused)."]
    : desktop
      ? ["Press <b>Connect &amp; start</b> and allow the microphone.", "Leave the speaker control on. Kompas hears whatever the computer is playing — the call, a video, a browser tab — as the interviewer.", "When they finish a question, press <b>AI Answer</b> (Ctrl+Enter while Kompas is focused)."]
      : CONNECT_STEPS[app];
  $("cnSteps").innerHTML = steps.map(t => `<li>${t}</li>`).join("");
  $("cnApps").classList.toggle("hidden", desktop || NO_SYS_AUDIO);
  document.querySelector(".cn-label")?.classList.toggle("hidden", desktop || NO_SYS_AUDIO);
  $("cnDesk")?.classList.toggle("hidden", desktop || app !== "desktop");
  $("cnDeskMiss")?.classList.add("hidden");
  const note = document.querySelector(".cn-note");
  if (note && window.kompasDesktop) window.kompasDesktop.getPrivate().then(on => {
    note.textContent = on ? "Private is on. Only you can see Kompas." : "Private is off.";
  });
  if (s) {
    $("cnType").textContent = s.type === "mock" ? "mock practice" : "interview";
    $("cnRole").textContent = s.role || "this role";
    $("cnAt").textContent = s.company ? " at " + s.company : "";
  }
  $("connectPanel").classList.remove("hidden");
  $("copilotTip").classList.add("hidden");
}
document.querySelectorAll(".cn-app").forEach(b => b.onclick = () => {
  LS.set("connectApp", b.dataset.app);
  renderConnect();
  // Prepare the short-lived handoff while the user selects Desktop, so
  // Connect & start can navigate within the next direct click gesture.
  if (b.dataset.app === "desktop" && !window.kompasDesktop && current) void prepareDesktopSession(current).catch(() => {});
});
// The desktop app runs in its own Electron process and never sees the browser's
// cookies, so its API calls 401. Pass the Supabase access token (a JWT) along with
// the session handoff; the desktop injects it as Authorization: Bearer on its
// proxied /api/* requests, which the server accepts via createClientFromRequest.
function supabaseSession() {
  try {
    const jar = {};
    String(document.cookie || "").split(";").forEach(c => {
      const i = c.indexOf("=");
      if (i > 0) jar[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
    });
    // @supabase/ssr persists the session in cookies as base64-<base64url(JSON)>,
    // chunked as sb-<ref>-auth-token.0, .1, ... when large.
    const chunks = Object.keys(jar).filter(k => /^sb-[A-Za-z0-9]+-auth-token\.\d+$/.test(k))
      .sort((a, b) => parseInt(a.split(".").pop(), 10) - parseInt(b.split(".").pop(), 10));
    const single = Object.keys(jar).find(k => /^sb-[A-Za-z0-9]+-auth-token$/.test(k));
    let raw = chunks.length ? chunks.map(k => jar[k]).join("") : (single ? jar[single] : "");
    if (raw.startsWith("base64-")) raw = raw.slice(7);
    let json = raw;
    if (!/^\s*\{/.test(raw)) {
      json = decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    }
    const sess = JSON.parse(json);
    if (sess && sess.access_token) return sess;
  } catch (e) {}
  try {
    // Fallback: older supabase-js persisted plain JSON in localStorage.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-[A-Za-z0-9]+-auth-token$/.test(k || "")) {
        const sess = JSON.parse(localStorage.getItem(k));
        if (sess && sess.access_token) return sess;
      }
    }
  } catch (e) {}
  return null;
}
function supabaseAccessToken() {
  const sess = supabaseSession();
  return (sess && sess.access_token) || "";
}
function packSession(s) {
  const slim = {
    id: s.id, type: s.type || "live", role: s.role || "", company: s.company || "",
    jd: String(s.jd || "").slice(0, 6000), resume: String(s.resume || "").slice(0, 8000),
    documents: String(s.documents || "").slice(0, 2000), instructions: s.instructions || "",
    language: s.language || "en", interviewer: s.interviewer || "engineer", difficulty: s.difficulty || "standard",
    tone: s.tone || "professional", mode: s.mode || "technical", length: s.length || "balanced",
    autoAnswer: !!s.autoAnswer, autoMode: s.autoMode === true, saveTranscript: s.saveTranscript !== false,
    createdAt: s.createdAt || Date.now(),
    token: supabaseAccessToken(), // handed to the desktop app so its API calls are authenticated
    // The refresh token + expiry ride along so the desktop can renew the
    // access token itself instead of pinning a JWT that dies after an hour.
    refreshToken: (supabaseSession() || {}).refresh_token || "",
    tokenExp: (supabaseSession() || {}).expires_at || 0,
    // The same native Kompas shell opens the MarketFit session in MarketFit, not the standalone perfACT site.
    site: (location.pathname === "/kompas" || location.pathname.startsWith("/kompas/") || location.pathname.startsWith("/dashboard/kompas")) ? "marketfit" : "perfact",
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(slim)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return (slim.site === "marketfit" ? "marketfit-kompas://open?d=" : "kompas://open?d=") + b64;
}
// External-protocol URLs longer than ~2 KB can be silently discarded by Chrome
// on Windows. A full resume/JD plus session credentials is routinely much longer.
// Keep those details on the authenticated MarketFit HTTPS route instead.
let desktopTicketCache = null;
let desktopTicketPending = null;
function prepareDesktopSession(s) {
  if (!s || !s.id) return Promise.reject(new Error("Choose an interview session first."));
  if (desktopTicketCache && desktopTicketCache.id === s.id && Date.now() < desktopTicketCache.until) {
    return Promise.resolve(desktopTicketCache.ticket);
  }
  if (desktopTicketPending && desktopTicketPending.id === s.id) return desktopTicketPending.promise;
  const deepLink = packSession(s);
  if (!deepLink.startsWith("marketfit-kompas://open?d=")) return Promise.reject(new Error("Not a MarketFit session."));
  // Decode only in memory; NEVER navigate to this long URL or log it.
  const encoded = deepLink.slice("marketfit-kompas://open?d=".length);
  const session = JSON.parse(decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")))));
  // The legacy URI encoder truncated long resumes/JDs to fit command lines.
  // HTTPS ticket transport has no reason to silently discard saved content.
  for (const field of ["resume", "jd", "documents", "instructions"]) {
    if (typeof s[field] === "string") session[field] = s[field];
  }
  const pending = { id: s.id, promise: null };
  pending.promise = fetch("/api/kompas/desktop-handoff", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session }),
    cache: "no-store",
  }).then(async response => {
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !data.ok || !/^[A-Za-z0-9_-]{43}$/.test(data.ticket || "")) {
      throw new Error(data && data.error || "Could not securely connect the desktop. Your session is still saved.");
    }
    desktopTicketCache = { id: s.id, ticket: data.ticket, until: Date.now() + 90_000 };
    return data.ticket;
  }).finally(() => { if (desktopTicketPending === pending) desktopTicketPending = null; });
  desktopTicketPending = pending;
  return pending.promise;
}
function launchInstalled(s) {
  const status = $("cnDeskMiss");
  if (!s || !s.id) {
    if (status) { status.textContent = "Choose an interview session first. "; status.classList.remove("hidden"); }
    return;
  }
  $("cnDesk")?.classList.remove("hidden");
  function openWithTicket(ticket) {
    const url = "marketfit-kompas://open?ticket=" + ticket;
    if (status) {
      status.textContent = "If Windows prompts, choose Open Kompas. If nothing opens, ";
      const retry = document.createElement("a");
      // The first protocol navigation may have already redeemed this single-use
      // ticket. Never offer that spent ticket as a retry link.
      retry.href = "#";
      retry.textContent = "prepare a new secure connection link";
      retry.onclick = event => {
        event.preventDefault();
        desktopTicketCache = null;
        retry.textContent = "Preparing a fresh ticket…";
        prepareDesktopSession(s).then(fresh => {
          retry.href = "marketfit-kompas://open?ticket=" + fresh;
          retry.textContent = "click here to open this session";
          // The next real click directly opens Windows, preserving the browser gesture.
          retry.onclick = () => { desktopTicketCache = null; };
        }).catch(e => {
          retry.textContent = String(e && e.message || "Could not prepare a new link.");
        });
      };
      retry.style.textDecoration = "underline";
      status.appendChild(retry);
      status.appendChild(document.createTextNode(". "));
      status.classList.remove("hidden");
    }
    // This ticket can be redeemed only once. After we have attempted the
    // protocol launch, another Connect action must issue a new ticket.
    desktopTicketCache = null;
    window.location.assign(url);
  }
  // A prepared ticket means the protocol navigation runs synchronously in
  // the user gesture. If preparation was still pending, also expose a real
  // clickable link after the request completes (Chrome gesture fallback).
  if (desktopTicketCache && desktopTicketCache.id === s.id && Date.now() < desktopTicketCache.until) {
    openWithTicket(desktopTicketCache.ticket);
    return;
  }
  if (status) {
    status.textContent = "Securely connecting your saved interview… ";
    status.classList.remove("hidden");
  }
  prepareDesktopSession(s).then(openWithTicket).catch(e => {
    if (status) {
      status.textContent = String(e && e.message || "Could not connect. Please retry.");
      status.classList.remove("hidden");
    }
  });
}
let lastDesktopHandoff = { id: "", at: 0 };
async function openHandedSession(s) {
  if (!s || !s.id || !window.kompasDesktop) return;
  // takeSession() and onSession() can race during first load. Treat one
  // delivery as one start, not two capture restarts.
  const now = Date.now();
  if (lastDesktopHandoff.id === s.id && now - lastDesktopHandoff.at < 3000) return;
  lastDesktopHandoff = { id: s.id, at: now };
  // Verify the signed-in account before writing a newly handed-off interview.
  // The desktop can receive it while its account session list is still loading.
  if (accountSessionSync) await accountSessionSync.refresh();
  const all = LS.get("sessions", []);
  // Handoff auth credentials belong to Electron's protected token store. The
  // account session cache must never persist a bearer/refresh token.
  const incoming = { ...s };
  for (const key of ["token", "refreshToken", "tokenExp", "access_token", "refresh_token"]) delete incoming[key];
  const index = all.findIndex(x => x.id === incoming.id);
  if (index < 0) all.unshift(incoming);
  else {
    // Reopening a known session must carry over the latest resume, JD and
    // personal instructions from the sending browser, not keep a stale
    // snapshot from a previous Windows launch. Preserve richer local history.
    const previous = { ...all[index] };
    for (const key of ["token", "refreshToken", "tokenExp", "access_token", "refresh_token"]) delete previous[key];
    const combined = { ...previous, ...incoming };
    // Each saved run has its own key. Include runs from both devices rather
    // than picking one whole transcript list by length (equal-length lists can
    // contain distinct runs). Keep the existing twenty-run retention rule.
    if (Array.isArray(previous.transcripts) || Array.isArray(incoming.transcripts)) {
      const byKey = new Map();
      for (const entry of [...(previous.transcripts || []), ...(incoming.transcripts || [])])
        if (entry && typeof entry.key === "string") byKey.set(entry.key, entry);
      combined.transcripts = [...byKey.values()]
        .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)).slice(-20);
    }
    // A delayed browser handoff must not revive an interview already ended
    // on this device or discard its lifecycle metadata.
    for (const key of ["runAt", "pausedAt", "endedAt", "endedBy"])
      if (previous[key] !== undefined && incoming[key] === undefined) combined[key] = previous[key];
    all[index] = combined;
  }
  LS.set("sessions", all);
  sessions = all;
  launchCopilot(index < 0 ? incoming : all[index]);
  $("connectPanel").classList.add("hidden");
  if (!$("startBtn").classList.contains("on")) $("startBtn").click();
}
window.kompasDesktop?.takeSession?.().then(s => { if (s) openHandedSession(s); });
window.kompasDesktop?.onSession?.(openHandedSession);
// Caption capture subscription: automatic, no toggle — when the desktop
// build offers a caption channel, every box update flows into onCaptionText.
// The guard keeps a session restart from subscribing twice (double ingest).
if (typeof window.kompasDesktop?.onCaption === "function" && !captionSubscribed) { captionSubscribed = true; window.kompasDesktop.onCaption((t) => onCaptionText(t)); }
window.__kompasCaption = onCaptionText;
$("cnStart").onclick = () => {
  const app = window.kompasDesktop ? "desktop" : LS.get("connectApp", "web");
  if (!window.kompasDesktop && app === "desktop") { launchInstalled(current); return; }
  srcOn.mic = true; srcOn.sys = window.kompasDesktop ? !NO_SYS_AUDIO : app !== "phone" && !NO_SYS_AUDIO; syncSrc();
  $("startBtn").click();
};
$("startBtn").addEventListener("click", () => {
  $("connectPanel").classList.add("hidden");
  $("copilotTip").classList.toggle("hidden", !!LS.get("tipSeen", false));   // the one-line tip follows the connect card, never beside it
});

$("cnClose").onclick = () => $("connectPanel").classList.add("hidden");
$("cnExit").onclick = () => { $("connectPanel").classList.add("hidden"); $("exitCopilot").click(); };
$("connectPanel").addEventListener("click", (e) => { if (e.target.id === "connectPanel") $("connectPanel").classList.add("hidden"); });   // click outside closes
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("connectPanel").classList.add("hidden"); });
/* wizard: pasting resume text is the exception, so its box opens only when asked for */
$("resumePasteToggle").onclick = () => { const t = $("resume"); t.classList.toggle("hidden"); if (!t.classList.contains("hidden")) t.focus(); };
