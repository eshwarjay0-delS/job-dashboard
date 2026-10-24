// Question integrity (owner, 23 Oct 2026): the question on the card is the
// WHOLE of what was asked, and every re-ask is a new view of the same truth.
// These are source-marker tests on purpose: on 23 Oct a rebase silently
// dropped one guard line from app.js while every behavior suite still
// passed — only the production probe caught it. A marker test makes that
// failure class fail loudly in the battery instead.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionToAnswer } from "../../src/lib/kompasAnswer.ts";

const appJs = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const route = readFileSync(new URL("../../src/app/api/kompas/answer/route.ts", import.meta.url), "utf8");
const answerLib = readFileSync(new URL("../../src/lib/kompasAnswer.ts", import.meta.url), "utf8");

test("the formed question joins every heard line — the last-line form is gone", () => {
  assert.match(appJs, /primary\.filter\(p => !anchorQ \|\| p\.text !== anchorQ\)\.map\(p => p\.text\)\.join\(" "\)/);
  assert.ok(!appJs.includes('plainHeard.split("\\n").pop()'), "no fallback may rebuild the question from its last line");
});

test("pressQuestion keeps the whole formed question over a contained fragment", () => {
  assert.match(appJs, /low\(derived\)\.includes\(low\(typedClean\)\)\) typedClean = ""/);
});

test("a client-formed question is never overwritten by the stream meta abstraction", () => {
  assert.match(appJs, /opts\.pinned\) && !opts\.derived\) \{ card\.question = ev\.derived/);
});

test("the server takes the formed question at full length and rotates re-asks to a fresh angle", () => {
  assert.match(route, /str\(body\.derived, 2000\)/);
  assert.match(route, /againAngle = pickAngle\(ledger\)/);
  assert.match(route, /NEW VIEW REQUIRED/);
  assert.match(route, /SAME truth from a different view/);
});

test("questionToAnswer keeps compound asks whole and caps at 2000, never 900", () => {
  const start = answerLib.indexOf("export function questionToAnswer");
  const body = answerLib.slice(start, answerLib.indexOf("\n}", start));
  assert.match(body, /asks\.length >= 2/);
  assert.ok(!body.includes("slice(0, 900)"), "the 900-char cut is gone from questionToAnswer");
});

test("a three-part compound ask is answered whole, every part, in order", () => {
  const q = "How do you onboard a new application into SailPoint? What metrics tell you the certification campaign is healthy? And how would you handle it when two hundred managers ignore their reviews?";
  const out = questionToAnswer("", q, true);
  const i1 = out.indexOf("onboard a new application");
  const i2 = out.indexOf("metrics tell you the certification campaign is healthy");
  const i3 = out.indexOf("two hundred managers ignore their reviews");
  assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, `all three asks survive, in order — got: ${out}`);
});
