/* Kompas Question Bank — preparation, before the day.
   Questions: ones you add, a starter set, or a set generated from a job description (model first, code fallback).
   Coding: classic problems with a test runner that executes your JavaScript in a sandboxed worker.
   Everything is stored on this device (perfact.qbank, perfact.qcode). Loaded after app.js; uses its LS, show() and sessions. */
(() => {
  const el = (id) => document.getElementById(id);
  const CATS = ["Behavioral", "Technical", "System design", "Experience", "Situational", "Motivation"];
  const STARTER = [
    ["Experience", "Tell me about yourself and how your background fits this role."],
    ["Motivation", "Why do you want this role, and why now?"],
    ["Experience", "Walk me through the project you are most proud of. What exactly was your part?"],
    ["Behavioral", "Tell me about a time you disagreed with a teammate or manager. What happened?"],
    ["Behavioral", "Describe a mistake you made at work and what you changed afterwards."],
    ["Behavioral", "Tell me about a time you had to deliver under a tight deadline."],
    ["Situational", "A production issue appears in the middle of a change freeze. What do you do first?"],
    ["Technical", "Pick a system you know well and explain how it works, end to end."],
    ["Technical", "How do you find the root cause when something fails and the logs are not clear?"],
    ["System design", "How would you design a service that has to stay available while one region is down?"],
    ["Behavioral", "Tell me about a time you had to persuade people who did not report to you."],
    ["Motivation", "What questions do you have for us?"],
  ];

  // The STAR set: behavioural questions that each need a story, grouped by what they test. [theme, question, what a strong answer shows]
  const STAR = [
    ["Ownership", "Tell me about a time you took on something outside your job description.", "You act without being asked, and you finish what you start."],
    ["Ownership", "Describe a problem nobody owned. What did you do about it?", "You notice gaps and take them on, not wait for someone to assign them."],
    ["Conflict", "Tell me about a time you disagreed with your manager.", "You disagree with reasons, listen, then commit to the decision."],
    ["Conflict", "Describe a colleague who was hard to work with, and how you handled it.", "You fix the working relationship without blaming the person."],
    ["Failure", "Tell me about a time you failed.", "You name your own part plainly and show what you changed afterwards."],
    ["Failure", "Describe a decision you would make differently today.", "You can judge your own past decisions honestly."],
    ["Pressure", "Tell me about a time you had to deliver with too little time.", "You cut scope deliberately and tell people early."],
    ["Pressure", "Describe the most stressful incident you handled. What did you do first?", "You stay ordered under stress: check, decide, communicate."],
    ["Leadership", "Tell me about a time you led without having authority.", "People followed you because of your reasoning, not your title."],
    ["Leadership", "Describe a time you had to give bad news to someone senior.", "You bring bad news early, with the facts and a next step."],
    ["Influence", "Tell me about a time you changed someone's mind with evidence.", "You persuade with data and their concerns, not with volume."],
    ["Customer", "Tell me about a time you went out of your way for a customer or user.", "You start from what the user needs, even when it costs you effort."],
    ["Judgment", "Describe a time you had to decide without all the information.", "You say what you knew, what you assumed, and how you limited the risk."],
    ["Judgment", "Tell me about a calculated risk you took.", "You weigh the downside and have a way back if it goes wrong."],
    ["Learning", "Tell me about something you had to learn quickly.", "You have a method for learning, and you applied it to real work."],
    ["Learning", "Describe feedback that changed how you work.", "You take criticism without defending yourself, and act on it."],
    ["Simplifying", "Tell me about a time you made something simpler.", "You remove steps and complexity instead of adding to them."],
    ["Standards", "Describe a time you refused to cut a corner.", "You hold a standard under pressure and can explain why it mattered."],
    ["Teamwork", "Tell me about a time you helped a teammate succeed.", "You put the team's result ahead of your own credit."],
    ["Results", "What result are you most proud of, and how did you get it?", "You can connect what you did to a measurable outcome."],
  ];

  // How to answer, by question type: shown at once; the model then adds the points specific to the question.
  const GUIDES = {
    Behavioral: { lookingFor: "How you act under pressure, whether you own your part, and what you learned.",
      structure: ["Put them in the moment: \"We were in the middle of…\"", "Say what fell to you: \"I had to…\"", "Say what you did first, then next: \"I started by…\" (most of the answer)", "Say how it ended, good or bad: the impact, what stayed stuck, the consequences", "Say what changed afterwards"],
      pitfalls: ["Announcing the parts aloud (\"Situation… Task… Action… Result…\"): tell it as one story", "Saying \"we\" all the way through, so your own part is unclear", "A long setup and a rushed ending", "Blaming the other person"] },
    Experience: { lookingFor: "Whether you really did the work on your resume, and at what depth.",
      structure: ["Where and when it was", "Your exact part in it", "The hardest problem and how you solved it", "How it turned out"],
      pitfalls: ["Listing tools without saying what you did with them", "Describing the team's work as your own"] },
    Technical: { lookingFor: "That you understand how it works, not only that you have used it.",
      structure: ["Answer directly in the first sentence", "Explain how it works, in order", "Give one real example from your own work", "Name a limit or trade-off"],
      pitfalls: ["Reciting a definition with no example", "Guessing: say what you know, then how you would find the rest"] },
    "System design": { lookingFor: "How you break down a large problem and reason about trade-offs.",
      structure: ["Ask about scale and constraints first", "Sketch the main parts and how data moves between them", "Go deep on the hardest part", "Say what fails first and how you would notice", "Name the trade-offs you chose"],
      pitfalls: ["Starting to design before asking any questions", "Naming technologies without saying why"] },
    Situational: { lookingFor: "Your judgment: what you check first, and who you involve.",
      structure: ["Say what you would check first", "Decide, and say why", "Say who you would tell and when", "Say how you would confirm it worked"],
      pitfalls: ["Jumping to a fix without finding out what happened", "Forgetting to tell anyone"] },
    Motivation: { lookingFor: "That you want this job in particular, and will stay.",
      structure: ["What draws you to the work itself", "One specific thing about this company or team", "How your background fits it", "Keep it under a minute"],
      pitfalls: ["An answer that would fit any company", "Talking only about what you get, not what you bring"] },
  };

  // The built-in library (qbank-library.js): thirty questions asked almost everywhere, a practice set for each company
  // whose way of interviewing is public, and the lists that finish a job title or a company as it is typed.
  const LIB = window.KOMPAS_LIBRARY || { titles: [], companies: [], common: [], sets: {} };
  // A company's own set, when the library has one: "amazon", "Amazon" and "Amazon Web Services" all find Amazon's.
  const librarySet = (company) => {
    const want = key(company);
    if (want.length < 3) return null;
    const name = Object.keys(LIB.sets).find(n => { const k = key(n); return k === want || want.startsWith(k + " ") || (want.length >= 4 && k.startsWith(want)); });
    return name ? { name, basis: LIB.sets[name].basis, questions: LIB.sets[name].questions } : null;
  };

  // Finishing a title or a company for the person. The owner: "keep it empty when user is entering": so the box holds
  // nothing but what they type (no example that reads like an answer), and the list is offered only once they have typed
  // a letter. A list of 350 names dropping open on an empty box is noise, not help.
  (function suggestions() {
    const lists = { kompasCompanies: LIB.companies, kompasTitles: LIB.titles };
    for (const [id, values] of Object.entries(lists)) {
      if (!values.length || el(id)) continue;
      const list = document.createElement("datalist"); list.id = id;
      for (const v of values) { const o = document.createElement("option"); o.value = v; list.append(o); }
      document.body.append(list);
    }
    const fields = { company: "kompasCompanies", qbCompany: "kompasCompanies", qbGenCompany: "kompasCompanies", role: "kompasTitles", qbRole: "kompasTitles", qbGenRole: "kompasTitles" };
    for (const [id, list] of Object.entries(fields)) {
      const input = el(id);
      if (!input || !lists[list].length) continue;
      input.placeholder = "";
      input.setAttribute("autocomplete", "off");
      const offer = () => { if (input.value.trim()) input.setAttribute("list", list); else input.removeAttribute("list"); };
      input.addEventListener("input", offer); input.addEventListener("focus", offer);
    }
  })();

  let bank = { items: [] }, code = {}, tab = "questions", flash = "";
  const resumes = () => (typeof docsGet === "function" ? docsGet() : []).filter(d => d.kind === "resume" && d.text && !d.error);
  const activeResume = () => resumes().find(d => d.primary) || resumes()[0] || null;
  const loadAll = () => {
    const b = LS.get("qbank", null); bank = b && Array.isArray(b.items) ? b : { items: [] };
    const c = LS.get("qcode", null); code = c && typeof c === "object" ? c : {};
  };
  const save = () => LS.set("qbank", bank);
  const saveCode = () => LS.set("qcode", code);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const key = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  function addItems(list, meta, limit = Infinity) {
    const have = new Set(bank.items.map(q => key(q.text))); let n = 0;
    for (const q of list) {
      if (n >= limit) break;
      const text = String(q.text || "").replace(/\s+/g, " ").trim(), k = key(text);
      if (text.length < 8 || have.has(k)) continue; have.add(k);
      bank.items.push({ id: uid(), text, category: CATS.includes(q.category) ? q.category : "Technical",
        company: String(meta.company || "").trim(), role: String(q.role || meta.role || "").trim(), source: meta.source, createdAt: Date.now(), practiced: 0, answer: "",
        ...(q.hint ? { hint: String(q.hint) } : {}) });
      n++;
    }
    if (n) save();
    return n;
  }

  /* ------------------------------ page ------------------------------ */
  function openQbank() { loadAll(); el("qbAddForm").classList.add("hidden"); render(); show("qbank"); resumes().forEach(fromResume); }

  /* A resume seeds its own question set, once: on upload (app.js calls qbankFromResume) or the first time the bank opens. */
  async function fromResume(doc) {
    if (!doc || !doc.text) return;
    const done = LS.get("qbankResumes", []) || [];
    if (done.includes(doc.id)) return;
    LS.set("qbankResumes", [...done, doc.id]);                                      // marked first, so a second call cannot run it twice
    const list = await fetchQuestions({ mode: "resume", resume: doc.text.slice(0, 7000), count: 10 });
    loadAll();
    const n = addItems(list.length ? list : localQuestions(doc.text, "", ""), { company: "My resume", role: doc.name.replace(/\.[a-z0-9]+$/i, ""), source: "resume" }, 10);
    if (n && !el("view-qbank").classList.contains("hidden")) { flash = `Added ${n} questions from your resume.`; render(); }
  }
  async function fetchQuestions(body) {
    try {
      const r = await fetch("/api/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); return Array.isArray(d.questions) ? d.questions : [];
    } catch { return []; }
  }
  function setTab(t) {
    tab = t; el("qbSearch").value = "";
    el("qbTabs").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === t));
    el("qbAddForm").classList.add("hidden");
    renderFilter(); render();
  }
  function renderFilter() {
    const sel = el("qbFilter"), opts = tab === "coding" ? ["All levels", "Easy", "Medium"] : ["All categories", ...CATS];
    sel.innerHTML = ""; opts.forEach((o, i) => { const op = document.createElement("option"); op.value = i ? o : ""; op.textContent = o; sel.append(op); });
  }
  function render() {
    const coding = tab === "coding";
    el("qbAdd").classList.toggle("hidden", coding);
    el("qbGen").classList.toggle("hidden", coding);
    el("qbSearch").placeholder = coding ? "Search problems" : "Search questions";
    el("qbSub").textContent = coding
      ? "Classic interview problems. Write your solution, run the tests, and check the reference when you are done."
      : "Practice the questions before the day. Add your own, or build a set from a job description.";
    const list = el("qbList"); list.innerHTML = "";
    if (flash) { const f = document.createElement("div"); f.className = "qb-flash"; f.textContent = flash; list.append(f); flash = ""; }
    if (coding) renderCoding(list); else renderQuestions(list);
  }

  function filtered() {
    const q = key(el("qbSearch").value), cat = el("qbFilter").value;
    return bank.items.filter(i => (!cat || i.category === cat) && (!q || key(i.text + " " + i.company + " " + i.role).includes(q)))
      .sort((a, b) => (a.practiced ? 1 : 0) - (b.practiced ? 1 : 0) || a.createdAt - b.createdAt);        // not yet practiced first
  }

  function renderQuestions(list) {
    const items = filtered(), empty = el("qbEmpty");
    empty.classList.toggle("hidden", items.length > 0);
    el("qbEmptyText").textContent = bank.items.length ? "No questions match." : "No questions yet.";
    el("qbStarter").classList.toggle("hidden", bank.items.length > 0);
    const groups = new Map();
    for (const i of items) { const g = i.company || "General"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
    for (const [company, rows] of groups) {
      const card = document.createElement("section"); card.className = "qb-group";
      const head = document.createElement("div"); head.className = "qb-group-head";
      const name = document.createElement("b"); name.textContent = company;
      const meta = document.createElement("span"); const done = rows.filter(r => r.practiced).length;
      meta.textContent = `${rows.length} question${rows.length > 1 ? "s" : ""} · ${done} practiced`;
      head.append(name, meta); card.append(head);
      rows.forEach((i, n) => card.append(questionRow(i, n + 1)));
      list.append(card);
    }
  }
  function questionRow(i, n) {
    const row = document.createElement("div"); row.className = "qb-row" + (i.practiced ? " done" : "");
    const num = document.createElement("span"); num.className = "qb-num"; num.textContent = String(n).padStart(2, "0");
    const main = document.createElement("div"); main.className = "qb-main";
    const text = document.createElement("div"); text.className = "qb-text"; text.textContent = i.text;
    const meta = document.createElement("div"); meta.className = "qb-meta";
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = i.category; meta.append(chip);
    if (i.role) { const r = document.createElement("span"); r.textContent = i.role; meta.append(r); }
    if (i.practiced) { const p = document.createElement("span"); p.className = "qb-done"; p.textContent = `✓ practiced ${i.practiced}×`; meta.append(p); }
    main.append(text, meta);
    const actions = document.createElement("div"); actions.className = "qb-actions";
    const go = document.createElement("button"); go.className = "btn"; go.textContent = "Practice"; go.onclick = () => openPractice(i.id);
    const del = document.createElement("button"); del.className = "icon-btn"; del.title = "Remove this question"; del.setAttribute("aria-label", "Remove this question"); del.textContent = "✕";
    del.onclick = () => { bank.items = bank.items.filter(x => x.id !== i.id); save(); render(); };
    actions.append(go, del);
    row.append(num, main, actions);
    return row;
  }

  /* ------------------------------ add / starter ------------------------------ */
  el("qbAdd").onclick = () => {
    const f = el("qbAddForm"), opening = f.classList.contains("hidden");
    f.classList.toggle("hidden", !opening); el("qbAddMsg").textContent = "";
    if (opening) { el("qbText").value = ""; el("qbText").focus(); }
  };
  el("qbAddCancel").onclick = () => el("qbAddForm").classList.add("hidden");
  el("qbAddSave").onclick = () => {
    const text = el("qbText").value.trim();
    if (text.length < 8) { el("qbAddMsg").textContent = "Type the question first."; el("qbText").focus(); return; }
    const n = addItems([{ text, category: el("qbCategory").value }], { company: el("qbCompany").value, role: el("qbRole").value, source: "added" });
    if (!n) { el("qbAddMsg").textContent = "That question is already in your bank."; return; }
    el("qbAddForm").classList.add("hidden"); flash = "Question added."; render();
  };
  el("qbStarter").onclick = () => { const n = addItems(STARTER.map(([category, text]) => ({ category, text })), { source: "starter" }); flash = `Added ${n} common questions.`; render(); };

  /* ------------------------------ generate from a job description ------------------------------ */
  const STOP = new Set("the and for with you your our are will this that from have has was were not but all any can may who how what when where why which their them they his her its into out per via etc able must should would could within across about over under more most other such than then also both each been being work working role team teams years year experience strong good great ability skills skill knowledge including include includes required requirements preferred responsibilities responsible job description company position candidate looking join using used use new well high level based plus one two three".split(" "));
  // Technology and product names only: an acronym (AWS, PSM), an inner capital or digit (CyberArk, GuardDuty, S3),
  // or a capital that is not just the start of a sentence. Words of the role and company themselves are skipped.
  function keywords(jd, skip, max = 6) {
    const count = new Map(), shape = new Map(), strong = new Map();
    const avoid = new Set(String(skip || "").toLowerCase().match(/[a-z0-9+#]+/g) || []);
    const re = /[A-Za-z][A-Za-z0-9+#]{1,24}/g, text = String(jd); let m, run = null;
    const flush = () => {                                                           // a run of adjacent names is one phrase: "Security Hub", "REST API"
      if (run && run.own) {
        const phrase = run.words.join(" "), k = phrase.toLowerCase();
        count.set(k, (count.get(k) || 0) + 1);
        if (run.best >= (strong.get(k) || 0)) { strong.set(k, run.best); shape.set(k, phrase); }
      }
      run = null;
    };
    while ((m = re.exec(text))) {
      const w = m[0], k = w.toLowerCase();
      const before = text.slice(Math.max(0, m.index - 2), m.index);
      const sentenceStart = m.index === 0 || /[.!?:\n]\s?$/.test(before);
      const name = STOP.has(k) ? 0 : /^[A-Z][A-Z0-9+#]{1,7}$/.test(w) ? 3 : /[A-Z0-9]/.test(w.slice(1)) ? 3 : (/^[A-Z]/.test(w) && !sentenceStart) ? 2 : 0;
      const adjacent = run && m.index === run.end + 1 && text[run.end] === " " && run.words.length < 3;
      if (!name) { flush(); continue; }
      if (!adjacent) { flush(); run = { words: [], end: 0, best: 0, own: false }; }
      run.words.push(w); run.end = m.index + w.length; run.best = Math.max(run.best, name);
      if (!avoid.has(k)) run.own = true;                                            // a phrase made only of the role's own words is not a technology
    }
    flush();
    const named = [...count.keys()].sort((x, y) => (strong.get(y) + count.get(y)) - (strong.get(x) + count.get(x)));
    return named.slice(0, max).map(k => shape.get(k));
  }
  function localQuestions(jd, role, company, count) {
    const kw = keywords(jd, role + " " + company), r = role || "this role", out = [];
    const tech = [
      (k) => `How have you used ${k} in production, and what went wrong the first time?`,
      (k) => `Walk me through how ${k} works under the hood.`,
      (k) => `What would you check first if ${k} started failing after a change?`,
    ];
    kw.forEach((k, n) => out.push({ category: "Technical", text: tech[n % tech.length](k) }));
    if (kw[0]) out.push({ category: "Experience", text: `Tell me about a project where ${kw[0]} was central. What was your part?` });
    if (kw[1]) out.push({ category: "System design", text: `How would you design ${kw[1]} for a team ten times the size, and what breaks first?` });
    out.push(
      { category: "Motivation", text: `Why ${company || "this company"}, and why the ${r} role now?` },
      { category: "Behavioral", text: "Tell me about a time you disagreed with a teammate or manager. What happened?" },
      { category: "Situational", text: "A production issue appears in the middle of a change freeze. What do you do first?" },
      { category: "Behavioral", text: "Describe a mistake you made at work and what you changed afterwards." },
      { category: "Experience", text: `What in your background makes you ready for ${r}?` },
      { category: "Behavioral", text: "Tell me about a time you had to deliver under a tight deadline." },
      { category: "Situational", text: "You inherit a system with no documentation and an owner who has left. How do you start?" },
      { category: "Behavioral", text: "Tell me about a time you had to persuade people who did not report to you." },
      { category: "Technical", text: "How do you find the root cause when something fails and the logs are not clear?" },
      { category: "Situational", text: "Two urgent requests arrive at once and you can only do one today. How do you choose?" },
      { category: "Behavioral", text: "Tell me about feedback that was hard to hear, and what you did with it." },
      { category: "Experience", text: "Which part of this job have you done least, and how would you close that gap?" },
      { category: "Situational", text: "A change you made caused an outage. Walk me through the next hour." },
      { category: "Motivation", text: "What would make you leave a role like this one?" },
    );
    return out;                                                                    // the caller keeps the first `count` that are new
  }

  function openGen() {
    const withJd = (typeof sessions !== "undefined" && Array.isArray(sessions) ? sessions : []).filter(s => (s.jd || "").trim().length > 40);
    const sel = el("qbGenSession"); sel.innerHTML = "";
    el("qbGenSessionField").classList.toggle("hidden", withJd.length === 0);
    const none = document.createElement("option"); none.value = ""; none.textContent = "Paste a job description below"; sel.append(none);
    withJd.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = (s.role || "Untitled role") + (s.company ? " · " + s.company : ""); sel.append(o); });
    sel.onchange = () => { const s = withJd.find(x => x.id === sel.value); if (!s) return; el("qbGenCompany").value = s.company || ""; el("qbGenRole").value = s.role || ""; el("qbGenJd").value = s.jd || ""; };
    const rs = el("qbGenResume"); rs.innerHTML = "";
    resumes().forEach(d => { const o = document.createElement("option"); o.value = d.id; o.textContent = d.name + (d.primary ? " (active)" : ""); rs.append(o); });
    el("qbGenMsg").textContent = ""; el("qbGenGo").textContent = "Generate";
    el("qbGenModal").classList.remove("hidden");
    setSource(genSource);
  }
  // one dialog, three sources: a job description, your own resume, or a company's usual questions
  let genSource = "jd";
  const SOURCE_NOTE = {
    jd: "Questions an interviewer would ask for this job.",
    resume: "Questions an interviewer would ask after reading your resume.",
    company: "Typical questions for this company and role, from what is publicly known about how it interviews.",
    common: "The 30 questions asked in almost every interview, each with what a strong answer shows. Practice them first: most interviews open with five of these.",
    star: "20 behavioural questions that each need a story, grouped by what they test. Tell each as one story: the moment, what fell to you, what you did, how it ended. Never say the labels aloud.",
  };
  function setSource(v) {
    genSource = v;
    el("qbGenSource").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    const noResume = v === "resume" && resumes().length === 0;
    el("qbGenNote").textContent = noResume ? "Add a resume on the Resume page first." : SOURCE_NOTE[v];
    el("qbGenJdField").classList.toggle("hidden", v !== "jd");
    el("qbGenResumeField").classList.toggle("hidden", v !== "resume" || noResume);
    el("qbGenSessionField").classList.toggle("hidden", v !== "jd" || el("qbGenSession").options.length < 2);
    const builtIn = v === "star" || v === "common";                                 // a built-in set needs no company, role or count
    el("qbGenWho").classList.toggle("hidden", builtIn);
    el("qbGenCountWrap").classList.toggle("hidden", builtIn);
    el("qbGenGo").textContent = v === "star" ? "Add the STAR set" : v === "common" ? "Add the 30" : "Generate";
    el("qbGenGo").disabled = noResume; el("qbGenMsg").textContent = "";
  }
  el("qbGenSource").querySelectorAll("button").forEach(b => b.onclick = () => setSource(b.dataset.v));
  const closeGen = () => el("qbGenModal").classList.add("hidden");
  el("qbGen").onclick = openGen; el("qbGenClose").onclick = closeGen; el("qbGenCancel").onclick = closeGen;
  el("qbGenGo").onclick = async () => {
    const jd = el("qbGenJd").value.trim(), role = el("qbGenRole").value.trim(), company = el("qbGenCompany").value.trim(), count = Number(el("qbGenCount").value) || 12;
    const mode = genSource, doc = resumes().find(d => d.id === el("qbGenResume").value) || activeResume();
    if (mode === "star") {                                                          // no model call: the set is built in
      const added = addItems(STAR.map(([theme, text, hint]) => ({ category: "Behavioral", text, role: theme, hint })), { company: "STAR stories", source: "star" });
      if (!added) { el("qbGenMsg").textContent = "The STAR set is already in your bank."; return; }
      closeGen(); flash = `Added ${added} STAR questions.`; render(); return;
    }
    if (mode === "common") {                                                        // no model call: the set is built in
      const added = addItems(LIB.common.map(([category, text, hint]) => ({ category, text, hint })), { company: "Common 30", source: "common" });
      if (!added) { el("qbGenMsg").textContent = LIB.common.length ? "The 30 common questions are already in your bank." : "The built-in questions did not load. Reload the page."; return; }
      closeGen(); flash = `Added ${added} common questions. Each one says what a strong answer shows.`; render(); return;
    }
    if (mode === "jd" && jd.length < 40 && !role) { el("qbGenMsg").textContent = "Paste a job description, or at least type the role."; return; }
    if (mode === "company" && !company) { el("qbGenMsg").textContent = "Type the company first."; el("qbGenCompany").focus(); return; }
    if (mode === "resume" && !doc) { el("qbGenMsg").textContent = "Add a resume on the Resume page first."; return; }
    const known = mode === "company" ? librarySet(company) : null;
    const fromLibrary = known ? addItems(known.questions.map(([category, text, hint, tests]) => ({ category, text, hint, role: tests })), { company: known.name, role, source: "library" }) : 0;
    const go = el("qbGenGo"); go.disabled = true; go.textContent = "Writing questions…"; el("qbGenMsg").textContent = "";
    const source = mode === "resume" ? doc.text : mode === "jd" ? jd : "";          // the text the code-only fallback reads its terms from
    let list = await fetchQuestions({ mode, company, role, jd, count, resume: mode === "resume" ? doc.text.slice(0, 7000) : "" }), how = "";
    if (!list.length) { list = localQuestions(source, role, company, count); how = mode === "company" ? " (general questions for the role)" : " (built from the text's own terms)"; }
    const meta = { company: (known && known.name) || company || (mode === "resume" ? "My resume" : ""), role, source: how ? "generated-local" : "generated" };
    let n = addItems(list, meta, count);
    if (n < count && !how) n += addItems(localQuestions(source, role, company, count), { ...meta, source: "generated-local" }, count - n);   // top up, never short
    go.disabled = false; go.textContent = "Generate";
    if (!n && !fromLibrary) { el("qbGenMsg").textContent = "Those questions are already in your bank."; return; }
    // What the built-in set rests on is said, so a practice question is never mistaken for a record of what was asked.
    closeGen(); flash = fromLibrary ? `Added ${fromLibrary + n} questions for ${known.name}. ${known.basis}` : `Added ${n} question${n > 1 ? "s" : ""}${how}.`; render();
  };

  /* ------------------------------ practice a question ------------------------------ */
  let pracId = "", timer = null, secs = 0;
  const clock = () => { el("qbPracClock").textContent = String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0"); };
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } el("qbPracStart").textContent = secs ? "Resume timer" : "Start timer"; }
  el("qbPracStart").onclick = () => { if (timer) return stopTimer(); timer = setInterval(() => { secs++; clock(); }, 1000); el("qbPracStart").textContent = "Pause timer"; };
  el("qbPracReset").onclick = () => { stopTimer(); secs = 0; clock(); el("qbPracStart").textContent = "Start timer"; };

  // one judgement for typed and spoken practice, shared with What went wrong and with /api/practice
  const feedback = window.KompasReviewCore.practice;
  function paintFeedback() {
    const i = bank.items.find(x => x.id === pracId); if (!i) return;
    const f = feedback(el("qbPracAnswer").value, i.category, i.spokenSecs || 0, i.text);
    el("qbPracStats").textContent = f.stats.join(" · ");
    const ul = el("qbPracTips"); ul.innerHTML = ""; f.tips.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.append(li); });
    // How it would sound to a listener: the rules measured on the interviews (score-core.js, the same code as /api/score),
    // how many it passes, and the three most important things to change. What the review above already said is not said
    // again. No resume is sent: a person's own answer holds things their resume does not, and they are theirs to say.
    const S = window.KompasScore, own = el("qbPracAnswer").value;
    if (S && own.trim()) {
      const judged = S.score(own, { question: i.text });
      if (judged.enough) {
        const said = f.tips.join(" ");
        const skip = new Set([...(/sentence/i.test(said) ? ["sentences", "runOn"] : []), ...(/about a minute/i.test(said) ? ["length"] : [])]);
        const add = (t) => { const li = document.createElement("li"); li.textContent = t; ul.append(li); };
        add(judged.say);
        judged.rules.filter(r => !r.passed && !skip.has(r.id)).slice(0, 3).forEach(r => add(r.fix));
      }
    }
  }
  /* Answer aloud: the browser writes down what you say and the clock runs, so pace is measured for real. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let speaking = false, rec = null, finals = "";
  const sentence = (t) => { const s = t.replace(/\s+/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : ""; };
  function heardSpoken(finalText, interim) {                                        // a new take replaces the old answer only once words arrive
    const i = bank.items.find(x => x.id === pracId); if (!i) return;
    finals = finalText;
    const text = sentence(finalText + " " + (interim || "")); if (!text) return;
    el("qbPracAnswer").value = text; i.answer = sentence(finalText) || text; save();
  }
  function stopSpeaking(keep = true) {
    if (!speaking) return;
    speaking = false; const r = rec; rec = null; if (r) { try { r.onend = null; r.stop(); } catch {} }
    stopTimer(); el("qbPracSpeak").textContent = "Answer aloud"; el("qbPracSpeak").classList.remove("on");
    const i = bank.items.find(x => x.id === pracId);
    if (i && keep && finals.trim()) { i.answer = sentence(finals); i.spokenSecs = Math.max(1, secs); el("qbPracAnswer").value = i.answer; save(); }
    paintFeedback();
  }
  function startSpeaking() {
    if (!SR) { el("qbPracMsg").textContent = "Answer aloud needs Chrome or Edge. You can still type your answer."; return; }
    stopTimer(); secs = 0; clock(); finals = ""; speaking = true; el("qbPracMsg").textContent = "";
    el("qbPracSpeak").textContent = "Stop"; el("qbPracSpeak").classList.add("on");
    timer = setInterval(() => { secs++; clock(); }, 1000); el("qbPracStart").textContent = "Pause timer";
    try {
      rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
      rec.onresult = (e) => { let done = "", live = ""; for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (done += " " + e.results[k][0].transcript) : (live += " " + e.results[k][0].transcript)); heardSpoken(done, live); };
      rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { stopSpeaking(false); el("qbPracMsg").textContent = "The microphone is blocked. Allow it in the address bar, or type your answer."; } };
      rec.onend = () => { if (speaking && rec) { try { rec.start(); } catch {} } };
      rec.start();
    } catch { stopSpeaking(false); el("qbPracMsg").textContent = "Could not start the microphone. You can still type your answer."; }
  }
  el("qbPracSpeak").onclick = () => (speaking ? stopSpeaking() : startSpeaking());
  window.__qbHeard = (text, seconds) => { speaking = true; heardSpoken(text, ""); secs = seconds; clock(); stopSpeaking(); };   // lets a test stand in for the microphone

  function openPractice(id) {
    const i = bank.items.find(x => x.id === id); if (!i) return;
    stopSpeaking(false);
    pracId = id; stopTimer(); secs = 0; clock(); el("qbPracStart").textContent = "Start timer";
    el("qbPracCat").textContent = i.category;
    el("qbPracWho").textContent = [i.role, i.company].filter(Boolean).join(" · ");
    el("qbPracQ").textContent = i.text;
    el("qbPracAnswer").value = i.answer || ""; el("qbPracMsg").textContent = "";
    el("qbPracGuide").classList.add("hidden"); el("qbPracGuideBtn").textContent = "How to answer";
    paintFeedback();
    el("qbPracticeModal").classList.remove("hidden");
    showPrepared(i);
  }
  function sayPrepared(t) {
    if (!window.KompasCorrect) return t;
    const cleaned = window.KompasCorrect.correct(t);
    return window.KompasCorrect.speak ? window.KompasCorrect.speak(cleaned) : cleaned;
  }
  // The prepared answer, laid out to be said (pace-core.js): a dot where a short pause falls, a new line where the speaker
  // stops for a second because a new part begins. The words are the engine's, unchanged; only the layout is added here.
  // Before this it was one block of small grey type, which is how nobody speaks and why it was hard to follow aloud.
  function showPaced(box, text, about) {
    const P = window.KompasPace;
    let note = el("qbPracPace");
    if (!P || !text) { box.textContent = text || ""; if (note) note.textContent = ""; return; }
    box.style.whiteSpace = "pre-line";
    // Every other question opens with a starting word ("So,", "Well,"), the way people begin an answer (owner, 12 Oct 2026).
    // It goes in front; the answer after it is the engine's, word for word.
    const said = about && Number.isInteger(about.turn) && P.opened ? P.opened(text, about.turn) : text;
    box.textContent = P.marked(said);
    if (!note) { note = document.createElement("p"); note.id = "qbPracPace"; note.className = "muted small"; box.insertAdjacentElement("afterend", note); }
    let line = `${P.timeText(said)} said aloud. A dot is a short pause. A new line is a stop for a second: a new part begins.`;
    // The prepared answer is written for the person, not by them. On a question about their own work, anything it names
    // that their resume does not is pointed out (score-core.js): only what is true of them is theirs to say.
    const S = window.KompasScore;
    if (S && about && about.resume && S.aboutOf(about.question) === "own") {
      const extra = S.measure(text, about).notInResume;
      if (extra && extra.count > S.LIMIT.notInResume) line += ` It names things your resume does not: ${[...extra.numbers, ...extra.names].slice(0, 5).join(", ")}. Check each is true of your own work before you say it.`;
    }
    note.textContent = line;
  }
  async function showPrepared(i) {
    const box = el("qbPracPrepared"), sel = el("qbPracLevel");
    if (!box || !sel || !i || !window.KompasDiamond || !window.KompasLevels || !window.KompasAnchors) return;
    const level = sel.value || "engineer";
    const resume = (typeof activeResume === "function" && activeResume() && activeResume().text) || "";
    if (!i.anchors) {
      const pack = await window.KompasAnchors.load(i.text, i.role || "", resume);
      i.anchors = (pack && pack.anchors) || {};
    }
    if (pracId !== i.id) return;
    const plan = window.KompasDiamond.plan(level, i.anchors, level);
    if (plan.ready) {
      showPaced(box, sayPrepared(window.KompasLevels.textFor(i.anchors, level, level)), { question: i.text, resume, turn: bank.items.indexOf(i) });
      if (!plan.otherReady) fillPractice(i, plan.other, resume);
      return;
    }
    showPaced(box, ""); box.textContent = "Preparing the " + (plan.from === "director" ? "Director" : "Engineer") + " answer…";
    await fillPractice(i, plan.from, resume);
    if (pracId !== i.id) return;
    const shown = sayPrepared(window.KompasLevels.textFor(i.anchors, level, level));
    if (shown) showPaced(box, shown, { question: i.text, resume, turn: bank.items.indexOf(i) });
    if (i.anchors && !i.anchors[plan.other]) fillPractice(i, plan.other, resume);
  }
  async function fillPractice(i, anchor, resume) {
    if (!window.KompasDiamond.ANCHORS.includes(anchor)) return;
    if (i.anchors && i.anchors[anchor] && i.anchors[anchor].prose) return;
    i._filling = i._filling || {};
    if (i._filling[anchor]) return;
    i._filling[anchor] = true;
    try {
      const cv = typeof activeResume === "function" ? activeResume() : null;
      const text = await window.KompasAnchors.fetchProse(i.text, anchor, {
        config: { interviewer: anchor, role: i.role || "", resume: resume || (cv && cv.text) || "", mode: "technical", length: "balanced", difficulty: "standard" },
      });
      if (!text) return;
      const shaped = window.KompasLevels.fromProse(text, anchor);
      if (!shaped) return;
      i.anchors = i.anchors || {};
      i.anchors[anchor] = shaped;
      await window.KompasAnchors.save(i.text, i.role || "", resume || "", i.anchors);
    } catch {} finally { i._filling[anchor] = false; }
  }
  el("qbPracLevel").onchange = () => {
    const i = bank.items.find(x => x.id === pracId); if (!i) return;
    const level = el("qbPracLevel").value;
    const plan = window.KompasDiamond && window.KompasDiamond.plan(level, i.anchors || {}, level);
    if (plan && plan.ready && window.KompasLevels) {
      el("qbPracPrepared").textContent = sayPrepared(window.KompasLevels.textFor(i.anchors, level, level));
      if (!plan.otherReady) fillPractice(i, plan.other, (typeof activeResume === "function" && activeResume() && activeResume().text) || "");
      return;
    }
    showPrepared(i);
  };

  /* How to answer: the built-in guide for the question type appears at once; points specific to the question follow. */
  function paintGuide(i, loading) {
    const box = el("qbPracGuide"); box.innerHTML = "";
    const base = GUIDES[i.category] || GUIDES.Technical, g = i.guide || {};
    const add = (title, v, ordered) => {
      if (!v || (Array.isArray(v) && !v.length)) return;
      const sec = document.createElement("div"); sec.className = "qb-guide-sec";
      const h = document.createElement("div"); h.className = "qb-label"; h.textContent = title; sec.append(h);
      if (Array.isArray(v)) { const list = document.createElement(ordered ? "ol" : "ul"); v.forEach(x => { const li = document.createElement("li"); li.textContent = x; list.append(li); }); sec.append(list); }
      else { const p = document.createElement("p"); p.textContent = v; sec.append(p); }
      box.append(sec);
    };
    const checking = g.lookingFor && !/\?\s*$/.test(g.lookingFor) ? g.lookingFor : "";       // a restated question is not an answer to "what are they checking"
    add("What they are checking", checking || i.hint || base.lookingFor);
    add("Order to answer in", g.structure && g.structure.length ? g.structure : base.structure, true);
    add("Points to include", g.keyPoints);
    add("Avoid", g.pitfalls && g.pitfalls.length ? g.pitfalls : base.pitfalls);
    add("Find your own story", g.yourStory);                                       // a personal event is never written for you
    add("Sample answer", g.sample);
    const foot = document.createElement("div"); foot.className = "qb-guide-foot";
    foot.textContent = loading ? "Adding points for this question…" : g.sample ? "A starting point. Put it in your own words before the day." : "";
    if (foot.textContent) box.append(foot);
    if (g.sample && !loading && typeof window.kompasRehearse === "function") {        // read it aloud with Follow along, as on the Feedback page
      const reh = document.createElement("button"); reh.className = "btn"; reh.textContent = "Rehearse aloud"; reh.onclick = () => window.kompasRehearse(g.sample);
      box.append(reh);
    }
  }
  el("qbPracGuideBtn").onclick = async () => {
    const i = bank.items.find(x => x.id === pracId), box = el("qbPracGuide"), btn = el("qbPracGuideBtn"); if (!i) return;
    if (!box.classList.contains("hidden")) { box.classList.add("hidden"); btn.textContent = "How to answer"; return; }
    box.classList.remove("hidden"); btn.textContent = "Hide guide";
    if (i.guide) return paintGuide(i, false);
    paintGuide(i, true);
    const id = i.id, cv = activeResume(); let g = null;
    try {
      const r = await fetch("/api/guide", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: i.text, category: i.category, company: i.company === "My resume" ? "" : i.company, role: i.role, resume: cv ? cv.text.slice(0, 7000) : "" }) });
      const d = await r.json(); g = d.guide || null;
    } catch {}
    const item = bank.items.find(x => x.id === id); if (!item) return;
    if (g) { item.guide = g; save(); }
    if (pracId === id && !box.classList.contains("hidden")) paintGuide(item, false);
  };
  function closePractice() { stopSpeaking(); stopTimer(); el("qbPracticeModal").classList.add("hidden"); render(); }
  // typing changes the text, so the measured pace no longer describes it: back to an estimate
  el("qbPracAnswer").oninput = () => { if (speaking) return; const i = bank.items.find(x => x.id === pracId); if (i) { i.answer = el("qbPracAnswer").value; i.spokenSecs = 0; save(); } paintFeedback(); };
  el("qbPracClose").onclick = closePractice;
  el("qbPracDone").onclick = () => {
    const i = bank.items.find(x => x.id === pracId); if (!i) return;
    i.practiced = (i.practiced || 0) + 1; i.lastPracticed = Date.now(); save();
    el("qbPracMsg").textContent = `Saved. Practiced ${i.practiced}×.`;
  };
  el("qbPracNext").onclick = () => {
    const order = filtered(), at = order.findIndex(x => x.id === pracId), next = order[(at + 1) % order.length];
    if (!next || next.id === pracId) { el("qbPracMsg").textContent = "That was the only question in this view."; return; }
    openPractice(next.id);
  };

  /* ------------------------------ coding ------------------------------ */
  const PROBLEMS = (window.KOMPAS_CODE && window.KOMPAS_CODE.problems) || [];
  const RUNNER = (window.KOMPAS_CODE ? window.KOMPAS_CODE.normalizeSrc : "function normalize(m, v) { return v; }") + `
    function show(v) { try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); } }
    self.onmessage = function (e) {
      var d = e.data, f, out = [];
      try { new Function(d.code); f = new Function(d.code + "\\n;return (typeof " + d.fn + " === 'function') ? " + d.fn + " : null;")(); }
      catch (err) { self.postMessage({ fatal: String((err && err.message) || err) }); return; }
      if (!f) { self.postMessage({ fatal: "Keep the function named " + d.fn + "." }); return; }
      for (var i = 0; i < d.tests.length; i++) {
        var t = d.tests[i];
        try {
          var got = f.apply(null, JSON.parse(JSON.stringify(t.args)));
          out.push({ ok: JSON.stringify(normalize(d.compare, got)) === JSON.stringify(normalize(d.compare, t.expect)), got: show(got) });
        } catch (err) { out.push({ ok: false, error: String((err && err.message) || err) }); }
      }
      self.postMessage({ results: out });
    };`;

  function renderCoding(list) {
    el("qbEmpty").classList.add("hidden");
    const q = key(el("qbSearch").value), level = el("qbFilter").value;
    const rows = PROBLEMS.filter(p => (!level || p.difficulty === level) && (!q || key(p.title + " " + p.topic).includes(q)));
    if (!rows.length) { el("qbEmpty").classList.remove("hidden"); el("qbEmptyText").textContent = "No problems match."; el("qbStarter").classList.add("hidden"); return; }
    const card = document.createElement("section"); card.className = "qb-group";
    const head = document.createElement("div"); head.className = "qb-group-head";
    const name = document.createElement("b"); name.textContent = "Coding problems";
    const meta = document.createElement("span"); meta.textContent = `${rows.length} problems · ${rows.filter(p => code[p.id] && code[p.id].solved).length} solved`;
    head.append(name, meta); card.append(head);
    rows.forEach((p, n) => {
      const st = code[p.id] || {};
      const row = document.createElement("div"); row.className = "qb-row" + (st.solved ? " done" : "");
      const num = document.createElement("span"); num.className = "qb-num"; num.textContent = String(n + 1).padStart(2, "0");
      const main = document.createElement("div"); main.className = "qb-main";
      const text = document.createElement("div"); text.className = "qb-text"; text.textContent = p.title;
      const m = document.createElement("div"); m.className = "qb-meta";
      [p.difficulty, p.topic].forEach(c => { const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = c; m.append(chip); });
      if (st.solved) { const d = document.createElement("span"); d.className = "qb-done"; d.textContent = "✓ solved"; m.append(d); }
      else if (st.code) { const d = document.createElement("span"); d.textContent = "in progress"; m.append(d); }
      main.append(text, m);
      const actions = document.createElement("div"); actions.className = "qb-actions";
      const go = document.createElement("button"); go.className = "btn"; go.textContent = st.solved ? "Open" : "Solve"; go.onclick = () => openCode(p.id);
      actions.append(go); row.append(num, main, actions); card.append(row);
    });
    list.append(card);
  }

  let codeId = "", hintsShown = 0, worker = null;
  function openCode(id) {
    const p = PROBLEMS.find(x => x.id === id); if (!p) return;
    codeId = id; hintsShown = 0;
    el("qbCodeTitle").textContent = p.title; el("qbCodeDiff").textContent = p.difficulty; el("qbCodeTopic").textContent = p.topic;
    el("qbCodePrompt").textContent = p.prompt;
    const ex = el("qbCodeExamples"); ex.innerHTML = "";
    p.examples.forEach(([input, output]) => { const d = document.createElement("div"); d.className = "qb-example"; const a = document.createElement("div"); a.textContent = "Input:  " + input; const b = document.createElement("div"); b.textContent = "Output: " + output; d.append(a, b); ex.append(d); });
    el("qbCodeHints").innerHTML = ""; el("qbCodeHint").disabled = false; el("qbCodeHint").textContent = "Hint";
    el("qbCodeSolutionBox").classList.add("hidden"); el("qbCodeSolution").textContent = p.solution; el("qbCodeComplexity").textContent = p.complexity;
    el("qbCodeEditor").value = (code[id] && code[id].code) || p.starter;
    el("qbCodeResults").innerHTML = "";
    el("qbCodeModal").classList.remove("hidden"); el("qbCodeEditor").focus();
  }
  function closeCode() { if (worker) { worker.terminate(); worker = null; } el("qbCodeModal").classList.add("hidden"); render(); }
  el("qbCodeClose").onclick = closeCode;
  el("qbCodeEditor").oninput = () => { code[codeId] = { ...(code[codeId] || {}), code: el("qbCodeEditor").value }; saveCode(); };
  el("qbCodeEditor").addEventListener("keydown", (e) => {
    const ta = e.target;
    if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
    else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runTests(); }
  });
  el("qbCodeHint").onclick = () => {
    const p = PROBLEMS.find(x => x.id === codeId); if (!p || hintsShown >= p.hints.length) return;
    const d = document.createElement("div"); d.className = "qb-hint"; d.textContent = `Hint ${hintsShown + 1}: ${p.hints[hintsShown]}`; el("qbCodeHints").append(d);
    hintsShown++; if (hintsShown >= p.hints.length) { el("qbCodeHint").disabled = true; el("qbCodeHint").textContent = "No more hints"; }
  };
  el("qbCodeShow").onclick = () => el("qbCodeSolutionBox").classList.toggle("hidden");
  el("qbCodeResetBtn").onclick = () => { const p = PROBLEMS.find(x => x.id === codeId); if (!p) return; el("qbCodeEditor").value = p.starter; code[codeId] = { ...(code[codeId] || {}), code: p.starter }; saveCode(); el("qbCodeResults").innerHTML = ""; };

  function resultLine(cls, text) { const d = document.createElement("div"); d.className = "qb-result " + cls; d.textContent = text; return d; }
  function runTests() {
    const p = PROBLEMS.find(x => x.id === codeId); if (!p) return;
    const box = el("qbCodeResults"); box.innerHTML = ""; box.append(resultLine("", "Running…"));
    if (worker) worker.terminate();
    let url = "";
    try { url = URL.createObjectURL(new Blob([RUNNER], { type: "text/javascript" })); worker = new Worker(url); }
    catch { box.innerHTML = ""; box.append(resultLine("bad", "This browser blocked the test runner. Compare your code with the reference solution instead.")); return; }
    const done = () => { if (worker) { worker.terminate(); worker = null; } if (url) URL.revokeObjectURL(url); clearTimeout(guard); };
    const guard = setTimeout(() => { done(); box.innerHTML = ""; box.append(resultLine("bad", "Stopped after 3 seconds. Check for a loop that never ends.")); }, 3000);
    worker.onerror = (e) => { done(); box.innerHTML = ""; box.append(resultLine("bad", "Your code has an error: " + (e.message || "syntax error"))); e.preventDefault && e.preventDefault(); };
    worker.onmessage = (e) => {
      done(); box.innerHTML = "";
      if (e.data.fatal) { box.append(resultLine("bad", "Your code has an error: " + e.data.fatal)); return; }
      const res = e.data.results || [], pass = res.filter(r => r.ok).length;
      box.append(resultLine(pass === res.length ? "good head" : "bad head", `${pass} of ${res.length} tests passed`));
      res.forEach((r, n) => {
        const t = p.tests[n], args = t.args.map(a => JSON.stringify(a)).join(", ");
        box.append(resultLine(r.ok ? "good" : "bad", `${r.ok ? "✓" : "✗"} ${p.fn}(${args})` + (r.ok ? "" : r.error ? `  →  error: ${r.error}` : `  →  got ${r.got}, expected ${JSON.stringify(t.expect)}`)));
      });
      if (pass === res.length && res.length) { code[codeId] = { ...(code[codeId] || {}), code: el("qbCodeEditor").value, solved: true }; saveCode(); }
    };
    worker.postMessage({ code: el("qbCodeEditor").value, fn: p.fn, tests: p.tests, compare: p.compare });
  }
  el("qbCodeRun").onclick = runTests;

  /* ------------------------------ wiring ------------------------------ */
  CATS.forEach(c => { const o = document.createElement("option"); o.textContent = c; el("qbCategory").append(o); });
  el("qbCategory").value = "Technical";
  el("qbTabs").querySelectorAll("button").forEach(b => b.onclick = () => setTab(b.dataset.v));
  el("qbSearch").oninput = render; el("qbFilter").onchange = render;
  el("navQbank").onclick = openQbank;
  // a dialog closes on Escape or a click on the dimmed backdrop
  [["qbGenModal", closeGen], ["qbPracticeModal", closePractice], ["qbCodeModal", closeCode]].forEach(([id, close]) => {
    el(id).addEventListener("click", (e) => { if (e.target.id === id) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el(id).classList.contains("hidden")) close(); });
  });
  renderFilter();
  window.openQbank = openQbank;
  window.qbankFromResume = fromResume;                                             // app.js calls this when a resume finishes uploading
})();
