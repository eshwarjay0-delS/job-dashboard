// Voice accuracy (21 Oct 2026): the prompt must spend its budget on the terms
// in the question, and the decode must repair the mishearings Whisper repeats.
// Each test is one improvement. Ordinary sentences are required to survive.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const D = await import("../../src/lib/kompasDictation.ts");
const seed = "Okay, so I was thinking about tomorrow. Let me know what you think.";
const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const a = src.indexOf("const PHRASE_FIXES");
const b = src.indexOf("function fixTerms", a);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + "\nthis.fixPhrases = fixPhrases;", ctx);

const longLine = "Can you explain how Kerberos authentication works in an enterprise network today";
const junk = Array.from({ length: 40 }, (_, i) => `padding term number ${i} about nothing important here`);

test("1. the Vocabulary label is not given to Whisper", () => {
  const ranked = D.rankHintTerms([`${longLine} Vocabulary: V-Cert`, "Vocabulary"]);
  assert.equal(ranked.some((term) => /vocabulary/i.test(term)), false);
  assert.ok(ranked.includes("V-Cert"));
});

test("2. interview terms are ordered before the previous sentence", () => {
  const ranked = D.rankHintTerms([longLine, "luna hsm", "pkcs#10"]);
  assert.ok(ranked.indexOf("Luna HSM") < ranked.indexOf(longLine));
  assert.ok(ranked.indexOf("PKCS#10") < ranked.indexOf(longLine));
});

test("3. a long hint cannot push V-Cert out of the token budget", () => {
  const prompt = D.accuracyPrompt([...junk, "V-Cert", "Venafi TPP", "PKCS#10"], seed);
  assert.ok(prompt.includes("V-Cert") && prompt.includes("Venafi TPP") && prompt.includes("PKCS#10"), prompt);
});

test("4. the lexicon spelling wins, and ranking twice is the same ranking", () => {
  const once = D.rankHintTerms(["venafi tpp", "VENAFI TPP", "gemalto"]);
  assert.deepEqual(once, ["Venafi TPP", "Gemalto"]);
  assert.deepEqual(D.rankHintTerms(once), once);
});

test("5. pkcs ten is PKCS#10", () => {
  assert.equal(D.repairDictation("submit the pkcs ten"), "submit the PKCS#10");
  assert.equal(D.repairDictation("submit the pkcs number 10"), "submit the PKCS#10");
});

test("6. vee cert and we cert are V-Cert, and we certify is left alone", () => {
  assert.equal(D.repairDictation("how does vee cert differ"), "how does V-Cert differ");
  assert.equal(D.repairDictation("how does we cert differ"), "how does V-Cert differ");
  assert.equal(D.repairDictation("we certify the build"), "we certify the build");
});

test("7. gemalto is Gemalto", () => {
  assert.equal(D.repairDictation("the gemalto luna"), "the Gemalto luna");
});

test("8. power shell is PowerShell", () => {
  assert.equal(D.repairDictation("a power shell script"), "a PowerShell script");
  assert.equal(D.repairDictation("a powershell script"), "a PowerShell script");
});

test("9. base 64 is Base64, and a 64-bit base is left alone", () => {
  assert.equal(D.repairDictation("encode it as base 64"), "encode it as Base64");
  assert.equal(D.repairDictation("a base 64-bit counter"), "a base 64-bit counter");
});

test("10. rest api is REST API", () => {
  assert.equal(D.repairDictation("call the rest api"), "call the REST API");
});

test("11. group policy is Group Policy", () => {
  assert.equal(D.repairDictation("push it by group policy"), "push it by Group Policy");
});

test("12. single sign on is single sign-on", () => {
  assert.equal(D.repairDictation("use single sign on"), "use single sign-on");
});

test("13. multi factor is multi-factor", () => {
  assert.equal(D.repairDictation("require multi factor"), "require multi-factor");
});

test("14. ticket granting is ticket-granting", () => {
  assert.equal(D.repairDictation("the ticket granting service"), "the ticket-granting service");
});

test("15. pass the hash is repaired, and pass the hash brown is left alone", () => {
  assert.equal(D.repairDictation("detect pass the hash"), "detect pass-the-hash");
  assert.equal(D.repairDictation("pass the hash brown"), "pass the hash brown");
});

test("16. pass the ticket is pass-the-ticket", () => {
  assert.equal(D.repairDictation("detect pass the ticket"), "detect pass-the-ticket");
});

test("17. cyber ark is CyberArk", () => {
  assert.equal(D.repairDictation("store it in cyber ark"), "store it in CyberArk");
  assert.equal(D.repairDictation("the cyber archive"), "the cyber archive");
});

test("18. micro soft sentinel is Microsoft Sentinel", () => {
  assert.equal(D.repairDictation("alerts in micro soft sentinel"), "alerts in Microsoft Sentinel");
});

test("19. qualys, nessus, splunk and fifth third keep their names", () => {
  assert.equal(D.repairDictation("qualys and nessus and splunk at fifth third"), "Qualys and Nessus and Splunk at Fifth Third");
});

test("21. kubernetes, pki, terraform and STAR survive the usual mishearings", () => {
  assert.equal(D.repairDictation("What is cooper netties?"), "What is Kubernetes?");
  assert.equal(D.repairDictation("How does kuber netes schedule a pod?"), "How does Kubernetes schedule a pod?");
  assert.equal(D.repairDictation("Have you run kube netes in production?"), "Have you run Kubernetes in production?");
  assert.equal(D.repairDictation("What is pee kay eye?"), "What is PKI?");
  assert.equal(D.repairDictation("How do you protect P K I keys?"), "How do you protect PKI keys?");
  assert.equal(D.repairDictation("What is terra form?"), "What is Terraform?");
  assert.equal(D.repairDictation("Have you used terror form for infrastructure?"), "Have you used Terraform for infrastructure?");
  assert.equal(D.repairDictation("Tell me about a time you used the start method."), "Tell me about a time you used the STAR method.");
  assert.equal(D.repairDictation("How do you structure an answer with the S T A R method?"), "How do you structure an answer with the STAR method?");
  assert.equal(D.repairDictation(D.repairDictation("What is cooper netties?")), "What is Kubernetes?");
  for (const same of [
    "the cooper union is in the city",
    "terraforming a barren cluster is not the task",
    "a terror alert is not a tool",
    "the start of the method is slow",
    "pick the key that fits",
  ]) assert.equal(D.repairDictation(same), same, same);
  for (const sample of ["What is cooper netties?", "What is terra form?", "the start of the method is slow"]) {
    assert.equal(ctx.fixPhrases(sample), D.repairDictation(sample), sample);
  }
});

test("20. a repaired line is stable, ordinary sentences stay put, and the page repairs the same way", () => {
  const line = "how does vee cert submit a pkcs ten to gemalto";
  const once = D.repairDictation(line);
  assert.equal(D.repairDictation(once), once);
  for (const same of [
    "her control panel domain is her own project",
    "i wore a sock to the analyst briefing",
    "the team ran a sim exercise yesterday",
    "please control her access to the staging domain",
    "we certify the build before the base 64-bit counter",
  ]) assert.equal(D.repairDictation(same), same, same);
  for (const sample of [line, "detect pass the hash", "a base 64-bit counter", "call the rest api", sameLine()]) {
    assert.equal(ctx.fixPhrases(sample), D.repairDictation(sample), sample);
  }
  function sameLine() { return "the cyber archive uses group policy"; }
});
