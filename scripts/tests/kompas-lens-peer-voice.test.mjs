// Peer voice (5 Nov 2026). OFFLINE: prompt block + deterministic composer. No live model.
import { test } from "node:test"
import assert from "node:assert/strict"
import { PEER_VOICE, REALISM, lensBlock, composeLensAnswer, peerVoiceLine, peerVoiceKind, realismMarkers, audienceGuidance } from "../../src/lib/kompasAudience.ts"
import { variant, LENSES } from "../kompas-lens-folds.mjs"
// Current master gates lensBlock behind KOMPAS_DESKTOP_LENS. This file checks the switch on, same as r1–r3.
process.env.KOMPAS_DESKTOP_LENS = "on"

const words = (s) => String(s).trim().split(/\s+/).length

test("PEER_VOICE is short, sourced, and rides with the existing lens block", () => {
  assert.match(PEER_VOICE, /teammate/)
  assert.match(PEER_VOICE, /bottleneck/)
  assert.match(PEER_VOICE, /Do not invent/)
  assert.doesNotMatch(PEER_VOICE, /\[ ___/)
  assert.ok(words(PEER_VOICE) <= 140, `PEER_VOICE is ${words(PEER_VOICE)} words`)
  assert.ok(words(REALISM) <= 170, `REALISM is ${words(REALISM)} words`)
  const g = audienceGuidance("practitioner", "What is zero trust?")
  assert.match(g, /PEER VOICE/)
  assert.match(g, /REALISM/)
  assert.match(lensBlock("director", "How would you investigate a failed access review?"), /PEER VOICE/)
  assert.equal(lensBlock("director", "What is your expected salary?"), "")
})

test("standard and deep answers include one shop-talk move; simple stays picture-first; no dated invention", () => {
  const v = variant(0)
  const standard = composeLensAnswer({ question: v.question, lens: "practitioner", depth: "standard", concept: v.concept, facts: v.facts })
  const deep = composeLensAnswer({ question: v.question, lens: "practitioner", depth: "deep", concept: v.concept, facts: v.facts })
  const simple = composeLensAnswer({ question: v.question, lens: "simple", depth: "simple", concept: v.concept, facts: v.facts })
  assert.match(standard, /What I would tell a teammate/)
  assert.match(deep, /I check what normal looks like before I treat a finding as done/)
  assert.doesNotMatch(simple, /What I would tell a teammate|The consequence is|I would warn a teammate/)
  assert.equal(realismMarkers(standard).shopTalk, true)
  assert.equal(realismMarkers(deep).shopTalk, true)
  assert.equal(realismMarkers(simple).shopTalk, false)
  const sourced = composeLensAnswer({
    question: "What is access review?",
    lens: "practitioner",
    depth: "standard",
    concept: { ...v.concept, bottleneck: "getting complete evidence from every owner" },
    facts: v.facts,
  })
  assert.match(sourced, /bottleneck is getting complete evidence from every owner/)
  assert.doesNotMatch(sourced, /\b(?:19|20)\d\d\b/)
})

test("exactly one shop-talk move, chosen in a fixed order, with no extra I-would-rather tics", () => {
  const v = variant(1)
  const base = { ...v.concept }
  assert.match(peerVoiceLine(base, "standard"), /tell a teammate is to watch the hard part/)
  assert.match(peerVoiceLine(base, "deep"), /I check what normal looks like/)
  assert.match(peerVoiceLine({ ...base, innerCheck: "the owner list" }, "standard"), /I check the owner list before I move on/)
  assert.match(peerVoiceLine({ ...base, consequence: "audit evidence goes missing" }, "standard"), /The consequence is audit evidence goes missing/)
  assert.match(peerVoiceLine({ ...base, warn: "turn on every rule at once" }, "standard"), /I would warn a teammate not to turn on every rule at once/)
  const preferred = peerVoiceLine({ ...base, bottleneck: "incomplete evidence", warn: "turn on every rule at once", consequence: "audits slip", innerCheck: "the owner list" }, "deep")
  assert.match(preferred, /bottleneck is incomplete evidence/)
  assert.doesNotMatch(preferred, /I would warn|The consequence is|I check the owner list/)
  for (const l of LENSES.filter((x) => x !== "simple")) {
    const t = composeLensAnswer({ question: v.question, lens: l, depth: "standard", concept: v.concept, facts: v.facts })
    const m = realismMarkers(t)
    assert.ok(m.shopTalk, l)
    assert.ok(m.tics <= 1, `${l} tics=${m.tics}`)
    assert.equal(m.unsourcedDated, 0)
    assert.equal((t.match(/What I would tell a teammate|The consequence is|I would warn a teammate/g) || []).length, 1, l)
  }
})

test("the shop-talk move follows the question, and a sourced line for that question wins", () => {
  assert.equal(peerVoiceKind("What was the bottleneck in access reviews?"), "bottleneck")
  assert.equal(peerVoiceKind("What would you warn a new teammate to avoid?"), "warn")
  assert.equal(peerVoiceKind("What was the impact if that check slipped?"), "consequence")
  assert.equal(peerVoiceKind("What advice would you tell a teammate?"), "advice")
  assert.equal(peerVoiceKind("How do you make sure before you send it?"), "inner")
  assert.equal(peerVoiceKind("What is multi-factor authentication?"), null)
  const v = variant(0)
  const base = { ...v.concept }
  assert.match(peerVoiceLine(base, "standard", "What was the bottleneck here?"), /watch the bottleneck/)
  assert.match(peerVoiceLine(base, "standard", "What would you warn someone to avoid?"), /not to treat the tool as the whole fix/)
  assert.match(peerVoiceLine(base, "standard", "What was the impact if that check slipped?"), /The consequence is what changes if you skip that check/)
  assert.match(peerVoiceLine({ ...base, bottleneck: "incomplete evidence" }, "standard", "What was the bottleneck here?"), /bottleneck is incomplete evidence/)
  const t = composeLensAnswer({ question: "What was the bottleneck in access reviews?", lens: "practitioner", depth: "standard", concept: v.concept, facts: v.facts })
  assert.match(t, /watch the bottleneck/)
  assert.doesNotMatch(t, /\b(?:19|20)\d\d\b/)
})
