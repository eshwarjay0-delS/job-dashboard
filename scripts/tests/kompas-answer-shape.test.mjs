import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { gateDisplayedAnswer, jdGapBridge } from "../../src/lib/kompasConsistency.ts"
import { goldWordCount, loadGold } from "../../scripts/eval-gold.mjs"

const gold = loadGold(readFileSync(new URL("../fixtures/brain-gold-answers.md", import.meta.url), "utf8"))
const RESUME = [
  "Senior ServiceNow Developer at McKesson.",
  "Assists with ServiceNow platform incident resolution and tracks each ticket from creation to closure.",
  "Closed 12 change requests in one quarter and kept the business updated while the work moved.",
  "Built fraud investigation workflows for evidence, escalation, and audit documentation.",
  "Configured role-based access controls and segregation of duties for finance teams.",
  "Created dashboards for SLA adherence and compliance status across the business applications.",
].join(" ")

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

test("a short technical answer is extended and closes on a resume example", () => {
  const gated = gateDisplayedAnswer({
    question: "How would you investigate a phishing email?",
    raw: "I start with the message the employee forwarded.",
    resume: RESUME,
    source: RESUME,
  })
  assert.ok(gated.words >= Math.min(gated.ceiling, 120) || gated.words >= gated.floor)
  assert.match(gated.text, /^I /)
  assert.doesNotMatch(gated.text, /^Having\b|great question/i)
  if (gated.ceiling >= 120) assert.match(gated.text, /Example:/)
  const bullets = gated.text.split("\n").filter((line) => /^\s*[-•]/.test(line))
  assert.ok(bullets.length <= 8)
})

test("a JD-only tool is a hands-on bridge, not a stub", () => {
  const bridged = gateDisplayedAnswer({
    question: "How do you use Splunk?",
    raw: "That is not on my resume, so I will not invent it.",
    resume: RESUME,
    jd: "Splunk ES, CrowdStrike, Qualys",
    source: RESUME,
  })
  assert.match(bridged.text, /I've had less direct hands-on with Splunk/)
  assert.match(bridged.text, /transfers because/)
  assert.doesNotMatch(bridged.text, /not on my resume|would want to confirm/)
  assert.match(jdGapBridge("How do you use Splunk?", RESUME, "Splunk ES"), /less direct hands-on with Splunk/)
})

test("a candidate's employer from the transcript never enters the answer", () => {
  const gated = gateDisplayedAnswer({
    question: "Tell me about a time you led an incident.",
    raw: "At Northern Trust I led the fraud program for 40 people. I assist with ServiceNow incident resolution at McKesson and closed 12 change requests.",
    resume: RESUME,
    jd: "SOC analyst",
    source: RESUME,
    transcript: "You: At Northern Trust I led the fraud program.",
  })
  assert.doesNotMatch(gated.text, /Northern Trust/)
  assert.match(gated.text, /ServiceNow|McKesson|12/)
})

test("gold replay median is measured after the floor binds", () => {
  const counts = gold.items.map((item) => gateDisplayedAnswer({
    question: item.question,
    raw: item.answer.split(/\s+/).slice(0, 40).join(" "),
    resume: gold.resume,
    jd: gold.jd,
    source: gold.resume,
  }).words)
  const mid = median(counts)
  assert.ok(mid >= 40, `median ${mid}`)
  console.log(`replay median words ${mid}`)
})
