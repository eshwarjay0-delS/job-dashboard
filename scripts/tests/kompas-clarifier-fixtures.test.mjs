import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { answerAside, asideBlocked } from "../../src/lib/kompasAnswerAside.ts"
import { clarifierMayCallModel, clarifierNeed, clarifyingFromQuestion, speakableLines } from "../../src/lib/kompasConsistency.ts"

const page = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const route = readFileSync(new URL("../../src/app/api/kompas/aside/route.ts", import.meta.url), "utf8")
const RESUME = [
  "Designed the network segmentation for the plant.",
  "Built the failover runbook for the cluster.",
  "Prioritized Qualys findings and closed 12 internet-facing items in one week.",
  "Assists with ServiceNow platform incident resolution and fraud investigation workflows.",
].join("\n")
const JD = "Splunk ES, CrowdStrike Falcon, Qualys, ServiceNow"

const FIXTURES = [
  ["you", "How would you design the catalog?", "You: I owned the catalog.", "", true],
  ["chat", "thanks", "", "", true],
  ["chat", "Can you hear me?", "Them: Can you hear me?", "", true],
  ["clear", "What is routing?", "", "", false],
  ["clear", "How do you prioritize vulnerabilities from a Qualys scan?", "", RESUME, false],
  ["scope", "Did you design it alone?", "", RESUME, false],
  ["multi", "Did you design the network alone? What about failover?", "", RESUME, true],
  ["scope", "Do you mean the network design, or the failover runbook?", "", RESUME, true],
  ["number", "How many findings did you close?", "", RESUME, false],
  ["hypothetical", "What if the cluster failed over?", "", RESUME, false],
  ["referent", "How did you verify that?", "Them: We changed the network segmentation yesterday.", RESUME, false],
  ["referent", "How did you verify that?", "Them: We changed the network segmentation.\nThem: We also rewrote the failover runbook.", RESUME, true],
  ["term", "When you say incident, which kind of incident do you mean?", "", RESUME, false],
  ["jd", "Have you used Splunk ES?", "", RESUME, false],
]

function expectQuestion(row) {
  const [kind, question, transcript, resume, wants] = row
  if (kind === "you" || kind === "chat") {
    const aside = answerAside({ question, transcript, resume })
    assert.equal(aside.questions.length, 0, question)
    assert.equal(aside.sayNow, "", question)
    assert.equal(asideBlocked(transcript, question), true, question)
    return true
  }
  const turns = String(transcript || "").split("\n").filter(Boolean).map((line) => ({ who: line.startsWith("You:") ? "You" : "Them", text: line.replace(/^(?:Them|You):\s*/, "") }))
  const got = clarifyingFromQuestion(question, resume, turns)
  const pass = wants ? got.length === 1 : got.length === 0
  assert.equal(pass, true, `${kind} ${question} => ${got.join(" | ")}`)
  return pass
}

test("clarifier fixtures stay silent unless two resume lines differ", () => {
  let passed = 0
  for (const row of FIXTURES) if (expectQuestion(row)) passed++
  assert.equal(passed, FIXTURES.length)
  const borderline = FIXTURES.filter((row) => {
    const turns = String(row[2] || "").split("\n").filter(Boolean).map((line) => ({ text: line.replace(/^(?:Them|You):\s*/, "") }))
    return clarifierNeed(row[1], turns).borderline
  })
  assert.ok(borderline.length / FIXTURES.length < 0.1)
  assert.equal(clarifierMayCallModel({ score: 2, kind: "scope", options: [], borderline: true }), true)
  assert.equal(clarifierMayCallModel(clarifierNeed("What is routing?")), false)
})

test("speakable lines are first person, and a JD-only tool is bridged", () => {
  const lines = speakableLines("incident resolution and fraud investigation", "Experience in ServiceNow platform incident resolution and fraud investigation workflows for audit documentation.")
  assert.match(lines[0], /^I /)
  assert.doesNotMatch(lines.join(" "), /Experience in|walk you through/i)
  const bridged = speakableLines("Have you used Splunk ES on incidents?", RESUME, JD)
  assert.match(bridged[0], /have not used Splunk/)
  assert.match(bridged[0], /^I have not used Splunk\. I /)
})

test("the aside request carries the epoch and a missing epoch is dropped", () => {
  assert.match(route, /epoch/)
  assert.match(page, /epoch: window\.__kompasAskEpoch/)
  assert.match(page, /aside\.epoch == null \|\| window\.__kompasAskEpoch == null \|\| aside\.epoch !== window\.__kompasAskEpoch/)
})
