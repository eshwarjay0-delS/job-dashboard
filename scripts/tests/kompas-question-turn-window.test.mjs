// Question-start detection (owner, 1 Nov 2026): the question is formed from
// its whole turn, back to the turn's start — framing, setup and pausing
// fillers included — not from the last eight lines. A re-press re-forms from
// the transcript back to the turn's start, so framing the first window cut
// comes back. The walk stops at a floor change (a long line from the other
// side) or a pure next-question marker, never the whole interview.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const qcue = src.slice(src.indexOf("const Q_CUE ="), src.indexOf(";", src.indexOf("const Q_CUE =")) + 1);
const region = src.slice(src.indexOf("function shortFollowUp("), src.indexOf("const armsAuto"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(qcue + "\n" + region + "\nthis.opensNewAsk = opensNewAsk; this.Q_CUE = Q_CUE; this.formationWindow = formationWindow; this.turnWindow = turnWindow; this.recoverTurn = recoverTurn;", ctx);

const isAskThem = (t) => t.who === "Them" && (ctx.Q_CUE.test(t.text) || ctx.opensNewAsk(t.text));
const L = (who, text, seq) => ({ who, text, seq });
const framing = (n, from = 0) => Array.from({ length: n }, (_, i) => L("Them", `Framing line ${from + i} about the pipeline setup.`, from + i));

test("a long turn keeps its whole framing, not the last eight lines", () => {
  const lines = [...framing(20), L("Them", "What are the core components?", 20)];
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 21);
  assert.equal(w[0].text, "Framing line 0 about the pipeline setup.");
  assert.equal(w[20].text, "What are the core components?");
});

test("lines after the ask stay in the window, as before", () => {
  const lines = [...framing(5), L("Them", "What are the core components?", 5),
    ...Array.from({ length: 6 }, (_, i) => L("You", `Candidate ramble number ${i} with several words here.`, 6 + i))];
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 12);
  assert.equal(w[5].text, "What are the core components?");
});

test("a pure next-question marker ends the turn before it", () => {
  const lines = [L("Them", "Old turn line one.", 0), L("Them", "Old turn line two.", 1),
    L("Them", "Next question.", 2), ...framing(4, 3), L("Them", "What are the core components?", 7)];
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 5);
  assert.equal(w[0].text, "Framing line 3 about the pipeline setup.");
});

test("a long line from the other side is a floor change", () => {
  const lines = [L("Them", "Earlier framing line.", 0),
    L("You", "Candidate reply with several words that takes the floor.", 1),
    L("Them", "New framing line.", 2), L("Them", "What are the core components?", 3)];
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 2);
  assert.equal(w[0].text, "New framing line.");
});

test("a short acknowledgement never breaks the turn", () => {
  const lines = [L("Them", "Framing line one.", 0), L("You", "Yeah.", 1), L("Them", "What are the core components?", 2)];
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 3);
});

test("no ask in the lines falls back to the eight-line window", () => {
  const lines = framing(12);
  const w = ctx.turnWindow(lines, "Them", isAskThem);
  assert.equal(w.length, 8);
});

test("re-press recovery returns the turn from its start to the transcript end", () => {
  const transcript = [L("Them", "Old turn line.", 0), L("Them", "Next question.", 1),
    ...framing(3, 2), L("Them", "What are the core components?", 5),
    L("Them", "Since fragment after the first press.", 6)];
  const rec = ctx.recoverTurn(transcript, 2, "Them");
  assert.ok(rec);
  assert.equal(rec[0].seq, 2);
  assert.equal(rec.length, 5);
  assert.equal(rec[rec.length - 1].text, "Since fragment after the first press.");
  assert.equal(ctx.recoverTurn(transcript, 999, "Them"), null);
});

test("the turn rule is symmetric for a mic-source question", () => {
  const lines = [L("Them", "Interviewer line with several words here.", 0),
    L("You", "My framing line.", 1), L("You", "What do you mean by that?", 2)];
  const isAskYou = (t) => t.who === "You" && (ctx.Q_CUE.test(t.text) || ctx.opensNewAsk(t.text));
  const w = ctx.turnWindow(lines, "You", isAskYou);
  assert.equal(w.length, 2);
  assert.equal(w[0].text, "My framing line.");
});
