import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dropUnknownToolSentences, meetsLengthFloor, resumeToolLexicon } from "../../src/lib/kompasGuards.ts"
import { clarifierNeeded, clarifyingFromQuestion } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
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
  assert.ok(clarifyingFromQuestion("Did you design it alone?").length >= 1)
})

test("the model files stay behind a kill switch and are not on the first paint", () => {
  assert.match(app, /QUESTION_PAUSE_MS = 700/)
  assert.match(app, /KOMPAS_VAD === "off"/)
  assert.match(app, /maybeLoadSilero/)
  assert.match(app, /cap\.forceYou/)
  assert.match(app, /__kompasFirstWordDeadline = Date\.now\(\) \+ 2000/)
  assert.doesNotMatch(app, /from "@ricky0123\/vad-web"/)
  assert.doesNotMatch(app, /cheating-daddy|cheating_daddy/)
})
