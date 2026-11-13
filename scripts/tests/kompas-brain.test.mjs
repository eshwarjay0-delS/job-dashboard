// Kompas brain: perceive, act, score, and replay. No model and no network.
import test from "node:test"
import assert from "node:assert/strict"
import {
  chooseAction, detectIntent, draftBooster, draftClarify, draftShortAnswer, emptyBrain,
  flagContradiction, isPartialQuestion, perceive, prewarmQuestion, replayBrain, scoreSuggestion, summarizeLine,
} from "../../src/lib/kompasBrain.ts"
import { screenSuggestion } from "../../src/lib/kompasSessionMind.ts"

const RESUME = `
Northwind — Senior ServiceNow Developer | Jul 2023 – Present
- Owned the service catalog for a team of five and checked in with users on each request.
- Built Flow Designer flows for HR cases.
`

const LONG = "So the control owner signs the exception before the release and the audit pack has to match the live setting or the release waits and the owner hears what is still open before anyone calls it done today."

const LABELED = [
  { who: "Them", text: "So the control owners are spread across three teams and the handoff is where it stalls.", action: "booster" },
  { who: "You", text: "I'm available in the Pittsburgh area, on site.", action: "hold" },
  { who: "Them", text: "So you would only work remote, right?", action: "flag-contradiction" },
  { who: "Them", text: LONG, action: "summarize" },
  { who: "Them", text: "Have you worked with Flow Designer?", action: "short-answer" },
  { who: "Them", text: "How would you design the", action: "prewarm" },
  { who: "Them", text: "Any questions before we wrap up?", action: "clarify" },
  { who: "Them", text: "What is Flow Designer?", action: "clarify" },
]

test("each action is a pure function and the policy is deterministic", () => {
  assert.equal(detectIntent(LONG), "long-statement")
  assert.equal(detectIntent("Have you worked with Flow Designer?"), "yes-no")
  assert.equal(detectIntent("Any questions before we wrap up?"), "wrap-up")
  assert.equal(isPartialQuestion("How would you design the"), true)
  assert.equal(chooseAction("yes-no", { contradiction: false, partial: false }), "short-answer")
  assert.equal(chooseAction("question", { contradiction: true, partial: true }), "flag-contradiction")
  assert.equal(summarizeLine(LONG).split(/\s+/).length <= 18, true)
  assert.match(draftBooster("the catalog stalled", RESUME), /catalog/i)
  assert.match(draftClarify("What is Flow Designer?"), /\?$/)
  assert.match(draftShortAnswer("Have you worked with Flow Designer?", RESUME), /^Yes, Flow Designer/)
  assert.equal(draftShortAnswer("Have you worked with Citibank?", RESUME), "Not directly.")
  assert.equal(prewarmQuestion("How would you design the"), "How would you design the?")
  const state = emptyBrain()
  const said = perceive(state, { who: "You", text: "I'm available in the Pittsburgh area, on site." }, RESUME)
  assert.match(flagContradiction("I would only work remote.", said.state), /Pittsburgh/)
  const bad = screenSuggestion("I'm not available in Pittsburgh.", "You: I'm available in the Pittsburgh area, on site.")
  assert.equal(bad.rewritten, true)
  assert.match(bad.line, /on site/i)
  assert.doesNotMatch(bad.line, /not available/i)
})

test("a contradicting suggestion is blocked and a private fact he did not say is dropped", () => {
  const state = perceive(emptyBrain(), { who: "You", text: "I'm available in the Pittsburgh area, on site." }).state
  const step = perceive(state, { who: "Them", text: "So you would only work remote, right?" }, RESUME)
  assert.equal(step.action, "flag-contradiction")
  assert.match(step.shown, /Pittsburgh/)
  assert.equal(step.scores.keep, true)
  assert.equal(step.scores.consistency, 1)
  const leaked = screenSuggestion("My visa is H-1B and my salary is 200000.", "")
  assert.equal(leaked.blocked, true)
  assert.equal(leaked.line, "")
  const weak = scoreSuggestion("Furthermore this leverages a comprehensive framework for the landscape.", state, RESUME)
  assert.equal(weak.keep, false)
})

test("replay of a labeled interview reports accuracy, latency, and contradiction rate", () => {
  const report = replayBrain(LABELED, RESUME)
  assert.equal(report.labeled, LABELED.length)
  assert.equal(report.correct, LABELED.length)
  assert.equal(report.accuracy, 1)
  assert.equal(report.contradictionRate, 0)
  assert.ok(report.maxMs < 150, String(report.maxMs))
  assert.ok(report.meanMs < 150, String(report.meanMs))
  const padding = []
  for (let i = 0; i < 80; i++) padding.push({ who: "Them", text: `The batch finished pass ${i} and the owner kept the old path for the review window.`, action: "explanation" })
  const padded = LABELED.concat(padding.map((row) => ({ who: row.who, text: row.text, action: "booster" })))
  const wide = replayBrain(padded, RESUME)
  assert.equal(wide.lines, padded.length)
  assert.ok(wide.maxMs < 150, String(wide.maxMs))
  assert.equal(wide.contradictionRate, 0)
  assert.ok(wide.accuracy >= 0.9, String(wide.accuracy))
})
