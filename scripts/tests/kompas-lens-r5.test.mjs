// Lens r5 (29 Oct 2026). OFFLINE. Spoken lead-in for verbatim resume-bullet openers: a pure prefix from a fixed list,
// added only when the bullet's shape needs one; the cited bullet stays an exact substring of what is spoken.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { LEAD_INS, leadInFor, spokenOpener, buildOpenerTable, pickOpener, openerPrompt, withoutOpenerRepeat, OPENER_SHARE } from "../../src/lib/kompasOpener.ts"
import { approveSourcedOpener, withOpener } from "../../src/lib/kompasSentenceGate.ts"
import { questionFigures } from "../../src/lib/kompasGuards.ts"
import { extractClaims } from "../../src/lib/kompasSourceRetrieval.ts"

const BULLETS = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-lens-r5-bullets.json", import.meta.url), "utf8"))
const words = (s) => s.split(/\s+/).filter(Boolean).length
const PAST = "In one of my roles, I ", BASE = "In one of my roles, I would " /* r7 relabel (decision b): was "In my work, I "; present tense only for a current role, else habitual past */, ING = "My work has involved ", NOUN_ACT = "My work has included ", NOUN_SKILL = "I have " /* r6 relabel: From my background: retired */, WAS = "In one of my roles, I was ", AM = "I am "

// Labels written before the code (shape -> lead-in).
const LABELS = [
  ["Led digital forensic investigations involving payment fraud and insider threats, acquiring and analyzing evidence using EnCase and FTK.", PAST],
  ["Built Splunk detections for privileged account misuse.", PAST],
  ["Designed, implemented, and supported enterprise IAM and IGA solutions.", PAST],
  ["Continuously monitored endpoints using OSQuery and Splunk to strengthen detection.", PAST],
  ["Cut costs via EC2/EKS right-sizing and gp3 volumes.", PAST],
  ["Wrote Bash scripts for system recovery and automated restoration from backups.", PAST],
  ["Administer and support Linux and Windows systems running critical enterprise workloads.", BASE],
  ["Troubleshooting and resolving issues related to the ServiceNow platform.", ING],
  ["Preparing Implementation Plan for every release in ServiceNow.", ING],
  ["Creation and customization of Catalog items, with defined workflows.", NOUN_ACT],
  ["Experience deploying and managing serverless architectures on AWS Lambda.", NOUN_SKILL],
  ["Responsible for creating homepages including basic Reporting.", WAS],
  ["Proficient in designing and implementing robust ETL pipelines using SQL.", AM],
  ["I led the migration of detections to the new SIEM.", ""],
  ["My team built the key rotation runbook.", ""],
  ["Develops systems integrations and process automation.", ""],
  ["Having 10+ years of experience in ServiceNow development.", ""],
  ["Kubernetes, Docker, OpenShift, Zeek Script Tuning, Suricata Rule Management", ""],
  ["Detection Engineering & SIEM: Splunk-focused detection development, correlation rules.", ""],
  ["", ""],
]

test("r5 lead-in: added only when the bullet's shape needs one (past/participle/noun phrase yes; I/My no)", () => {
  for (const [b, want] of LABELS) assert.equal(leadInFor(b), want, b)
})

test("r5 lead-in: every lead-in is from the fixed list and carries no number, date, company or claim", () => {
  assert.ok(LEAD_INS.length > 0 && LEAD_INS.length <= 8)
  for (const l of LEAD_INS) {
    assert.doesNotMatch(l, /\d/, l)
    assert.doesNotMatch(l, /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\byears?\b|\bmonths?\b/i, l)
    // Only the opening word and the pronoun "I" may be capitalised: no company, product or place names.
    assert.deepEqual(l.trim().split(/\s+/).slice(1).filter((w) => /^[A-Z]/.test(w) && w !== "I"), [], l)
    assert.doesNotMatch(l, /\b(?:led|built|managed|owned|grew|reduced|increased|saved|team|company|senior|lead|award|first|best|only)\b/i, l)
    assert.equal(questionFigures(l).size, 0, l)
    assert.equal(extractClaims(l).length, 0, l)
  }
})

test(`r5 lead-in on ${BULLETS.length} real bullets from the resumes: never alters the bullet; spoken = leadIn + bullet`, () => {
  assert.ok(BULLETS.length >= 100)
  let withLead = 0
  for (const { text } of BULLETS) {
    const l = leadInFor(text)
    assert.ok(l === "" || LEAD_INS.includes(l), text)
    const s = spokenOpener({ text, leadIn: l })
    assert.equal(s, l + text)
    assert.ok(s.endsWith(text) && s.includes(text))
    if (l) withLead++
  }
  assert.ok(withLead >= 50, `only ${withLead} bullets got a lead-in`)
})

const SRC = { resume: "Built Splunk detections for privileged account misuse across the enterprise SIEM. I led the migration of detections to the new SIEM." }
const ITEMS = [
  { id: "r:1", sourceDoc: "resume", category: "experience-story", text: "Built Splunk detections for privileged account misuse across the enterprise SIEM.", status: "sourced" },
  { id: "r:2", sourceDoc: "resume", category: "introduction", text: "I led the migration of detections to the new SIEM.", status: "sourced" },
]
const { table } = buildOpenerTable(ITEMS, SRC)

test("r5 table: openers carry text (exact bullet) and a separate leadIn; AQ's exact-copy hook still approves", () => {
  const o = table["experience-story"][0]
  assert.equal(o.text, ITEMS[0].text)
  assert.equal(o.leadIn, PAST)
  assert.equal(table.introduction[0].leadIn, "")
  const passages = [{ id: "r:1", proves: "experience", line: ITEMS[0].text, text: ITEMS[0].text }]
  assert.equal(approveSourcedOpener(o, passages), true, "leadIn sits outside text, so the exact check passes")
  assert.equal(approveSourcedOpener({ ...o, text: spokenOpener(o) }, passages), false, "folding the lead-in into text must fail the exact check")
  assert.ok(spokenOpener(o).includes(passages[0].text))
  assert.equal(withOpener(`${spokenOpener(o)} Then I tuned them.`, spokenOpener(o)), `${spokenOpener(o)} Then I tuned them.`)
})

test("r5 ceiling: the 40% opener share counts the lead-in words", () => {
  const o = table["experience-story"][0]
  const q = "Tell me about a time you built detections."
  const tight = Math.ceil(words(o.text) / OPENER_SHARE) // bullet alone fits, bullet + lead-in does not
  assert.ok(words(spokenOpener(o)) > Math.floor(tight * OPENER_SHARE))
  assert.equal(pickOpener(table, q, null, tight), null)
  const roomy = Math.ceil(words(spokenOpener(o)) / OPENER_SHARE)
  assert.equal(pickOpener(table, q, { passages: [{ id: "r:1" }] }, roomy)?.sourceId, "r:1") // r7: matched passage passed explicitly
})

test("r5 empty category still gives nothing, and an empty bullet gets no lead-in", () => {
  assert.equal(pickOpener(buildOpenerTable([], SRC).table, "Tell me about a time you built detections."), null)
  assert.equal(leadInFor(""), "")
  assert.equal(spokenOpener(null), "")
})

test("r5 prompt and no-repeat use the spoken opener", () => {
  const o = table["experience-story"][0]
  assert.ok(openerPrompt(o).toLowerCase().includes(`"${spokenOpener(o)}"`.toLowerCase()) /* r6: prompt quotes the display form */)
  assert.equal(withoutOpenerRepeat(`${spokenOpener(o)} Next I tuned the noise.`, o), "Next I tuned the noise.")
})

// ---------- hunt r5 (failures added here before the fix) ----------
import { HUNT5 } from "../kompas-lens-hunt-r5.mjs"
import { openerCategory } from "../../src/lib/kompasOpener.ts"
import { explainModesAsked } from "../../src/lib/kompasDesktopResponse.ts"
import { depthFor } from "../../src/lib/kompasAudience.ts"
for (const [k, f] of [["story", (q) => openerCategory(q) === "experience-story"], ["explain", explainModesAsked], ["depth", depthFor]]) {
  test(`hunt r5: ${k} on 200 questions quoting real resume bullets and tools (premises, injections, voice)`, () => {
    assert.equal(HUNT5.length, 200)
    const wrong = HUNT5.filter((h) => f(h.q) !== h[k]).map((h) => h.q)
    assert.deepEqual(wrong, [])
  })
}
