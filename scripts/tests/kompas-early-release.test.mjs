// Slice 5c (29 Oct 2026): the pure early-release decision. Offline, no page, no network. The flag is OFF by default,
// so the first test is the shipped behaviour: nothing is ever released early.
import test from "node:test";
import assert from "node:assert/strict";
import { canReleaseEarly, EARLY_RELEASE_DEFAULT } from "../kompas-early-release.mjs";

const on = { enabled: true, pauseMs: 400 };
const rel = (p, o = on) => canReleaseEarly(p, undefined, o).release;
const keep = (p, f) => canReleaseEarly(p, f).keep;

test("5c-0. flagged off by default: nothing is released early", () => {
  assert.equal(EARLY_RELEASE_DEFAULT, false);
  assert.deepEqual(canReleaseEarly("tell me about your PAM rollout", undefined, { pauseMs: 900 }), { release: false, reason: "flag-off" });
});

test("5c-1. an opener plus an object noun phrase and a short pause is released", () => {
  assert.equal(rel("tell me about your PAM rollout"), true);
  assert.equal(rel("um so what is CyberArk"), true);
  assert.equal(rel("how do you rotate privileged passwords"), true);
  assert.equal(rel("walk me through your Venafi deployment"), true);
});

test("5c-2. not released: no pause, dangling end, no object, a pointer, or too short", () => {
  assert.equal(rel("tell me about your PAM rollout", { enabled: true, pauseMs: 120 }), false);
  for (const p of ["tell me about your PAM rollout and", "what is the difference between", "how do you", "tell me about that",
    "tell me about a time", "explain it", "what is", "so um", "the PAM rollout", "how do you rotate passwords in"]) assert.equal(rel(p), false, p);
});

test("5c-3. correction: the PAM rollout plus the Venafi integration is a changed question, so the early work is cancelled", () => {
  assert.equal(rel("tell me about your PAM rollout"), true);
  assert.deepEqual(canReleaseEarly("tell me about your PAM rollout", "tell me about your PAM rollout and the Venafi integration"), { keep: false, reason: "changed" });
});

test("5c-4. correction: new subject, different intent, added constraint, or a rewritten start all cancel", () => {
  assert.equal(keep("what is CyberArk", "what is CyberArk PSM"), false);              // new subject
  assert.equal(keep("how do you rotate privileged passwords", "how do you rotate privileged passwords in Azure"), false);   // constraint
  assert.equal(keep("tell me about your PAM rollout", "tell me about your PAM rollout what went wrong"), false);   // intent
  assert.equal(keep("what is cyber ark", "what is CyberArk"), false);                // the transcriber rewrote it: start over
});

test("5c-5. correction: the same words, or only filler after them, keep the early work", () => {
  assert.equal(keep("tell me about your PAM rollout", "Tell me about your PAM rollout."), true);
  assert.equal(keep("what is CyberArk", "what is CyberArk please"), true);
  assert.equal(keep("walk me through your Venafi deployment", "walk me through your Venafi deployment um in detail"), true);
});

test("5c-6. fail-open: bad input never throws and never releases", () => {
  for (const bad of [undefined, null, "", 42, {}]) {
    assert.equal(canReleaseEarly(bad, undefined, on).release, false);
    assert.equal(canReleaseEarly(bad, "what is CyberArk").keep, false);
  }
});
