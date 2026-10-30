// Rounds 8-10 (29 Oct 2026): each new offline failure with a failing test and a failsafe. Offline and code-level only,
// NOT live answer quality. Proof that each fails without its fix: node scripts/kompas-fix-proof.mjs c9697ab <this file>.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dissectQuestion, cleanSpokenAsk, isProviderErrorAnswer, firstPersonRewrite, askedPartList, leadPhrase, draftSpokenAnswer, sameAnswerRatio, settleSpokenAnswer } from "../../src/lib/kompasDissection.ts"
import { smallTalkOnly, deriveByCode, questionForAnswer, tidySpokenAsk, rootAsk, orderedPartOf } from "../../src/lib/kompasAnswer.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")

test("asides and meeting housekeeping are small talk, not questions", () => {
  for (const t of ["mm-hm", "mhm, okay", "uh-huh", "got it, thanks", "I'm going to mute for a second", "let me check the time", "sorry, someone just walked in",
    "okay, I'm going to share my screen", "sorry, I'm on mute", "can everyone hear me okay"]) {
    assert.ok(smallTalkOnly(t), t)
    assert.equal(questionForAnswer(t, "", false, false, []), "", t)
  }
})
test("failsafe: an aside followed by a real ask, or housekeeping words inside a real ask, are not small talk", () => {
  for (const t of ["mm-hm. So how do you scope an access review?", "I'm going to share my screen: how would you fix this query?", "How do you mute an alert that keeps firing without losing it?"]) assert.ok(!smallTalkOnly(t), t)
})

test("SDK exception lines are provider errors and never shown", () => {
  for (const raw of ["openai.APIConnectionError: Connection error.", "anthropic.InternalServerError: overloaded_error", "openai.RateLimitError: Error code: 429",
    "anthropic.APIStatusError: 529 overloaded", "google.api_core.exceptions.ServiceUnavailable: 503", "httpx.ReadTimeout: timed out"]) {
    assert.equal(isProviderErrorAnswer(raw), true, raw)
    assert.equal(settleSpokenAnswer("What is residual risk?", raw, "director", RESUME).text, "", raw)
  }
})
test("failsafe: answers that name an exception class are kept", () => {
  for (const raw of ["The RateLimitError in our client told me the vendor throttled us, so I batched the requests.",
    "I traced the httpx.ReadTimeout to a proxy change and rolled it back the same day."]) assert.equal(isProviderErrorAnswer(raw), false, raw)
})

test("a garbled ask is tidied before it is answered: fillers, 'you like,', doubled words and restarts", () => {
  assert.equal(tidySpokenAsk("How do you like, scope an an access review"), "How do you scope an access review")
  assert.equal(tidySpokenAsk("how do you, how do you prove a control works?"), "How do you prove a control works?")
  assert.equal(deriveByCode("Them: uh so, um, how do you like, scope an an access review", []), "How do you scope an access review")
  const q = questionForAnswer("Them: uh so, um, how do you like, scope an an access review", "", false, false, [])
  assert.equal(q.toLowerCase().split("scope an access review").length, 2, q)
})
test("failsafe: tidying keeps real words and never empties an ask", () => {
  assert.equal(tidySpokenAsk("What would you like to ask us?"), "What would you like to ask us?")
  assert.equal(tidySpokenAsk("um"), "um")
  assert.equal(tidySpokenAsk("Do you know the the difference?"), "Do you know the difference?")
})

test("the STAR method stays one keyword after the mishear repair", () => {
  assert.ok(dissectQuestion("explain the start method for a story").keywords.includes("star method"))
})

test("short follow-ups that start with 'and' or lean on 'it' are tied to the previous question", () => {
  const h = [{ q: "What is residual risk?" }]
  for (const f of ["And who signs it off?", "And how often?", "How long can it last?", "And if it fails?"]) assert.match(questionForAnswer(f, "", false, false, h), /following up on: "What is residual risk"/, f)
  assert.match(questionForAnswer("And who do you include?", "", false, false, [{ q: "How do you scope an access review?" }]), /following up on/)
})
test("failsafe: a new subject after 'and', or a new full question, is not tied", () => {
  const h = [{ q: "What is residual risk?" }]
  for (const f of ["And what is zero trust?", "What is least privilege?", "Where are you based?", "Tell me about yourself."]) assert.doesNotMatch(questionForAnswer(f, "", false, false, h), /following up on/, f)
})

test("a follow-up to a follow-up is tied to the root question, never a nested tag", () => {
  assert.equal(rootAsk('Who signs it off — following up on: "What is residual risk"?'), "What is residual risk")
  const h = [{ q: "What is residual risk?" }, { q: 'Who signs it off — following up on: "What is residual risk"?' }]
  const q = questionForAnswer("What if they refuse?", "", false, false, h)
  assert.equal(q.split("following up on").length, 2, q)
  assert.match(q, /"What is residual risk"/)
  assert.match(questionForAnswer("Who do you tell?", "", false, false, [{ q: "How do you test a control?" }, { q: 'And if it fails — following up on: "How do you test a control"?' }]), /following up on/)
  for (const level of ["engineer", "director", "architect"]) assert.doesNotMatch(draftSpokenAnswer(q, level, RESUME), /following up on/i)
})

test("'the second one' after a multi-part question names that part", () => {
  assert.equal(orderedPartOf("Explain residual risk, compensating controls and exception expiry", "And the second one again?"), "compensating controls")
  assert.equal(orderedPartOf("Explain residual risk, compensating controls and exception expiry", "And the last one?"), "exception expiry")
  assert.match(questionForAnswer("And the second one again?", "", false, false, [{ q: "Explain residual risk, compensating controls and exception expiry." }]), /^Compensating controls again — following up on/i)
})
test("failsafe: an ordinal with no listed parts changes nothing", () => {
  assert.equal(orderedPartOf("What is residual risk", "And the second one?"), "")
  assert.equal(orderedPartOf("Explain residual risk", "What is your first job?"), "")
})

test("an object 'you' is said back as 'me', never 'senior to I'", () => {
  const a = draftSpokenAnswer('What if the owner is senior to you — following up on: "How do you challenge a weak remediation plan"?', "architect", RESUME)
  assert.doesNotMatch(a, /\bto I\b/)
  assert.match(a, /senior to me/)
})
test("failsafe: 'you' as a subject still becomes 'I'", () => {
  assert.match(leadPhrase("How do you report to your manager when you are late?") + " " + draftSpokenAnswer("How do you report to your manager?", "engineer", RESUME), /\bI\b|\bmy\b/)
  assert.doesNotMatch(draftSpokenAnswer("How would you work with you know, the owner?", "engineer", RESUME), /\bwith me know\b/)
})

test("third person after a connector is rewritten ('Then he agreed' -> 'Then I agreed')", () => {
  assert.equal(firstPersonRewrite("Jordan scoped the review. Then he agreed the evidence with each owner.", RESUME).text, "I scoped the review. Then I agreed the evidence with each owner.")
  assert.equal(firstPersonRewrite("Jordan reviewed it. Afterwards he sent it back.", RESUME).text, "I reviewed it. Afterwards I sent it back.")
})
test("failsafe: a connector + he/she with no candidate lead is not rewritten", () => {
  const r = firstPersonRewrite("I reviewed the plan with the owner. Then she signed the exception.", RESUME)
  assert.equal(r.text, "I reviewed the plan with the owner. Then she signed the exception.")
})

test("fillers between commas are not read as listed parts", () => {
  const parts = askedPartList("So, uh, explain residual risk, um, compensating controls and, like, exception expiry.")
  for (const p of ["residual risk", "compensating controls", "exception expiry"]) assert.ok(parts.some((x) => x.includes(p)), parts.join("|"))
  assert.ok(!parts.some((x) => /^(?:so|uh|um|like)$/.test(x)), parts.join("|"))
  assert.ok(!askedPartList("Hmm. So, uh, what would you, um, what would you do if the owner says it's fixed?").some((x) => /^(?:so|uh|what would you)$/.test(x)))
})
test("failsafe: a real list keeps every part", () => {
  assert.deepEqual(askedPartList("Explain trust boundaries, data flow, failure isolation and rollout."), ["trust boundaries", "data flow", "failure isolation", "rollout"])
})

test("a spoken setup ('the thing is,') is not a keyword, and 'what would you do if' is said back as the condition", () => {
  assert.equal(cleanSpokenAsk("okay so the thing is, like, how do you, how do you prove a control works?"), "how do you prove a control works?")
  assert.ok(!dissectQuestion("okay so the thing is, how do you prove a control works?").keywords.includes("thing"))
  assert.match(leadPhrase("what would you do if the owner says it's fixed?"), /^if the owner says/)
})
test("failsafe: 'the thing' inside a real ask is kept", () => {
  assert.match(cleanSpokenAsk("What is the thing you check first in an access review?"), /the thing you check first/)
})

test("the stand-in does not re-say a template line with a new lead in a follow-up chain", () => {
  const first = "How do you test a control?"
  const h = [{ q: first, a: draftSpokenAnswer(first, "director", RESUME) }]
  for (const f of ["And if it fails?", "Who do you tell?", "What if they disagree?"]) {
    const q = questionForAnswer(f, "", false, false, h)
    const a = draftSpokenAnswer(q, "director", RESUME, h.map((x) => x.a))
    for (const prev of h) assert.ok(sameAnswerRatio(prev.a, a) < 0.5, `${f}: ${a}`)
    h.push({ q, a })
  }
})
