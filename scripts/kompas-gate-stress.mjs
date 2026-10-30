// Slice 2 v2 stress (29 Oct 2026): random calls built from fresh sentences, graded by fixed rules, not by the code under
// test. Checks who opens a question, bleed by spoken time, the turn gate, the guarded repairs and typed statements.
// Run: node --experimental-strip-types scripts/kompas-gate-stress.mjs 200
import { loadIntake } from "./kompas-intake-slice.mjs";
const D = await import("../src/lib/kompasDictation.ts");
const { api } = loadIntake();

const QUESTIONS = ["How did you scale the vault cluster?", "What was the hardest part of the Okta move", "Why did you pick Terraform over Pulumi?", "Can you walk me through the incident review", "Where did the SIEM rollout stall?", "Tell me about your last migration.", "Could you explain the PKI part?", "Which controls did you automate first"];
const FILLER = ["um yeah", "okay", "Okay, thanks.", "great", "right", "Thanks.", "mm hmm", "Got it, thanks!"];
const OPEN = ["Tell me about a time when", "How would you handle it if", "What would you do because"];
const ANSWERS = ["I ran three clusters at Cigna with a shared vault.", "We cut onboarding from five days to one.", "I led the rollout with two engineers."];
const PLAIN = ["She went beyond trust and into loyalty.", "Go git lab results before noon.", "I lost a sock two days ago.", "It goes beyond trust for me.", "One sock two shoes and a hat.", "Let me git lab coats for the class."];
const TOOL = [["How did beyond trust compare with CyberArk?", "BeyondTrust"], ["We picked beyond trust for vendor access.", "BeyondTrust"], ["Do you use git lab runners?", "GitLab"], ["We moved off git lab ci last year.", "GitLab"], ["Have you led a sock two audit?", "SOC 2"], ["Is the soc 2 report done?", "SOC 2"]];
const TYPED_STATEMENTS = ["go deeper", "dig deeper", "explain that", "Go deeper"];
const TYPED_ASKS = ["and why", "how so", "why"];

export function runGateStress(n = 200, seed = 47) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const m = { runs: n, micOpened: 0, micOnlyMuted: 0, bleedKept: 0, ownDropped: 0, gateBlockedQuestion: 0, gateAnsweredFiller: 0, repairHitPlain: 0, repairMissedTool: 0, typedStatementAsked: 0, typedDropped: 0, failures: [] };
  const fail = (k, why) => { m[k]++; if (m.failures.length < 20) m.failures.push(k + ": " + why); };
  for (let i = 0; i < n; i++) {
    // Speaker: in a call only computer audio opens; mic-only, the mic does.
    const call = rnd() < 0.7, whos = call ? (rnd() < 0.5 ? ["Them", "You"] : ["You", "Them"]) : ["You"];
    const src = api.askSource(whos).source;
    if (call && src === "You") fail("micOpened", whos.join("+"));
    if (!call && src !== "You") fail("micOnlyMuted", whos.join("+"));
    // Bleed: Them said q at t; the mic copy was said 20-400 ms later but its text came back 1.6-6 s after.
    const q = pick(QUESTIONS), t = 10000 + Math.floor(rnd() * 5000);
    const lines = [{ text: q, at: t + Math.floor(rnd() * 900), spokenAt: t }];
    const said = t + 20 + Math.floor(rnd() * 380), back = said + 1600 + Math.floor(rnd() * 4400);
    if (!api.micBleed(q.toLowerCase().replace(/[?.]/g, ""), back, lines, said)) fail("bleedKept", q);
    const own = pick(ANSWERS), ownSaid = t + 3000 + Math.floor(rnd() * 6000);
    if (api.micBleed(own, ownSaid + 800, lines, ownSaid)) fail("ownDropped", own);
    // Gate: a question never gets "no answer needed"; filler never gets "answer now".
    if (api.turnGate(q).outcome === "skip") fail("gateBlockedQuestion", q);
    const o = pick(OPEN); if (api.turnGate(o).outcome === "skip") fail("gateBlockedQuestion", o);
    const f = pick(FILLER); if (api.turnGate(f).outcome === "answer") fail("gateAnsweredFiller", f);
    // Repairs.
    const p = pick(PLAIN); if (api.fixPhrases(p) !== p || D.repairDictation(p) !== p) fail("repairHitPlain", p);
    const [tool, want] = pick(TOOL); if (!api.fixPhrases(tool).includes(want) || !D.repairDictation(tool).includes(want)) fail("repairMissedTool", tool);
    // Typed: statements end with ".", asks with "?", and the typed words are all there.
    const st = pick(TYPED_STATEMENTS), out = api.typedFollowUpQuestion(st, q);
    if (out && out.endsWith("?")) fail("typedStatementAsked", out);
    const ask = pick(TYPED_ASKS), out2 = api.typedFollowUpQuestion(ask, q);
    if (!out2.endsWith("?")) fail("typedDropped", "ask lost its ? " + out2);
    for (const [typed, got] of [[st, out], [ask, out2]]) if (!got || !got.toLowerCase().includes(typed.toLowerCase())) fail("typedDropped", typed);
  }
  return m;
}
if (process.argv[1]?.endsWith("kompas-gate-stress.mjs")) { const r = runGateStress(Number(process.argv[2]) || 200); console.log(JSON.stringify({ ...r, failures: r.failures.slice(0, 10) }, null, 1)); }
