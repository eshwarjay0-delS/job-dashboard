// Question framing from the latest heard chunks. No model call. The function is
// the one AI Answer and Auto use, sliced from public/kompas/app.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
function slice(start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert.ok(a > 0 && b > a, start);
  return src.slice(a, b);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("const PHRASE_FIXES"), src.indexOf("function fixTerms")) + "\nthis.fixPhrases = fixPhrases;", ctx);
vm.runInContext(slice("function cleanShownQuestion(", "function showPressed(") + "\nthis.cleanShownQuestion = cleanShownQuestion;", ctx);
vm.runInContext(slice("function frameHeardQuestion(", "async function aiAnswer(") + "\nthis.frameHeardQuestion = frameHeardQuestion;", ctx);
const frame = (chunks, opts) => ctx.frameHeardQuestion(chunks, opts || { source: "Them" });
const them = (text, extra) => ({ who: "Them", text, at: 0, ...(extra || {}) });
const you = (text) => ({ who: "You", text, at: 0 });

test("three caption chunks of one question join into one sentence", () => {
  const out = frame([
    them("can you walk me through how you"),
    them("configured the syslog relay"),
    them("to the SIEM"),
  ]);
  assert.equal(out.skip, "");
  assert.equal(out.question, "Can you walk me through how you configured the syslog relay to the SIEM?");
});

test("a dangling how-you chunk keeps the next verb", () => {
  const out = frame([them("how did you"), them("tune the noisy syslog rules")]);
  assert.match(out.question, /^How did you tune the noisy syslog rules\??$/);
});

test("and/or continuation stays on the same question", () => {
  const out = frame([them("What is a log aggregator"), them("or syslog relay and when would you use one?")]);
  assert.match(out.question, /log aggregator/);
  assert.match(out.question, /syslog relay/);
  assert.equal(out.parts.length, 2);
});

test("a finished question is not merged with the next different question", () => {
  const out = frame([them("What is Kerberos?"), them("What is Terraform?")]);
  assert.match(out.question, /Terraform/);
  assert.doesNotMatch(out.question, /Kerberos/);
});

test("an already-answered older question is left out", () => {
  const out = frame([
    them("What is Kerberos?", { answered: true }),
    them("can you walk me through how you"),
    them("configured the syslog relay"),
  ], { source: "Them", answered: "What is Kerberos?" });
  assert.match(out.question, /syslog relay/);
  assert.doesNotMatch(out.question, /Kerberos/);
});

test("a long pause after a finished question starts a new one", () => {
  const out = frame([
    them("What is Kerberos?", { at: 1000 }),
    them("How do you rotate signing keys?", { at: 20000 }),
  ]);
  assert.match(out.question, /signing keys/);
  assert.doesNotMatch(out.question, /Kerberos/);
});

test("chunks inside the pause window still join", () => {
  const out = frame([
    them("can you walk me through how you", { at: 1000 }),
    them("configured the syslog relay", { at: 2500 }),
    them("to the SIEM", { at: 4000 }),
  ]);
  assert.match(out.question, /walk me through how you configured the syslog relay to the SIEM/);
});

test("the candidate's mic is not part of the interviewer question", () => {
  const out = frame([
    them("can you walk me through how you"),
    you("and I'm going to take that one. I'm going to take that one. I I, S."),
    them("configured the syslog relay"),
  ]);
  assert.match(out.question, /configured the syslog relay/);
  assert.doesNotMatch(out.question, /take that one|I, S/i);
});

test("a repeated candidate phrase labeled as the call is stripped", () => {
  const out = frame([
    them("tell me about SAST and DAST practices?"),
    them("and I'm going to take that one."),
    them("I'm going to take that one."),
    them("I I, S."),
  ]);
  assert.match(out.question, /SAST and DAST/);
  assert.doesNotMatch(out.question, /take that one|I, S/i);
});

test("um and a stutter are not left in the question", () => {
  const out = frame([them("um uh can you explain"), them("the syslog syslog relay")]);
  assert.match(out.question, /explain the syslog relay/i);
  assert.doesNotMatch(out.question, /\bum\b|\buh\b/i);
});

test("intro becomes tell me about yourself", () => {
  assert.equal(frame([them("intro")]).question, "Tell me about yourself.");
  assert.equal(frame([them("introduce yourself")]).question, "Tell me about yourself.");
});

test("strengths, weakness, why leave, and why this role become questions", () => {
  assert.equal(frame([them("strengths")]).question, "What are your strengths?");
  assert.equal(frame([them("weakness")]).question, "What is a weakness you are working on?");
  assert.equal(frame([them("why leave")]).question, "Why are you leaving your current role?");
  assert.equal(frame([them("why this role")]).question, "Why do you want this role?");
});

test("salary, visa, and relocation are skipped as logistics", () => {
  assert.equal(frame([them("salary")]).skip, "logistics");
  assert.equal(frame([them("what is your visa status?")]).skip, "logistics");
  assert.equal(frame([them("are you willing to relocate?")]).skip, "logistics");
});

test("SAST DAST keywords become an experience question", () => {
  assert.equal(frame([them("SAST DAST")]).question, "Can you explain your experience with SAST and DAST?");
});

test("sas dast is repaired before it is framed", () => {
  assert.equal(frame([them("sas dast")]).question, "Can you explain your experience with SAST and DAST?");
});

test("sis log and see em are repaired into the question", () => {
  const log = frame([them("how do you ship a sis log relay")]);
  assert.match(log.question, /syslog relay/);
  const siem = frame([them("what does see em do for alerts")]);
  assert.match(siem.question, /SIEM/);
});

test("an imperative walk-through becomes a can-you question", () => {
  assert.equal(frame([them("walk me through your IAM work")]).question, "Can you walk me through your IAM work?");
});

test("a single keyword still becomes a question", () => {
  assert.equal(frame([them("syslog")]).question, "Can you explain your experience with syslog?");
});

test("four chunks of one unfinished ask stay one question", () => {
  const out = frame([
    them("can you"),
    them("walk me through"),
    them("how the syslog relay"),
    them("forwards events to the SIEM"),
  ]);
  assert.match(out.question, /walk me through how the syslog relay forwards events to the SIEM/);
  assert.equal(out.parts.length, 4);
});

test("a fifth older chunk beyond the window is not required to be the question", () => {
  const out = frame([
    them("What is Kerberos?"),
    them("can you"),
    them("walk me through"),
    them("how the syslog relay"),
    them("forwards events to the SIEM"),
  ]);
  assert.doesNotMatch(out.question, /Kerberos/);
  assert.match(out.question, /syslog relay/);
});

test("messy speech still yields a question and never an empty string", () => {
  const out = frame([them("uh so like"), them("sast"), them("and dast practices")]);
  assert.equal(out.skip, "");
  assert.ok(out.question.length > 8);
  assert.match(out.question, /SAST/);
  assert.match(out.question, /DAST/);
});

test("the press path calls the framer and still sends one pinned question", () => {
  assert.match(src, /const framed = frameHeardQuestion\(pending/);
  assert.match(src, /derived: card\.question, pinned: true/);
  assert.equal(src.split("async function aiAnswer(").length - 1, 1);
});
