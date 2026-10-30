/**
 * r7 eval runner hardening (pending #28, 29 Oct 2026). Used by scripts/kompas-live-eval.mjs and the r7 folds.
 *  - evidence survives interrupted writes: one JSON line per answer, appended and flushed as it lands; a final report is
 *    written to a temp file and renamed, so a killed run leaves either the old report or the new one, never half of one.
 *    readEvidence() skips a torn last line instead of failing.
 *  - whitespace-safe intent: every question goes through normalizeAskText before intent is read.
 *  - canonical-question integrity: the canonical sets are hashed; a changed, duplicated or blank question fails the run
 *    before any answer is judged.
 *  - no pass on empty: zero judged answers is a failure, never "ok".
 *  - human scorecard: a markdown sheet a person fills in (relevance, speakable, first person, STAR, honest) per answer.
 *  - more detectors: blank, provider error, third person, surface rule (#27), wrong-premise adopted, invented numbers.
 * Honest labels: every verdict carries `evidence: "offline stand-in" | "live"`.
 */
import { appendFileSync, openSync, fsyncSync, closeSync, writeFileSync, renameSync, readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { normalizeAskText } from "../src/lib/kompasAskText.ts"
import { surfaceViolations } from "../src/lib/kompasSurfaceRule.ts"
import { isProviderErrorAnswer } from "../src/lib/kompasDissection.ts"

export const OFFLINE_LABEL = "offline stand-in (no model, no network): NOT live answer quality"
export const LIVE_LABEL = "live"

export function appendEvidence(path, row) {
  if (!path) return
  const fd = openSync(path, "a")
  try { appendFileSync(fd, JSON.stringify(row) + "\n"); fsyncSync(fd) } finally { closeSync(fd) }
}
export function writeReportAtomic(path, report) {
  if (!path) return
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(report, null, 2))
  renameSync(tmp, path)
}
/** Rows already recorded; a torn last line (killed mid-write) is skipped and counted. */
export function readEvidence(path) {
  if (!path || !existsSync(path)) return { rows: [], torn: 0 }
  const rows = []; let torn = 0
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { torn++ }
  }
  return { rows, torn }
}
export const evidenceKey = (row) => `${row.set}|${row.level}|${normalizeAskText(row.question)}`

export function canonicalHash(questions) {
  return createHash("sha256").update(questions.map(normalizeAskText).join("\n")).digest("hex").slice(0, 16)
}
/** Problems with a canonical set: blank, duplicate after normalising, or a hash that no longer matches. */
export function canonicalIntegrity(questions, expectedHash = "") {
  const problems = []
  if (!Array.isArray(questions) || !questions.length) return ["canonical set is empty"]
  const seen = new Set()
  questions.forEach((q, i) => {
    const n = normalizeAskText(q)
    if (!n) problems.push(`question ${i + 1} is blank`)
    else if (seen.has(n.toLowerCase())) problems.push(`question ${i + 1} duplicates an earlier one`)
    seen.add(n.toLowerCase())
  })
  if (expectedHash && canonicalHash(questions) !== expectedHash) problems.push(`canonical set changed (hash ${canonicalHash(questions)}, expected ${expectedHash})`)
  return problems
}

const THIRD = /\bthe candidate\b|\b(?:she|he) (?:led|built|ran|wrote|designed|owned)\b/i
const numbersIn = (s) => (String(s).match(/\b\d[\d,.]*\b/g) || []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, ""))
/** Failure detectors for one answer. `sources` is the resume/dossier text; `premise` is a wrong claim in the question. */
export function answerFailures({ question, text, sources = "", surface = "card", premise = "", name = "" }) {
  const t = String(text || "")
  if (!t.trim()) return ["blank answer"]
  const out = []
  if (isProviderErrorAnswer(t)) out.push("provider error text shown as the answer")
  const spoken = t.replace(/```[\s\S]*?(?:```|$)/g, " ")
  if (THIRD.test(spoken) || (name && new RegExp(`\\b${name}\\b (?:led|built|ran|wrote|designed|owned)`, "i").test(spoken))) out.push("third person")
  for (const v of surfaceViolations(question, t, surface)) if (v !== "blank answer") out.push(`surface: ${v}`)
  if (premise) {
    const p = premise.toLowerCase()
    const adopted = sentencesLower(spoken).some((s) => s.includes(p.toLowerCase()) && /\b(?:i|my|we)\b/.test(s) && !/\b(?:not|never|didn't|did not|wasn't|was not|actually|correct|resume)\b/.test(s))
    if (adopted) out.push(`adopted the wrong premise "${premise}"`)
  }
  const allowed = new Set([...numbersIn(sources), ...numbersIn(question)])
  const invented = numbersIn(spoken).filter((n) => !allowed.has(n) && !/^(?:[0-9])$/.test(n))
  if (sources && invented.length) out.push(`numbers not in the sources: ${[...new Set(invented)].join(", ")}`)
  return out
}
const sentencesLower = (t) => String(t).toLowerCase().split(/(?<=[.!?])\s+/)

/** Overall verdict. No pass on empty. */
export function verdict(rows, failures, evidence) {
  const judged = rows.filter((r) => r && typeof r.text === "string").length
  const empty = judged === 0
  return { evidence, judged, ok: !empty && failures.length === 0, failures: empty ? ["no answers were judged (no pass on empty)", ...failures] : failures }
}

export function humanScorecard(rows, evidence) {
  const head = `# Kompas answer scorecard (${evidence})\n\nScore each 0-2. Relevance: opens on the asked words. Speakable: you could say it as written. First person. STAR when a story is asked. Honest: nothing beyond the sources.\n\n| # | level | question | relevance | speakable | first person | STAR | honest | note |\n|---|---|---|---|---|---|---|---|---|\n`
  return head + rows.map((r, i) => `| ${i + 1} | ${r.level} | ${String(r.question).replace(/\|/g, "/").slice(0, 90)} |  |  |  |  |  |  |`).join("\n") + "\n"
}
export function writeTextAtomic(path, text) {
  if (!path) return
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, String(text))
  renameSync(tmp, path)
}
