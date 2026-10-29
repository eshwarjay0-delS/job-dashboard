// Question intake (owner, 2026-10-21): the answered question is a
// concatenation of the typed box + computer audio (Them) + mic, composed
// at AI Answer time. His own read-aloud never forms a question (keywords
// at most), noise never becomes a card, and keyword-only fragments are
// tackled into the lane by the caller. Runs the REAL block sliced out of
// public/kompas/app.js so the shipped code is what is tested.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const start = src.indexOf("// ── Question intake");
const end = src.indexOf("// ── end question intake ──");
assert.ok(start > 0 && end > start, "intake block markers must exist in app.js");
const block = src.slice(start, end);
// Q_CUE lives outside the block in app.js; slice the real one too.
const cueStart = src.indexOf("const Q_CUE =");
const cueEnd = src.indexOf(";", cueStart);
assert.ok(cueStart > 0, "Q_CUE must exist in app.js");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(cueStart, cueEnd + 1) + "\n" + block + "\nthis.composeIntake = composeIntake; this.isNoiseLine = isNoiseLine;", ctx);
const { composeIntake, isNoiseLine } = ctx;

const THEM_Q = { who: "Them", text: "So, what were the worst challenges that you faced and failed and learned from?" };
const ANSWER = "At Citi I led the endpoint migration. We rolled out CrowdStrike across forty thousand endpoints and I owned the firewall policy cleanup end to end.";

test("a real interviewer question is worthy and becomes the derived question", () => {
  const r = composeIntake([THEM_Q], {});
  assert.equal(r.worthy, true);
  assert.equal(r.derived, THEM_Q.text);
  assert.match(r.heard, /^Them: /);
});

test("a long question heard in pieces forms the WHOLE question, never just its last line (owner, 23 Oct)", () => {
  const pieces = [
    { who: "Them", text: "We run SailPoint in a pretty complex setup with three regions and a legacy connector that nobody wants to touch." },
    { who: "Them", text: "Last quarter a certification campaign stalled halfway and access reviews piled up for two hundred managers." },
    { who: "Them", text: "How would you redesign the campaign so it finishes on time?" },
  ];
  const r = composeIntake(pieces, {});
  assert.equal(r.worthy, true);
  assert.equal(r.derived, pieces.map(p => p.text).join(" "));
  assert.ok(r.derived.startsWith("We run SailPoint"), "the opening context survives question-forming");
  assert.ok(r.derived.endsWith("How would you redesign the campaign so it finishes on time?"));
});

test("a lone greeting is noise: never worthy, never a card", () => {
  const r = composeIntake([{ who: "Them", text: "Hello." }], {});
  assert.equal(r.worthy, false);
  assert.equal(r.noiseOnly, true);
  assert.equal(r.heard, "");
  assert.equal(isNoiseLine("Hello."), true);
  assert.equal(isNoiseLine("How did you handle the migration?"), false);
});

test("the user spelling out the on-screen answer is echo: dropped, keywords at most", () => {
  const echo = { who: "You", text: "At Citi I led the endpoint migration and we rolled out CrowdStrike across forty thousand endpoints" };
  const r = composeIntake([echo, THEM_Q], { answerText: ANSWER });
  assert.equal(r.dropped.echo, 1);
  assert.equal(r.primaryCount, 1);
  assert.doesNotMatch(r.heard, /You: At Citi/);
  assert.equal(r.worthy, true);
});

test("genuine new mic speech (not the answer) rides as context keywords, never the question", () => {
  const mine = { who: "You", text: "I also ran the SailPoint access reviews every quarter for the audit team" };
  const r = composeIntake([mine, THEM_Q], { answerText: ANSWER });
  assert.equal(r.dropped.echo, 0);
  assert.equal(r.micContextCount, 1);
  assert.match(r.heard, /You \(context keywords\): I also ran the SailPoint/);
  assert.equal(r.derived, THEM_Q.text);
});

test("the typed box concatenates with computer audio at answer time", () => {
  const r = composeIntake([THEM_Q], { typedText: "Worst challenges you faced and failed and learned" });
  assert.equal(r.worthy, true);
  assert.match(r.heard, /^You \(typed\): Worst challenges/);
  assert.match(r.heard, /Them: So, what were/);
  assert.equal(r.primaryCount, 2);
});

test("a topic with no question mark is the question", () => {
  const r = composeIntake([
    { who: "Them", text: "CyberArk vault" },
    { who: "Them", text: "and the CPM rotation piece" },
  ], {});
  assert.equal(r.worthy, true);
  assert.equal(r.noiseOnly, false);
  assert.ok(r.keywords.includes("CyberArk"));
  assert.ok(r.keywords.length >= 2);
});

test("mic-only: a short topic is the question", () => {
  const r = composeIntake([{ who: "You", text: "Compliance and GRC side" }], { micIsSource: true });
  assert.equal(r.worthy, true);
  assert.equal(r.primaryCount, 1);
  assert.match(r.heard, /Compliance and GRC side/);
});

test("mic-only mode: the mic is the question source, minus the echo drop", () => {
  const asked = { who: "You", text: "Can you describe a time you handled a major incident?" };
  const r = composeIntake([asked], { micIsSource: true });
  assert.equal(r.worthy, true);
  assert.equal(r.primaryCount, 1);
  const echo = { who: "You", text: "At Citi I led the endpoint migration and we rolled out CrowdStrike" };
  const r2 = composeIntake([echo], { micIsSource: true, answerText: ANSWER });
  assert.equal(r2.dropped.echo, 1);
  assert.equal(r2.worthy, false);
});

test("a call of pure greetings from both sides stays noise-only", () => {
  const r = composeIntake([
    { who: "Them", text: "Hi there" },
    { who: "You", text: "Hello, yeah" },
  ], { answerText: ANSWER });
  assert.equal(r.noiseOnly, true);
  assert.equal(r.worthy, false);
});

test("re-press combining: previous lines + new fragment + on-screen question compose as one", () => {
  const prev = [{ who: "Them", text: "We are migrating the firewalls next quarter and the audit is in March." }];
  const frag = [{ who: "Them", text: "So how would you handle the rule cleanup?" }];
  const r = composeIntake(frag, { previous: prev, currentQuestion: "How do you handle firewall rule cleanup?" });
  assert.equal(r.worthy, true);
  assert.match(r.heard, /Them \(earlier\): We are migrating/);
  assert.match(r.heard, /Them: So how would you handle/);
  assert.match(r.heard, /Current question \(on screen\): How do you handle firewall rule cleanup\?/);
  assert.equal(r.anchorQ, "How do you handle firewall rule cleanup?");
});

test("re-press combining: an earlier line repeated in the new lines is only heard once", () => {
  const line = { who: "Them", text: "What is your approach to vulnerability scanning?" };
  const r = composeIntake([line], { previous: [line] });
  assert.equal((r.heard.match(/vulnerability scanning/g) || []).length, 1);
});
