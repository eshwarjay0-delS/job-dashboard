// Taskmaster confirm run on 5af72c1: one tab track, merged turns, doubled Question header.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { levelAwareBand } from "../../src/lib/kompasDissection.ts"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"
import { gateDisplayedAnswer } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const start = app.indexOf("function splitUtterances(")
const end = app.indexOf("function soundsLikeCandidate(")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\nthis.split = splitUtterances; this.gated = isGatedQuestion; this.who = utteranceWho; this.header = oneQuestionLine;", ctx)

const MERGED = "Okay, but switches actually connecting devices what tools do you know in SIEM?"

test("merged tab turns split, and only a full interviewer question is gated", () => {
  const parts = ctx.split(MERGED)
  assert.ok(parts.length >= 2)
  assert.equal(ctx.gated("Splunk"), false)
  assert.equal(ctx.gated("- Splunk"), false)
  assert.equal(ctx.who("I use Splunk, QRadar and Microsoft Sentinel for the alerts."), "You")
  assert.equal(ctx.gated("What do you know about Splunk?"), true)
  assert.equal(ctx.who("What tools do you know in SIEM?"), "Them")
  const header = ctx.header("Question: Question: What tools do you know in SIEM and also the whole rest of the merged turn that should not stay on the card?")
  assert.equal((header.match(/Question:/g) || []).length, 1)
  assert.ok(header.replace(/^Question:\s*/, "").split(/\s+/).length <= 20)
  const story = levelAwareBand("Tell me about a time you led an incident.", "architect", "long")
  assert.ok(story.floor >= 150)
  assert.match(app, /sessionReadyUntil = Date\.now\(\) \+ 30000;\n  void start\(\)/)
  assert.equal(ctx.header("Question: Question: What tools do you know in SIEM?"), "Question: What tools do you know in SIEM?")
  assert.equal(ctx.header("Can you hear me?"), "")
  assert.equal(ctx.gated("THEM I use Splunk every day in my own work here."), false)
  assert.equal(ctx.who("I use Splunk, QRadar and Sentinel for the alerts I watch."), "You")
  const resume = "Assists with ServiceNow platform incident resolution and fraud investigation workflows."
  const dropped = presentSpokenAnswer("What tools have you worked on?", "I integrated BMC Remedy, Jira, and Salesforce. I once marked a legitimate admin login as a false positive.", resume)
  assert.doesNotMatch(dropped, /Remedy|Jira|Salesforce|false positive/)
  const bridged = gateDisplayedAnswer({ question: "Where do you see yourself after 5 years?", raw: "I would want to confirm that.", source: resume })
  assert.doesNotMatch(bridged.text, /not on my resume|would want to confirm/)
  assert.match(bridged.text, /ServiceNow|incident|fraud/i)
  const howto = levelAwareBand("How would you investigate a phishing email?", "architect", "long")
  assert.ok(howto.floor >= 120)
})
