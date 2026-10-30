// Slice 12: a steady background level just above the 0.003 start threshold (fan, line hiss, call comfort noise) kept a
// capture "voiced" for good: the floor only learned while NOT speaking, so it never learned. A segment then ended only at
// the 28 s cap (late, mid-sentence) and Auto, waiting for every capture to go quiet, did not fire.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const fn = (name) => { const i = src.indexOf("function " + name + "("); let d = 0, k = src.indexOf("{", i); for (; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) break; } return src.slice(i, k + 1); };
const ctx = {}; vm.createContext(ctx); vm.runInContext(fn("dictateStep") + "; this.step = dictateStep;", ctx);
const VAD = { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 };
function run(levelAt, ms) {
  const cap = { noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: 0 };
  const ends = []; let voiced = 0;
  for (let t = 0; t <= ms; t += 21) {
    const s = ctx.step(cap, levelAt(t), t, VAD); Object.assign(cap, s);
    if (s.voiced) voiced += 21;
    if (s.action !== "listen") { ends.push({ t, action: s.action }); Object.assign(cap, { speechMs: 0, voiced: false, segStart: t }); }
  }
  return { ends, voicedShare: voiced / ms };
}
const hiss = (floor) => (t) => floor * (0.9 + 0.2 * ((t * 7919) % 100) / 100);
const speech = (floor) => (t) => { const p = t % 6000; return p < 2500 ? (Math.floor(p / 180) % 3 === 2 ? floor * 1.4 : 0.03 + 0.02 * Math.sin(p)) : hiss(floor)(t); };

test("a steady hiss above the start threshold is learned as the floor, not heard as endless speech", () => {
  for (const floor of [0.0035, 0.005, 0.01, 0.02]) {
    const r = run(hiss(floor), 60000);
    assert.ok(r.voicedShare < 0.2, `floor ${floor}: voiced ${(r.voicedShare * 100).toFixed(0)}%`);
  }
});
test("speech over that hiss still ends each phrase on the pause, not at the 28 s cap", () => {
  for (const floor of [0.0005, 0.002, 0.005, 0.01]) {
    const r = run(speech(floor), 60000);
    const ended = r.ends.filter((e) => e.action === "end" || e.action === "rescue");
    assert.ok(ended.length >= 8, `floor ${floor}: ${ended.length} phrase ends`);
  }
});
test("a quiet room keeps the old behaviour: silence is never voiced", () => {
  const r = run(hiss(0.0005), 30000);
  assert.equal(r.voicedShare, 0);
});
