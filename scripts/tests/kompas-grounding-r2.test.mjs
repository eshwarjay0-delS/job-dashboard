// Source grounding r2 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { sourceDocs, extractClaims, unsupportedClaims, retrievePassages, repairLoopSourceChecks, questionKind } from "../../src/lib/kompasSourceRetrieval.ts"
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = sourceDocs(S)
const un = (t, q = "") => unsupportedClaims(t, [], DOCS, q)

test("vague scale claims are caught when the sources do not back them", () => {
  assert.ok(un("I led a large team on the rollout.").some((c) => /large team/i.test(c)))
  assert.ok(un("It protected millions of users.").some((c) => /millions of users/i.test(c)))
  assert.ok(un("I led dozens of engineers through it.").some((c) => /dozens of engineers/i.test(c)))
  assert.ok(un("We served hundreds of thousands of customers.").length >= 1)
})
test("failsafe: vague claims backed by sources, said by the interviewer, or with no sources are not flagged", () => {
  const docs = sourceDocs({ resume: "- Led a large team of analysts through the SOC 2 audit at Acme." })
  assert.deepEqual(unsupportedClaims("I led a large team on it.", [], docs), [])
  assert.deepEqual(un("I led a large team on it.", "How do you run a large team?"), [])
  assert.deepEqual(unsupportedClaims("I led a large team.", [], []), [])
  // a figure in the sources backs a vague "hundreds of" on the same noun (1,200 privileged accounts)
  assert.deepEqual(un("I reviewed hundreds of privileged accounts."), [])
})
test("lower-case tool names are claims and are checked against the sources", () => {
  assert.ok(un("I deployed it on kubernetes.").some((c) => /kubernetes/i.test(c)))
  assert.ok(un("We tracked it in datadog and wiz.").length === 2)
  assert.deepEqual(un("I wrote terraform guardrails and splunk detections."), [])
  assert.deepEqual(un("I deployed it on kubernetes.", "Have you used kubernetes?"), []) // interviewer said it
})
test("ordinary sentence-initial words are not claims (cause of the 6 dropped clean sentences)", () => {
  assert.deepEqual(extractClaims("Where the work touches another team, I agree the handoff and the proof that it happened."), [])
  assert.deepEqual(extractClaims("Whenever it slips, I say so. Although small, it mattered."), [])
  assert.ok(extractClaims("Globex hired me in 2019.").includes("Globex")) // failsafe: a real name first in a sentence stays
})
test("lead-ins read as speech: statement premise and wh-lead", () => {
  const a = draftSpokenAnswer("The control failed in 37% of samples. What would you do?", "engineer", "")
  assert.doesNotMatch(a, /^For the control failed/)
  assert.match(a, /^For the control that failed in 37% of samples,/)
  const b = draftSpokenAnswer("What about who should accept a risk?", "engineer", "")
  assert.doesNotMatch(b, /(?<!as )for who should/i)
  assert.match(b, /as for who should accept a risk/i)
  // failsafe: ordinary leads unchanged
  assert.match(draftSpokenAnswer("How would you handle a leaked API key?", "engineer", ""), /^(?:On|For) how I handle a leaked API key,/)
})
test("behavior 8: a passage used in the last answers is demoted unless the ask goes back to it", () => {
  const q = "Tell me about your detection work."
  const base = retrievePassages(q, DOCS)
  const top = base.passages[0]
  const next = retrievePassages(q, DOCS, 4, { recent: [top.text] })
  assert.notEqual(next.passages[0].id, top.id)
  assert.equal(next.matched, base.matched)
  const back = retrievePassages("Going back to that detection work, what would you change?", DOCS, 4, { recent: [top.text] })
  assert.equal(back.passages[0].id, retrievePassages("Going back to that detection work, what would you change?", DOCS).passages[0].id)
  assert.deepEqual(retrievePassages(q, DOCS, 4, {}).passages.map((p) => p.id), base.passages.map((p) => p.id)) // failsafe
  assert.deepEqual(retrievePassages(q, DOCS, 4, { recent: null }).passages.map((p) => p.id), base.passages.map((p) => p.id))
})
test("behavior 7: question kind weights sources without changing coverage", () => {
  assert.equal(questionKind("Tell me about a time you disagreed with your manager."), "behavioral")
  assert.equal(questionKind("How do you lead a team through an incident?"), "leadership")
  assert.equal(questionKind("How does Terraform state locking work?"), "technical")
  assert.equal(questionKind(""), "technical")
  const r = retrievePassages("How did you lead the incident response?", DOCS)
  assert.match(r.passages[0].text, /Led incident response/)
  const why = retrievePassages("Why do you want this role and to keep building detections?", DOCS)
  assert.equal(why.passages.some((p) => p.source === "saved Q&A"), true)
})
test("repair check names a vague and a lower-case invented claim", () => {
  const msg = repairLoopSourceChecks("How did you handle alert triage?", "I built the triage flow. I led dozens of engineers on kubernetes.", DOCS)
  assert.match(msg[0] || "", /dozens of engineers/)
  assert.match(msg[0] || "", /kubernetes/i)
})
test("300-fold finds: a small money figure is a claim; a capitalised premise lead is lower-cased", () => {
  assert.ok(un("It saved the bank $2 million.").some((c) => /2 million/.test(c)))
  assert.deepEqual(unsupportedClaims("It saved $2 million.", [], sourceDocs({ resume: "- Saved $2 million in licence costs at Acme." })), []) // failsafe
  assert.match(draftSpokenAnswer("A key expired last night. Who do you call first?", "director", ""), /^(?:On|For) a key that expired last night,/)
})
test("300-fold finds: 'On who…' and 'I treat who… as' read as speech in every mode", () => {
  for (const l of ["engineer", "director", "architect"]) for (const q of ["What about who should accept a risk?", "And who should accept a risk?", "Which alerts get paged?"]) {
    const a = draftSpokenAnswer(q, l, "")
    assert.doesNotMatch(a, /(?:^|, )(?:for|on) (?:who|whom|which|where)\b|\btreat (?:who|whom|which|where)\b/i, `${l}: ${a}`)
  }
  assert.match(draftSpokenAnswer("How would you handle a leaked API key?", "director", ""), /^(?:On|For) how I handle/) // failsafe
})
test("300-fold finds: 'what else / another example' moves off the passage just used when another one relates", () => {
  const used = retrievePassages("Tell me about your Splunk detections.", DOCS).passages[0]
  const r = retrievePassages("And what else did you do on Splunk detections?", DOCS, 4, { recent: [used.line] })
  assert.notEqual(r.passages[0].id, used.id)
  assert.equal(r.matched, true)
  // failsafe: a lone covering passage is still used (nothing else relates)
  const lone = retrievePassages("Tell me about residual risk.", DOCS).passages[0]
  assert.equal(retrievePassages("What else on residual risk?", DOCS, 4, { recent: [lone.line] }).passages[0].id, lone.id)
})
