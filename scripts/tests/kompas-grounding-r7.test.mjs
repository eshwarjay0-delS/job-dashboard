import { fileURLToPath } from "node:url"
// r7 (29 Oct 2026): pending #27 (one code-first vs spoken rule per surface), #28 (eval runner hardening), #29 (realism
// banks). OFFLINE, code-level only: these tests say nothing about live answer quality.
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, appendFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { normalizeAskText } from "../../src/lib/kompasAskText.ts"
import { surfaceViolations, spokenSurface, surfaceFor, codeFirstExpected } from "../../src/lib/kompasSurfaceRule.ts"
import { asksForCode, dissectQuestion } from "../../src/lib/kompasDissection.ts"
import { interviewIntent } from "../../src/lib/kompasRelevance.ts"
import * as H from "../kompas-eval-hardening.mjs"
import { bankQuestions, sequences, ROLES } from "../kompas-realism-banks.mjs"

const CODE_CARD = "```python\ndef dedupe(events):\n    return list({e['id']: e for e in events}.values())\n```\nI key each event by its id so the newest one wins, and I keep it to one pass."

test("#27 card: a coding ask starts with one fenced block and speakable words", () => {
  assert.deepEqual(surfaceViolations("Write a Python function that deduplicates events.", CODE_CARD, "card"), [])
  assert.ok(surfaceViolations("Write a Python function that deduplicates events.", "I would loop over the events.", "card").includes("coding ask without a fenced block first"))
  assert.ok(surfaceViolations("Write a Python function that deduplicates events.", "```python\nx=1\n```\nI call `dedupe()` once.", "card").includes("code symbols in the words meant to be said"))
})
test("#27 card: a non-coding or design ask gets no fence", () => {
  assert.ok(surfaceViolations("How would you design an idempotent payments API?", "```go\nfunc a(){}\n```\nI store a key.", "card").includes("fenced block on a non-coding ask"))
  assert.deepEqual(surfaceViolations("How would you design an idempotent payments API?", "I store an idempotency key in Postgres before I charge.", "card"), [])
})
test("#27 spoken: never code or symbols; the card's words become the spoken text", () => {
  const said = spokenSurface(CODE_CARD)
  assert.ok(!/```|def |\{|\}/.test(said), said)
  assert.match(said, /I key each event by its id/)
  assert.deepEqual(surfaceViolations("Write a Python function that deduplicates events.", said, "spoken"), [])
  assert.equal(spokenSurface("I use `dedupe()` in O(n) time."), "I use dedupe in O of n time.")
  assert.equal(surfaceFor("voice"), "spoken"); assert.equal(surfaceFor(undefined), "card")
})
test("#27 failsafe: blank answer is a violation, helpers never throw", () => {
  assert.deepEqual(surfaceViolations("Write a SQL query for late orders.", "", "card"), ["blank answer"])
  assert.equal(typeof spokenSurface(null), "string")
  assert.equal(codeFirstExpected(null), false)
})

test("#28 whitespace-safe intent: invisible characters never change intent", () => {
  const plain = "Write a Python function that dedupes events."
  for (const q of ["Wri\u200bte a Python function that dedupes events.", "Write\u00a0a Python\tfunction that dedupes events.", "\ufeffWrite a Python function\u2028that dedupes events."]) {
    assert.equal(normalizeAskText(q), plain)
    assert.equal(asksForCode(q), true, JSON.stringify(q))
    assert.equal(interviewIntent(q), interviewIntent(plain), JSON.stringify(q))
    assert.equal(dissectQuestion(q).shape, dissectQuestion(plain).shape)
  }
  assert.equal(normalizeAskText(undefined), "")
})
test("#28 a typed coding instruction is never a greeting acknowledgement", () => {
  for (const q of ["Write a Python function that returns the findings still open after 30 days.", "Implement a token bucket rate limiter in TypeScript.", "Write a SQL query that returns each customer's latest invoice."])
    assert.notEqual(interviewIntent(q), "acknowledgement", q)
  assert.equal(interviewIntent("Hi, can you hear me okay?"), "acknowledgement")
  assert.equal(interviewIntent("Thanks."), "acknowledgement")
})
test("#28 evidence survives an interrupted write", () => {
  const dir = mkdtempSync(join(tmpdir(), "r7-")); const p = join(dir, "ev.jsonl")
  H.appendEvidence(p, { set: "s", level: "engineer", question: "q1", text: "a" })
  appendFileSync(p, '{"set":"s","level":"eng')   // killed mid-line
  const { rows, torn } = H.readEvidence(p)
  assert.equal(rows.length, 1); assert.equal(torn, 1)
  const r = join(dir, "report.json"); H.writeReportAtomic(r, { ok: true })
  assert.deepEqual(JSON.parse(readFileSync(r, "utf8")), { ok: true })
  assert.ok(!existsSync(`${r}.tmp-${process.pid}`))
})
test("#28 canonical-question integrity and no pass on empty", () => {
  const qs = ["What is residual risk?", "Tell me about a time you failed."]
  assert.deepEqual(H.canonicalIntegrity(qs, H.canonicalHash(qs)), [])
  assert.ok(H.canonicalIntegrity([...qs, " what is  residual risk? "]).some((p) => /duplicates/.test(p)))
  assert.ok(H.canonicalIntegrity(["What is residual risk?", "Changed."], H.canonicalHash(qs)).some((p) => /changed/.test(p)))
  assert.ok(H.canonicalIntegrity([]).length)
  const v = H.verdict([], [], H.OFFLINE_LABEL)
  assert.equal(v.ok, false); assert.match(v.failures[0], /no pass on empty/)
  assert.match(H.OFFLINE_LABEL, /NOT live/)
})
test("#28 detectors: blank, provider error, third person, wrong premise, invented numbers", () => {
  const src = "Built Airflow pipelines every 15 minutes."
  assert.deepEqual(H.answerFailures({ question: "q", text: "  " }), ["blank answer"])
  assert.ok(H.answerFailures({ question: "q", text: "Error: 429 Too Many Requests" }).some((f) => /provider/.test(f)))
  assert.ok(H.answerFailures({ question: "q", text: "The candidate built Airflow pipelines." }).includes("third person"))
  assert.ok(H.answerFailures({ question: "Since you managed 40 engineers, how did you plan?", text: "I managed 40 engineers with weekly planning.", sources: src, premise: "40" }).some((f) => /premise/.test(f)))
  assert.deepEqual(H.answerFailures({ question: "Since you managed 40 engineers, how did you plan?", text: "My resume does not show a team of 40. I built Airflow pipelines every 15 minutes.", sources: src, premise: "40" }), [])
  assert.ok(H.answerFailures({ question: "q", text: "I cut costs by 35%.", sources: src }).some((f) => /numbers not in the sources: 35/.test(f)))
  const card = H.humanScorecard([{ level: "engineer", question: "a|b" }], H.OFFLINE_LABEL)
  assert.match(card, /NOT live/); assert.match(card, /a\/b/)
})

test("#29 realism banks: two roles, large, every kind present, deterministic sequences", () => {
  for (const role of ROLES) {
    const qs = bankQuestions(role)
    assert.ok(qs.length >= 200, `${role} ${qs.length}`)
    for (const k of ["plain", "noisy", "coding", "design", "behavioral", "uncovered", "wrong-premise"]) assert.ok(qs.some((x) => x.kind === k), `${role} ${k}`)
    assert.ok(qs.some((x) => /\u200b|\u00a0/.test(x.q)), "invisible-character noise present")
  }
  const a = sequences(200, 7), b = sequences(200, 7)
  assert.equal(a.length, 200); assert.deepEqual(a, b)
  const kinds = new Set(a.flatMap((s) => s.turns.map((t) => t.kind)))
  for (const k of ["follow-up", "pushback", "wrong-premise", "coding"]) assert.ok(kinds.has(k), k)
})

// 200-sequence round fixes (offline). Each was a failure in the r7 folds before its fix.
import { topicOfAsk, dissectionPrompt, draftSpokenAnswer, questionPremise } from "../../src/lib/kompasDissection.ts"
test("r7 fold fix: coding asks that name a job, DAG, limiter or a language are coding asks", () => {
  for (const q of ["Implement a token bucket rate limiter in TypeScript.", "Write a PySpark job that counts shipments per carrier per day.", "Write an Airflow DAG that runs a dbt build after a Kafka load sensor.", "Implement an LRU cache class in Python."])
    assert.equal(asksForCode(q), true, q)
  for (const q of ["How would you design a rate limiter for many merchants?", "Tell me about the Airflow job that failed.", "Describe how you implemented the ledger split."])
    assert.equal(asksForCode(q), false, q)
})
test("r7 fold fix: a filler before a coding instruction does not make it a greeting", () => {
  assert.notEqual(interviewIntent("um, write a Go function that retries a request with exponential backoff."), "acknowledgement")
  assert.notEqual(interviewIntent("so, uh, write a regex to validate a shipment tracking number."), "acknowledgement")
})
test("r7 fold fix: a wrong premise is context, not the topic, and the prompt says not to confirm it", () => {
  assert.equal(topicOfAsk("As VP of Engineering at Corvid, how did you set the roadmap?"), "how did you set the roadmap?")
  assert.equal(topicOfAsk("You cut cloud spend by 90 percent, so how did you do it?"), "how did you do it?")
  assert.equal(topicOfAsk("You scaled the API to a billion requests a day, so what broke?"), "what broke?")
  assert.equal(topicOfAsk("You scaled the API to a billion requests a day, so why?"), "You scaled the API to a billion requests a day, so why?") // one-word ask: failsafe keeps all
  assert.equal(questionPremise("You cut cloud spend by 90 percent, so how did you do it?"), "You cut cloud spend by 90 percent")
  assert.equal(questionPremise("How did you set the roadmap?"), "")
  assert.match(dissectionPrompt("As the CTO of Brightpath, how did you set the data strategy?", "director", "Data Engineer, Brightpath Health"), /assumes: "As the CTO of Brightpath"/)
  assert.doesNotMatch(dissectionPrompt("How did you set the data strategy?", "director", ""), /assumes/)
  for (const q of ["As the CTO of Brightpath, how did you set the data strategy?", "You cut cloud spend by 90 percent, so how did you do it?"])
    for (const lv of ["engineer", "director", "architect"]) assert.doesNotMatch(draftSpokenAnswer(q, lv, "Data Engineer, Brightpath Health. Built Airflow pipelines."), /\bCTO\b|90 percent/, `${lv}: ${q}`)
})
test("r7 failsafe: 'As I said' and 'As a team' are not premises", () => {
  assert.equal(questionPremise("As I said, how did you test it?"), "")
  assert.equal(questionPremise("As a team, how do you plan?"), "")
})
import { spawnSync } from "node:child_process"
test("#28 eval runner: offline banks run writes evidence, a labelled report and a scorecard; a rerun keeps evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "r7ev-")); const ev = join(dir, "ev.jsonl")
  const env = { ...process.env, KOMPAS_EVAL_OFFLINE: "1", KOMPAS_EVAL_SET: "banks", KOMPAS_EVAL_EVIDENCE: ev, KOMPAS_EVAL_TOKEN: "" }
  const script = fileURLToPath(new URL("../kompas-live-eval.mjs", import.meta.url))
  const a = spawnSync(process.execPath, [script], { env, encoding: "utf8" })
  assert.equal(a.status, 0, a.stderr.slice(-400))
  const rep = JSON.parse(readFileSync(`${ev}.report.json`, "utf8"))
  assert.match(rep.evidence, /NOT live/); assert.ok(rep.answers >= 30)
  assert.match(readFileSync(`${ev}.scorecard.md`, "utf8"), /\| relevance \|/)
  const lines = readFileSync(ev, "utf8").trim().split("\n").length
  const b = spawnSync(process.execPath, [script], { env, encoding: "utf8" })
  assert.equal(b.status, 0); assert.match(b.stderr, /kept from evidence/)
  assert.equal(readFileSync(ev, "utf8").trim().split("\n").length, lines)
  const c = spawnSync(process.execPath, [script], { env: { ...process.env, KOMPAS_EVAL_TOKEN: "", KOMPAS_EVAL_OFFLINE: "" }, encoding: "utf8" })
  assert.equal(c.status, 2) // no token: no production call
})
