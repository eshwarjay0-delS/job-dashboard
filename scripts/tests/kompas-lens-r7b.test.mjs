// Lens r7b (29 Oct 2026, Chief decisions a/b and opener honesty). Offline. Written before the code.
import test from "node:test"
import assert from "node:assert/strict"
import * as O from "../../src/lib/kompasOpener.ts"

const PROPER = ["SOC", "Splunk", "AWS", "SailPoint", "SIEM", "IAM", "Boeing", "Okta", "Azure", "CrowdStrike", "Sentinel", "Python", "Terraform", "Kubernetes", "Cisco", "Microsoft", "Linux", "Workday", "ServiceNow", "Fortinet"]

test("(a) a proper noun or acronym first word is never lowercased, whatever the lead-in", () => {
  for (const w of PROPER) for (const leadIn of O.LEAD_INS) {
    const o = { text: `${w} detections tuned for the cloud team.`, leadIn }
    const d = O.displayOpener(o)
    assert.ok(d.includes(`${w} detections`), `${leadIn}|${d}`)
  }
})
test("(a) leadInFor gives no lead-in to a bullet that opens with a proper noun, so nothing can lowercase it", () => {
  assert.equal(O.leadInFor("Boeing avionics testing for the 787 program."), "")
})
test("(a) a common first word is still lowercased on screen and voice", () => {
  assert.equal(O.displayOpener({ text: "Built Splunk detections.", leadIn: O.LEAD_INS[0] }), "In one of my roles, I built Splunk detections.")
})
test("(a) display falls back to the raw text when the guard check on text fails, or the display is unsafe", () => {
  const o = { text: "Built Splunk detections.", leadIn: O.LEAD_INS[0] }
  assert.equal(O.shownOpener(o, true), "In one of my roles, I built Splunk detections.")
  assert.equal(O.shownOpener(o, false), "Built Splunk detections.")
  assert.equal(O.shownOpener({ ...o, leadIn: "At Globex in 2015 I " }, true), "Built Splunk detections.")
})
test("(b) no present-tense role lead-in unless the resume marks the role current", () => {
  const b = "Manage IAM access reviews for 2,000 users."
  assert.equal(O.leadInFor(b), "In one of my roles, I would ")
  assert.equal(O.leadInFor(b, { current: true }), "In my work, I ")
  const { table } = O.buildOpenerTable([{ id: "r1", sourceDoc: "resume", category: "experience-story", text: b, status: "sourced" }], { resume: b })
  assert.equal(table["experience-story"][0].leadIn, "In one of my roles, I would ")
  const cur = O.buildOpenerTable([{ id: "r1", sourceDoc: "resume", category: "experience-story", text: b, status: "sourced", current: true }], { resume: b }).table
  assert.equal(cur["experience-story"][0].leadIn, "In my work, I ")
  assert.equal(O.displayOpener(table["experience-story"][0]), "In one of my roles, I would manage IAM access reviews for 2,000 users.")
})
test("(b) the exact new LEAD_INS list (AQ's drift test compares it)", () => {
  assert.deepEqual([...O.LEAD_INS], ["In one of my roles, I ", "In my work, I ", "My work has involved ", "My work has included ", "In one of my roles, I was ", "I am ", "I have ", "In one of my roles, I would "])
  for (const l of O.LEAD_INS) assert.doesNotMatch(l, /\d|\b(?:at|for) [A-Z]/)
})
test("(4) the opener fires only for a guard-approved passage; a not-covered question gets none", () => {
  const items = [["r1", "Built Splunk detections for AWS CloudTrail findings."], ["r2", "Led the Okta SSO rollout for 3 business units."]]
  const src = items.map((x) => x[1]).join("\n")
  const { table } = O.buildOpenerTable(items.map(([id, text]) => ({ id, sourceDoc: "resume", category: "experience-story", text, status: "sourced" })), { resume: src })
  const NOT_COVERED = ["Tell me about a time you used Kubernetes.", "Tell me about a time you ran a red team.", "Tell me about your time at Google.",
    "Tell me about a time you led a SOX audit.", "Tell me about a time you managed a budget.", "Walk me through a time you built a data lake.",
    "Tell me about a time you used Terraform.", "Tell me about a time you migrated to GCP."]
  for (const q of NOT_COVERED) {
    assert.equal(O.pickOpener(table, q, null, 200), null, `no match: ${q}`)
    assert.equal(O.pickOpener(table, q, { passages: [] }, 200), null, `empty match: ${q}`)
    assert.equal(O.pickOpener(table, q, { passages: [{ id: "jd-3" }] }, 200), null, `other passage: ${q}`)
  }
  const q = "Tell me about a time you used Splunk."
  assert.equal(O.pickOpener(table, q, { passages: [{ id: "r1" }] }, 200, () => false), null, "guard refused the passage")
  assert.equal(O.pickOpener(table, q, { passages: [{ id: "r1" }] }, 200, (o) => o.sourceId === "r1")?.sourceId, "r1")
  assert.equal(O.pickOpener(table, q, { passages: [{ id: "r1" }] }, 200)?.sourceId, "r1")
})
