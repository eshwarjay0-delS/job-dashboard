// Session memory, caption dedupe, and profile grounding. Offline.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  clearMemory, compactMemory, dedupeCaptionTokens, emptyMemory, expandFollowUp,
  groundToProfile, loadMemory, remember, saveMemory,
} from "../../src/lib/kompasSessionMemory.ts"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"

const RESUME = `
eshwarjay05
Northwind — Senior ServiceNow Developer
- Owned the service catalog for a team of five and checked in with users.
- Built Flow Designer flows for HR cases.
`

function chain() {
  let mem = emptyMemory("sess-1")
  mem = remember(mem, "How did you design the catalog?", "I chose Flow Designer. I also kept a manual queue. The team was five people.", RESUME)
  const why = expandFollowUp("why did you choose that?", mem)
  assert.match(why, /Flow Designer/)
  assert.match(why, /previous question/i)
  mem = remember(mem, "why did you choose that?", "I chose Flow Designer because the catalog needed one path.", RESUME)
  const size = expandFollowUp("how big was that team?", mem)
  assert.match(size, /five|team|Flow Designer/)
  const second = expandFollowUp("and the second one?", mem)
  assert.match(second, /manual queue|second/)
  mem = remember(mem, "and the second one?", "I also kept a manual queue beside Flow Designer.", RESUME)
  const fresh = expandFollowUp("How would you design a rollback for the catalog?", mem)
  assert.equal(fresh, "How would you design a rollback for the catalog?")
  return mem
}

test("a follow-up chain resolves that, the team, and the second item", () => {
  const mem = chain()
  assert.ok(mem.turns.length >= 3)
  const compact = compactMemory(mem)
  assert.ok(compact.recent.length <= 6)
  assert.match(compact.recent.map((turn) => turn.a).join(" "), /Flow Designer/)
})

test("memory survives a reload and a new session starts empty", () => {
  const store = new Map()
  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, value) },
    removeItem: (key) => { store.delete(key) },
  }
  const mem = chain()
  saveMemory(storage, mem)
  const loaded = loadMemory(storage, "sess-1")
  assert.equal(loaded.turns.length, mem.turns.length)
  assert.match(loaded.turns[0].a, /Flow Designer/)
  assert.equal(loadMemory(storage, "sess-2").turns.length, 0)
  clearMemory(storage, "sess-1")
  assert.equal(loadMemory(storage, "sess-1").turns.length, 0)
})

test("an invented employer and number are removed", () => {
  const mem = remember(emptyMemory("sess-1"), "How did you design the catalog?", "I chose Flow Designer for a team of five.", RESUME)
  const card = groundToProfile(
    "Have you used the Initech queue?",
    "At Initech I cut the queue by 90 percent. I chose Flow Designer for the catalog.",
    RESUME,
    mem,
  )
  assert.doesNotMatch(card, /Initech/)
  assert.doesNotMatch(card, /\b90\b/)
  assert.match(card, /Flow Designer|Not directly/)
  const missing = groundToProfile("Have you used Initech?", "At Initech I cut the queue by 90 percent.", RESUME, mem)
  assert.match(missing, /^Not directly, but /)
  assert.doesNotMatch(missing, /Initech|\b90\b/)
  assert.doesNotMatch(groundToProfile("What did you own?", "I owned the catalog. That part is not in the sources.", RESUME, mem), /not in the sources/i)
})

test("repeated caption tokens are dropped before the heard line", () => {
  const heard = dedupeCaptionTokens("Let's get started. ENDPORT, CITI, BANK, CITI, ENDPORT, ESSA, MUNICIPAL DIGITAL, ENDPORT,")
  assert.match(heard, /Let's get started/)
  assert.equal((heard.match(/ENDPORT/g) || []).length, 1)
  assert.equal((heard.match(/CITI/g) || []).length, 1)
  assert.match(heard, /MUNICIPAL DIGITAL/)
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  assert.match(app, /function dedupeCaptionTokens/)
  assert.match(app, /text = dedupeCaptionTokens\(applySttCorrections/)
  assert.match(app, /box\.hidden = true/)
  assert.match(app, /sessionMemoryPayload\(\)/)
})

test("First, in general, teams is not spoken", () => {
  const card = presentSpokenAnswer("What is a SIEM?", [
    "I correlate the alerts in the SIEM.",
    "First, in general, teams see the impact before they name a source.",
    "First, I keep the noisy rules in a review queue.",
  ].join("\n"))
  assert.doesNotMatch(card, /in general, teams/i)
  assert.equal((card.match(/\bFirst\b/g) || []).length <= 1, true)
})
