// Offline gate over PR #126 write-ups: number check, layout check, print builder; flag off by default.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { gateWriteup, maybeGateWriteup, writeupGateEnabled, WRITEUP_SECTIONS } from "../../src/lib/dossierWriteupGate.ts"
import { validateDossierSources } from "../../src/lib/kompas-dossier-bots.ts"
import { HOLE } from "../../src/lib/dossierBlueprint.ts"

const F = (n) => readFileSync(new URL(`./fixtures/pr126-writeups/${n}`, import.meta.url), "utf8")
const sources = validateDossierSources([
  { id: "resume", kind: "resume", title: "Resume", text: F("resume.txt") },
  { id: "jd", kind: "job_description", title: "JD", text: F("jd.txt") },
])

test("fixtures are #126-shaped: section lists match #126's prompt text", () => {
  const bots = readFileSync(new URL("../../src/lib/kompas-dossier-bots.ts", import.meta.url), "utf8")
  for (const list of Object.values(WRITEUP_SECTIONS)) for (const s of list) assert.ok(bots.includes(s), s)
})

test("clean #126 synthesis passes: all sections, cited, no unsourced figure, citations survive", () => {
  const r = gateWriteup(F("synthesis-clean.md"), { stage: "synthesis", sources })
  assert.equal(r.shape, "pr126"); assert.deepEqual(r.missingSections, []); assert.deepEqual(r.blocked, [])
  assert.deepEqual(r.citationWarnings, []); assert.ok(r.ok)
  assert.match(r.markdown, /\[S:resume\]/); assert.match(r.html, /\[S:jd\]/)
  assert.match(r.html, /<h2>/)
})

test("unsourced numbers become holes; AD079 figures banned; unknown citation flagged", () => {
  const r = gateWriteup(F("dossier-unsourced.md"), { stage: "dossier", sources })
  assert.ok(!r.ok)
  for (const f of ["42%", "6 months", "12"]) assert.ok(r.blocked.some((b) => b.startsWith(f.split(" ")[0])), f)
  assert.ok(r.banned.length >= 2)
  assert.ok(r.citationWarnings.includes("unknown-source-citation:ghost"))
  assert.ok(r.markdown.includes(HOLE)); assert.ok(!/42%|800|30-day/.test(r.markdown))
  assert.ok(r.missingSections.includes("JD coverage matrix"))
})

test("missing sections are listed per stage", () => {
  const r = gateWriteup(F("notebook-missing.md"), { stage: "notebook", sources })
  assert.equal(r.shape, "pr126"); assert.equal(r.missingSections.length, 6); assert.ok(!r.ok)
})

test("old-shape input: blueprint markdown and legacy item objects are recognised and still gated", () => {
  const b = gateWriteup(F("blueprint-old.md"), { stage: "synthesis", sources })
  assert.equal(b.shape, "blueprint"); assert.ok(!b.ok)
  const o = gateWriteup({ items: [{ q: "Your closure rate?", a: ["I closed 95% of findings."] }] }, { stage: "dossier", sources })
  assert.equal(o.shape, "old-object"); assert.ok(o.blocked.includes("95%")); assert.ok(!o.ok)
  const m = gateWriteup({ markdown: F("synthesis-clean.md") }, { stage: "synthesis", sources })
  assert.ok(m.ok)
})

test("bad input never throws: empty, null, number", () => {
  for (const x of ["", null, 7, { items: "no" }]) {
    const r = gateWriteup(x, { stage: "dossier", sources })
    assert.equal(r.shape, "empty"); assert.ok(!r.ok)
  }
})

test("contact details in a write-up are removed and counted", () => {
  const r = gateWriteup("## Evidence hierarchy\nCall me at 555-123-4567 or a.b@c.com [S:resume]", { stage: "synthesis", sources })
  assert.equal(r.contactRemoved, 2); assert.ok(!/555|a\.b@/.test(r.html))
})

test("citation ids with digits are not treated as figures", () => {
  const src = validateDossierSources([
    { id: "resume-2", kind: "resume", title: "R", text: "Validated remediation." },
    { id: "jd-1", kind: "job_description", title: "J", text: "Challenge control issues." },
  ])
  const r = gateWriteup("## Evidence hierarchy\nValidated remediation [S:resume-2] [S:jd-1].", { stage: "synthesis", sources: src })
  assert.deepEqual(r.blocked, []); assert.match(r.markdown, /\[S:resume-2\] \[S:jd-1\]/)
})

test("flag OFF (default): write-up returned byte-identical, no report", () => {
  const md = F("dossier-unsourced.md")
  assert.equal(writeupGateEnabled({}), false)
  const r = maybeGateWriteup(md, { stage: "dossier", sources }, {})
  assert.equal(r.markdown, md); assert.equal(r.report, null)
  assert.equal(maybeGateWriteup(md, { stage: "dossier", sources }, { KOMPAS_DOSSIER_WRITEUP_GATE: "true" }).report, null)
})

test("flag ON: write-up is gated", () => {
  const r = maybeGateWriteup(F("dossier-unsourced.md"), { stage: "dossier", sources }, { KOMPAS_DOSSIER_WRITEUP_GATE: "1" })
  assert.ok(r.report && !r.report.ok); assert.ok(!r.markdown.includes("42%"))
})

test("no route imports the gate (not wired into the live path)", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  const hits = walk(new URL("../../src/app", import.meta.url).pathname).filter((f) => readFileSync(f, "utf8").includes("dossierWriteupGate"))
  assert.deepEqual(hits, [])
})
