import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dropUnknownToolSentences, meetsLengthFloor, resumeToolLexicon } from "../../src/lib/kompasGuards.ts"
import { clarifierNeeded, clarifyingFromQuestion } from "../../src/lib/kompasConsistency.ts"

import { lexicalTurn, runSmartTurnOrLexical, vadEnabled, whisperFeatures, VAD_BASE, ORT_BASE, SMART_TURN_URL } from "../../public/kompas/vad-loader.mjs"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const loader = readFileSync(new URL("../../public/kompas/vad-loader.mjs", import.meta.url), "utf8")
const RESUME = "Senior ServiceNow Developer. ServiceNow ITSM and Flow Designer."

test("a capitalized tool missing from the resume is dropped, and the floor holds", () => {
  const lex = resumeToolLexicon(RESUME)
  assert.ok(lex.has("servicenow"))
  const kept = dropUnknownToolSentences("I use ServiceNow for incidents. I also wired Jira and Salesforce.", RESUME)
  assert.match(kept, /ServiceNow/)
  assert.doesNotMatch(kept, /Jira|Salesforce/)
  assert.equal(meetsLengthFloor("Tell me about a time you led an incident.", "word ".repeat(160), "architect", "long"), true)
  assert.equal(meetsLengthFloor("Tell me about a time you led an incident.", "too short", "architect", "long"), false)
})

test("a clarifier appears only when the resume lacks the named evidence", () => {
  assert.equal(clarifierNeeded("Have you used Qualys?", RESUME), true)
  assert.equal(clarifierNeeded("Have you used ServiceNow?", RESUME), false)
  assert.equal(clarifyingFromQuestion("What is routing?", RESUME).length, 0)
  assert.equal(clarifyingFromQuestion("Did you design it alone?").length, 0)
})

test("the model files stay behind a kill switch and are not on the first paint", () => {
  assert.match(app, /QUESTION_PAUSE_MS = 700/)
  assert.match(app, /KOMPAS_VAD === "off"/)
  assert.match(app, /maybeLoadSilero/)
  assert.match(app, /prepareSession/)
  assert.match(app, /cap\.forceYou/)
  assert.equal(vadEnabled(undefined), true)
  assert.equal(vadEnabled("off"), false)
  assert.match(VAD_BASE, /@ricky0123\/vad-web@0\.0\.31/)
  assert.match(ORT_BASE, /onnxruntime-web@1\.22\.0/)
  assert.match(SMART_TURN_URL, /f766f81d3cfdf7737ac64aad813d91bbfd56bf93/)
  assert.doesNotMatch(loader, /\/public\/.*\.onnx/)
  assert.doesNotMatch(loader, /status\(|console\.error/)
  assert.doesNotMatch(app, /cheating-daddy|cheating_daddy/)
  const startFn = app.slice(app.indexOf("async function start("), app.indexOf("async function stop("))
  assert.match(startFn, /prepareSession/)
})

test("a CDN failure keeps the lexical pause gate and shows no error", async () => {
  const errors = []
  const orig = console.error
  console.error = (...args) => { errors.push(args.join(" ")) }
  try {
    assert.equal(lexicalTurn("What tools do you know in SIEM?", 800), "fire")
    assert.equal(lexicalTurn("You used Splunk, right?", 800), "wait")
    assert.equal(lexicalTurn("The incident process you followed last quarter", 500), "wait")
    assert.equal(await runSmartTurnOrLexical({
      text: "The incident process you followed last quarter",
      pauseMs: 800,
      smartTurnFlag: "on",
      load: async () => { throw new Error("cdn down") },
    }), "wait")
    assert.equal(await runSmartTurnOrLexical({
      text: "What tools do you know in SIEM?",
      pauseMs: 800,
      smartTurnFlag: "on",
      load: async () => { throw new Error("cdn down") },
    }), "fire")
    assert.equal(errors.length, 0)
    assert.equal(whisperFeatures(new Float32Array(1600)).length, 80 * 800)
  } finally {
    console.error = orig
  }
})
