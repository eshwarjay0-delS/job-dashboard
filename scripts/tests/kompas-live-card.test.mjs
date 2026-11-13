// Phone-card fixes: question stays, connectors are once, a 422 clip is held, stages are timed.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"
import { repairDictation } from "../../src/lib/kompasDictation.ts"
import { instantSpokenLine, stageGaps } from "../../src/lib/kompasLatency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("a connector is used once per section and never in front of a dash", () => {
  const card = presentSpokenAnswer(
    "Tell me about the IAM rollout and what you changed after it failed.",
    "- I led the IAM implementation for CVS Health. - I integrated HashiCorp Vault. - I validated secret access via audit logs. - I added a pre-sync health check. The rollout stopped failing.",
    "I led the IAM implementation.",
  )
  assert.doesNotMatch(card, /First, -/)
  assert.doesNotMatch(card, /Then, -/)
  assert.doesNotMatch(card, /^…$/m)
  const firsts = card.match(/^- First,/gm) || []
  const thens = card.match(/^- Then,/gm) || []
  assert.equal(firsts.length, 1)
  assert.equal(thens.length, 1)
  assert.match(card, /\*\*Claim\*\*/)
})

const TELECOM = "My basic strategy is to turn business and operational needs into a telecom design that guarantees reliability, security, and scalability. - First I map those needs to coverage and capacity models, selecting appropriate wireless mesh or backup links where appropriate. - Then I build the architecture using routing policies, controls, and encryption to meet the defined targets. - Finally I validate the design in lab and pilot trials and confirm performance through continuous monitoring."
const TELECOM_Q = "How would you design a telecom network for business and operational needs?"
const STUTTERED = [
  "**Claim**",
  "- My basic strategy is to turn business and operational needs into a telecom design that guarantees reliability, security, and scalability.",
  "…",
  "**Context**",
  "- First, - First I map those needs to coverage and capacity models, selecting appropriate wireless mesh or backup links where appropriate.",
  "- First, - Then I build the architecture using routing policies, controls, and encryption to meet the defined targets.",
  "- First, - Finally I validate the design in lab and pilot trials and confirm performance through continuous monitoring.",
].join("\n")

function assertTelecom(card) {
  const bullets = card.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2))
  for (const bullet of bullets) {
    assert.doesNotMatch(bullet, /^(?:First|Then|Finally|The result)\b[:,]?\s+-/)
    assert.doesNotMatch(bullet, /^(?:First|Then|Finally),\s+(?:First|Then|Finally)\b/)
  }
  assert.equal(bullets.some((b) => b.startsWith("First, I map those needs")), true)
  assert.equal(bullets.some((b) => b.startsWith("Then, I build the architecture")), true)
  assert.equal(bullets.some((b) => b.startsWith("Finally, I validate the design")), true)
  assert.doesNotMatch(card, /^…$/m)
  assert.match(card, /\*\*Claim\*\*/)
  assert.match(card, /\*\*Context\*\*/)
}

test("the 11:04 telecom card does not stutter a connector onto First, Then, or Finally", () => {
  assertTelecom(presentSpokenAnswer(TELECOM_Q, TELECOM))
  assertTelecom(presentSpokenAnswer(TELECOM_Q, STUTTERED))
  const start = app.indexOf("function peelBullet(")
  const end = app.indexOf("\nfunction answerLines(")
  const ctx = {}
  vm.runInContext(app.slice(start, end) + "\nthis.presentAnswer = presentAnswer;", vm.createContext(ctx))
  assertTelecom(ctx.presentAnswer(TELECOM_Q, TELECOM, ""))
  assertTelecom(ctx.presentAnswer(TELECOM_Q, STUTTERED, ""))
})

test("common speech mishearings become the domain term before the question is shown", () => {
  assert.equal(repairDictation("how do you use the cm?"), "how do you use the SIEM?")
  assert.equal(repairDictation("see em alerts"), "SIEM alerts")
  assert.equal(repairDictation("sim."), "SIEM.")
  assert.equal(repairDictation("sore playbook"), "SOAR playbook")
  assert.equal(repairDictation("our i am solution"), "our IAM solution")
  assert.match(app, /function fixPhrases/)
})

test("the question box stays on a finished card and a one-word caption is not shown", () => {
  assert.match(app, /function framedQuestion/)
  assert.match(app, /classList\.remove\("q-away"\)/)
  assert.doesNotMatch(app, /classList\.add\("q-away"\)/)
  const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
  assert.match(css, /\.card\.q-away \.q\{[^}]*opacity:1/)
  assert.doesNotMatch(css, /\.card\.q-away \.q\{[^}]*max-height:0/)
  assert.match(app, /function strayCaption/)
  assert.match(app, /instantSpokenLine/)
})

test("stage gaps name the wait before the model, and the instant line does not claim a past job", () => {
  const gaps = stageGaps([
    { stage: "start", at: 0 },
    { stage: "brain", at: 40 },
    { stage: "instant", at: 55 },
    { stage: "model", at: 1800 },
  ])
  assert.equal(gaps.stages.brain, 40)
  assert.equal(gaps.stages.instant, 15)
  assert.equal(gaps.stages.model, 1745)
  assert.equal(gaps.total, 1800)
  const line = instantSpokenLine("How did you roll out IAM at CVS Health?")
  assert.match(line, /^I would start with /)
  assert.doesNotMatch(line, /\bI (?:led|worked|built)\b/)
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const instantAt = service.indexOf('type: "instant"')
  const modelAt = service.indexOf("await streamOpenRouter(")
  assert.ok(instantAt > 0 && modelAt > instantAt)
})
