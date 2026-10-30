// Source grounding r5 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { sourceDocs, retrievePassages, splitPassages, storyShaped, intentFamilies } from "../../src/lib/kompasSourceRetrieval.ts"
import { BEHAVIORAL_R5 } from "../kompas-behavioral-r5-cases.mjs"
import { CASES_R4 } from "../kompas-weighting-r4.mjs"

const S5 = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-behavioral-sources-r5.json", import.meta.url), "utf8"))
const S4 = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-weighting-sources-r4.json", import.meta.url), "utf8"))
const first = (q, src, opts) => retrievePassages(q, sourceDocs(src), 4, opts).passages[0]?.text || ""

test("a saved Q&A pair is one passage, so the answer travels with its question", () => {
  const ps = splitPassages(sourceDocs({ savedQA: "Q: What is your biggest weakness?\nA: I used to say yes to every review request." }))
  assert.equal(ps.length, 1)
  assert.match(ps[0].text, /biggest weakness.*say yes to every review/)
  assert.match(first("What is your biggest weakness?", S4), /say yes to every review/)
})
test("saved Q&A failsafe: lines without Q:/A: markers split as before", () => {
  assert.equal(splitPassages(sourceDocs({ savedQA: "I like building security programs from scratch.\nI enjoy mentoring new analysts every week." })).length, 2)
})
test("intent matching: a story told in other words is found (disagreed vs challenged, failed vs missed)", () => {
  assert.match(first("Describe a moment you challenged your boss's decision.", S5), /disagreed with the CTO/)
  assert.match(first("Tell me about a time you failed.", S5), /missed a patch deadline/)
  assert.match(first("How do you deal with ambiguity?", S5), /were unclear/)
  assert.match(first("How did you get buy-in from people who did not report to you?", S5), /no authority/)
  assert.match(first("Give me an example of delegating work.", S4), /delegate the routine/)
  assert.ok(intentFamilies("Tell me about a time you dropped the ball.").includes("failure"))
})
test("story-shaped passages are recognised; resume bullets are not stories", () => {
  assert.equal(storyShaped("At Litware I missed a patch deadline on a payment server and owned it, then added a weekly check."), true)
  assert.equal(storyShaped("Wrote Sigma rules for lateral movement over SMB and WMI."), false)
})
test("failsafe: no intent word and no story leaves technical ranking as before", () => {
  assert.match(first("How do you write Sigma rules?", S4), /Sigma rules/)
  assert.match(first("How do you scan container images in the pipeline?", S4), /Trivy/)
  assert.deepEqual(intentFamilies("How do you write Sigma rules?"), [])
})
test("r5 behavioral fixture: at least 52 of 64 lead on the right story; r4 technical and leadership do not drop", () => {
  const d5 = sourceDocs(S5)
  const hits = BEHAVIORAL_R5.filter(([, q, g]) => retrievePassages(q, d5, 4).passages[0]?.text.includes(g)).length
  assert.ok(BEHAVIORAL_R5.length >= 60)
  assert.ok(hits >= 52, `${hits}/64`)
  const d4 = sourceDocs(S4)
  const by = (k) => CASES_R4.filter(([kk]) => kk === k).filter(([, q, g]) => retrievePassages(q, d4, 4).passages[0]?.text.includes(g)).length
  assert.ok(by("technical") >= 23, `technical ${by("technical")}`)
  assert.ok(by("leadership") >= 16, `leadership ${by("leadership")}`)
  assert.ok(by("behavioral") >= 17, `behavioral ${by("behavioral")}`)
})

import { falsePremises, premisePrompt, unsupportedClaims, repairLoopSourceChecks } from "../../src/lib/kompasSourceRetrieval.ts"
test("false premise: 'since you led a team of 50' is caught when the sources say nine", () => {
  const d = sourceDocs(S4)
  assert.deepEqual(falsePremises("Since you led a team of 50 engineers, how did you structure on-call?", d), ["50"])
  assert.match(premisePrompt("Since you led a team of 50 engineers, how did you structure on-call?", d), /INTERVIEWER PREMISE NOT IN YOUR SOURCES: 50/)
  assert.deepEqual(falsePremises("Given your time as CISO at Contoso, how do you brief a board?", d).sort(), ["CISO", "Contoso"].sort())
})
test("false premise: an answer that repeats the false claim is flagged even though the interviewer said it", () => {
  const d = sourceDocs(S4)
  const q = "Since you led a team of 50 engineers, how did you structure on-call?"
  assert.ok(unsupportedClaims("With my team of 50 I split the rotation.", [], d, q).includes("50"))
  assert.equal(repairLoopSourceChecks(q, "With my team of 50 I split the rotation.", d).length, 1)
})
test("false premise failsafe: a true premise, no premise, or no sources changes nothing", () => {
  const d = sourceDocs(S4)
  assert.deepEqual(falsePremises("Since you led a group of nine, how did you run on-call?", d), [])
  assert.deepEqual(falsePremises("How do you write Sigma rules for 4,000 servers?", d), [])
  assert.deepEqual(falsePremises("Since you led a team of 50, how?", []), [])
  assert.equal(premisePrompt("How do you hire?", d), "")
  // the interviewer's own words about their company stay exempt when not framed as the candidate's
  assert.deepEqual(unsupportedClaims("At Fabrikam I would start with the secrets gate.", [], d, "At Fabrikam we use GitHub Actions; how would you start?"), [])
})

import { interviewIntent } from "../../src/lib/kompasRelevance.ts"
import { topicOfAsk, draftSpokenAnswer, sentencesOf } from "../../src/lib/kompasDissection.ts"
const RES = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8")).resume
test("long ask: a context sentence first and an imperative ask last is a real question, not a line check", () => {
  const q = "You will see leaked API key come up a lot here, but set that aside for a second. Tell me about Splunk detections."
  assert.notEqual(interviewIntent(q), "acknowledgement")
  assert.doesNotMatch(draftSpokenAnswer(q, "engineer", RES), /hear you/i)
  // failsafe: a real line check and a plain statement stay acknowledgements
  assert.equal(interviewIntent("Hi, can you hear me okay?"), "acknowledgement")
  assert.equal(interviewIntent("You will meet the team next week. Thanks for your time."), "acknowledgement")
})
test("long ask: the topic is the last asking sentence, so the answer opens on it, not on the context", () => {
  const q = "Last quarter our biggest pain was noisy SIEM rules, and the board noticed. That is mostly solved now. What I actually want to hear is how you handled post-incident review?"
  assert.match(topicOfAsk(q), /post-incident review/)
  assert.doesNotMatch(topicOfAsk(q), /noisy SIEM/)
  const first = sentencesOf(draftSpokenAnswer(q, "engineer", RES))[0].toLowerCase()
  assert.match(first, /post-incident/)
  assert.match(topicOfAsk("People wear many hats here. So my question is, walk me through access reviews."), /^walk me through access reviews/i)
  // failsafe: a one-sentence ask and a two-sentence ask with no clear ask sentence keep the whole text
  assert.equal(topicOfAsk("How did you handle access reviews?"), "How did you handle access reviews?")
  assert.equal(topicOfAsk("Access reviews. Splunk."), "Access reviews. Splunk.")
})
test("long ask: a lone 'anyway, what I really want to know is …' opens on the real ask", () => {
  assert.match(sentencesOf(draftSpokenAnswer("Anyway, what I really want to know is how you handled HIPAA controls?", "engineer", RES))[0], /HIPAA/)
})
test("long ask retrieval: the passage for the real ask leads, not the one named in the context sentence", () => {
  const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
  const q = "Last quarter our biggest pain was HIPAA controls, and the board noticed. That is mostly solved now. What I actually want to hear is how you handled privileged accounts?"
  assert.match(retrievePassages(q, sourceDocs(S)).passages[0].text, /privileged accounts/)
})
