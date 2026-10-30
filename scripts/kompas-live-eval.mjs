#!/usr/bin/env node
/**
 * Live Kompas relevance eval. This is the only check of LIVE answer quality; the node tests are code-level only.
 *
 *   KOMPAS_EVAL_TOKEN='<supabase access token>' node scripts/kompas-live-eval.mjs
 *
 * The token is read from the environment only. It is never printed and never stored. Without KOMPAS_EVAL_TOKEN the
 * script exits 2 and does not call production.
 *
 * Optional:
 *   KOMPAS_BASE_URL   default https://job-dashboard-fawn.vercel.app
 *   KOMPAS_EVAL_SET   sample | hitachi | all (default all) | repair (repair-loop cases; see below)
 *
 * Sets:
 *   sample   four sample-resume questions plus one code question, each at engineer, director and architect.
 *   hitachi  the hitachi-grc chain from scripts/fixtures/kompas-evaluation/interview-50.json (five questions asked in
 *            order with the earlier turns as history), at all three levels.
 *
 * Fails (exit 1) when:
 *   - two different questions get the same answer at the same level
 *   - two modes of one question are less than 50% apart in length
 *   - provider error text comes back as an answer
 *   - the first sentence misses the question's own words, or the length is outside the mode band
 *   - a code question does not start with a fenced block
 *   - an explicitly asked piece is missing (kompasEvalCriteria: 800-53, rejected alternative, Hypothesis 1 and 2,
 *     rollback, exit criterion, falsifiable test, decision owner, measures, no invented achieved numbers)
 * Depth and confidence gaps are printed as warnings. Each answer's repair outcome (the `repair` field) is printed.
 *
 * Offline mode (idea F of the competitor study, 29 Oct 2026):
 *   KOMPAS_EVAL_OFFLINE=1 node scripts/kompas-live-eval.mjs
 * needs no token and makes no network call. It replays the same sets through the code-level stand-in
 * (dissectQuestion, draftSpokenAnswer, settleSpokenAnswer, applyGuards) and prints the same report plus `latency`:
 * time to first word and time to finish, p50 and p95 per mode. OFFLINE RESULTS ARE NOT LIVE ANSWER QUALITY and the
 * offline timings exclude the model and the network; they only show what the code path itself adds. Latency is
 * reporting only: it never fails the run, and offline mode always exits 0.
 * Live mode records `latency` too (client-side, non-streaming request, so first word equals finish there).
 *
 * r7 hardening (pending #28, 29 Oct 2026; scripts/kompas-eval-hardening.mjs):
 *   KOMPAS_EVAL_SET=banks      the r7 realism banks (data engineering, backend dossiers; noise, coding, design, wrong
 *                              premises), one sample per kind per role, at all three levels. KOMPAS_EVAL_BANK_N caps it.
 *   KOMPAS_EVAL_EVIDENCE=path  every answer is appended to path as one JSON line as it lands (fsync), so a killed run
 *                              keeps its evidence; a rerun skips questions already recorded. The report goes to
 *                              path.report.json (temp file + rename) and a human scorecard to path.scorecard.md.
 *   - the canonical sample set is hash-checked; a changed, blank or duplicated canonical question fails before any call.
 *   - no pass on empty: zero judged answers exits 1 (live) and is reported ok:false (offline).
 *   - extra detectors on every answer: blank, provider error, third person, the per-surface code rule (#27), a wrong
 *     premise adopted, numbers not in the sources. Every report carries `evidence`: offline stand-in or live.
 */
import { readFileSync } from "node:fs"
import { evaluateLiveAnswers, draftSpokenAnswer, settleSpokenAnswer, dissectQuestion } from "../src/lib/kompasDissection.ts"
import { applyGuards } from "../src/lib/kompasGuards.ts"
import { criteriaMisses } from "../src/lib/kompasEvalCriteria.ts"
import { performance } from "node:perf_hooks"
import * as H from "./kompas-eval-hardening.mjs"
import { bankQuestions, loadBank, ROLES } from "./kompas-realism-banks.mjs"
import { normalizeAskText } from "../src/lib/kompasAskText.ts"

const offline = process.env.KOMPAS_EVAL_OFFLINE === "1"
const token = process.env.KOMPAS_EVAL_TOKEN || ""

// Repair-loop cases (29 Oct 2026): KOMPAS_EVAL_SET=repair runs the recorded cases of scripts/kompas-repair-harness.mjs.
//   with KOMPAS_EVAL_TOKEN   live: each case's question is asked with the earlier turn as history, and the answer the
//                            server returns must not repeat the earlier answer, must be first person, must not be blank or
//                            provider-error text. The server's `repair` field (status, attempts) is printed; attempts > 2
//                            fails. Exit 1 on any failure.
//   KOMPAS_EVAL_OFFLINE=1    replays the recorded model outputs through the production loop (NOT live answer quality).
//   neither                  prints that it was skipped, makes no network call, exits 0.
if ((process.env.KOMPAS_EVAL_SET || "") === "repair") {
  const harness = await import("./kompas-repair-harness.mjs")
  if (!token && !offline) {
    console.log(JSON.stringify({ mode: "skipped", reason: "KOMPAS_EVAL_TOKEN is not set; no production call was made", cases: harness.CASES.length }, null, 2))
    process.exit(0)
  }
  if (offline) {
    const rows = await harness.runAll()
    const failed = rows.filter((r) => r.fails.length)
    console.log(JSON.stringify({ mode: "offline (recorded model outputs; NOT live answer quality)", ok: !failed.length, pass: rows.length - failed.length, total: rows.length,
      results: rows.map((r) => ({ id: r.id, result: r.fails.length ? "FAIL" : "PASS", status: r.status, attempts: r.attempts, fails: r.fails })) }, null, 2))
    process.exit(0)
  }
  const { repairLoopVoiceEchoChecks, isProviderErrorAnswer } = await import("../src/lib/kompasDissection.ts")
  const base = process.env.KOMPAS_BASE_URL || "https://job-dashboard-fawn.vercel.app"
  const results = []
  for (const c of harness.CASES) {
    const history = harness.PREVIOUS_TURNS
    const fails = []
    let text = "", repair = null
    try {
      const response = await fetch(new URL("/api/kompas/answer", base), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ stream: false, question: c.question, history, config: { level: "director", interviewer: "director", responseCalibration: "three-level-v1", resume: harness.RESUME } }),
        signal: AbortSignal.timeout(90000),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) fails.push(`HTTP ${response.status} ${body.code || ""}`.trim())
      text = String(body.text || "")
      repair = body.repair || null
    } catch (error) { fails.push(`request failed: ${error?.name || "error"}`) }
    if (!fails.length) {
      if (!text.trim()) fails.push("blank answer")
      if (isProviderErrorAnswer(text)) fails.push("provider error text shown as the answer")
      for (const item of repairLoopVoiceEchoChecks(c.question, text, harness.PREVIOUS_TURNS, harness.RESUME)) fails.push(item.slice(0, 120))
      if (repair && repair.attempts > 2) fails.push(`repair made ${repair.attempts} attempts, more than 2`)
    }
    results.push({ id: c.id, result: fails.length ? "FAIL" : "PASS", repair: repair ? { status: repair.status, attempts: repair.attempts } : null, words: text.trim() ? text.trim().split(/\s+/).length : 0, fails })
    process.stderr.write(`${fails.length ? "FAIL" : "PASS"} ${c.id}\n`)
  }
  const failed = results.filter((r) => r.result === "FAIL").length
  console.log(JSON.stringify({ mode: "live", origin: base, ok: !failed, pass: results.length - failed, total: results.length, results }, null, 2))
  process.exit(failed ? 1 : 0)
}
if (!token && !offline) {
  console.error("KOMPAS_EVAL_TOKEN is not set. No production call was made. Put a Supabase access token in the environment and run this again.")
  process.exit(2)
}

const origin = process.env.KOMPAS_BASE_URL || "https://job-dashboard-fawn.vercel.app"
const set = process.env.KOMPAS_EVAL_SET || "all"
const resume = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const fixture = JSON.parse(readFileSync(new URL("./fixtures/kompas-evaluation/interview-50.json", import.meta.url), "utf8"))
const levels = ["engineer", "director", "architect"]

const sample = [
  "What does residual risk mean?",
  "What is the difference between a policy deviation and a policy exception?",
  "Tell me about a time you challenged a weak remediation plan.",
  "How do you assess business impact and residual risk?",
  "Write a Python function that returns the findings still open after 30 days.",
]
// r7: the canonical sample set's hash. Changing a sample question on purpose means updating this value in the same commit.
const SAMPLE_HASH = "f95c6f6db6de138a"
const integrity = H.canonicalIntegrity(sample, SAMPLE_HASH)
if (integrity.length) {
  console.error(`Canonical question set failed its integrity check: ${integrity.join("; ")}. No answers were judged.`)
  process.exit(1)
}
const evidencePath = process.env.KOMPAS_EVAL_EVIDENCE || ""
const recorded = new Map(H.readEvidence(evidencePath).rows.map((row) => [H.evidenceKey(row), row]))
const bankN = Math.max(1, Number(process.env.KOMPAS_EVAL_BANK_N || 1))
function bankSet() {
  const out = []
  for (const role of ROLES) {
    const qs = bankQuestions(role)
    const byKind = {}
    for (const x of qs) (byKind[x.kind] ||= []).push(x)
    for (const kind of Object.keys(byKind)) for (const x of byKind[kind].slice(0, bankN)) out.push({ ...x, role, resume: loadBank(role).resume })
  }
  return out
}
const hitachi = fixture.filter((item) => item.chain === "hitachi-grc").sort((a, b) => a.step - b.step).map((item) => item.question)

/** Offline: the code path a live answer passes through, with no model. First word is when the draft's opening exists. */
function askOffline(question, level, history, sources = resume) {
  const began = performance.now()
  question = normalizeAskText(question)
  dissectQuestion(question, sources)
  const draft = draftSpokenAnswer(question, level, sources)
  const firstWordMs = performance.now() - began
  const previous = history.length ? history[history.length - 1].a : ""
  const settled = settleSpokenAnswer(question, draft, level, sources, previous)
  const text = applyGuards(settled.text, null, new Set(), new Set()).text
  return { text, repair: null, firstWordMs, finishMs: performance.now() - began }
}

/** Nearest-rank percentile, so p95 of a small sample is a real observed value, never an interpolation. */
function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] * 1000) / 1000
}

async function ask(question, level, history, sources = resume) {
  if (offline) return askOffline(question, level, history, sources)
  const began = performance.now()
  const response = await fetch(new URL("/api/kompas/answer", origin), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      stream: false,
      question,
      history,
      config: { level, interviewer: level, responseCalibration: "three-level-v1", resume: sources },
    }),
    signal: AbortSignal.timeout(90000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.quiet || body.unavailable || !body.text) {
    throw new Error(`HTTP ${response.status} ${body.code || ""}`.trim())
  }
  const finishMs = performance.now() - began
  return { text: String(body.text), repair: body.repair || null, firstWordMs: finishMs, finishMs }
}

const rows = []
const repairs = []
const timings = []
const extra = []
async function run(questions, chained, setName = set) {
  for (const level of levels) {
    const history = []
    for (const item of questions) {
      const { q: question, resume: sources = resume, premise = "" } = typeof item === "string" ? { q: item } : item
      const key = H.evidenceKey({ set: setName, level, question })
      let got = recorded.get(key)
      if (got) process.stderr.write(`kept from evidence ${level}: ${question}\n`)
      else {
        process.stderr.write(`asking ${level}: ${question}\n`)
        try { got = { set: setName, level, question, ...(await ask(question, level, chained ? history.slice() : [], sources)) } }
        catch (error) { got = { set: setName, level, question, text: "", error: String(error?.message || error).slice(0, 120), firstWordMs: null, finishMs: null } }
        H.appendEvidence(evidencePath, got)
      }
      const { text, repair, firstWordMs, finishMs } = got
      for (const f of H.answerFailures({ question, text, sources, premise })) extra.push(`${f} for ${level}: ${question.slice(0, 80)}`)
      if (got.error) extra.push(`request failed (${got.error}) for ${level}: ${question.slice(0, 80)}`)
      if (!String(text || "").trim()) continue
      rows.push({ question, level, text, sources })
      timings.push({ level, firstWordMs, finishMs })
      if (repair) repairs.push({ level, question, ...repair })
      if (chained) history.push({ q: question, a: text })
    }
  }
}
if (set === "sample" || set === "all") await run(sample, false)
if (set === "hitachi" || set === "all") await run(hitachi, true)
if (set === "banks") await run(bankSet(), false, "banks")

// r7: each answer is judged against its own sources (the bank dossiers differ from the sample resume). Failsafe: one
// group per distinct source text, so the sample and hitachi sets are judged exactly as before.
const groups = new Map()
for (const row of rows) { const k = row.sources || resume; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ question: row.question, level: row.level, text: row.text }) }
const judged = { failures: [], warnings: [] }
for (const [sources, group] of groups) { const j = evaluateLiveAnswers(group, sources); judged.failures.push(...j.failures); judged.warnings.push(...j.warnings) }
const criteria = rows.flatMap((row) => criteriaMisses(row.question, row.text).map((miss) => `missing ${miss.check} for ${row.level}: ${row.question}`))
const failures = [...new Set([...judged.failures, ...criteria, ...extra])]
const final = H.verdict(rows, failures, offline ? H.OFFLINE_LABEL : H.LIVE_LABEL)
const latency = Object.fromEntries(levels.map((level) => {
  const mine = timings.filter((t) => t.level === level)
  const first = mine.map((t) => t.firstWordMs)
  const finish = mine.map((t) => t.finishMs)
  return [level, { n: mine.length, firstWordMs: { p50: percentile(first, 50), p95: percentile(first, 95) }, finishMs: { p50: percentile(finish, 50), p95: percentile(finish, 95) } }]
}))
const report = {
  mode: offline ? "offline (code-level stand-in; NOT live answer quality; timings exclude model and network)" : "live",
  evidence: final.evidence,
  origin: offline ? null : origin,
  set,
  questions: new Set(rows.map((row) => row.question)).size,
  answers: rows.length,
  ok: final.ok,
  failures: final.failures,
  warnings: judged.warnings,
  repairs: repairs.map((r) => ({ level: r.level, question: r.question.slice(0, 80), status: r.status, attempts: r.attempts, missing: r.missing?.length || 0, stillMissing: r.stillMissing?.length || 0, survived: r.survived })),
  words: rows.map((row) => ({ level: row.level, words: row.text.trim().split(/\s+/).length, question: row.question.slice(0, 80) })),
  latency: { reportingOnly: true, ...latency },
}
console.log(JSON.stringify(report, null, 2))
if (evidencePath) {
  H.writeReportAtomic(`${evidencePath}.report.json`, report)
  H.writeTextAtomic(`${evidencePath}.scorecard.md`, H.humanScorecard(rows, final.evidence))
}
// Offline is reporting only: drafts are a stand-in, so their failures inform and never gate. Live: any failure, or
// nothing judged at all (no pass on empty), exits 1.
if (!final.ok && !offline) process.exit(1)
