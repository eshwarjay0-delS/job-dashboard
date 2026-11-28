/* A detected question remembers where it was heard.
   mic, captions, computer-audio, or typed. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KompasQuestionSource = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var TAGS = { mic: "mic", captions: "captions", "computer-audio": "computer-audio", typed: "typed" };

  function questionAskTag(channel) {
    var raw = String(channel || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
    if (raw === "typed" || raw === "you-(typed)" || raw === "type") return TAGS.typed;
    if (raw === "captions" || raw === "caption" || raw === "caption-window") return TAGS.captions;
    if (raw === "mic" || raw === "microphone" || raw === "you") return TAGS.mic;
    if (raw === "computer-audio" || raw === "computer" || raw === "system" || raw === "them" || raw === "loopback") return TAGS["computer-audio"];
    return "";
  }

  function questionLine(question, channel) {
    var q = String(question || "").replace(/\s+/g, " ").trim().replace(/\s+\[(?:mic|captions|computer-audio|typed)\]$/i, "");
    var tag = questionAskTag(channel);
    if (!q || !tag) return q;
    return q + " [" + tag + "]";
  }

  return { questionAskTag: questionAskTag, questionLine: questionLine };
});
