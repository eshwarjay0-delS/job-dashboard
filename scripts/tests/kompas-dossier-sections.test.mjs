// T6 extension (lens spec §7) to round-5 sections: Why company + snapshot, first 30 minutes, one-page, risk translations.
import test from "node:test"
import assert from "node:assert/strict"
import { BLUEPRINT_PARTS, BLUEPRINT_PARTS_EXTRA, BLUEPRINT_GUIDE, companySnapshot, riskTranslations, skeletonCheck, gateFigures, HOLE } from "../../src/lib/dossierBlueprint.ts"

test("old six parts unchanged; four new parts have guides", () => {
  assert.deepEqual(BLUEPRINT_PARTS, ["evidence", "oneminute", "signals", "fixfirst", "ladder", "jargon"])
  for (const p of BLUEPRINT_PARTS_EXTRA) assert.ok(BLUEPRINT_GUIDE[p]?.length > 40, p)
})

test("snapshot: cited fact keeps its figure, a figure not in its own quote becomes a hole", () => {
  const r = companySnapshot({ company: "BNY", asOf: "2026-10-29", facts: [
    { text: "AUC/A of $63.4 trillion at Sept 30, 2026", quote: "As of September 30, 2026, BNY oversees $63.4 trillion in assets under custody and/or administration", url: "https://www.bny.com/x" },
    { text: "Revenue grew 17% this quarter", quote: "Total revenue of $5.7 billion was up 12% year-over-year", url: "https://www.fool.com/y" },
  ] })
  assert.match(r.md, /\$63\.4 trillion/)
  assert.deepEqual(r.blocked, ["17%"])
  assert.match(r.md, /as of 2026-10-29, public sources only/)
  assert.equal(r.cited, 2)
})

test("snapshot: a fact without a public https source is a marked hole, never recalled", () => {
  const r = companySnapshot({ company: "BNY", asOf: "2026-10-29", facts: [
    { text: "The team has 40 analysts", need: "size of the technology risk team" },
    { text: "x", quote: "y", url: "http://insecure.example" },
  ] })
  assert.equal(r.holes.length, 2); assert.equal(r.cited, 0)
  assert.doesNotMatch(r.md, /40 analysts/)
})

test("risk translations: figures gated per row; AD079 banned figures blocked", () => {
  const r = riskTranslations([
    { technical: "ServiceNow ticket triage", risk: "Unowned findings age past their remediation window", say: "I made sure every finding had an owner and a due date.", source: "ServiceNow" },
    { technical: "CVSS scoring", risk: "Severity alone hides 3 times more exposure", say: "I would weigh exploitability.", source: "CVSS" },
    { technical: "Risk acceptance", risk: "Tolerance of 800 points", say: "I escalate past a fixed 30-day SLA.", source: "800 points 30-day SLA" },
  ], [])
  assert.match(r.md, /^\| Technical thing/)
  assert.ok(r.blocked.length >= 3, JSON.stringify(r.blocked))
  assert.ok(!/800|30-day/.test(r.md))
})

test("first 30 minutes and one-page: timings are labels, invented outcomes become holes", () => {
  const g = gateFigures("Minute 0-2: introductions.\nI cut false positives by 35%.", ["resume text without that number"])
  assert.deepEqual(g.blocked, ["35%"]); assert.ok(g.text.includes(HOLE))
  assert.match(g.text, /Minute 0-2/)
})

test("full skeleton check requires the five new headings; default check unchanged", () => {
  const base = ["Evidence base", "In one minute", "Fix before", "Positioning", "Answer architecture", "Story arcs", "Three ways", "Ladder"].map(h => `## ${h}`).join("\n")
  assert.deepEqual(skeletonCheck(base, []).missing, [])
  assert.equal(skeletonCheck(base, [], { full: true }).missing.length, 5)
  const full = base + "\n## Why BNY\n### Company snapshot: BNY\n## The first 30 minutes\n## One-page summary\n## Technical-to-risk translations"
  assert.deepEqual(skeletonCheck(full, [], { full: true }).missing, [])
})

test("snapshot citation lines keep public links; contact details are still removed everywhere", async () => {
  const { stripContact } = await import("../../src/lib/dossierBlueprint.ts")
  assert.equal(stripContact("> Source S1: BNY (https://www.bny.com/a.html)"), "> Source S1: BNY (https://www.bny.com/a.html)")
  assert.match(stripContact("> Source S2: x (https://www.linkedin.com/in/someone)"), /contact left out/)
  assert.match(stripContact("See https://www.bny.com/a.html"), /contact left out/)
  assert.match(stripContact("> Source S3: mail a.b@c.com"), /contact left out/)
})
