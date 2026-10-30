// Lens r1 (29 Oct 2026). OFFLINE STAND-IN ONLY: answers come from the deterministic lens composer, not a live model.
// T1-T5 measure the lens/realism layer's rules and prompt blocks; T7 is the existing suite (run separately).
import { test } from "node:test"
import assert from "node:assert/strict"
import { REALISM, LENS, lensBlock, depthFor, composeLensAnswer, realismMarkers, nextRung, deepenRung, dossierFigure, audienceGuidance, DOSSIER_NUMBERS } from "../../src/lib/kompasAudience.ts"
import { desktopResponsePolicy, explainModesAsked } from "../../src/lib/kompasDesktopResponse.ts"
import { extractClaims } from "../../src/lib/kompasSourceRetrieval.ts"
import { allowedNumbers } from "../../src/lib/kompasGuards.ts"
import { S, LENSES, variant } from "../kompas-lens-folds.mjs"
// The Lens prompt layer ships OFF (KOMPAS_DESKTOP_LENS); these tests check it switched on. kompas-lens-default-off.test.mjs checks off.
process.env.KOMPAS_DESKTOP_LENS = "on"

const N = Number(process.env.LENS_FOLDS || 200)
const SOURCES = [S.resume, S.jd, S.documents]
const ALLOWED = allowedNumbers(...SOURCES)
const AD079 = [/\b800[- ]point\b/i, /\b30[- ]day SLA\b/i, /closure[- ]rate[^.]*\d+%/i]
export function syllables(w) { w = w.toLowerCase().replace(/[^a-z]/g, ""); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, ""); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length) }
export function fleschGrade(t) { const s = t.split(/[.!?]+/).filter((x) => x.trim()).length || 1; const ws = t.match(/[A-Za-z']+/g) || []; const sy = ws.reduce((a, w) => a + syllables(w), 0); return 0.39 * (ws.length / s) + 11.8 * (sy / (ws.length || 1)) - 15.59 }
const FIG = /\$?\b\d[\d,.]*%?/g
const spokenNumbers = (t) => (t.match(FIG) || []).map((f) => f.replace(/[.,]$/, "").replace(/\+/g, "").toLowerCase()).filter((f) => !ALLOWED.has(f) && !ALLOWED.has(f.replace(/%$/, "")))
const answer = (v, lens, depth) => composeLensAnswer({ question: v.question, lens, depth, concept: v.concept, facts: v.facts, sources: SOURCES })

test("prompt blocks exist, are short, and are wired into the existing audience guidance (built on, not replaced)", () => {
  assert.match(REALISM, /R1[\s\S]*R6/); assert.doesNotMatch(REALISM, /\[ ___/); assert.match(DOSSIER_NUMBERS, /confirm/) // r3: dossier hole moved out of the spoken block
  assert.ok(REALISM.split(/\s+/).length <= 170, `REALISM is ${REALISM.split(/\s+/).length} words`)
  for (const k of ["hiring_manager", "practitioner", "director", "architect", "hr"]) assert.ok(LENS[k], k)
  const g = audienceGuidance("director", "What is zero trust?")
  assert.match(g, /STORYTELLER/); assert.match(g, /CALIBRATION/); assert.match(g, /REALISM/); assert.match(g, /LENS/)
  assert.match(lensBlock("hr", "explain simply what a SIEM is"), /simple/)
  assert.equal(depthFor("Explain it simply, what is MFA?"), "simple"); assert.equal(depthFor("Go deeper on that."), "deep"); assert.equal(depthFor("What is MFA?"), "standard")
})

test(`T1 fact invariance: same claims across 5 lenses (${N} variants, target 100%)`, () => {
  let ok = 0; const bad = []
  for (let i = 0; i < N; i++) {
    const v = variant(i)
    const sets = LENSES.map((l) => new Set(extractClaims(answer(v, l, l === "simple" ? "simple" : "standard")).map((c) => c.toLowerCase())))
    const key = (s) => [...s].sort().join("|")
    if (sets.every((s) => key(s) === key(sets[0]))) ok++; else if (bad.length < 3) bad.push({ i, sets: sets.map(key) })
  }
  console.log(`T1 ${ok}/${N}`)
  assert.equal(ok, N, JSON.stringify(bad))
})

test(`T2 number safety: 0 unsourced numbers in any lens, depth or dossier line (${N} variants)`, () => {
  let violations = 0; const bad = []
  for (let i = 0; i < N; i++) {
    const v = variant(i)
    for (const l of LENSES) for (const d of ["simple", "standard", "deep"]) {
      const t = answer(v, l, d); const n = spokenNumbers(t)
      if (n.length || AD079.some((r) => r.test(t))) { violations++; if (bad.length < 3) bad.push({ i, l, d, n }) }
    }
  }
  assert.equal(dossierFigure("cut triage time", null), "cut triage time by [ ___ confirm: your actual figure ]")
  assert.equal(dossierFigure("cut alert triage time", "40%", ALLOWED), "cut alert triage time by 40%")
  assert.equal(dossierFigure("cut alert triage time", "35%", ALLOWED), "cut alert triage time by [ ___ confirm: your actual figure ]")
  console.log(`T2 violations ${violations}`)
  assert.equal(violations, 0, JSON.stringify(bad))
})

test(`T3 simple mode: Flesch grade <= 8 and the real term named once (${N} variants, target >= 95%)`, () => {
  let ok = 0; const bad = []; const grades = []
  for (let i = 0; i < N; i++) {
    const v = variant(i); const t = answer(v, "simple", "simple"); const g = fleschGrade(t); grades.push(g)
    const named = t.toLowerCase().split(v.concept.term.toLowerCase()).length - 1
    if (g <= 8 && named === 1) ok++; else if (bad.length < 3) bad.push({ i, g: g.toFixed(1), named, t })
  }
  grades.sort((a, b) => a - b)
  console.log(`T3 ${ok}/${N} median grade ${grades[Math.floor(N / 2)].toFixed(1)} worst ${grades[N - 1].toFixed(1)}`)
  assert.ok(ok / N >= 0.95, `${ok}/${N} ${JSON.stringify(bad)}`)
})

test(`T4 explain modes: challenge and resolve present on explain questions (${N} variants, target >= 90%)`, () => {
  let ok = 0, asked = 0
  for (let i = 0; i < N; i++) {
    const v = variant(i)
    assert.ok(explainModesAsked(v.question), v.question)
    assert.match(desktopResponsePolicy("engineer", v.question).guidance, /EXPLAIN MODES/)
    for (const l of LENSES) {
      asked++; const t = answer(v, l, l === "simple" ? "simple" : "standard"); const m = realismMarkers(t)
      if (m.challenge && m.resolve) ok++
    }
  }
  assert.ok(!explainModesAsked("Tell me about a time you led incident response."))
  assert.doesNotMatch(desktopResponsePolicy("engineer", "Tell me about a time you led incident response.").guidance, /EXPLAIN MODES/)
  console.log(`T4 ${ok}/${asked}`)
  assert.ok(ok / asked >= 0.9)
})

test(`T5 realism: >= 1 tradeoff/ownership phrase in standard and deep, 0 unsourced dated incidents, <= 1 tic (${N} variants)`, () => {
  let ok = 0, n = 0, dated = 0, tics = 0
  for (let i = 0; i < N; i++) {
    const v = variant(i)
    for (const l of LENSES.filter((x) => x !== "simple")) for (const d of ["standard", "deep"]) {
      n++; const m = realismMarkers(answer(v, l, d), SOURCES)
      if (m.tradeoff + m.ownership >= 1) ok++
      dated += m.unsourcedDated; if (m.tics > 1) tics++
    }
  }
  console.log(`T5 markers ${ok}/${n} dated ${dated} over-tic ${tics}`)
  assert.equal(ok, n); assert.equal(dated, 0); assert.equal(tics, 0)
  // the marker check itself catches an invented dated story and a double tic
  const fake = realismMarkers("Honestly, back in 2019 my manager was short on time. I would rather test first. Honestly it worked.", SOURCES)
  assert.equal(fake.unsourcedDated, 1); assert.equal(fake.tics, 3)
})

test("own the room: answer first, assumption on vague asks, one rung offer at the close; deepening climbs the ladder", () => {
  const v = variant(0)
  const t = answer(v, "practitioner", "standard")
  assert.ok(t.split(/(?<=[.!?])\s+/)[0].toLowerCase().includes(v.concept.term.toLowerCase().replace(/^an? /, "")))
  // r3: the rung is a clause inside the last sentence, so the last sentence is still the takeaway (prompt checker, close-rung-vs-takeaway)
  assert.match(t.split(/(?<=[.!?])\s+/).pop(), /, and I can walk (?:you )?through/)
  const vague = composeLensAnswer({ question: "Security?", lens: "director", depth: "standard", concept: v.concept, facts: v.facts, sources: SOURCES })
  // r3: the assumption sits inside the first sentence, which still answers (prompt checker, assume-before-answer)
  assert.match(vague, /^Assuming you mean [^.]+, in plain words it is/)
  assert.equal(deepenRung("Go deeper.", 1), 2); assert.equal(deepenRung("Why?", 2), 3); assert.equal(deepenRung("Why?", 3), 3); assert.equal(deepenRung("Thanks, next question.", 2), 1)
  assert.notEqual(nextRung(1), nextRung(2)); assert.equal(nextRung(3), nextRung(3))
})

test("levels-core: the three modes carry lens labels", async () => {
  globalThis.KompasDiamond = undefined
  await import("../../public/kompas/levels-core.js")
  const L = globalThis.KompasLevels.LENS_LABELS
  assert.ok(L.engineer && L.architect && L.director)
  assert.equal(new Set(Object.values(L).map((x) => x.label)).size, 3)
})

test("failure hunt r1: personal questions do not get explain modes; month-dated stories are caught", () => {
  for (const q of ["What is your biggest weakness?", "What are your salary expectations?", "Why do you want this role?", "What is your experience with Splunk?", "Why should we hire you?", "What are you most proud of?", "Why are you interested in Northwind?", "Why did you leave Contoso?"]) assert.equal(explainModesAsked(q), false, q)
  for (const q of ["What is Kerberos?", "Can you explain zero trust simply?", "What's the difference between IDS and IPS?", "Why is MFA not enough?", "Go deeper on that.", "Could you explain how SAML works?"]) assert.equal(explainModesAsked(q), true, q)
  assert.equal(realismMarkers("Back in March my manager was out.", SOURCES).unsourcedDated, 1)
  assert.equal(realismMarkers("I joined Northwind Bank in 2021.", SOURCES).unsourcedDated, 0)
})
