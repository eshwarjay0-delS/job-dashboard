// Role/Category scorecard S5: no resume-summary tail, no refusal, level bands,
// pack injection, SOC detection framing, sentence dedupe, and the intro headline.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { BANNED_HEDGE, expandToBand, fitLevelAnswer, INTRO_HEADLINE, levelContract, repairIntroHeadline, wordCount } from "../../src/lib/kompasLevelContract.ts"
import { getPack, OWNER_RESUME, packFrame, packGrounding } from "../../src/lib/kompasPacks/index.ts"
import { localSpokenAnswer } from "../../src/lib/kompasAnswer.ts"

const QUESTION = "How do you escalate an alert that looks like SQL injection?"
const CATALOG = "I handle cybersecurity operations for the bank: privileged access with CyberArk, AD/Entra, SailPoint, Okta, Splunk/Sentinel, and Azure."

test("a resume-summary catalogue is never appended, and a refusal is replaced by a story", () => {
  const raw = `I opened the notable in Splunk. ${CATALOG} The details aren't in my work history, so I won't invent a case.`
  const fitted = fitLevelAnswer(raw, levelContract("engineer", QUESTION))
  assert.doesNotMatch(fitted, /I handle cybersecurity operations for the bank/i)
  assert.doesNotMatch(fitted, BANNED_HEDGE)
  assert.match(fitted, /I opened the notable/)
  const spoken = localSpokenAnswer(QUESTION, OWNER_RESUME)
  assert.doesNotMatch(spoken, /I handle cybersecurity operations for the bank/i)
})

test("level bands differ, the band never fills from a stock block, and a short small-talk question stays short", async () => {
  const { packGrounding, OWNER_RESUME } = await import("../../src/lib/kompasPacks/index.ts")
  const { getPack } = await import("../../src/lib/kompasPacks/index.ts")
  const pack = packGrounding(getPack("soc-analyst"), [])
  for (const level of ["architect", "engineer", "director"]) {
    const contract = levelContract(level, QUESTION)
    // No pack: a short answer stays short, never the Citi/CVS stock paragraph (S7, 33 of 37 answers ended "pages once").
    const bare = expandToBand("I own the detection.", contract)
    assert.equal(bare, "I own the detection.")
    const filled = expandToBand("I own the detection.", contract, pack, QUESTION, OWNER_RESUME)
    assert.doesNotMatch(filled, /search updated so it pages once/)
    assert.doesNotMatch(filled, /Initech|PhantomSIEM/)
    assert.ok(wordCount(filled) <= contract.max, String(wordCount(filled)))
    assert.ok(wordCount(filled) >= 4)
  }
  const quick = expandToBand("PKI means public key infrastructure.", levelContract("architect", "What does PKI stand for?"), pack, "What does PKI stand for?")
  assert.ok(wordCount(quick) < 200)
})

test("the matched pack is injected and SOC web attacks stay detection", () => {
  for (const id of ["soc", "soc-analyst"]) {
    const pack = getPack(id)
    const text = packGrounding(pack, [])
    assert.match(text, /Playbook/)
    assert.match(text, /RBA|notables/)
    assert.match(text, /CIM/)
    assert.match(text, /Citi/)
    assert.match(text, /CVS Health/)
    assert.match(packFrame(pack, QUESTION), /detection/i)
    assert.match(packFrame(pack, QUESTION), /not a pentest/i)
  }
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(service, /packFrame\(pack, question\)/)
  assert.match(service, /levelContract\(level, question\)\.prompt/)
  assert.match(service, /Never append a resume summary/)
})

test("a repeated triage sentence is dropped", () => {
  const line = "I open the detection and I read the entity first."
  const text = fitLevelAnswer(`${line} ${line} Then I assign the ticket.`, levelContract("engineer", "How do you triage an alert?"))
  assert.equal(text.split(/I open the detection/i).length - 1, 1)
  assert.match(text, /assign the ticket/)
})

test("the no-resume intro is Senior Cybersecurity Engineer with 9+ years", () => {
  const bad = "I am a Senior I Engineer with 7 years of experience. I work in a SOC."
  const intro = repairIntroHeadline("Tell me about yourself.", bad)
  assert.equal(intro.split(/(?<=[.!?])\s+/)[0], INTRO_HEADLINE)
  assert.match(intro, /Senior Cybersecurity Engineer/)
  assert.match(intro, /9\+ years/)
  assert.match(intro, /Citi Bank/)
  assert.match(intro, /CVS Health/)
  assert.match(intro, /City of San Diego/)
  assert.match(intro, /Charter Communications/)
  assert.match(intro, /Accenture/)
  assert.doesNotMatch(intro, /Senior I Engineer|7 years/)
  assert.match(OWNER_RESUME, /Senior Cybersecurity Engineer/)
  assert.doesNotMatch(OWNER_RESUME, /Fortinet|jayeshwar44/i)
})
