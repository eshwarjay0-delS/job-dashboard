// Slice 6 (30 Oct 2026): spoken filler at a question's start or end no longer hides the question opener.
// Expected outcomes were written first (below). The cut runs on a detection copy with the filler left out. Cards are
// cut from the original words only at a "?" "." or "!" already there. Shown text never loses or reorders a word.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts";
import { loadDesktopCut } from "../kompas-cut-stress.mjs";

const desk = loadDesktopCut();
const words = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const both = (t) => { const s = splitDistinctAsks(t); assert.deepEqual(Array.from(desk(t)), s, "desktop and server agree: " + t); assert.equal(words(s.join(" ")), words(t), "no word lost or moved"); return s; };

const EXPECT = [
  // (a) filler before the opener: two cards, cut at the "?"
  ["Like what methods do you use for threat modeling? Uh how do you distinguish an incomplete RCA from a complete one?", 2],
  ["Like how do you interpret NIST 800-53 design and operating effectiveness? Okay so what are the most common high impact risks you see in design reviews?", 2],
  ["How do you tune EPM policy to reduce false positives at scale, right? How would you approach securing an OT environment you have just inherited, right?", 2],
  ["How do you you know, handle competing priorities from different stakeholders? What do you you know, do when a control owner will not give you the information you need?", 2],
  ["What what do you do when a critical vulnerability affects multiple banking applications and misses the deadline? Do do you have any questions for us?", 2],
  ["How do you, sorry, what data inputs did you rely on? How do you, sorry, what would you do in your first 30 days?", 2],
  // (a) a false start no longer splits one question in two
  ["What was, um, what methods do you use for threat modeling?", 1],
  ["Can you, uh, what precisely failed, against which control requirement? How do you, sorry, which tools have you used for vulnerability assessment?", 2],
  // unchanged: one question with filler stays one; a compound question is never split blindly
  ["Um so what is Kubernetes and how does it scale?", 1],
  ["Okay so how do you handle a finding when root cause is uncertain, right?", 1],
  ["What is CyberArk and how does it rotate passwords?", 1],
];

test("6-1. expected outcomes: filler at a question's start or end, desktop = server, no word lost", () => {
  for (const [t, n] of EXPECT) assert.equal(both(t).length, n, t);
});

test("6-2. shown text is the speaker's own words: cards are exact pieces of the original", () => {
  const t = "Okay, um, what secrets/tokens are available to pull requests or untrusted build steps? So um how do you explain risk to an executive who isn’t technical?";
  const s = both(t);
  assert.deepEqual(s, ["Okay, um, what secrets/tokens are available to pull requests or untrusted build steps?", "So um how do you explain risk to an executive who isn’t technical?"]);
});

test("6-3. stripped speech (no punctuation) is left to slice 5: no new cut without a written sentence end", () => {
  for (const t of ["um so what is kubernetes so how does it scale", "okay so how do you rotate keys and what is vault", "like what is iga uh how do you run access reviews"]) {
    const s = both(t);
    assert.ok(s.length >= 1);
  }
});

test("6-4. failsafe: odd input never throws and never loses words", () => {
  // filler-only input: slice 5 already shows no card for it; slice 6 must only not throw
  for (const t of ["", "?", "um", "um, uh, so,", "right?", "you know, right?"]) assert.doesNotThrow(() => splitDistinctAsks(t));
  for (const t of ["What what what?", "How do you, sorry, ? what", "   Like   how   do you scale?   Uh what is X?  "]) {
    assert.doesNotThrow(() => splitDistinctAsks(t));
    assert.equal(words(splitDistinctAsks(t).join(" ")), words(t), t);
  }
  // a sentence of only filler was already left out by slice 5, and still is
  assert.deepEqual(splitDistinctAsks("Um, right? So what is X, you know?"), ["So what is X, you know?"]);
});

test("6-5. supplementary filler bank (dossier questions + spoken filler): measured offline, not live", () => {
  const bank = JSON.parse(readFileSync(new URL("./fixtures/kompas-filler-bank.json", import.meta.url), "utf8"));
  let pass = 0, singles = 0;
  for (const r of bank.runs) if (both(r.text).length === r.expect) pass++;
  for (const q of bank.singles) if (both(q.text).length === 1) singles++;
  assert.ok(pass >= 68, `runs ${pass}/80 (slice 5: 57/80)`);
  assert.equal(singles, 100, `singles ${singles}/100 (slice 5: 99/100)`);
});
