import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { glossFor, validateStatement } from "../../src/lib/kompasGloss.ts"
import { lexiconClause } from "../../src/lib/kompasLexicon.ts"
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"

const RESUME = "SIEM analyst. Syslog feeds the collector. EDR on the endpoint."

const MISUSE = [
  "The SIEM feeds syslog into the collectors.",
  "Syslog comes from the SIEM.",
  "IAM is a log store for the alerts.",
  "The SIEM writes events into IAM.",
  "PAM is a SIEM.",
  "EDR is a SIEM.",
  "SOAR replaces syslog.",
  "SASE is a SIEM.",
  "TPRM feeds syslog.",
  "GRC is a SIEM.",
  "I worked nights as an unloader in Cincinnati.",
  "I spent four years at Citi on the night shift.",
]

test("a gloss is static, and a term without one stays unglossed", () => {
  const siem = glossFor("SIEM")
  assert.equal(siem.glossed, true)
  if (siem.glossed) {
    assert.match(siem.gloss.order, /Syslog feeds a SIEM/)
    assert.equal(siem.gloss.definition.includes("correlates"), true)
  }
  assert.deepEqual(glossFor("bnpl"), { glossed: false, unglossed: true })
  assert.equal(lexiconClause("eshwarjay05", "How do you use a SIEM?").includes("SIEM feeds syslog"), false)
  assert.match(lexiconClause("eshwarjay05", "How do you use a SIEM?"), /Syslog feeds a SIEM/)
})

test("every misuse line is blocked or rewritten off the wrong claim", () => {
  let blocked = 0
  for (const line of MISUSE) {
    const check = validateStatement(line, RESUME)
    const shown = check.ok ? check.line : check.line
    assert.equal(check.ok, false, line)
    assert.equal(/SIEM feeds syslog|is a SIEM|unloader|four years at Citi|IAM is a log store|SOAR replaces syslog|TPRM feeds syslog/i.test(shown), false, shown)
    blocked += 1
  }
  assert.equal(blocked, MISUSE.length)
})

test("known-good replay answers have zero validator false positives, under 5 ms a line", () => {
  const rows = readFileSync("scripts/fixtures/kompas-evaluation/replay-set.jsonl", "utf8").trim().split("\n").map((line) => JSON.parse(line))
  const answers = rows.map((row) => draftSpokenAnswer(row.question, "engineer", RESUME))
  let lines = 0
  let falsePositives = 0
  const started = performance.now()
  for (const answer of answers) {
    for (const sentence of answer.split(/(?<=[.!?])\s+/)) {
      lines += 1
      const check = validateStatement(sentence, RESUME)
      if (!check.ok) falsePositives += 1
    }
  }
  const perLine = (performance.now() - started) / lines
  console.log(JSON.stringify({ lines, falsePositives, perLineMs: Number(perLine.toFixed(3)) }))
  assert.equal(falsePositives, 0)
  assert.ok(perLine < 5)
})
