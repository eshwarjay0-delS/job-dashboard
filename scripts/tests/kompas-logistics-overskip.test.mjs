// Slice 12: technical questions that share a word with personal logistics were silenced (owner 8:50 AM CT, 30 Oct).
// Pure logistics stays skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { withoutLogistics } from "../../src/lib/kompasRelevance.ts";
import { logisticsBackstop } from "../../src/lib/kompasLogistics.ts";
const server = (q) => logisticsBackstop(withoutLogistics(q));
const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const a = src.indexOf("// personal-logistics parity: start"), b = src.indexOf("// personal-logistics parity: end");
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + "\nthis.w = withoutLogistics;", ctx);

const TECHNICAL = [
  "What is your availability target for the PAM platform?",
  "How do you relocate secrets when moving to Conjur?",
  "Do you have experience working night shifts in a SOC?",
  "What is your shift-left approach for security testing?",
  "Explain compensation controls in SOX ITGC testing.",
  "What is the start date field mapping in SailPoint?",
  "How would you be on call for a CyberArk upgrade?",
  "How much notice do you need to give users before a password policy change?",
  "What is your earliest start point for a PAM maturity assessment?",
];
const LOGISTICS = [
  "What is your notice period?", "Are you authorised to work in the US?", "What compensation do you want?",
  "Are you local to Philadelphia, or would you relocate?", "What is your availability?", "When can you start?",
  "Are you available to start in two weeks?", "Are you open to working weekends?", "Are you okay with on-call?",
  "What salary are you asking for?", "Do you need visa sponsorship?", "Where are you currently located?",
  "What is your expected start date?", "How much notice do you need to give your current employer?",
  "Are you available for on-call?", "What is your hourly rate?", "What is the W2/C2C/contract arrangement?", "Are you local?",
];
test("technical questions that share a logistics word are answered (server and page)", () => {
  assert.deepEqual(TECHNICAL.filter((q) => server(q) !== q), []);
  assert.deepEqual(TECHNICAL.filter((q) => ctx.w(q) !== q), []);
});
test("pure personal logistics is still skipped by the server", () => {
  assert.deepEqual(LOGISTICS.filter((q) => server(q) !== ""), []);
});
