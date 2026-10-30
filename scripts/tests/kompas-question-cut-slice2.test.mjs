// Question cut, slice 2 (29 Oct 2026). Three live failures on kompas-20261029-split, written as tests first:
//   1. no punctuation: "what is cyberark what is okta" was one card
//   2. "Tell me about your PKI work. Explain the Venafi part." was one card
//   3. "Tell me about yourself. Why do you want this job? Where do you see yourself in five years?" was two cards
// Each has a failsafe: what must stay one card, and no heard word is ever dropped. The desktop copy in
// public/kompas/app.js must cut exactly like the server copy in src/lib/kompasAnswer.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts";
import { repairDictation } from "../../src/lib/kompasDictation.ts";
import { loadDesktopCut, runCutStress, CUT_CASES, VARIANTS } from "../kompas-cut-stress.mjs";

const desktop = loadDesktopCut();
const both = (text) => {
  const server = splitDistinctAsks(text);
  assert.equal(JSON.stringify(desktop(text)), JSON.stringify(server), "desktop and server differ on: " + text);
  return server;
};
const words = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9+#']+/g, " ").trim();

test("1. no punctuation: two questions in one breath are two cards", () => {
  assert.deepEqual(both("what is cyberark what is okta"), ["what is cyberark", "what is okta"]);
  assert.equal(both("what is saml what is oidc").length, 2);
  assert.equal(both("why did you leave your last job what are you looking for next").length, 2);
  assert.equal(both("um what is cyberark um what is okta").length, 2);
});

test("1 failsafe. a question word inside one question never cuts it", () => {
  for (const one of [
    "tell me about zscaler and why did you choose it",
    "walk me through your IAM project go deeper on that",
    "what is the difference between sso and saml",
    "how do you handle what happens when a token expires",
    "tell me about a time when you failed",
    "explain how okta works",
    "tell me what is wrong with this design",
    "walk me through how you would migrate what is left of the ad forest",
    "describe a project where you led what was a failing rollout",
    "what tools do you use for siem tuning",
    "how do you decide what is in scope",
  ]) assert.equal(both(one).length, 1, one);
});

test("2. 'Explain the Venafi part' names its own subject, so it is the next card", () => {
  assert.deepEqual(both("Tell me about your PKI work. Explain the Venafi part."), ["Tell me about your PKI work.", "Explain the Venafi part."]);
  assert.equal(both("tell me about your pki work explain the venafi part").length, 2);
});

test("2 failsafe. 'Explain that part' and 'Go deeper' stay with the question they follow", () => {
  assert.equal(both("Tell me about your PKI work. Explain that part.").length, 1);
  assert.equal(both("What is NLA and why do we disable it? Go deeper.").length, 1);
  assert.deepEqual(both("What is NLA and why do we disable it? Go deeper on that exception."), ["What is NLA and why do we disable it?", "Go deeper on that exception."]);
});

test("3. opening questions: tell me about yourself, why this job, five years are three cards", () => {
  assert.deepEqual(both("Tell me about yourself. Why do you want this job? Where do you see yourself in five years?"),
    ["Tell me about yourself.", "Why do you want this job?", "Where do you see yourself in five years?"]);
  assert.equal(both("tell me about yourself why do you want this job where do you see yourself in five years").length, 3);
});

test("3 failsafe. parallel how-did-you questions and a follow-up about 'this' stay one card", () => {
  assert.equal(both("How do you assess the business impact? How do you understand root cause?").length, 1);
  assert.equal(both("Tell me about your PKI rollout. Why did you choose this approach?").length, 1);
  assert.equal(both("Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation.").length, 1);
});

test("failsafe: no heard word is dropped, odd input does not throw, and both copies fall back to the old cut", () => {
  for (const [heard] of CUT_CASES) for (const [, vary] of VARIANTS) {
    const t = vary(heard);
    assert.equal(words(both(t).join(" ")), words(fixedWords(t)), t);
  }
  for (const odd of ["", "   ", "?", "what", "what is what is what is", "um um um", "x".repeat(5000), "what is a what is b ".repeat(200)]) {
    assert.doesNotThrow(() => both(odd));
  }
  const ts = readFileSync(new URL("../../src/lib/kompasAnswer.ts", import.meta.url), "utf8");
  const js = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
  assert.match(ts, /const before = splitDistinctAsksBy\(text, false\)[\s\S]*catch \{\s*return before/);
  assert.match(js, /const before = splitDistinctAsksBy\(text, false\);[\s\S]*catch \{ return before; \}/);
});
// The cut repairs dictation first ("cyber arch" -> CyberArk), so compare against the repaired words.
function fixedWords(t) { return repairDictation(t); }

test("stress: 50 then 200 heard stretches, nothing merged, over-split, dropped or cut differently", () => {
  for (const n of [50, 200]) {
    const m = runCutStress(n);
    assert.equal(m.sequences, n);
    assert.deepEqual({ merged: m.merged, overSplit: m.overSplit, dropped: m.dropped, mismatch: m.mismatch, bleedKept: m.bleedKept },
      { merged: 0, overSplit: 0, dropped: 0, mismatch: 0, bleedKept: 0 }, m.failures.join("\n"));
  }
});
