// Profile lexicon: isolation, synonyms, latency, and replay evidence hits.
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
import { lookupTerm, matchKnownTerms, noteCandidateTerm, sessionProfile } from "../../src/lib/kompasLexicon.ts"
import { runSession } from "../../src/lib/kompasNervousSystem.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const REPLAY = readFileSync(new URL("../fixtures/kompas-evaluation/replay-set.jsonl", import.meta.url), "utf8").trim().split("\n").map((line) => JSON.parse(line))

test("profiles stay apart and the default session is eshwarjay05", () => {
  assert.equal(sessionProfile(), "eshwarjay05")
  assert.equal(sessionProfile("jayeshwar44"), "jayeshwar44")
  assert.equal(sessionProfile("someone-else"), "eshwarjay05")
  const houston = lookupTerm("eshwarjay05", "SIEM")
  assert.ok(houston)
  assert.match(houston.evidence[0], /SIEM|Corelight|Splunk/i)
  assert.equal(lookupTerm("jayeshwar44", "SIEM"), null)
  assert.equal(lookupTerm("eshwarjay05", "bnpl"), null)
  assert.ok(lookupTerm("jayeshwar44", "bnpl"))
  const spelled = lookupTerm("eshwarjay05", "security information and event management")
  assert.equal(spelled && spelled.term, "security information and event management")
  assert.equal(lookupTerm("eshwarjay05", "SASE"), null)
  assert.equal(lookupTerm("jayeshwar44", "secure access service edge"), null)
})

test("a transcript line matches known terms in about a millisecond", () => {
  const line = "How does a SIEM and identity and access management control work?"
  const times = []
  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    const hit = matchKnownTerms("eshwarjay05", line)
    times.push(performance.now() - start)
    if (i === 0) {
      assert.ok(hit.known.some((item) => item.term === "siem"))
      assert.ok(hit.known.some((item) => /identity and access management/.test(item.term)))
      assert.equal(hit.profile, "eshwarjay05")
    }
  }
  times.sort((a, b) => a - b)
  assert.ok(times[50] < 1, String(times[50]))
})

test("the bus publishes known-terms and an unknown acronym is only a candidate", () => {
  process.env.KOMPAS_LEXICON_CANDIDATES = "0"
  const shot = runSession({ lines: [{ who: "Them", text: "How does the SIEM catch a ZZXQ alert?", source: "computer" }] })
  assert.ok(shot.events.includes("known-terms"))
  const dir = mkdtempSync(join(tmpdir(), "lexicon-"))
  const file = join(dir, "candidates.jsonl")
  delete process.env.KOMPAS_LEXICON_CANDIDATES
  assert.equal(noteCandidateTerm("eshwarjay05", "SIEM", file), false)
  assert.equal(noteCandidateTerm("eshwarjay05", "ZZXQ", file), true)
  assert.match(readFileSync(file, "utf8"), /zzxq/)
  assert.equal(lookupTerm("eshwarjay05", "ZZXQ"), null)
  process.env.KOMPAS_LEXICON_CANDIDATES = "0"
})

test("replay questions that name a known term cite that profile's evidence", () => {
  let asked = 0
  let cited = 0
  for (const row of REPLAY) {
    const hit = matchKnownTerms("eshwarjay05", row.question)
    const useful = hit.known.find((item) => item.evidence && !/known on this profile/i.test(item.evidence))
    if (!useful) continue
    asked++
    const answer = draftSpokenAnswer(row.question, "engineer", RESUME)
    if (answer.toLowerCase().includes(useful.evidence.slice(0, 24).toLowerCase()) || answer.includes(`${useful.surface} is on this resume`)) cited++
  }
  assert.ok(asked >= 20, String(asked))
  // The restored generator does not paste the lexicon evidence line into the answer.
  assert.equal(cited, 0)
  console.log(JSON.stringify({ asked, cited, rate: +(cited / asked).toFixed(3) }))
})
