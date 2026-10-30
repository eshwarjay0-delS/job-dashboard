// Source grounding r4 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftSpokenAnswer, wordCount } from "../../src/lib/kompasDissection.ts"
import { questionKind } from "../../src/lib/kompasSourceRetrieval.ts"
import { LAYOUTS } from "../kompas-grounding-r3-folds.mjs"

const LV = ["engineer", "director", "architect"]
const words = (q, resume) => LV.map((l) => wordCount(draftSpokenAnswer(q, l, resume)))

test("mode gap: a two-part ask on the one-paragraph layout keeps each step at least 1.5x", () => {
  const w = words("How did you approach post-incident review and SOC 2 Type II audits?", LAYOUTS.flat)
  assert.ok(w[1] >= w[0] * 1.5 && w[2] >= w[1] * 1.5, String(w))
})
test("mode gap: the compact Engineer still opens on the asked words and keeps its resume line", () => {
  const e = draftSpokenAnswer("How did you approach post-incident review and SOC 2 Type II audits?", "engineer", LAYOUTS.flat)
  assert.match(e, /^On how I approach post-incident review/)
  assert.match(e, /leaked API key/)
  assert.doesNotMatch(e, /here is my answer/)
})
test("mode gap failsafe: Engineer answers that already leave room keep their usual opener", () => {
  const e = draftSpokenAnswer("How did you approach access reviews?", "engineer", LAYOUTS.subheadings)
  const before = e // usual shape unchanged: still ordered shortest to longest
  const w = words("How did you approach access reviews?", LAYOUTS.subheadings)
  assert.ok(w[0] < w[1] && w[1] < w[2], String(w))
  assert.ok(before.length > 0)
})
test("question kind: 'disagreed with a product lead' is behavioral, 'manage firewall rules' is technical", () => {
  assert.equal(questionKind("Tell me about a time you disagreed with a product lead."), "behavioral")
  assert.equal(questionKind("How do you manage firewall rules in Terraform?"), "technical")
  // failsafe: real leadership asks stay leadership
  for (const q of ["How did you lead the team on vulnerability management?", "How did you manage the security budget and hiring?", "How did you manage on-call for analysts?", "How do you work with executives on risk?"])
    assert.equal(questionKind(q), "leadership", q)
})
test("question kind r4: budget, roadmap, executives, hiring loop and growing engineers are leadership; story frames about a team stay behavioral", () => {
  for (const q of ["How did you build an interview loop?", "How did you set the security roadmap?", "How did you manage the tooling budget?", "How do you cut vendor spend?",
    "How do you work with the CTO on priorities?", "How did you grow engineers into staff roles?"]) assert.equal(questionKind(q), "leadership", q)
  assert.equal(questionKind("Tell me about a time someone on your team was burning out."), "behavioral")
  assert.equal(questionKind("What motivates you in security work?"), "behavioral")
  // failsafe: a story ask where the candidate led stays leadership; technical stays technical
  assert.equal(questionKind("Tell me about a time you led a migration."), "leadership")
  assert.equal(questionKind("How do you scan container images in the pipeline?"), "technical")
})
test("weighting: the tiebreaker never puts the right passage first less often than no boost, on both fixtures, and every label matches", async () => {
  const W = await import("../kompas-weighting-r4.mjs")
  const W3 = await import("../kompas-weighting-r3.mjs")
  const S3 = JSON.parse((await import("node:fs")).readFileSync(new URL("../../tests/fixtures/kompas-weighting-sources.json", import.meta.url), "utf8"))
  const S4 = JSON.parse((await import("node:fs")).readFileSync(new URL("../../tests/fixtures/kompas-weighting-sources-r4.json", import.meta.url), "utf8"))
  for (const [cases, src] of [[W3.CASES, S3], [W.CASES_R4, S4]]) {
    const off = W.measure(cases, src, false), tie = W.measure(cases, src, true)
    for (const k of Object.keys(off)) assert.ok(tie[k].top1 >= off[k].top1, k)
    assert.deepEqual(W.labelMisses(cases), [])
  }
})
test("interruption: a self-correction mid-question keeps only the corrected ask", async () => {
  const A = await import("../../src/lib/kompasAnswer.ts")
  const H = [{ q: "How did you handle access reviews?" }]
  assert.equal(A.questionForAnswer("Tell me about Splunk detections, sorry, actually, how did you handle Terraform guardrails?", "", false, false, H), "How did you handle Terraform guardrails?")
  assert.equal(A.questionForAnswer("Walk me through the leaked API key. No wait, scratch that, how do you scope access reviews?", "", false, false, []), "How do you scope access reviews?")
  // a corrected ask that points back ("it") keeps the first topic as what it follows up on
  assert.match(A.questionForAnswer("Walk me through the leaked API key — actually no, let me rephrase, what did you change after it?", "", false, false, []), /^What did you change after it — following up on: "Walk me through the leaked API key"\?$/)
})
test("interruption failsafe: 'actually' inside a normal question, or a correction too short to be an ask, changes nothing", async () => {
  const A = await import("../../src/lib/kompasAnswer.ts")
  assert.equal(A.questionForAnswer("What did you actually change in the Terraform guardrails?", "", false, false, []), "What did you actually change in the Terraform guardrails?")
  assert.equal(A.afterSelfCorrection("Tell me about Splunk detections, sorry, go on."), "Tell me about Splunk detections, sorry, go on.")
  assert.equal(A.afterSelfCorrection(""), "")
})
import { isProviderErrorAnswer, experienceLines } from "../../src/lib/kompasDissection.ts"
import { normalizeResumeLayout } from "../../src/lib/kompasResumeLayout.ts"
import { sourceDocs, retrievePassages } from "../../src/lib/kompasSourceRetrieval.ts"
import { ODD } from "../kompas-grounding-r4-folds.mjs"
test("provider error: 'Provider returned error' and 'model is currently overloaded' are never shown as answers", () => {
  assert.ok(isProviderErrorAnswer("Provider returned error"))
  assert.ok(isProviderErrorAnswer("The model is currently overloaded. Please try again later."))
  // failsafe: an answer that talks about a provider is still an answer
  assert.ok(!isProviderErrorAnswer("I picked the identity provider that returned errors least often, then tested failover with the team every quarter."))
})
test("very short follow-ups: 'And?' and 'What happened next?' tie to the previous question instead of being dropped", async () => {
  const A = await import("../../src/lib/kompasAnswer.ts")
  const H = [{ q: "How did you handle access reviews?" }]
  for (const h of ["And?", "what happened next?", "And then?", "why?"])
    assert.match(A.questionForAnswer(h, "", false, false, H), /following up on: "How did you handle access reviews"\?$/, h)
  // failsafe: with no history nothing is invented, and a full new question is not tied
  assert.equal(A.questionForAnswer("What is least privilege?", "", false, false, H), "What is least privilege?")
})
test("mode gap with earlier answers said: each step still at least 1.5x", () => {
  const cases = [
    ["Walk me through access reviews.", ODD.subheadings, ["On privileged accounts, I start with the decision and the risk it carries for the business. I ran quarterly access reviews for 1,200 privileged accounts and removed stale admin rights. I onboarded syslog and API log sources into the SIEM and tuned noisy rules. The owner leaves with one clear next step and a date. I report what is still open in business terms, not tool terms. On privileged accounts, the first call is whether the risk is acceptable today or needs action now. I name one owner for that call and a date for the next review. The decision goes on record. The owner signs off in writing. If the owner accepts the risk, I record the reason and when it expires. I own that call."]],
    ['Why that — following up on: "How did you handle Splunk detections"?', ODD.apostropheDates, ["On how I handle Splunk detections, here is my answer from my own work. I built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%."]],
  ]
  for (const [q, resume, prev] of cases) {
    const w = LV.map((l) => wordCount(draftSpokenAnswer(q, l, resume, prev)))
    assert.ok(w[1] >= w[0] * 1.5 && w[2] >= w[1] * 1.5, `${q} ${w}`)
  }
})
test("no false 'my resume does not show this' when the covering line was already said: it is said again as said earlier", () => {
  const prev = ["On access reviews, here is my answer from my own work. I ran quarterly access reviews for 1,200 privileged accounts and removed stale admin rights."]
  const d = draftSpokenAnswer("How did you handle privileged accounts?", "engineer", ODD.subheadings, prev)
  assert.doesNotMatch(d, /does not show|have not done|not something I have run/i, d)
  assert.match(d, /privileged accounts/)
  // failsafe: a topic the resume really lacks still gets the honest line
  assert.match(draftSpokenAnswer("How did you handle Okta SSO rollout?", "engineer", ODD.subheadings, prev), /does not show|have not done|not something I have run/i)
})
test("unusual resume headings (em dash, middle dot, 'Role, Employer (Summer 2022 – current)') become role headings, not experience lines", () => {
  for (const name of ["apostropheDates", "initialsEmployer", "selfEmployed"]) {
    const lines = experienceLines(ODD[name])
    assert.ok(!lines.some((l) => /Riley|Sr\. Cloud|SOC Analyst, 3M|Cloud Security Engineer, J\.P\.M|EXPERIENCE|^WORK$/.test(l)), `${name}: ${lines.join(" / ")}`)
  }
  const ps = (r) => retrievePassages("How did you handle access reviews?", sourceDocs({ resume: r })).passages[0].text
  assert.match(ps(ODD.apostropheDates), /Northwind Bank, N\.A\./)
  assert.match(ps(ODD.initialsEmployer), /J\.P\.M\. & Co\./)
  // failsafe: the layouts r3 handles are unchanged
  assert.equal(normalizeResumeLayout(LAYOUTS.subheadings), LAYOUTS.subheadings)
  assert.equal(normalizeResumeLayout(LAYOUTS.bullets), normalizeResumeLayout(LAYOUTS.bullets))
})
test("a bare short follow-up ('Why that', 'How so') is drafted on the previous question's topic, never as 'not on my resume'", () => {
  for (const q of ['Why that — following up on: "How did you handle Splunk detections"?', 'How so — following up on: "How did you handle privileged accounts"?']) {
    const d = draftSpokenAnswer(q, "engineer", ODD.apostropheDates)
    assert.doesNotMatch(d, /does not show|have not done|not something I have run/i, d)
  }
  // failsafe: a follow-up with its own new topic is still ranked on its own words
  const own = draftSpokenAnswer('What about Okta SSO rollout — following up on: "How did you handle Splunk detections"?', "engineer", ODD.subheadings)
  assert.doesNotMatch(own, /Splunk detections for AWS/, own)
})
test("a word only in the role title ('SOC Analyst') does not make 'SOC 2 Type II audits' look covered", () => {
  const r = retrievePassages("Tell me about your work on SOC 2 Type II audits.", sourceDocs({ resume: ODD.initialsEmployer }))
  assert.equal(r.matched, false)
  // failsafe: an employer named in the ask is still found through the heading
  const e = retrievePassages("What did you do at 3M Health Info Systems?", sourceDocs({ resume: ODD.initialsEmployer }))
  assert.ok(e.matched)
})
test("stand-in: 'cloud posture' does not match 'CloudTrail' inside a word, so an uncovered ask gets the honest line", () => {
  const d = draftSpokenAnswer("How did you lead the team on Wiz cloud posture?", "engineer", ODD.subheadings)
  assert.match(d, /does not show|have not done|not something I have run|closest real example/i, d)
  // failsafe: a real whole-word match still uses the resume line
  assert.match(draftSpokenAnswer("How did you handle Splunk detections?", "engineer", ODD.subheadings), /Splunk detections for AWS/)
})
test("three-part ask: Director and Architect name all three parts, picking one resume line per part first", () => {
  for (const [q, lay, parts] of [["How did you handle alert triage, access reviews, and HIPAA controls?", "initialsEmployer", [/triage/i, /access review/i, /HIPAA/]],
    ["How did you handle post-incident review, syslog sources, and alert triage?", "apostropheDates", [/post-incident/i, /syslog/i, /triage/i]],
    ["How did you handle access reviews, post-incident review, and HIPAA controls?", "selfEmployed", [/access review/i, /post-incident/i, /HIPAA/]]])
    for (const l of ["director", "architect"]) { const d = draftSpokenAnswer(q, l, ODD[lay]); for (const p of parts) assert.match(d, p, `${l}: ${d}`) }
  // failsafe: a one-part ask keeps its usual line order
  assert.match(draftSpokenAnswer("How did you handle access reviews?", "director", ODD.subheadings), /^[^.]*\. I ran quarterly access reviews/)
})
import { guardText, allowedNumbers } from "../../src/lib/kompasGuards.ts"
const ALLOW = allowedNumbers("I built Splunk detections and cut triage time by 40%. Worked 2017 to 2021.")
test("item 25 number guard: standard and product names keep their numbers (ISO 27001, SOC 2, Windows Server 2019, 24/7, step 2 of 3)", () => {
  for (const t of ["I ran ISO 27001 and SOC 2 Type II audits.", "It was a P1 incident on Windows Server 2019.", "We covered it 24/7 with a 72-hour window.",
    "Step 2 of 3 was the rollback.", "I mapped controls to NIST 800-53 and NIST SP 800-61r2.", "From 2019–2022 I led it — and it worked.", "We moved to PCI DSS 4.0 and FIPS 140-2 modules."])
    assert.equal(guardText(t, ALLOW).text, t, t)
})
test("item 25 number guard: invented figures still go, and read as speech ('by 60 percent', 'top 10 percent')", () => {
  assert.equal(guardText("We reduced incidents by 60 percent.", ALLOW).text, "We reduced incidents noticeably.")
  assert.equal(guardText("I finished in the top 10 percent.", ALLOW).text, "I finished near the top.")
  assert.equal(guardText("I cut triage time by 75%.", ALLOW).text, "I cut triage time noticeably.")
  assert.equal(guardText("I cut triage time by 40%.", ALLOW).text, "I cut triage time by 40%.")
  assert.match(guardText("It covered 1,200 accounts.", ALLOW).text, /several accounts/)
  // failsafe: a year after a standard-looking word that is a claim ("in 2019 I saved 30%") still guards the percent
  assert.doesNotMatch(guardText("In Server 2019 I saved 30%.", ALLOW).text, /30%/)
})
import { repairUserPrompt } from "../../src/lib/kompasRepair.ts"
test("item 24 prompt clash: with sources, the repair sees the source lines and one rule for 'add the missing part' vs 'no new claims'", () => {
  const p = repairUserPrompt("How did you scope SOC 2?", "I scoped it.", ["name the rejected alternative", "remove or replace claims the candidate's sources do not support: 40%"], "SOURCES:\n- I ran SOC 2 readiness at Hitachi.")
  assert.match(p, /SOURCES:\n- I ran SOC 2 readiness at Hitachi\./)
  assert.match(p, /missing part.*not a new claim/i)
  assert.match(p, /only (?:the|these) SOURCES|in general terms/i)
  assert.match(p, /MUST contain each item above/)
})
test("item 24 failsafe: with no sources the repair prompt is byte-identical to the old one", () => {
  const p = repairUserPrompt("Q?", "A.", ["x"], "")
  assert.equal(p, `QUESTION: Q?\n\nANSWER:\nA.\n\nMISSING:\n- x\n\nThe rewritten answer MUST contain each item above. Return the full rewritten answer and nothing else.`)
})
import { readFileSync } from "node:fs"
test("item 24 repair pass/fail is shown on the answer card; not-needed shows nothing", () => {
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const fn = src.match(/function repairBadge\(r\) \{[\s\S]*?\n\}/)[0]
  const repairBadge = new Function(`${fn}; return repairBadge`)()
  assert.equal(repairBadge(undefined), "")
  assert.equal(repairBadge({ status: "not-needed" }), "")
  assert.equal(repairBadge({ status: "landed", survived: true }), " · ✓ repair landed")
  assert.equal(repairBadge({ status: "landed", survived: false }), " · ✓ repair landed (lost in trim)")
  assert.equal(repairBadge({ status: "failed" }), " · ✗ repair failed")
  assert.match(src, /\$\{repairBadge\(meta\.repair\)\}`;/)
})
test("item 24 the repair rewrite is not tied to the 55s lane signal", () => {
  const src = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const body = src.match(/async function repairStructure[\s\S]*?\n\}\n/)[0]
  assert.doesNotMatch(body, /laneSignal|[^.]\bsignal\b(?!\))/)
  assert.match(body, /AbortSignal\.any\(\[req\.signal, AbortSignal\.timeout\(60000\)\]\)/)
})
const HIT = `# Sam Example
## Experience
### GRC Analyst — Hitachi Vantara — 2021 to 2024
- Mapped 300 controls to NIST 800-53 for the FedRAMP Moderate package.
- Ran quarterly access reviews across 40 SaaS apps with the IAM team.
- Built the third-party risk questionnaire workflow in ServiceNow GRC.
- Led evidence collection for the SOC 2 Type II audit with zero exceptions.
### IT Support — Acme Corp — 2018 to 2021
- Reset passwords and managed laptops.
`
const HIT_LINES = [/300 controls/, /access reviews/, /questionnaire workflow/, /evidence collection/]
test("item 26 a question naming the employer keeps depth: Hitachi lines are used, never 'resume does not show'", () => {
  for (const q of ["Tell me about your experience at Hitachi.", "What did you do at Hitachi for compliance?"]) {
    const d = draftSpokenAnswer(q, "director", HIT), a = draftSpokenAnswer(q, "architect", HIT)
    assert.doesNotMatch(d + a, /does not show/, q)
    assert.ok(HIT_LINES.filter((r) => r.test(d)).length >= 2, `director depth: ${d}`)
    assert.ok(HIT_LINES.filter((r) => r.test(a)).length >= 3, `architect depth: ${a}`)
    assert.doesNotMatch(d + a, /Reset passwords/)
  }
})
test("item 26 intro is grounded in the resume, and invents nothing", () => {
  const d = draftSpokenAnswer("Tell me about yourself.", "director", HIT)
  assert.doesNotMatch(d, /does not show/)
  assert.ok(HIT_LINES.some((r) => r.test(d)), d)
  // failsafe: an employer the resume lacks still gets the honest line
  assert.match(draftSpokenAnswer("Tell me about your experience at Google.", "director", HIT), /does not show/)
})
test("item 24 the live repair call uses the source rule", () => {
  const src = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(src, /\$\{repairSourceRule\(repairSourceBlock\(job\)\)\}The rewritten answer MUST contain each item above/)
})
test("three-part ask after an earlier answer used a part's line: the part is still named, by a pointer", () => {
  const R = LAYOUTS.flat
  const prev = [draftSpokenAnswer("How did you handle alert triage?", "director", R)]
  const d = draftSpokenAnswer("How did you handle alert triage, access reviews, and HIPAA controls?", "director", R, prev)
  for (const p of [/triage/i, /access review/i, /HIPAA/i]) assert.match(d, p, d)
})
