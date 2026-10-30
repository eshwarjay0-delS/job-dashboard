// #32 audit (slice 9, scratch): a typed follow-up after an answer gets its OWN card, attached to the open question.
// Typed questions (owner, 21 Oct 2026): "Still if type something that didn't
// appear", "the questions isn't updating", "it kept on giving the same answer".
// After one answer was on screen, every typed Enter counted as a re-press: the
// typed words were glued in front of the old question, painted over the old
// card, and answered as the old topic. Runs the REAL press path sliced out of
// public/kompas/app.js so the shipped code is what is tested.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
function slice(start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert.ok(a > 0 && b > a, `${start} must exist in app.js`);
  return src.slice(a, b);
}
const code = [
  src.slice(src.indexOf("const Q_CUE ="), src.indexOf(";", src.indexOf("const Q_CUE =")) + 1),
  slice("// ── Question intake", "// ── end question intake ──"),
  slice("function shortFollowUp(", "const armsAuto"),
  slice("function pressQuestion(", "$(\"answerBtn\")"),
  slice("async function aiAnswer(", "$(\"screenBtn\")"),
  slice("function hasAnswer(", "\n// Takes an empty page"),
].join("\n");

const OLD_Q = "Tell me about a security incident you handled end to end";
const OLD_A = "At Cigna I contained a phishing-led credential theft across 40 hosts within four hours.";

function session(typed, cards) {
  const box = { value: typed };
  const asked = [];
  const s = {
    aiBusy: false, aiBusySince: 0, autoTimer: null, transcriptionEpoch: 0, transcriptionFailedEpoch: -1,
    running: false, captures: [], finals: new Set(), flushing: false, heardSeq: 1, answeredSeq: 1,
    transcript: [{ seq: 1, who: "Them", text: OLD_Q }],
    cards: cards || [{ question: OLD_Q, answer: OLD_A }], idx: (cards || [1]).length - 1,
    $: (id) => (id === "manualInput" ? box : { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }),
    pendingHeard: () => [], updatePending() {}, flushHeard: async () => {}, setChat() {}, status() {},
    logEvent() {}, logDecision() {}, renderCard() {}, toTop() {}, clearTimeout() {}, plainAnswer: (a) => String(a),
    questionSource: () => "Them",
    generateAnswer: async (heard, card, opts) => { asked.push({ heard, card, opts }); },
  };
  s.addCard = (q, answer) => { const card = { question: q, answer }; s.cards.push(card); s.idx = s.cards.length - 1; return card; };
  vm.createContext(s);
  vm.runInContext(code, s);
  return { s, box, asked };
}


for (const typed of ["And why?", "Go deeper", "why?", "and how?"]) test(`typed "${typed}" after an answer opens its own card about the open question`, async () => {
  const { s, asked } = session(typed);
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2, "own card");
  assert.equal(s.cards[0].question, OLD_Q); assert.equal(s.cards[0].answer, OLD_A);
  assert.equal(asked.length, 1); assert.equal(asked[0].card, s.cards[1]);
  const q = asked[0].opts.derived || s.cards[1].question;
  assert.match(q, /security incident/i, "attached to the open question");
  assert.match(q, new RegExp(typed.replace(/[?]/g, "").split(" ").pop(), "i"), "keeps the typed follow-up");
});
test("a typed follow-up attaches to the LATEST answered question, not the first", async () => {
  const Q2 = "How does Kerberos delegation work?";
  const { s, asked } = session("And why?", [{ question: OLD_Q, answer: OLD_A }, { question: Q2, answer: "Constrained delegation limits the services." }]);
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 3);
  const q = asked[0].opts.derived || s.cards[2].question;
  assert.match(q, /kerberos/i); assert.doesNotMatch(q, /security incident/i);
});
test("failsafe: nothing attaches to a placeholder card", async () => {
  const { s, asked } = session("And why?", [{ question: "Preparing\u2026", answer: ["\u2026"] }]);
  await s.aiAnswer(false);
  const q = asked.length ? (asked[0].opts.derived || "") : "";
  assert.doesNotMatch(q, /Preparing/);
});
test("failsafe: a typed question naming its own subject is not glued on", async () => {
  const { s, asked } = session("Why is Kerberos better than NTLM?");
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.doesNotMatch(asked[0].opts.derived, /security incident/i);
});
