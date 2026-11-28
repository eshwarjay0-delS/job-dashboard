/* Feedback belongs on category sessions and role sessions.
   A live interview, a mock, and chat do not show the tab or the mic. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KompasBrainGate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function sessionType(session) {
    if (!session) return "live";
    if (typeof session === "string") return session.trim().toLowerCase() || "live";
    var raw = session.type || session.kind || "live";
    return String(raw || "live").trim().toLowerCase() || "live";
  }

  function feedbackTabVisible(session) {
    var type = sessionType(session);
    return type === "category" || type === "role";
  }

  function applyFeedbackVisibility(doc, session) {
    var show = feedbackTabVisible(session);
    var tab = doc && doc.getElementById ? doc.getElementById("answerTabFeedback") : null;
    var pane = doc && doc.getElementById ? doc.getElementById("answerFeedbackPane") : null;
    var mic = doc && doc.getElementById ? doc.getElementById("feedbackMic") : null;
    if (tab) tab.hidden = !show;
    if (!show && tab && tab.setAttribute) tab.setAttribute("aria-selected", "false");
    if (pane) pane.hidden = true;
    if (mic) {
      mic.hidden = !show;
      if (!show && mic.setAttribute) mic.setAttribute("aria-pressed", "false");
    }
    return show;
  }

  return { sessionType: sessionType, feedbackTabVisible: feedbackTabVisible, applyFeedbackVisibility: applyFeedbackVisibility };
});
