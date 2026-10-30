// Slice 12 (30 Oct 2026, owner live use 8:50 AM CT: "missing some questions, passing them fully as if it never heard it").
// An interviewer ask that does not open with a question word ("I'd love to hear about...", "Okay so what...", "Kerberos
// versus NTLM") never armed Auto and, on a press after an answer, counted as a re-press of the page on screen.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const qcue = src.slice(src.indexOf("const Q_CUE ="), src.indexOf(";", src.indexOf("const Q_CUE =")) + 1);
const region = src.slice(src.indexOf("function shortFollowUp("), src.indexOf("const armsAuto"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(qcue + "\n" + region + "\nthis.opensNewAsk = opensNewAsk; this.Q_CUE = Q_CUE; this.formationWindow = typeof formationWindow === 'function' ? formationWindow : null;", ctx);
const arms = (t) => ctx.Q_CUE.test(t) || ctx.opensNewAsk(t);

const ASKS = [
  "I'd love to hear about your Okta migration.",
  "I'm curious about how you handled the CyberArk upgrade.",
  "I want to hear how you designed the vault replication.",
  "Help me understand how you scoped the SOX audit.",
  "Run me through the onboarding process you built.",
  "Kerberos versus NTLM.",
  "So the difference between SAML and OIDC.",
  "Curious what your approach to secrets rotation is.",
  "I was wondering how you handle break-glass accounts.",
  "Thoughts on just-in-time access.",
  "Your take on passwordless authentication.",
  "Please explain the difference between RBAC and ABAC.",
  "Let me hear about a time you pushed back on a stakeholder.",
  "Remind me what Conjur does differently from Vault.",
  "Any experience with Saviynt.",
  "So weekend changes, how did you manage those",
  "Go through how you'd lock down a jump host.",
  "okay so what happens when the model provider has an outage",
  "uh who is the end client",
  "alright so how many psm connection components did you build",
  "so um what corrective action prevents recurrence",
  "and um where do handoffs between the soc and app owners become difficult",
];
const NOT_ASKS = ["Okay.", "Thank you so much.", "Great, that makes sense.", "Yeah, we use Okta here.", "So we are a CyberArk shop.", "Alright.", "Sounds good, thanks.", "Okay so that covers it."];

test("an ask that does not open with a question word arms Auto and counts as a new ask", () => {
  const missed = ASKS.filter((q) => !arms(q));
  assert.deepEqual(missed, []);
});
test("fillers, thanks and statements still do not arm", () => {
  assert.deepEqual(NOT_ASKS.filter(arms), []);
});
test("the formation window keeps the latest unanswered ask when more than 8 lines followed it", () => {
  assert.equal(typeof ctx.formationWindow, "function");
  const isAsk = (t) => t.who === "Them" && arms(t.text);
  const lines = [{ who: "Them", text: "How would you roll out just-in-time access for domain admins?", seq: 1 }];
  for (let i = 0; i < 9; i++) lines.push({ who: "You", text: "so I think we would start with step " + i, seq: 2 + i });
  const w = ctx.formationWindow(lines, isAsk);
  assert.equal(w[0].seq, 1);
  assert.equal(w.length, 10);
  // the 8-line window is unchanged when it already holds an ask, and never grows past 16 lines
  const recent = [...lines, { who: "Them", text: "What is PAM?", seq: 20 }];
  assert.equal(ctx.formationWindow(recent, isAsk).length, 8);
  const long = [{ who: "Them", text: "What is PAM?", seq: 0 }, ...Array.from({ length: 20 }, (_, i) => ({ who: "You", text: "filler " + i, seq: i + 1 }))];
  assert.equal(ctx.formationWindow(long, isAsk).length, 8);
  assert.equal(ctx.formationWindow([], isAsk).length, 0);
});
test("aiAnswer forms the question from the formation window, not a bare last-8 slice", () => {
  assert.match(src, /let pending = formationWindow\(pendingHeard\(\),/);
  assert.doesNotMatch(src, /let pending = pendingHeard\(\)\.slice\(-8\);/);
});
