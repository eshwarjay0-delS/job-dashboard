import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { repairStoryShape } from "../../src/lib/kompasGuards.ts"
import { gateDisplayedAnswer } from "../../src/lib/kompasConsistency.ts"
import { answerHash, claimFaithfulness, lengthFit, loadGold } from "../../scripts/eval-gold.mjs"

const RESUME = [
  "Led the response to a critical ransomware incident across 40 endpoints and contained it in 6 hours.",
  "Used CrowdStrike to isolate a host and Splunk to search the related alerts.",
  "Prioritized Qualys findings by exploitability, closing 12 internet-facing critical items in one week.",
].join("\n")
const ASK = "Tell me about a time you led the response to a critical security incident."
const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("a story opens on the action, stays mostly first person, and ends on a resume result", () => {
  const raw = [
    "A security incident is an unplanned event.",
    "The team noticed something odd on the floor.",
    "I isolated the host in CrowdStrike.",
    "I cut the segment off the network.",
    "We wrote a long status note about the weather.",
    "The containment finished in 6 hours.",
  ].join(" ")
  const shaped = repairStoryShape(ASK, raw, RESUME)
  assert.match(shaped.text, /^I isolated/)
  assert.doesNotMatch(shaped.text, /unplanned event|weather/)
  assert.match(shaped.text, /6 hours\.$/)
  const sentences = shaped.text.split(/(?<=[.!?])\s+/)
  const actions = sentences.filter((s) => /\bI\b/.test(s)).length
  assert.ok(actions / sentences.length >= 0.5)
  assert.equal(shaped.needsRewrite, false)
  const again = repairStoryShape(ASK, shaped.text, RESUME)
  assert.equal(again.text, shaped.text)
})

test("an invented result is not kept, and only then does the shape ask for a rewrite", () => {
  const raw = "I isolated the host in CrowdStrike. I cut the segment. I closed 99 findings in 3 days."
  const shaped = repairStoryShape(ASK, raw, RESUME)
  assert.doesNotMatch(shaped.text, /99|3 days/)
  assert.equal(shaped.needsRewrite, true)
  const good = "I led the response when ransomware hit. I isolated the host in CrowdStrike. The containment finished in 6 hours."
  assert.equal(repairStoryShape(ASK, good, RESUME).needsRewrite, false)
})

test("the model rewrite is reached only after the local shape repair", () => {
  const fn = service.slice(service.indexOf("async function repairStructure"), service.indexOf("function settleRepair"))
  assert.ok(fn.indexOf("repairStoryShape") < fn.indexOf("runRepairLoop"))
  assert.match(fn, /fetchOpenRouter/)
  assert.doesNotMatch(app, /eval:gold|eval-gold/)
})

test("the offline rubric scores length and claims without a model call", () => {
  const gold = loadGold(readFileSync(new URL("../fixtures/brain-gold-answers.md", import.meta.url), "utf8"))
  assert.equal(gold.items.length, 10)
  assert.equal(lengthFit(125, [80, 160]), 5)
  assert.equal(lengthFit(400, [80, 160]), 1)
  const faithful = claimFaithfulness("I contained it in 6 hours.", RESUME, gold.jd, ASK)
  assert.equal(faithful.score, 5)
  const invented = claimFaithfulness("I closed 99 findings with NotATool.", RESUME, gold.jd, ASK)
  assert.ok(invented.score < 5)
  assert.equal(answerHash(ASK, "same"), answerHash(ASK, "same"))
  assert.notEqual(answerHash(ASK, "same"), answerHash(ASK, "other"))
  const gated = gateDisplayedAnswer({ question: ASK, raw: "I led the response when ransomware hit. I isolated the host in CrowdStrike. The containment finished in 6 hours.", source: RESUME })
  assert.match(gated.text, /6 hours/)
  assert.equal(gated.reasons.includes("shape-rewrite"), false)
})
