// Speed r6 (29 Oct 2026): offline, code-level only; not live answer quality or live timing.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as R from "../../src/lib/kompasSourceRetrieval.ts"
import * as C from "../../src/lib/kompasSessionCache.ts"
import * as G from "../../src/lib/kompasSentenceGate.ts"
import * as P from "../../src/lib/kompasStreamIntegrity.ts"
import { repairNeedsModel, runRepairLoop } from "../../src/lib/kompasRepair.ts"
import { speakFacts, allowedNumbers, applyGuards } from "../../src/lib/kompasGuards.ts"
import { resumeRoles, resumeDigest } from "../../src/lib/kompasResume.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const W = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-weighting-sources-r4.json", import.meta.url), "utf8"))
const DOCS = R.sourceDocs({ resume: S.resume, jd: S.jd, documents: S.documents, savedQA: S.savedQA })
const QS = ["How did you handle a leaked API key?", "Tell me about your Terraform guardrails.", "What else?", "How did you approach terra form and cloud trail?",
  "Tell me about Kubernetes admission controllers.", "How did you handle residual risks and HIPAA controls?", "sorry the line cut out, spunk detections?",
  "Tell me about a time you disagreed with a stakeholder.", "How did you lead the team on access reviews?", "", "post incident review", "What did you do at Northwind?"]
const strip = (r) => JSON.parse(JSON.stringify(r))

// ---- 2. indexed retrieval equals the scan, on every fixture and question
test("indexed retrieval returns exactly today's results on the fixtures", () => {
  const sets = [DOCS, R.sourceDocs({ resume: S.resume }), R.sourceDocs({ jd: S.jd }), []]
  sets.push(R.sourceDocs(W))
  const recent = [[], ["Led incident response for a leaked API key: rotated the key in KMS"]]
  let n = 0
  for (const docs of sets) for (const q of QS) for (const rec of recent) for (const kb of [true, false, "full"]) {
    const scan = R.retrievePassages(q, docs, 4, { recent: rec, kindBoost: kb, index: false })
    const idx = R.retrievePassages(q, docs, 4, { recent: rec, kindBoost: kb })
    assert.deepEqual(strip(idx), strip(scan), `q=${q}`); n++
  }
  assert.ok(n > 100)
})
test("the source index is built once per content and reused; a change rebuilds it", () => {
  R.clearSourceIndexCache()
  const a = R.sourceIndexFor(DOCS)
  assert.equal(R.sourceIndexFor(R.sourceDocs({ resume: S.resume, jd: S.jd, documents: S.documents, savedQA: S.savedQA })), a)
  const b = R.sourceIndexFor(R.sourceDocs({ resume: S.resume + "\n- Wrote a new detection for stolen OAuth tokens in Okta." }))
  assert.notEqual(a, b)
  assert.equal(R.sourceIndexFor([]), null)
  assert.equal(R.sourceIndexFor(null), null)
})
test("index failsafe: a broken index falls back to the scan, same result", () => {
  const scan = R.retrievePassages(QS[0], DOCS, 4, { index: false })
  assert.deepEqual(strip(R.retrievePassages(QS[0], DOCS, 4, { index: { broken: true } })), strip(scan))
})

// ---- 1. per-session cache of digest, speakable facts and allowed numbers
test("session facts equal the per-question build and are cached by content hash", () => {
  C.clearSessionCache()
  const a = C.sessionFacts(S.resume, S.documents)
  assert.deepEqual(a.guardFacts, speakFacts({ resume: S.resume, jd: "", documents: S.documents, heard: "", identity: "", projects: "" }))
  assert.deepEqual([...a.allowed], [...allowedNumbers(S.resume, S.documents)])
  assert.deepEqual(a.roles, resumeRoles(S.resume))
  const before = C.sessionCacheStats().builds
  C.sessionFacts(S.resume, S.documents)
  assert.equal(C.sessionCacheStats().builds, before)
  C.sessionFacts(S.resume + "\nCut costs by 12%.", S.documents)
  assert.equal(C.sessionCacheStats().builds, before + 1)
  assert.ok(C.sessionFacts(S.resume + "\nCut costs by 12%.", S.documents).allowed.has("12%"))
})
test("cached allowed-numbers set cannot be poisoned by a caller", () => {
  C.clearSessionCache()
  C.sessionFacts(S.resume, "").allowed.add("999%")
  assert.equal(C.sessionFacts(S.resume, "").allowed.has("999%"), false)
})
test("empty inputs behave exactly as today and are not cached", () => {
  C.clearSessionCache()
  const e = C.sessionFacts("", "")
  assert.deepEqual(e.guardFacts, speakFacts({ resume: "", jd: "", documents: "", heard: "", identity: "", projects: "" }))
  assert.equal(e.allowed.size, 0)
  assert.equal(C.sessionCacheStats().entries, 0)
})
test("cached digest equals resumeDigest", () => {
  const r = S.resume.repeat(3)
  assert.equal(C.cachedDigest(r, "Terraform guardrails?", 1600, "focused"), resumeDigest(r, "Terraform guardrails?", 1600, "focused"))
  assert.equal(C.cachedDigest(r, "Terraform guardrails?", 1600, "focused"), resumeDigest(r, "Terraform guardrails?", 1600, "focused"))
})
test("the cache is bounded", () => {
  C.clearSessionCache()
  for (let i = 0; i < 300; i++) C.sessionFacts(S.resume + i, "")
  assert.ok(C.sessionCacheStats().entries <= C.SESSION_CACHE_MAX)
})

// ---- 3. structure repair calls the model only on a real gap
test("repair: advisory-only tangent items do not call the model; real gaps do", async () => {
  assert.equal(repairNeedsModel({ core: [], all: ["remove the unasked technical tangent kubernetes and keep the direct answer"] }), false)
  assert.equal(repairNeedsModel({ core: ["x"], all: ["x"] }), true)
  assert.equal(repairNeedsModel({ core: [], all: ["the interviewer explicitly asked about budget"] }), true)
  assert.equal(repairNeedsModel({ core: [], all: [] }), false)
  let calls = 0
  const r = await runRepairLoop("draft", { checks: () => ({ core: [], all: ["remove the unasked technical tangent k8s and keep the direct answer"] }), rewrite: async () => { calls++; return "x" }, hasKey: true, gateAdvisory: true })
  assert.equal(calls, 0); assert.equal(r.text, "draft"); assert.equal(r.repair.status, "advisory")
  const r2 = await runRepairLoop("draft", { checks: (t) => ({ core: t === "draft" ? ["gap"] : [], all: t === "draft" ? ["gap"] : [] }), rewrite: async () => { calls++; return "fixed" }, hasKey: true, gateAdvisory: true })
  assert.equal(calls, 1); assert.equal(r2.text, "fixed")
  // without the gate, behaviour is exactly as before
  const r3 = await runRepairLoop("draft", { checks: () => ({ core: [], all: ["remove the unasked technical tangent k8s and keep the direct answer"] }), rewrite: async () => { calls++; return "" }, hasKey: true })
  assert.equal(calls, 3); assert.equal(r3.text, "draft") // two ungated attempts, as before
})

// ---- 4. per-sentence guarded streaming
const facts = speakFacts({ resume: S.resume, documents: S.documents })
const allowed = allowedNumbers(S.resume, S.documents)
const gateFor = (q, opener) => G.createSentenceGate({
  check: G.sentenceCheck({ facts, allowed, asked: new Set(), docs: DOCS, question: q, passages: R.retrievePassages(q, DOCS).passages }),
  opener, sourcePassages: R.splitPassages(DOCS),
})
test("policy: personal history now streams per guarded sentence; switch off restores guarded-final", () => {
  assert.equal(P.answerStreamPolicy(1, "Tell me about a time you led an incident."), "guarded-sentence")
  assert.equal(P.answerStreamPolicy(2, "What is a SIEM?"), "progressive")
  assert.equal(P.answerStreamPolicy(1, "Tell me about a time.", { sentenceStream: false }), "guarded-final")
  assert.equal(P.releaseProvisionalDelta("guarded-sentence"), false)
  assert.equal(P.mustEmitFinalReplacement("guarded-sentence", "a", "a"), true)
})
test("gate releases clean sentences one by one and holds a partial sentence", () => {
  const g = gateFor("How did you handle a leaked API key?")
  const out = []
  for (const d of ["I rotated the leaked API key in KMS ", "and scoped the blast radius. Then I wrote", " the post-incident review. "]) out.push(...g.push(d))
  assert.equal(out.length, 2)
  assert.match(out[0], /rotated the leaked API key/)
  assert.equal(g.halted(), false)
})
test("an invented number stops the release at that sentence and everything after it", () => {
  const g = gateFor("How did you handle a leaked API key?")
  const out = [...g.push("I rotated the leaked API key in KMS. That cut response time by 75%. Then I wrote the review. ")]
  out.push(...g.finish())
  assert.equal(out.length, 1)
  assert.ok(!out.join(" ").includes("75%"))
  assert.equal(g.halted(), true)
})
test("unsupported employer or tool claims are never released", () => {
  for (const bad of ["At Globex I also did this with Datadog.", "We sent the logs to datadog.", "I led a large team on it.", "It protected millions of users.", "It saved the bank $2 million."]) {
    const g = gateFor("How did you handle a leaked API key?")
    const out = [...g.push(`${bad} I rotated the key. `), ...g.finish()]
    assert.equal(out.length, 0, bad)
  }
})
test("provider error text is never released", () => {
  const g = gateFor("How did you handle a leaked API key?")
  assert.deepEqual([...g.push("Error: 429 Too Many Requests. "), ...g.finish()], [])
})
test("a guard that throws halts the gate (fail closed)", () => {
  const g = G.createSentenceGate({ check: () => { throw new Error("x") } })
  assert.deepEqual([...g.push("I rotated the key. "), ...g.finish()], [])
  assert.equal(g.halted(), true)
})
test("finish releases a clean trailing sentence; empty input releases nothing", () => {
  const g = gateFor("How did you handle a leaked API key?")
  assert.deepEqual(g.push("I rotated the leaked API key in KMS"), [])
  assert.equal(g.finish().length, 1)
  assert.deepEqual(gateFor("q").finish(), [])
})
test("decimals and abbreviations do not split a sentence early", () => {
  const g = G.createSentenceGate({ check: () => true })
  assert.deepEqual(g.push("I moved us to TLS 1.3 on e.g. the "), [])
})

// ---- 4b. Lens opener hook: verbatim exact match only
const P0 = R.retrievePassages("How did you handle a leaked API key?", DOCS).passages[0]
test("a verbatim sourced opener is approved by exact match and released first", () => {
  const op = { text: P0.line, sourceId: P0.id, category: "incident", verbatim: true }
  assert.equal(G.approveSourcedOpener(op, R.splitPassages(DOCS)), true)
  const g = gateFor("How did you handle a leaked API key?", op)
  assert.equal(g.openerText(), P0.line)
  assert.deepEqual(g.start(), [P0.line])
})
test("opener rejected unless exact, verbatim and cited", () => {
  const all = R.splitPassages(DOCS)
  assert.equal(G.approveSourcedOpener({ text: P0.line + " by 90%", sourceId: P0.id, category: "c", verbatim: true }, all), false)
  assert.equal(G.approveSourcedOpener({ text: P0.line, sourceId: "R999", category: "c", verbatim: true }, all), false)
  assert.equal(G.approveSourcedOpener({ text: P0.line, sourceId: P0.id, category: "c", verbatim: false }, all), false)
  assert.equal(G.approveSourcedOpener(null, all), false)
  assert.equal(G.approveSourcedOpener({ text: P0.line, sourceId: P0.id, category: "c", verbatim: true }, []), false)
  const g = gateFor("How did you handle a leaked API key?", { text: "I led a team of 50.", sourceId: P0.id, category: "c", verbatim: true })
  assert.deepEqual(g.start(), []); assert.equal(g.openerText(), "")
})
test("final text keeps an approved opener in front, once", () => {
  assert.equal(G.withOpener("I rotated it.", "Led incident response."), "Led incident response. I rotated it.")
  assert.equal(G.withOpener("Led incident response. I rotated it.", "Led incident response."), "Led incident response. I rotated it.")
  assert.equal(G.withOpener("I rotated it.", ""), "I rotated it.")
})
test("a JD line can never be an opener (it does not prove experience)", () => {
  const jd = R.splitPassages(DOCS).find((p) => p.proves === "emphasis")
  assert.equal(G.approveSourcedOpener({ text: jd.line, sourceId: jd.id, category: "c", verbatim: true }, R.splitPassages(DOCS)), false)
})
void applyGuards
