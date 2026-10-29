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
  slice("function pressQuestion(", "$(\"answerBtn\")"),
  slice("async function aiAnswer(", "$(\"screenBtn\")"),
  slice("function hasAnswer(", "\n// Takes an empty page"),
].join("\n");

const OLD_Q = "Tell me about a security incident you handled end to end";
const OLD_A = "At Cigna I contained a phishing-led credential theft across 40 hosts within four hours.";

function session(typed) {
  const box = { value: typed };
  const asked = [];
  const s = {
    aiBusy: false, aiBusySince: 0, autoTimer: null, transcriptionEpoch: 0, transcriptionFailedEpoch: -1,
    running: false, captures: [], finals: new Set(), flushing: false, heardSeq: 1, answeredSeq: 1,
    transcript: [{ seq: 1, who: "Them", text: OLD_Q }],
    cards: [{ question: OLD_Q, answer: OLD_A }], idx: 0,
    $: (id) => (id === "manualInput" ? box : { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }),
    pendingHeard: () => [], updatePending() {}, flushHeard: async () => {}, setChat() {}, status() {},
    logEvent() {}, renderCard() {}, toTop() {}, clearTimeout() {}, plainAnswer: (a) => String(a),
    questionSource: () => "Them",
    generateAnswer: async (heard, card, opts) => { asked.push({ heard, card, opts }); },
  };
  s.addCard = (q, answer) => { const card = { question: q, answer }; s.cards.push(card); s.idx = s.cards.length - 1; return card; };
  vm.createContext(s);
  vm.runInContext(code, s);
  return { s, box, asked };
}

test("a typed question after an answer gets its own card, and the earlier question stays", async () => {
  const { s, box, asked } = session("What is Kerberos?");
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2, "a new card, not the old one painted over");
  assert.equal(s.cards[0].question, OLD_Q);
  assert.equal(s.cards[0].answer, OLD_A);
  assert.equal(s.cards[1].question, "What is Kerberos?");
  assert.equal(asked.length, 1);
  assert.equal(asked[0].card, s.cards[1]);
  assert.equal(asked[0].opts.derived, "What is Kerberos?");
  assert.doesNotMatch(asked[0].opts.derived, /security incident/, "the old question is not glued onto the new one");
  assert.equal(box.value, "", "the box empties only once the question is on its card");
});

test("a typed question with no question mark still stands on its own", async () => {
  const { s, asked } = session("explain zero trust network access");
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.equal(asked[0].opts.derived, "explain zero trust network access");
});

// Owner, 27 Oct 2026 (book rule): every request and response is its own page. A re-press still refines the question on
// screen, and its answer goes on the next page; the page it re-asks keeps its question and answer.
test("a lone typed keyword is its own question on the next page", async () => {
  const { s, asked } = session("Kerberos");
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.equal(s.cards[0].question, OLD_Q);
  assert.equal(s.cards[0].answer, OLD_A, "the earlier page keeps its answer");
  assert.equal(s.cards[1].question, "Kerberos");
  assert.equal(asked[0].card, s.cards[1]);
  assert.equal(asked[0].opts.derived, "Kerberos");
  assert.equal(asked[0].opts.reask, undefined);
});

test("pressing AI Answer again with nothing typed re-asks the same question on the next page", async () => {
  const { s, asked } = session("");
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.equal(s.cards[0].answer, OLD_A, "the finished page is not wiped");
  assert.equal(asked[0].card, s.cards[1]);
  assert.equal(s.cards[1].question, OLD_Q);
  assert.equal(asked[0].opts.reask, true);
});

// Owner's live session, 27 Oct 2026 (session log read back from the desktop): after the first answer every press was a
// re-press of the page on screen, so the old question was formed and answered again.
function heardSession(lines) {
  const h = session("");
  h.s.pendingHeard = () => lines.map((text, i) => ({ seq: 2 + i, who: "You", text }));
  h.s.composeIntake = h.s.composeIntake;   // the real intake from app.js
  return h;
}
test("a new question heard since the last answer opens a new page and is not a re-press", async () => {
  const { s, asked } = heardSession(["Alright, could you explain what dependency confusion is?", "So yeah, Dependency"]);
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.equal(s.cards[0].answer, OLD_A, "the answered page stays as it was");
  assert.equal(asked[0].card, s.cards[1]);
  assert.notEqual(asked[0].opts.reask, true, "a new question is answered as new, not as the old one again");
  assert.doesNotMatch(String(asked[0].heard), /Current question \(on screen\)/);
});
test("a press with nothing new asked is still a re-press (the 21 Oct rule), on the next page", async () => {
  const { s, asked } = heardSession(["and I also checked the proxy logs for that host"]);
  await s.aiAnswer(false);
  assert.equal(s.cards.length, 2);
  assert.equal(asked[0].opts.reask, true);
});
