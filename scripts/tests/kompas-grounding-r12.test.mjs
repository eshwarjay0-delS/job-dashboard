// r12 (29 Oct 2026, OFFLINE): near-miss slot gate. A question asking for a specific slot (who, title, how many,
// money, when, outcome, which tool) is covered only when a covering passage states a value of that type in a sentence
// that shares a topic word. Cases invented from scratch (not from Voice's sets or the r12 synthetic bank).
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, retrievePassages, askedSlot } from "../../src/lib/kompasSourceRetrieval.ts"
const R = [
  "At Contoso Health I led the vulnerability management program for the hospital network.",
  "I ran weekly patch triage with a patch team of six engineers and tracked exceptions in the risk register.",
  "At Contoso Health I reported to Dana Whitfield, the CISO, and my title was Senior Security Engineer.",
  "We cut critical vulnerabilities older than 30 days by 64% in two quarters, the percentage we reported to the board.",
  "In 2021 I rolled out the Tenable scanner across 1,800 servers at Contoso Health.",
  "The scanner licence ran about $90,000 per year, which I justified to finance.",
  "At Fabrikam I built phishing triage and incident response playbooks for the security operations team.",
].join("\n")
const ret = (q) => retrievePassages(q, sourceDocs({ resume: R }))
test("r12: askedSlot classifies the asked-for value type", () => {
  assert.equal(askedSlot("Who was your manager at Fabrikam?"), "person")
  assert.equal(askedSlot("What was your job title at Fabrikam?"), "title")
  assert.equal(askedSlot("How many analysts were on the Fabrikam team?"), "count")
  assert.equal(askedSlot("What was your salary at Fabrikam?"), "money")
  assert.equal(askedSlot("When did you start at Fabrikam?"), "date")
  assert.equal(askedSlot("What percentage did phishing triage improve by?"), "outcome")
  assert.equal(askedSlot("What SIEM did the operations team run at Fabrikam?"), "tech")
  assert.equal(askedSlot("How do you build incident response playbooks?"), null)
})
test("r12: near-misses (shared words, slot never stated) are not covered", () => {
  for (const q of ["Who was your manager at Fabrikam?", "What was your job title at Fabrikam?", "How many analysts were on the security operations team at Fabrikam?",
    "What was your salary at Fabrikam?", "When did you start at Fabrikam?", "How many people were on the Contoso Health vulnerability team?", "Who was your manager at Fabrikam Bank?", "When did you join Contoso Health?", "What percentage did phishing triage improve by at Fabrikam?",
    "What SIEM did the security operations team run at Fabrikam?", "What budget did the incident response playbooks get?"])
    assert.equal(ret(q).matched, false, q)
})
test("r12 controls: the same slots stay covered when the passage states the value", () => {
  for (const q of ["Who was the CISO you reported to at Contoso Health?", "What was your title at Contoso Health?", "How many servers had the Tenable scanner at Contoso Health?", "How many engineers ran weekly patch triage?",
    "How much was the scanner licence per year?", "When did the Tenable scanner go in at Contoso Health?", "What percentage did you cut critical vulnerabilities by?",
    "How do you build incident response playbooks?", "Tell me about phishing triage at Fabrikam."])
    assert.equal(ret(q).matched, true, q)
})
test("r12 failsafe: the slot gate only ever turns covered into uncovered", () => {
  assert.equal(ret("Who was the CEO of Zorblax?").matched, false)
})
