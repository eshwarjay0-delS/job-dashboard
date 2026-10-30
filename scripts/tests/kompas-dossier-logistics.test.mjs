// Eshwar's rule (29 Oct 2026): dossiers and answers carry NO logistics (visa/work authorization, pay, relocation,
// current location, address, start date, on-site days). Only resume-derived personal content.
import test from "node:test"
import assert from "node:assert/strict"
import { bannedLogistics, stripLogistics, skeletonCheck, BLUEPRINT_GUIDE, BLUEPRINT_RULES } from "../../src/lib/dossierBlueprint.ts"
import { dossierHtml } from "../../src/lib/dossierPdf.ts"

const BAD = ["Do you need visa sponsorship?", "I'm authorized to work in the US.", "My salary expectation is open.", "Hourly rate: [ ___ ]",
  "I'm happy to relocate.", "Are you local to Pittsburgh?", "My current location is Dallas.", "Home address on file.",
  "My start date could be in two weeks.", "When could you start?", "Four days on-site each week.", "The role is hybrid, 3 days in office.",
  "The position is not remote.", "Are you a U.S. citizen?", "Contract length and conversion to full-time.", "| Working model | on-site |"]
const OK = ["Remediation must address the root cause.", "I validate the fix across the whole population.", "Citi Bank, Jan 2019 – June 2022.",
  "Payment systems are in scope for the control.", "I relocated the log pipeline to a new bucket.", "Start with the control objective."]

test("every logistics phrase is detected; ordinary security wording is not", () => {
  for (const t of BAD) assert.ok(bannedLogistics(t).length, t)
  for (const t of OK) assert.deepEqual(bannedLogistics(t), [], t)
})
test("stripLogistics drops the logistics line and keeps the rest", () => {
  const md = "## Fix before the call\n1. Gap after Citi: study first.\n2. On-site four days: answer yes first.\n| On-site | Pittsburgh | x |\nDone."
  const out = stripLogistics(md)
  assert.deepEqual(bannedLogistics(out), []); assert.match(out, /Gap after Citi/); assert.match(out, /Done\./)
})
test("a logistics heading takes its whole section with it", () => {
  const out = stripLogistics("## A\nkeep\n### Logistics and open items\n| Format | Teams |\n## B\nkeep2")
  assert.doesNotMatch(out, /Logistics|Teams/); assert.match(out, /keep2/)
})
test("print HTML never contains logistics; skeleton check flags them", () => {
  const r = dossierHtml({ title: "t", md: "## Evidence base\nI'm happy to relocate.\nI validate fixes.", sources: [] })
  assert.doesNotMatch(r.html, /relocate/); assert.match(r.html, /validate fixes/)
  assert.ok(skeletonCheck("## x\nWhat is your salary range?", []).logistics.length)
})
test("no prompt text asks the model for logistics, and the rules forbid them", () => {
  for (const g of Object.values(BLUEPRINT_GUIDE)) assert.deepEqual(bannedLogistics(g.replace(/No logistics[^.]*\./g, "")), [], g)
  assert.doesNotMatch(Object.values(BLUEPRINT_GUIDE).join(" "), /working model/i)
  assert.match(BLUEPRINT_RULES, /No logistics/)
})
test("#126 write-ups: logistics lines are removed and the write-up is not ok", async () => {
  const { gateWriteup } = await import("../../src/lib/dossierWriteupGate.ts")
  const r = gateWriteup("## Evidence hierarchy\nI can relocate and start date is flexible.\nI validate fixes.", { stage: "synthesis", sources: [] })
  assert.ok(r.logistics.length); assert.ok(!r.ok); assert.doesNotMatch(r.markdown, /relocate/); assert.match(r.markdown, /validate fixes/)
})

test("demo-final: hybrid identity/cloud/environment/integration is technical resume content, not logistics", async () => {
  const { stripLogistics, bannedLogistics } = await import("../../src/lib/dossierBlueprint.ts")
  for (const line of [
    "Led hybrid identity integrations with Active Directory and Entra ID.",
    "Migrated workloads to a hybrid cloud environment on AWS and Azure.",
    "Built hybrid integration between on-prem AD and Okta.",
    "Secured the hybrid environment with Conditional Access.",
    "Designed a hybrid infrastructure for PAM.",
  ]) {
    assert.deepEqual(bannedLogistics(line), [], line)
    assert.equal(stripLogistics(line), line, line)
  }
  for (const line of ["The role is hybrid, 3 days on-site in Pittsburgh.", "Eshwar is open to hybrid work.", "Hybrid work model, 2 days in office."]) {
    assert.equal(stripLogistics(line), "", line)
  }
})
