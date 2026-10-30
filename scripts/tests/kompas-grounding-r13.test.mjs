// r13 (29 Oct 2026, OFFLINE): (A) covered asks are no longer lost when the asker uses another inflection or a
// same-meaning form of a source word (roll out/rolled out/rollout/deploy, percent/percentage/%, plural/tense,
// split words like "sign off", cost/spend/price/budget only for money or slot-free asks); each loosening has a
// near-miss that must stay uncovered. (B) new asked-slot forms: team size, pay rate, contract end, engagement length,
// review findings, who signed off. Cases invented from scratch (not from Voice's sets or the r12/r13 synthetic banks).
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, retrievePassages, askedSlot } from "../../src/lib/kompasSourceRetrieval.ts"
const R = [
  "At Contoso Health I led the vulnerability management program for the hospital network.",
  "In 2021 I rolled out the Tenable scanner across 1,800 servers at Contoso Health.",
  "The scanner licence ran about $90,000 per year, which I justified to finance.",
  "The Okta rollout reached 3,000 clinicians in two waves.",
  "I led hardening of 400 Linux hosts against the CIS benchmark.",
  "Phishing click rates fell 12 percent after the awareness training.",
  "Exceptions needed CISO sign-off before closure.",
  "I kept phishing triage separate from incident response so analysts were not context switching.",
  "At Contoso Health I ran a team of five analysts on the night shift.",
  "My contract at Contoso Health ended in March 2023.",
  "The Contoso Health engagement lasted eighteen months.",
  "The 2022 access review at Contoso Health found 140 orphaned accounts.",
  "Remediation at Contoso Health was signed off by Priya Raman, the CISO.",
  "At Contoso Health I billed a day rate of $850.",
  "At Fabrikam I built phishing triage and incident response playbooks for the security operations team.",
  "At Fabrikam I ran the quarterly access review and remediation tracking for the security operations team.",
].join("\n")
const ret = (q) => retrievePassages(q, sourceDocs({ resume: R }))
const covered = (qs) => { for (const q of qs) assert.equal(ret(q).matched, true, q) }
const uncovered = (qs) => { for (const q of qs) assert.equal(ret(q).matched, false, q) }

test("r13 A: another inflection or form of a source word still covers the ask", () => covered([
  "How did you roll out the Tenable scanner?",               // rolled out
  "How did the Okta roll out go with clinicians?",           // rollout (speech split)
  "How did you deploy the Tenable scanner across servers?",  // rolled out ~ deploy
  "How do you harden Linux hosts?",                          // hardening
  "What percentage did phishing click rates fall by?",       // percent
  "What do you spend on the scanner licence each year?",     // money form, $ stated
  "How do you get CISO sign off on exceptions?",             // sign-off (speech split)
  "Tell me about the vulnerability management programme.",  // program
  "How do you keep phishing triage apart from incident response?", // filler word
]))
test("r13 A controls: the same folds never turn a near-miss covered", () => uncovered([
  "In what year did you roll out Okta?",                      // no year by the Okta rollout
  "When did the Okta roll out finish at Contoso Health?",
  "How many Windows servers did you harden?",                 // windows never stated
  "What percentage of phishing reports were false positives?",
  "How much did phishing triage cost at Fabrikam?",           // money slot, no amount
  "What budget did the awareness training have?",
  "What did you spend on Kerberoasting detection?",
  "How do you keep phishing triage apart from Kerberoasting detection?",
  "What was the vulnerability management programme budget?",
]))
test("r13 B: askedSlot reads the new question forms", () => {
  assert.equal(askedSlot("How big was the team you ran at Fabrikam?"), "count")
  assert.equal(askedSlot("What size was your team at Fabrikam?"), "count")
  assert.equal(askedSlot("How large a team did you lead at Fabrikam?"), "count")
  assert.equal(askedSlot("What hourly rate did you bill at Fabrikam?"), "money")
  assert.equal(askedSlot("What day rate were you on at Fabrikam?"), "money")
  assert.equal(askedSlot("What rate did Fabrikam pay you?"), "money")
  assert.equal(askedSlot("When did your contract at Fabrikam end?"), "date")
  assert.equal(askedSlot("What was the end date of your Fabrikam contract?"), "date")
  assert.equal(askedSlot("How long was your engagement at Fabrikam?"), "duration")
  assert.equal(askedSlot("How long did the Fabrikam engagement last?"), "duration")
  assert.equal(askedSlot("What did the access review at Fabrikam find?"), "findings")
  assert.equal(askedSlot("What were the findings of the audit at Fabrikam?"), "findings")
  assert.equal(askedSlot("Who signed off on the remediation at Fabrikam?"), "signoff")
  assert.equal(askedSlot("Who approved the access changes at Fabrikam?"), "signoff")
  // not slot asks
  assert.equal(askedSlot("What rate of rotations per hour do you plan for?"), null)
  assert.equal(askedSlot("How long would you give a new analyst to ramp up?"), null)
})
test("r13 B near-misses: new forms, value never stated for that employer", () => uncovered([
  "How big was the team you ran at Fabrikam?", "What size was your team at Fabrikam?", "How large a team did you lead at Fabrikam?",
  "How many direct reports did you have at Fabrikam?", "What hourly rate did you bill at Fabrikam?", "What day rate were you on at Fabrikam?",
  "What rate did Fabrikam pay you?", "When did your contract at Fabrikam end?", "What was the end date of your Fabrikam contract?",
  "When did your contract at Contoso Health start?", "How long was your engagement at Fabrikam?", "How long did the Fabrikam engagement last?",
  "What did the access review at Fabrikam find?", "What were the findings of the audit at Fabrikam?", "What came out of the Fabrikam access review?",
  "Who signed off on the remediation at Fabrikam?", "Who approved the access changes at Fabrikam?", "Whose sign-off did the Fabrikam playbooks need?",
  "How big was the patch team at Fabrikam?", "How long was the Okta rollout engagement?",
]))
test("r13 B covered: the same forms stay covered when the value is stated", () => covered([
  "How big was the team you ran at Contoso Health?", "What size was your night shift team at Contoso Health?",
  "What day rate did you bill at Contoso Health?", "When did your Contoso Health contract end?",
  "How long was your engagement at Contoso Health?", "What did the 2022 access review at Contoso Health find?",
  "Who signed off on the remediation at Contoso Health?", "Who had to sign off on exceptions?",
  "How many servers got the Tenable scanner?", "What rate did phishing clicks fall by?",
]))
test("r13 failsafe: unknown asks stay uncovered", () => uncovered(["Who signed off on the Zorblax merger?", "How long was your engagement at Zorblax?"]))
