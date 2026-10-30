// Question cut, slice 3 (29 Oct 2026): the round-2 production failures on kompas-20261029-split, written as tests
// first. Each item has a failsafe. The desktop copy (public/kompas/app.js) must cut exactly like the server copy
// (src/lib/kompasAnswer.ts). The v3 rules only regroup heard words: on a fault or any changed word the v2 cut stands.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { splitDistinctAsks, repeatsPriorQuestion } from "../../src/lib/kompasAnswer.ts";
import { loadDesktopCut, runSlice3Stress } from "../kompas-cut-stress.mjs";
import { loadIntake } from "../kompas-intake-slice.mjs";

const desktop = loadDesktopCut();
const { api } = loadIntake();
const both = (text) => {
  const server = splitDistinctAsks(text);
  assert.equal(JSON.stringify(desktop(text)), JSON.stringify(server), "desktop and server differ on: " + text);
  return server;
};
const n = (t) => both(t).length;
const gate = (t) => api.turnGate(t).outcome;
const rep = (t, p) => { const s = repeatsPriorQuestion(t, p); assert.equal(api.repeatsPriorQuestion(t, p), s, "desktop and server differ: " + t); return s; };

test("1. 'What about X?', 'Can you give an example?' and pronoun follow-ups stay with the open question", () => {
  assert.equal(n("Tell me about your PAM rollout. What about Azure?"), 1);
  assert.equal(n("How do you integrate CyberArk with Okta? What about with SailPoint?"), 1);
  assert.equal(n("Tell me about your Okta migration. Can you give an example?"), 1);
  assert.equal(n("Describe your IGA project. Can you give me a specific example?"), 1);
  assert.equal(n("How does Okta use SAML? How does it use OIDC?"), 1);
  assert.equal(n("Tell me about a time you handled a security incident. What was the outcome?"), 1);
  assert.equal(n("Tell me about the outage. So what happened next?"), 1);
});
test("1 failsafe. named follow-ups and new subjects keep their own card", () => {
  assert.deepEqual(both("What is NLA and why do we disable it? Go deeper on that exception."), ["What is NLA and why do we disable it?", "Go deeper on that exception."]);
  assert.equal(n("Tell me about your Okta migration. And what about SailPoint, have you used it?"), 2);
  assert.equal(n("What is Zscaler? What is Venafi?"), 2);
  assert.equal(n("Tell me about your PKI work. Explain the Venafi part."), 2);
});

test("2. a repeated question across turns is recognised: sorry, again, please, reworded", () => {
  assert.equal(rep("Sorry, what is CyberArk?", "What is CyberArk?"), true);
  assert.equal(rep("How does Kerberos work, again?", "How does Kerberos work?"), true);
  assert.equal(rep("Tell me about your Okta migration please.", "Tell me about your Okta migration."), true);
  assert.equal(rep("Can you tell me how Kerberos works?", "How does Kerberos work?"), true);
});
test("2 failsafe. a genuinely new question is never hidden as a repeat; a fault adds nothing", () => {
  assert.equal(rep("Sorry, what is Okta?", "What is CyberArk?"), false);
  assert.equal(rep("How does Kerberos delegation work?", "How does Kerberos work?"), false);
  assert.equal(rep("Tell me about your SailPoint migration please.", "Tell me about your Okta migration."), false);
  assert.equal(rep("And why?", "Why did you pick CyberArk?"), false);
  assert.equal(rep("What is SAML?", "What is OIDC?"), false);
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
  const a = src.indexOf("function shortFollowUp("), b = src.indexOf("const armsAuto", a);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + "\nrepeatsPriorQuestionV3 = () => { throw new Error('boom'); };\nthis.r = repeatsPriorQuestion;", ctx);
  assert.equal(ctx.r("What is CyberArk?", "What is CyberArk?"), true);       // v2 still answers
  assert.equal(ctx.r("Sorry, what is CyberArk?", "What is CyberArk?"), false); // the v3 extra is simply off
});

test("3. numbered lists are one card per item", () => {
  assert.equal(n("First, what is SAML? Second, what is OIDC?"), 2);
  assert.equal(n("I have two questions. First, what is CyberArk? Second, how does it rotate passwords?"), 2);
  assert.equal(n("Firstly tell me about Venafi. Secondly tell me about Zscaler. Thirdly tell me about Saviynt."), 3);
  assert.equal(n("Number one, what is PAM. Number two, what is IGA."), 2);
});
test("3 failsafe. a list inside one sentence and 'first' alone stay one card", () => {
  assert.equal(n("Two things: one, what is Okta, and two, what is SailPoint?"), 1);
  assert.equal(n("First, what is SAML?"), 1);
});

test("4. a tag question, then a real question, is two cards", () => {
  assert.equal(n("You've used CyberArk, right? What is Okta?"), 2);
  assert.equal(n("You managed SailPoint, right? Okay. Tell me about Saviynt."), 2);
});
test("4 failsafe. a tag alone, or two tags, stay one card", () => {
  assert.equal(n("You've used CyberArk, right?"), 1);
  assert.equal(n("SAML is XML based, right? And OIDC uses JSON, correct?"), 1);
  assert.equal(n("You know Kerberos, don't you?"), 1);
});

test("5. polite asks open and separate questions", () => {
  assert.equal(n("I'd love to hear about Venafi. Could you also tell me about Zscaler?"), 2);
  assert.equal(n("Could you walk me through your CyberArk deployment? I'd love to hear about your Okta work too."), 2);
  assert.equal(n("I'd be curious to hear how you handled Saviynt. Would you also mind explaining IGA?"), 2);
});
test("5 failsafe. one polite ask, or a polite press for more, stays one card", () => {
  assert.equal(n("I'd love to hear about your Okta work."), 1);
  assert.equal(n("If you don't mind, can you tell me about SailPoint?"), 1);
  assert.equal(n("Feel free to take your time. Could you explain OIDC?"), 1);
  assert.equal(n("Tell me about your Okta work. I'd love to hear more about that."), 1);
});

test("6. question, then answer text, then a new question: the new question is its own card", () => {
  assert.equal(n("What is Zscaler? I would say Zscaler is a cloud proxy. What would you do differently?"), 2);
  assert.equal(n("Tell me about Venafi. Venafi manages machine identities. How do you rotate certificates? We automated it with Venafi."), 2);
});
test("6 failsafe. a long set-up before one question, and answer text alone, stay one card", () => {
  assert.equal(n("Tell me about your current role. I see on your resume that you were at a bank. They used CyberArk and SailPoint. You led the migration. What was the hardest part of that migration for you personally?"), 1);
  assert.equal(n("What is CyberArk? CyberArk is a privileged access management platform."), 1);
});

test("7. 'Can you hear me?' never gets its own answer card, and the gate labels it 'no answer needed'", () => {
  assert.equal(n("Can you hear me? What is PAM? Let me repeat. What is PAM?"), 1);
  assert.equal(n("Am I audible? How does Kerberos work?"), 1);
  assert.equal(gate("Can you hear me?"), "skip");
  assert.equal(api.turnGate("Can you hear me?").reason, "audio-check");
  assert.equal(gate("Am I on mute?"), "skip");
});
test("7 failsafe. an audio check with a real question is answered; a gate fault answers", () => {
  assert.equal(gate("Can you hear me? What is PAM?"), "answer");
  assert.equal(gate("Can you hear me explain SAML?"), "answer");
  assert.equal(api.gateNoAnswerNeeded({ toString() { throw new Error("bad"); } }), null);
  assert.equal(api.turnGate({ toString() { throw new Error("bad"); } }).outcome, "answer");
});

test("8. statements built like questions are labelled, not answered", () => {
  assert.equal(gate("How we do it here is with CyberArk."), "skip");
  assert.equal(gate("What we use is Okta and Zscaler."), "skip");
  assert.equal(gate("Who we are looking for is someone with Venafi experience."), "skip");
  assert.equal(gate("Why we're hiring is because we're moving to SailPoint."), "skip");
  assert.equal(gate("So my next question is around identity governance."), "wait");
});
test("8 failsafe. when unsure the gate answers", () => {
  assert.equal(gate("What I want to understand is your PAM experience."), "answer");
  assert.equal(gate("What we use is Okta. How would you migrate it?"), "answer");
  assert.equal(gate("How do you do it here?"), "answer");
  assert.equal(gate("What is Okta?"), "answer");
});

test("design: 'What is PAM and what is IGA?' stays one card", () => {
  assert.equal(n("What is PAM and what is IGA?"), 1);
});

test("failsafe: a fault in the slice 3 rules returns the v2 cut, and no word is ever dropped", () => {
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
  const a = src.indexOf("const PHRASE_FIXES"), b = src.indexOf("function fixTerms", a);
  const c = src.indexOf("function shortFollowUp("), d = src.indexOf("const armsAuto", c);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + "\n" + src.slice(c, d) + "\nthis.v2 = (t) => { const before = splitDistinctAsksBy(t, false); const after = splitDistinctAsksBy(t, true); return splitSpokenWords(after.join(' ')) === splitSpokenWords(before.join(' ')) ? after : before; };\nsplitSeparateV3 = () => { throw new Error('boom'); };\nthis.f = splitDistinctAsks;", ctx);
  for (const t of ["First, what is SAML? Second, what is OIDC?", "You've used CyberArk, right? What is Okta?", "Tell me about your PAM rollout. What about Azure?"]) {
    assert.deepEqual(ctx.f(t), ctx.v2(t), t);
  }
  const server = readFileSync(new URL("../../src/lib/kompasAnswer.ts", import.meta.url), "utf8");
  assert.ok(server.includes("return spokenWords(v3.join(\" \")) === spokenWords(v2.join(\" \")) ? v3 : v2"));
  for (const odd of ["", "?", "First,", "right?", "Can you hear me", "  Sorry,  ", "What about?", null, undefined]) assert.doesNotThrow(() => both(odd));
});

test("stress: 50 then 200, by family, nothing merged, over-split, dropped, cut differently, gated wrong or repeat-missed", () => {
  for (const size of [50, 200]) {
    const r = runSlice3Stress(size);
    assert.deepEqual({ merged: r.merged, overSplit: r.overSplit, dropped: r.dropped, mismatch: r.mismatch, gateWrong: r.gateWrong, gateBlockedAsk: r.gateBlockedAsk, repeatWrong: r.repeatWrong },
      { merged: 0, overSplit: 0, dropped: 0, mismatch: 0, gateWrong: 0, gateBlockedAsk: 0, repeatWrong: 0 }, r.failures.slice(0, 5).join("\n"));
  }
});
