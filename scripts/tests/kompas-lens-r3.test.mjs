// Lens r3 (29 Oct 2026). OFFLINE: prompt text, rule functions, the real figures guard, and the stand-in composer. No live model.
import { test } from "node:test"
import assert from "node:assert/strict"
import { HUNT3 } from "../kompas-lens-hunt-r3.mjs"
import { sweep, contradictions, assembled } from "../kompas-lens-prompt-check.mjs"
import { openerCategory, pickOpener, buildOpenerTable, openerPrompt } from "../../src/lib/kompasOpener.ts"
import { explainModesAsked, desktopResponsePolicy, EXPLAIN_MODES } from "../../src/lib/kompasDesktopResponse.ts"
import { depthFor, audienceGuidance, composeLensAnswer, REALISM, RUNGS, lensBlock } from "../../src/lib/kompasAudience.ts"
import { allowedNumbers, applyGuards, speakFacts, claimsResult, questionFigures } from "../../src/lib/kompasGuards.ts"
import { modeBand } from "../../src/lib/kompasDissection.ts"
import { CONCEPTS, S } from "../kompas-lens-folds.mjs"
// The Lens prompt layer ships OFF (KOMPAS_DESKTOP_LENS); these tests check it switched on. kompas-lens-default-off.test.mjs checks off.
process.env.KOMPAS_DESKTOP_LENS = "on"

// ---- (1) contradictions in the real assembled prompt text
test("prompt checker: no contradiction between the lens blocks and the existing rules (9 audiences x 10 questions x 3 paths x 3 opener states)", () => {
  assert.deepEqual(sweep().map((h) => `${h.id} (${h.n}) e.g. ${h.example}`), [])
})
test("prompt checker is not blind: it still fires on a seeded contradiction", () => {
  const seeded = "Sentence one is the answer. If the question is vague, name your assumption out loud, then answer it."
  assert.ok(contradictions(seeded).some((c) => c.id === "assume-before-answer"))
  assert.ok(contradictions("Then stop. ANSWER SHAPE: then a fuller body with the story.").some((c) => c.id === "fuller-body-vs-stop"))
})
test("prompt: the desktop path today carries no LENS / REALISM block (only explain modes); the proposed wiring carries exactly one", () => {
  const live = assembled("director", "What is zero trust?", "desktop")
  assert.equal((live.match(/\bLENS [A-Z]/g) || []).length, 0)
  assert.equal((assembled("director", "What is zero trust?", "desktop+lens").match(/\bLENS [A-Z]/g) || []).length, 1)
})

// ---- (2) hostile hunt, 200 questions labelled by hand
test(`hunt r3: story category on ${HUNT3.length} hostile questions`, () => {
  assert.deepEqual(HUNT3.filter((h) => (openerCategory(h.q) === "experience-story") !== h.story).map((h) => `${h.fam}: ${h.q.slice(-70)}`), [])
})
test(`hunt r3: explain modes on ${HUNT3.length} hostile questions`, () => {
  assert.deepEqual(HUNT3.filter((h) => explainModesAsked(h.q) !== h.explain).map((h) => `${h.fam}: ${h.q.slice(-70)}`), [])
})
test(`hunt r3: depth on ${HUNT3.length} hostile questions`, () => {
  assert.deepEqual(HUNT3.filter((h) => depthFor(h.q) !== h.depth).map((h) => `${h.fam}: ${h.q.slice(-70)} -> ${depthFor(h.q)}`), [])
})
test("hunt r3: a 6,000-word question is read in under 50 ms per rule, and every audience still gets one LENS block", () => {
  const long = "so basically you know ".repeat(1500) + "what is zero trust?"
  for (const f of [openerCategory, explainModesAsked, depthFor, (q) => audienceGuidance("director", q), (q) => desktopResponsePolicy("engineer", q)]) {
    const t0 = performance.now(); f(long); assert.ok(performance.now() - t0 < 50, String(f))
  }
  for (const h of HUNT3) for (const a of ["hr", "engineer", "architect", "director", "hiring_manager"]) {
    const g = audienceGuidance(a, h.q)
    assert.equal((g.match(/\bLENS [A-Z]/g) || []).length, 1, `${a}|${h.q.slice(0, 40)}`)
  }
})
test("hunt r3: a number the question quotes is not a source — the prompt says so, and the stand-in answer never repeats it", () => {
  assert.match(REALISM, /number the question quotes is not a source/i)
  for (const h of HUNT3.filter((x) => x.fam === "number")) {
    const t = composeLensAnswer({ question: h.q, lens: "director", depth: "standard", concept: CONCEPTS[0], facts: [], sources: [S.resume] })
    for (const f of questionFigures(h.q)) if (!allowedNumbers(S.resume).has(f)) assert.ok(!t.includes(f), `${h.q} -> ${f}`)
  }
})

// ---- (3) lens prompts vs Answer Quality r4 guards
const ALLOWED = allowedNumbers(S.resume, S.jd, S.documents)
const FACTS = speakFacts({ resume: S.resume, jd: S.jd, documents: S.documents })
test("guards: every stand-in answer (12 concepts x 6 lenses x 3 depths) passes the figures guard untouched", () => {
  for (const c of CONCEPTS) for (const l of ["hiring_manager", "practitioner", "director", "architect", "hr", "simple"]) for (const d of ["simple", "standard", "deep"]) {
    const t = composeLensAnswer({ question: `What is ${c.term}?`, lens: l, depth: d, concept: c, facts: [], sources: [] })
    assert.equal(applyGuards(t, FACTS, ALLOWED).guarded, 0, t)
  }
})
test("guards: the forms the lens prompt asks for (tradeoff, rung, challenge) are not result claims", () => {
  for (const r of RUNGS) assert.equal(claimsResult(r), false, r)
  assert.equal(claimsResult("I would rather tune a few rules well than turn on every rule at once, because noise buries the real alert."), false)
  for (const c of CONCEPTS) assert.equal(applyGuards(`You might say ${c.challenge}.`, FACTS, ALLOWED).guarded, 0)
})
test("guards: the challenge line forbids a number (the guard turns 'MFA blocks 99% of automated attacks' into 'blocks a share of automated attacks')", () => {
  assert.match(EXPLAIN_MODES, /Challenge:[^.]*\bno (?:number|figure)\b/i)
})
test("guards: an opener fits inside the answer's ceiling with room for a body (Engineer direct is 44 words)", () => {
  const long = "Led digital forensic investigations involving payment fraud and insider threats, acquiring and analyzing evidence using EnCase and FTK."
  const short = "Led digital forensic investigations involving payment fraud and insider threats."
  const res = `${long}\n${short}`
  const { table } = buildOpenerTable([{ id: "r1", sourceDoc: "resume", category: "experience-story", status: "sourced", text: long }, { id: "r2", sourceDoc: "resume", category: "experience-story", status: "sourced", text: short }], { resume: res })
  const q = "Tell me about a time you led a forensic investigation."
  const eng = modeBand("direct", "engineer").targetWords, arch = modeBand("personal-experience", "architect").targetWords
  assert.equal(pickOpener(table, q, { passages: [{ id: "r1" }] }, eng), null) // r7 relabel: too long for 44 words; was "the next sourced line (r2)", now none, since r2 was not the matched passage
  assert.equal(pickOpener(table, q, { passages: [{ id: "r1" }] }, arch).sourceId, "r1")
  const only = buildOpenerTable([{ id: "r1", sourceDoc: "resume", category: "experience-story", status: "sourced", text: long }], { resume: long }).table
  assert.equal(pickOpener(only, q, null, eng), null) // never shortened, never invented
})
test("guards: the spoken prompt holds no [ ___ ] placeholder (the guards' unbracket strips it into a broken sentence)", () => {
  for (const a of ["hr", "engineer", "director"]) assert.doesNotMatch(audienceGuidance(a, "What is MFA?"), /\[\s*_{2,}/)
  assert.doesNotMatch(openerPrompt(null), /\bwith the metric\b/)
})
test("prompt: explain modes fit the word aim (Engineer definition aims at about 40 words)", () => {
  const p = desktopResponsePolicy("engineer", "What is zero trust?")
  assert.ok(p.words <= 44)
  assert.match(EXPLAIN_MODES, /\bword aim\b/)
  assert.match(lensBlock("director", "Go deeper on zero trust."), /DEPTH deep \(Director\)/)
})
