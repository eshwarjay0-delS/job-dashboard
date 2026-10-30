// Owner rule (no logistics in Kompas answers), 30 Oct 2026 10:11 AM CT: pay and rate asks are skipped on the live path
// (kompasAnswerService runs serverWithoutLogistics(withoutLogistics(q)) before any model call). Technical asks that share
// a word ("rate limiting", "salary data pipeline") are still answered.
import test from "node:test"
import assert from "node:assert/strict"
import { withoutLogistics } from "../../src/lib/kompasRelevance.ts"
import { logisticsBackstop } from "../../src/lib/kompasLogistics.ts"

const strip = (q) => logisticsBackstop(withoutLogistics(q))
const PAY = [
  "What is your expected hourly rate?", "What is your expected hourly rate", "What are your salary expectations?",
  "What's your pay rate?", "What are your compensation expectations?", "What is your expected salary?",
  "What is your expected pay?", "What rate are you looking for?", "What's your hourly rate?", "What is your desired pay?",
  "What hourly rate are you looking for?", "What pay are you expecting?", "What is your expected compensation?",
]
const TECH = [
  "Explain rate limiting in APIs", "How did you implement API rate limiting?", "Tell me about the salary data pipeline you built",
  "How did you secure the payroll system?", "What error rate did you see after the cutover?", "How did you protect compensation data in Workday?",
]
test("pay and rate asks are skipped before the model", () => { for (const q of PAY) assert.equal(strip(q), "", q) })
test("technical asks sharing a pay word are answered", () => { for (const q of TECH) assert.equal(strip(q), q, q) })
