// Live-session gate for capture, question detection, speaker labels, and the
// end-of-session summary. Pure functions. The page installer in
// live-session-install.js applies them. Answer prompts and level personality
// stay in their own modules.
(function (root) {
  var FIRE_PAUSE_MS = 1200;
  var DEDUPE_MS = 45000;
  var MIN_CONTENT = 4;
  var STOP = new Set("a an the and or but if so ok okay yeah yes yep no well um uh like just really very that this those these it its you your yours me my we our they them their to of in on for with at as is are was were be been do does did have has had can could would should will about from into what how why when where which who whom whose tell walk explain describe please right alright".split(" "));

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function stripSpeakerLabels(text) {
    var q = clean(text).replace(/\s+·\s+.*$/, "").trim();
    var prev = "";
    while (q && q !== prev) {
      prev = q;
      q = q.replace(/^(?:question\s*:\s*)+/i, "");
      q = q.replace(/^(?:them|you|interviewer|candidate)\s*:\s*/i, "");
      q = clean(q);
    }
    return q;
  }

  function questionHeader(text) {
    var q = stripSpeakerLabels(text);
    if (!q) return "";
    return "Question: " + q;
  }

  function correctSecurityAsr(text) {
    var t = clean(text);
    if (!t) return "";
    t = t.replace(/\bsee\s*em\b/gi, "SIEM");
    t = t.replace(/\b(?:seem|seam|sim)\b(?=\s+(?:tool|platform|solution|system|logs?|alerts?|rules?|dashboard|correlation|monitoring|engine)\b)/gi, "SIEM");
    if (/\bsam\b/i.test(t) && /\b(?:alerts?|logs?|sentinel|splunk|correlation|monitoring|dashboard|rules?|detections?)\b/i.test(t) && !/\b(?:account|manager|saml)\b/i.test(t)) {
      t = t.replace(/\bsam\b/gi, "SIEM");
    }
    if (/\b(?:what(?:'s| is)|explain|describe|define)\s+(?:a\s+|an\s+|the\s+)?sam\b/i.test(t) && !/\b(?:account|manager|saml)\b/i.test(t)) {
      t = t.replace(/\bsam\b/i, "SIEM");
    }
    t = t.replace(/\bsock\b(?=\s+(?:analyst|analysts|team|teams|alert|alerts|manager|lead|tier|l1|l2|operator)\b)/gi, "SOC");
    if (/\b(?:what(?:'s| is)|explain|describe|define)\s+(?:a\s+|an\s+|the\s+)?sock\b/i.test(t)) t = t.replace(/\bsock\b/i, "SOC");
    t = t.replace(/\bs\s+o\s+c\b/gi, "SOC");
    t = t.replace(/\bcross[\s-]+(?:site|sight)\s+scripting\b/gi, "XSS");
    t = t.replace(/\bx\s+s\s+s\b/gi, "XSS");
    t = t.replace(/\bk\s+q\s+l\b/gi, "KQL");
    t = t.replace(/\bkay\s+q(?:uery)?\s+el\b/gi, "KQL");
    return t;
  }

  function contentWords(text) {
    return correctSecurityAsr(stripSpeakerLabels(text))
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, " ")
      .split(/\s+/)
      .filter(function (w) { return w && w.length >= 3 && !STOP.has(w); });
  }

  var ASK_SPLIT = /\s+(?=(?:how (?:do|would|did|can|could) you|what (?:is|are|was)|why (?:do|did|would) you|when (?:do|did) you|where (?:do|did) you|tell me|walk me)\b)/gi;
  function sentences(text) {
    return correctSecurityAsr(stripSpeakerLabels(text))
      .split(/(?<=[.?!])\s+/)
      .map(function (s) { return clean(s); })
      .filter(Boolean);
  }
  function askPieces(text) {
    var out = [];
    sentences(text).forEach(function (part) {
      ASK_SPLIT.lastIndex = 0;
      var bits = part.split(ASK_SPLIT).map(clean).filter(Boolean);
      if (bits.length < 2) {
        if (bits[0]) out.push(bits[0]);
        return;
      }
      var cur = bits[0];
      for (var i = 1; i < bits.length; i++) {
        if (/\b(?:and|or)\s*$/i.test(cur)) cur = clean(cur + " " + bits[i]);
        else { out.push(cur); cur = bits[i]; }
      }
      if (cur) out.push(cur);
    });
    return out;
  }

  var SMALL = [
    /^how (?:are|r) you\b/i,
    /^how(?:'s| is) (?:it|your day|the day)\b/i,
    /^nice to meet you\b/i,
    /^good (?:morning|afternoon|evening)\b/i,
    /^can you hear me\b/i,
    /^are you there\b/i,
    /^let'?s (?:get started|begin|dive in)\b/i,
    /^shall we (?:get started|begin)\b/i,
    /^(?:did|have) you (?:have|had) (?:your |some )?breakfast\b/i,
    /^i(?:'m| am) doing great\b/i,
    /^what about you\b/i,
    /^thank you(?: so much)?\b/i,
    /^thanks(?: so much)?\b/i,
    /^that sounds (?:great|good|optimistic|interesting)\b/i,
    /^nice one\b/i,
    /^sounds good\b/i,
  ];

  function sentenceIsSmallTalk(s) {
    var t = clean(s).replace(/[.!?]+$/g, "").trim();
    if (!t) return true;
    if (t.split(/\s+/).length > 18 && /\b(?:tell me|how (?:do|would|did) you|what (?:is|are)|walk me|can you tell)\b/i.test(t)) return false;
    return SMALL.some(function (re) { return re.test(t); });
  }

  function isSmallTalk(text) {
    var parts = sentences(text);
    if (!parts.length) return false;
    return parts.every(sentenceIsSmallTalk);
  }

  var ASK = /(?:^|\b)(?:how (?:do|would|did|can|could) you|what (?:is|are|was|were|do|does)|why (?:do|did|would|is|are) you|when (?:do|did|would) you|where (?:do|did|would) you|which\b|who\b|can you|could you|would you|tell me|walk me|describe\b|explain\b|define\b|may i (?:know|note|ask))\b/i;

  function isQuestionShape(text) {
    var t = correctSecurityAsr(stripSpeakerLabels(text));
    if (!t || isSmallTalk(t)) return false;
    if (/\?\s*$/.test(t) && contentWords(t).length >= 1) return true;
    return ASK.test(t);
  }

  function isStrongShort(text) {
    return /\b(?:what(?:'s| is)|explain|describe|define)\s+(?:a\s+|an\s+|the\s+)?(?:SIEM|SOC|XSS|KQL|SAM|SQL)\b/i.test(correctSecurityAsr(text));
  }

  function dangling(text) {
    var t = clean(text).replace(/[.]+$/g, "").trim();
    return /\b(?:a|an|the|to|of|for|with|and|or|doing|uh|um|your|about|on|in)\s*$/i.test(t) && !/\?\s*$/.test(text);
  }

  function normKey(text) {
    return contentWords(text).join(" ");
  }

  function similar(a, b) {
    var A = contentWords(a);
    var B = contentWords(b);
    if (A.length < 2 || B.length < 2) return normKey(a) !== "" && normKey(a) === normKey(b);
    var setB = new Set(B);
    var n = A.filter(function (w) { return setB.has(w); }).length;
    return n / A.length >= 0.72 && n / B.length >= 0.55;
  }

  function isFollowUp(text, previous) {
    if (!previous) return false;
    var t = correctSecurityAsr(stripSpeakerLabels(text));
    var p = correctSecurityAsr(stripSpeakerLabels(previous));
    if (!t || !p) return false;
    if (/^(?:(?:and|so|ok(?:ay)?|right|well|then|now|um+|uh+)[.,]?\s+)*(?:how come|how so|why not|and why|and how|go deeper|say that again|same (?:thing|question))\b/i.test(t)) return true;
    if (/^(?:ok(?:ay)?[.,]?\s+)?so your experience (?:lies|is) more with\b/i.test(t)) return true;
    return similar(t, p);
  }

  function duplicateOf(text, recent, now) {
    var at = Number(now) || 0;
    return (recent || []).some(function (row) {
      if (!row) return false;
      var when = Number(row.at) || 0;
      if (at && when && at - when > DEDUPE_MS) return false;
      return similar(text, row.text) || isFollowUp(text, row.text);
    });
  }

  function shouldFire(opts) {
    opts = opts || {};
    var text = correctSecurityAsr(stripSpeakerLabels(opts.text));
    if (!text) return { fire: false, reason: "empty", text: "" };
    if (isSmallTalk(text)) return { fire: false, reason: "small-talk", text: text };
    var words = contentWords(text);
    if (words.length < MIN_CONTENT && !isStrongShort(text)) return { fire: false, reason: "too-short", text: text };
    if (isFollowUp(text, opts.previous)) return { fire: false, reason: "follow-up", text: text };
    if (duplicateOf(text, opts.recent, opts.now)) return { fire: false, reason: "duplicate", text: text };
    if (!isQuestionShape(text) || dangling(text)) return { fire: false, reason: "not-a-question", text: text };
    var pause = Number(opts.pauseMs);
    var ended = opts.speakerTurn === true || (Number.isFinite(pause) && pause >= FIRE_PAUSE_MS);
    if (!ended) {
      return {
        fire: false,
        reason: "not-ended",
        text: text,
        waitMs: Math.max(0, FIRE_PAUSE_MS - (Number.isFinite(pause) ? pause : 0)),
      };
    }
    return { fire: true, reason: opts.speakerTurn ? "speaker-turn" : "pause", text: text };
  }

  function latestQuestion(text) {
    var raw = String(text || "");
    var lines = raw.split(/\n/).map(function (line) { return clean(line); }).filter(Boolean);
    var interviewer = [];
    if (!lines.length) lines = [raw];
    lines.forEach(function (line) {
      var m = line.match(/^(Them|Interviewer|You|Candidate)\s*:\s*(.*)$/i);
      if (m) {
        if (!/^(?:you|candidate)$/i.test(m[1])) interviewer.push(m[2]);
      } else interviewer.push(line);
    });
    var blob = correctSecurityAsr(interviewer.join(" "));
    var parts = askPieces(blob);
    var asks = parts.filter(function (s) { return isQuestionShape(s) && !dangling(s); });
    if (asks.length) return asks[asks.length - 1];
    var rest = parts.filter(function (s) { return !sentenceIsSmallTalk(s); });
    return rest.length ? rest[rest.length - 1] : "";
  }

  function isCandidateNarrative(text) {
    var t = correctSecurityAsr(stripSpeakerLabels(text));
    if (!t) return false;
    if (/\b(?:tell me|walk me|can you tell me|how (?:do|would|did) you|what (?:is|are) your|why (?:do|did|would) you|may i (?:know|note))\b/i.test(t)) return false;
    if (/\b(?:i(?:'m| am| have| had| was| used| work| got| feel| can| will| don't| didn't)|my |we have|ma'am|sir)\b/i.test(t)) return true;
    if (/^(?:yes|yeah|okay|ok|sure|thank you|thanks)\b/i.test(t) && !ASK.test(t)) return true;
    return false;
  }

  function attributeSpeaker(opts) {
    opts = opts || {};
    var t = correctSecurityAsr(stripSpeakerLabels(opts.text));
    var prev = opts.previousRole === "You" ? "You" : "Interviewer";
    if (!t) return prev;
    if (opts.source === "mic" || opts.source === "You") {
      if (isQuestionShape(t) && !isCandidateNarrative(t) && !isSmallTalk(t) && opts.micIsInterviewer) return "Interviewer";
      return "You";
    }
    if (isCandidateNarrative(t)) return "You";
    if (isQuestionShape(t) && !isSmallTalk(t)) return "Interviewer";
    if (prev === "Interviewer") return "You";
    if (prev === "You") return "You";
    return "Interviewer";
  }

  function isIncompleteQuestion(text) {
    var t = correctSecurityAsr(stripSpeakerLabels(text));
    if (!t || !ASK.test(t)) return false;
    if (/\?\s*$/.test(t) && !dangling(t)) return false;
    return dangling(t) || contentWords(t).length < MIN_CONTENT;
  }

  function continuesQuestion(text) {
    var t = correctSecurityAsr(stripSpeakerLabels(text));
    if (!t) return false;
    if (isCandidateNarrative(t) && t.split(/\s+/).length > 14) return false;
    if (ASK.test(t) && contentWords(t).length >= MIN_CONTENT && !dangling(t)) return false;
    return true;
  }

  function joinSplitQuestion(turns) {
    var out = [];
    (turns || []).forEach(function (turn) {
      var text = correctSecurityAsr(stripSpeakerLabels(turn && turn.text));
      var prev = out[out.length - 1];
      if (prev && prev.role === "Interviewer" && isIncompleteQuestion(prev.text) && continuesQuestion(text)) {
        prev.text = clean(prev.text + " " + text);
        prev.joined = true;
        return;
      }
      var role = turn && (turn.role || turn.speaker);
      if (role === "candidate" || role === "You") role = "You";
      else if (role === "interviewer" || role === "Them" || role === "Interviewer") role = "Interviewer";
      else role = attributeSpeaker({ text: text, previousRole: prev ? prev.role : "Interviewer", source: turn && turn.source });
      out.push({ role: role, text: text, qId: turn && (turn.qId || turn.q_id) || "" });
    });
    return out;
  }

  function sessionSummary(opts) {
    opts = opts || {};
    var seen = new Set();
    var questions = [];
    function push(q, answered) {
      q = stripSpeakerLabels(latestQuestion(q) || q);
      if (!q || /^(?:preparing|ready|cleared|no question|deriving|waiting)/i.test(q)) return;
      var key = normKey(q) || q.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      questions.push({ question: q, answered: !!answered });
    }
    (opts.cards || []).forEach(function (card) {
      var answer = card && card.answer;
      var body = Array.isArray(answer) ? answer.join(" ") : String(answer || "");
      push(card && card.question, body.trim() && body.trim() !== "…");
    });
    (opts.turns || []).forEach(function (turn) {
      var role = attributeSpeaker({ text: turn && turn.text, source: turn && turn.source, previousRole: turn && turn.who === "You" ? "You" : "Interviewer" });
      if ((turn && turn.who === "You") || role !== "Interviewer") return;
      if (isQuestionShape(turn.text)) push(turn.text, false);
    });
    var lines = ["Session summary", questions.length + (questions.length === 1 ? " question" : " questions")];
    questions.forEach(function (q, i) {
      lines.push((i + 1) + ". " + q.question + " - " + (q.answered ? "answered" : "heard"));
    });
    return { questions: questions, text: lines.join("\n"), endedAt: opts.endedAt || null };
  }

  root.KompasLiveSession = {
    FIRE_PAUSE_MS: FIRE_PAUSE_MS,
    DEDUPE_MS: DEDUPE_MS,
    MIN_CONTENT: MIN_CONTENT,
    clean: clean,
    stripSpeakerLabels: stripSpeakerLabels,
    questionHeader: questionHeader,
    correctSecurityAsr: correctSecurityAsr,
    contentWords: contentWords,
    isSmallTalk: isSmallTalk,
    isQuestionShape: isQuestionShape,
    isFollowUp: isFollowUp,
    shouldFire: shouldFire,
    latestQuestion: latestQuestion,
    attributeSpeaker: attributeSpeaker,
    joinSplitQuestion: joinSplitQuestion,
    sessionSummary: sessionSummary,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
