#!/usr/bin/env node
/**
 * Live Kompas relevance eval.
 *
 *   KOMPAS_EVAL_TOKEN='<supabase access token>' node scripts/kompas-live-eval.mjs
 *
 * The token is read from the environment only. It is never printed and never
 * stored. Without KOMPAS_EVAL_TOKEN the script exits 2 and does not call production.
 *
 * Optional:
 *   KOMPAS_BASE_URL   default https://job-dashboard-fawn.vercel.app
 *   KOMPAS_EVAL_MODEL set only when a model judge key is also present (not required)
 *
 * Fails when any answer is shared across different questions, when the three
 * modes are under 50% apart on length, depth, or confidence, when provider
 * error text comes back as the answer, when the first sentence misses the
 * question's terms, when the length is outside the mode band, or when the
 * answer uses a technical term that is not in the question or the sample resume.
 */
import { readFileSync } from "node:fs"
import { evaluateLiveAnswers } from "../src/lib/kompasDissection.ts"

const token = process.env.KOMPAS_EVAL_TOKEN || ""
if (!token) {
  console.error("KOMPAS_EVAL_TOKEN is not set. No production call was made. Put a Supabase access token in the environment and run this again.")
  process.exit(2)
}

const origin = process.env.KOMPAS_BASE_URL || "https://job-dashboard-fawn.vercel.app"
const resume = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const questions = [
  "What does residual risk mean?",
  "What is the difference between a policy deviation and a policy exception?",
  "Tell me about a time you challenged a weak remediation plan.",
  "How do you assess business impact and residual risk?",
]
const levels = ["engineer", "director", "architect"]

async function ask(question, level) {
  const response = await fetch(new URL("/api/kompas/answer", origin), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      stream: false,
      question,
      config: { level, interviewer: level, responseCalibration: "three-level-v1", resume },
    }),
    signal: AbortSignal.timeout(70000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.quiet || body.unavailable || !body.text) {
    throw new Error(`HTTP ${response.status} ${body.code || ""}`.trim())
  }
  return String(body.text)
}

const rows = []
for (const question of questions) {
  for (const level of levels) {
    process.stderr.write(`asking ${level}: ${question}\n`)
    rows.push({ question, level, text: await ask(question, level) })
  }
}
const judged = evaluateLiveAnswers(rows, resume)
const report = {
  origin,
  questions: questions.length,
  answers: rows.length,
  ok: judged.ok,
  failures: judged.failures,
  words: rows.map((row) => ({ level: row.level, words: row.text.trim().split(/\s+/).length, question: row.question })),
}
console.log(JSON.stringify(report, null, 2))
if (!judged.ok) process.exit(1)
