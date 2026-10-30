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
