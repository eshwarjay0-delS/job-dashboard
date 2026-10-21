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
  assert.ok(src.includes("cap.speechMs >= 60"), "partial speech is rescued at the idle recycle");
  assert.ok(src.includes("fixTerms(fixPhrases(text))"), "phrase fixes run ahead of fixTerms on every final line");
});
