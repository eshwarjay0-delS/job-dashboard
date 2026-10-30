// Offline stress rounds, 29 Oct 2026. Each test pins one failure the rounds found. CODE-LEVEL ONLY: these prove the code
// paths every live answer goes through, not live answer quality (that needs scripts/kompas-live-eval.mjs with a token).
import test from "node:test"
import assert from "node:assert/strict"
import { spokenMarkup, dropRepeatedSentences, isProviderErrorAnswer, settleSpokenAnswer, dissectQuestion, asksForCode, splitFollowUp, sameAnswerRatio, draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
import { applyGuards } from "../../src/lib/kompasGuards.ts"

const guard = (s) => applyGuards(s, null, new Set(), new Set()).text

test("round 3: raw provider and gateway failures are never shown as an answer", () => {
  for (const raw of ["Error: Request failed with status code 429", "upstream connect error or disconnect/reset before headers",
    "502 Bad Gateway", "Rate limit exceeded for model openai/gpt-5. Please retry later.", "{\"error\":{\"message\":\"Insufficient credits\",\"code\":402}}",
    "The model is currently overloaded with other requests.", "Internal Server Error", "This model's maximum context length is 128000 tokens.",
    "I'm sorry, but I can't help with that request."]) {
    assert.equal(isProviderErrorAnswer(raw), true, raw)
    assert.equal(settleSpokenAnswer("What is residual risk?", raw, "engineer").text, "", raw)
  }
})

test("round 3 failsafe: a real answer that mentions an error or rate limiting is kept", () => {
  for (const raw of ["I would add rate limiting to the login API so a burst of failures is slowed down.",
    "If the upstream service returns an error, I fail closed and alert the owner.",
    "Service availability matters, so I schedule the change outside business hours.",
    "When the load balancer returned 502 Bad Gateway during the cutover, I rolled the listener back first and then compared the target health checks with the change ticket, because the evidence pointed at the new pool rather than the application itself."]) {
    assert.equal(isProviderErrorAnswer(raw), false, raw)
  }
})

test("round 3: past result claims with within, per, every or at least lose their invented figures", () => {
  assert.equal(guard("I reduced incidents by 40% within a quarter."), "I reduced incidents noticeably within a quarter.")
  assert.doesNotMatch(guard("I cut review time by 50% per audit cycle."), /50/)
  assert.equal(guard("I handled over 200 findings every quarter."), "I handled many findings every quarter.")
  assert.equal(guard("I closed 95 percent of findings at least a month early."), "I closed most of the findings at least a month early.")
  assert.equal(guard("I saved the company $2M."), "I saved the company millions of dollars.")
})

test("round 3 failsafe: plans, thresholds and labels keep their numbers", () => {
  for (const s of ["I would alert when failures exceed 5 per minute.", "I set the threshold at 3 failed logins.",
    "Hypothesis 1 held, so step 2 ran first.", "If it fails 3 times within 10 minutes, I page the owner.",
    "We will review 20 accounts every week."]) assert.equal(guard(s), s)
})

import { deriveByCode, questionForAnswer, smallTalkOnly } from "../../src/lib/kompasAnswer.ts"

const SMALL_TALK = ["yeah that's a tough one", "makes sense", "great, thanks", "let's dive in", "that's interesting",
  "hmm, fair enough", "good, good", "I see what you mean", "alright, let me pull up my notes", "nice, I like that answer",
  "perfect, that's helpful", "give me one second", "interesting point", "sorry, my dog is barking", "the weather has been crazy here lately"]

test("round 2, idea E: interviewer small talk never becomes a question", () => {
  for (const line of SMALL_TALK) {
    assert.equal(smallTalkOnly(line), true, line)
    assert.equal(deriveByCode(`Them: ${line}`, []), null, line)
    assert.equal(deriveByCode(line, []), null, line)
    assert.equal(questionForAnswer(line, "", false, false, []), "", line)
  }
})

test("round 2 failsafe: a real ask after small talk is still answered", () => {
  const cases = {
    "That's a good question. How do you handle exceptions?": "How do you handle exceptions?",
    "Makes sense. What about residual risk?": "What about residual risk?",
    "Let's dive in. Tell me about yourself.": "Tell me about yourself.",
    "Thanks. Can you walk me through the design?": "Can you walk me through the design?",
  }
  for (const [heard, want] of Object.entries(cases)) {
    assert.equal(deriveByCode(`Them: ${heard}`, []), want, heard)
    assert.equal(questionForAnswer(heard, "", false, false, []), want, heard)
  }
  for (const topic of ["residual risk", "least privilege", "Hold on, is that a preventive control?"]) {
    assert.equal(smallTalkOnly(topic), false, topic)
    assert.ok(questionForAnswer(topic, "", false, false, []), topic)
  }
})

import { RESUME } from "../kompas-stress-rounds.mjs"

const FOLLOW_UPS = [
  ["Write a Python function that returns the findings still open after 30 days.", "Can you also add unit tests?", "tests"],
  ["Design multi-cloud controls mapped to NIST 800-53.", "What would you monitor?", "monitor"],
  ["Tell me about a time you challenged a weak remediation plan.", "What would you do differently?", "differently"],
  ["Write a SQL query that lists findings with no owner.", "Could you add an index for it?", "index"],
  ["How do you assess business impact and residual risk?", "How would you test that?", "test"],
  ["Explain how a finding moves from open to closed.", "And what about exceptions?", "exceptions"],
]

test("round 3, idea D: an additive follow-up stays on the previous topic and leads with its own word", () => {
  for (const [first, follow, keyword] of FOLLOW_UPS) {
    const formed = questionForAnswer(follow, "", false, false, [{ q: first }])
    assert.ok(formed.includes(first.replace(/[?.!\s]+$/, "")), `${follow} -> ${formed}`)
    assert.ok(splitFollowUp(formed).own.toLowerCase().includes(keyword), formed)
    const cut = dissectQuestion(formed)
    assert.ok(cut.keywords.slice(0, 2).some((k) => k.toLowerCase().includes(keyword.slice(0, 4))), `${follow}: ${cut.keywords.join("|")}`)
    assert.ok(!cut.keywords.includes("following"), cut.keywords.join("|"))
    assert.equal(splitFollowUp(formed).previous, first.replace(/[?.!\s]+$/, ""))
    for (const level of ["engineer", "architect", "director"]) {
      const next = draftSpokenAnswer(formed, level, RESUME)
      assert.ok(sameAnswerRatio(draftSpokenAnswer(first, level, RESUME), next) < 0.5, `${level} ${follow}`)
      assert.ok(!/following up on/i.test(next), next)
    }
  }
  assert.equal(asksForCode(questionForAnswer("Can you also add unit tests?", "", false, false, [{ q: FOLLOW_UPS[0][0] }])), true)
})

test("round 3 failsafe: a short question with its own subject, or no history, is not tied", () => {
  const history = [{ q: "Explain residual risk." }]
  for (const q of ["What is least privilege?", "Tell me about yourself.", "How do you handle a ransomware incident?", "Why do you want this role?"]) {
    assert.equal(questionForAnswer(q, "", false, false, history), q, q)
  }
  assert.equal(questionForAnswer("Can you also add unit tests?", "", false, false, []), "Can you also add unit tests?")
  assert.equal(asksForCode(questionForAnswer("What would you monitor?", "", false, false, history)), false)
  assert.deepEqual(splitFollowUp("What is residual risk?"), { own: "What is residual risk?", previous: "" })
})

test("round 4: page markup and an Answer label are never read out", () => {
  for (const raw of ["## Answer\nResidual risk is the risk left after the planned control is in place.",
    "**Residual risk** is the risk left after the control is in place. I tracked it on open findings.",
    "Answer: Residual risk is what remains after the control is in place.",
    "Short answer - residual risk is what remains after the `control` is in place."]) {
    const text = settleSpokenAnswer("What does residual risk mean?", raw, "engineer").text
    assert.ok(!/[#*`]|^(?:short )?answer\b/i.test(text), text)
    assert.match(text, /residual risk/i)
  }
})

test("round 4 failsafe: plain answers, hash tags and math stars are not rewritten", () => {
  for (const raw of ["I track residual risk on open findings.", "I filed it under ticket #42 and closed it.", "The answer is that I compare evidence with the live setting."]) {
    assert.equal(spokenMarkup(raw), raw)
  }
  assert.equal(spokenMarkup("**"), "**")
})

test("round 4: sentences already said in the previous answer are dropped from a new answer", () => {
  const previous = "I tracked residual risk on open findings and told the business what remained after the planned control was in place. I wrote the weekly risk summary in plain language."
  const raw = "I reject an exception that has no end date and no compensating control. I tracked residual risk on open findings and told the business what remained after the planned control was in place."
  const text = settleSpokenAnswer("When would you reject a policy exception?", raw, "director", "", previous).text
  assert.equal(text, "I reject an exception that has no end date and no compensating control.")
})

test("round 4 failsafe: a full read-back or an asked repeat keeps the text, flagged, never an empty answer", () => {
  const previous = "I questioned exception requests that had no end date and sent them back for an expiry. I compared the evidence with the live setting."
  const full = settleSpokenAnswer("When would you reject a policy exception?", previous, "director", "", previous)
  assert.ok(full.text.length > 0)
  assert.equal(full.repeated, true)
  const again = settleSpokenAnswer("Can you say that again?", previous, "director", "", previous)
  assert.ok(again.text.includes("compared the evidence"))
  assert.equal(dropRepeatedSentences("Short. New idea here.", "Short."), "Short. New idea here.")
})
