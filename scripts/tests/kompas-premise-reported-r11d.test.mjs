// r11d (29 Oct 2026, OFFLINE): closed/rotated first-person results and "your resume says you…" premises. Stricter only.
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, falsePremises } from "../../src/lib/kompasSourceRetrieval.ts"
import { applyGuards, allowedNumbers, questionFigures } from "../../src/lib/kompasGuards.ts"
const RES = "I led cloud security operations at Molina Healthcare, moving alert triage into Splunk and tuning detections with the SOC."
const DOCS = sourceDocs({ resume: RES })
// (1) a first-person closed/rotated result never borrows the question's figure
for (const [q, a] of [
  ["I heard you closed incidents 70 percent. How?", "I closed incidents 70 percent at Molina."],
  ["I heard you rotated incidents 70 percent. How?", "I rotated incidents 70 percent at Molina."],
  ["You close incidents 70 percent faster?", "We close incidents 70 percent faster now."],
  ["Closes 70 percent of tickets?", "My team closes 70 percent of tickets in a day."],
  ["Closing 70 percent of tickets?", "I was closing 70 percent of tickets weekly."],
  ["Rotate 70 percent of keys?", "We rotate 70 percent of keys monthly."],
  ["Rotates 70 percent of keys?", "My team rotates 70 percent of keys monthly."],
  ["Rotating 70 percent of keys?", "I was rotating 70 percent of keys monthly."],
]) test(`guard drops borrowed figure: ${a}`, () => assert.doesNotMatch(applyGuards(a, null, allowedNumbers(RES), questionFigures(q)).text, /70/))
test("control: sourced figure the question quotes is still spoken", () => {
  const src = RES + " Closed incidents 70% faster at Molina."
  assert.match(applyGuards("I closed incidents 70% faster at Molina.", null, allowedNumbers(src), questionFigures("You closed incidents 70% faster, right?")).text, /70%/)
})
// (2) reported premises
const caught = [
  "Your resume says you closed incidents 70 percent. How?", "Your resume says you cut incidents 70 percent. How?",
  "Your resume says you reduced incidents by 70%. How?", "Your resume says you rotated keys across 300 servers. How?",
  "Your LinkedIn says you cut incidents by 70%. How?", "I see on your resume that you reduced incidents by 70%.",
  "It says here you closed incidents 70 percent. Walk me through it.", "Your CV says you closed 400 tickets, how?",
]
for (const q of caught) test(`premise caught: ${q}`, () => assert.ok(falsePremises(q, DOCS).length > 0, q))
const SRC = sourceDocs({ resume: RES + "\nClosed incidents 70% faster at Molina by retiring noisy detections." })
for (const q of ["Your resume says you closed incidents 70% faster. How?", "I see on your resume that you closed incidents 70% faster."])
  test(`control (sourced): ${q}`, () => assert.deepEqual(falsePremises(q, SRC), [], q))
for (const q of ["Your resume says you led the SOC. Tell me more.", "It says here you led cloud security operations at Molina. How?"])
  test(`control (no figure): ${q}`, () => assert.deepEqual(falsePremises(q, DOCS), [], q))
