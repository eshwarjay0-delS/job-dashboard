// Slice 2, v2 (29 Oct 2026): who opens a question, the bleed window by spoken time, the turn gate with "Answer anyway",
// a logged reason per decision, the Parakeet timeout, guarded word repairs and typed statements. Each item has a
// failing-first test and a failsafe. Runs the shipped desktop code sliced out of public/kompas/app.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadIntake } from "../kompas-intake-slice.mjs";
import { runGateStress } from "../kompas-gate-stress.mjs";
const { api, src } = loadIntake();
const D = await import("../../src/lib/kompasDictation.ts");
const STT = await import("../../src/lib/kompasSttProvider.ts");
const body = (name) => { const a = src.indexOf(name); return src.slice(a, src.indexOf("\n}", a)); };

test("1. computer audio is the interviewer in the live path: questionSource calls the mapping", () => {
  assert.ok(api.askSource, "askSource must exist");
  assert.equal(api.askSource(["You", "Them"]).source, "Them");
  assert.equal(api.askSource(["You", "Them"]).mode, "call");
  assert.ok(body("function questionSource()").includes("askSource(captures.map(c => c.who))"));
});
test("1 failsafe. mic-only keeps the mic as the voice that opens questions, labelled; a fault falls back to the old rule", () => {
  assert.deepEqual({ ...api.askSource(["You"]) }, { source: "You", mode: "mic-only", reason: "source-mic-only-fallback" });
  assert.equal(api.askSource([]).source, "You");
  assert.equal(api.askSource(null).source, "You");
  assert.ok(body("function questionSource()").includes('catch { return captures.some(c => c.who === "Them") ? "Them" : "You"; }'));
  assert.ok(src.includes("const armsAuto = () => pendingHeard().some(t => t.who === questionSource() &&"));   // typed text never goes through this
});

test("2. the 1.5 s bleed window is judged by when the words were said", () => {
  // Them said it at 1000 ms, its text came back at 1100. The mic copy was said at 1300 but its text came back at 4000.
  const them = [{ text: "Can you walk me through the vault design?", at: 1100, spokenAt: 1000 }];
  assert.equal(api.micBleed("can you walk me through the vault design", 4000, them, 1300), true);
  assert.equal(api.spokenWallTime(9000, 10000, 50000), 49000);
  assert.ok(src.includes("transcribe(blob, cap.who, { final: true, epoch, prompt, speechMs: speech, spokenAt })"));
  assert.ok(src.includes("onTranscript(who, clean, false, opt.spokenAt)"));
});
test("2 failsafe. no timing falls back to return time; your own words said later are kept", () => {
  const them = [{ text: "Can you walk me through the vault design?", at: 1100, spokenAt: 1000 }];
  assert.equal(api.micBleed("can you walk me through the vault design", 2000, them), true);            // return time, as before
  assert.equal(api.micBleed("can you walk me through the vault design", 4000, them), false);           // no timing, too late
  assert.equal(api.micBleed("can you walk me through the vault design", 4000, them, 5200), false);     // said 4 s later: yours
  assert.equal(api.micBleed("I designed the vault with three tiers", 1200, them, 1100), false);         // other words: yours
  for (const bad of [[-1, 10, 10], [20, 10, 10], [NaN, 1, 1], [1, 40000, 50000]]) assert.equal(api.spokenWallTime(...bad), null);
});

test("3. turn gate: answer now, wait, or no answer needed", () => {
  assert.ok(api.turnGate, "turnGate must exist");
  assert.equal(api.turnGate("How did you scale the vault?").outcome, "answer");
  assert.equal(api.turnGate("Tell me about a time when").outcome, "wait");
  assert.equal(api.turnGate("Okay, thanks.").outcome, "skip");
  assert.equal(api.turnGate("um yeah").outcome, "skip");
  assert.equal(api.turnGate("We moved everything to Azure last year").outcome, "wait");
});
test("3 failsafe. the gate fails open, only labels, and Answer anyway answers the turned-away lines", () => {
  assert.equal(api.turnGate({ toString() { throw new Error("bad"); } }).outcome, "answer");
  assert.ok(body("function noteTurnGate()").includes("catch"));
  assert.ok(!body("function noteTurnGate()").includes("return false"));
  assert.ok(src.includes("noteTurnGate();\n  if (!autoOn || !armsAuto()) return;"));
  const lines = [{ who: "Them", text: "Okay, thanks." }];
  assert.equal(api.answerAnywayLines({ lines, at: 1000 }, { fromAuto: false, pending: 0, typed: "", now: 9000 }), lines);
  assert.equal(api.answerAnywayLines({ lines, at: 1000 }, { fromAuto: true, pending: 0, typed: "", now: 9000 }), null);   // never automatic
  assert.equal(api.answerAnywayLines({ lines, at: 1000 }, { fromAuto: false, pending: 1, typed: "", now: 9000 }), null);  // new words win
  assert.equal(api.answerAnywayLines({ lines, at: 1000 }, { fromAuto: false, pending: 0, typed: "", now: 30000 }), null);
  assert.equal(api.answerAnywayLines(null, { fromAuto: false }), null);
  assert.ok(src.includes("if (intake.noiseOnly && !anyway) {"));
});

test("4. a structured reason is logged for each keep, drop, cut and gate", () => {
  assert.ok(api.decisionEvent, "decisionEvent must exist");
  assert.deepEqual({ ...api.decisionEvent("drop-mic-bleed", "You", "and why") }, { t: "decision", reason: "drop-mic-bleed", source: "You", len: 7 });
  const on = body("function onTranscript(");
  for (const r of ["drop-mic-bleed", "drop-mic-echo", "keep-can-open"]) assert.ok(on.includes(r), r);
  for (const r of ['"intake"', "skip-sign-off", "answer-anyway", '"gate-"']) assert.ok(src.includes(r), r);
});
test("4 failsafe. the reason log holds no words, and a logging fault is swallowed", () => {
  const ev = api.decisionEvent("x".repeat(200), "Them", "my secret answer about the PAM vault");
  assert.equal(JSON.stringify(ev).includes("secret"), false);
  assert.equal(ev.reason.length, 60);
  assert.ok(src.includes("function logDecision(reason, source, text) { try { logEvent(decisionEvent(reason, source, text)); } catch {} }"));
});

test("5. Parakeet gives up after 4 s, so Whisper takes over quickly", () => {
  assert.equal(STT.PARAKEET_TIMEOUT_MS, 4000);
  assert.ok(STT.PARAKEET_TIMEOUT_MS >= 3000 && STT.PARAKEET_TIMEOUT_MS <= 5000);
  assert.ok(readFileSync(new URL("../../src/lib/kompasSttProvider.ts", import.meta.url), "utf8").includes("AbortSignal.timeout(PARAKEET_TIMEOUT_MS)"));
});
test("5 failsafe. a slow Parakeet still falls back to Whisper", async () => {
  const env = { KOMPAS_STT_PROVIDER: "parakeet", KOMPAS_PARAKEET_URL: "http://127.0.0.1:8000/asr" };
  const slow = async () => { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; };
  const out = await STT.transcribeWithFallback({ audio: new Uint8Array(1), mime: "audio/webm", purpose: "flow" }, { whisper: async () => ({ text: "w" }), parakeet: slow }, env);
  assert.equal(out.text, "w");
});

const PLAIN = ["She went beyond trust and into loyalty.", "Go git lab results before noon.", "I lost a sock two days ago.", "Love that goes beyond trust.", "One sock two shoes."];
const TOOL = [["How did beyond trust compare?", "BeyondTrust"], ["We used beyond trust PAM for vendors.", "BeyondTrust"], ["Do you use git lab runners?", "GitLab"], ["Our git lab pipelines broke.", "GitLab"], ["Have you led a sock two audit?", "SOC 2"], ["We passed soc two last year.", "SOC 2"]];
test("6. beyond trust, git lab and sock two are left alone in normal English (server and desktop)", () => {
  for (const s of PLAIN) { assert.equal(D.repairDictation(s), s, "server: " + s); assert.equal(api.fixPhrases(s), s, "desktop: " + s); }
});
test("6 failsafe. the tool names are still repaired next to their tool words", () => {
  for (const [s, want] of TOOL) { assert.ok(api.fixPhrases(s).includes(want), "desktop: " + s); assert.ok(D.repairDictation(s).includes(want), "server: " + s); }
});

test("7. a typed statement is not turned into a question", () => {
  assert.equal(api.typedFollowUpQuestion("Go deeper", "Tell me about the PKI rollout"), "Tell me about the PKI rollout. Go deeper.");
  assert.equal(api.typedFollowUpQuestion("go deeper", "What is NLA?"), "What is NLA? Go deeper.");
});
test("7 failsafe. typed questions still get their question mark, and nothing typed is dropped", () => {
  assert.equal(api.typedFollowUpQuestion("and why", "What is NLA?"), "What is NLA? And why?");
  assert.equal(api.typedFollowUpQuestion("Go deeper", "How did you run the PKI rollout"), "How did you run the PKI rollout? Go deeper.");
  for (const t of ["go deeper", "and why", "more on that", "how so"]) { const q = api.typedFollowUpQuestion(t, "What is NLA?"); if (q) assert.ok(q.toLowerCase().includes(t)); }
});

for (const n of [50, 200]) test(`stress x${n}: gate, speaker, bleed by spoken time, repairs and typed statements`, () => {
  const m = runGateStress(n);
  assert.deepEqual(m.failures.slice(0, 5), []);
  for (const k of ["micOpened", "micOnlyMuted", "bleedKept", "ownDropped", "gateBlockedQuestion", "gateAnsweredFiller", "repairHitPlain", "repairMissedTool", "typedStatementAsked", "typedDropped"]) assert.equal(m[k], 0, k);
});
