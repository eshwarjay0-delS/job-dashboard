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
 *   KOMPAS_EVAL_SET   sample | hitachi | all (default all)
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
 */
import { readFileSync } from "node:fs"
import { evaluateLiveAnswers, draftSpokenAnswer, settleSpokenAnswer, dissectQuestion } from "../src/lib/kompasDissection.ts"
import { applyGuards } from "../src/lib/kompasGuards.ts"
import { criteriaMisses } from "../src/lib/kompasEvalCriteria.ts"
import { performance } from "node:perf_hooks"

const offline = process.env.KOMPAS_EVAL_OFFLINE === "1"
const token = process.env.KOMPAS_EVAL_TOKEN || ""
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
const hitachi = fixture.filter((item) => item.chain === "hitachi-grc").sort((a, b) => a.step - b.step).map((item) => item.question)

/** Offline: the code path a live answer passes through, with no model. First word is when the draft's opening exists. */
function askOffline(question, level, history) {
  const began = performance.now()
  dissectQuestion(question, resume)
  const draft = draftSpokenAnswer(question, level, resume)
  const firstWordMs = performance.now() - began
  const previous = history.length ? history[history.length - 1].a : ""
  const settled = settleSpokenAnswer(question, draft, level, resume, previous)
  const text = applyGuards(settled.text, null, new Set(), new Set()).text
  return { text, repair: null, firstWordMs, finishMs: performance.now() - began }
}

/** Nearest-rank percentile, so p95 of a small sample is a real observed value, never an interpolation. */
function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] * 1000) / 1000
}

async function ask(question, level, history) {
  if (offline) return askOffline(question, level, history)
  const began = performance.now()
  const response = await fetch(new URL("/api/kompas/answer", origin), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      stream: false,
      question,
      history,
      config: { level, interviewer: level, responseCalibration: "three-level-v1", resume },
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
async function run(questions, chained) {
  for (const level of levels) {
    const history = []
    for (const question of questions) {
      process.stderr.write(`asking ${level}: ${question}\n`)
      const { text, repair, firstWordMs, finishMs } = await ask(question, level, chained ? history.slice() : [])
      rows.push({ question, level, text })
      timings.push({ level, firstWordMs, finishMs })
      if (repair) repairs.push({ level, question, ...repair })
      if (chained) history.push({ q: question, a: text })
    }
  }
}
if (set === "sample" || set === "all") await run(sample, false)
if (set === "hitachi" || set === "all") await run(hitachi, true)

const judged = evaluateLiveAnswers(rows, resume)
const criteria = rows.flatMap((row) => criteriaMisses(row.question, row.text).map((miss) => `missing ${miss.check} for ${row.level}: ${row.question}`))
const failures = [...judged.failures, ...criteria]
const latency = Object.fromEntries(levels.map((level) => {
  const mine = timings.filter((t) => t.level === level)
  const first = mine.map((t) => t.firstWordMs)
  const finish = mine.map((t) => t.finishMs)
  return [level, { n: mine.length, firstWordMs: { p50: percentile(first, 50), p95: percentile(first, 95) }, finishMs: { p50: percentile(finish, 50), p95: percentile(finish, 95) } }]
}))
const report = {
  mode: offline ? "offline (code-level stand-in; NOT live answer quality; timings exclude model and network)" : "live",
  origin: offline ? null : origin,
  set,
  questions: new Set(rows.map((row) => row.question)).size,
  answers: rows.length,
  ok: failures.length === 0,
  failures,
  warnings: judged.warnings,
  repairs: repairs.map((r) => ({ level: r.level, question: r.question.slice(0, 80), status: r.status, attempts: r.attempts, missing: r.missing?.length || 0, stillMissing: r.stillMissing?.length || 0, survived: r.survived })),
  words: rows.map((row) => ({ level: row.level, words: row.text.trim().split(/\s+/).length, question: row.question.slice(0, 80) })),
  latency: { reportingOnly: true, ...latency },
}
console.log(JSON.stringify(report, null, 2))
// Offline is reporting only: drafts are a stand-in, so their failures inform and never gate.
if (failures.length && !offline) process.exit(1)
