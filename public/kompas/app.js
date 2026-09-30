"use strict";
/* Kompas — single-page app: Login → Dashboard → Create-Session wizard → Copilot.
   The copilot listens to mic + computer audio, transcribes (Groq Whisper) and
   answers in text (Claude), using the session's company/JD/resume/preferences as
   context — the same context idea as the resume feature. Audio + answers sit
   behind seams so the UI works even with no backend. */

const $ = (id) => document.getElementById(id);

/* ---- self-update: a tab left open across a deploy reloads itself (never mid-answer) ----
   The deploy stamps window.PERFACT_BUILD into index.html and writes /version.json. */
const BUILD = window.PERFACT_BUILD || "dev";
async function checkForUpdate() {
  if (BUILD === "dev" || location.protocol === "file:") return;
  try {
    const v = await (await fetch("/version.json?t=" + Date.now(), { cache: "no-store" })).json();
    if (!v || !v.build || v.build === BUILD) return;
    // In the live copilot a reload would drop the mic/screen share and the answers on screen:
    // offer it instead. Anywhere else, just reload.
    const live = $("view-copilot") && !$("view-copilot").classList.contains("hidden");
    if (!live) return location.reload();
    if ($("updatePill")) return;
    const b = document.createElement("button");
    b.id = "updatePill"; b.className = "update-pill"; b.textContent = "⟳ Update ready — reload";
    b.title = "A new version of Kompas is live. Reloading stops listening; your session settings are kept.";
    b.onclick = () => location.reload();
    document.body.append(b);
  } catch {}
}
setInterval(checkForUpdate, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(); });

const LS = {
  get(k, d) { try { const v = localStorage.getItem("perfact." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("perfact." + k, JSON.stringify(v)); } catch {} },
};

/* ------------------------------- router ---------------------------------- */
const VIEWS = ["login", "dashboard", "transcripts", "resume", "documents", "wizard", "copilot"];
const SIDE_VIEWS = ["dashboard", "transcripts", "resume", "documents"];   // pages framed by the sidebar
function show(name) {
  for (const v of VIEWS) $("view-" + v)?.classList.toggle("hidden", v !== name);
  $("sideNav")?.classList.toggle("hidden", !SIDE_VIEWS.includes(name));
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
$("logoutBtn").onclick = () => { LS.set("user", null); show("login"); };

/* ------------------------------ dashboard --------------------------------- */
function openDashboard() {
  sessions = LS.get("sessions", []);
  renderSessions();
  renderGetStarted();
  show("dashboard");
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
  const withTx = sessions.filter(s => (s.transcripts || []).length).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("txEmpty").classList.toggle("hidden", withTx.length > 0);
  for (const s of withTx) {
    const row = document.createElement("div");
    row.className = "doc-item";
    row.innerHTML = `<div class="doc-ico">☰</div><div class="doc-main"><div class="doc-name"></div><div class="doc-meta"></div></div><div class="doc-actions"><button class="btn">Open</button></div>`;
    row.querySelector(".doc-name").textContent = (s.role || "Untitled role") + (s.company ? " · " + s.company : "");
    const n = s.transcripts.length;
    row.querySelector(".doc-meta").textContent = new Date(s.createdAt).toLocaleDateString() + " · " + n + (n > 1 ? " runs" : " run");
    row.querySelector(".btn").onclick = () => viewTranscripts(s);
    list.append(row);
  }
  show("transcripts");
}
function renderSessions() {
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
      <div class="sc-actions">
        <button class="btn primary sc-start">Start</button>
        <button class="btn ghost sc-tx hidden">Transcript</button>
        <button class="btn ghost sc-del">Delete</button>
      </div>`;
    card.querySelector(".sc-role").textContent = s.role || "Untitled role";
    card.querySelector(".sc-co").textContent = s.company || (s.type === "mock" ? "Mock practice" : "Live interview");
    card.querySelector(".sc-meta").textContent = new Date(s.createdAt).toLocaleString() + " · " + (s.interviewer || "engineer").replace("_", " ") + " · " + (s.difficulty || "standard");
    card.querySelector(".sc-start").onclick = () => launchCopilot(s);
    const tx = card.querySelector(".sc-tx"), nTx = (s.transcripts || []).length;
    if (nTx) { tx.classList.remove("hidden"); tx.textContent = nTx > 1 ? `Transcripts (${nTx})` : "Transcript"; tx.onclick = () => viewTranscripts(s); }
    card.querySelector(".sc-del").onclick = () => { sessions = sessions.filter(x => x.id !== s.id); LS.set("sessions", sessions); renderSessions(); };
    list.append(card);
  }
}
$("newSessionBtn").onclick = openWizard;
$("newSessionBtn2").onclick = openWizard;

/* -------------------------------- wizard ---------------------------------- */
let step = 0;
let draft = null;
function openWizard() {
  draft = { type: "live", length: "balanced", tone: "professional", model: "claude-haiku-4-5", language: "en", autoAnswer: false, saveTranscript: true };
  step = 0;
  // reset fields
  ["jobLink", "company", "role", "jd", "resume", "instructions"].forEach(id => { if ($(id)) $(id).value = ""; });
  $("resume")?.classList.add("hidden");                         // paste box stays folded until asked for
  document.querySelectorAll(".choice").forEach(c => c.classList.toggle("on", c.dataset.type === "live"));
  segSet("lengthSeg", "balanced"); segSet("toneSeg", "professional"); segSet("modeSeg", "technical");
  $("model").value = draft.model; $("autoAnswer").checked = false; $("saveTranscript").checked = true;
  if ($("interviewerSelect")) $("interviewerSelect").value = "engineer";
  if ($("difficultySelect")) $("difficultySelect").value = "standard";
  if ($("dossierSize")) $("dossierSize").value = "auto";
  selectedResumeId = (docsGet().find(d => d.kind === "resume" && d.primary && d.text)
                    || docsGet().find(d => d.kind === "resume" && d.text) || {}).id || "";
  selectedDocIds = new Set();
  renderResumeSelect();
  renderDocPicker();
  gotoStep(0);
  show("wizard");
}
function gotoStep(n) {
  step = Math.max(0, Math.min(2, n));
  document.querySelectorAll(".wiz-pane").forEach(p => p.classList.toggle("hidden", +p.dataset.pane !== step));
  document.querySelectorAll(".wiz-step").forEach(s => s.classList.toggle("on", +s.dataset.step <= step));
  $("wizBack").textContent = step === 0 ? "Cancel" : "Back";
  $("wizNext").textContent = step === 2 ? "Create & Start" : "Next";
}
$("wizClose").onclick = openDashboard;
$("wizBack").onclick = () => { if (step === 0) openDashboard(); else gotoStep(step - 1); };
$("wizNext").onclick = () => { if (step < 2) gotoStep(step + 1); else finishWizard(); };
document.querySelectorAll(".choice").forEach(c => c.onclick = () => {
  document.querySelectorAll(".choice").forEach(x => x.classList.remove("on"));
  c.classList.add("on"); draft.type = c.dataset.type;
});
function segSet(id, val) { const box = $(id); if (!box) return; [...box.children].forEach(b => b.classList.toggle("on", b.dataset.v === val)); }
["lengthSeg", "toneSeg", "modeSeg"].forEach(id => { const box = $(id); if (box) box.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; [...box.children].forEach(x => x.classList.remove("on")); b.classList.add("on"); draft[{ lengthSeg: "length", toneSeg: "tone", modeSeg: "mode" }[id]] = b.dataset.v;
  // the interview type suggests who is asking: Behavioural -> Technical HR, Technical -> Engineer, Coding -> Developer
  if (id === "modeSeg" && $("interviewerSelect")) { const who = { behavioural: "technical_hr", technical: "engineer", coding: "developer", final: "architect" }[b.dataset.v]; if (who) $("interviewerSelect").value = who; } }; });

function finishWizard() {
  const s = {
    id: "s" + Date.now(),
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
    instructions: $("instructions").value.trim(),
    autoAnswer: $("autoAnswer").checked,
    autoMode: $("autoAnswer").checked,
    saveTranscript: $("saveTranscript").checked,
    interviewer: ($("interviewerSelect") || {}).value || "engineer",
    difficulty: ($("difficultySelect") || {}).value || "standard",
    dossierSize: ($("dossierSize") || {}).value || "auto",
  };
  sessions.unshift(s);
  LS.set("sessions", sessions);
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
// The whole session in order — every line heard, every question typed, every answer (and each
// regeneration) — for Get transcript. Clear doesn't touch it; a reload mid-interview picks it back up.
let sessionLog = [];
let logSaveT = 0;
function logEvent(ev) {
  sessionLog.push({ at: Date.now(), ...ev }); if (sessionLog.length > 4000) sessionLog.shift();
  clearTimeout(logSaveT); logSaveT = setTimeout(() => { if (current && current.id) { try { localStorage.setItem("perfact.log." + current.id, JSON.stringify(sessionLog)); } catch {} } }, 800);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function cfgOf(s) { return { company: s.company, role: s.role, jd: s.jd, resume: s.resume, documents: s.documents, instructions: s.instructions, language: s.language }; }
function liveConfig() {
  const s = current || {};
  const who = ($("liveInterviewer") && $("liveInterviewer").value) || s.interviewer || "engineer";
  return { ...cfgOf(s), length: "long", tone: s.tone, mode: s.mode || "technical", interviewer: who, difficulty: s.difficulty || "standard" };
}
function saveSession(s) {
  const all = LS.get("sessions", []); const i = all.findIndex(x => x.id === s.id);
  if (i >= 0) { all[i] = { ...all[i], ...s }; LS.set("sessions", all); sessions = all; }
}

function launchCopilot(s) {
  current = s;
  if (s.resumeId) {                        // a session saved before the 12,000-character cut was lifted: take the full resume
    const d = docsGet().find(x => x.id === s.resumeId);
    if (d && d.text && d.text.length > (s.resume || "").length) { s.resume = d.text.slice(0, RESUME_MAX); saveSession(s); }
  }
  transcript = []; ledger = null;
  sessionLog = [];
  try {                                  // same session reopened within 3 hours (e.g. the update reload): keep its log
    const prev = JSON.parse(localStorage.getItem("perfact.log." + s.id) || "[]");
    if (Array.isArray(prev) && prev.length && Date.now() - prev[prev.length - 1].at < 3 * 3600e3) sessionLog = prev;
  } catch {}
  cards = [{ question: "Preparing…", answer: ["Forming your identity and persona from the four factors…"] }];
  idx = 0;
  $("ovTitle").textContent = "Kompas";
  if ($("liveInterviewer")) $("liveInterviewer").value = s.interviewer || "engineer";
  renderDepth();
  resetLiveState();
  setAuto(s.autoMode === true);          // default OFF: nothing answers until you press AI Answer
  setPersonaChip(s);
  renderConnect(s);                      // Parakeet-style connect step before listening
  renderDrawer();
  renderCard();
  show("copilot");
  preparePack(s);
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
  const key = s.id + ":book";
  let saved = await DossierDB.get(key);
  if (!(saved && saved.items && saved.items.length)) {                // same factors + interviewer: reuse that book
    const twin = twinSession(s, x => (x.interviewer || "engineer") === (s.interviewer || "engineer"));
    const theirs = twin && await DossierDB.get(twin.id + ":book");
    if (theirs && theirs.items && theirs.items.length) { saved = { ...theirs }; await DossierDB.put(key, saved); }
  }
  book = { sid: s.id, items: (saved && saved.items) || [] };
  const qs = ["Tell me about yourself."].concat(((s.prep && s.prep.questions) || []).map(q => q.q).filter(Boolean)).slice(0, BOOK_MAX);
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
async function preparePack(s) {
  if (location.protocol === "file:") { seedIdentity(s); status("Serve the deployed app for live prep + answers.", "live"); return; }
  if (s.prep && s.prep.v !== 2) { s.prep = null; saveSession(s); }   // pre-v2 prep had [blank]s: rebuild it
  if (!s.prep) { const twin = twinSession(s, x => x.prep && x.prep.v === 2); if (twin) { s.prep = twin.prep; saveSession(s); status("Prep reused from a session with the same resume, JD and documents — no AI call.", "live"); } }
  if (!s.prep) {
    status("Preparing — forming identity + persona from the four factors…", "live");
    try {
      const res = await fetch("/api/prep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: cfgOf(s) }) });
      const pack = await res.json();
      if (!res.ok || !Array.isArray(pack.questions)) throw new Error(pack.error || ("prep " + res.status));
      s.prep = pack; saveSession(s);
    } catch (e) {
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
  status(`Prepared — ${(s.prep.projects || []).length} projects, ${(s.prep.questions || []).length} core Q&A. Building your dossier in the background…`, "live");
  buildPersonaFile(s).finally(() => { if (current === s) { buildDossier(s); buildBook(s); } });   // persona file first (highest value), then the dossier — both off the clock
}
// Fill the placeholder card with the intro — never wipe answers already on screen (prep can
// finish after the interview has started).
function seedIdentity(s) {
  const id = s.prep && s.prep.identity;
  const intro = { question: "Your introduction", answer: id ? id.split(/(?<=\.)\s+|\n+/).map(x => x.trim()).filter(Boolean) : ["Press Start — answers appear here."] };
  const ph = cards.findIndex(c => /^(Preparing…|Ready)$/.test(c.question));
  if (ph >= 0) cards[ph] = intro;
  else if (!cards.some(c => c.question === "Your introduction")) { cards.unshift(intro); idx++; }
  if (cards.length === 1) idx = 0;
  renderCard();
}
$("exitCopilot").onclick = async () => { if (running) stop(false); await saveRunTranscript(); dossierAbort = true; resetLiveState(); openDashboard(); };
window.addEventListener("pagehide", () => { if (current && !$("view-copilot").classList.contains("hidden")) saveRunTranscript(); });

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
    if (!isPlaceholder(inner)) return m;
    hit = true;
    if (!/\b(you|your)\b/i.test(inner)) return "";
    const t = inner.replace(/\s+(that |which |who )?(you|your)\b.*$/i, "").replace(/^(your|the)\s+/i, "the ").trim();
    return t.split(/\s+/).length >= 2 && !/^(how|what|when|why|where)\b/i.test(t) ? t : "";
  });
  if (!hit) return out;
  return out.replace(/\bby\s*%/g, "significantly").replace(/(^|\s)%/g, "$1")
    .replace(/[,;]\s*([.!?;:])/g, "$1").replace(/ +([,.;:!?])(?=\s|$)/g, "$1").replace(/ {2,}/g, " ");
}
// `__keyword__` = main keyword · *italic* = the word to stress out loud · (pause) = stop and breathe
function inline(li, text) {
  // `__keyword__` is the live emphasis mark (asterisks were stripped or shown raw). `**` still accepted.
  for (const part of unbracket(text).split(/(`[^`\n]{1,120}`|__[^_\n]{1,80}__|\*\*[^*\n]{1,80}\*\*|\*[^*\s][^*\n]{0,80}\*|==[^=\n]{1,80}==|\((?:pause|beat)\))/i)) {
    if (!part) continue;
    let el = null;
    if (/^`[^`]+`$/.test(part)) { el = document.createElement("code"); el.textContent = part.slice(1, -1); }
    else if (/^__[^_].*__$/.test(part) || /^\*\*[^*]+\*\*$/.test(part)) {
      el = document.createElement("strong");
      el.textContent = part.replace(/^__|__$/g, "").replace(/^\*\*|\*\*$/g, "");
    }
    else if (/^==[^=].*==$/.test(part)) { el = document.createElement("strong"); el.textContent = part.slice(2, -2); }
    else if (/^\*[^*]+\*$/.test(part)) { el = document.createElement("em"); el.textContent = part.slice(1, -1); }
    else if (/^\((pause|beat)\)$/i.test(part)) { el = document.createElement("span"); el.className = "pause"; el.textContent = "pause"; }
    li.append(el || document.createTextNode(part));
  }
}
// Passage lines (no bullet) render as prose, "- " lines as bullets, "## " lines as section heads.
function answerLines(answer) {
  if (Array.isArray(answer)) return answer.map(t => ({ t: String(t).trim().replace(/^(?:[-•]|\*(?!\*))\s*/, "").trim(), kind: "bullet" })).filter(x => x.t);
  // ``` fences hold code: kept whole (blank lines and indentation intact), even while still streaming
  const out = []; let code = null, prose = [];
  const flush = () => { if (prose.length) out.push(...proseLines(prose.join("\n"))); prose = []; };
  for (const raw of String(answer || "").split("\n")) {
    if (/^\s*```/.test(raw)) {
      if (code) { out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang }); code = null; }
      else { flush(); code = { lang: raw.replace(/^\s*```/, "").trim(), lines: [] }; }
      continue;
    }
    if (code) code.lines.push(raw); else prose.push(raw);
  }
  flush();
  if (code) out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang });
  return out;
}
function proseLines(text) {
  return String(text || "").replace(/\*{4,}/g, "").replace(/\*\*\s+\*\*/g, " ").split(/\n+/).map(l => l.trim())
    .filter(l => l && !/^(EXPERIENCE|DESIGN|INTRODUCTION|DRILL-DOWN|SIMPLE|CONSOLIDATED)\b[A-Z /&-]*:?$/.test(l) && !/^<[A-Z][^>]*>$/.test(l))   // never show a template label
    .map(l => {
    const h = l.match(/^#{1,3}\s*(.+)$/);
    if (h) return { t: h[1].replace(/\*\*/g, "").replace(/__/g, "").trim(), kind: "head" };
    const b = l.match(/^(?:(?:[-•]|\*(?!\*)|\d+[.)])\s+)+(.*)$/);      // "- - text" too
    if (b) return { t: b[1], kind: "bullet" };
    if (/^\((pause|beat)\)\.?$/i.test(l)) return { t: l, kind: "pauseline" };
    return { t: l, kind: "passage" };
  });
}
function renderCard() {
  const c = cards[idx]; if (!c) return;
  $("question").textContent = c.question;
  $("question").title = c.heard || "";
  // The answer never scrolls itself: it opens on its first line and stays wherever YOU scrolled,
  // even while a long answer streams in below.
  const ul = $("answer"), keep = ul.scrollTop;
  ul.innerHTML = "";
  answerLines(c.answer).forEach(({ t, kind, lang }) => {
    const li = document.createElement("li");
    if (kind === "code") {
      li.className = "codeblock"; const pre = document.createElement("pre"), code = document.createElement("code");
      if (lang) pre.dataset.lang = lang; code.textContent = t; pre.append(code); li.append(pre); ul.append(li); return;
    }
    if (kind === "head") li.className = "qhead";
    else if (kind === "passage") li.className = "passage";
    else if (kind === "pauseline") li.className = "pauseline";
    inline(li, t);
    ul.append(li);
  });
  $("answerMeta").textContent = c.meta || "";
  $("card").classList.toggle("streaming", !!c.streaming);
  wrapWords(ul);                                     // every word is addressable, for Follow along
  ul.scrollTop = keep;
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
const toTop = () => { const ul = $("answer"); if (ul) ul.scrollTop = 0; };   // a different card opens at its start
$("prevBtn").onclick = () => { if (idx > 0) { idx--; renderCard(); toTop(); animateCard(); } };
$("nextBtn").onclick = () => { if (idx < cards.length - 1) { idx++; renderCard(); toTop(); animateCard(); } };
function addCard(question, answer) { const c = { question, answer }; cards.push(c); idx = cards.length - 1; renderCard(); toTop(); animateCard(); return c; }
// Copy / Export give what the screen shows: no placeholders, headings as headings, no markdown noise.
function plainAnswer(answer) {
  return answerLines(answer).map(({ t, kind, lang }) => {
    if (kind === "code") return "```" + (lang || "") + "\n" + t + "\n```";
    const x = unbracket(t).replace(/\*\*/g, "").replace(/__/g, "").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2").replace(/\s*\((pause|beat)\)\s*/gi, " ").trim();
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
// Kompas desktop never captures the computer's sound (no loopback): there, the microphone is the only source.
const NO_SYS_AUDIO = window.kompasDesktop?.systemAudio === false;
const srcOn = { mic: true, sys: !NO_SYS_AUDIO };
if (NO_SYS_AUDIO) { $("sysBtn").classList.add("hidden"); $("screenBtn").classList.add("hidden"); }
function syncSrc() {
  $("micBtn").classList.toggle("on", srcOn.mic); $("sysBtn").classList.toggle("on", srcOn.sys);
  $("micBtn").title = "Microphone (you) — " + (srcOn.mic ? "on" : "off");
  $("sysBtn").title = "Computer audio (interviewer) — " + (srcOn.sys ? "on" : "off");
}
$("micBtn").onclick = async () => { srcOn.mic = !srcOn.mic; syncSrc(); if (running) { if (srcOn.mic) await startMic(); else stopSource("You"); reportSources(); } };
$("sysBtn").onclick = async () => { srcOn.sys = !srcOn.sys; syncSrc(); if (running) { if (srcOn.sys) await startSys(); else stopSource("Them"); reportSources(); } };
syncSrc();
$("themeBtn").onclick = () => $("overlay").classList.toggle("dark");
$("collapseBtn").onclick = () => $("overlay").classList.toggle("collapsed");
$("hideBtn").onclick = () => $("overlay").classList.toggle("collapsed");
$("transcriptBtn").onclick = () => $("drawer").classList.toggle("hidden");
$("personaBtn").onclick = () => openPersonaFile();
$("clearBtn").onclick = () => { cards = [{ question: "Cleared.", answer: ["Ask something, or let the call fill this in."] }]; idx = 0; transcript = []; answeredSeq = heardSeq; updatePending(); renderDrawer(); renderCard(); status("Cleared."); };
// Who is asking = the DEPTH LADDER (owner's order): HR → Technical HR → Analyst → Engineer → Developer
// → Supervisor → Architect → Lead → Director. Pick where the interview starts; each ↓ (arrow key or ▼)
// steps one level deeper — "they weren't loving that depth, go further" — like Claude's effort meter,
// faster → smarter; ↑ steps back to lighter. The answer on screen regenerates for the new level, once,
// after you stop pressing (same question — it isn't re-derived). Peer sits outside the ladder: it mirrors.
const LADDER = ["hr", "technical_hr", "analyst", "engineer", "developer", "supervisor", "architect", "lead", "director"];
function renderDepth() {
  const box = $("depthBars"); if (!box) return;
  const who = $("liveInterviewer").value, i = LADDER.indexOf(who);
  if (!box.children.length) LADDER.forEach((_, k) => { const b = document.createElement("i"); b.style.height = (5 + k * 1.6).toFixed(1) + "px"; box.append(b); });
  [...box.children].forEach((b, k) => b.classList.toggle("on", i >= 0 && k <= i));
  const label = $("liveInterviewer").selectedOptions[0].textContent;
  $("depthMeter").title = i >= 0 ? `Answer depth ${i + 1} of ${LADDER.length}: ${label} — ↑ lighter · ↓ deeper (arrow keys). Each step regenerates the answer.` : "Peer mirrors the interviewer — ↓ steps onto the depth ladder.";
  $("whoUp").disabled = i === 0; $("whoDown").disabled = i === LADDER.length - 1;
}
let regenTimer = null;
function regenerateForAudience() {
  if (typeof logAction === "function") logAction("regen", { to: $("liveInterviewer").value });
  const c = cards[idx], label = $("liveInterviewer").selectedOptions[0].textContent;
  if (!c || /^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(c.question) || !String(c.question).trim()) { status("Now answering for: " + label, "live"); return; }
  status(`Regenerating at ${label} depth…`, "live");
  if (c.heard) generateAnswer(c.heard, c, { consolidated: true, earlier: c.earlier || "", derived: c.question, regen: true });
  else if (/^Your introduction$/.test(c.question)) generateAnswer("Tell me about yourself", c, { regen: true });
  else if (!/^🖥/.test(c.question)) generateAnswer(c.question, c, { regen: true });
}
function audienceChanged(immediate) {
  if (current) { current.interviewer = $("liveInterviewer").value; saveSession(current); }
  renderDepth();
  clearTimeout(regenTimer);
  regenTimer = setTimeout(regenerateForAudience, immediate ? 0 : 450);   // several quick ↓ presses = one regeneration
}
$("liveInterviewer").onchange = () => audienceChanged(false);   // arrows inside the focused dropdown fire per step: debounce those too
function stepInterviewer(dir) {
  const sel = $("liveInterviewer");
  let i = LADDER.indexOf(sel.value);
  if (i < 0) i = dir > 0 ? LADDER.indexOf("engineer") - 1 : LADDER.indexOf("engineer") + 1;   // from Peer, step onto the ladder mid-way
  const next = Math.max(0, Math.min(LADDER.length - 1, i + dir));
  if (LADDER[next] === sel.value) return;
  sel.value = LADDER[next];
  status(`Depth ${next + 1}/${LADDER.length}: ${sel.selectedOptions[0].textContent}${dir > 0 ? " — deeper" : " — lighter"}`, "live");
  audienceChanged(false);
}
$("whoUp").onclick = () => stepInterviewer(-1);
$("whoDown").onclick = () => stepInterviewer(1);
renderDepth();

/* ---- start / stop ---- */
let running = false;
$("startBtn").onclick = () => running ? stop() : start();
async function start() {
  primeAudio();                       // inside the click, so the browser lets audio run
  if (!srcOn.mic && !srcOn.sys) { srcOn.mic = srcOn.sys = true; syncSrc(); }
  running = true;
  $("startBtn").textContent = "Stop"; $("startBtn").classList.add("on");
  document.querySelector(".rec").classList.add("live"); startClock();
  status("Starting capture…", "live");
  captureErrors = [];
  if (srcOn.mic) await startMic();
  if (srcOn.sys) await startSys();
  if (!captures.length) { status(captureErrors.join(" · ") || "Nothing to capture.", "err"); stop(false); return; }
  reportSources();
}
function stop(say = true) {
  running = false;
  $("startBtn").textContent = "Start"; $("startBtn").classList.remove("on");
  document.querySelector(".rec").classList.remove("live"); stopClock();
  for (const c of captures.slice()) stopSource(c.who);
  if (say) status("Stopped — transcript saved to this session.");
  saveRunTranscript();
}
function reportSources() {
  if (!running) return;
  const on = captures.map(c => c.who === "You" ? "your mic" : "call audio");
  status(`Listening — ${on.join(" + ") || "nothing"}${captureErrors.length ? " · " + captureErrors.join(" · ") : ""}. ${autoOn ? "Auto: when the speaker goes quiet, everything heard becomes one question and gets answered." : "Press AI Answer (Ctrl+Enter) — everything heard becomes one question, answered in full."}`, captureErrors.length ? "err" : "live");
}

/* ---- capture: voice-activity detection per source ---- */
let captures = [];           // { who, stream, owner, rec, chunks, ... }
let captureErrors = [];
let audioCtx = null;
let displayVideo = null;     // kept from the call-audio share, reused by Analyse Screen
const VAD = { SILENCE_MS: 650, MIN_SPEECH_MS: 280, MAX_SEG_MS: 14000, IDLE_RECYCLE_MS: 6000, INTERIM_MS: 3000 };
const LEVEL_WORKLET = "class L extends AudioWorkletProcessor{constructor(){super();this.a=0;this.n=0}process(i){const c=i[0]&&i[0][0];if(c){let s=0;for(let k=0;k<c.length;k++)s+=c[k]*c[k];this.a+=s;this.n+=c.length;if(this.n>=1024){this.port.postMessage(Math.sqrt(this.a/this.n));this.a=0;this.n=0}}return true}}registerProcessor('perfact-level',L);";
function pickMime() { for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch {} } return ""; }
const MIME = pickMime();
function primeAudio() {
  try {
    if (!audioCtx || audioCtx.state === "closed") audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch {}
}
async function getCtx() {
  primeAudio();
  if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch {} }
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
  if (captures.some(c => c.who === "You")) return;
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
    await attachSource(mic, "You", null);
  } catch (e) { captureErrors.push("Mic: " + micError(e)); srcOn.mic = false; syncSrc(); }
}
async function startSys() {
  if (captures.some(c => c.who === "Them")) return;
  try {
    const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include", selfBrowserSurface: "exclude" });
    const audio = disp.getAudioTracks();
    if (!audio.length) {
      disp.getTracks().forEach(t => t.stop());
      captureErrors.push("Call audio: none shared — choose the meeting TAB and tick “Share tab audio” (or Entire screen + “Share system audio”)");
      srcOn.sys = false; syncSrc(); return;
    }
    displayVideo = disp.getVideoTracks()[0] || null;
    await attachSource(new MediaStream(audio), "Them", disp);
  } catch (e) { captureErrors.push("Call audio: " + (e && e.name === "NotAllowedError" ? "share cancelled" : (e && e.message || e))); srcOn.sys = false; syncSrc(); }
}
async function attachSource(stream, who, owner) {
  const ctx = await getCtx();
  const src = ctx.createMediaStreamSource(stream);
  const cap = { who, stream, owner, src, stopped: false, rec: null, chunks: [], segStart: 0, speechMs: 0, lastVoice: 0, lastTick: 0, voiced: false, noise: 0.004, interimAt: 0, inflight: 0 };
  if (ctx._lvl === "worklet") {
    const node = new AudioWorkletNode(ctx, "perfact-level");
    node.port.onmessage = (e) => vadStep(cap, e.data);
    const sink = ctx.createGain(); sink.gain.value = 0;
    src.connect(node); node.connect(sink); sink.connect(ctx.destination);
    cap.node = node; cap.sink = sink;
  } else {
    const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize);
    cap.timer = setInterval(() => { an.getFloatTimeDomainData(buf); let s = 0; for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k]; vadStep(cap, Math.sqrt(s / buf.length)); }, 30);
    cap.node = an;
  }
  const track = stream.getAudioTracks()[0];
  if (track) track.addEventListener("ended", () => { stopSource(who); if (who === "Them") { srcOn.sys = false; syncSrc(); } reportSources(); });
  startSegment(cap);
  captures.push(cap);
}
function stopSource(who) {
  for (const cap of captures.filter(c => c.who === who)) {
    cap.stopped = true; stopCaptions(cap);
    try { if (cap.rec && cap.rec.state !== "inactive") { cap.rec.onstop = null; cap.rec.stop(); } } catch {}
    try { cap.src.disconnect(); cap.node && cap.node.disconnect(); cap.sink && cap.sink.disconnect(); } catch {}
    if (cap.timer) clearInterval(cap.timer);
    try { cap.stream.getTracks().forEach(t => t.stop()); } catch {}
    try { cap.owner && cap.owner.getAudioTracks().forEach(t => t.stop()); } catch {}
    meter(who, 0, false);
  }
  captures = captures.filter(c => c.who !== who);
}
function questionSource() { return captures.some(c => c.who === "Them") ? "Them" : "You"; }

function startSegment(cap) {
  cap.chunks = []; cap.segStart = performance.now(); cap.speechMs = 0; cap.voiced = false; cap.interimAt = 0;
  let rec; try { rec = new MediaRecorder(cap.stream, MIME ? { mimeType: MIME } : undefined); } catch { cap.rec = null; return; }
  const chunks = cap.chunks;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  try { rec.start(250); } catch { cap.rec = null; return; }
  cap.rec = rec;
}
const finals = new Set();              // final transcriptions still in flight (AI Answer waits for them)
function endSegment(cap, keep) {
  const rec = cap.rec, chunks = cap.chunks, speech = cap.speechMs;
  startSegment(cap);                  // the next phrase starts recording immediately — no gap
  if (!rec) return Promise.resolve();
  let settle;
  const done = new Promise(r => { settle = r; });
  finals.add(done); done.then(() => finals.delete(done));
  rec.onstop = () => {
    if (!keep || speech < VAD.MIN_SPEECH_MS) return settle();
    const blob = new Blob(chunks, { type: rec.mimeType || MIME || "audio/webm" });
    if (blob.size > 2000) transcribe(blob, cap.who, { final: true }).then(settle, settle); else settle();
  };
  try { rec.stop(); } catch { settle(); }
  setTimeout(settle, 6000);           // never let a stuck recorder hold AI Answer
  return done;
}
// AI Answer pressed mid-sentence: cut every open phrase now and wait (briefly) for its words.
async function flushHeard(maxMs = 2500) {
  for (const cap of captures) if (cap.voiced && cap.speechMs >= VAD.MIN_SPEECH_MS) endSegment(cap, true);
  const wait = [...finals];
  if (wait.length) await Promise.race([Promise.allSettled(wait), new Promise(r => setTimeout(r, maxMs))]);
}
function vadStep(cap, rms) {
  if (cap.stopped || !running) return;
  const now = performance.now();
  const dt = cap.lastTick ? Math.min(100, now - cap.lastTick) : 20; cap.lastTick = now;
  if (!cap.voiced || now - cap.lastVoice > 1500) cap.noise = cap.noise * 0.995 + Math.min(rms, 0.05) * 0.005;   // adaptive noise floor
  const speaking = rms > Math.max(0.006, cap.noise * 3);
  meter(cap.who, rms, speaking);
  if (speaking) { cap.lastVoice = now; cap.speechMs += dt; if (cap.speechMs > 120) cap.voiced = true; }
  const segLen = now - cap.segStart;
  if (cap.voiced && now - cap.lastVoice > VAD.SILENCE_MS) return endSegment(cap, true);   // speaker paused → send the phrase
  if (segLen > VAD.MAX_SEG_MS) return endSegment(cap, cap.voiced);                      // long monologue → flush a piece
  if (!cap.voiced && segLen > VAD.IDLE_RECYCLE_MS) return endSegment(cap, false);       // silence → recycle, send nothing
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
let promptCache = { id: null, text: "" };
function whisperPrompt() {
  const s = current || {};
  if (promptCache.id === s.id) return promptCache.text;
  const terms = [...new Set((`${s.role || ""} ${s.jd || ""} ${(s.resume || "").slice(0, 3000)}`.match(/\b[A-Z][A-Za-z0-9+#./-]{1,}\b/g) || []))].slice(0, 45);
  promptCache = { id: s.id, text: `Job interview for ${s.role || "a technical role"}. ${terms.join(", ")}.`.slice(0, 550) };
  return promptCache.text;
}
const HALLU = /^(you|thank you|thanks|thank you very much|thank you so much|thanks for watching|thank you for watching|bye|bye bye|okay|ok|so|um|uh|hmm|mm|mhm|yeah|yes|no|right)[.!?,]*$/i;
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
  const cap = opt.cap; if (cap) cap.inflight++;
  try {
    const t0 = performance.now();
    const res = await fetch("/api/transcribe", { method: "POST",
      headers: { "content-type": "application/octet-stream", "x-audio-mime": blob.type || "audio/webm", "x-whisper-prompt": encodeURIComponent(whisperPrompt()) }, body: blob });
    if (res.status === 429) { interimOffUntil = performance.now() + 60000; if (opt.final) status("Transcription is rate-limited for a moment — keeping final phrases only.", "err"); return; }
    if (!res.ok) { if (opt.final) status(`Transcription error ${res.status}.`, "err"); return; }
    const { text } = await res.json();
    const clean = cleanTranscript(text);
    if (!clean) return;
    if (opt.final) onTranscript(who, clean, performance.now() - t0);
    else if (running) showCaption(who, clean, true);
  } catch {} finally { if (cap) cap.inflight--; }
}

/* ---- what was heard → captions, drawer, questions ---- */
const Q_CUE = /\?\s*$|^(so,? )?(what|how|why|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|let's|lets)\b|\b(tell me|walk me|how would you|what would you|why did you|can you|could you|would you|have you|do you|are you|what is|what are|your experience|about yourself|introduce)\b/i;
let lastQ = { card: null, at: 0 };
let capTimer = null;
function showCaption(who, text, isInterim) {
  const el = $("caption"); if (!el) return;
  el.classList.remove("hidden"); el.classList.toggle("interim", !!isInterim);
  $("capWho").textContent = who === "You" ? "You" : "Them"; $("capText").textContent = text;
  clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.add("hidden"), 9000);
}
function appendDrawer(who, text) {
  const body = $("drawerBody"); if (!body) return;
  const first = body.firstElementChild; if (first && first.classList.contains("muted")) body.innerHTML = "";
  const d = document.createElement("div"); d.className = "tl " + (who === "You" ? "you" : "them");
  d.innerHTML = "<b></b><span></span>"; d.querySelector("b").textContent = who; d.querySelector("span").textContent = text;
  body.append(d); body.scrollTop = body.scrollHeight;
}
function renderDrawer() { const body = $("drawerBody"); if (!body) return; body.innerHTML = '<div class="muted small">Nothing heard yet.</div>'; transcript.forEach(t => appendDrawer(t.who, t.text)); }
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
const armsAuto = () => pendingHeard().some(t => t.who === questionSource() && Q_CUE.test(t.text));
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!autoOn || !armsAuto()) return;
  autoTimer = setTimeout(function fire() {
    if (!autoOn || !armsAuto()) return;
    if (captures.some(c => c.voiced) || finals.size || answerCtl) { autoTimer = setTimeout(fire, 700); return; }   // still talking / still answering
    aiAnswer(true);
  }, AUTO_QUIET_MS);
}
function resetLiveState() {           // a new or exited session starts clean: no leaked stream, timer or badge
  if (answerCtl) { try { answerCtl.abort(); } catch {} answerCtl = null; }
  clearTimeout(autoTimer);
  heardSeq = 0; answeredSeq = 0;
  updatePending();
}
// Misheard terms (owner, 2026-09-30: "yes — and dependency keywords and other related or used words as well").
// Vocabulary = acronyms/CamelCase terms in the resume, JD, documents, prep and the answers on screen, plus the PAM /
// security ecosystem and its integration dependencies. Code only, no AI:
//  - an ALL-CAPS word one letter from exactly one known acronym becomes it ("CBM" -> CPM, "PDA" -> PTA);
//  - two words that together are one letter from a known long term become it ("cyber arc" -> CyberArk);
//  - a long lowercase word one letter from a known long term becomes it ("sentinal" -> Sentinel);
//  - a lowercased CamelCase term gets its real casing ("powershell" -> PowerShell). Short English words are never touched.
const DOMAIN_TERMS = "CyberArk PAS PVWA CPM PSM PSMP PTA EPM AIM CCP PACLI PAReplicate PrivateArk Vault LDAP LDAPS SAML OAuth OIDC RADIUS Kerberos NTLM MFA SSO SIEM SOAR EDR XDR Splunk Sentinel QRadar ServiceNow PowerShell Python REST API SSH RDP WinRM Azure AWS GCP Entra IAM PAM IGA SailPoint Okta BeyondTrust Delinea Thycotic HashiCorp Terraform Ansible Jenkins Kubernetes AKS EKS Docker Linux Unix Windows SQL Oracle SAP NIST SOX PCI HIPAA ISO CIS MITRE STRIDE OWASP SAST DAST Fortify Qualys Wiz CrowdStrike Defender Syslog SNMP TLS PKI HSM KMS JSON YAML GitHub GitLab ServiceNow Jira Confluence VMware vCenter ESXi".split(" ");
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
function onTranscript(who, text) {
  text = fixTerms(text);
  if (who === "You" && follow.on && !follow.sr) followHear(text, true);   // Follow along without live recognition
  transcript.push({ who, text, at: Date.now(), seq: ++heardSeq }); if (transcript.length > 500) transcript.shift();
  logEvent({ t: "line", who, text });
  appendDrawer(who, text);
  showCaption(who, text, false);
  updatePending();
  if (!flushing) scheduleAuto();
}

/* ---- answers: streamed, grounded on the dossier ---- */
let answerCtl = null;
let answerEpoch = 0;            // bumps on every answer request: an automatic retry only fires if nothing newer started
function slimPrep() { const p = current && current.prep; return p ? { identity: p.identity, persona: p.persona, projects: p.projects } : {}; }
function buildTranscript() { return transcript.slice(-12).map(t => `${t.who}: ${t.text}`).join("\n"); }
// The last two answered questions before this card (owner, 2026-09-30): the next question may follow up on them.
function recentQA(card) {
  const i = cards.indexOf(card), prev = (i < 0 ? cards : cards.slice(0, i)).filter(c => c && c.question && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving)/.test(c.question) && typeof c.answer === "string" && c.answer.trim().length > 40);
  return prev.slice(-2).map(c => ({ q: String(c.question).slice(0, 240), a: plainAnswer(c.answer).slice(0, 900) }));
}
const consolidatedNeedsDerive = (opts) => !!opts.consolidated && !opts.derived;   // AI Answer: match after the question is derived
function serveBook(card, hit, depthKey) {
  answerCtl = null;                                                   // nothing is in flight: the book answered
  card.answer = hit.text; card.streaming = false; card.meta = "⚡ book · 0.00s · written ahead of the interview";
  card.byDepth = card.byDepth || {}; card.byDepth[depthKey] = { answer: card.answer, meta: card.meta };
  if (cards[idx] === card) renderCard();
  logEvent({ t: "answer", question: card.question, derived: card.question, book: true, depth: $("liveInterviewer").selectedOptions[0].textContent, text: hit.text, meta: card.meta, depthKey });
  status("Answered from the opening book — no wait, no AI call. Press ↓ for a deeper live answer.", "live");
}
async function generateAnswer(question, card, opts = {}) {
  question = String(question || "").trim(); if (!question) return;
  card = card || addCard(question, ["…"]);
  if (location.protocol === "file:") { card.answer = ["(Preview) Serve the deployed app for grounded answers."]; renderCard(); return; }
  if (answerCtl) { try { answerCtl.abort(); } catch {} }          // the newest question always wins
  const ctl = new AbortController(); answerCtl = ctl; card.req = ctl;   // card.req: which request owns this card now
  if (card === follow.card) { follow.pos = 0; follow.livePos = 0; }
  const t0 = performance.now(); let first = 0, text = "", meta = {};
  const depthLabel = () => { const o = $("liveInterviewer").selectedOptions[0]; return o ? o.textContent : ""; };
  const logAnswer = (extra) => logEvent({ t: "answer", question: card.question, derived: derivedQ || meta.derived || "", typed: !consolidated, regen: !!opts.derived, depth: depthLabel(), text: typeof card.answer === "string" ? card.answer : (card.answer || []).join("\n"), meta: card.meta || "", ...extra });
  const consolidated = !!opts.consolidated;
  const epoch = ++answerEpoch;
  const depthKey = `${$("liveInterviewer").value}|${liveConfig().mode}|${liveConfig().length || ""}`;
  if (!opts.regen && !consolidatedNeedsDerive(opts) && book.sid === (current && current.id)) {   // opening book: typed / known questions
    const hit = bookMatch(question, depthKey);
    if (hit) { serveBook(card, hit, depthKey); return; }
  }
  if (opts.regen && card.byDepth && card.byDepth[depthKey]) {              // stepped back to a depth already written: no AI call
    const hit = card.byDepth[depthKey];
    card.answer = hit.answer; card.meta = hit.meta.replace(/ · cached$/, "") + " · cached"; card.streaming = false;
    if (answerCtl) { try { answerCtl.abort(); } catch {} answerCtl = null; }
    if (cards[idx] === card) renderCard(); status("Shown from this card's earlier answer at this depth — no AI call.", "live");
    return;
  }
  // Regenerating (depth change) or retrying: the answer on screen stays until the new one starts arriving.
  const prevAnswer = card.answer, prevMeta = card.meta;
  const keepOld = !!(opts.regen || opts.retries) && !(Array.isArray(prevAnswer) && /^(…|Groq)/.test(String(prevAnswer[0] || "")));
  if (!keepOld) card.answer = ["…"];
  card.streaming = true; card.meta = keepOld ? `regenerating at ${depthLabel()} depth…` : ""; if (cards[idx] === card) renderCard();
  status(consolidated ? "Deriving the question and answering…" : "Answering…", "live");
  const plainHeard = consolidated ? question.replace(/^(Them|You):\s*/gm, "") : question;
  // Relevance first: work out what the interviewer actually asked, THEN pull the persona-file and
  // dossier material that matches that question — not whatever words happened to be in the ramble.
  let derivedQ = opts.derived || "", derivedBy = opts.derived ? "kept" : "";                 // regenerating: the question is already known
  if (consolidated && !derivedQ) {
    try {
      const dr = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({ deriveOnly: true, client: BUILD, question, transcript: opts.earlier || "", history: recentQA(card) }) });
      const dj = await dr.json();
      if (card.req !== ctl) return;
      if (dj.noQuestion) {
        card.streaming = false; card.question = "No question yet";
        card.answer = ["Nothing said since your last answer was a question for you. Keep listening — press AI Answer once they ask, or type the question."];
        card.meta = ""; if (cards[idx] === card) renderCard(); status("No question heard yet.", "live");
        logAnswer({ noQuestion: true });
        if (answerCtl === ctl) answerCtl = null; return;
      }
      if (dj.derived) { derivedQ = dj.derived; card.question = derivedQ; if (cards[idx] === card) renderCard(); }
      derivedBy = dj.derivedBy || "ai";
      const hit = book.sid === (current && current.id) && bookMatch(derivedQ, depthKey);
      if (hit) { if (answerCtl === ctl) answerCtl = null; serveBook(card, hit, depthKey); return; }
    } catch (e) {
      if (e && e.name === "AbortError") { if (card.req === ctl) { card.streaming = false; card.meta = "superseded by the next question"; if (cards[idx] === card) renderCard(); } return; }
    }
  }
  const retrieved = retrieve(derivedQ || plainHeard, consolidated ? 5 : 4);
  const prep = { ...slimPrep(), questions: retrieved.length ? [] : ((current && current.prep && current.prep.questions) || []).slice(0, 30) };
  const show = (t) => { if (card.req !== ctl) return; card.answer = t.trim() ? t : ["…"]; if (cards[idx] === card) renderCard(); };
  try {
    const res = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ stream: true, client: BUILD, consolidated, derived: derivedQ || undefined, question, transcript: consolidated ? (opts.earlier || "") : buildTranscript(), config: liveConfig(), prep, retrieved, ledger, history: recentQA(card) }) });
    if (!res.ok || !res.body) throw new Error("answer " + res.status);
    if (!(res.headers.get("content-type") || "").includes("event-stream")) {
      const data = await res.json(); text = data.text || ""; first = performance.now() - t0; meta = data;
    } else {
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          if (!frame.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(frame.slice(5)); } catch { continue; }
          if (ev.type === "meta") { meta = { ...meta, ...ev }; if (consolidated && ev.derived && card.req === ctl) { card.question = ev.derived; if (cards[idx] === card) renderCard(); } }
          else if (ev.type === "delta") { if (!first) first = performance.now() - t0; text += ev.text; show(text); }
          else if (ev.type === "replace") { if (!first) first = performance.now() - t0; text = ev.text; show(text); }
          else if (ev.type === "wait") { if (card.req === ctl) { status(`Groq's free tier is at its per-minute limit — continuing in ${Math.ceil(ev.ms / 1000)}s…`, "live"); card.meta = `waiting ${Math.ceil(ev.ms / 1000)}s for Groq capacity…`; if (cards[idx] === card) renderCard(); } }
          else if (ev.type === "done") meta = { ...meta, ...ev };
        }
      }
    }
    if (card.req !== ctl) return;                                      // a newer request took this card over
    if (meta.ledger) ledger = meta.ledger;
    card.streaming = false;
    if (meta.busy) {                                                    // Groq's per-minute quota: wait it out, then answer by itself
      const tries = (opts.retries || 0) + 1, wait = meta.retryAfterMs || 8000, secs = Math.ceil(wait / 1000);
      if (meta.daily) {                                                 // a daily cap: retrying every minute won't help — say so plainly
        const mins = Math.max(1, Math.round((meta.waitMs || wait) / 60000));
        if (keepOld) card.answer = prevAnswer; else card.answer = [`Groq's free daily allowance is used up on both models right now — it frees up in about ${mins} min. Type the question or press AI Answer then.`];
        card.meta = `Groq daily limit — about ${mins} min`; if (cards[idx] === card) renderCard();
        logAnswer({ busy: true, retryAfterMs: meta.waitMs || wait });
        status(`Groq's free daily allowance is used up — about ${mins} min until it frees up.`, "err");
        return;
      }
      if (keepOld) card.answer = prevAnswer;
      else card.answer = [`Groq's free tier is at its per-minute limit — this answer starts by itself in ${secs}s.`];
      card.meta = tries <= 3 ? `waiting for Groq capacity — automatic retry in ${secs}s` : "Groq is still at its limit — press AI Answer or ↓ to try again";
      if (cards[idx] === card) renderCard();
      logAnswer({ busy: true, retryAfterMs: wait });
      status(tries <= 3 ? `Groq's free tier is at its per-minute limit — ${keepOld ? "regenerating" : "answering"} automatically in ${secs}s.` : "Groq is still at its per-minute limit.", "err");
      if (tries <= 3) setTimeout(() => {
        if (answerEpoch === epoch && card.req === ctl) return generateAnswer(question, card, { ...opts, derived: derivedQ || opts.derived, retries: tries, regen: opts.regen || keepOld });
        if (!keepOld) card.answer = ["Not answered — a newer question took over. Press ↓ or ↑ to answer this one."];   // a newer answer started: this retry stands down
        card.meta = keepOld ? "regeneration skipped — a newer question came in" : ""; if (cards[idx] === card) renderCard();
      }, wait);
      return;
    }
    if (meta.noQuestion) {                                              // nothing heard was a question
      card.question = "No question yet";
      card.answer = ["Nothing said since your last answer was a question for you. Keep listening — press AI Answer once they ask, or type the question."];
      card.meta = ""; if (cards[idx] === card) renderCard();
      logAnswer({ noQuestion: true });
      status("No question heard yet.", "live"); return;
    }
    show(text || "- The answer engine returned nothing — press AI Answer again.");
    if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.split("\n").pop().slice(0, 200);
    const kind = ({ 0: "intro", 1: "story", 2: "reasoning", 3: "drill-down", 4: "your experience" }[meta.tier] || "") + (meta.length && ["closed", "which", "theirq", "logistics"].includes(meta.length.kind) ? " · short form" : "") + (meta.derived ? " · from everything heard" : "") + (meta.voice ? ` · voice ${meta.voice.passed}/${meta.voice.total}` : "");
    const spoken = (s) => s >= 90 ? `${Math.round(s / 60)} min` : `${s}s`;
    const len = meta.length && meta.length.secs ? ` · ~${spoken(meta.length.secs[0])}–${spoken(meta.length.secs[1])} spoken` : "";
    card.meta = `⚡ ${(first / 1000).toFixed(2)}s · ${((performance.now() - t0) / 1000).toFixed(2)}s${kind ? " · " + kind : ""}${len}${retrieved.length ? " · dossier" : ""}${meta.degraded ? " · prepared" : ""}${meta.timing && /qwen-backup/.test(meta.timing.lane || "") && !/groq:gpt/.test((meta.timing.lane || "").split(">").pop()) ? " · backup model" : ""}${meta.checked ? " · ✓ fact-checked" : ""}`;
    if (cards[idx] === card) renderCard();
    logAnswer({ derived: meta.derived || derivedQ || "", derivedBy: derivedBy || "", kind: meta.length && meta.length.kind, tier: meta.tier, lane: meta.timing && meta.timing.lane, voice: meta.voice && `${meta.voice.passed}/${meta.voice.total}`, ms: Math.round(performance.now() - t0), depthKey });
    if (!meta.degraded && !/backup model/.test(card.meta)) { card.byDepth = card.byDepth || {}; card.byDepth[depthKey] = { answer: card.answer, meta: card.meta }; }
    status(`Answered — first words in ${(first / 1000).toFixed(2)}s.`, "live");
  } catch (e) {
    if (card.req !== ctl) return;                                      // aborted because this same card was re-asked
    card.streaming = false;
    if (e && e.name === "AbortError") {
      if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.split("\n").pop().slice(0, 200);
      card.meta = "superseded by the next question"; if (cards[idx] === card) renderCard(); return;
    }
    const fb = retrieved[0];
    if (consolidated && /^Deriving/.test(card.question)) card.question = plainHeard.split("\n").pop().slice(0, 200);
    if (keepOld) { card.answer = prevAnswer; card.meta = "couldn't regenerate — press ↓/↑ again"; if (cards[idx] === card) renderCard(); status("Couldn't reach the answer engine — kept the previous answer.", "err"); return; }
    card.answer = fb ? fb.a : ["Couldn't reach the answer engine — " + (e && e.message || e)];
    card.meta = fb ? "prepared answer (engine unreachable)" : "";
    if (cards[idx] === card) renderCard();
    logAnswer({ failed: String(e && e.message || e) });
    status("Answer engine unreachable — showing the prepared answer.", "err");
  } finally { if (answerCtl === ctl) answerCtl = null; }
}

/* ---- manual, AI Answer, screen, copy, export, shortcuts ---- */
$("sendBtn").onclick = sendManual;
$("manualInput").addEventListener("keydown", e => { if (e.key === "Enter") sendManual(); });
function sendManual() { const v = $("manualInput").value.trim(); if (!v) return; $("manualInput").value = ""; logEvent({ t: "line", who: "You (typed)", text: v }); generateAnswer(v, addCard(v, ["…"])); }
$("answerBtn").onclick = () => aiAnswer(false);
let aiBusy = false;
async function aiAnswer(fromAuto) {
  if (aiBusy) return; aiBusy = true; clearTimeout(autoTimer);
  try {
    if (running && captures.length) {
      flushing = true; if (!fromAuto) status("Catching your last words…", "live");
      try { await flushHeard(); } finally { flushing = false; }
    }
    const pending = pendingHeard();
    if (pending.length) {
      answeredSeq = heardSeq; updatePending();
      const heard = pending.map(t => `${t.who}: ${t.text}`).join("\n");
      const earlier = transcript.filter(t => t.seq <= pending[0].seq - 1).slice(-10).map(t => `${t.who}: ${t.text}`).join("\n");
      const card = addCard("Deriving the question from everything heard…", ["…"]);
      card.heard = heard; card.earlier = earlier;
      return generateAnswer(heard, card, { consolidated: true, earlier });
    }
    if (fromAuto) return;
    const c = cards[idx];
    if (c && c.heard) return generateAnswer(c.heard, c, { consolidated: true, earlier: c.earlier || "" });   // answer the same thing again
    if (c && /^(Your introduction)$/.test(c.question)) return generateAnswer("Tell me about yourself", c);
    if (c && !/^(Preparing…|Ready|Cleared\.|Deriving)/.test(c.question)) return generateAnswer(c.question, c);
    status("Nothing heard yet — press Start, or type a question.", "live");
    $("manualInput").focus();
  } finally { aiBusy = false; }
}
$("screenBtn").onclick = analyseScreen;
async function grabFrame() {
  let track = displayVideo && displayVideo.readyState === "live" ? displayVideo : null;
  if (!track) { const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); track = s.getVideoTracks()[0]; displayVideo = track; }
  const video = document.createElement("video"); video.muted = true; video.playsInline = true;
  video.srcObject = new MediaStream([track]); await video.play();
  if (video.readyState < 2) await new Promise(r => { video.onloadeddata = r; setTimeout(r, 1500); });
  const w = video.videoWidth || 1280, h = video.videoHeight || 720, k = Math.min(1, 1600 / w);
  const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
  video.pause(); video.srcObject = null;
  return c.toDataURL("image/jpeg", 0.72);
}
async function analyseScreen() {
  const card = addCard("🖥 Reading the screen…", ["…"]); card.streaming = true; renderCard();
  const t0 = performance.now();
  try {
    const image = await grabFrame();
    const res = await fetch("/api/screen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, prep: slimPrep(), config: liveConfig() }) });
    const data = await res.json();
    card.question = "🖥 " + (data.question || "On screen"); card.answer = data.text || "- Nothing readable came back from the screen — try Analyse Screen again.";
  } catch (e) { card.question = "🖥 Screen"; card.answer = ["Couldn't capture the screen — " + (e && e.name === "NotAllowedError" ? "share was cancelled" : (e && e.message || e))]; }
  card.streaming = false; card.meta = ((performance.now() - t0) / 1000).toFixed(1) + "s · vision";
  if (cards[idx] === card) renderCard();
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
  glide.target = Math.max(0, Math.min(top, ul.scrollHeight - ul.clientHeight));
  if (document.hidden) { ul.scrollTop = glide.target; return; }   // no frames in a hidden tab: jump, don't stall
  if (glide.raf) return;
  glide.last = performance.now();
  const step = (now) => {
    const dt = Math.min(64, now - glide.last); glide.last = now;
    const diff = glide.target - ul.scrollTop;
    if (Math.abs(diff) < 0.5 || !follow.on) { if (follow.on) ul.scrollTop = glide.target; glide.raf = 0; return; }
    ul.scrollTop += diff * (1 - Math.exp(-dt / 260));         // τ = 260 ms: a slow, unnoticeable glide that never overshoots
    glide.raf = requestAnimationFrame(step);
  };
  glide.raf = requestAnimationFrame(step);
}
function followPaint() {
  const ul = $("answer"), spans = ul.querySelectorAll("span.w");
  const at = Math.min(follow.words.length, Math.max(follow.pos, follow.livePos) + (follow.ghost || 0));
  const lo = follow.on ? Math.min(at, follow.painted ?? 0) : 0, hi = follow.on ? Math.max(at, follow.painted ?? 0) + 1 : spans.length;
  for (let k = Math.max(0, lo - 1); k < Math.min(spans.length, hi + 1); k++) {   // only the words that changed
    spans[k].classList.toggle("said", follow.on && k < at); spans[k].classList.toggle("cur", follow.on && k === at);
  }
  follow.painted = follow.on ? at : 0;
  $("answer").classList.toggle("following", follow.on);
  if (!follow.on || Date.now() < follow.holdUntil) return;
  const cur = spans[Math.min(at, spans.length - 1)]; if (!cur) return;
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
  glideTo(ul, y > lh * 2.6 ? y - lh * 2.6 : 0);
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
(() => {                                           // your own scrolling wins: Follow along holds off for a few seconds
  const ul = $("answer"); if (!ul) return;
  const hold = () => { if (follow.on) follow.holdUntil = Date.now() + 5000; };
  ["wheel", "touchstart", "mousedown"].forEach(ev => ul.addEventListener(ev, hold, { passive: true }));
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
    answerLines(c.answer).forEach(({ t, kind, lang }) => { if (kind === "code") { out.push("```" + (lang || ""), t, "```"); return; } const x = unbracket(t).replace(/\s*\((pause|beat)\)\s*/gi, " ").trim(); if (!x || kind === "pauseline") return; out.push(kind === "head" ? `#### ${x}` : kind === "bullet" ? `- ${x}` : x); });
    if (c.meta) out.push(`_${c.meta}_`); out.push("");
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
    if (e.busy) { out.push(head, `Groq per-minute limit — retried automatically after ${Math.ceil((e.retryAfterMs || 0) / 1000)}s.`, ""); continue; }
    out.push(head, `💬 Question: ${e.derived || e.question}`, "", "---", "", `⭐️ Answer: ${String(e.text || "").trim()}`);
    if (e.meta) out.push("", `(${e.meta})`);
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
  const heard = sessionLog.filter(e => e.t === "line").length, answers = sessionLog.filter(e => e.t === "answer" && !e.noQuestion).length;
  if (!heard && !answers) return;
  const runAt = sessionLog[0].at, key = `${s.id}:tx:${runAt}`;
  await DossierDB.put(key, { at: runAt, ended: Date.now(), text: transcriptText(s, sessionLog), log: sessionLog.slice() });   // log = training data
  const all = LS.get("sessions", []), i = all.findIndex(x => x.id === s.id); if (i < 0) return;
  const list = (all[i].transcripts || []).filter(t => t.key !== key);
  list.push({ key, at: runAt, ended: Date.now(), heard, answers });
  all[i].transcripts = list.slice(-20); s.transcripts = all[i].transcripts; LS.set("sessions", all); sessions = all;
}
async function viewTranscripts(s) {
  const list = (s.transcripts || []).slice().reverse(); if (!list.length) return;
  const show = async (t) => {
    const rec = await DossierDB.get(t.key);
    const body = $("pvBody"); body.innerHTML = "";
    if (list.length > 1) {
      const bar = document.createElement("div"); bar.className = "tx-runs";
      list.forEach(x => { const b = document.createElement("button"); b.className = "mini" + (x.key === t.key ? " on" : ""); b.textContent = new Date(x.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + ` · ${x.answers} answers`; b.onclick = () => show(x); bar.append(b); });
      body.append(bar);
    }
    const pre = document.createElement("pre"); pre.textContent = rec ? rec.text : "This transcript is no longer stored in this browser."; body.append(pre);
    $("pvTitle").textContent = `Transcript — ${s.role || "session"} · ${new Date(t.at).toLocaleString()}`;
    $("pvDownload").onclick = (e) => { if (!rec) return; if (e.shiftKey && rec.log) return downloadText(transcriptName(s, t.at).replace(/\.txt$/, ".training.jsonl"), rec.log.map(x => JSON.stringify(x)).join("\n")); downloadText(transcriptName(s, t.at), rec.text); };
    $("pvDownload").title = "Download the transcript (Shift+click: the training data, one JSON record per line)";
  };
  await show(list[0]);
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
  else if (e.key === "/") { e.preventDefault(); $("manualInput").focus(); }
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
  open() { if (this._p) return this._p; this._p = new Promise((res, rej) => { const r = indexedDB.open("perfact-dossier", 1); r.onupgradeneeded = () => r.result.createObjectStore("d"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return this._p; },
  async get(id) { try { const db = await this.open(); return await new Promise(res => { const rq = db.transaction("d", "readonly").objectStore("d").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); } catch { return null; } },
  async put(id, v) { try { const db = await this.open(); await new Promise(res => { const tx = db.transaction("d", "readwrite"); tx.objectStore("d").put(v, id); tx.oncomplete = res; tx.onerror = res; }); } catch {} },
};
const INTERVIEWER_KEYS = ["hr", "technical_hr", "developer", "engineer", "architect", "analyst", "peer", "director", "lead", "supervisor"];
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
function showDossierProgress(finished) {
  const el = $("dossier"); if (!el) return;
  el.classList.remove("hidden");
  const pages = dossier.words / WORDS_PER_PAGE, target = dossier.target || 1;
  $("dossierFill").style.width = Math.min(100, pages / target * 100).toFixed(1) + "%";
  const pf = persona.total ? `Persona file: ${persona.done}/${persona.total} parts${persona.done < persona.total ? " · writing" : ""} · ` : "";
  const ds = dossierOff ? "Dossier: written by Claude when Kompas runs locally"
    : dossier.target ? `Dossier: ${Math.round(pages)} / ${target} pages · ${dossier.items.length} answers${finished ? " · ready" : " · building"}` : "Dossier: starts after the persona file";
  $("dossierText").textContent = pf + ds;
}

/* ===================== the PERSONA FILE (per session, Markdown) =====================
   Modelled on the owner's GRID FILE: who you are, the projects with arcs and spoken versions, the
   moments the room was watching, the JD's own domain, tools, operations, a question bank seeded from
   his ~1,850 REAL interviewer questions ranked for this JD, and before/on the call. Written part by
   part by /api/persona in the background, kept in IndexedDB. Every "### " unit is a retrieval item,
   ranked ahead of the dossier — relevance to what the interviewer asked is the top priority. */
let persona = { v: 1, sid: null, parts: {}, done: 0, total: 0, items: [] };
let dossierOff = false, slowUntil = 0, personaLane = "";
const writerOnGroq = () => personaLane === "groq" || (!personaLane && !/^(localhost|127.0.0.1)$/.test(location.hostname));            // dossier needs local Claude; persona parts written on Groq are paced
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
  persona.items = personaItems(md); indexDossier(); showDossierProgress();
  await DossierDB.put(s.id + ":persona", { v: 1, parts: persona.parts, done: 1, total: 1 });
  status(`Persona file loaded — ${persona.items.length} sections will be used first for answers.`, "live");
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
    persona.done = persona.total = 1; persona.items = personaItems(persona.parts.uploaded); indexDossier(); showDossierProgress(); return;
  }
  persona.total = plan.length; persona.done = plan.filter(p => persona.parts[p.key]).length;
  persona.items = personaItems(personaMarkdown(s)); indexDossier(); showDossierProgress();
  const queue = plan.filter(p => !persona.parts[p.key]).map(p => ({ ...p, tries: 0 }));
  let backoff = 0;
  const worker = async () => {
    while (!dossierAbort && current === s && queue.length) {
      // live answer first; Groq pacing; and while you're LIVE on the hosted site (Groq shares its per-minute
      // budget with your answers) the persona file waits until you stop — locally Claude writes it, no conflict.
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
          if (current === s) { persona.items = personaItems(personaMarkdown(s)); indexDossier(); showDossierProgress(); }
          await DossierDB.put(s.id + ":persona", { v: 1, parts: persona.parts, done: persona.done, total: persona.total });
        }
      } catch {}
      if (ok) backoff = 0;
      else { backoff = Math.min(20000, backoff ? backoff * 1.6 : 3000); if (job.tries++ < 2) queue.push(job); await sleep(backoff); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (current === s) showDossierProgress();
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
  if (dossierOff) { showDossierProgress(); return; }   // the dossier is written by Claude locally; nothing to do on the hosted site
  dossierRunningFor = s.id; dossierAbort = false;
  const size = s.dossierSize && s.dossierSize !== "auto" ? Number(s.dossierSize) : (PAGES_BY_DIFFICULTY[s.difficulty || "standard"] || 250);
  const saved = await DossierDB.get(s.id);
  dossier = saved && Array.isArray(saved.items) && saved.v === 2 ? saved : { v: 2, items: [], words: 0, target: size, done: [] };   // pre-v2 dossiers had [blank]s: rebuild
  dossier.target = size; dossier.done = dossier.done || [];
  if (!dossier.items.length && s.prep && Array.isArray(s.prep.questions)) {
    dossier.items = s.prep.questions.map(q => ({ q: q.q, a: q.answer || [], tier: q.tier || 2, category: q.group || "core", interviewer: "any", difficulty: "any", projectId: q.projectId || "" }));
  }
  dossier.words = dossier.items.reduce((n, it) => n + countWords(it), 0);
  indexDossier(); showDossierProgress();
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
          dossier.done.push(job.i);
          indexDossier(); await DossierDB.put(s.id, dossier); showDossierProgress();
        }
      } catch {}
      if (got) backoff = 0;
      else { backoff = Math.min(15000, backoff ? backoff * 1.6 : 2000); if (job.tries++ < 2) queue.push(job); await sleep(backoff); }  // rate limit: back off, retry later
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (dossierRunningFor === s.id) dossierRunningFor = null;
  if (current === s) showDossierProgress(true);
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
        if (!text) cur[i].error = "no text found";
        else if (kind === "resume" && !cur.some(d => d.kind === "resume" && d.primary)) cur[i].primary = true;
        docsSet(cur); renderSection(kind);
      }
    } catch (e) {
      const cur = docsGet(), i = cur.findIndex(d => d.id === id);
      if (i >= 0) { cur[i].processing = false; cur[i].error = String(e && e.message || e).slice(0, 40); docsSet(cur); renderSection(kind); }
    }
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
    el.querySelector(".doc-name").textContent = d.name;
    const bits = [`<span>${fmtSize(d.size)}</span>`];
    if (d.processing) bits.push(`<span class="chip processing">reading…</span>`);
    else if (d.error) bits.push(`<span class="chip err">${d.error}</span>`);
    else bits.push(`<span>${(d.chars || 0).toLocaleString()} chars</span>`);
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
function openResume(from) { docsReturn = from || "dashboard"; $("resumeBackBtn").classList.toggle("hidden", docsReturn !== "wizard"); renderSection("resume"); show("resume"); }
function openDocuments(from) { docsReturn = from || "dashboard"; $("docsBackBtn").classList.toggle("hidden", docsReturn !== "wizard"); renderSection("doc"); show("documents"); }
$("resumeNavBtn").onclick = () => openResume("dashboard");
$("docsNavBtn").onclick = () => openDocuments("dashboard");
$("resumeBackBtn").onclick = backFromMaterials;
$("docsBackBtn").onclick = backFromMaterials;
function backFromMaterials() { if (docsReturn === "wizard") { renderResumeSelect(); renderDocPicker(); show("wizard"); } else openDashboard(); }

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
$("pickAll").onclick = () => { docsGet().filter(d => (d.kind || "doc") === "doc" && d.text && !d.error).forEach(d => selectedDocIds.add(d.id)); renderDocPicker(); };
$("pickClear").onclick = () => { selectedDocIds.clear(); renderDocPicker(); };
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
// Login bypassed for now — assume an authenticated session (like MarketFit).
if (!LS.get("user")) LS.set("user", { email: "you@perfact.app" });
openDashboard();

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
  $("startBtn").addEventListener("click", () => LS.set("started", true));
})();

/* ---- Connect card (shown before listening): where the call is decides what to pick in the share dialog ---- */
const CONNECT_STEPS = {
  web: ["Press <b>Connect &amp; start</b> and allow the microphone.", "In the share window pick the <b>tab</b> with your meeting and switch on <b>Share tab audio</b>.", "When they finish a question, press <b>AI Answer</b>."],
  desktop: ["Press <b>Connect &amp; start</b> and allow the microphone.", "In the share window pick <b>Entire screen</b> and switch on <b>Share system audio</b>.", "When they finish a question, press <b>AI Answer</b>."],
  phone: ["Put the phone on <b>speaker</b> near your computer.", "Press <b>Connect &amp; start</b> and allow the microphone. Kompas hears both of you through it.", "When they finish a question, press <b>AI Answer</b>."],
};
function renderConnect(s) {
  const app = LS.get("connectApp", "web");
  document.querySelectorAll(".cn-app").forEach(b => b.classList.toggle("on", b.dataset.app === app));
  // inside Kompas desktop the microphone is the only source, so the call has to be audible to it
  const steps = NO_SYS_AUDIO
    ? ["Play the call through your <b>speakers</b>, not headphones, so the microphone hears the interviewer.", "Press <b>Connect &amp; start</b>. Kompas listens through your microphone.", "When they finish a question, press <b>AI Answer</b> (Ctrl+Enter while Kompas is focused)."]
    : CONNECT_STEPS[app];
  $("cnSteps").innerHTML = steps.map(t => `<li>${t}</li>`).join("");
  $("cnApps").classList.toggle("hidden", NO_SYS_AUDIO);                     // one source, so where the call is changes nothing
  document.querySelector(".cn-label")?.classList.toggle("hidden", NO_SYS_AUDIO);
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
document.querySelectorAll(".cn-app").forEach(b => b.onclick = () => { LS.set("connectApp", b.dataset.app); renderConnect(); });
$("cnStart").onclick = () => {
  const app = LS.get("connectApp", "web");
  srcOn.mic = true; srcOn.sys = app !== "phone" && !NO_SYS_AUDIO; syncSrc();   // phone on speaker: the mic hears both sides
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
/* ---- desktop app only: "Private" lives in the ⋯ menu, where the other window tools are ---- */
if (window.kompasDesktop) {
  const paint = (on) => { $("privateBtn").setAttribute("aria-checked", String(on)); $("privateCheck").textContent = on ? "✓" : ""; };
  $("privateBtn").classList.remove("hidden");
  window.kompasDesktop.getPrivate().then(paint);
  window.kompasDesktop.onPrivate?.(paint);                         // the desktop bar's switch changes it too
  $("privateBtn").onclick = async () => paint(await window.kompasDesktop.setPrivate($("privateBtn").getAttribute("aria-checked") !== "true"));
}
