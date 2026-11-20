// Deeper edges for one upgrade round: answers, clarifier, speed, and transcript.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { clarifyingFromQuestion, dropUnsupportedSentences, jdGapBridge } from "../../src/lib/kompasConsistency.ts"
import { lexicalTurn } from "../../public/kompas/vad-loader.mjs"

const RESUME = "Senior ServiceNow Developer at McKesson. Maintained the CMDB classes and their relationships."
const JD = "Splunk ES, CrowdStrike Falcon"
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

const openStart = app.indexOf("function spokenOpen")
const openEnd = app.indexOf("async function generateAnswerRequest")
const openCtx = vm.createContext({})
vm.runInContext(app.slice(openStart, openEnd), openCtx)

const splitStart = app.indexOf("function splitUtterances(")
const splitEnd = app.indexOf("function soundsLikeCandidate(")
const splitCtx = vm.createContext({})
vm.runInContext(app.slice(splitStart, splitEnd) + "\nthis.split = splitUtterances; this.who = utteranceWho; this.header = oneQuestionLine;", splitCtx)

test("answers: a mixed sentence and a JD tool claimed as experience both drop", () => {
  const bridge = jdGapBridge("How do you use Splunk?", RESUME, JD)
  const kept = dropUnsupportedSentences(
    `I maintained the CMDB and cut the queue 40% at Fabrikam. I deployed Splunk across the plant. I maintained the CMDB. ${bridge}`,
    RESUME,
    "How do you use Splunk?",
    JD,
  )
  assert.doesNotMatch(kept, /Fabrikam|40%|across the plant/)
  assert.match(kept, /I maintained the CMDB/)
  assert.match(kept, /less direct hands-on with Splunk/)
  assert.match(kept, /I would explain how Splunk works|less direct hands-on/)
})

test("clarifier: three live parts survive a trailing right?, a bare tag does not", () => {
  const resume = "Maintained the CMDB classes and their relationships."
  const three = clarifyingFromQuestion("What about discovery, and access, and incidents, right?", resume)
  assert.equal(three.length, 1)
  assert.match(three[0], /discovery/i)
  assert.match(three[0], /access/i)
  assert.match(three[0], /incidents/i)
  assert.doesNotMatch(three[0], /CMDB|failover|SD-WAN/)
  assert.deepEqual(clarifyingFromQuestion("You configured the KYC workflow, right?", resume), [])
  assert.deepEqual(clarifyingFromQuestion("right?", resume), [])
  const design = clarifyingFromQuestion("Did you design it alone, right?", resume)
  assert.match(design.join(" "), /design|alone/i)
  assert.doesNotMatch(design.join(" "), /failover|SD-WAN/)
})

test("speed: a right? question does not paint an opener and does not fire early", () => {
  const tagged = "How would you investigate a phishing email, right?"
  assert.equal(openCtx.spokenOpen(tagged), "")
  assert.equal(openCtx.spokenOpen("Do you use Splunk?"), "")
  assert.match(openCtx.spokenOpen("How would you investigate a phishing email?"), /^I would start with the closest work I have done/)
  assert.equal(lexicalTurn(tagged, 800), "wait")
  assert.equal(lexicalTurn(tagged, 999), "wait")
  assert.equal(lexicalTurn(tagged, 1400), "fire")
  assert.equal(lexicalTurn("right?", 1400), "wait")
  assert.equal(openCtx.firstTokenDecision(999, false, false), "wait")
  assert.equal(openCtx.firstTokenDecision(1000, false, false), "retry")
})

test("transcript: a candidate claim splits off a right? ask, and the tag survives one header", () => {
  const parts = splitCtx.split("I maintained the CMDB. How would you investigate a phishing email, right?")
  assert.equal(parts.length, 2)
  assert.equal(splitCtx.who(parts[0]), "You")
  assert.equal(splitCtx.who(parts[1]), "Them")
  assert.match(parts[1], /right\?$/)
  const header = splitCtx.header("Question: Question: How would you investigate a phishing email, right?")
  assert.equal((header.match(/Question:/g) || []).length, 1)
  assert.match(header, /right\?$/)
})
