// Source-aware intake (29 Oct 2026). Computer audio is the interviewer, the mic is you, typed text is your own question.
// Speaker bleed within about 1.5 s never opens a question. A typed follow-up after an answer gets its own card about the
// open question. Short follow-ups attach to the open question. New mishearings are repaired. Runs code sliced from
// public/kompas/app.js, plus the server repair list, and the offline stress harness at 50 and 200 sequences.
import test from "node:test";
import assert from "node:assert/strict";
import { loadIntake } from "../kompas-intake-slice.mjs";
import { runStress } from "../kompas-intake-stress.mjs";

const { api, src } = loadIntake();
const D = await import("../../src/lib/kompasDictation.ts");

test("1. each source has one role: computer audio is Them, mic is You, typed is your question", () => {
  assert.equal(api.roleOfSource("system"), "Them");
  assert.equal(api.roleOfSource("loopback"), "Them");
  assert.equal(api.roleOfSource("mic"), "You");
  assert.equal(api.roleOfSource("typed"), "You (typed)");
  assert.equal(api.roleOfSource("something new"), "You");   // failsafe: an unknown source never opens a question as Them
});

test("2. a short line that bleeds into the mic within 1.5 s is dropped, which the 30 s echo rule missed", () => {
  const them = [{ text: "Can you do that?", at: 1000 }];
  assert.ok(api.echoShare("can you do that", "Can you do that?") < 0.5, "the old rule has no words to compare");
  assert.equal(api.micBleed("can you do that", 1800, them), true);
  assert.equal(api.micBleed("and why", 1800, [{ text: "And why?", at: 1000 }]), true);
  assert.equal(api.micBleed("What is Kubernetes and when", 2400, [{ text: "What is Kubernetes and when would you use it?", at: 1000 }]), true);
});

test("3. failsafe: your own answer is kept, later, in other words, or a single word", () => {
  const them = [{ text: "What is Kubernetes and when would you use it?", at: 1000 }];
  assert.equal(api.micBleed("I ran three clusters at Cigna", 1800, them), false);
  assert.equal(api.micBleed("what is kubernetes and when would you use it", 4000, them), false);   // outside 1.5 s
  assert.equal(api.micBleed("Yes", 1200, them), false);
  assert.equal(api.micBleed("anything", 1200, []), false);
});

test("4. the desktop checks bleed before the echo rule for mic lines", () => {
  const a = src.indexOf("function onTranscript(");
  const body = src.slice(a, src.indexOf("\n}", a));
  assert.ok(body.indexOf("micBleed(text, Date.now(), themLines, spokenAt)") > 0);
  assert.ok(body.indexOf("micBleed(") < body.indexOf("echoOfThem(text) >= 0.5"));
});

test("5. a typed follow-up after an answer gets its own card about the open question (#32)", () => {
  assert.equal(api.typedFollowUpQuestion("and why", "What is NLA?"), "What is NLA? And why?");
  assert.equal(api.typedFollowUpQuestion("Go deeper", "Tell me about the PKI rollout"), "Tell me about the PKI rollout. Go deeper.");   // slice 2: typed statements get no "?"
  assert.ok(src.includes('const followTyped = typedText && cur && hasAnswer(cur) ? typedFollowUpQuestion(typedText, cur.question) : "";'));
  assert.ok(src.includes("const said = followTyped || pressQuestion("));
});

test("6. failsafe: a typed question of its own is not attached, and nothing attaches to a placeholder", () => {
  assert.equal(api.typedFollowUpQuestion("What is PKI?", "What is NLA?"), "");
  assert.equal(api.typedFollowUpQuestion("Go deeper on that exception", "What is NLA?"), "");
  assert.equal(api.typedFollowUpQuestion("And why?", ""), "");
  assert.equal(api.typedFollowUpQuestion("And why?", "Deriving…"), "");
  assert.equal(api.typedStandsAlone("What is least privilege?"), true);
});

test("7. turn gating: and why, go deeper attach to the open question, a named subject does not", () => {
  for (const f of ["And why?", "Why?", "How come?", "go deeper", "Explain that"]) assert.equal(api.shortFollowUp(f), true, f);
  assert.equal(api.shortFollowUp("Go deeper on that exception"), false);
  assert.equal(api.shortFollowUp("What is least privilege?"), false);
});

const GARBLES = [
  ["Walk me through how you rolled out sail point.", "SailPoint"],
  ["How did beyond trust compare?", "BeyondTrust"],
  ["Did you use hashi corp vault?", "HashiCorp"],
  ["How did you onboard accounts into cyber arch?", "CyberArk"],
  ["How would you map detections to my tree attack?", "MITRE ATT&CK"],
  ["When is resid jewel risk acceptable?", "residual risk"],
  ["What changed with dev sec ops?", "DevSecOps"],
  ["Have you led a sock two audit?", "SOC 2"],
  ["How do you use nist eight hundred fifty three?", "NIST 800-53"],
  ["How did you set up intra id?", "Entra ID"],
  ["Have you tuned post gres q l?", "PostgreSQL"],
  ["How do you validate a jay son web token?", "JSON Web Token"],
  ["How does o i d c differ from SAML?", "OIDC"],
  ["What is in a sam el assertion?", "SAML assertion"],
  ["What did you automate with ans ible?", "Ansible"],
  ["Do you use git lab runners?", "GitLab"],
  ["How do you secure get hub actions?", "GitHub actions"],
  ["How many ec two instances?", "EC2 instances"],
  ["How do you lock down s three buckets?", "S3 buckets"],
  ["What goes in a docker file?", "Dockerfile"],
  ["Is z scaler your proxy?", "Zscaler"],
];

test("8. the bigger dictionary repairs each new mishearing on the server and on the desktop", () => {
  for (const [heard, term] of GARBLES) {
    assert.ok(D.repairDictation(heard).includes(term), "server: " + heard + " -> " + D.repairDictation(heard));
    assert.ok(api.fixPhrases(heard).includes(term), "desktop: " + heard + " -> " + api.fixPhrases(heard));
    assert.equal(D.repairDictation(D.repairDictation(heard)), D.repairDictation(heard));
  }
});

test("9. failsafe: ordinary sentences are not rewritten", () => {
  for (const s of ["I bought two socks yesterday.", "The post office was closed.", "My tree fell in the storm.", "Git is great and the lab was quiet.", "I get help from the hub team.", "Sam left early."]) {
    assert.equal(D.repairDictation(s), s);
    assert.equal(api.fixPhrases(s), s);
  }
});

test("10. stress: 50 then 200 offline sequences, nothing leaked, merged, orphaned, misheard or dropped", () => {
  for (const n of [50, 200]) {
    const m = runStress(n);
    assert.equal(m.sequences, n);
    assert.ok(m.bleedLines > 0 && m.typedFollow > 0 && m.garbled > 0);
    assert.deepEqual({ bleedLeaked: m.bleedLeaked, ownDropped: m.ownDropped, typedOrphan: m.typedOrphan, typedMerged: m.typedMerged, misheard: m.misheard },
      { bleedLeaked: 0, ownDropped: 0, typedOrphan: 0, typedMerged: 0, misheard: 0 }, JSON.stringify(m));
  }
});
