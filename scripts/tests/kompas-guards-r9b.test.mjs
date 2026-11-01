// Guards r9b (29 Oct 2026): Lens contract v3 (displayOpener / isSafeDisplay). Offline, code-level only.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as R from "../../src/lib/kompasSourceRetrieval.ts"
import * as G from "../../src/lib/kompasSentenceGate.ts"
import { allowedNumbers, questionFigures, speakFacts } from "../../src/lib/kompasGuards.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = R.sourceDocs({ resume: S.resume, jd: S.jd, dossier: S.dossier })
const allowed = allowedNumbers(S.resume, S.dossier)
const facts = speakFacts({ resume: S.resume, jd: "", documents: S.dossier, heard: "", identity: "", projects: "" })
const Q = "Tell me about a time you led a migration."
const passages = R.retrievePassages(Q, DOCS, 4).passages
const check = G.sentenceCheck({ facts, allowed, asked: questionFigures(Q), docs: DOCS, question: Q, passages })
const bullet = "Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%."
const opP = G.splitOpenerPassages(DOCS)
const pid = opP.find((p) => p.line === bullet || p.text === bullet)?.id
const L0 = "In one of my roles, I "
const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true, leadIn: L0 }
const shown = L0 + "built" + bullet.slice(5)
const nums = (s) => (s.match(/\d[\d,.%]*/g) || [])
const caps = (s) => (s.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []).filter((w) => !/^(?:In|I|My)$/.test(w))

test("v3: the gate shows displayOpener (first letter lowercased) and withOpener gets the same string", () => {
  assert.ok(pid, "fixture bullet is a session passage")
  assert.equal(G.displayOpenerText(op), shown)
  assert.equal(G.isSafeDisplayText(op, shown), true)
  const g = G.createSentenceGate({ check, opener: op, sourcePassages: opP })
  assert.deepEqual(g.start(), [shown]); assert.equal(g.openerText(), shown)
  assert.equal(G.withOpener("Then I tuned the noisy rules.", g.openerText()), `${shown} Then I tuned the noisy rules.`)
})
test("v3: acronym / inner-capital first words keep their capital", () => {
  assert.equal(G.displayOpenerText({ text: "AWS GuardDuty tuning.", leadIn: "In my work, I " }), "In my work, I AWS GuardDuty tuning.")
  assert.equal(G.displayOpenerText({ text: "SailPoint rollout.", leadIn: "In my work, I " }), "In my work, I SailPoint rollout.")
  assert.equal(G.displayOpenerText({ text: "Built X.", leadIn: "" }), "Built X.")
})
test("v3: approval stays on exact text; changed text, lead-in in text, display string as text, mismatched id never approve", () => {
  assert.equal(G.approveSourcedOpener(op, opP), true)
  for (const bad of [{ ...op, text: bullet.replace("40%", "45%") }, { ...op, text: L0 + bullet }, { ...op, text: shown },
    { ...op, sourceId: "dossier-item-7" }, { ...op, sourceId: opP.find((p) => p.id !== pid).id }]) {
    assert.equal(G.approveSourcedOpener(bad, opP), false, JSON.stringify(bad).slice(0, 80))
    assert.deepEqual(G.createSentenceGate({ check, opener: bad, sourcePassages: opP }).start(), [])
  }
})
test("v3: an unsafe display falls back to text (unknown lead-in, tampered display)", () => {
  const g = G.createSentenceGate({ check, opener: { ...op, leadIn: "At Globex in 2015 I led 50 people and " }, sourcePassages: opP })
  assert.deepEqual(g.start(), [bullet]); assert.equal(g.openerText(), bullet)
  assert.equal(G.isSafeDisplayText(op, shown.replace("40%", "60%")), false)
  assert.equal(G.isSafeDisplayText(op, L0 + bullet.toLowerCase()), false)
  assert.equal(G.isSafeDisplayText(op, bullet), false)
  assert.equal(G.isSafeDisplayText(null, shown), false)
})
test("v3: the display never alters facts, numbers, dates or names, for every lead-in", () => {
  for (const l of G.LEAD_INS.concat([""])) {
    const o = { ...op, leadIn: l }, d = G.displayOpenerText(o)
    assert.equal(G.isSafeDisplayText(o, d), true, l)
    assert.deepEqual(nums(d), nums(bullet)); assert.deepEqual(caps(d).filter((w) => w !== "Built"), caps(bullet).filter((w) => w !== "Built"))
    assert.equal(d.slice(l.length + 1), bullet.slice(1)); assert.doesNotMatch(l, /\d/)
    assert.deepEqual(R.extractClaims(l + "x."), [], l)
  }
})

// ---- LEAD_INS is Lens's list itself (Lens r7: the gate imports it from kompasOpener.ts; replaces the bundle-read drift test)
import * as LensOpener from "../../src/lib/kompasOpener.ts"
test("LEAD_INS is imported from Lens kompasOpener.ts (no hand copy can drift)", () => {
  assert.equal(G.LEAD_INS, LensOpener.LEAD_INS)
  assert.deepEqual([...G.LEAD_INS], [...LensOpener.LEAD_INS])
})
