// Offline stress rounds, 29 Oct 2026. Each test pins one failure the rounds found. CODE-LEVEL ONLY: these prove the code
// paths every live answer goes through, not live answer quality (that needs scripts/kompas-live-eval.mjs with a token).
import test from "node:test"
import assert from "node:assert/strict"
import { questionKeywords, evaluateLiveAnswers, cleanSpokenAsk, leadPhrase, spokenMarkup, dropRepeatedSentences, isProviderErrorAnswer, settleSpokenAnswer, dissectQuestion, asksForCode, splitFollowUp, sameAnswerRatio, draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
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

test("round 2: speech fillers never decide the shape or become keywords", () => {
  assert.equal(dissectQuestion("tell me about uh yourself").shape, "intro")
  assert.equal(dissectQuestion("what's residual risk mean to you").shape, "definition")
  const garbled = dissectQuestion("um so like what's the uh resid jewel risk thing")
  assert.ok(!garbled.keywords.some((k) => /^(?:um|uh|like|thing|so)$/i.test(k)), garbled.keywords.join("|"))
  assert.equal(leadPhrase("tell me about a time you you challenged a remediation plan"), "challenged a remediation plan")
  for (const q of ["Hi, can you hear me okay?", "How are you doing today?", "Hello, how's it going?"]) assert.equal(dissectQuestion(q).shape, "acknowledgement", q)
})

test("round 2 failsafe: real words that look like fillers are kept, and filler-only asks keep their words", () => {
  assert.equal(cleanSpokenAsk("What do you like about this role?"), "What do you like about this role?")
  assert.equal(cleanSpokenAsk("Which thing would you fix first?"), "Which thing would you fix first?")
  assert.equal(cleanSpokenAsk("um uh"), "um uh")
  for (const q of ["How are you handling exception expiry?", "Can you hear me out on a design question: how would you isolate tenants?"]) {
    assert.notEqual(dissectQuestion(q).shape, "acknowledgement", q)
  }
})

test("round 2: backchannel noise never becomes a question", () => {
  for (const heard of ["um", "uh huh", "mm-hmm", "mhm", "oh", "I see"]) {
    assert.equal(deriveByCode(heard, []), null, heard)
    assert.equal(questionForAnswer(heard, "", false, false, []), "", heard)
  }
  assert.equal(questionForAnswer("Oh, how do you close a finding?", "", false, false, []).includes("close a finding"), true)
})

test("round 5: unpinned with the derived ask, the ask is not said twice", () => {
  for (const said of ["sorry, my kid just walked in. Anyway, how do you scope an access review?", "The coffee here is terrible, honestly. So, what does a compensating control mean?"]) {
    const heard = `Them: ${said}`
    const derived = deriveByCode(heard, [])
    const q = questionForAnswer(heard, derived, false, false, [])
    const core = derived.replace(/^(?:anyway|so),?\s*/i, "").replace(/\?$/, "").toLowerCase()
    assert.equal(q.toLowerCase().split(core).length, 2, q)
  }
})

test("round 5 failsafe: a derived ask that is not in heard is still added", () => {
  const q = questionForAnswer("Them: we talked about audits earlier", "How do you scope an access review?", false, false, [])
  assert.match(q, /scope an access review/)
})

test("round 5: a premise, an audience or a filler never leads the keywords; a negation does", () => {
  const kw = (q) => dissectQuestion(q).keywords.map((k) => k.toLowerCase())
  assert.deepEqual(kw("Since you led the SOC at a large bank, how did you report risk?").filter((k) => /led|bank|large/.test(k)), [])
  assert.deepEqual(kw("Given that you ran the audit program, what would you change first?").filter((k) => /audit|program/.test(k)), [])
  assert.ok(!kw("Explain residual risk to an engineer.").includes("engineer"))
  assert.equal(kw("When would you never accept a policy exception?")[0], "not accept")
  assert.ok(!kw("um so like how do you you scope an access review you know").some((k) => /^(?:um|like|know)$/.test(k)))
})

test("round 5 failsafe: a premise with no ask after it, and ordinary phrases, keep their words", () => {
  assert.ok(questionKeywords("Since you led the SOC, tell me.").some((k) => k === "SOC"))
  assert.ok(questionKeywords("How do you report risk to the board?").includes("report"))
  assert.equal(cleanSpokenAsk("Do you know SQL?"), "Do you know SQL?")
  assert.equal(cleanSpokenAsk("What kind of controls do you test?"), "What kind of controls do you test?")
  assert.equal(cleanSpokenAsk("As you know, the team is small."), "As you know, the team is small.")
})

test("round 5: timeouts are provider failures; a timeout answer is not", () => {
  for (const raw of ["Request timed out after 60000ms", "Error 503: Service Unavailable", "context_length_exceeded", "ETIMEDOUT"]) assert.equal(isProviderErrorAnswer(raw), true, raw)
  assert.equal(isProviderErrorAnswer("I would alert when a request timed out after 30 seconds, and page the owner."), false)
})

test("offline stand-in: every mode is first person, speakable, and at least 50% apart in length", () => {
  const qs = ["Tell me about yourself.", "What is your biggest weakness?", "How do you handle a suspicious login?", "Describe a situation where a fix did not hold.",
    "What would you bring to this team?", "Define least privilege.", "Since you led the SOC at a large bank, how big was your team?"]
  for (const q of qs) {
    const rows = ["engineer", "director", "architect"].map((level) => ({ question: q, level, text: draftSpokenAnswer(q, level, RESUME) }))
    for (const r of rows) {
      assert.doesNotMatch(r.text, /\b(?:your|yourself)\b/i, `${r.level}: ${r.text}`)
      assert.doesNotMatch(r.text, /\bI (?:how|what|why|your|you|a situation)\b|\bWhen I a\b|\bsince I led\b/i, `${r.level}: ${r.text}`)
    }
    const gaps = evaluateLiveAnswers(rows, RESUME).failures.filter((f) => f.startsWith("length gap"))
    assert.deepEqual(gaps, [], q)
  }
})
