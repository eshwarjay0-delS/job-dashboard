#!/usr/bin/env node
// Kompas level-personality eval.
// Intro + five questions + the IAM/Saviynt question, at three levels.
// Uses the app LLM path only when a real provider key is already in the environment.
// Does not read or set KOMPAS_VERCEL_API_TOKEN. Does not print secrets.
// With no usable key, writes the deterministic fallback checks and says live samples need a key.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  evaluateFallbackMatrix,
  modelKeyUsable,
  personalityContract,
  applyPersonalityFilter,
} from "../src/lib/kompasLevelPersonality.ts"
import { personalityPrompt } from "../src/lib/kompasLevelPersonalityPrompt.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outPath = join(root, "docs/kompas-eval/levels-results.md")

function configured(env = process.env) {
  return ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY"]
    .filter((name) => modelKeyUsable(env[name]))
}

function redact(value) {
  return String(value || "").replace(/\b(?:sk-or-|sk-ant-|gsk_|AIza)[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
}

function mark(ok) {
  return ok ? "pass" : "fail"
}

function table(rows) {
  const header = "| Case | Level | Source | Words | Word band | Employer | Banned phrases | On topic | Hedges | Style | Result |"
  const rule = "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  const lines = rows.map((row) => {
    const a = row.assessment
    return `| ${row.id} | ${row.level} | ${row.source} | ${a.words} | ${mark(a.wordBand)} | ${mark(a.employer)} | ${mark(a.banned)} | ${mark(a.topic)} | ${mark(a.hedges)} | ${mark(a.style)} | ${mark(a.ok)} |`
  })
  return [header, rule, ...lines].join("\n")
}

function transcript(row) {
  return `### ${row.level} — ${row.id} — ${row.assessment.words} words\n\nSource: ${row.source}. This is not a live model sample.\n\n${row.text}\n`
}

async function liveRows(fallbackRows) {
  const names = configured()
  if (!names.length) return { rows: [], note: "Live model samples were not produced. No usable model key was in the environment. Placeholder keys are ignored. Live samples need a key." }
  let callLLM
  let resolveKeys
  try {
    const llm = await import("../src/lib/llm.ts")
    callLLM = llm.callLLM
    resolveKeys = llm.resolveKeys
  } catch (error) {
    return { rows: [], note: `Live model samples were not produced. The app LLM path did not load (${redact(error && error.message)}).` }
  }
  const keys = resolveKeys()
  const rows = []
  for (const sample of fallbackRows) {
    const spec = personalityContract(sample.level, sample.question)
    try {
      const first = await callLLM({
        keys,
        tier: "heavy",
        system: personalityPrompt(sample.level, sample.question),
        user: sample.question,
        maxTokens: spec.maxTokens,
        purpose: "other",
      })
      const filtered = await applyPersonalityFilter({
        level: sample.level,
        question: sample.question,
        text: first.text,
        regenerate: async (instruction) => {
          const again = await callLLM({
            keys,
            tier: "heavy",
            system: personalityPrompt(sample.level, sample.question),
            user: `${sample.question}\n\n${instruction}`,
            maxTokens: spec.maxTokens,
            purpose: "other",
          })
          return again.text
        },
      })
      rows.push({ ...sample, source: `live ${first.provider}`, text: filtered.text, assessment: filtered.assessment })
    } catch (error) {
      rows.push({
        ...sample,
        source: "live failed",
        text: "",
        assessment: { ...sample.assessment, words: 0, wordBand: false, topic: false, ok: false },
        error: redact(error && error.message),
      })
    }
  }
  return { rows, note: `Live model path ran with a key already in the environment (${names.join(", ")} names only).` }
}

const fallback = evaluateFallbackMatrix().map((row) => ({ ...row, source: "deterministic fallback" }))
const live = await liveRows(fallback)
const show = live.rows.length ? live.rows : fallback
const picked = ["architect", "director", "engineer"].map((level) => {
  const iam = show.find((row) => row.level === level && row.id === "iam" && row.text)
  const intro = show.find((row) => row.level === level && row.id === "intro" && row.text)
  return level === "engineer" ? intro : iam
}).filter(Boolean)

const body = `# Kompas level personality eval

Run date: 2026-11-28

Questions: introduction, technical (FortiGate-VM high availability), design (multi-region inspection), behavioral (cutover that had to stay up), security (SQL injection in Microsoft Sentinel), migration (Cisco FTD to Fortinet), and the multi-part IAM / Saviynt question. Three levels each.

${live.note}

The deterministic rows are the fallback the personality filter returns when a draft is missing or fails the contract. They are real output of this script. They are not fabricated model completions.

Employer failures include a claimed employer, title, or role that is not on the Houston resume, and any mix-in of the Saint Louis profile. A customer or partner who already ran a tool is allowed. Hedge failures are a separate column.

${table(show)}

## Deterministic fallback transcripts

One per level, copied from this run. Architect and Director are the IAM / Saviynt answer. Engineer is the introduction.

${picked.map(transcript).join("\n")}
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, body)
const failed = show.filter((row) => !row.assessment.ok)
console.log(`wrote ${outPath}`)
console.log(`${show.length} rows, ${failed.length} failed, live keys: ${configured().length}`)
if (failed.length) {
  for (const row of failed) console.log(JSON.stringify({ id: row.id, level: row.level, words: row.assessment.words, hedges: row.assessment.hedgeHits, employer: row.assessment.employerHits, style: row.assessment.styleHits, topic: row.assessment.topic }))
  process.exitCode = live.rows.length ? 0 : 1
}
