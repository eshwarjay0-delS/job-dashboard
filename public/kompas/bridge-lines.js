"use strict";
(() => {
// Speakable bridge while the main answer loads. Built from the last few
// dialogue turns, not a clarifying question and not a gap apology.
const BANNED = /resume|not on|won'?t lie|can'?t claim|won'?t make|make this up|not directly|could you clarify|what do you mean|great question|i won'?t/i;
const STOP = new Set("what how why when where who the and for with your about would could should tell from that this have does did can will are was into been them you just then start mean like really very some more over they their there here being were said says saying only also than next been want need into".split(" "));

function words(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.\s-]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
}
function unique(list) {
  const out = [];
  for (const w of list) if (w && !out.includes(w)) out.push(w);
  return out;
}
function isAsk(text) {
  const t = String(text || "").trim();
  if (!t || /^(?:hi|hello|hey|thanks|thank you|okay|ok|yeah|yes|sure|cool|got it|right|alright)\b/i.test(t)) return false;
  if (/\?\s*$/.test(t)) return true;
  return /^(?:how|what|why|when|where|which|who|tell me|walk me|describe|design|did you|do you|have you|can you|could you|would you)\b/i.test(t);
}
function considerations(blob) {
  const b = String(blob || "").toLowerCase();
  if (/\b(?:triag|alert|incident|notable|siem|splunk|sentinel)\b/.test(b)) return ["exposure", "which service it actually touches"];
  if (/\b(?:design|architect|rollout|failover|catalog|migration)\b/.test(b)) return ["what fails first", "who has to run it the next morning"];
  if (/\b(?:access|identity|privilege|role|pam)\b/.test(b)) return ["who can reach it", "how that access gets taken back"];
  return ["what has to be true first", "what I would verify before calling it done"];
}
function phrase(list) {
  return list.slice(0, 3).join(" ");
}

function bridgeLines(input) {
  const src = Array.isArray(input) ? { turns: input } : (input || {});
  const recent = (src.turns || []).slice(-6).map((turn) => ({
    who: turn && turn.who === "You" ? "You" : "Them",
    text: String(turn && turn.text || "").replace(/\s+/g, " ").trim(),
  })).filter((turn) => turn.text);
  let ask = "";
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].who !== "You" && isAsk(recent[i].text)) { ask = recent[i].text; break; }
  }
  const header = String(src.question || "").replace(/\s+/g, " ").trim();
  if (!ask && header && isAsk(header)) ask = header;
  if (!ask) return [];
  const earlier = recent.filter((turn) => turn.text !== ask).map((turn) => turn.text);
  const askWords = unique(words(ask));
  const priorWords = unique(earlier.flatMap(words)).filter((w) => !askWords.includes(w));
  const topic = phrase(askWords) || "this";
  const prior = phrase(priorWords);
  const [first, second] = considerations(`${ask} ${earlier.join(" ")}`);
  const lines = prior
    ? [
      `So on ${topic}, given what you said about ${prior}, I'd weigh ${first} first.`,
      `That earlier ${prior} point still matters here, so I'd check ${second} before I go on.`,
    ]
    : [
      `So the way I'd think about ${topic} is ${first} first, then ${second}.`,
      `I'd start with ${first}, and the next thing I'd settle is ${second}.`,
    ];
  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line && !BANNED.test(line)).slice(0, 2);
}

const api = { bridgeLines, BANNED };
if (typeof module === "object" && module.exports) module.exports = api;
globalThis.KompasBridgeLines = api;
})();
