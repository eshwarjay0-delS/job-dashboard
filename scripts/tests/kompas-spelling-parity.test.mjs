// Spelling parity, slice 5a (29 Oct 2026). The desktop (public/kompas/app.js PHRASE_FIXES) and the server
// (src/lib/kompasDictation.ts REPAIRS) must hold ONE list: same patterns, same order, same output. The page is a
// plain browser script and the server is TypeScript, so the list is written twice and this test is the lock.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as D from "../../src/lib/kompasDictation.ts";
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts";
import { loadDesktopCut } from "../kompas-cut-stress.mjs";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("const PHRASE_FIXES"), src.indexOf("function fixTerms")) + "\nthis.fixPhrases = fixPhrases; this.list = PHRASE_FIXES;", ctx);
const desk = (t) => ctx.fixPhrases(t);
const server = (t) => D.repairDictation(t);
const desktopCut = loadDesktopCut();

const TOOL = [
  ["we moved web traffic to zee scaler", "Zscaler"], ["is see scaler a proxy", "Zscaler"],
  ["have you used saviant", "Saviynt"], ["tell me about savvy ent", "Saviynt"],
  ["we use service now tickets for access", "ServiceNow"], ["how did you integrate cyberark with service now", "ServiceNow"],
  ["give me a big intro", "Big Intro"], ["track it in service now", "ServiceNow"], ["log it in service now", "ServiceNow"], ["ticket in service now", "ServiceNow"], ["open a ticket in service now", "ServiceNow"],
  ["map controls to nist csf", "NIST CSF"], ["did you use google sec ops", "Google SecOps"],
  ["why do you want to work at big intro", "Big Intro"], ["are you a u s citizen", "U.S. citizen"],
  ["how does ven a fi issue certificates", "Venafi"], ["what is cyber-arc", "CyberArk"], ["what is cyber ark", "CyberArk"],
  ["what is cyber arc pam", "CyberArk"],
];
const PLAIN = [
  "the service now is slow", "customer service now takes a week", "we're in service now", "the car is in service now",
  "give me a big intro to the team", "give me a big intro for the slides", "we provide service now", "customer service now closed", "i need service now", "the line is open in service now", "we are in service now",
  "give a big intro to the team", "that was a big intro", "a big introduction", "let us see the scaler settings",
  "i see scale problems", "the cyber archive", "u s and them", "he is savvy entirely", "a nist report", "google search ops",
  "venue a fine place", "the service desk", "he went beyond trust", "a sock two days ago",
];

test("5a-1. the desktop and server lists are the same list, entry for entry", () => {
  const list = D.DICTATION_REPAIRS;
  assert.ok(Array.isArray(list), "kompasDictation.ts exports DICTATION_REPAIRS");
  assert.equal(ctx.list.length, list.length, "same number of repairs");
  ctx.list.forEach(([re, rep], i) => {
    assert.equal(re.source, list[i][0].source, "pattern " + i);
    assert.equal(re.flags, list[i][0].flags, "flags " + i);
    assert.equal(typeof rep, typeof list[i][1], "replacement kind " + i);
    if (typeof rep === "string") assert.equal(rep, list[i][1], "replacement " + i);
  });
});

test("5a-2. the nine desktop-only repairs and the wider cyber ark form now repair on the server too", () => {
  for (const [heard, want] of TOOL) {
    assert.ok(server(heard).includes(want), "server: " + heard + " -> " + server(heard));
    assert.equal(server(heard), desk(heard), "parity: " + heard);
  }
});

test("5a-3 failsafe. normal English is never altered on either side", () => {
  for (const p of PLAIN) {
    assert.equal(server(p), p, "server changed: " + p);
    assert.equal(desk(p), p, "desktop changed: " + p);
  }
});

test("5a-4. repairs are stable and the two sides give identical output on the parity corpus", () => {
  for (const t of [...TOOL.map((x) => x[0]), ...PLAIN]) {
    assert.equal(server(server(t)), server(t), "stable: " + t);
    assert.equal(desk(t), server(t), "parity: " + t);
  }
});

test("5a-5. 'U.S. citizen' stays one card on both sides (the full stops in U.S. are not a sentence end)", () => {
  for (const t of ["are you a u s citizen", "Are you a U.S. citizen?"]) {
    assert.equal(splitDistinctAsks(t).length, 1, "server: " + t);
    assert.equal(JSON.stringify(desktopCut(t)), JSON.stringify(splitDistinctAsks(t)), "parity cut: " + t);
  }
});
