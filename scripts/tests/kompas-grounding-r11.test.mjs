// r11 (29 Oct 2026, OFFLINE): not-covered honesty. Cases invented from scratch (not from Voice's sets).
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, retrievePassages } from "../../src/lib/kompasSourceRetrieval.ts"
const ret = (q, dossier) => retrievePassages(q, sourceDocs({ dossier }))
// A dossier in Q-and-A item shape (so the r8 item path is used): question headings + answer bodies.
const D = [
  "Q1. How do you deploy detections at Northwind?", "I deploy Sigma-style detections through a reviewed deployment pipeline into the SIEM, with a test event for each rule.", "",
  "Q2. Tell me about your role at Northwind Bank.", "I ran identity governance: quarterly access certifications, joiner-mover-leaver automation and privileged account vaulting.", "",
  "Q3. How do you handle a phishing report?", "I pull the headers, detonate attachments in a sandbox, purge matching mail and block the sender domain.", "",
  "Q4. How many systems did you onboard to vaulting?", "I onboarded 412 privileged accounts across 60 Windows and Linux servers into the vault.", "",
  "Q5. What is least privilege?", "Each identity gets only the access its current job needs, reviewed and removed when the job changes.", "",
].join("\n")
test("r11: an absent tool (one distinctive word the sources never contain) is not covered, even with a generic word ('deployment') present", () => {
  assert.equal(ret("Tell me about your Zeek deployment.", D).matched, false)
  assert.equal(ret("How do you tune Suricata detections?", D).matched, false)
})
test("r11: a near-miss asking an employer fact the sources never state (salary, manager's name) is not covered", () => {
  assert.equal(ret("What was your salary at Northwind Bank?", D).matched, false)
  assert.equal(ret("What was the name of your manager at Northwind?", D).matched, false)
})
test("r11: an item's own question heading never proves coverage, only its answer body does", () => {
  // 'deploy detections at Northwind' is the heading wording; the ask is about a budget nobody states
  assert.equal(ret("What budget did you have to deploy detections at Northwind?", D).matched, false)
})
test("r11: interviewer-only questions (about their team, this role, here) are not in the candidate's sources", () => {
  for (const q of ["How big is your security team here?", "Who would I report to in this role?", "What would success look like in the first ninety days for this role?", "What is the biggest risk your company faces this year?"])
    assert.equal(ret(q, D).matched, false, q)
})
test("r11 controls: real covered answers still count (tool, concept, count with a count, employer role)", () => {
  assert.equal(ret("How do you handle phishing reports?", D).matched, true)
  assert.equal(ret("What is least privilege?", D).matched, true)
  assert.equal(ret("How many privileged accounts did you onboard to the vault?", D).matched, true)
  assert.equal(ret("What did you do at Northwind Bank?", D).matched, true)
  assert.equal(ret("How do you deploy detections into the SIEM?", D).matched, true)
})
test("r11 control: a story told in other words still counts (intent words are not 'absent terms')", () => {
  const d = "At Litware I pushed back on my director's plan to skip the change review and we argued it out; I owned the outcome."
  assert.equal(retrievePassages("Tell me about a time you disagreed with your director.", sourceDocs({ resume: d })).matched, true)
})
test("r11 control: an ASR-split word still covers ('terra form' -> terraform)", () => {
  const d = "I wrote Terraform modules with guardrails for every AWS account."
  assert.equal(retrievePassages("How do you write terra form modules?", sourceDocs({ resume: d })).matched, true)
})
test("r11 flag: KOMPAS_DOSSIER_ITEMS off (default) keeps the r5 line split; on gives r8 items", async () => {
  const { splitPassages, dossierItemsOn } = await import("../../src/lib/kompasSourceRetrieval.ts")
  const prev = process.env.KOMPAS_DOSSIER_ITEMS
  try {
    delete process.env.KOMPAS_DOSSIER_ITEMS
    assert.equal(dossierItemsOn(), false)
    assert.ok(splitPassages(sourceDocs({ dossier: D })).every((p) => !p.span))
    process.env.KOMPAS_DOSSIER_ITEMS = "on"
    assert.ok(splitPassages(sourceDocs({ dossier: D })).some((p) => p.span))
  } finally { if (prev === undefined) delete process.env.KOMPAS_DOSSIER_ITEMS; else process.env.KOMPAS_DOSSIER_ITEMS = prev }
})
