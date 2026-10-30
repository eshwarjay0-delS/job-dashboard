// Kompas baseline answer-regression gate (OFFLINE, no network, no model calls, no npm install needed).
// Owner, 30 Oct 2026 9:01 AM CT: "make it build consistent version, even with future updates. This should be the
// baseline and should not have any disruptions at all."
//
// Every expected value below was produced by running the repo's own functions on the baseline code and then
// read by a person to confirm it is the right behavior. Nothing here is invented. If a future change moves one of
// these values ON PURPOSE, update the case in the same PR and say why in the commit message; otherwise the PR is a
// regression and must not reach master. Cases where today's behavior looks wrong are NOT asserted; they are listed
// in comments marked "LOOKS WRONG (not asserted)" so they stay visible without locking the bug in.
//
// Run: npm run test:baseline   (CI: .github/workflows/kompas-baseline-gate.yml, every push and PR to master)
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { personalLogistics, withoutLogistics, interviewIntent, focusPlan } from "../../src/lib/kompasRelevance.ts"
import { logisticsBackstop } from "../../src/lib/kompasLogistics.ts"
import { dissectQuestion, draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
import { sourceDocs, falsePremises } from "../../src/lib/kompasSourceRetrieval.ts"
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts"
import { loadDesktopCut } from "../kompas-cut-stress.mjs"
import { loadIntake } from "../kompas-intake-slice.mjs"

// The page (public/kompas/app.js) keeps its own copy of the logistics rule; load it the same way
// kompas-logistics-available.test.mjs does so server and page are checked together.
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const pa = app.indexOf("// personal-logistics parity: start"), pb = app.indexOf("// personal-logistics parity: end")
const page = {}; vm.createContext(page); vm.runInContext(app.slice(pa, pb) + "\nthis.p = personalLogistics;", page)

// The exact pipeline the answer service runs (src/lib/kompasAnswerService.ts: stripLogistics):
// the clause helper first, then the server backstop. "" means Kompas stays silent.
const served = (q) => logisticsBackstop(withoutLogistics(q))

// ---------------------------------------------------------------------------------------------------------------
// 1. Logistics: SKIP (Kompas stays silent). Owner rule 29 Oct 11:26 PM CT + "are you available" (3993296).
const SKIP = [
  "Are you available?",
  "Are you currently available?",
  "Are you available next week?",
  "Are you available to start next month?",
  "What is your availability?",
  "When can you start?",
  "We hire quickly. When could you start?",
  "What is your notice period?",
  "Do you need visa sponsorship?",
  "Are you authorized to work in the US?",
  "Are you a US citizen?",
  "What are your salary expectations?",
  "What is your current location?",
  "Where are you based?",
  "What is your home address?",
  "Are you open to relocation?",
  "Would you relocate for this role?",
  "Are you open to hybrid?", // server backstop only (page shows it; see parity note below)
]
for (const q of SKIP) test(`logistics skipped: ${q}`, () => assert.equal(served(q), "", q))

// Page parity: the page's copy of personalLogistics agrees with the server's on the owner's list.
// "Are you open to hybrid?" is deliberately outside the owner's list on the page (hybrid/remote/travel are left to the
// server backstop), so it is excluded here.
for (const q of SKIP.filter((q) => !/hybrid/.test(q))) {
  test(`page and server agree it is personal logistics: ${q}`, () => {
    assert.equal(personalLogistics(q), true, "server: " + q)
    assert.equal(page.p(q), true, "page: " + q)
  })
}

// 2. Logistics: KEEP (technical or resume history; must still be answered, unchanged).
const KEEP = [
  "How do you design for high availability?",
  "Are availability zones in AWS useful for HA?",
  "How did you keep the Vault available during failover?",
  "Is the PSM server available in both zones?",
  "How do you manage IP address allocation?",
  "How would you relocate the data center workloads to Azure?",
  "How did you handle the relocation of servers?",
  "What was your start date at Citi?",
  "How does work authorization work for contractors?",
  "Explain your experience with CyberArk",
  "Tell me about yourself.",
]
for (const q of KEEP) {
  test(`kept and answered unchanged: ${q}`, () => {
    assert.equal(served(q), q, q)
    assert.equal(page.p(q), false, "page: " + q)
  })
}
// LOOKS WRONG (not asserted): interviewIntent() labels "How would you relocate the data center workloads to Azure?"
// and "How did you handle the relocation of servers?" as "logistics" (they are technical). They are still answered,
// because the skip needs personalLogistics(), but the intent label feeds the focus band and tangent checks.

// 3. Mixed asks keep the non-logistics half.
const MIXED = [
  ["Tell me about Okta and what is your notice period?", "Tell me about Okta"],
  ["What is your notice period and how did you deploy Okta?", "how did you deploy Okta?"],
]
for (const [q, want] of MIXED) test(`mixed ask keeps only the technical half: ${q}`, () => assert.equal(served(q), want))

// ---------------------------------------------------------------------------------------------------------------
// 4. Explain-length caps (spoken word targets per mode, and the focus ceiling at tier 2 engineer).
// Values are the dissected band that sets spoken length in kompasAnswerService ("plan.words = ... band.targetWords").
const band = (q) => { const c = dissectQuestion(q); return [c.intent, c.modes.engineer.targetWords, c.modes.director.targetWords, c.modes.architect.targetWords, focusPlan(q, 2, "engineer").maxWords] }
const CAPS = [
  ["What is MFA?", ["definition", 40, 60, 90, 75]],
  ["What is your biggest strength?", ["direct", 44, 66, 99, 115]],
  ["Do you use Splunk?", ["direct", 44, 66, 99, 115]],
  ["Do you have experience with CyberArk?", ["direct", 44, 66, 99, 115]],
  ["Briefly describe your experience with threat modeling.", ["direct", 44, 66, 99, 115]],
  ["What is the difference between IDS and IPS?", ["comparison", 46, 70, 105, 100]],
  ["Explain how SAML works", ["technical-process", 96, 144, 216, 215]],
  ["Describe a project where you reduced alert noise.", ["experience-story", 110, 165, 248, 170]],
  ["Tell me about yourself.", ["introduction", 90, 135, 204, 175]],
]
for (const [q, want] of CAPS) test(`length band locked: ${q}`, () => assert.deepEqual(band(q), want))
test("explicit one-sentence ask stays short", () => {
  const [intent, e] = band("In one sentence, explain your experience with SIEM tuning.")
  assert.notEqual(intent, "experience-story")
  assert.ok(e <= 44, String(e))
  // LOOKS WRONG (not asserted): it is labelled "acknowledgement" (18/28/42 words). Short is right; the label is odd.
})

// Explain-your-experience asks get the full experience band (explain-length fix 40eec8d, 30 Oct 2026, 9:00 AM CT).
const EXPLAIN = [
  ["Can you explain your experience with threat modeling?", ["experience-story", 110, 165, 248, 170]],
  ["Explain your experience with SIEM tuning", ["experience-story", 110, 165, 248, 170]],
  ["Walk me through your experience with cloud security", ["experience-story", 110, 165, 248, 210]],
  ["Tell me about your experience with incident response", ["experience-story", 110, 165, 248, 170]],
]
for (const [q, want] of EXPLAIN) {
  test(`explain-your-experience gets the full band: ${q}`, () => assert.deepEqual(band(q), want))
}

// ---------------------------------------------------------------------------------------------------------------
// 5. Honesty and premise gates. Fixture text is the one used by kompas-premise-verbs-r11b.test.mjs and
// kompas-explain-length.test.mjs.
const docs = sourceDocs({ resume: "Security Engineer at Northwind Bank, 2019-2024.\n- Reduced phishing incidents by 30% with a reporting button and sandbox triage.\n- Closed 120 audit findings in one quarter.\n- Rotated service account keys across 40 servers in 5 days.", jd: "", documents: "" })
const FALSE_PREMISE = [
  ["I heard you cut incidents 70 percent. How?", ["70%"]],
  ["You closed 400 tickets last year, how?", ["400"]],
  ["You led a team of 50 engineers at Northwind, right?", ["50"]],
]
for (const [q, want] of FALSE_PREMISE) test(`false premise caught: ${q}`, () => assert.deepEqual(falsePremises(q, docs), want))
const TRUE_PREMISE = [
  "I heard you reduced phishing incidents by 30%. How?",
  "You closed 120 audit findings in one quarter, how?",
  "How would you reduce incidents by 70% here?",
]
for (const q of TRUE_PREMISE) test(`true premise accepted: ${q}`, () => assert.deepEqual(falsePremises(q, docs), []))

const HIT = "# Sam Example\n## Experience\n### GRC Analyst — Hitachi Vantara — 2021 to 2024\n- Mapped 300 controls to NIST 800-53 for the FedRAMP Moderate package.\n- Ran quarterly access reviews for 40 applications with the control owners.\n"
for (const q of ["Tell me about your experience at Google.", "Tell me about your experience with incident response at Google."]) {
  test(`employer the resume lacks gets the honest line: ${q}`, () => {
    for (const level of ["engineer", "architect", "director"]) assert.match(draftSpokenAnswer(q, level, HIT), /does not show/, level)
  })
}
test("employer the resume has uses its real facts and no honest-gap line", () => {
  const a = draftSpokenAnswer("Tell me about your experience at Hitachi Vantara.", "director", HIT)
  assert.doesNotMatch(a, /does not show/)
  assert.match(a, /300 controls/)
  for (const n of a.match(/\b\d[\d,.]*\b/g) || []) assert.ok(HIT.includes(n.replace(/[.,]$/, "")), "invented figure " + n)
})

// ---------------------------------------------------------------------------------------------------------------
// 6. Question detection: the page's turn gate and the card split (server and page must agree).
const { api } = loadIntake()
const desktopSplit = loadDesktopCut()
const GATE = [
  ["What is Kerberos?", "answer", "question"],
  ["so the next one what is a SIEM", "answer", "question"],
  ["What I want to understand is your PAM experience.", "answer", "question"],
  ["Can you hear me? What is PAM?", "answer", "question"],
  ["What is the difference between SSO and SAML?", "answer", "question"],
  ["Can you hear me?", "skip", "audio-check"],
  ["Can you hear me okay?", "skip", "audio-check"],
  ["Am I on mute?", "skip", "audio-check"],
  ["Okay great.", "skip", "filler"],
  ["Thanks, that makes sense.", "skip", "closing"],
  ["What we use is Okta and Zscaler.", "skip", "statement-not-ask"],
  ["So my next question is around identity governance.", "wait", "ask-announced"],
  ["We use Splunk here.", "wait", "no-ask-yet"],
  ["um so yeah", "wait", "no-ask-yet"],
]
for (const [q, outcome, reason] of GATE) {
  test(`turn gate: ${q} -> ${outcome} (${reason})`, () => {
    const g = api.turnGate(q)
    assert.equal(g.outcome, outcome)
    assert.equal(g.reason, reason)
  })
}
// LOOKS WRONG (not asserted): an unpunctuated full question such as "How would you handle a phishing incident" or
// "explain your experience with cyberark" returns "wait" (clause-open). It is probably answered once the speaker
// pauses, but that path is timing-based and not covered offline here.
const CARDS = [
  ["What is CyberArk? What is Okta?", 2],
  ["Tell me about yourself. Why do you want this job? Where do you see yourself in five years?", 3],
  ["What is Kerberos? And how does NTLM differ?", 2],
  ["Tell me about Zscaler and why did you choose it?", 1],
  ["What is the difference between SSO and SAML?", 1],
  ["Can you hear me? What is PAM? Let me repeat. What is PAM?", 1],
]
for (const [q, n] of CARDS) {
  test(`answer cards: ${q} -> ${n}`, () => {
    const server = splitDistinctAsks(q)
    assert.equal(server.length, n)
    assert.equal(JSON.stringify(desktopSplit(q)), JSON.stringify(server), "page and server differ")
  })
}

// Self-check: the gate itself must keep enough coverage that it cannot be hollowed out unnoticed.
test("gate keeps its coverage", () => {
  assert.ok(SKIP.length >= 18 && KEEP.length >= 11 && CAPS.length >= 9 && EXPLAIN.length >= 4)
  assert.ok(FALSE_PREMISE.length >= 3 && TRUE_PREMISE.length >= 3 && GATE.length >= 14 && CARDS.length >= 6)
})
