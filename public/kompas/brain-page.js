/* Brain page, answer trace, session write-back, and the feedback mic.
   The mic is created for every session and shown only when the gate allows it. */
(function () {
  function $(id) { return document.getElementById(id); }

  var recording = false;
  var recorder = null;
  var audioChunks = [];

  function open() {
    if (typeof show === "function") show("brain");
    load().catch(function () {
      var status = $("brainStatus");
      if (status) status.textContent = "The brain could not be loaded.";
    });
  }

  function load() {
    return fetch("/api/kompas/brain", { credentials: "same-origin", cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("load");
      return res.json();
    }).then(render);
  }

  function render(data) {
    var status = $("brainStatus");
    if (status) status.textContent = "Revision " + (data.revision || 1) + (data.updatedAt ? " · " + data.updatedAt : "");
    var doc = $("brainDocument");
    if (doc) doc.textContent = data.markdown || "";
    var log = $("brainVersions");
    if (log) log.textContent = data.versions || "No edits yet.";
    var list = $("brainChunks");
    if (!list) return;
    list.textContent = "";
    (data.chunks || []).forEach(function (chunk) {
      var box = document.createElement("article");
      box.className = "brain-chunk";
      var head = document.createElement("header");
      var title = document.createElement("strong");
      title.textContent = chunk.section;
      var tags = document.createElement("span");
      tags.className = "muted small";
      tags.textContent = (chunk.tags || []).join(", ");
      var on = document.createElement("label");
      var boxOn = document.createElement("input");
      boxOn.type = "checkbox";
      boxOn.checked = chunk.enabled !== false;
      on.appendChild(boxOn);
      on.appendChild(document.createTextNode(" On"));
      var weight = document.createElement("input");
      weight.type = "number";
      weight.min = "0.25";
      weight.max = "5";
      weight.step = "0.25";
      weight.value = String(chunk.weight || 1);
      weight.setAttribute("aria-label", "Weight");
      head.appendChild(title);
      head.appendChild(tags);
      head.appendChild(on);
      head.appendChild(weight);
      var body = document.createElement("textarea");
      body.value = chunk.body || "";
      var save = document.createElement("button");
      save.type = "button";
      save.className = "btn";
      save.textContent = "Save";
      save.onclick = function () {
        save.disabled = true;
        fetch("/api/kompas/brain", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: chunk.id, body: body.value, enabled: boxOn.checked, weight: Number(weight.value) }),
        }).then(function (res) { return res.json().then(function (payload) { return { ok: res.ok, payload: payload }; }); })
          .then(function (result) {
            save.disabled = false;
            if (!result.ok) { if (status) status.textContent = (result.payload && result.payload.error) || "Could not save."; return; }
            return load();
          }).catch(function () { save.disabled = false; if (status) status.textContent = "Could not save."; });
      };
      box.appendChild(head);
      box.appendChild(body);
      box.appendChild(save);
      list.appendChild(box);
    });
  }

  function prefetch(session) {
    var body = { action: "seed", persona: "", books: [] };
    var read = Promise.resolve();
    var store = window.DossierDB;
    if (session && store && store.get) {
      read = Promise.all([
        store.get(session.id + ":persona").catch(function () { return null; }),
        store.get(session.id + ":book:personal-evidence-v2").catch(function () { return null; }),
      ]).then(function (pair) {
        var persona = pair[0];
        var book = pair[1];
        if (persona && persona.parts) body.persona = Object.keys(persona.parts).map(function (key) { return persona.parts[key]; }).filter(Boolean).join("\n\n").slice(0, 8000);
        if (book && Array.isArray(book.items)) body.books = book.items.slice(0, 12).map(function (item) { return { q: item.q || "", a: item.text || item.a || "" }; });
      }).catch(function () {});
    }
    return read.then(function () {
      return fetch("/api/kompas/brain", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }).then(function () {
      if (window.KompasBrainGate) KompasBrainGate.applyFeedbackVisibility(document, session);
    }).catch(function () {});
  }

  function paintTrace(card, trace) {
    if (card) card.brainTrace = trace || [];
    var node = $("brainTrace");
    if (!node) return;
    var lines = (trace || []).filter(function (row) { return row && row.section && row.why; }).map(function (row) { return row.section + " (" + row.why + ")"; });
    node.hidden = !lines.length;
    node.textContent = lines.length ? "Why this answer used " + lines.join("; ") : "";
  }

  function wordsBefore(text) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean);
    return words.slice(-40).join(" ");
  }

  function transcriptNow() {
    var drawer = $("drawerBody");
    var cap = $("capText");
    return [drawer && drawer.textContent, cap && cap.textContent].filter(Boolean).join(" ");
  }

  function stopMic() {
    if (recorder && recording) {
      try { recorder.stop(); } catch (e) { recording = false; }
      return;
    }
    recording = false;
    var mic = $("feedbackMic");
    if (mic) { mic.setAttribute("aria-pressed", "false"); mic.textContent = "Mic"; }
  }

  function toggleMic() {
    var session = window.__kompasLiveSession || null;
    if (!window.KompasBrainGate || !KompasBrainGate.feedbackTabVisible(session)) return;
    if (recording) { stopMic(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var missing = $("feedbackMicState");
      if (missing) missing.textContent = "This browser has no microphone.";
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      audioChunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (event) { if (event.data && event.data.size) audioChunks.push(event.data); };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        recording = false;
        finishMic(new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      recording = true;
      var mic = $("feedbackMic");
      if (mic) { mic.setAttribute("aria-pressed", "true"); mic.textContent = "Stop"; }
      var state = $("feedbackMicState");
      if (state) state.textContent = "Listening. Tap again to stop.";
    }).catch(function () {
      var state = $("feedbackMicState");
      if (state) state.textContent = "The microphone did not start.";
    });
  }

  function finishMic(blob) {
    var mic = $("feedbackMic");
    if (mic) { mic.setAttribute("aria-pressed", "false"); mic.textContent = "Mic"; }
    fetch("/api/kompas/speech", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/octet-stream", "x-audio-mime": blob.type || "audio/webm", "x-speech-for": "transcribe", "x-speech-lang": "en", "x-audio-source": "mic" },
      body: blob,
    }).then(function (res) { return res.ok ? res.json() : {}; }).then(function (data) {
      var note = String((data && (data.text || data.transcript)) || "").trim();
      var state = $("feedbackMicState");
      if (!note) { if (state) state.textContent = "Nothing was transcribed."; return; }
      var session = window.__kompasLiveSession || null;
      var question = ($("question") && $("question").textContent || "").replace(/\s+·\s+.*$/, "").trim();
      var answer = ($("answer") && $("answer").textContent || "").trim();
      var row = { question: question, answer: answer, before: wordsBefore(transcriptNow()), note: note };
      if (session) {
        session.feedbackNotes = (session.feedbackNotes || []).concat(row).slice(-40);
        if (typeof saveSession === "function") saveSession(session);
      }
      renderNotes(session);
      if (state) state.textContent = "Saved with this question. It joins the Feedback Log when the session ends.";
    }).catch(function () {
      var state = $("feedbackMicState");
      if (state) state.textContent = "The note could not be transcribed.";
    });
  }

  function renderNotes(session) {
    var list = $("feedbackNotes");
    if (!list) return;
    list.textContent = "";
    ((session && session.feedbackNotes) || []).forEach(function (row) {
      var li = document.createElement("li");
      li.textContent = row.note;
      list.appendChild(li);
    });
  }

  function selectTab(name) {
    var session = window.__kompasLiveSession || null;
    var allow = !!(window.KompasBrainGate && KompasBrainGate.feedbackTabVisible(session));
    var feedback = name === "feedback" && allow;
    var clarify = $("answerTabClarify");
    var tab = $("answerTabFeedback");
    var clarifyPane = $("answerClarifyPane");
    var pane = $("answerFeedbackPane");
    if (clarify) { clarify.classList.toggle("on", !feedback); clarify.setAttribute("aria-selected", !feedback ? "true" : "false"); }
    if (tab) { tab.classList.toggle("on", feedback); tab.setAttribute("aria-selected", feedback ? "true" : "false"); }
    if (clarifyPane) {
      clarifyPane.hidden = feedback;
      var question = $("question");
      clarifyPane.textContent = question && question.textContent ? question.textContent.replace(/\s+·\s+.*$/, "") : "";
    }
    if (pane) pane.hidden = !feedback;
    if (!feedback) stopMic();
    if (feedback) renderNotes(session);
  }

  function writeBack(session) {
    if (!session) return Promise.resolve();
    var read = Promise.resolve({ qa: [], transcript: "" });
    if (typeof sessionTranscript === "function") {
      read = sessionTranscript(session).then(function (saved) {
        var log = saved && Array.isArray(saved.log) ? saved.log : [];
        var qa = log.filter(function (entry) {
          return entry && entry.t === "answer" && !entry.failed && String(entry.question || "").trim() && String(entry.text || "").trim();
        }).map(function (entry) {
          return { q: String(entry.question).slice(0, 800), a: String(entry.text).slice(0, 2000), source: String(entry.askSource || "") };
        }).slice(0, 40);
        var transcript = log.filter(function (entry) { return entry && (entry.who === "You" || /^you$/i.test(entry.t || "")); })
          .map(function (entry) { return "You: " + String(entry.text || ""); }).join("\n");
        if (!transcript && saved && saved.text) transcript = String(saved.text).slice(0, 12000);
        return { qa: qa, transcript: transcript };
      }).catch(function () { return { qa: [], transcript: "" }; });
    }
    return read.then(function (packed) {
      return fetch("/api/kompas/brain", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "session", qa: packed.qa, transcript: packed.transcript, notes: session.feedbackNotes || [] }),
      });
    }).catch(function () {});
  }

  function bind() {
    var nav = $("navBrain");
    if (nav) nav.addEventListener("click", open);
    var clarify = $("answerTabClarify");
    if (clarify) clarify.addEventListener("click", function () { selectTab("clarify"); });
    var feedback = $("answerTabFeedback");
    if (feedback) feedback.addEventListener("click", function () { selectTab("feedback"); });
    var mic = $("feedbackMic");
    if (mic) mic.addEventListener("click", toggleMic);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.KompasBrainPage = { open: open, prefetch: prefetch, paintTrace: paintTrace, writeBack: writeBack, stopMic: stopMic };
})();
