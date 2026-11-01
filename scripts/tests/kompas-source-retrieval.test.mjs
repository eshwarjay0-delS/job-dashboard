// Source-grounded retrieval (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  sourceDocs, splitPassages, retrievePassages, sourcePassagesPrompt, unsupportedClaims, repairLoopSourceChecks, NOT_IN_SOURCES,
} from "../../src/lib/kompasSourceRetrieval.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = sourceDocs({ resume: S.resume, jd: S.jd, dossier: S.dossier, savedQA: S.savedQA })

test("sources split into labelled passages; headers and blanks are not passages", () => {
  const p = splitPassages(DOCS)
  assert.ok(p.length >= 8)
  assert.ok(p.every((x) => x.source && x.text.split(/\s+/).length >= 4))
  assert.ok(p.some((x) => x.source === "resume" && /Splunk/.test(x.text)))
  assert.ok(p.some((x) => x.source === "saved Q&A"))
  // the role heading travels with its bullets, so the employer is in the passage
  assert.ok(p.find((x) => /Terraform guardrails/.test(x.text)).text.includes("Northwind Bank"))
})
test("top passage holds the asked keyword and carries its source name", () => {
  const r = retrievePassages("How did you handle a leaked API key?", DOCS)
  assert.equal(r.matched, true)
  assert.match(r.passages[0].text, /leaked API key/)
  assert.equal(r.passages[0].source, "resume")
  assert.ok(r.passages.length <= 4)
})
test("JD passages never rank as personal evidence above a resume passage on the same keyword", () => {
  const r = retrievePassages("Tell me about your Terraform guardrails.", DOCS)
  assert.equal(r.passages[0].source, "resume")
})
test("nothing in the sources: honest 'not in your sources' line plus the closest real example", () => {
  const r = retrievePassages("Tell me about your experience with Kubernetes admission controllers.", DOCS)
  assert.equal(r.matched, false)
  const block = sourcePassagesPrompt(r)
  assert.ok(block.includes(NOT_IN_SOURCES))
  assert.match(block, /CLOSEST REAL EXAMPLE/)
})
test("failsafe: empty or broken sources give no block, so the prompt is exactly as today", () => {
  assert.equal(sourcePassagesPrompt(retrievePassages("What is residual risk?", [])), "")
  assert.equal(sourcePassagesPrompt(retrievePassages("", DOCS)), "")
  assert.equal(sourcePassagesPrompt(retrievePassages("x", null)), "")
  assert.deepEqual(repairLoopSourceChecks("Q?", "I used Splunk.", []), [])
})
test("claim check flags invented tools, employers and numbers; supported ones pass", () => {
  const passages = retrievePassages("How did you speed up alert triage?", DOCS).passages
  assert.deepEqual(unsupportedClaims("At Northwind Bank I built Splunk detections and cut triage time by 40%.", passages, DOCS), [])
  const bad = unsupportedClaims("At Globex I built Datadog monitors and cut triage time by 75%.", passages, DOCS)
  assert.ok(bad.includes("Globex"))
  assert.ok(bad.includes("Datadog"))
  assert.ok(bad.includes("75%"))
})
test("terms the interviewer said are not counted as the candidate's invented claims", () => {
  const passages = retrievePassages("Have you used Kubernetes?", DOCS).passages
  assert.deepEqual(unsupportedClaims("I haven't run Kubernetes in production; the closest is my AWS guardrail work.", passages, DOCS, "Have you used Kubernetes?"), [])
})
test("repair-loop check names each unsupported claim as a core item", () => {
  const items = repairLoopSourceChecks("How did you speed up alert triage?", "At Globex I cut triage time by 75%.", DOCS)
  assert.equal(items.length, 1)
  assert.match(items[0], /Globex/)
  assert.match(items[0], /75%/)
})

// Folded in from the NotebookLM grounding study, section 4 (our own build; no outside code).
import { claimSupport, whereFrom, sourceConflicts, notInSourcesPlan } from "../../src/lib/kompasSourceRetrieval.ts"

test("behavior 2: every passage has a fact ID and what it can prove; a JD never proves experience", () => {
  const p = splitPassages(DOCS)
  assert.ok(p.every((x) => /^[A-Z]+\d+$/.test(x.id)))
  assert.ok(p.filter((x) => x.source === "job description").every((x) => x.proves === "emphasis"))
  assert.ok(p.filter((x) => x.source === "resume").every((x) => x.proves === "experience"))
  // "SIEM detections" is in the JD; a claim backed only by the JD is unsupported
  const onlyJd = sourceDocs({ jd: "Lead incident response for Kubernetes clusters." })
  assert.deepEqual(unsupportedClaims("I ran Kubernetes incident response.", [], onlyJd), ["Kubernetes"])
})
test("behavior 3: supported-claim share per answer", () => {
  const passages = retrievePassages("How did you speed up alert triage?", DOCS).passages
  const good = claimSupport("At Northwind Bank I built Splunk detections and cut triage by 40%.", passages, DOCS)
  assert.equal(good.share, 1)
  const half = claimSupport("At Northwind Bank I used Datadog.", passages, DOCS)
  assert.equal(half.total, 2); assert.equal(half.supported, 1); assert.equal(half.share, 0.5)
  assert.equal(claimSupport("I would start with the evidence.", passages, DOCS).share, 1) // no claims, nothing unsupported
})
test("behavior 5: not-in-sources plan gives a general voice, a bridge and a quiet side note", () => {
  const plan = notInSourcesPlan(retrievePassages("Tell me about your experience with Kubernetes admission controllers.", DOCS), "Kubernetes admission controllers")
  assert.match(plan.general, /^In general/)
  assert.match(plan.bridge, /Northwind Bank|Contoso Health|Terraform|AWS/)
  assert.match(plan.sideNote, /has nothing on Kubernetes admission controllers.*add it/i)
  assert.equal(notInSourcesPlan(retrievePassages("How did you handle a leaked API key?", DOCS), "x"), null)
})
test("behavior 6: where-it-came-from chips are attached by code, verified, and never in the spoken text", () => {
  const passages = retrievePassages("How did you handle a leaked API key?", DOCS).passages
  const text = "I rotated the leaked API key in KMS. Then I wrote the post-incident review."
  const chips = whereFrom(text, passages)
  assert.equal(chips.length, 2)
  assert.ok(chips.every((c) => c.factId && passages.some((p) => p.id === c.factId && p.text.includes(c.quote))))
  assert.doesNotMatch(text, /R\d|\[/)
})
test("behavior 9: resume and dossier disagreeing on an employer's dates is shown, resume wins", () => {
  const docs = sourceDocs({ resume: S.resume, dossier: "Northwind Bank (2019 to present): owned detections." })
  const c = sourceConflicts(docs)
  assert.equal(c.length, 1)
  assert.match(c[0], /Northwind Bank.*2021.*2019.*using the resume/i)
  assert.deepEqual(sourceConflicts(DOCS), [])
})

test("wired into the live path: passages block in the context, source check as a repair core item, failsafe guarded", () => {
  const svc = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(svc, /sourcePassagesPrompt\(sourceRetrieval\)/)
  assert.match(svc, /const sourceCheck = repairLoopSourceChecks\(job\.question, text, job\.sourceDocs\)/)
  assert.match(svc, /core: \[\.\.\.structure, \.\.\.named, \.\.\.voiceEcho, \.\.\.sourceCheck\]/)
})

test("200-fold find: interview chatter and one shared generic word do not count as 'in your sources'", () => {
  for (const q of ["Sorry, the line cut out. Azure Sentinel, how did that go?", "What did you change about red team exercises?",
    "Your resume mentions a lot. Which piece of red team exercises was hardest?"]) assert.equal(retrievePassages(q, DOCS).matched, false, q)
  for (const q of ["Sorry, the line cut out. Residual risk, how did that go?", "Your resume mentions a lot. Which piece of access reviews was hardest?"])
    assert.equal(retrievePassages(q, DOCS).matched, true, q)
})
import { experienceLines } from "../../src/lib/kompasDissection.ts"
test("round-trip find: a resume with ### role headings still yields its experience lines for the offline stand-in", () => {
  const lines = experienceLines(S.resume)
  assert.ok(lines.some((l) => /Splunk detections/.test(l)), lines.join(" | "))
  assert.ok(lines.some((l) => /HIPAA controls/.test(l)))
  assert.ok(!lines.some((l) => /CISSP/.test(l)))
  const old = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
  assert.equal(experienceLines(old).length, 12) // failsafe: the flat sample resume reads exactly as before
})

test("200-fold find: misheard plurals and split words still find the real passage", () => {
  for (const q of ["How did you handle residual risks?", "Tell me about your work on terra form guardrails.", "Have you done splunk detection?", "What did you change about stale admin right?"])
    assert.equal(retrievePassages(q, DOCS).matched, true, q)
})
