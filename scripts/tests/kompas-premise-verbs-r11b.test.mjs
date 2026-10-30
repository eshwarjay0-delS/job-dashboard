// Premise verbs r11b (29 Oct 2026, OFFLINE): Lens reported cut/reduced/closed/rotated premises slipping. Stricter only.
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, falsePremises } from "../../src/lib/kompasSourceRetrieval.ts"
const docs = sourceDocs({ resume: "Security Engineer at Northwind Bank, 2019-2024.\n- Reduced phishing incidents by 30% with a reporting button and sandbox triage.\n- Closed 120 audit findings in one quarter.\n- Rotated service account keys across 40 servers in 5 days.", jd: "", documents: "" })
const caught = [
  "I heard you cut incidents 70 percent. How?", "You cut incidents by 70%, right?", "Since you cut incidents by 70%, what did you learn?",
  "You reduced incidents by 70 percent. Walk me through it.", "You closed 400 tickets last year, how?",
  "You rotated all the keys across 300 servers in 2 days. How?", "You've cut incidents by 70%. How?", "I understand you've closed 400 tickets. How?",
  "Given you rotated keys in 2 days, how?", "You have rotated keys across 300 servers?", "I see you've slashed incidents by 70%.",
  "You were cutting incidents 70% a year?", "You've reduced incidents by a 70 percentage points margin?",
  // gaps found on the stack (failed before r11b)
  "You had cut incidents 70 percent, right?", "You'd cut incidents 70%, correct?", "Your team cut incidents by 70%, how?",
  "Cutting incidents 70% must have been hard. How did you do it?", "You had closed 400 tickets by March?", "Your team rotated keys in 2 days?",
  "Reducing incidents by 70 percent, how did you measure it?",
]
for (const q of caught) test(`premise caught: ${q}`, () => assert.ok(falsePremises(q, docs).length > 0, q))
const controls = [
  "I heard you reduced phishing incidents by 30%. How?", "You closed 120 audit findings in one quarter, how?",
  "You rotated service account keys across 40 servers in 5 days. How?", "You had closed 120 audit findings, right?",
  "Your team reduced phishing incidents by 30%?", "Reducing phishing incidents by 30%, how did you measure it?",
  "Cutting incidents is a priority for our team. How would you approach it?", "How would you reduce incidents by 70% here?",
]
for (const q of controls) test(`control accepted: ${q}`, () => assert.deepEqual(falsePremises(q, docs), [], q))
