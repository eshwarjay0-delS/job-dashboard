// Lens r6 (29 Oct 2026). OFFLINE. Display string for the opener (first letter of the bullet lowercased after a lead-in,
// screen and TTS only), natural noun-phrase lead-ins, hunt r6.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { LEAD_INS, leadInFor, spokenOpener, displayOpener, isSafeDisplay, buildOpenerTable } from "../../src/lib/kompasOpener.ts"
import { approveSourcedOpener } from "../../src/lib/kompasSentenceGate.ts"
import { questionFigures } from "../../src/lib/kompasGuards.ts"
import { extractClaims } from "../../src/lib/kompasSourceRetrieval.ts"

const BULLETS = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-lens-r5-bullets.json", import.meta.url), "utf8"))

test("r6 display: lead-in + bullet with only its first letter lowercased; text stays exact for the guard", () => {
  const o = { text: "Built Splunk detections for privileged account misuse.", leadIn: "In one of my roles, I " }
  assert.equal(displayOpener(o), "In one of my roles, I built Splunk detections for privileged account misuse.")
  assert.equal(spokenOpener(o), "In one of my roles, I Built Splunk detections for privileged account misuse.")
  assert.equal(isSafeDisplay(o, displayOpener(o)), true)
  const passages = [{ id: "r:1", proves: "experience", line: o.text, text: o.text }]
  assert.equal(approveSourcedOpener({ ...o, sourceId: "r:1", category: "experience-story", verbatim: true }, passages), true)
})

test("r6 display: acronyms, product names and no-lead-in bullets keep their case", () => {
  assert.equal(displayOpener({ text: "AWS security reviews for every new account.", leadIn: "My work has included " }), "My work has included AWS security reviews for every new account.")
  assert.equal(displayOpener({ text: "SailPoint access reviews each quarter.", leadIn: "My work has included " }), "My work has included SailPoint access reviews each quarter.")
  assert.equal(displayOpener({ text: "I led the migration.", leadIn: "" }), "I led the migration.")
  assert.equal(displayOpener(null), "")
})

test("r6 display safety: anything other than the one-letter change or an unknown lead-in is refused", () => {
  const o = { text: "Built Splunk detections.", leadIn: "In one of my roles, I " }
  assert.equal(isSafeDisplay(o, "In one of my roles, I built Splunk detections."), true)
  assert.equal(isSafeDisplay(o, "In one of my roles, I built splunk detections."), false)
  assert.equal(isSafeDisplay(o, "In one of my roles, I built Splunk detections at Google."), false)
  assert.equal(isSafeDisplay({ ...o, leadIn: "At Google, I " }, "At Google, I built Splunk detections."), false)
  for (const { text } of BULLETS) {
    const b = { text, leadIn: leadInFor(text) }
    const d = displayOpener(b)
    assert.ok(isSafeDisplay(b, d), text)
    assert.equal(d.slice(b.leadIn.length).slice(1), text.slice(1), "only the first letter may differ")
    assert.equal(d.toLowerCase(), spokenOpener(b).toLowerCase())
  }
})

test("r6 noun-phrase lead-ins: no 'From my background', natural wording, no facts added", () => {
  assert.ok(!LEAD_INS.includes("From my background: "))
  const cases = [
    ["Experience deploying and managing serverless architectures on AWS Lambda.", "I have experience deploying and managing serverless architectures on AWS Lambda."],
    ["Expertise in Remedy Force, CMDB, and Change Management end-to-end implementation.", "I have expertise in Remedy Force, CMDB, and Change Management end-to-end implementation."],
    ["Hands-on experience using industry-standard security tools including Burp Suite.", "I have hands-on experience using industry-standard security tools including Burp Suite."],
    ["Creation and customization of Catalog items, with defined workflows.", "My work has included creation and customization of Catalog items, with defined workflows."],
  ]
  for (const [b, want] of cases) assert.equal(displayOpener({ text: b, leadIn: leadInFor(b) }), want, b)
  // A job title as the bullet's start is not a sentence a lead-in can fix.
  assert.equal(leadInFor("Hands-on AI Cloud Engineer with strong expertise in Terraform."), "")
  for (const l of LEAD_INS) {
    assert.doesNotMatch(l, /\d/)
    assert.equal(questionFigures(l).size, 0)
    assert.equal(extractClaims(l).length, 0)
  }
})

test("r6 table: openers carry display; the share still counts the lead-in", () => {
  const SRC = { resume: "Built Splunk detections for privileged account misuse." }
  const { table } = buildOpenerTable([{ id: "r:1", sourceDoc: "resume", category: "experience-story", text: SRC.resume, status: "sourced" }], SRC)
  assert.equal(displayOpener(table["experience-story"][0]), "In one of my roles, I built Splunk detections for privileged account misuse.")
})

// ---------- hunt r6 (failures added here before the fix) ----------
import { HUNT6 } from "../kompas-lens-hunt-r6.mjs"
import { openerCategory } from "../../src/lib/kompasOpener.ts"
import { explainModesAsked } from "../../src/lib/kompasDesktopResponse.ts"
import { depthFor } from "../../src/lib/kompasAudience.ts"
for (const [k, f] of [["story", (q) => openerCategory(q) === "experience-story"], ["explain", explainModesAsked], ["depth", depthFor]]) {
  test(`hunt r6: ${k} on 200 questions (audience x depth, 3-deep chains, pushback, no-source asks)`, () => {
    assert.equal(HUNT6.length, 200)
    assert.deepEqual(HUNT6.filter((h) => f(h.q) !== h[k]).map((h) => h.q), [])
  })
}
