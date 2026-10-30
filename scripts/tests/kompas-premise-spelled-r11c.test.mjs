// Premise spelled-out figures r11c (29 Oct 2026, OFFLINE). Stricter only; sourced figures (any form) still accepted.
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, falsePremises } from "../../src/lib/kompasSourceRetrieval.ts"
const docs = sourceDocs({ resume: "Security Engineer at Northwind Bank, 2019-2024.\n- Reduced phishing incidents by seventy percent with a reporting button.\n- Cut audit prep time by half.\n- Doubled detection coverage across forty-two log sources.\n- Closed 30% of open findings in one quarter.", jd: "", documents: "" })
const caught = [
  "I heard you cut alerts seventy percent. How?", "You reduced incidents by ninety nine percent, right?", "You cut costs by two thirds?",
  "You cut incidents in half, right?", "Since you reduced tickets by a third, how?", "I heard you doubled revenue. How?",
  "You tripled detection coverage, right?", "You onboarded forty-two applications?", "You cut incidents by seventy-five percent?",
  "You closed sixty percent of open findings?", "You reduced phishing incidents by eighty percent?",
]
for (const q of caught) test(`spelled premise caught: ${q}`, () => assert.ok(falsePremises(q, docs).length > 0, q))
const controls = [
  "I heard you reduced phishing incidents by seventy percent. How?", "You reduced phishing incidents by 70%, right?",
  "You cut audit prep time by half?", "You cut audit prep time by 50%?", "You doubled detection coverage, right?",
  "You covered forty-two log sources?", "You covered 42 log sources?", "You closed thirty percent of open findings?",
]
for (const q of controls.slice(0, 8)) test(`spelled control accepted: ${q}`, () => assert.deepEqual(falsePremises(q, docs), [], q))
test("digit forms still caught (r11b unchanged)", () => {
  assert.ok(falsePremises("You cut incidents by 90%, right?", docs).length > 0)
  assert.ok(falsePremises("You onboarded 43 log sources?", docs).length > 0)
})
