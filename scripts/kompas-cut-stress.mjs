// Offline stress for the question cut (29 Oct 2026, slice 2). No network, no model.
//   node --experimental-strip-types scripts/kompas-cut-stress.mjs 50 200
// Each sequence is one heard stretch from computer audio, built from a case bank and a variant (lower case, no
// punctuation, "um", lead-ins, one breath, a mic copy of the call audio). It is cut by the server
// (src/lib/kompasAnswer.ts) and by the desktop code sliced from public/kompas/app.js. Counts (lower is better):
//   merged    fewer cards than questions asked
//   overSplit more cards than questions asked
//   dropped   a heard word missing from the cards
//   mismatch  desktop and server cut differently
//   bleedKept a mic copy of the call audio was not dropped as bleed
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { loadIntake } from "./kompas-intake-slice.mjs";
const { splitDistinctAsks } = await import("../src/lib/kompasAnswer.ts");

export function loadDesktopCut() {
  const src = readFileSync(new URL("../public/kompas/app.js", import.meta.url), "utf8");
  const a = src.indexOf("const PHRASE_FIXES"), b = src.indexOf("function fixTerms", a);
  const c = src.indexOf("function shortFollowUp("), d = src.indexOf("const armsAuto", c);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + "\n" + src.slice(c, d) + "\nthis.splitDistinctAsks=splitDistinctAsks;", ctx);
  return ctx.splitDistinctAsks;
}

// [heard, cards]. The first three are the live failures found on 29 Oct 2026; the rest must stay one card.
export const CUT_CASES = [
  ["What is CyberArk? What is Okta?", 2],
  ["Tell me about your PKI work. Explain the Venafi part.", 2],
  ["Tell me about yourself. Why do you want this job? Where do you see yourself in five years?", 3],
  ["What is Kubernetes? What is Terraform?", 2],
  ["What is NLA and why do we disable it? Go deeper on that exception.", 2],
  ["Tell me about Zscaler and why did you choose it?", 1],
  ["Walk me through your IAM project. Go deeper on that.", 1],
  ["What is the difference between SSO and SAML?", 1],
  ["How do you handle what happens when a token expires?", 1],
  ["Tell me about a time when you failed.", 1],
  ["Explain how Okta works.", 1],
  ["How do you assess the business impact? How do you understand root cause?", 1],
  ["What is NLA and why do we disable it? Go deeper.", 1],
  ["Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation.", 1],
  ["Tell me about your PKI work. Explain that part.", 1],
  ["What is SAML? What is OIDC?", 2],
  ["Why did you leave your last job? What are you looking for next?", 2],
  ["Tell me about your CyberArk work. What is a PAM vault?", 2],
  ["Walk me through how you would migrate what is left of the AD forest.", 1],
  ["Describe a project where you led what was a failing rollout.", 1],
  ["What tools do you use for SIEM tuning?", 1],
];
const strip = (t) => t.replace(/[.?!,]/g, "");
// Ten variants of every case. "Two in one breath" is the stripped variants: the questions run together.
export const VARIANTS = [
  ["as heard", (t) => t],
  ["lower case", (t) => t.toLowerCase()],
  ["no punctuation", (t) => strip(t)],
  ["lower case, no punctuation", (t) => strip(t).toLowerCase()],
  ["um first", (t) => "Um, " + t.charAt(0).toLowerCase() + t.slice(1)],
  ["so first", (t) => "So " + t.charAt(0).toLowerCase() + t.slice(1)],
  ["um between", (t) => t.replace(/([.?!]) (?=\S)/g, "$1 Um, ")],
  ["okay so, no punctuation", (t) => "okay so " + strip(t).toLowerCase()],
  ["extra spaces", (t) => t.replace(/ /g, "  ")],
  ["no punctuation, um between", (t) => strip(t.replace(/([.?!]) (?=\S)/g, "$1 um ")).toLowerCase()],
];
// The stripped variants of the multi-card cases can be ambiguous to a person too. They are counted, not hidden.
const words = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9+#']+/g, " ").trim();

export function runCutStress(n, seed = 31) {
  const desktop = loadDesktopCut();
  const { api } = loadIntake();
  let x = seed >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const m = { sequences: n, merged: 0, overSplit: 0, dropped: 0, mismatch: 0, bleedKept: 0, failures: [] };
  for (let i = 0; i < n; i++) {
    // Every case and variant is covered once in the first 220 (all of them at 200 except the last few); the rest are drawn at random.
    const k = i < CUT_CASES.length * VARIANTS.length ? i : Math.floor(rnd() * CUT_CASES.length * VARIANTS.length);
    const [heard, cards] = CUT_CASES[k % CUT_CASES.length];
    const [vname, vary] = VARIANTS[Math.floor(k / CUT_CASES.length)];
    const text = vary(heard);
    const server = splitDistinctAsks(text);
    const desk = desktop(text);
    if (JSON.stringify(server) !== JSON.stringify(desk)) { m.mismatch++; m.failures.push("mismatch " + vname + ": " + text); }
    if (server.length < cards) { m.merged++; m.failures.push("merged " + vname + ": " + text + " -> " + JSON.stringify(server)); }
    if (server.length > cards) { m.overSplit++; m.failures.push("over-split " + vname + ": " + text + " -> " + JSON.stringify(server)); }
    const kept = words(server.join(" ")).split(" ");
    if (words(text).split(" ").some((w) => w && !kept.includes(w) && !/^(um|so|okay)$/.test(w))) { m.dropped++; m.failures.push("dropped " + text); }
    // A mic copy of the call audio 300 to 1400 ms later is bleed, and never reaches the cut.
    if (rnd() < 0.3) {
      const at = 1000 + 300 + Math.floor(rnd() * 1100);
      if (!api.micBleed(strip(text).toLowerCase(), at, [{ text, at: 1000 }])) { m.bleedKept++; m.failures.push("bleed kept " + text); }
    }
  }
  return m;
}

if (process.argv[1]?.endsWith("kompas-cut-stress.mjs")) {
  for (const n of process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [50, 200]) {
    const r = runCutStress(n);
    console.log(JSON.stringify({ ...r, failures: r.failures.length }));
    for (const f of r.failures) console.log("  " + f);
  }
}

// ── Slice 3 (29 Oct 2026): round-2 production failures, by family. Graded by fixed expectations written before the code.
// The cut bank runs with the variants that keep sentence punctuation (the slice 3 rules read "?", "," and "."); the
// stripped-punctuation variants are counted separately as "unpunctuated" and are a known gap, not a gate.
// [family, heard, cards]
export const SLICE3_CASES = [
  ["1-context-follow", "Tell me about your PAM rollout. What about Azure?", 1],
  ["1-context-follow", "How do you secure service accounts? What about Kerberos delegation?", 1],
  ["1-context-follow", "How do you integrate CyberArk with Okta? What about with SailPoint?", 1],
  ["1-context-follow", "Walk me through your Okta setup. How about Entra?", 1],
  ["1-context-follow", "Tell me about your Okta migration. Can you give an example?", 1],
  ["1-context-follow", "Describe your IGA project. Can you give me a specific example?", 1],
  ["1-context-follow", "How do you handle access reviews? Could you share an example?", 1],
  ["1-context-follow", "How does Okta use SAML? How does it use OIDC?", 1],
  ["1-context-follow", "What is Venafi used for? How does it talk to CyberArk?", 1],
  ["1-context-follow", "Tell me about a time you handled a security incident. What was the outcome?", 1],
  ["1-context-follow", "Tell me about the outage. So what happened next?", 1],
  ["1-named-keeps", "What is NLA and why do we disable it? Go deeper on that exception.", 2],
  ["1-named-keeps", "Tell me about your Okta migration. And what about SailPoint, have you used it?", 2],
  ["1-named-keeps", "What is Zscaler? What is Venafi?", 2],
  ["3-numbered", "First, what is SAML? Second, what is OIDC?", 2],
  ["3-numbered", "I have two questions. First, what is CyberArk? Second, how does it rotate passwords?", 2],
  ["3-numbered", "Firstly tell me about Venafi. Secondly tell me about Zscaler. Thirdly tell me about Saviynt.", 3],
  ["3-numbered", "Number one, what is PAM. Number two, what is IGA.", 2],
  ["3-numbered", "First, how do you vault service account keys? Second, how do you rotate them? Lastly, how do you audit access?", 3],
  ["3-numbered", "Two things: one, what is Okta, and two, what is SailPoint?", 1],
  ["4-tag", "You've used CyberArk, right? What is Okta?", 2],
  ["4-tag", "You managed SailPoint, right? Okay. Tell me about Saviynt.", 2],
  ["4-tag", "You worked with Zscaler, correct? How does ZPA work?", 2],
  ["4-tag", "You've used CyberArk, right?", 1],
  ["4-tag", "SAML is XML based, right? And OIDC uses JSON, correct?", 1],
  ["5-polite", "I'd love to hear about Venafi. Could you also tell me about Zscaler?", 2],
  ["5-polite", "Could you walk me through your CyberArk deployment? I'd love to hear about your Okta work too.", 2],
  ["5-polite", "I'd be curious to hear how you handled Saviynt. Would you also mind explaining IGA?", 2],
  ["5-polite", "I'd like to hear about your Kerberos work. Could you also explain SAML?", 2],
  ["5-polite", "I'd love to hear about your Okta work.", 1],
  ["5-polite", "If you don't mind, can you tell me about SailPoint?", 1],
  ["6-answer-between", "What is Zscaler? I would say Zscaler is a cloud proxy. What would you do differently?", 2],
  ["6-answer-between", "Tell me about Venafi. Venafi manages machine identities. How do you rotate certificates? We automated it with Venafi.", 2],
  ["6-answer-between", "What is a PAM vault? It stores privileged credentials securely. How would you size one?", 2],
  ["6-answer-between", "What is CyberArk? CyberArk is a privileged access management platform.", 1],
  ["6-answer-between", "Tell me about your current role. I see on your resume that you were at a bank. They used CyberArk and SailPoint. You led the migration. What was the hardest part of that migration for you personally?", 1],
  ["7-audio-check", "Can you hear me? What is PAM? Let me repeat. What is PAM?", 1],
  ["7-audio-check", "Hi, can you hear me okay? Tell me about your Okta work.", 1],
  ["7-audio-check", "Am I audible? How does Kerberos work?", 1],
  ["design-compound", "What is PAM and what is IGA?", 1],
  ["design-compound", "What is CyberArk and how does it work?", 1],
];
// [family, text, gate outcome wanted] (the gate only labels; "answer" means it must not be held back)
export const SLICE3_GATE = [
  ["7-audio-check", "Can you hear me?", "skip"],
  ["7-audio-check", "Hello, can you hear me okay?", "skip"],
  ["7-audio-check", "Am I on mute?", "skip"],
  ["7-audio-check", "Is my audio working?", "skip"],
  ["7-fail-open", "Can you hear me? What is PAM?", "answer"],
  ["8-statement", "How we do it here is with CyberArk.", "skip"],
  ["8-statement", "What we use is Okta and Zscaler.", "skip"],
  ["8-statement", "Who we are looking for is someone with Venafi experience.", "skip"],
  ["8-statement", "Why we're hiring is because we're moving to SailPoint.", "skip"],
  ["8-statement", "So my next question is around identity governance.", "wait"],
  ["8-statement", "Thank you. So my next question is around identity governance.", "wait"],
  ["8-fail-open", "What I want to understand is your PAM experience.", "answer"],
  ["8-fail-open", "What we use is Okta. How would you migrate it?", "answer"],
  ["8-fail-open", "How we do it here is with CyberArk, how would you improve it?", "answer"],
  ["8-fail-open", "What is Okta?", "answer"],
  ["8-fail-open", "How do you do it here?", "answer"],
];
// [text, previous, repeat?]
export const SLICE3_REPEATS = [
  ["Sorry, what is CyberArk?", "What is CyberArk?", true],
  ["How does Kerberos work, again?", "How does Kerberos work?", true],
  ["Tell me about your Okta migration please.", "Tell me about your Okta migration.", true],
  ["Can you tell me how Kerberos works?", "How does Kerberos work?", true],
  ["Sorry, let me repeat. What is SailPoint?", "What is SailPoint?", true],
  ["Could you tell me about Zscaler again?", "Tell me about Zscaler.", true],
  ["Sorry, what is Okta?", "What is CyberArk?", false],
  ["How does Kerberos delegation work?", "How does Kerberos work?", false],
  ["Tell me about your SailPoint migration please.", "Tell me about your Okta migration.", false],
  ["And why?", "Why did you pick CyberArk?", false],
  ["What about Saviynt?", "Have you used SailPoint?", false],
  ["What is SAML?", "What is OIDC?", false],
];
const KEEPS_PUNCT = new Set(["as heard", "lower case", "um first", "so first", "um between", "extra spaces"]);
export function runSlice3Stress(n, seed = 29) {
  const desktop = loadDesktopCut();
  const { api } = loadIntake();
  let x = seed >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const vs = VARIANTS.filter(([v]) => KEEPS_PUNCT.has(v));
  const m = { sequences: n, merged: 0, overSplit: 0, dropped: 0, mismatch: 0, gateWrong: 0, gateBlockedAsk: 0, repeatWrong: 0, unpunctuatedWrong: 0, byFamily: {}, failures: [] };
  const fam = (f, ok) => { m.byFamily[f] ??= [0, 0]; m.byFamily[f][1]++; if (ok) m.byFamily[f][0]++; };
  for (let i = 0; i < n; i++) {
    const k = i < SLICE3_CASES.length * vs.length ? i : Math.floor(rnd() * SLICE3_CASES.length * vs.length);
    const [family, heard, cards] = SLICE3_CASES[k % SLICE3_CASES.length];
    const [vname, vary] = vs[Math.floor(k / SLICE3_CASES.length)];
    const text = vary(heard);
    const server = splitDistinctAsks(text), desk = desktop(text);
    if (JSON.stringify(server) !== JSON.stringify(desk)) { m.mismatch++; m.failures.push("mismatch " + vname + ": " + text); }
    if (server.length < cards) { m.merged++; m.failures.push("merged " + family + " " + vname + ": " + text + " -> " + JSON.stringify(server)); }
    if (server.length > cards) { m.overSplit++; m.failures.push("over-split " + family + " " + vname + ": " + text + " -> " + JSON.stringify(server)); }
    const kept = words(server.join(" ")).split(" ");
    if (words(text).split(" ").some((w) => w && !kept.includes(w) && !/^(um|so|okay)$/.test(w))) { m.dropped++; m.failures.push("dropped " + text); }
    fam(family, server.length === cards);
    const bare = splitDistinctAsks(strip(heard).toLowerCase());
    if (bare.length !== cards) m.unpunctuatedWrong++;
  }
  for (let i = 0; i < n; i++) {
    const [family, text, want] = SLICE3_GATE[i % SLICE3_GATE.length];
    const got = api.turnGate(i < SLICE3_GATE.length ? text : (rnd() < 0.5 ? text.toLowerCase() : "  " + text)).outcome;
    if (got !== want) { m.gateWrong++; m.failures.push("gate " + family + ": " + text + " -> " + got); }
    if (want === "answer" && got === "skip") m.gateBlockedAsk++;
    fam("gate " + family, got === want);
  }
  for (let i = 0; i < n; i++) {
    const [t, p, want] = SLICE3_REPEATS[i % SLICE3_REPEATS.length];
    const s = splitDistinctAsks === null ? null : (await_free_repeat(t, p));
    const d = api.repeatsPriorQuestion(t, p);
    if (s !== want || d !== want) { m.repeatWrong++; m.failures.push("repeat " + t + " | " + p + " -> server " + s + " desktop " + d); }
    fam(want ? "2-repeat" : "2-new-not-hidden", s === want && d === want);
  }
  return m;
}
const { repeatsPriorQuestion: await_free_repeat } = await import("../src/lib/kompasAnswer.ts");

if (process.argv[1]?.endsWith("kompas-cut-stress.mjs")) {
  for (const n of process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [50, 200]) {
    const r = runSlice3Stress(n);
    console.log("slice3 " + JSON.stringify({ ...r, failures: r.failures.length }));
    for (const f of r.failures) console.log("  " + f);
  }
}
