// r8 (29 Oct 2026, OFFLINE): third-person coaching leak guard, dossier items, structure-aware passages.
import test from "node:test"
import assert from "node:assert/strict"
import { draftSpokenAnswer, experienceLines } from "../../src/lib/kompasDissection.ts"

const SEG = [
  "Segmentation pilot notes",
  "He is reporting up favourably. He also told you to keep contact with your recruiter within two business days.",
  "I planned segmentation in phases, starting with a pilot at two clinics and validating every clinical device flow before enforcement.",
  "I mapped clinical systems with the biomed team and kept a rollback window for each change during the segmentation pilot.",
  "She wants someone who can standardize the network and clean up the old configs quickly.",
].join("\n")

test("r8: third-person coaching about another person never enters a first-person draft", () => {
  for (const lv of ["engineer", "architect", "director"]) {
    const d = draftSpokenAnswer("How do you plan segmentation without breaking clinical systems?", lv, SEG, [])
    assert.doesNotMatch(d, /reporting up favourabl|\bhe is\b|\bhe also told\b|\bshe wants\b|told you/i, `${lv}: ${d}`)
    assert.match(d, /segmentation|clinical/i)
  }
})
test("r8: experienceLines drops third-person coaching lines but keeps first-person evidence", () => {
  const lines = experienceLines(SEG)
  assert.ok(!lines.some((l) => /favourabl|she wants/i.test(l)), lines.join(" | "))
  assert.ok(lines.some((l) => /I planned segmentation/.test(l)))
})
test("r8: a resume line naming a third party as context is kept (failsafe: no over-dropping)", () => {
  const lines = experienceLines("Led the migration with the CTO and his platform team across 40 services.")
  assert.equal(lines.length, 1)
})

import { dossierItems, relatedTerms, lineKind } from "../../src/lib/kompasDossierItems.ts"
import { sourceDocs, retrievePassages, splitPassages } from "../../src/lib/kompasSourceRetrieval.ts"
const DOSSIER = [
  "THE FILE | SECURITY ENGINEER", "", "How do you run a threat model for a new payments API?",
  "I start from the data flow and mark every trust boundary,", "then list abuse cases per boundary and test the riskiest one first.", "",
  "THE FILE | SECURITY ENGINEER", "Page 4", "", "Tree 3", "", "How do you handle an owner who disputes a finding?",
  "I bring the evidence and the exploit path, agree on the risk rating,", "and write down the date we both accept.", "",
  "THE FILE | SECURITY ENGINEER", "Page 5", "What would you check first in a CI pipeline review?",
  "I look at who can change workflow files and which secrets reach untrusted build steps.",
].join("\n")
test("r8: a question line and its answer lines are one item; page headers/footers dropped", () => {
  const items = dossierItems(DOSSIER)
  assert.ok(items)
  const tm = items.find((i) => /threat model/.test(i.text))
  assert.match(tm.text, /trust boundary.*riskiest one first/)
  assert.ok(!items.some((i) => /Page \d|THE FILE/.test(i.text)))
  assert.equal(lineKind("Tree 3"), "title")
})
test("r8: the matching question pulls its answer first, not a fragment", (t) => {
  // demo-final: the r8 item split ships behind KOMPAS_DOSSIER_ITEMS (default OFF), so this test turns it on for itself.
  const was = process.env.KOMPAS_DOSSIER_ITEMS; process.env.KOMPAS_DOSSIER_ITEMS = "1"
  t.after(() => { if (was === undefined) delete process.env.KOMPAS_DOSSIER_ITEMS; else process.env.KOMPAS_DOSSIER_ITEMS = was })
  const r = retrievePassages("How would you threat model a payments API?", sourceDocs({ dossier: DOSSIER }))
  assert.match(r.passages[0].text, /trust boundary/)
  assert.ok(Array.isArray(r.passages[0].span))
})
test("r8: a wrapped question (two lines) stays one heading", () => {
  const items = dossierItems(["Intro line about the role and the team here", "How do you handle an access", "management control issue?", "I trace the entitlement to its owner and re-test the population after the fix is in.", "", "What is RBAC?", "Roles group permissions so access is granted by job, not person by person.", "", "Why this team?", "I want to work where findings turn into fixed controls quickly and visibly."].join("\n"))
  assert.ok(items.some((i) => /^How do you handle an access management control issue\? I trace/.test(i.text)), JSON.stringify(items.map((i) => i.text)))
})
test("r8 failsafe: flat text without structure keeps the old line split", () => {
  const flat = "Led SOC triage for 3 regions with Splunk dashboards.\nBuilt Terraform guardrails for AWS accounts across teams."
  assert.equal(dossierItems(flat), null)
  assert.deepEqual(splitPassages(sourceDocs({ dossier: flat })).map((p) => p.line), flat.split("\n"))
  assert.deepEqual(relatedTerms(["x"], []), new Map())
})
