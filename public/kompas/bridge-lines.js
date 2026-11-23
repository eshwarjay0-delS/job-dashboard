"use strict";
(() => {
// The old template that quoted the raw transcript is gone. This file only
// cleans turns and rejects a line. Display text comes from the model route.
const JUNK = /given what you said|what you said about|i'?d weigh exposure first|heard zero vulnerability|weigh what has to be true|what i would verify before calling it done|\binterviewer\b|listeningyou|pmand|pmokay|\.listening/i;

function cleanTurnText(text) {
  return String(text || "")
    .replace(/^(?:INTERVIEWER|Interviewer|Them|You)\b[:\s]*/i, "")
    .replace(/\b(?:listeningyou|listening|pmand|pmokay|pmi)\b/gi, " ")
    .replace(/([a-z])\1{3,}/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
function repeatedWord(text) {
  return /\b([a-z]{3,})\s+\1\b/i.test(String(text || ""));
}
function acceptLine(line) {
  const t = cleanTurnText(line);
  if (!t || t.split(/\s+/).length < 4) return "";
  if (JUNK.test(t) || repeatedWord(t)) return "";
  if (/[.!]$/.test(t) === false && t.length < 40) return "";
  return t;
}
function cleanTurns(turns) {
  const out = [];
  const list = Array.isArray(turns) ? turns.slice(-4) : [];
  for (const turn of list) {
    const text = cleanTurnText(turn && turn.text);
    if (!text || JUNK.test(text) || text.split(/\s+/).length < 3) continue;
    out.push({ who: turn && turn.who === "You" ? "You" : "Them", text });
  }
  return out;
}
function bridgeLines() {
  return [];
}

const api = { bridgeLines, cleanTurns, acceptLine, cleanTurnText };
if (typeof module === "object" && module.exports) module.exports = api;
globalThis.KompasBridgeLines = api;
})();
