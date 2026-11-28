// Applies KompasLiveSession to the live page. Loaded after app.js.
// Does not replace answer prompts, level contracts, or the answer route.
(function () {
  if (!globalThis.KompasLiveSession || typeof document === "undefined") return;
  var Gate = globalThis.KompasLiveSession;
  var speakerTurn = false;

  function quietMs() {
    try { return typeof themQuietNow === "function" ? themQuietNow() : 0; } catch (e) { return 0; }
  }

  if (typeof fixPhrases === "function") {
    var origFix = fixPhrases;
    fixPhrases = function (text) { return Gate.correctSecurityAsr(origFix(text)); };
  }

  if (typeof utteranceWho === "function") {
    utteranceWho = function (text) {
      var prev = typeof lastTabRole !== "undefined" && lastTabRole === "You" ? "You" : "Interviewer";
      var role = Gate.attributeSpeaker({ text: text, previousRole: prev, source: "system" });
      return role === "You" ? "You" : "Them";
    };
  }

  if (typeof oneQuestionLine === "function") {
    var origLine = oneQuestionLine;
    oneQuestionLine = function (text) {
      var header = Gate.questionHeader(text);
      if (!header) return "";
      var body = header.replace(/^Question:\s*/i, "");
      var lined = origLine(body);
      return lined ? Gate.questionHeader(lined.replace(/^Question:\s*/i, "")) : header;
    };
  }

  if (typeof questionHeader === "function") {
    questionHeader = function (text) { return Gate.questionHeader(text); };
  }

  if (typeof showCaption === "function") {
    var origCaption = showCaption;
    showCaption = function (who, text) {
      var role = who === "You" ? "You" : Gate.attributeSpeaker({ text: text, previousRole: who === "You" ? "You" : "Interviewer", source: who === "You" ? "mic" : "system" });
      return origCaption(role === "You" ? "You" : "Them", Gate.correctSecurityAsr(text), arguments[2]);
    };
  }

  function gateDecision(tail, consume) {
    var recent = [];
    try {
      if (typeof recentAsks !== "undefined" && recentAsks) recent = recentAsks.map(function (row) { return { text: row.text, at: row.at }; });
    } catch (e) { recent = []; }
    var previous = "";
    try {
      if (typeof cards !== "undefined" && cards.length) previous = cards[cards.length - 1].question || "";
    } catch (e) { previous = ""; }
    var turn = speakerTurn;
    if (consume) speakerTurn = false;
    return Gate.shouldFire({
      text: tail,
      pauseMs: quietMs(),
      speakerTurn: turn,
      previous: previous,
      recent: recent,
      now: Date.now(),
    });
  }

  if (typeof shouldAutoAnswer === "function") {
    var origShould = shouldAutoAnswer;
    shouldAutoAnswer = function (opts) {
      var decision = gateDecision(opts && opts.text, false);
      if (!decision.fire) return { fire: false, reason: decision.reason === "not-ended" ? "not-quiet" : decision.reason };
      opts = Object.assign({}, opts, { text: decision.text });
      return origShould(opts);
    };
  }

  if (typeof confirmAutoAndAnswer === "function") {
    var origConfirm = confirmAutoAndAnswer;
    confirmAutoAndAnswer = async function (tail) {
      var decision = gateDecision(tail, true);
      if (!decision.fire) return;
      return origConfirm(decision.text || tail);
    };
  }

  if (typeof onTranscript === "function") {
    var origOn = onTranscript;
    onTranscript = function (who, text, lookedAgain, spokenAt) {
      var out = origOn.apply(this, arguments);
      if (who === "You" && !lookedAgain) {
        speakerTurn = true;
        var pending = "";
        try {
          var rows = (typeof transcript !== "undefined" ? transcript : []).filter(function (row) { return row && row.who === "Them"; });
          pending = rows.length ? rows[rows.length - 1].text : "";
        } catch (e) { pending = ""; }
        if (pending && typeof confirmAutoAndAnswer === "function") void confirmAutoAndAnswer(pending);
      }
      return out;
    };
  }

  if (typeof generateAnswer === "function") {
    var origGenerate = generateAnswer;
    generateAnswer = function (question, card, opts) {
      var latest = Gate.latestQuestion(question) || question;
      if (card && latest) card.question = Gate.stripSpeakerLabels(latest);
      var next = Object.assign({}, opts || {}, { derived: latest });
      return origGenerate(latest, card, next);
    };
  }

  if (typeof aiAnswer === "function") {
    var origAi = aiAnswer;
    aiAnswer = async function () {
      var result = await origAi.apply(this, arguments);
      try {
        if (typeof cards !== "undefined" && cards.length) {
          idx = cards.length - 1;
          if (typeof renderCard === "function") renderCard();
        }
      } catch (e) {}
      return result;
    };
  }

  function capAnchors(api) {
    if (!api || api.__kompasLiveCapped || typeof api.load !== "function") return;
    var origLoad = api.load;
    api.load = function () {
      var pending = origLoad.apply(this, arguments);
      return Promise.race([
        Promise.resolve(pending),
        new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 250); }),
      ]);
    };
    api.__kompasLiveCapped = true;
  }
  capAnchors(globalThis.KompasAnchors);
  var anchorWatch = setInterval(function () {
    capAnchors(globalThis.KompasAnchors);
    if (globalThis.KompasAnchors && globalThis.KompasAnchors.__kompasLiveCapped) clearInterval(anchorWatch);
  }, 500);

  if (typeof start === "function") {
    var origStart = start;
    start = async function () {
      var origTimeout = globalThis.setTimeout;
      globalThis.setTimeout = function (fn, ms) {
        var body = typeof fn === "function" ? Function.prototype.toString.call(fn) : "";
        if (ms === 12000 && /No tab audio|Start timed/.test(body)) return 0;
        return origTimeout.apply(this, arguments);
      };
      try { return await origStart.apply(this, arguments); }
      finally { globalThis.setTimeout = origTimeout; }
    };
  }

  function popupHost() {
    return document.getElementById("overlay") || document.body;
  }
  function paintSummary(summary) {
    if (!summary || !document.body) return;
    var box = document.getElementById("sessionSummary");
    if (!box) {
      box = document.createElement("div");
      box.id = "sessionSummary";
      box.className = "session-summary";
      box.setAttribute("role", "dialog");
      box.innerHTML = '<div class="session-summary-card"><h2>Session summary</h2><pre id="sessionSummaryBody"></pre><button type="button" id="sessionSummaryClose">Close</button></div>';
      popupHost().appendChild(box);
      box.querySelector("#sessionSummaryClose").onclick = function () { box.hidden = true; };
    }
    var body = document.getElementById("sessionSummaryBody");
    if (body) body.textContent = summary.text;
    box.hidden = false;
  }

  if (typeof closeRun === "function") {
    var origClose = closeRun;
    closeRun = function (s, at, by) {
      try {
        var summary = Gate.sessionSummary({
          turns: typeof transcript !== "undefined" ? transcript : [],
          cards: typeof cards !== "undefined" ? cards : [],
          endedAt: at,
        });
        if (s) s.summary = summary.text;
        paintSummary(summary);
      } catch (e) {}
      return origClose.apply(this, arguments);
    };
  }

  function paintClarifier() {
    var q = document.getElementById("question");
    var pop = document.getElementById("liveClarifier");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "liveClarifier";
      pop.className = "live-clarifier";
      pop.hidden = true;
      pop.setAttribute("role", "dialog");
      pop.innerHTML = '<div class="live-clarifier-head"><b>Clarify</b><button type="button" id="liveClarifierClose" aria-label="Close clarifier">×</button></div><p id="liveClarifierText"></p>';
      popupHost().appendChild(pop);
      pop.querySelector("#liveClarifierClose").onclick = function () { pop.hidden = true; pop.dataset.dismissed = "1"; };
    }
    if (!q) return;
    var raw = q.textContent || "";
    var text = Gate.stripSpeakerLabels(raw);
    var body = document.getElementById("liveClarifierText");
    if (!text || /waiting for the interview|preparing…|preparing\.\.\./i.test(text)) {
      pop.hidden = true;
      return;
    }
    if (body) body.textContent = text;
    if (pop.dataset.dismissed === "1") return;
    pop.hidden = false;
  }
  var questionNode = document.getElementById("question");
  if (questionNode && typeof MutationObserver === "function") {
    new MutationObserver(paintClarifier).observe(questionNode, { childList: true, characterData: true, subtree: true });
  }
  paintClarifier();
})();
