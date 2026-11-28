/* Learned notes for a Role or Category pack. Same localStorage family as sessions. */
(function (root) {
  var KEY = "perfact.packNotes";

  function words(item) {
    return String(item || "").toLowerCase().split(/[^a-z0-9+]+/).filter(function (w) { return w.length > 3; });
  }

  function missed(must, answer) {
    var hay = String(answer || "").toLowerCase();
    return (must || []).filter(function (item) {
      var parts = words(item);
      if (!parts.length) return false;
      var hit = parts.filter(function (w) { return hay.indexOf(w) >= 0; }).length;
      return hit * 2 < parts.length;
    }).slice(0, 6);
  }

  function keptLine(answer) {
    var text = String(answer || "").replace(/\s+/g, " ").trim();
    var match = text.match(/^.{20,220}?[.!](?:\s|$)/);
    return (match ? match[0] : text.slice(0, 220)).trim();
  }

  function learn(notes, input) {
    var list = Array.isArray(notes) ? notes.slice() : [];
    var question = String(input && input.question || "").replace(/\s+/g, " ").trim().slice(0, 400);
    var answer = String(input && input.answer || "").trim();
    if (!question || answer.length < 40) return list;
    var note = {
      at: Number(input.at) || Date.now(),
      question: question,
      level: String(input && input.level || "engineer").slice(0, 40),
      kept: keptLine(answer),
      missed: missed(input && input.must, answer),
    };
    var key = question.toLowerCase();
    var next = list.filter(function (row) { return String(row && row.question || "").toLowerCase() !== key; });
    next.push(note);
    return next.slice(-12);
  }

  function read(storage, packId) {
    try {
      var all = JSON.parse(storage.getItem(KEY) || "{}");
      var rows = all && all[packId];
      return Array.isArray(rows) ? rows.slice(-12) : [];
    } catch (e) { return []; }
  }

  function write(storage, packId, notes) {
    var all = {};
    try { all = JSON.parse(storage.getItem(KEY) || "{}") || {}; } catch (e) { all = {}; }
    if (!all || typeof all !== "object") all = {};
    all[packId] = (notes || []).slice(-12);
    storage.setItem(KEY, JSON.stringify(all));
  }

  root.KompasPackNotes = { KEY: KEY, missed: missed, learn: learn, read: read, write: write };
})(typeof globalThis !== "undefined" ? globalThis : window);
