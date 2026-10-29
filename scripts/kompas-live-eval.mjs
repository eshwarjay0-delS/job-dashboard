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
 */
import { readFileSync } from "node:fs"
import { evaluateLiveAnswers } from "../src/lib/kompasDissection.ts"
import { criteriaMisses } from "../src/lib/kompasEvalCriteria.ts"

const token = process.env.KOMPAS_EVAL_TOKEN || ""
if (!token) {
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

async function ask(question, level, history) {
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
  return { text: String(body.text), repair: body.repair || null }
}

const rows = []
const repairs = []
async function run(questions, chained) {
  for (const level of levels) {
    const history = []
    for (const question of questions) {
      process.stderr.write(`asking ${level}: ${question}\n`)
      const { text, repair } = await ask(question, level, chained ? history.slice() : [])
      rows.push({ question, level, text })
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
const report = {
  origin,
  set,
  questions: new Set(rows.map((row) => row.question)).size,
  answers: rows.length,
  ok: failures.length === 0,
  failures,
  warnings: judged.warnings,
  repairs: repairs.map((r) => ({ level: r.level, question: r.question.slice(0, 80), status: r.status, attempts: r.attempts, missing: r.missing?.length || 0, stillMissing: r.stillMissing?.length || 0, survived: r.survived })),
  words: rows.map((row) => ({ level: row.level, words: row.text.trim().split(/\s+/).length, question: row.question.slice(0, 80) })),
}
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exit(1)
