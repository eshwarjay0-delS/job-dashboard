// The brain bus wires the engines in one pass. No model and no network.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runSession } from "../../src/lib/kompasNervousSystem.ts"

const RESUME = "Northwind — Senior ServiceNow Developer\n- Owned the service catalog and built Flow Designer flows."
const DOSSIER = "Prepared note: the catalog owner checks the live setting before closing a finding."
const LONG = "So the control owner signs the exception before the release and the audit pack has to match the live setting or the release waits and the owner hears what is still open before anyone calls it done today."

test("one pass shares claims, the question, lens, dossier, and a quality score", () => {
  const shot = runSession({
    resume: RESUME,
    jd: "ServiceNow developer, catalog and Flow Designer.",
    dossier: DOSSIER,
    lines: [
      { who: "You", text: "I'm available in the Pittsburgh area, on site.", source: "mic" },
      { who: "Them", text: "So you would only work remote, right?", source: "computer" },
      { who: "Them", text: LONG, source: "computer" },
      { who: "Them", text: "How would you design the", source: "computer" },
      { who: "Them", text: "What is Flow Designer?", source: "computer" },
    ],
    answer: "Flow Designer means the flow I build, and I say what that check is for before I stop.",
  })
  assert.ok(shot.claims.some((claim) => /Pittsburgh/i.test(claim)))
  assert.match(shot.question, /Flow Designer/)
  assert.match(shot.prewarm, /How would you design the/)
  assert.match(shot.lensNote, /LENS/)
  assert.match(shot.dossierNote, /catalog owner/)
  assert.equal(shot.relevance, 4)
  assert.ok(shot.events.includes("ear.transcript"))
  assert.ok(shot.events.includes("ear.question"))
  assert.ok(shot.events.includes("clarify.action"))
  assert.ok(shot.events.includes("lens.note"))
  assert.ok(shot.events.includes("dossier.note"))
  assert.ok(shot.events.includes("answer.scored"))
  assert.ok(shot.events.includes("brain.state"))
  assert.ok(shot.ms < 150, String(shot.ms))
})

test("the page and the answer service publish onto the bus and do not poll", () => {
  const page = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const aside = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const bus = readFileSync(new URL("../../src/lib/kompasBus.ts", import.meta.url), "utf8")
  assert.match(page, /KompasAnswerAside\.hear\(who, text/)
  assert.match(aside, /function hear\(/)
  assert.match(aside, /publish\("ear\.transcript"/)
  assert.doesNotMatch(service, /runSession\(/)
  assert.doesNotMatch(bus, /setInterval|fetch\(|WebSocket/)
  assert.doesNotMatch(readFileSync(new URL("../../src/lib/kompasNervousSystem.ts", import.meta.url), "utf8"), /setInterval|fetch\(|WebSocket/)
})
