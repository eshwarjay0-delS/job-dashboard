#!/usr/bin/env node
/**
 * Recorded-output harness for the two round-6 repair-loop checks (29 Oct 2026): "same answer as an earlier question"
 * and "speak in the first person". It runs the production loop (runRepairLoop in src/lib/kompasRepair.ts) and the
 * production checks (repairLoopVoiceEchoChecks) with the model call replaced by recorded outputs from
 * scripts/fixtures/kompas-repair/recorded-cases.json. OFFLINE: NOT live answer quality. The live run of the same cases
 * is `KOMPAS_EVAL_SET=repair node scripts/kompas-live-eval.mjs` with KOMPAS_EVAL_TOKEN set.
 *
 *   node scripts/kompas-repair-harness.mjs     prints PASS/FAIL per case, exits 1 on any FAIL
 */
import { readFileSync } from "node:fs"
import { runRepairLoop, MAX_REPAIR_ATTEMPTS } from "../src/lib/kompasRepair.ts"
import { repairLoopVoiceEchoChecks, isProviderErrorAnswer } from "../src/lib/kompasDissection.ts"
import { applyGuards } from "../src/lib/kompasGuards.ts"

export const RESUME = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const RAW = JSON.parse(readFileSync(new URL("./fixtures/kompas-repair/recorded-cases.json", import.meta.url), "utf8"))
const fill = (s) => String(s).replaceAll("{PREV}", RAW.previous)
export const PREVIOUS_TURNS = [{ q: RAW.previousQuestion, a: RAW.previous }]
export const CASES = RAW.cases.map((c) => ({ ...c, draft: fill(c.draft), rewrites: c.rewrites.map(fill) }))

export const checksFor = (question, turns = PREVIOUS_TURNS, resume = RESUME) => (text) => {
  const items = repairLoopVoiceEchoChecks(question, text, turns, resume)
  return { core: items, all: items }
}

/** Run one case. `rewriteFor(case)` returns the rewrite function; the default replays the recorded outputs. */
export async function runCase(c, rewriteFor = recorded) {
  const calls = []
  const rewrite = rewriteFor(c)
  const result = await runRepairLoop(c.draft, {
    checks: checksFor(c.question),
    hasKey: true,
    isProviderError: isProviderErrorAnswer,
    guard: (t) => applyGuards(t, null, new Set(), new Set()).text,
    rewrite: async (best, missing, attempt) => { calls.push({ attempt, missing }); return rewrite(best, missing, attempt) },
  })
  return { ...result, calls }
}

export function recorded(c) {
  return async (_best, _missing, attempt) => {
    const out = c.rewrites[attempt]
    if (out === "THROW") throw new Error("recorded network failure")
    return out ?? ""
  }
}

/** Judge one case against its expectation. Returns a list of plain-English failures (empty is a pass). */
export function judge(c, r) {
  const fails = []
  const want = c.expect
  if (r.calls.length > MAX_REPAIR_ATTEMPTS) fails.push(`made ${r.calls.length} model calls, more than ${MAX_REPAIR_ATTEMPTS}`)
  if (r.repair.status !== want.status) fails.push(`status ${r.repair.status}, expected ${want.status}`)
  if (r.repair.attempts !== want.attempts) fails.push(`attempts ${r.repair.attempts}, expected ${want.attempts}`)
  const expectedText = want.final === "original" ? c.draft : applyGuards(c.rewrites[Number(want.final.slice(-1)) - 1], null, new Set(), new Set()).text
  if (r.text !== expectedText) fails.push(`kept "${r.text.slice(0, 70)}…", expected the ${want.final}`)
  if (!r.text.trim()) fails.push("blank answer")
  if (isProviderErrorAnswer(r.text)) fails.push("provider error text kept as the answer")
  return fails
}

export async function runAll(rewriteFor = recorded) {
  const rows = []
  for (const c of CASES) {
    const r = await runCase(c, rewriteFor)
    rows.push({ id: c.id, check: c.check, status: r.repair.status, attempts: r.repair.attempts, fails: judge(c, r) })
  }
  return rows
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await runAll()
  for (const row of rows) console.log(`${row.fails.length ? "FAIL" : "PASS"}  ${row.id}  [${row.check}] status=${row.status} attempts=${row.attempts}${row.fails.length ? `\n      ${row.fails.join("\n      ")}` : ""}`)
  const failed = rows.filter((r) => r.fails.length).length
  console.log(`\n${rows.length - failed}/${rows.length} recorded repair cases pass (offline, recorded model outputs; NOT live answer quality)`)
  process.exitCode = failed ? 1 : 0
}
