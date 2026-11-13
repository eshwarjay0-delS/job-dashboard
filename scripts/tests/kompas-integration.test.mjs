// Integration audit. Each module publishes, and another module consumes it.
import test from "node:test"
import assert from "node:assert/strict"
import { INTEGRATION, confidenceLine, guardRepeat, paceNudge, primeContext, readInterviewer } from "../../src/lib/kompasIntegration.ts"
import { createNervousSystem, runSession } from "../../src/lib/kompasNervousSystem.ts"

const RESUME = "Northwind — Senior ServiceNow Developer\n- Owned the service catalog and built Flow Designer flows."
const JD = "Human resources screen. Must know SASE."

test("every integration module names an output and a consumer", () => {
  assert.equal(INTEGRATION.length, 10)
  for (const row of INTEGRATION) {
    assert.ok(row.module && row.inputs && row.outputs && row.consumers)
  }
})

test("the session primes, tracks topics, picks a mode, and debriefs into the next prep", () => {
  const first = runSession({
    resume: RESUME,
    jd: JD,
    dossier: "Prepared note: the catalog owner checks the live setting.",
    lines: [
      { who: "You", text: "Want me to stay on the catalog.", source: "mic" },
      { who: "Them", text: "Great, tell me about yourself and the culture fit.", source: "computer" },
      { who: "Them", text: "What is Flow Designer?", source: "computer" },
    ],
    answer: "I would sketch a quantum network from a blank page.",
    question: "How do you run a quantum network?",
    done: true,
  })
  assert.equal(first.primed, true)
  assert.equal(first.interviewer.role, "hr")
  assert.equal(first.interviewer.tone, "warm")
  assert.equal(first.mode, "director")
  assert.match(first.frame, /culture fit|flow designer|human resources/i)
  assert.ok(first.avoid.some((opener) => opener.startsWith("want me to")))
  assert.equal(first.debrief && first.debrief.candidates.includes("sase"), true)
  assert.match(first.debrief.prep, /Next time/)
  assert.match(first.say, /I would/)
  assert.ok(first.clarify)
  assert.ok(first.events.includes("session.prime"))
  assert.ok(first.events.includes("topic.track"))
  assert.ok(first.events.includes("interviewer.model"))
  assert.ok(first.events.includes("answer.feedback"))
  assert.ok(first.events.includes("repetition.guard"))
  assert.ok(first.events.includes("confidence.flag"))
  assert.ok(first.events.includes("session.debrief"))
  assert.ok(first.events.includes("health.check"))
  assert.ok(first.events.includes("debug.span"))
  assert.ok(first.timeline.length > 0)
  assert.ok(first.ms < 150, String(first.ms))

  const next = runSession({
    resume: RESUME,
    jd: "ServiceNow developer, catalog and Flow Designer.",
    prep: first.debrief.prep,
    lines: [{ who: "Them", text: "What is Flow Designer?", source: "computer" }],
  })
  assert.equal(next.primed, true)
  assert.ok(next.topics.length > 0)
})

test("a long interview nudges a wrap-up, and a repeated opener is replaced", () => {
  const nudge = paceNudge({ elapsedMs: 26 * 60 * 1000, themWords: 40, answerWords: 10, pace: "steady" })
  assert.match(nudge, /wrap/)
  assert.equal(guardRepeat(["want me to"], "Want me to stay on the catalog.").blocked, true)
  const shot = runSession({
    resume: RESUME,
    jd: "ServiceNow developer.",
    lines: [{ who: "Them", text: `catalog ${"detail ".repeat(700)}`, source: "computer" }],
  })
  assert.match(shot.nudge, /wrap/)
  assert.ok(shot.events.includes("time.pace"))
})

test("a thrown subscriber degrades and the last snapshot still renders", () => {
  const system = createNervousSystem()
  system.attach({ resume: RESUME, jd: "ServiceNow developer.", dossier: "" })
  system.bus.subscribe("ear.transcript", () => { throw new Error("engine down") })
  system.hear({ who: "Them", text: "What is Flow Designer?", source: "computer" })
  const shot = system.snapshot()
  assert.equal(shot.degraded, true)
  assert.match(shot.question, /Flow Designer/)
  assert.equal(shot.events.includes("health.check"), true)
})

test("production hides the timeline, and a low-evidence answer stays an I would", () => {
  const prior = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  try {
    const shot = runSession({ resume: RESUME, jd: "ServiceNow developer.", lines: [{ who: "Them", text: "What is Flow Designer?", source: "computer" }] })
    assert.deepEqual(shot.timeline, [])
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prior
  }
  const low = confidenceLine("How do you run a quantum network?", RESUME, "engineer")
  assert.equal(low.low, true)
  assert.match(low.say, /^I would/)
  assert.equal(/I worked|Cincinnati|unloader/i.test(low.say + low.ask), false)
  const known = confidenceLine("How do you use Flow Designer?", RESUME, "engineer")
  assert.equal(known.low, false)
  const prime = primeContext({ resume: RESUME, jd: JD, prep: "access reviews next round" })
  assert.ok(prime.jdTerms.includes("sase"))
  assert.equal(readInterviewer("How would you design the catalog?", []).mode, "architect")
})
