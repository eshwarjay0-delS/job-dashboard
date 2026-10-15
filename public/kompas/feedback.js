/* Kompas Feedback — review after the fact. Paste what was said in an interview or meeting (or pick a saved session):
   1. measured in code, instantly: clarity, conciseness, confidence, structure; fillers, hedging, run-on sentences, shown inside your own words;
   2. "Say it better" (one model call per answer): what went wrong in the telling, the same answer said well with pauses and stress marked,
      and how a senior leader hears it — using only facts you stated;
   3. Rehearse: read the improved answer aloud; Follow along tracks your place and reports your pace.
   Loaded after app.js; uses its LS, show(), sessions and DossierDB. */
(() => {
  const el = (id) => document.getElementById(id);
  // parsing, measuring and scoring live in review-core.js, shared with /api/review
  const { MARK, words, secsText, parse, guessMe, top, analyse, MAX_CHARS, splitSessions, normalizeUpload, stateOf, removedList } = window.KompasReviewCore;

  /* ------------------------------ render ------------------------------ */
  const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  function marked(text) {                                                           // the answer in the speaker's own words, with the issues visible in place
    const box = node("div", "fb-text");
    for (const s of text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text]) {
      const n = words(s).length, span = node("span", n > 25 ? "fb-long" : ""); if (n > 25) span.title = `${n} words in one sentence: split it`;
      let at = 0, m; MARK.lastIndex = 0;
      while ((m = MARK.exec(s))) {
        if (m.index > at) span.append(s.slice(at, m.index));
        const hit = node("span", m[1] ? "fb-filler" : "fb-hedge", m[0]); hit.title = m[1] ? "filler: pause instead" : "hedge: say it plainly"; span.append(hit);
        at = m.index + m[0].length;
      }
      if (at < s.length) span.append(s.slice(at));
      box.append(span);
    }
    return box;
  }
  // Silent delivery cues: one word, for the speaker, never read aloud. Each fits one moment where people choke.
  const CUES = {
    breathe: "Breathe in before you start, or after a long sentence.",
    smile: "Open warmly; it steadies your voice.",
    slow: "Slow down: this is the key fact.",
    steady: "The hard part. Keep the same voice.",
    firm: "A decision or a disagreement. Say it without softening.",
    own: "Your mistake. Say it plainly, no excuse.",
    warm: "You are naming or thanking people. Let it show.",
    look: "Look up. This is the line they should remember.",
    land: "Last line. Slow down and finish it.",
    stop: "You have made the point. Stop talking.",
  };
  const MARKS = new RegExp("(\\((?:pause|" + Object.keys(CUES).join("|") + ")\\)|\\*[^*\\n]+\\*)", "i");
  const cueOf = (part) => { const m = /^\(([a-z]+)\)$/i.exec(part); return m ? m[1].toLowerCase() : ""; };
  function mark(part) {                                                             // one (pause) or cue as a small tag
    const c = cueOf(part), tag = node("span", c === "pause" ? "fb-pause" : "fb-cue", c);
    if (CUES[c]) tag.title = CUES[c];
    return tag;
  }
  function spoken(text) {                                                           // the improved answer: pauses, cues and *stress* words
    const box = node("div", "fb-better");
    for (const part of String(text).split(MARKS)) {
      if (!part) continue;
      if (cueOf(part)) box.append(mark(part));
      else if (/^\*[^*]+\*$/.test(part)) box.append(node("em", "", part.slice(1, -1)));
      else box.append(part);
    }
    return box;
  }
  function legend(text) {                                                           // only the cues this answer uses, each with its meaning
    const used = Object.keys(CUES).filter(c => new RegExp("\\(" + c + "\\)", "i").test(text)); if (!used.length) return null;
    const box = node("div", "fb-legend");
    used.forEach(c => { const row = node("div", "fb-legend-row"); row.append(node("span", "fb-cue", c), node("span", "", CUES[c])); box.append(row); });
    return box;
  }
  const plain = (text) => String(text).replace(new RegExp(MARKS.source.replace("|\\*[^*\\n]+\\*", ""), "gi"), " ").replace(/\*/g, "").replace(/\s+/g, " ").trim();

  let report = null, role = "";
  function render() {
    const out = el("fbReport"); out.innerHTML = ""; if (!report) return;
    if (report.poor) {                                                               // a recording that did not catch the speaker is not scored
      const warn = node("section", "qb-group fb-summary"), wh = node("div", "qb-group-head");
      wh.append(node("b", "", report.bothSides ? "This recording has both sides in one voice" : "This recording did not catch you clearly"), node("span", "", report.bothSides ? `${report.W} words, theirs and yours together` : `${report.W} words in broken fragments`)); warn.append(wh);
      const wb = node("div", "fb-fix");
      wb.append(node("p", "fb-key", report.bothSides
        ? "The other person's questions are inside your turns here, so Kompas cannot tell your words from theirs. Scoring it would judge both of you as one speaker, so Kompas does not. What it captured is below."
        : `Your sentences here average ${report.avgSentence.toFixed(1)} words, which is what a recording looks like when it mis-hears the speaker. Scoring it would judge the microphone, not you, so Kompas does not. What it captured is below.`));
      warn.append(wb); out.append(warn);
      report.answers.slice(0, 6).forEach((a, n) => { const c = node("section", "qb-group fb-answer"), b = node("div", "fb-body"); b.append(node("div", "qb-label", `Captured ${n + 1}`), node("p", "fb-q", a.text.length > 600 ? a.text.slice(0, 600) + "…" : a.text)); c.append(b); out.append(c); });
      return;
    }
    const r = report, card = node("section", "qb-group fb-summary");
    const head = node("div", "qb-group-head"); head.append(node("b", "", "How it came across"), node("span", "", `${r.N} answer${r.N > 1 ? "s" : ""} · ${r.W} words · about ${secsText(r.W)} of speaking`)); card.append(head);
    const meters = node("div", "fb-meters");
    for (const [name, v] of Object.entries(r.scores)) {
      const m = node("div", "fb-meter"); const bar = node("div", "fb-bar"); const fill = node("i"); fill.style.width = v + "%"; fill.className = v >= 75 ? "good" : v >= 50 ? "mid" : "low"; bar.append(fill);
      m.append(node("span", "fb-meter-name", name), bar, node("b", "", String(v))); meters.append(m);
    }
    card.append(meters);
    // the habits that cost most, each with how often it happened and what to do about it; then the plain facts
    const fix = r.priorities.map(p => `${p.title}: ${p.count} of ${p.of} answers. ${p.fix}`);
    if (r.F) fix.push(`Fillers: ${top(r.fillers, 3)}.`);
    if (r.H) fix.push(`Hedging: ${top(r.hedges, 3)}.`);
    if (r.talkShare != null) fix.push(`You spoke ${r.talkShare}% of the words.`);
    const jump = (n) => { const b = node("button", "linklike", `Answer ${n}`); b.onclick = () => { const t = el("fbAns" + n); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }; return b; };
    const body = node("div", "fb-fix"); body.append(node("div", "qb-label", fix.length ? "What to fix first" : "Nothing stands out"));
    const ul = node("ul"); (fix.length ? fix : ["Your answers were direct and clean. Use Say it better on any answer to polish it further."]).forEach(x => ul.append(node("li", "", x))); body.append(ul);
    const rate = r.F / Math.max(1, r.W) * 100;
    const stand = node("p", "fb-key fb-stand", `Your fillers: ${rate.toFixed(1)} per 100 words. Common in real interviews: 8.6. A clean answer: under 2. `);
    const more = node("button", "linklike", "See the common mistakes"); more.onclick = () => el("commonMistakes").scrollIntoView({ behavior: "smooth", block: "start" });
    stand.append(more); body.append(stand);                                        // the common mistakes sit below, on this page
    if (r.strongest) {                                                             // the answer to copy, and the one to redo first
      const p = node("p", "fb-key", "Your strongest: "); p.append(jump(r.strongest.answer), document.createTextNode(` (${r.strongest.score} of 100${r.strongest.why.length ? ": " + r.strongest.why.join(", ") : ""}). `));
      if (r.weakest) p.append(document.createTextNode("Redo first: "), jump(r.weakest.answer), document.createTextNode(` (${r.weakest.score}: ${r.weakest.why.join(", ")}).`));
      body.append(p);
    }
    if (r.noise.words >= 10) body.append(node("p", "fb-key", `Without the noise (fillers, padded "like", repeated words) these answers are ${r.noise.words} words shorter: about ${secsText(r.noise.words)} of speaking, ${r.noise.share}% of what you said.`));
    body.append(node("p", "fb-key", "In your answers below: fillers and hedges are marked, and sentences over 25 words are underlined. Scores are measured from your words."));
    card.append(body); out.append(card);

    // Only answers there is something to say about are listed. The rest get one quiet line at the end.
    const quiet = r.answers.filter(a => stateOf(a) === "quiet"), lost = r.answers.filter(a => a.garbled), both = r.answers.filter(a => a.mixed);
    r.answers.filter(a => !quiet.includes(a) && !a.garbled && !a.mixed).forEach((a, n) => {
      const c = node("section", "qb-group fb-answer"); c.id = "fbAns" + a.no;
      const h = node("div", "qb-group-head"); h.append(node("b", "", `Answer ${a.no}`), node("span", "", `${a.m.words} words · about ${secsText(a.m.words)} aloud${a.score != null ? ` · ${a.score} of 100` : ""}`)); c.append(h);
      const b = node("div", "fb-body");
      if (a.question) { b.append(node("div", "qb-label", "They asked")); b.append(node("p", "fb-q", a.question)); }
      b.append(node("div", "qb-label", "You said")); b.append(marked(a.text));
      // every finding, the costliest first: what it is, the proof in your own words, and what to do
      if (a.findings.length) { const tips = node("ul", "qb-tips"); a.findings.forEach(f => { const li = node("li"); li.append(node("b", "", f.title + ". "), document.createTextNode(f.text)); tips.append(li); }); b.append(tips); }
      else if (a.tips.length) { const tips = node("ul", "qb-tips"); a.tips.forEach(t => tips.append(node("li", "", t))); b.append(tips); }
      if (a.clean && a.clean.cut >= 3) {                                             // your own words with the noise taken out: nothing added, nothing reworded
        const line = node("p", "fb-key", `Your words without the noise: ${a.clean.words} words, ${a.clean.cut} fewer${a.clean.seconds ? `, about ${a.clean.seconds} s shorter` : ""}. `);
        const show = node("button", "linklike", "Show"), box = node("div", "fb-clean"); box.hidden = true;
        box.append(node("p", "fb-q", a.clean.text), node("p", "fb-key", `Taken out: ${removedList(a.clean).join(" · ")}. Nothing was added or reworded.`));
        const reh = node("button", "btn", "Rehearse aloud"); reh.onclick = () => openRehearse(a.clean.text); box.append(reh);
        show.onclick = () => { box.hidden = !box.hidden; show.textContent = box.hidden ? "Show" : "Hide"; };
        line.append(show); b.append(line, box);
      }
      const foot = node("div", "qb-form-foot"), msg = node("span", "qb-form-msg"), go = node("button", "btn", a.better ? "Say it better again" : "Say it better");
      const slot = node("div", "fb-slot"); if (a.fb) paintBetter(slot, a);
      go.onclick = () => improve(a, slot, go, msg);
      foot.append(msg, go); b.append(foot, slot); c.append(b); out.append(c);
    });
    if (quiet.length || lost.length || both.length) {
      const said = [];
      if (quiet.length) said.push(`${quiet.length} short answer${quiet.length > 1 ? "s" : ""} with nothing to fix`);
      if (lost.length) said.push(`${lost.length} part${lost.length > 1 ? "s" : ""} the recording mis-heard, so not judged`);
      if (both.length) said.push(`${both.length} part${both.length > 1 ? "s" : ""} with both sides of the conversation in one block, so not judged`);
      const c = node("section", "qb-group fb-answer"), b = node("div", "fb-body"), line = node("p", "fb-key", `Not listed: ${said.join(" · ")}. `);
      const show = node("button", "linklike", "Show them"), box = node("div", "fb-rest"); box.hidden = true;
      [...quiet, ...lost, ...both].forEach(a => { box.append(node("div", "qb-label", a.garbled ? "Mis-heard" : a.mixed ? "Both sides in one block" : "Nothing to fix"), node("p", "fb-q", a.text.length > 400 ? a.text.slice(0, 400) + "…" : a.text)); });
      show.onclick = () => { box.hidden = !box.hidden; show.textContent = box.hidden ? "Show them" : "Hide them"; };
      line.append(show); b.append(line, box); c.append(b); out.append(c);
    }
    // Every improvement, listed: habit by habit, and under each one every place it happened.
    if (r.improvements.length) {
      const total = r.improvements.reduce((n, g) => n + g.count, 0);
      const c = node("section", "qb-group fb-all"), h = node("div", "qb-group-head"); h.append(node("b", "", "Every improvement, listed"), node("span", "", `${total} in ${r.N} answer${r.N > 1 ? "s" : ""}`)); c.append(h);
      const b = node("div", "fb-body");
      r.improvements.forEach(g => {
        const d = node("details", "fb-imp"); d.open = total <= 12;
        const sm = node("summary"); sm.append(node("b", "", g.title), node("span", "fb-imp-n", `${g.count}×`), node("span", "fb-imp-fix", g.fix)); d.append(sm);
        const ul = node("ul", "qb-tips"); g.where.forEach(w => { const li = node("li"); li.append(jump(w.answer), document.createTextNode(": " + w.text)); ul.append(li); }); d.append(ul); b.append(d);
      });
      c.append(b); out.append(c);
    }
  }
  function paintBetter(slot, a) {
    slot.innerHTML = ""; const f = a.fb; if (!f) return;
    const box = node("div", "fb-coach");
    if (f.verdict) box.append(node("p", "fb-verdict", f.verdict));
    if (f.issues && f.issues.length) { box.append(node("div", "qb-label", "What went wrong in the telling")); const ul = node("ul"); f.issues.forEach(x => ul.append(node("li", "", x))); box.append(ul); }
    if (f.better) {
      box.append(node("div", "qb-label", "Say it like this")); box.append(spoken(f.better));
      const w = words(plain(f.better)).length; box.append(node("div", "qb-stats", `${w} words · about ${secsText(w)} aloud · the small tags are for you, not to be said`));
      const key = legend(f.better); if (key) box.append(key);
    }
    else box.append(node("p", "fb-key", "Kompas will not write a better version of this one: it could not without adding things you did not say. Fix the points above, then say it again."));
    if (f.leadership) { box.append(node("div", "qb-label", "How a senior leader hears it")); box.append(node("p", "", f.leadership)); }
    if (f.better) {
      const foot = node("div", "qb-form-foot"), copy = node("button", "btn ghost", "Copy"), reh = node("button", "btn primary", "Rehearse aloud");
      copy.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(plain(f.better)).then(() => { copy.textContent = "Copied"; setTimeout(() => copy.textContent = "Copy", 1400); }).catch(() => {}); };
      reh.onclick = () => openRehearse(f.better);
      foot.append(copy, reh); box.append(foot);
    }
    slot.append(box);
  }
  async function improve(a, slot, go, msg) {
    go.disabled = true; go.textContent = "Listening back…"; msg.textContent = "";
    let f = null;
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: a.question, answer: a.text, role, fresh: !!a.fb }) });   // "again" asks for a new take; the first ask may be served from the cache
      const d = await r.json(); f = d.feedback || null;
    } catch {}
    go.disabled = false; go.textContent = "Say it better";
    if (!f) { msg.textContent = "Could not write a better version just now. The notes above still apply; try again in a moment."; return; }
    a.fb = f; go.textContent = "Say it better again"; paintBetter(slot, a);
  }

  /* ------------------------------ input ------------------------------ */
  let parsed = null, lastText = null;
  function run() {
    let text = el("fbText").value;
    const pasted = splitSessions(text);                                             // a session export pasted in: keep the spoken lines only
    if (pasted && pasted.length) { text = pasted[0].text; el("fbText").value = text; }
    const sameText = text === lastText; lastText = text;                            // a new transcript gets a fresh guess at who you are
    if (words(text).length < 12) { el("fbMsg").textContent = "Paste a transcript first: at least a few sentences."; report = null; render(); return; }
    parsed = parse(text);
    const guess = guessMe(parsed), need = parsed.labelled && (parsed.speakers.length > 1 || !guess), sel = el("fbMe"), keep = sel.value;
    el("fbMeWrap").classList.toggle("hidden", !need);
    if (need) {
      sel.innerHTML = "";
      if (!guess) { const o = document.createElement("option"); o.value = ""; o.textContent = "not in this transcript"; sel.append(o); }
      parsed.speakers.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = s; sel.append(o); });
      sel.value = sameText && keep && parsed.speakers.includes(keep) ? keep : guess;
    }
    const me = need ? sel.value : (parsed.speakers[0] || "");
    report = analyse(parsed, me);
    el("fbMsg").textContent = report ? "" : parsed.labelled && !me
      ? "Your own voice is not in this transcript: only the other side was captured, so there is nothing of yours to review."
      : "No answer long enough to review. Each answer needs a few sentences.";
    LS.set("fbLast", text.slice(0, 30000));
    render();
    if (report) el("fbReport").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  el("fbGo").onclick = run;
  el("fbMe").onchange = run;
  el("fbClear").onclick = () => { el("fbText").value = ""; el("fbSaved").value = ""; el("fbMeWrap").classList.add("hidden"); el("fbMsg").textContent = ""; report = null; LS.set("fbLast", ""); render(); };

  /* A file instead of pasting: text, Word, PDF, or a meeting transcript export (.vtt / .srt from Teams, Zoom, Meet). */
  // Session exports in Markdown: one "## Transcript" section per file, or many sessions under "## 1. Company — Role — Date"
  // headings; speakers written as "**You · 9:55 PM:** words". Returns [{ title, text }] with only the spoken lines.
  el("fbUpload").onclick = () => el("fbFile").click();
  el("fbFile").onchange = async () => {
    const file = el("fbFile").files && el("fbFile").files[0]; el("fbFile").value = ""; if (!file) return;
    el("fbMsg").textContent = "Reading " + file.name + "…";
    let raw = "";
    try { raw = /\.(pdf|docx?|rtf)$/i.test(file.name) && typeof extractText === "function" ? await extractText(file) : await file.text(); } catch {}
    const found = splitSessions(raw);                                               // a session export: one transcript, or many to choose from
    if (found) {
      const pick = el("fbPick"); pick.innerHTML = ""; el("fbPickField").classList.toggle("hidden", found.length < 2);
      if (!found.length) {                                                          // nothing was captured: clear what the last file left on screen
        el("fbPickField").classList.add("hidden"); el("fbMeWrap").classList.add("hidden"); el("fbText").value = ""; report = null; render();
        el("fbMsg").textContent = "That file has no spoken lines in it: the session was not captured."; return;
      }
      found.forEach((x, n) => { const o = document.createElement("option"); o.value = String(n); o.textContent = x.title; pick.append(o); });
      const load = () => { el("fbSaved").value = ""; role = ""; el("fbText").value = found[Number(pick.value) || 0].text.slice(0, MAX_CHARS); run(); };
      pick.onchange = load; load(); return;
    }
    el("fbPickField").classList.add("hidden");
    const text = normalizeUpload(raw, file.name);
    if (words(text).length < 12) { el("fbMsg").textContent = "Could not read a transcript from that file. Paste the text instead."; return; }
    el("fbSaved").value = ""; role = ""; el("fbText").value = text; run();
  };

  async function fillSaved() {
    // one entry per session: a session has one transcript, however often it was stopped and continued
    const last = (s) => Math.max(...s.transcripts.map(t => t.at));
    const list = (typeof sessions !== "undefined" && Array.isArray(sessions) ? sessions : []).filter(s => (s.transcripts || []).length).sort((a, b) => last(b) - last(a));
    const sel = el("fbSaved"); sel.innerHTML = ""; el("fbSavedField").classList.toggle("hidden", !list.length);
    const none = document.createElement("option"); none.value = ""; none.textContent = "Paste a transcript below"; sel.append(none);
    list.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.dataset.role = s.role || ""; o.textContent = `${s.role || "Session"}${s.company ? " · " + s.company : ""} · ${new Date(last(s)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`; sel.append(o); });
    sel.onchange = async () => {
      if (!sel.value) return;
      role = sel.selectedOptions[0].dataset.role || "";
      const s = list.find(x => String(x.id) === sel.value);
      const t = s && typeof sessionTranscript === "function" ? await sessionTranscript(s) : null;
      if (!t) { el("fbMsg").textContent = "That transcript is no longer stored in this browser."; return; }
      const lines = (t.log || []).filter(e => e.t === "line" && e.text).map(e => `${/^you/i.test(e.who || "") ? "You" : "Them"}: ${e.text}`);
      el("fbText").value = lines.length ? lines.join("\n") : String(t.text || "");
      run();
    };
  }
  function openFeedback() {
    if (!el("fbText").value) el("fbText").value = LS.get("fbLast", "") || "";
    fillSaved(); show("feedback");
  }

  /* ------------------------------ rehearse aloud (Follow along) ------------------------------ */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
  let target = [], at = 0, rec = null, running = false, t0 = 0, tick = null, heardAny = false;
  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function paintRehearse() {
    target.forEach((w, n) => {
      const d = n - at;
      const name = d === 0 ? "read-now" : d < 0 ? "read-past" : d <= 10 ? "read-1" : d <= 22 ? "read-2" : d <= 36 ? "read-3" : "read-far";
      w.span.className = "fb-w " + name;
    });
    const cur = target[Math.min(at, target.length - 1)]; if (cur) cur.span.scrollIntoView({ block: "start", behavior: "smooth" });
    el("fbRehStats").textContent = `${Math.min(at, target.length)} / ${target.length} words · ${mmss(running ? (Date.now() - t0) / 1000 : 0)}`;
  }
  function heard(text) {                                                            // align what was recognised against the script, tolerant of misses
    const said = String(text).split(/\s+/).map(norm).filter(Boolean); let p = 0;
    for (const h of said) for (let k = p; k < Math.min(target.length, p + 6); k++) {
      const t = target[k].n; if (t === h || (t.length > 4 && h.length > 4 && t.slice(0, 4) === h.slice(0, 4))) { p = k + 1; break; }
    }
    if (p > at) { at = p; heardAny = true; paintRehearse(); if (at >= target.length - 1) stopRehearse(); }
  }
  function openRehearse(text) {
    stopRehearse(true);
    const box = el("fbRehText"); box.innerHTML = ""; target = []; at = 0; heardAny = false;
    for (const part of String(text).split(MARKS)) {
      if (!part) continue;
      if (cueOf(part)) { box.append(mark(part), " "); continue; }
      const strong = /^\*[^*]+\*$/.test(part);
      for (const w of words(strong ? part.slice(1, -1) : part)) { const s = node("span", "fb-w", w); if (strong) s.dataset.stress = "1"; target.push({ n: norm(w), span: s }); box.append(s, " "); }
    }
    el("fbRehNote").textContent = SR ? "Press Start and read it aloud. Kompas follows your place and reports your pace. Breathe where it says pause." : "Follow along needs Chrome or Edge. The timer still works: press Start, read it aloud, then Stop.";
    el("fbRehStart").textContent = "Start"; paintRehearse();
    el("fbRehModal").classList.remove("hidden");
  }
  function startRehearse() {
    running = true; t0 = Date.now(); at = 0; heardAny = false; el("fbRehStart").textContent = "Stop";
    tick = setInterval(paintRehearse, 500); paintRehearse();
    if (!SR) return;
    try {
      rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
      rec.onresult = (e) => { let all = ""; for (let i = 0; i < e.results.length; i++) all += " " + e.results[i][0].transcript; heard(all); };
      rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { el("fbRehNote").textContent = "The microphone is blocked, so Kompas cannot follow. The timer still works: press Stop when you finish."; rec = null; } };
      rec.onend = () => { if (running && rec) { try { rec.start(); } catch {} } };
      rec.start();
    } catch { rec = null; }
  }
  function stopRehearse(silent) {
    if (!running) return;
    running = false; clearInterval(tick); tick = null;
    const r = rec; rec = null; if (r) { try { r.onend = null; r.stop(); } catch {} }
    el("fbRehStart").textContent = "Start again";
    if (silent) return;
    const secs = Math.max(1, (Date.now() - t0) / 1000), read = heardAny ? Math.min(at, target.length) : target.length, wpm = Math.round(read / secs * 60);
    target.forEach((w, n) => { w.span.className = "fb-w " + (n < read ? "read-past" : "read-far"); });
    const pace = wpm < 125 ? "A little slow. Keep it moving between the pauses." : wpm > 175 ? "Fast. Take the pauses that are marked, and let the last line land." : "A good speaking pace.";
    el("fbRehStats").textContent = `${read} words in ${mmss(secs)} · ${wpm} words a minute`;
    el("fbRehNote").textContent = pace + (heardAny || !SR ? "" : " (Kompas could not hear you, so this assumes you read all of it.)");
  }
  el("fbRehStart").onclick = () => (running ? stopRehearse() : startRehearse());
  el("fbRehReset").onclick = () => { stopRehearse(true); at = 0; heardAny = false; el("fbRehStart").textContent = "Start"; paintRehearse(); };
  const closeRehearse = () => { stopRehearse(true); el("fbRehModal").classList.add("hidden"); };
  el("fbRehClose").onclick = closeRehearse;
  el("fbRehModal").addEventListener("click", (e) => { if (e.target.id === "fbRehModal") closeRehearse(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el("fbRehModal").classList.contains("hidden")) closeRehearse(); });

  el("navFeedback").onclick = openFeedback;

  window.openFeedback = openFeedback;
  window.kompasRehearse = openRehearse;                                             // the Question Bank's sample answers can be rehearsed the same way
  window.__fbHeard = heard;                                                         // lets a test feed recognised words without a microphone
})();
