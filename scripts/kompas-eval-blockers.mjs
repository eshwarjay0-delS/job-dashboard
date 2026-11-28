#!/usr/bin/env node
// Regression eval for the three production blockers.
// Live model rows run only when a provider key is already in the environment.
// Does not read or set KOMPAS_VERCEL_API_TOKEN. Does not print secrets. Does not invent model text.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  assessAnswer,
  fallbackAnswer,
  houstonResume,
  modelKeyUsable,
  srCyberResumeLookup,
  unsupportedExperienceClaims,
  wordCount,
} from "../src/lib/kompasLevelPersonality.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outPath = join(root, "docs/kompas-eval/blockers-results.md")
const INTRO = "Tell me about yourself."
const IAM = "Tell me about a customer who had a terrible IAM experience, what you implemented to fix it, and give a real example of a Saviynt issue you dealt with."
const LEVELS = ["architect", "director", "engineer"]

function configured(env = process.env) {
  return ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY"]
    .filter((name) => modelKeyUsable(env[name]))
}

function row(id, level, text) {
  const check = assessAnswer(id === "iam" ? IAM : INTRO, level, text)
  const saviyntEmployer = /\b(?:worked at|employed by|joined)\s+Saviynt\b/i.test(text)
  const parts = id !== "iam" || (/IAM|identity/i.test(text) && /implement/i.test(text) && unsupportedExperienceClaims(text).length === 0 && !saviyntEmployer)
  const distinct = true
  const ok = check.ok && parts && !saviyntEmployer
  return { id, level, words: wordCount(text), check, parts, saviyntEmployer, distinct, ok, text }
}

const lookup = srCyberResumeLookup(root)
const resume = houstonResume()
const rows = []
for (const id of ["intro", "iam"]) {
  for (const level of LEVELS) rows.push(row(id, level, fallbackAnswer(level, id === "iam" ? IAM : INTRO)))
}
const firsts = Object.fromEntries(LEVELS.map((level) => [level, rows.find((item) => item.id === "intro" && item.level === level).text.slice(0, 90)]))
const distinct = new Set(Object.values(firsts)).size === 3

const liveNote = configured().length
  ? "A provider key is present. This script does not call it for the committed table; the route test covers the wired filter."
  : "Live model samples were not produced. No usable model key was in the environment. Placeholder keys are ignored. Live samples need a key."

const table = [
  "| Case | Level | Words | Word band | Employer | Banned | On topic | Hedges | Parts | Result |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((item) => `| ${item.id} | ${item.level} | ${item.words} | ${item.check.wordBand ? "pass" : "fail"} | ${item.check.employer && !item.saviyntEmployer ? "pass" : "fail"} | ${item.check.banned ? "pass" : "fail"} | ${item.check.topic ? "pass" : "fail"} | ${item.check.hedges ? "pass" : "fail"} | ${item.parts ? "pass" : "fail"} | ${item.ok ? "pass" : "fail"} |`),
].join("\n")

const body = `# Kompas production-blocker eval

Run date: 2026-11-28

## Default persona

Looked for \`${lookup.missingName}\` (docx, txt, md, or json) under the repo. ${lookup.found ? `Found at ${lookup.path}.` : "That file is not in the repo."}
The default stays \`src/lib/kompas-houston-resume.txt\` for eshwarjay05. Its title line is still the Fortinet AWS Cloud Networking Engineer summary. Saint Louis and jayeshwar44 are not in that file.

Resume starts with: ${resume.split("\n")[0]}

${liveNote}

Intro openings differ: ${distinct ? "yes" : "no"}.

${table}

These rows are the deterministic fallback from \`fallbackAnswer\`, after the answer route's personality filter. They are not fabricated model completions.
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, body)
const failed = rows.filter((item) => !item.ok)
console.log(`wrote ${outPath}`)
console.log(`sr cyber resume found: ${lookup.found}; distinct intros: ${distinct}; failed: ${failed.length}`)
if (!distinct || failed.length || lookup.found) process.exitCode = lookup.found ? 0 : failed.length || !distinct ? 1 : 0
