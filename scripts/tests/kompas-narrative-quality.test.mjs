// The main answer is a story he could tell. These fixtures judge that shape,
// not only the word count. Same input, same judgment, 20 times.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { judgeNarrative, NARRATIVE_LINE } from "../../src/lib/kompasConsistency.ts"

const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const RESUME = [
  "Senior SOC Analyst — First National Bank | 2021 – Present",
  "Led the response to a critical ransomware incident across 40 endpoints and contained it in 6 hours.",
  "Used CrowdStrike to isolate a host and Splunk to search the related alerts.",
  "Prioritized Qualys findings by exploitability, closing 12 internet-facing critical items in one week.",
].join("\n")

const GOOD = [
  "I led the response when ransomware hit a file server at First National Bank.",
  "I opened the bridge and isolated that host in CrowdStrike because the process was still writing files.",
  "I searched Splunk for the same hash so we would not miss the other machines on that segment.",
  "We contained it in 6 hours, and 40 endpoints stayed online.",
].join(" ")

const QUALYS = [
  "I do not treat every Qualys critical as the same kind of work.",
  "I put the internet-facing findings first because those are the ones an outsider can reach.",
  "I then checked exploitability in the Qualys data and left the internal-only items in the queue.",
  "I closed 12 of the internet-facing items in one week.",
].join(" ")

const FIXTURES = [
  {
    name: "incident story",
    question: "Tell me about a time you led the response to a critical security incident.",
    answer: GOOD,
    ok: true,
  },
  {
    name: "qualys story",
    question: "How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?",
    answer: QUALYS,
    ok: true,
  },
  {
    name: "confirm stub",
    question: "Tell me about a time you led the response to a critical security incident.",
    answer: "I would want to confirm that.",
    ok: false,
  },
  {
    name: "template closer",
    question: "How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?",
    answer: "First, I map each finding. Next, I check exposure. Finally, I rank what is left. This approach lets teams focus remediation effort where it reduces risk most effectively.",
    ok: false,
  },
  {
    name: "invented persona",
    question: "Tell me about a time you led the response to a critical security incident.",
    answer: "I am a Senior QA Automation Engineer. My first engineering project was building an automated test framework for a legacy banking application, and the runs cut regression time from days to a few hours.",
    ok: false,
  },
  {
    name: "one sentence",
    question: "Walk me through how you would contain a ransomware outbreak across 200 endpoints.",
    answer: "I would isolate the infected workstations from the network.",
    ok: false,
  },
  {
    name: "second person",
    question: "Tell me about a time you led the response to a critical security incident.",
    answer: "As an L1 you primarily monitor every alert. Then you perform the initial triage. This continuous monitoring ensures the SOC maintains visibility.",
    ok: false,
  },
]

for (const row of FIXTURES) {
  test(`${row.name} keeps the same narrative judgment across 20 folds`, () => {
    let first = null
    for (let fold = 0; fold < 20; fold++) {
      const judged = judgeNarrative(row.question, row.answer, RESUME)
      assert.equal(judged.ok, row.ok, `${row.name} fold ${fold + 1}: ${JSON.stringify(judged)}`)
      if (row.ok) {
        assert.equal(judged.direct, true)
        assert.equal(judged.did, true)
        assert.equal(judged.why, true)
        assert.equal(judged.result, true)
        assert.equal(judged.template, false)
        assert.equal(judged.grounded, true)
        assert.ok(judged.words >= 40, `${row.name} has ${judged.words} words`)
      }
      if (!first) first = judged
      else assert.deepEqual(judged, first)
    }
  })
}

test("the live answer prompt tells a story and does not ask for a template", () => {
  assert.match(service, /NARRATIVE:/)
  assert.match(NARRATIVE_LINE, /direct answer/)
  assert.match(NARRATIVE_LINE, /why/)
  assert.match(NARRATIVE_LINE, /number/)
  assert.match(NARRATIVE_LINE, /No First, Next, or Finally/)
})
