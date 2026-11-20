// Offline 10-fold. No network and no model. The same Houston resume, ten times.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  enforceLongAnswer,
  factsHeld,
  groundedLongAnswer,
  hasHonestBridge,
  inventedClaims,
  scopeHeld,
  wordCount,
} from "../../src/lib/kompasGroundedFallback.ts"

const QUESTIONS = [
  "Tell me about yourself.",
  "How have you deployed FortiGate VMs in AWS?",
  "Walk me through migrating 21 Cisco FTDs across 6 AWS regions.",
  "Design a GWLB plus FortiGate inspection VPC.",
  "Active/Active vs Active/Passive FortiGate HA in AWS?",
  "How do you use FortiManager and FortiAnalyzer?",
  "Tell me about a cutover that went wrong.",
  "How much Terraform have you written?",
  "Have you run workloads on Graviton?",
  "You led that migration yourself, right?",
]

const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const live = readFileSync(new URL("../kompas-live-10fold.mjs", import.meta.url), "utf8")

test("a failed lane still has a cached resume answer in the service", () => {
  assert.match(service, /FALLBACK_MODEL/)
  assert.match(service, /deliverCached/)
  assert.match(service, /groundedLongAnswer/)
  assert.match(service, /enforceLongAnswer/)
})

test("refresh and start reuse an open interview instead of minting another", () => {
  assert.match(app, /function openInterview/)
  assert.match(app, /if \(existing\) \{ reopenInterview\(existing\); return; \}/)
  assert.match(app, /Start does not create a new interview/)
})

test("the live script keeps one session id and does not post a session per call", () => {
  assert.match(live, /SESSION_ID = "s-kompas-10fold-houston"/)
  assert.match(live, /sessionId: SESSION_ID/)
  assert.match(live, /\/dashboard\/kompas/)
  assert.doesNotMatch(live, /account-sessions[\s\S]{0,80}method:\s*"POST"/)
})

for (const question of QUESTIONS) {
  test(`10 folds stay delivered and grounded: ${question}`, () => {
    const seen = new Set()
    for (let run = 0; run < 10; run++) {
      const text = groundedLongAnswer(question)
      const again = enforceLongAnswer(question, run % 2 ? "" : "I led this at Cigna and cut it by 40 percent with Terraform.", "")
      seen.add(text)
      assert.equal(again, text)
      const n = wordCount(text)
      assert.ok(n >= 120 && n <= 180, `${n} words`)
      assert.equal(inventedClaims(question, text).length, 0)
      assert.equal(hasHonestBridge(question, text), true)
      assert.equal(scopeHeld(question, text), true)
      assert.equal(factsHeld(question, text), true)
      assert.equal(wordCount(text.split(/\s+/)[0] ? text : ""), n)
    }
    assert.equal(seen.size, 1)
  })
}
