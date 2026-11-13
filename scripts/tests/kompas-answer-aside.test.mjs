// Context panel: every answer carries 2–3 leads, 3–4 touch points, and 2–3
// questions back. Facts come only from the resume on the request.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { answerAside, asideModeFromTranscript, asideViolations, isShortFactAsk, shortFactAnswer } from "../../src/lib/kompasAnswerAside.ts"

const SERVICE = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const ASIDE = readFileSync(new URL("../../src/lib/kompasAnswerAside.ts", import.meta.url), "utf8")

const HOUSTON = `
eshwarjay05@gmail.com
(314) 555-0100
Houston
Northwind — Senior ServiceNow Developer | Jul 2023 – Present
- Owned the service catalog for a team of five and checked in with users on each request.
- Worked with product owners when a flow stalled.
- Built Flow Designer flows for HR cases.
jayeshwar44@gmail.com
Saint Louis
- Owned a Burp Suite program for a team of twelve at Fabrikam.
- Used Splunk and lived in Saint Louis.
eshwarjay06@gmail.com
- Led OT work at Cigna for a team of nine.
`

const ASKS = [
  "How would you design the service catalog rollout?",
  "Tell me about a time you owned a catalog change.",
  "What is the difference between a business rule and a flow?",
  "What is Flow Designer?",
  "Why?",
  "How did you verify that?",
  "Walk me through how you handled a stalled request.",
  "Design a rollback for a catalog change.",
  "Are you on a visa?",
  "",
]

function shape(aside) {
  assert.ok(aside.context, "context")
  assert.ok(aside.context.leads.length >= 2 && aside.context.leads.length <= 3, `leads ${aside.context.leads.length}`)
  assert.ok(aside.context.touchPoints.length >= 3 && aside.context.touchPoints.length <= 4, `touches ${aside.context.touchPoints.length}`)
  assert.ok(aside.questions.length >= 2 && aside.questions.length <= 3, `questions ${aside.questions.length}`)
  assert.ok(aside.boosters.length >= 2 && aside.boosters.length <= 3, `boosters ${aside.boosters.length}`)
  assert.ok(aside.mode === "questions" || aside.mode === "boosters")
  for (const q of aside.questions) assert.match(q, /\?$/)
  const blob = [...aside.context.leads, ...aside.context.touchPoints, ...aside.questions].join("\n")
  assert.doesNotMatch(blob, /\bHaving\b/)
  assert.doesNotMatch(blob, /@|gmail|555-0100|visa|salary|houston|saint louis|jayeshwar44|eshwarjay06|fabrikam|burp|splunk|twelve|nine|cigna/i)
}

test("every answer includes context and 2–3 questions", () => {
  for (const question of ASKS) {
    shape(answerAside({ question, resume: HOUSTON, transcript: "Them: earlier they asked about the catalog.\nYou: sure." }))
    shape(answerAside({ question, resume: "", transcript: "" }))
  }
  assert.equal(SERVICE.match(/aside: job\.aside/g).length, 2)
  assert.match(SERVICE, /job\.aside = answerAside\(/)
  assert.doesNotMatch(ASIDE, /fetch\(|fetchOpenRouter/)
})

test("a grounded lead uses the team size and the owned work, and nothing from the other profile", () => {
  const aside = answerAside({
    question: "Tell me about a time you owned the service catalog.",
    resume: HOUSTON,
    transcript: "",
  })
  const leads = aside.context.leads.join(" ")
  assert.match(leads, /team of five/i)
  assert.match(leads, /service catalog/i)
  assert.match(leads, /users/i)
  assert.deepEqual(asideViolations(aside, HOUSTON), [])
  assert.ok(aside.context.touchPoints.some((t) => /so the way we approached it|the reason that mattered/i.test(t)))
})

test("names and numbers absent from the profile stay out", () => {
  const thin = "Senior ServiceNow Developer\nBuilt flows for request items and checked in with users."
  const aside = answerAside({ question: "How would you design a Splunk dashboard for twelve sites at Fabrikam?", resume: thin })
  const blob = [...aside.context.leads, ...aside.context.touchPoints, ...aside.questions].join("\n")
  assert.doesNotMatch(blob, /\b(?:five|twelve|nine|\d+)\b/i)
  assert.doesNotMatch(blob, /Fabrikam|Splunk|Cigna|Burp|Northwind|Saint Louis|Houston/)
  assert.deepEqual(asideViolations(aside, thin), [])
  shape(aside)
})

test("a new question refreshes the questions, and the transcript can change a follow-up", () => {
  const a = answerAside({ question: "How would you design the service catalog rollout?", resume: HOUSTON })
  const b = answerAside({ question: "Tell me about a time you owned a catalog change.", resume: HOUSTON })
  assert.notDeepEqual(a.questions, b.questions)
  const why = answerAside({ question: "Why?", resume: HOUSTON, transcript: "" })
  const whyHeard = answerAside({
    question: "Why?",
    resume: HOUSTON,
    transcript: "Them: How would you design the service catalog rollout?\nYou: I would start with the catalog.",
  })
  assert.notDeepEqual(why.questions, whyHeard.questions)
  assert.match(whyHeard.questions.join(" "), /last question/i)
})

test("logistics is not coached in the panel", () => {
  const aside = answerAside({ question: "What is your visa status and expected salary?", resume: HOUSTON })
  shape(aside)
  assert.match(aside.questions.join(" "), /work/i)
})

test("section 2 follows the live line: statements boost, questions and wrap-ups ask back", () => {
  const explaining = "Them: So the control owners are spread across three teams and the handoff is where it stalls."
  const asked = "Them: Have you worked with Citibank before?"
  const wrap = "Them: Okay, that covers the catalog. Any questions on your side?"
  assert.equal(asideModeFromTranscript(explaining, "How would you design the catalog?"), "boosters")
  assert.equal(asideModeFromTranscript(asked), "questions")
  assert.equal(asideModeFromTranscript(wrap), "questions")
  const aside = answerAside({ question: "How would you design the catalog?", resume: HOUSTON, transcript: explaining })
  assert.equal(aside.mode, "boosters")
  assert.match(aside.questions.join(" "), /Why do you think that's happening/)
  assert.match(aside.questions.join(" "), /control owners/i)
  const quiet = answerAside({ question: "How would you design the catalog?", resume: HOUSTON, transcript: "" })
  assert.doesNotMatch(quiet.questions.join(" "), /control owners/i)
  assert.doesNotMatch(quiet.boosters.join(" "), /handoff|bottleneck/i)
})

test("a short factual ask is one line from the profile, and a missing client stays not directly", () => {
  assert.equal(isShortFactAsk("How would you design the service catalog rollout?"), false)
  assert.equal(isShortFactAsk("Have you worked with Citibank before?"), true)
  const missing = shortFactAnswer("Have you worked with Citibank before?", HOUSTON)
  assert.ok(missing)
  assert.match(missing.text, /^Not directly, but /)
  assert.equal(missing.text.split(/(?<=[.?!])\s+/).length, 1)
  assert.doesNotMatch(missing.text, /citi/i)
  assert.match(missing.text, /Northwind/)
  assert.equal(missing.booster, "")
  const citi = `
eshwarjay05@gmail.com
Citi Bank — Senior ServiceNow Developer | Jul 2023 – Present
- Owned the service catalog for a team of five and checked in with users.
`
  const yes = shortFactAnswer("Have you worked with Citibank before?", citi)
  assert.match(yes.text, /^Yes, /)
  assert.match(yes.text, /Citi Bank/)
  assert.doesNotMatch(yes.text, /Citibank/)
  assert.equal(yes.text.split(/(?<=[.?!])\s+/).length, 1)
  assert.equal(yes.booster, "Yeah, that's true.")
  assert.deepEqual(asideViolations(answerAside({ question: "Have you worked with Citibank before?", resume: HOUSTON }), HOUSTON), [])
  assert.match(SERVICE, /shortFactAnswer\(question, fastResume\)/)
  const fastAt = SERVICE.indexOf("shortFactAnswer(question, fastResume)")
  assert.ok(fastAt > 0 && SERVICE.indexOf("const keysPromise = keysFor", fastAt) > fastAt)
})
