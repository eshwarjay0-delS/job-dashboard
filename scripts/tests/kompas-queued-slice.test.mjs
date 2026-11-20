import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { levelAwareBand, QUESTION_LENGTH } from "../../src/lib/kompasDissection.ts"
import { draftClarify } from "../../src/lib/kompasBrain.ts"
import { clarifyingFromQuestion, speakableLines } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const GOLD = [["a", 125, 90, 180], ["b", 152, 70, 160], ["c", 77, 75, 125], ["h", 68, 25, 80]]

test("long stories pass 300, floors stay under the ceiling, gold lengths hold", () => {
  for (let fold = 0; fold < 20; fold++) {
    const story = levelAwareBand("Tell me about a time you led an incident.", "architect", "long")
    assert.ok(story.ceiling > 300)
    assert.ok(story.aim > 300)
    assert.ok(story.floor < story.ceiling)
    const follow = levelAwareBand("How did you verify that?", "director", "balanced")
    assert.ok(follow.ceiling > follow.floor)
    assert.equal(QUESTION_LENGTH.star.architect.ceiling, 300)
    for (const [id, words, floor, ceiling] of GOLD) {
      if (id === "h") assert.ok(words > 50 && words <= ceiling)
      else assert.ok(words >= floor && words <= ceiling, id)
    }
    assert.equal(draftClarify("Did you design it alone?"), "Do you mean the overall design, or one piece such as failover?")
    assert.equal(draftClarify("What is routing?"), "")
    const two = clarifyingFromQuestion("Did you design the network alone? What about failover?")
    assert.ok(two.length >= 1 && two.length <= 2)
    const said = speakableLines("incident resolution and fraud investigation", "Assists with ServiceNow platform incident resolution and fraud investigation workflows for audit documentation.")
    assert.ok(said.length <= 2)
    assert.equal(speakableLines("routing tables", "Senior ServiceNow Developer with Flow Designer.").length, 0)
  }
  assert.match(app, /Start timed out\. No audio received\./)
  assert.match(app, /if \(running \|\| starting\) return/)
  assert.match(app, /Leave this session\? Your answers stay saved\./)
  assert.match(app, /card\.spoken = typeof text === "string"/)
  const src = app.slice(app.indexOf("function questionEnded("), app.indexOf("function paraphrasesOwn("))
  const ctx = vm.createContext({})
  vm.runInContext(src + "\nthis.ended = questionEnded;", ctx)
  assert.equal(ctx.ended("How would you investigate a phishing email and"), false)
})
