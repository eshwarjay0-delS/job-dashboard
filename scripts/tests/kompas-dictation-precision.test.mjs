// Dictation precision (21 Oct 2026): the VAD must never learn a soft-spoken
// question as background noise or drop its partial start at the idle recycle;
// the Whisper prompt carries the previous heard line plus a security lexicon;
// and the multi-word garbles Whisper repeats get a narrow phrase-level rescue
// before token-level fixTerms runs. The shipped functions are vm-run from
// public/kompas/app.js itself, so the tests exercise the production code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");

function extract(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `extract ${from} … ${to}`);
  return src.slice(a, b);
}

const ctx = {
  current: { role: "Senior SOC Analyst", jd: "Splunk CrowdStrike", resume: "", voiceVocabulary: [] },
  transcript: [{ who: "Them", text: "Can you explain how Kerberos authentication works in an enterprise network?", at: 0, seq: 1 }],
};
vm.createContext(ctx);
vm.runInContext(
  extract("const PHRASE_FIXES", "function fixTerms") +
  extract("function whisperPrompt", "// Speech activity gates") +
  "\nthis.fixPhrases = fixPhrases; this.whisperPrompt = whisperPrompt;",
  ctx
);

test("phrase fixes repair the recurring multi-word garbles", () => {
  const cases = [
    ["how would you investigate dns hijacking on a domain control her?", "domain controller"],
    ["explain the mitre attack framework you use", "MITRE ATT&CK"],
    ["what does the sock analyst watch in the seam tool?", "SOC analyst"],
    ["what does the sock analyst watch in the seam tool?", "SIEM tool"],
    ["how does oh auth differ from saml in your setup?", "OAuth"],
    ["tell me about crowd strike and active directory", "CrowdStrike"],
    ["tell me about crowd strike and active directory", "Active Directory"],
    ["walk me through kerberose ticket handling", "Kerberos"],
    ["are you a u s citizen", "U.S. citizen"],
    ["how do you use nist csf here", "NIST CSF"],
    ["track it in service now", "ServiceNow"],
    ["what is google sec ops", "Google SecOps"],
    ["give me a big intro", "Big Intro"],
    ["how do you administer saviant", "Saviynt"],
    ["how do you administer savvy ent", "Saviynt"],
  ];
  for (const [input, want] of cases) assert.ok(ctx.fixPhrases(input).includes(want), `${input} -> ${ctx.fixPhrases(input)}`);
});

test("phrase fixes leave ordinary sentences untouched", () => {
  const untouched = [
    "her control panel domain is her own project",
    "i wore a sock to the analyst briefing",
    "the team ran a sim exercise yesterday",
    "please control her access to the staging domain",
  ];
  for (const input of untouched) assert.equal(ctx.fixPhrases(input), input);
});

test("whisper prompt carries the previous line and the security lexicon, within the hint cap", () => {
  const p = ctx.whisperPrompt();
  assert.ok(p.includes("Kerberos authentication works"), p);
  assert.ok(p.includes("SIEM") && p.includes("domain controller") && p.includes("MITRE ATT&CK"), p);
  assert.ok(p.length <= 550, `prompt length ${p.length}`);
});

test("VAD guards are in the shipped source", () => {
  assert.ok(src.includes("rms < threshold * 0.7"), "noise floor adapts only to clear background");
  assert.ok(src.includes("speechMs >= 60"), "partial speech is rescued at the idle recycle");
  assert.ok(src.includes("fixTerms(fixPhrases(text))"), "phrase fixes run ahead of fixTerms on every final line");
});

vm.runInContext(
  extract("function dictateStep", "function vadStep") +
  extract("function dictationRetry", "// Speech activity gates") +
  extract("function heardDraft", "function onTranscript") +
  "\nthis.dictateStep = dictateStep; this.dictationRetry = dictationRetry; this.heardDraft = heardDraft;",
  ctx
);

test("level 1: a scream is speech immediately and pulls a climbed noise floor down", () => {
  const climbed = { noise: 0.05, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: 1000 };
  const step = ctx.dictateStep(climbed, 0.2, 1020, { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 });
  assert.equal(step.scream, true);
  assert.equal(step.voiced, true);
  assert.ok(step.noise < 0.05, `floor stayed high: ${step.noise}`);
});

test("level 2: a short start is kept at the idle recycle", () => {
  const soft = { noise: 0.001, speechMs: 70, voiced: false, lastVoice: 1000, lastTick: 7000, segStart: 0 };
  const step = ctx.dictateStep(soft, 0.001, 7000, { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 });
  assert.equal(step.action, "rescue");
  const quiet = ctx.dictateStep({ noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 7000, segStart: 0 }, 0.0004, 7000, { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 });
  assert.equal(quiet.action, "drop");
});

test("level 3: PKI phrases are repaired and the lexicon names them", () => {
  assert.ok(ctx.fixPhrases("how does v cert differ from calling venafi tpp").includes("V-Cert"));
  assert.ok(ctx.fixPhrases("how does v cert differ from calling venafi tpp").includes("Venafi TPP"));
  assert.ok(ctx.fixPhrases("the luna hsm partition rejected the pkcs 10").includes("Luna HSM"));
  assert.ok(ctx.fixPhrases("the luna hsm partition rejected the pkcs 10").includes("PKCS#10"));
  assert.equal(ctx.fixPhrases("please control her access to the staging domain"), "please control her access to the staging domain");
  const p = ctx.whisperPrompt();
  assert.ok(p.includes("V-Cert") && p.includes("Venafi TPP") && p.includes("Luna HSM"), p);
});

test("level 4: real speech with no words is decoded once more, and a bare prompt drops the previous line", () => {
  assert.equal(ctx.dictationRetry("", 400, 0), true);
  assert.equal(ctx.dictationRetry("how does V-Cert work", 400, 0), false);
  assert.equal(ctx.dictationRetry("", 400, 1), false);
  assert.equal(ctx.dictationRetry("", 40, 0), false);
  const bare = ctx.whisperPrompt({ bare: true });
  assert.equal(bare.includes("Kerberos authentication works"), false);
  assert.ok(bare.includes("V-Cert"));
});

test("level 5: a greeting is not the question, and a fragment stays on the question already showing", () => {
  assert.equal(ctx.heardDraft([{ who: "Them", text: "Hello." }], "How do you discover certificates?"), "");
  assert.equal(ctx.heardDraft([{ who: "You", text: "I would start by checking the chain" }], "How do you discover certificates?", "I would start by checking the chain and the host"), "");
  assert.equal(ctx.heardDraft([{ who: "You", text: "How does V-Cert differ from the direct API?" }], ""), "How does V-Cert differ from the direct API?");
  assert.equal(
    ctx.heardDraft([{ who: "Them", text: "Venafi" }], "How do you discover certificates?"),
    "Venafi",
  );
  assert.equal(
    ctx.heardDraft([{ who: "Them", text: "How does V-Cert differ from the direct API?" }], "How do you discover certificates?"),
    "How does V-Cert differ from the direct API?",
  );
});

function extractLine(from, end) {
  const a = src.indexOf(from);
  const b = src.indexOf(end, a + from.length);
  assert.ok(a >= 0 && b > a, `extractLine ${from}`);
  return src.slice(a, b);
}
let roundLoad = "";
try {
  vm.runInContext(
    extract("function segmentKept", "function flushAction") +
    extract("function flushAction", "function endSegment") +
    extract("function audioNeedsResume", "function primeAudio") +
    extract("const NOISE_WORDS", "function isNoiseLine") +
    extract("function isNoiseLine", "function composeIntake") +
    extractLine("const Q_CUE =", "/i;") + "/i;\n" +
    extract("function pressQuestion", "function showPressed") +
    "\nthis.segmentKept = segmentKept; this.flushAction = flushAction; this.audioNeedsResume = audioNeedsResume; this.pressQuestion = pressQuestion;",
    ctx
  );
} catch (error) {
  roundLoad = String(error && error.message || error);
}
test("the ten rounds load the shipped functions", () => {
  assert.equal(roundLoad, "");
});

const VAD = { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 };
function step(cap, rms, now) {
  const next = ctx.dictateStep(cap, rms, now, VAD);
  return Object.assign(cap, next, { segStart: cap.segStart });
}

test("round 1: a shout shorter than 160 ms is still sent to be transcribed", () => {
  assert.equal(ctx.segmentKept(80, true, true), true);
  assert.equal(ctx.segmentKept(80, true, false), false);
  assert.equal(ctx.segmentKept(200, true, false), true);
  assert.ok(src.includes("step.scream || step.speechMs >= 60"), "the end path forces a short shout through");
});

test("round 2: a stalled meter still counts the shout", () => {
  const cap = { noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 1000, segStart: 1000 };
  const next = ctx.dictateStep(cap, 0.2, 1500, VAD);
  assert.ok(next.speechMs >= 400, `speech counted ${next.speechMs}`);
  assert.equal(next.voiced, true);
});

test("round 3: AI Answer keeps a short start and still rescues a stalled recorder", () => {
  assert.equal(ctx.flushAction({ speechMs: 80, rec: {} }, 5000), "keep");
  assert.equal(ctx.flushAction({ speechMs: 0, rec: {}, segStart: 0, lastVadAt: 0 }, 5000), "rescue");
  assert.equal(ctx.flushAction({ speechMs: 0, rec: {}, segStart: 4000, lastVadAt: 4000 }, 5000), "wait");
});

test("round 4: an empty decode of a short start is tried once more", () => {
  assert.equal(ctx.dictationRetry("", 80, 0), true);
  assert.equal(ctx.dictationRetry("", 40, 0), false);
});

test("round 5: a long resume cannot push V-Cert out of the hint", () => {
  const saved = ctx.current;
  ctx.current = { role: "Senior SOC Analyst", jd: "Splunk CrowdStrike", resume: Array.from({ length: 40 }, (_, i) => "Term" + i).join(" "), voiceVocabulary: [] };
  const p = ctx.whisperPrompt();
  ctx.current = saved;
  assert.ok(p.includes("V-Cert") && p.includes("Venafi TPP") && p.includes("PKCS#10"), p);
  assert.ok(p.length <= 550, `prompt length ${p.length}`);
});

test("round 6: the microphone question is shown, and reading the answer aloud is not", () => {
  assert.equal(ctx.heardDraft([{ who: "You", text: "How do you discover certificates in Venafi?" }], "Ready"), "How do you discover certificates in Venafi?");
  assert.equal(ctx.heardDraft([{ who: "You", text: "the partition mismatch on the Luna HSM" }], "How do you discover certificates?", "the partition mismatch on the Luna HSM was the incident"), "");
});

test("round 7: the typed line is not pasted twice onto itself", () => {
  const same = "How does V-Cert differ from the direct API?";
  assert.equal(ctx.pressQuestion(same, { derived: same }, ""), same);
  assert.equal(ctx.pressQuestion("PKCS#10", { derived: "How do you submit a request?" }, ""), "PKCS#10 How do you submit a request?");
});

test("round 8: a short answer still counts as a miss, and a pinned press skips the stored book", () => {
  assert.ok(src.includes("answeredText.trim().length > 8"));
  assert.ok(src.includes("!opts.pinned"));
});

test("round 9: an interrupted audio context is resumed, in the page and in the shell", () => {
  assert.equal(ctx.audioNeedsResume("interrupted"), true);
  assert.equal(ctx.audioNeedsResume("suspended"), true);
  assert.equal(ctx.audioNeedsResume("running"), false);
  assert.ok(src.includes("state === \"interrupted\""));
});

test("round 10: ten quiet samples never become speech, and the eleventh shout does", () => {
  let cap = { noise: 0.02, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: 0 };
  for (let i = 1; i <= 10; i++) cap = Object.assign(cap, ctx.dictateStep(cap, 0.001, i * 20, VAD));
  assert.equal(cap.voiced, false);
  assert.equal(cap.action, "listen");
  cap = Object.assign(cap, ctx.dictateStep(cap, 0.2, 1000, VAD));
  assert.equal(cap.scream, true);
  assert.equal(cap.voiced, true);
  assert.ok(cap.noise < 0.02, `floor stayed high: ${cap.noise}`);
});
