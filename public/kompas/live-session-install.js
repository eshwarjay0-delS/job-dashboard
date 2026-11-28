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

  var lastSpeaker = "Interviewer";
  if (typeof isTabSmallTalk === "function") {
    var origTabSmall = isTabSmallTalk;
    isTabSmallTalk = function (text) { return Gate.isSmallTalk(text) || origTabSmall(text); };
  }

  if (typeof utteranceWho === "function") {
    utteranceWho = function (text) {
      var prev = lastSpeaker === "You" || (typeof lastTabRole !== "undefined" && lastTabRole === "You") ? "You" : "Interviewer";
      var role = Gate.attributeSpeaker({ text: text, previousRole: prev, source: "system" });
      lastSpeaker = role;
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
      // who is already You or Them. Re-scoring every Them line against a
      // forced Interviewer previous-role labeled the candidate as Interviewer.
      if (who === "You") lastSpeaker = "You";
      return origCaption(who === "You" ? "You" : "Them", Gate.correctSecurityAsr(text), arguments[2]);
    };
  }

  function recentRows() {
    var recent = [];
    try {
      if (typeof recentAsks !== "undefined" && recentAsks) recent = recentAsks.map(function (row) { return { text: row.text, at: row.at }; });
    } catch (e) { recent = []; }
    return recent;
  }
  function previousQuestion() {
    try {
      if (typeof cards !== "undefined" && cards.length) return cards[cards.length - 1].question || "";
    } catch (e) {}
    return "";
  }
  function gateDecision(tail, consume, opts) {
    opts = opts || {};
    var pause = Number(opts.pauseMs);
    if (!Number.isFinite(pause)) pause = quietMs();
    var turn = speakerTurn;
    if (consume) speakerTurn = false;
    var decide = typeof Gate.liveAutoDecision === "function" ? Gate.liveAutoDecision : Gate.shouldFire;
    return decide({
      text: tail,
      pauseMs: pause,
      finalLine: opts.finalLine === true,
      speakerTurn: turn,
      previous: previousQuestion(),
      recent: recentRows(),
      now: Date.now(),
    });
  }

  if (typeof shouldAutoAnswer === "function") {
    var origShould = shouldAutoAnswer;
    shouldAutoAnswer = function (opts) {
      var pause = opts && Number(opts.themQuietMs);
      var decision = gateDecision(opts && opts.text, false, {
        pauseMs: Number.isFinite(pause) ? pause : quietMs(),
        finalLine: Number.isFinite(pause) && pause >= Gate.FIRE_PAUSE_MS,
      });
      if (!decision.fire) return { fire: false, reason: decision.reason === "not-ended" ? "not-quiet" : decision.reason };
      opts = Object.assign({}, opts, { text: decision.text });
      return origShould(opts);
    };
  }

  function cardBody(card) {
    if (!card) return "";
    return typeof card.answer === "string" ? card.answer : (Array.isArray(card.answer) ? card.answer.join(" ") : "");
  }
  function emptyAutoCard(card) {
    var body = String(cardBody(card) || "").trim();
    if (!body || /^[.…\s]+$/.test(body)) return true;
    return false;
  }

  if (typeof confirmAutoAndAnswer === "function") {
    var origConfirm = confirmAutoAndAnswer;
    confirmAutoAndAnswer = async function (tail) {
      // finalLine: the caller already has a finished phrase. Silero sets the
      // quiet clock back to 0 as soon as the next word in a video starts, so
      // measuring themQuietNow() here dropped every auto answer (0 of 4).
      var decision = gateDecision(tail, true, { finalLine: true, pauseMs: quietMs() });
      if (!decision.fire) return;
      var q = decision.text || tail;
      try {
        var card = (typeof cards !== "undefined" && cards.length) ? cards[idx] : null;
        if (card && emptyAutoCard(card) && typeof generateAnswer === "function") {
          card.question = Gate.stripSpeakerLabels(q);
          card.answer = ["…"];
          card.streaming = true;
          if (typeof renderCard === "function") renderCard();
          return generateAnswer(q, card, { pinned: true, derived: q, queued: true });
        }
      } catch (e) {}
      return origConfirm(q);
    };
  }

  if (typeof onTranscript === "function") {
    var origOn = onTranscript;
    onTranscript = function (who, text, lookedAgain, spokenAt) {
      if (who !== "You" && !lookedAgain && typeof transcript !== "undefined" && transcript.length) {
        var prevRow = null;
        for (var i = transcript.length - 1; i >= 0; i--) {
          if (transcript[i] && transcript[i].who === "Them") { prevRow = transcript[i]; break; }
        }
        if (prevRow && prevRow.text) {
          var joined = Gate.joinSplitQuestion([
            { role: "Interviewer", text: prevRow.text, source: "system" },
            { text: text, source: "system" },
          ]);
          if (joined.length === 1 && joined[0].joined) text = joined[0].text;
        }
      }
      var out = origOn.call(this, who, text, lookedAgain, spokenAt);
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
    return document.body || document.getElementById("overlay");
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

  function showSessionSummary(at) {
    var summary = Gate.sessionSummary({
      turns: typeof transcript !== "undefined" ? transcript : [],
      cards: typeof cards !== "undefined" ? cards : [],
      endedAt: at || Date.now(),
    });
    paintSummary(summary);
    return summary;
  }

  if (typeof closeRun === "function") {
    var origClose = closeRun;
    closeRun = function (s, at, by) {
      try {
        var summary = showSessionSummary(at);
        if (s) s.summary = summary.text;
      } catch (e) {}
      return origClose.apply(this, arguments);
    };
  }

  if (typeof stop === "function") {
    var origStop = stop;
    stop = async function (say) {
      var result = await origStop.apply(this, arguments);
      if (say !== false) {
        try { showSessionSummary(Date.now()); } catch (e) {}
      }
      return result;
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
