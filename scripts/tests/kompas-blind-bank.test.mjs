// Blind dossier bank, slice 5b (29 Oct 2026). 191 interview questions copied verbatim from the 20 ChatGPT dossiers
// (numbering removed), run as 130 two-to-four-question breaths in three forms: punctuated, stripped (no marks, lower
// case) and stripped with filler between asks. The expected card count is the number of separately numbered source
// questions, fixed before any cut ran. The floors below are the measured slice-5b counts: they lock against
// regressions and are NOT an accuracy claim on live speech.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts";
import { loadDesktopCut } from "../kompas-cut-stress.mjs";

const bank = JSON.parse(readFileSync(new URL("./fixtures/kompas-blind-dossier-bank.json", import.meta.url), "utf8"));
const desktop = loadDesktopCut();
const both = (t) => {
  const s = splitDistinctAsks(t);
  assert.equal(JSON.stringify(desktop(t)), JSON.stringify(s), "desktop and server differ on: " + t);
  return s;
};
const words = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

test("5b-1. a what/which piece with no verb is finished by 'have you used', not cut off", () => {
  assert.equal(both("What dashboards or data tools have you used?").length, 1);
  assert.equal(both("what kinds of applications have you worked with").length, 1);
  assert.equal(both("which tools have you used for vulnerability assessment").length, 1);
});

test("5b-2. 'who' after a word for people is a clause of the same question", () => {
  assert.equal(both("How do you speak about controls to people who do not have a security background?").length, 1);
  assert.equal(both("how do you speak about controls to people who do not have a security background").length, 1);
});

test("5b-3. two finished, unrelated questions of 7+ words each are two cards", () => {
  assert.equal(both("How do you manage policy deviations and security exceptions? How do you threat model a microservice architecture?").length, 2);
  assert.equal(both("What would you ask the hiring manager and risk decisioning lead? What do you do when an engineering team or vendor disagrees with your finding?").length, 2);
});

test("5b failsafe: related, short, pointing-back or stripped pairs keep the slice-4 grouping", () => {
  for (const t of [
    "How do you assess the business impact? How do you understand root cause?",        // 6 words: stays one card
    "How would you prioritize the first 90 days across 27 control areas? How would you classify and prioritize threat model findings?",   // shares "prioritize"
    "How do you validate remediation? How would you remove local admin rights from 30,000 endpoints without causing a support disaster?",
    "How would you design the PAM rollout for the bank? How would you measure whether that rollout worked for the bank?",
    "How would you approach securing an OT environment you have just inherited? How would you monitor it without disrupting operations?",
    "where do guardrails belong who can modify workflow definitions and protected branches",
  ]) {
    const want = t.startsWith("where do") ? 2 : 1;
    assert.equal(both(t).length, want, t);
  }
});

test("5b failsafe: no heard word is ever lost and the order is kept", () => {
  for (const r of bank.runs) for (const v of ["punctuated", "stripped", "filler"]) {
    assert.equal(words(both(r[v]).join(" ")), words(r[v]), r.id + " " + v);
  }
});

test("5b bank floors (measured, offline): no single question split, no over-split, desktop = server", () => {
  const pass = { punctuated: 0, stripped: 0, filler: 0 };
  let over = 0;
  for (const r of bank.runs) for (const v of Object.keys(pass)) {
    const n = both(r[v]).length;
    if (n === r.expect) pass[v]++;
    if (n > r.expect) over++;
  }
  for (const q of bank.singles) {
    assert.equal(both(q).length, 1, q);
    assert.equal(both(q.replace(/[^\w\s'#&+-]/g, "").toLowerCase()).length, 1, q);
  }
  assert.equal(over, 0, "over-split runs");
  assert.ok(pass.punctuated >= 99, "punctuated " + pass.punctuated + "/130");
  assert.ok(pass.stripped >= 39, "stripped " + pass.stripped + "/130");
  assert.ok(pass.filler >= 30, "filler " + pass.filler + "/130");
});
