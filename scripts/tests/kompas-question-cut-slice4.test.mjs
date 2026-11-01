// Question cut, slice 4 (29 Oct 2026): punctuation-stripped runs, "Explain the X. Explain the Y." and the SSH
// acronym, written as tests first. Each item has a failsafe. The desktop copy (public/kompas/app.js) must cut exactly
// like the server copy (src/lib/kompasAnswer.ts). The v4 rules only regroup heard words: on a fault or any changed
// word the slice-3 cut stands.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts";
import { repairDictation } from "../../src/lib/kompasDictation.ts";
import { loadDesktopCut, runSlice4Stress } from "../kompas-cut-stress.mjs";

const desktop = loadDesktopCut();
const both = (text) => {
  const server = splitDistinctAsks(text);
  assert.equal(JSON.stringify(desktop(text)), JSON.stringify(server), "desktop and server differ on: " + text);
  return server;
};
const n = (t) => both(t).length;

test("A. unpunctuated runs of 2 to 4 questions with filler between them are cut apart", () => {
  assert.deepEqual(both("what is pam okay what is iga um what is oidc so what is saml"), ["what is pam", "okay what is iga", "um what is oidc", "so what is saml"]);
  assert.equal(n("um what is saml so how does kerberos work"), 2);
  assert.equal(n("what is cyberark um have you used saviynt"), 2);
  assert.equal(n("so how do you rotate passwords in cyberark um have you used saviynt"), 2);
  assert.equal(n("what is CyberArk and then after that what is Okta"), 2);
  assert.equal(n("Great, thanks for that. Next question. What is CyberArk? And then after that, what is Okta?"), 2);
  assert.equal(n("what is zscaler next what is venafi"), 2);
});

test("A failsafe: compound questions with an inner opener stay one card", () => {
  for (const t of ["what is the difference between sso and saml", "how do you handle what happens when a token expires", "tell me about a time when you failed",
    "explain how okta works", "tell me about zscaler and why did you choose it", "tell me about zscaler and um why did you choose it",
    "how did you deploy venafi okay why did you pick it over keyfactor", "how do you rotate passwords and then how do you audit them",
    "tell me about a time when you failed so what did you learn", "what is cyberark and how does it work",
    "Tell me about your Okta migration. And what about SailPoint, have you used it?".toLowerCase().replace("migration. and", "migration and")]) {
    assert.equal(n(t), 1, t);
  }
});

test("B. 'Explain the X' after a finished explain or question sentence is its own card; 'Explain that part' stays", () => {
  assert.deepEqual(both("Explain the CyberArk CPM. Explain the PSM."), ["Explain the CyberArk CPM.", "Explain the PSM."]);
  assert.equal(n("explain the cyberark cpm explain the psm"), 2);
  assert.equal(n("What is CyberArk? Explain the Venafi TPP."), 2);
});

test("B failsafe: 'Explain that part', a design brief and a shared subject stay one card", () => {
  for (const t of ["Explain the CyberArk CPM. Explain that part.", "Tell me about your PKI work. Explain that part.", "Design Splunk ingestion. Explain the trust boundaries.",
    "What is Zero Trust? Explain the trust model.", "Explain the CyberArk CPM. Explain it again."]) assert.equal(n(t), 1, t);
});

test("D. a dash-continued lead and its question stay one card (1 Nov 2026, live video question)", () => {
  assert.deepEqual(both("Describe the high-level architecture of a SIEM — what are the core components?"), ["Describe the high-level architecture of a SIEM — what are the core components?"]);
  assert.equal(n("What is a SIEM — what are the core components?"), 1);
  assert.equal(n("What is index design — why does it matter for SIEM performance?"), 1);
  assert.equal(n("Describe index design — why does it matter for SIEM performance?"), 1);
  assert.equal(n("Describe the high-level architecture of a SIEM – what are the core components?"), 1);
  // Guards: finished questions still split, and unpunctuated runs without a dash still split.
  assert.equal(n("What is CyberArk? What is Okta?"), 2);
  assert.equal(n("what is pam okay what is iga um what is oidc so what is saml"), 4);
});

test("C. the server writes 'SSH key(s)' like the desktop, and nothing else changes", () => {
  assert.equal(repairDictation("how do you configure ssh keys"), "how do you configure SSH keys");
  assert.equal(repairDictation("we rotate the ssh key monthly"), "we rotate the SSH key monthly");
  assert.deepEqual(both("how do you configure ssh keys"), ["how do you configure SSH keys"]);
  for (const plain of ["what is ssh", "SSH keys", "she keys the car", "a shiv"]) assert.equal(repairDictation(plain), repairDictation(repairDictation(plain)), plain);
  assert.equal(repairDictation("what is ssh"), "what is ssh");
});

test("failsafe: a fault in the slice 4 rules returns the slice-3 cut, and no word is ever dropped", () => {
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
  const a = src.indexOf("const PHRASE_FIXES"), b = src.indexOf("function fixTerms", a);
  const c = src.indexOf("function shortFollowUp("), d = src.indexOf("const armsAuto", c);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + "\n" + src.slice(c, d) + "\nthis.v3 = splitDistinctAsksV3;\nsplitSeparateV4 = () => { throw new Error('boom'); };\nsplitMidAsksV4 = () => { throw new Error('boom'); };\nthis.f = splitDistinctAsks;", ctx);
  for (const t of ["what is pam okay what is iga", "Explain the CyberArk CPM. Explain the PSM.", "What is CyberArk? What is Okta?"]) assert.deepEqual(ctx.f(t), ctx.v3(t), t);
  const server = readFileSync(new URL("../../src/lib/kompasAnswer.ts", import.meta.url), "utf8");
  assert.ok(server.includes("return spokenWords(cut4.join(\" \")) === spokenWords(v3.join(\" \")) ? cut4 : v3"));
  for (const odd of ["", "?", "um", "um so", "and then after that", "explain the", "second", null, undefined]) assert.doesNotThrow(() => both(odd));
});

test("stress: 50 then 200, stripped variants of every family, nothing over-split, dropped or cut differently, new banks all right", () => {
  for (const size of [50, 200]) {
    const r = runSlice4Stress(size);
    assert.deepEqual({ overSplit: r.overSplit, dropped: r.dropped, mismatch: r.mismatch, acronymMismatch: r.acronymMismatch, newWrong: r.newWrong },
      { overSplit: 0, dropped: 0, mismatch: 0, acronymMismatch: 0, newWrong: 0 }, r.failures.slice(0, 5).join("\n"));
  }
});
