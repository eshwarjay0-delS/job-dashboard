/* Context panel beside the live answer. Open or closed is remembered on this
   browser. The panel text arrives on the answer payload. No extra request. */
(function () {
  var KEY = "kompas-answer-aside-open";
  var byQuestion = [];
  var history = [];
  var view = 0;
  var lastStem = "";
  var manual = null;
  var current = null;

  function stem(text) {
    return String(text || "").replace(/\s+·\s+.*$/, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function readOpen() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }

  function writeOpen(open) {
    try { localStorage.setItem(KEY, open ? "1" : "0"); } catch (e) { /* private mode */ }
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function modeFrom(text) {
    var parts = String(text || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var line = parts.length ? parts[parts.length - 1].replace(/^(?:Them|You):\s*/i, "").trim() : "";
    if (!line) return "questions";
    if (/\b(?:any questions|to wrap up|that covers|does that make sense|moving on|that's all|in summary|we'll stop|last thing)\b/i.test(line)) return "questions";
    if (/\?\s*$/.test(line)) return "questions";
    if (/^(?:so[, ]+)?(?:have you|did you|do you|are you|were you|can you|could you|would you|tell me|walk me through)\b/i.test(line)) return "questions";
    if (/^(?:what|why|how|who|when|where)\b/i.test(line) && !/\b(?:happens|we have|this is|there is|there are)\b/i.test(line)) return "questions";
    return "boosters";
  }

  function transcriptText() {
    var drawer = document.getElementById("drawerBody");
    var cap = document.getElementById("capText");
    return [drawer && drawer.textContent, cap && cap.textContent].filter(Boolean).join("\n");
  }

  function applyPrivate(on) {
    document.documentElement.classList.toggle("kd-private", !!on);
    var overlay = document.getElementById("overlay");
    var panel = document.getElementById("answerAside");
    if (panel && overlay && !overlay.contains(panel)) panel.remove();
  }

  function mount() {
    var answer = document.getElementById("answer");
    var box = answer && answer.closest(".a");
    var overlay = document.getElementById("overlay");
    if (!box || box.dataset.asideMounted) return;
    if (overlay && !overlay.contains(box)) return;
    box.dataset.asideMounted = "1";
    var stage = el("div", "answer-stage");
    stage.id = "answerStage";
    box.parentNode.insertBefore(stage, box);
    stage.appendChild(box);

    var btn = el("button", "aside-toggle");
    btn.id = "asideToggle";
    btn.type = "button";
    btn.setAttribute("aria-controls", "answerAside");
    btn.setAttribute("aria-expanded", "false");
    btn.title = "Context and questions to ask back";
    btn.textContent = "›";
    box.appendChild(btn);

    var panel = el("aside", "answer-aside");
    panel.id = "answerAside";
    panel.setAttribute("aria-label", "Answer context");
    panel.hidden = true;
    panel.appendChild(el("p", "aside-empty", "Context shows up with the next answer."));
    stage.appendChild(panel);

    btn.addEventListener("click", function () { setOpen(!panel.classList.contains("is-open")); });
    setOpen(readOpen());

    var q = document.getElementById("question");
    if (q && window.MutationObserver) {
      var obs = new MutationObserver(function () { onQuestion(); });
      obs.observe(q, { childList: true, characterData: true, subtree: true });
    }
    watchTranscript();
    if (window.kompasDesktop && typeof window.kompasDesktop.onPrivate === "function") window.kompasDesktop.onPrivate(applyPrivate);
    if (window.kompasDesktop && typeof window.kompasDesktop.getPrivate === "function") {
      window.kompasDesktop.getPrivate().then(applyPrivate).catch(function () {});
    } else if (document.documentElement.classList.contains("kd-private")) applyPrivate(true);
    onQuestion();
  }

  function watchTranscript() {
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function () { onTranscript(); });
    ["drawerBody", "capText"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) obs.observe(node, { childList: true, characterData: true, subtree: true });
    });
  }

  function setOpen(open) {
    var panel = document.getElementById("answerAside");
    var btn = document.getElementById("asideToggle");
    if (!panel || !btn) return;
    panel.classList.toggle("is-open", !!open);
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Hide context" : "Show context");
    btn.textContent = open ? "‹" : "›";
    writeOpen(!!open);
  }

  function lookup(stemNow) {
    if (!stemNow) return null;
    for (var i = byQuestion.length - 1; i >= 0; i--) {
      var key = byQuestion[i].key;
      if (!key) continue;
      if (key === stemNow) return byQuestion[i].aside;
      if (key.length >= 12 && stemNow.indexOf(key) >= 0) return byQuestion[i].aside;
      if (stemNow.length >= 12 && key.indexOf(stemNow) >= 0) return byQuestion[i].aside;
    }
    return null;
  }

  function shownMode(aside) {
    if (manual === "questions" || manual === "boosters") return manual;
    var live = transcriptText();
    if (live && live.trim()) return modeFrom(live);
    return aside && aside.mode === "boosters" ? "boosters" : "questions";
  }

  function paintMode(aside) {
    var list = document.getElementById("asideModeList");
    var title = document.getElementById("asideModeTitle");
    if (!list || !aside) return;
    var mode = shownMode(aside);
    list.textContent = "";
    var lines = mode === "boosters" ? (aside.boosters || []) : (aside.questions || []);
    lines.forEach(function (line) { addLi(list, line, whyFor(current, line)); });
    if (!lines.length) list.appendChild(el("li", "", mode === "boosters" ? "No booster for this line." : "No question for this line."));
    if (title) title.textContent = mode === "boosters" ? "Booster statements" : "Clarifying questions";
    var qBtn = document.getElementById("asideModeQuestions");
    var bBtn = document.getElementById("asideModeBoosters");
    var autoBtn = document.getElementById("asideModeAuto");
    if (qBtn) qBtn.setAttribute("aria-pressed", mode === "questions" ? "true" : "false");
    if (bBtn) bBtn.setAttribute("aria-pressed", mode === "boosters" ? "true" : "false");
    if (autoBtn) autoBtn.setAttribute("aria-pressed", manual ? "false" : "true");
  }

  function whyFor(aside, line) {
    var trace = aside && aside.trace || [];
    for (var i = 0; i < trace.length; i++) if (trace[i] && trace[i].line === line && trace[i].why) return trace[i].why;
    return "";
  }

  function addLi(list, line, why) {
    var li = el("li", "", line);
    if (why) li.title = why;
    list.appendChild(li);
  }

  function showHistory(index) {
    if (!history.length) return;
    view = Math.max(0, Math.min(history.length - 1, index));
    render(history[view]);
  }

  function render(aside) {
    var panel = document.getElementById("answerAside");
    if (!panel) return;
    current = aside;
    panel.textContent = "";
    var bar = el("div", "aside-hist");
    var prev = el("button", "aside-mode", "Previous");
    prev.id = "asidePrev";
    prev.type = "button";
    prev.disabled = view <= 0;
    var label = el("span", "aside-hist-label", history.length ? (view === history.length - 1 ? "Live" : "Earlier " + (view + 1) + " of " + history.length) : "Live");
    label.id = "asideHistLabel";
    var next = el("button", "aside-mode", "Next");
    next.id = "asideNext";
    next.type = "button";
    next.disabled = view >= history.length - 1;
    prev.addEventListener("click", function () { showHistory(view - 1); });
    next.addEventListener("click", function () { showHistory(view + 1); });
    bar.appendChild(prev);
    bar.appendChild(label);
    bar.appendChild(next);
    panel.appendChild(bar);
    if (aside.summary) {
      var sum = el("p", "aside-summary", aside.summary);
      var sumWhy = whyFor(aside, aside.summary);
      if (sumWhy) sum.title = sumWhy;
      panel.appendChild(sum);
    }
    if (aside.sayNow) {
      var now = el("p", "aside-say", aside.sayNow);
      var nowWhy = whyFor(aside, aside.sayNow);
      if (nowWhy) now.title = nowWhy;
      panel.appendChild(now);
    }
    var context = el("section");
    context.appendChild(el("h3", "", "Context"));
    var leads = el("ul", "aside-leads");
    (aside.context.leads || []).forEach(function (line) { addLi(leads, line, whyFor(aside, line)); });
    context.appendChild(leads);
    context.appendChild(el("div", "aside-kicker", "Touch points"));
    var touches = el("ul", "aside-touches");
    (aside.context.touchPoints || []).forEach(function (line) { addLi(touches, line, whyFor(aside, line)); });
    context.appendChild(touches);
    var back = el("section");
    var head = el("div", "aside-switch");
    head.appendChild(el("h3", "", "Clarifying questions"));
    head.lastChild.id = "asideModeTitle";
    var qBtn = el("button", "aside-mode", "Clarifying questions");
    qBtn.id = "asideModeQuestions";
    qBtn.type = "button";
    var bBtn = el("button", "aside-mode", "Booster statements");
    bBtn.id = "asideModeBoosters";
    bBtn.type = "button";
    var autoBtn = el("button", "aside-mode aside-auto", "Auto");
    autoBtn.id = "asideModeAuto";
    autoBtn.type = "button";
    qBtn.addEventListener("click", function () { manual = "questions"; paintMode(current); });
    bBtn.addEventListener("click", function () { manual = "boosters"; paintMode(current); });
    autoBtn.addEventListener("click", function () { manual = null; paintMode(current); });
    head.appendChild(qBtn);
    head.appendChild(bBtn);
    head.appendChild(autoBtn);
    back.appendChild(head);
    var qs = el("ul", "aside-questions");
    qs.id = "asideModeList";
    back.appendChild(qs);
    panel.appendChild(context);
    panel.appendChild(back);
    paintMode(aside);
  }

  function renderWaiting() {
    var panel = document.getElementById("answerAside");
    if (!panel) return;
    panel.textContent = "";
    panel.appendChild(el("p", "aside-empty", "Context shows up with the next answer."));
  }

  function onQuestion() {
    var q = document.getElementById("question");
    var stemNow = stem(q && q.textContent);
    if (stemNow === lastStem) return;
    lastStem = stemNow;
    manual = null;
    var hit = lookup(stemNow);
    if (hit) render(hit);
    else if (stemNow) { current = null; renderWaiting(); }
  }

  var brain = { claims: [], topics: [], threads: [], questions: [], answers: [], prewarm: "", log: [], last: "" };

  function lineIntent(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "other";
    if (/\b(?:any questions|to wrap up|that covers|that's all|we'll stop|last thing|in summary)\b/i.test(t)) return "wrap-up";
    if (/^(?:have you|did you|do you|are you|were you)\b/i.test(t)) return "yes-no";
    if (/\?\s*$/.test(t) || /^(?:what|why|how|who|when|where|which|tell me|walk me|describe|design)\b/i.test(t)) return "question";
    var n = t.split(/\s+/).length;
    if (n >= 28) return "long-statement";
    if (n >= 12) return "explanation";
    return "other";
  }

  function partialQuestion(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    return !!t && !/[.?!]$/.test(t) && t.split(/\s+/).length < 14 && /^(?:what|why|how|who|when|where|which|tell me|walk me|describe|design)\b/i.test(t);
  }

  function brainContradicts(text) {
    var t = String(text || "");
    for (var i = 0; i < brain.claims.length; i++) {
      var claim = brain.claims[i];
      if (claim.onSite && /\b(?:remote only|only(?:\s+\w+){0,2}\s+remote|not on[\s-]?site)\b/i.test(t)) return claim;
      if (claim.place && new RegExp("\\bnot\\b[^.]{0,40}\\b" + claim.place + "\\b", "i").test(t)) return claim;
    }
    return null;
  }

  function chooseBrainAction(intent, contradiction, partial) {
    if (contradiction) return "flag-contradiction";
    if (partial) return "prewarm";
    if (intent === "yes-no") return "short-answer";
    if (intent === "question" || intent === "wrap-up") return "clarify";
    if (intent === "long-statement") return "summarize";
    if (intent === "explanation") return "booster";
    return "hold";
  }

  function brainShown(action, text, claim) {
    if (action === "summarize") return String(text || "").split(/\s+/).slice(0, 12).join(" ") + ".";
    if (action === "booster") return "Yeah, I'd stay with that point.";
    if (action === "clarify") return "Want me to take that in one pass?";
    if (action === "short-answer") return "Not directly.";
    if (action === "flag-contradiction" && claim) return "I'll stay with what I already said: " + claim.span.replace(/[.?!]+$/, "") + ".";
    return "";
  }

  function rememberClaim(text) {
    var m = String(text || "").match(/\bavailable in(?: the)?\s+([A-Za-z]+)/i);
    var onSite = /\bon[\s-]?site\b/i.test(text);
    if (!m && !onSite) return;
    brain.claims.push({ span: String(text).replace(/\s+/g, " ").trim(), place: m ? m[1].toLowerCase() : "", onSite: onSite });
    if (brain.claims.length > 12) brain.claims.shift();
  }

  function perceive(who, text, resume) {
    var started = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    var speaker = who === "You" ? "You" : "Them";
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    var intent = lineIntent(clean);
    var claim = brainContradicts(clean);
    var partial = speaker === "Them" && partialQuestion(clean);
    var action = chooseBrainAction(intent, !!claim, partial);
    if (speaker === "You" && !claim) rememberClaim(clean);
    if (action === "prewarm") brain.prewarm = /[?]$/.test(clean) ? clean : clean + "?";
    var topic = clean.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 5; }).slice(0, 3).join(" ");
    if (topic && brain.topics.indexOf(topic) < 0) brain.topics.push(topic);
    if (intent === "question" || intent === "yes-no" || intent === "wrap-up") brain.questions.push(clean);
    if (speaker === "You") brain.answers.push(clean);
    var shown = brainShown(action, clean, claim);
    if (action === "short-answer" && resume) {
      var name = clean.match(/\b(?:worked with|used|familiar with|experience with)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*)?)/i);
      shown = name && String(resume).toLowerCase().indexOf(name[1].toLowerCase()) >= 0 ? "Yes, " + name[1] + " is on the resume." : "Not directly.";
    }
    if (shown && shown.split(/\s+/).length > 18) shown = "";
    var ms = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - started;
    brain.log.push({ who: speaker, intent: intent, action: action, shown: shown, ms: ms });
    if (brain.log.length > 40) brain.log.shift();
    if (brain.topics.length > 24) brain.topics = brain.topics.slice(-24);
    if (brain.questions.length > 24) brain.questions = brain.questions.slice(-24);
    return { intent: intent, action: action, shown: shown, ms: ms, prewarm: brain.prewarm };
  }

  function paintSay(shown) {
    var panel = document.getElementById("answerAside");
    if (!panel || !shown || view !== history.length - 1) return;
    var node = panel.querySelector(".aside-say");
    if (!node) {
      node = el("p", "aside-say", shown);
      var bar = panel.querySelector(".aside-hist");
      if (bar && bar.nextSibling) panel.insertBefore(node, bar.nextSibling);
      else panel.insertBefore(node, panel.firstChild);
    } else node.textContent = shown;
  }

  function onTranscript() {
    var live = transcriptText();
    var parts = String(live || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var last = parts.length ? parts[parts.length - 1] : "";
    var body = last.replace(/^(?:Them|You):\s*/i, "").trim();
    var who = /^You:/i.test(last) ? "You" : "Them";
    if (body && body !== brain.last) {
      brain.last = body;
      var step = perceive(who, body);
      if (step.shown) paintSay(step.shown);
    }
    if (!current || manual) return;
    paintMode(current);
  }

  function accept(aside) {
    if (!aside || !aside.context || !Array.isArray(aside.context.leads) || !Array.isArray(aside.questions)) return;
    var key = stem(aside.question);
    byQuestion.push({ key: key, aside: aside });
    if (byQuestion.length > 8) byQuestion.shift();
    history.push(aside);
    if (history.length > 12) history.shift();
    view = history.length - 1;
    var q = document.getElementById("question");
    var stemNow = stem(q && q.textContent);
    if (lookup(stemNow || key) === aside || !stemNow) render(aside);
  }

  function watch(res) {
    if (!res || typeof res.clone !== "function") return;
    var copy;
    try { copy = res.clone(); } catch (e) { return; }
    var ct = (copy.headers && copy.headers.get && copy.headers.get("content-type")) || "";
    if (ct.indexOf("event-stream") >= 0 && copy.body && copy.body.getReader) {
      var reader = copy.body.getReader();
      var dec = new TextDecoder();
      var buf = "";
      (async function () {
        try {
          while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            buf += dec.decode(chunk.value, { stream: true });
            var i;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              var frame = buf.slice(0, i);
              buf = buf.slice(i + 2);
              var line = frame.split("\n").filter(function (l) { return l.indexOf("data:") === 0; })[0];
              if (!line) continue;
              var ev;
              try { ev = JSON.parse(line.slice(5).trim()); } catch (err) { continue; }
              if (ev && ev.aside) accept(ev.aside);
            }
          }
        } catch (err) { /* the page still has the answer */ }
      })();
      return;
    }
    if (typeof copy.json === "function") copy.json().then(function (data) { if (data && data.aside) accept(data.aside); }).catch(function () {});
  }

  function installFetch() {
    if (window.__kompasAsideFetch || typeof window.fetch !== "function") return;
    window.__kompasAsideFetch = true;
    var orig = window.fetch;
    window.fetch = function (input) {
      var url = "";
      try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) { url = ""; }
      var ret = orig.apply(this, arguments);
      if (!/\/api\/(?:kompas\/)?answer(?:\?|$)/.test(String(url))) return ret;
      return Promise.resolve(ret).then(function (res) { try { watch(res); } catch (e) {} return res; });
    };
  }

  window.KompasAnswerAside = { mount: mount, setOpen: setOpen, accept: accept, watch: watch, stem: stem, modeFrom: modeFrom, applyPrivate: applyPrivate, perceive: perceive, brain: function () { return brain; } };
  installFetch();
  if (document.getElementById("answer")) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
