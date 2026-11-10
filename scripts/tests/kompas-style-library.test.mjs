// The spoken style library is shared data. Five tellings of one question rotate.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  STYLE_OPENERS, STYLE_TRANSITIONS, STYLE_MOVES, STYLE_CLOSES, STYLE_EXEMPLARS,
  stylePrompt, styleRules, styleHasStock, styleIntent,
} from "../../src/lib/kompasStyleLibrary.ts"

const Q = "How would you configure the syslog relay to the SIEM?"

test("the library is compact curated data, not a transcript", () => {
  assert.ok(STYLE_OPENERS.length >= 5)
  assert.ok(STYLE_TRANSITIONS.length >= 6)
  assert.ok(STYLE_MOVES.length >= 3)
  assert.ok(STYLE_CLOSES.length >= 3)
  assert.ok(STYLE_EXEMPLARS.length >= 20)
  const intents = new Set(STYLE_EXEMPLARS.map((e) => e.intent))
  for (const intent of ["definition", "contrast", "howto", "incident", "story"]) assert.ok(intents.has(intent), intent)
  const blob = JSON.stringify(STYLE_EXEMPLARS)
  assert.doesNotMatch(blob, /youtube|WEBVTT|\[00:/i)
  assert.equal(styleHasStock(styleRules()), false)
})

test("five generations of one question do not share an opener or a stock line", () => {
  const openers = []
  for (let n = 0; n < 5; n++) {
    const block = stylePrompt(Q, n)
    assert.match(block, /STYLE INSPIRATION ONLY/)
    assert.match(block, /Do not copy/)
    assert.equal(styleHasStock(block), false)
    const notes = block.split("\n").filter((line) => line.startsWith("- "))
    assert.ok(notes.length >= 2 && notes.length <= 3, notes.join("|"))
    const opener = (block.match(/This telling opens with: (.+)/) || [])[1]
    assert.ok(opener, block)
    openers.push(opener)
  }
  assert.equal(new Set(openers).size, 5)
  assert.equal(styleIntent(Q), styleIntent(Q))
})

test("the sheet generator and the live answer both read the library", () => {
  const prep = readFileSync(new URL("../../src/app/api/kompas/prep/route.ts", import.meta.url), "utf8")
  const live = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const dossier = readFileSync(new URL("../../src/lib/kompas-dossier-bots.ts", import.meta.url), "utf8")
  assert.match(prep, /styleRules\(\)/)
  assert.match(live, /stylePrompt\(question, historyArr\.length\)/)
  assert.match(dossier, /three or four points/)
  assert.match(dossier, /No fake event id/)
})
