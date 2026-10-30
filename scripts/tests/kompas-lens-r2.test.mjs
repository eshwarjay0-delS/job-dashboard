// Lens r2 (29 Oct 2026). OFFLINE STAND-IN: rule checks and the deterministic composer, no live model.
import { withoutLogistics } from "../../src/lib/kompasLogistics.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { HUNT } from "../kompas-lens-hunt-r2.mjs"
import { openerCategory, pickOpener, buildOpenerTable } from "../../src/lib/kompasOpener.ts"
import { explainModesAsked, desktopResponsePolicy } from "../../src/lib/kompasDesktopResponse.ts"
import { depthFor, audienceGuidance, composeLensAnswer, composeLensParts, realismMarkers } from "../../src/lib/kompasAudience.ts"
import { CONCEPTS, variant } from "../kompas-lens-folds.mjs"
// The Lens prompt layer ships OFF (KOMPAS_DESKTOP_LENS); these tests check it switched on. kompas-lens-default-off.test.mjs checks off.
process.env.KOMPAS_DESKTOP_LENS = "on"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))

test(`hunt: experience-story category on ${HUNT.length} hand-labelled questions (led / built / drove / biggest / challenge / conflict)`, () => {
  const bad = HUNT.filter((h) => (openerCategory(h.q) === "experience-story") !== h.story).map((h) => h.q)
  assert.deepEqual(bad, [])
})
test(`hunt: explain modes on the right questions (${HUNT.length})`, () => {
  assert.deepEqual(HUNT.filter((h) => explainModesAsked(h.q) !== h.explain).map((h) => h.q), [])
})
test(`hunt: depth read from the question (${HUNT.length})`, () => {
  assert.deepEqual(HUNT.filter((h) => depthFor(h.q) !== h.depth).map((h) => `${h.q} -> ${depthFor(h.q)}`), [])
})

const AUD = ["hr", "technical_hr", "analyst", "engineer", "developer", "supervisor", "architect", "lead", "director", "hiring_manager", "", "unknown"]
test(`hunt: every audience x question gives exactly one LENS line and one REALISM block (${AUD.length} x ${HUNT.length})`, () => {
  const bad = []
  for (const a of AUD) for (const h of HUNT) {
    const g = audienceGuidance(a, h.q)
    // Lens logistics relabel (29 Oct 2026, owner rule): a pure logistics ask ("What are your salary expectations?") gets no lens block.
    const want = withoutLogistics(h.q) ? 1 : 0
    if ((g.match(/\bLENS [A-Z]/g) || []).length !== want || (g.match(/REALISM \(/g) || []).length !== want) bad.push(`${a}|${h.q}`)
    if (!desktopResponsePolicy(a, h.q).guidance) bad.push(`policy ${a}|${h.q}`)
  }
  assert.deepEqual(bad.slice(0, 5), [])
})
test("hunt: hiring manager is folded into Director (current default), HR levels are not labelled Technical peer", async () => {
  assert.match(audienceGuidance("hiring_manager", "What is MFA?"), /LENS Director/)
  await import("../../public/kompas/levels-core.js")
  const K = globalThis.KompasLevels
  for (const l of K.LADDER) assert.ok(K.lensFor(l).label, l)
  assert.equal(K.lensFor("hr").label, "HR / technical HR"); assert.equal(K.lensFor("technical_hr").label, "HR / technical HR")
  assert.equal(K.lensFor("lead").label, K.lensFor("director").label); assert.equal(K.lensFor("developer").label, "Architect")
})

test("hunt: no sources — no ownership past tense, no numbers, still a tradeoff and a rung; no opener", () => {
  for (const c of CONCEPTS) for (const l of ["hiring_manager", "practitioner", "director", "architect", "hr", "simple"]) for (const d of ["simple", "standard", "deep"]) {
    const t = composeLensAnswer({ question: `What is ${c.term}?`, lens: l, depth: d, concept: c, facts: [], sources: [] })
    assert.doesNotMatch(t, /\bI (?:built|led|ran|wrote|owned|drove|tracked|mapped|onboarded)\b/, t)
    assert.doesNotMatch(t, /\d/, t)
    assert.match(t, /I can walk/)
    if (l !== "simple" && d !== "simple") assert.ok(realismMarkers(t).tradeoff >= 1)
  }
  assert.equal(pickOpener(buildOpenerTable([], {}).table, "Tell me about a time you led incident response."), null)
})

test("hunt: vague asks name the assumption; follow-up and personal questions never get an invented incident", () => {
  for (const q of ["Security?", "Cloud.", "Thoughts?", "Splunk.", "Risk."]) {
    const t = composeLensAnswer({ question: q, lens: "director", depth: "standard", concept: CONCEPTS[0], facts: [], sources: [] })
    assert.match(t, /^Assuming you mean /, q) // r3: assumption inside the first sentence
  }
  for (const h of HUNT) for (const l of ["practitioner", "director", "hr"]) {
    const t = composeLensAnswer({ question: h.q, lens: l, depth: h.depth, concept: CONCEPTS[2], facts: [], sources: [] })
    const m = realismMarkers(t, [])
    assert.equal(m.unsourcedDated, 0); assert.ok(m.tics <= 1, t)
  }
})

test("T3 honest: the composer names the term once; a resume line that also names it is source text, kept word for word", () => {
  let composerOnce = 0, sourceRepeats = 0, n = 0
  for (let i = 0; i < 200; i++) {
    const v = variant(i); n++
    const p = composeLensParts({ question: v.question, lens: "simple", depth: "simple", concept: v.concept, facts: v.facts })
    const term = v.concept.term.toLowerCase()
    const own = p.lines.filter((x) => !p.factLines.includes(x)).join(" ").toLowerCase()
    if (own.split(term).length - 1 === 1) composerOnce++
    if (p.factLines.join(" ").toLowerCase().includes(term)) sourceRepeats++
    // every fact line keeps the resume wording (only "I" / "I also" added, first letter lower-cased)
    for (const f of p.factLines) {
      const core = f.replace(/^I (?:also )?/, "").replace(/^That /, "").replace(/\.$/, "").toLowerCase()
      assert.ok(S.resume.toLowerCase().includes(core), f)
    }
  }
  console.log(`T3-honest composer names term once ${composerOnce}/${n}; resume itself repeats the term in ${sourceRepeats}/${n}`)
  assert.equal(composerOnce, n)
})
