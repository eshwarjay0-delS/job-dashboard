"use strict";
// AI Answer with a queue answers the latest heard question, then folds the
// next two seconds of transcript if it changes that question.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KompasLatestAsk = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LATE_CONTEXT_MS = 2000;
  const PRESS_START_BUDGET_MS = 100;
  const ASK = /[?]|(?:^|\s)(?:what|why|how|when|where|which|who|can|could|would|do|did|tell|describe|explain|walk|have you|did you)\b/i;

  function lineText(line) {
    if (line && typeof line === "object") return String(line.text || "").replace(/\s+/g, " ").trim();
    return String(line || "").replace(/^\s*(?:You|Them|Interviewer):\s*/i, "").replace(/\s+/g, " ").trim();
  }
  function lineWho(line) {
    return line && typeof line === "object" ? String(line.who || "") : "";
  }
  function isAsk(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return !!t && ASK.test(t);
  }
  function queuedAsks(lines) {
    const out = [];
    for (const line of lines || []) {
      const who = lineWho(line);
      if (who && /^(?:you|candidate|interviewee)$/i.test(who)) continue;
      const text = lineText(line);
      if (isAsk(text)) out.push(text);
    }
    return out;
  }
  function countQueuedAsks(lines) { return queuedAsks(lines).length; }
  function selectLatestQueuedAsk(lines) {
    const asks = queuedAsks(lines);
    if (!asks.length) return "";
    const last = asks[asks.length - 1];
    const prev = asks.length > 1 ? asks[asks.length - 2] : "";
    const shortFollow = /^(?:(?:and|so|but|ok(?:ay)?|right|well|then|now)[, ]+)*(?:why|how come|how so|and why|and how|and the second one)(?:\s+(?:that|this|it))?[.?!]*$/i.test(last);
    if (shortFollow && prev) {
      const left = /[.?!]$/.test(prev) ? prev : prev.replace(/[.!\s]+$/, "") + "?";
      return (left + " " + last).replace(/\s+/g, " ").trim();
    }
    return last;
  }
  function materialContextChange(question, extra) {
    const q = String(question || "").replace(/\s+/g, " ").trim();
    const e = String(extra || "").replace(/\s+/g, " ").trim();
    if (!e || e.length < 8) return false;
    if (/^(?:uh+|um+|okay|ok|yeah|yes|right|so|and|well|thanks|thank you)[.?!]*$/i.test(e)) return false;
    const n = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (n(q).includes(n(e))) return false;
    return true;
  }
  function foldLateContext(question, extra) {
    const q = String(question || "").replace(/\s+/g, " ").trim();
    if (!materialContextChange(q, extra)) return { question: q, changed: false };
    const e = String(extra || "").replace(/\s+/g, " ").trim();
    return { question: (q + " " + e).replace(/\s+/g, " ").trim(), changed: true };
  }
  function answerPressSchedule(pressedAt, now) {
    const elapsed = Math.max(0, Number(now) - Number(pressedAt));
    return { startNow: elapsed <= PRESS_START_BUDGET_MS, elapsedMs: elapsed, startDelayMs: 0, lateContextMs: LATE_CONTEXT_MS };
  }
  return {
    LATE_CONTEXT_MS,
    PRESS_START_BUDGET_MS,
    queuedAsks,
    countQueuedAsks,
    selectLatestQueuedAsk,
    materialContextChange,
    foldLateContext,
    answerPressSchedule,
  };
});
