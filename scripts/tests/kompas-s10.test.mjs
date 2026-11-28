// S10 on fefaaf1. Architect must render from a stream. The ServiceNow bio must not
// reach an answer or Say this. Pack fill is full sentences. Openings differ.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { expandToBand, fitLevelAnswer, levelContract, spokenPackSentence } from "../../src/lib/kompasLevelContract.ts"
import { answerAside } from "../../src/lib/kompasAnswerAside.ts"
import { lexiconClause, lookupTerm } from "../../src/lib/kompasLexicon.ts"
import { OWNER_RESUME } from "../../src/lib/kompasPacks/owner.ts"
import { depthText } from "../../src/lib/kompasPacks/index.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const FOREIGN = "Having 10+ years of experience in Sr. ServiceNow Development and Administration and implementation of various ServiceNow ITSM Modules."

function loadGate() {
  const ctx = { globalThis: {}, console }
  ctx.globalThis = ctx
  vm.runInNewContext(readFileSync(new URL("../../public/kompas/live-session.js", import.meta.url), "utf8"), ctx)
  return ctx.KompasLiveSession
}

test("an Architect stream stays on the pane after an empty replace", () => {
  const start = app.indexOf("function applyStreamFrame")
  const end = app.indexOf("function renderCard", start)
  const dom = new JSDOM("<ul id=\"answer\"></ul><div id=\"card\"></div>")
  const context = { document: dom.window.document, NodeFilter: dom.window.NodeFilter }
  vm.runInNewContext(app.slice(start, end), context)
  const sentence = "I isolate the host in CrowdStrike at Citi Bank and I keep the Splunk evidence on the ticket. "
  const body = sentence.repeat(70)
  assert.ok(body.split(/\s+/).filter(Boolean).length >= 1000)
  const card = { qid: "a1", answer: "", answerFor: "" }
  const state = context.applyStreamFrame({ text: "" }, { type: "replace", text: body })
  context.applyStreamFrame(state, { type: "replace", text: "" })
  card.answer = state.text
  card.answerFor = card.qid
  const ul = dom.window.document.getElementById("answer")
  String(card.answer).split(/(?<=[.!?])\s+/).forEach((line) => {
    const li = dom.window.document.createElement("li")
    li.className = "passage"
    li.textContent = line
    ul.append(li)
  })
  const visible = ul.textContent.split(/\s+/).filter(Boolean).length
  assert.ok(visible >= 1000, `visible ${visible}`)
  assert.match(app, /askingLevel\(\) !== "architect" && !window\.KompasJev\.allowModel/)
  dom.window.close()
})

test("the ServiceNow development bio cannot reach Say this, the lexicon, or an answer", () => {
  const aside = answerAside({ question: "How do you use Splunk?", resume: OWNER_RESUME + "\n" + FOREIGN })
  assert.doesNotMatch(JSON.stringify(aside), /ServiceNow Development|10\+ years of experience in Sr/i)
  const only = answerAside({ question: "How do you use a SIEM?", resume: FOREIGN })
  assert.doesNotMatch(JSON.stringify(only), /ServiceNow Development|10\+ years of experience in Sr/i)
  const clause = lexiconClause("eshwarjay05", "ITSM modules and ServiceNow")
  assert.doesNotMatch(clause, /ServiceNow Development|10\+ years/i)
  const entry = lookupTerm("eshwarjay05", "itsm")
  assert.doesNotMatch((entry && entry.evidence || []).join(" "), /ServiceNow Development|10\+ years/i)
  const cleaned = fitLevelAnswer(FOREIGN + " At Citi Bank I search the notable in Splunk.", levelContract("engineer", "How do you use Splunk?"))
  assert.doesNotMatch(cleaned, /ServiceNow Development|10\+ years/i)
  assert.match(cleaned, /Splunk/)
})

test("pack fill keeps full sentences and drops labels and cut-off fragments", () => {
  assert.equal(spokenPackSentence("Story: At Citi Bank I assigned the ticket."), "")
  assert.equal(spokenPackSentence("Tools and controls I use: Name Fortify, SAST, owner, retest, ServiceNow only when the question needs them."), "")
  assert.equal(spokenPackSentence("Probe habit: I ask who owns the ticket."), "")
  assert.equal(spokenPackSentence("Story (CVS Heal"), "")
  const kept = spokenPackSentence("At Citi Bank I searched the notable in Splunk and I assigned the ServiceNow ticket.")
  assert.match(kept, /At Citi Bank I searched/)
  assert.match(kept, /\.$/)
})

test("pack fill openings follow the question and are not the stock Citi line", () => {
  const resume = "Citi Bank CVS Health Splunk ServiceNow Fortify"
  const splunk = expandToBand("", levelContract("engineer", "How do you use Splunk for detection?"), "At Citi Bank I searched the notable in Splunk and I assigned the ServiceNow ticket.", "How do you use Splunk for detection?", resume, true)
  const owasp = expandToBand("", levelContract("engineer", "How do you remediate an OWASP finding?"), "At CVS Health I remediated Broken Access Control on the portal and I retested the page.", "How do you remediate an OWASP finding?", resume, true)
  const first = (text) => String(text).split(/(?<=[.!?])\s+/)[0]
  assert.notEqual(first(splunk), first(owasp))
  assert.doesNotMatch(splunk + owasp, /I do this at Citi Bank|I pull the evidence, decide, and assign the ServiceNow ticket/)
  assert.match(depthText("appsec"), /Broken Access Control/)
  assert.match(depthText("appsec"), /Injection/)
  assert.match(depthText("pam-cyberark"), /vault/)
  assert.match(depthText("pam-cyberark"), /session recording|rotate the password/i)
})

test("video-2 Sentinel and escalate are their own questions, and an empty card is not answered", () => {
  const Gate = loadGate()
  const tools = "What are the same tools that you have worked on?"
  const sentinel = "Okay. All right. And uh can you explain to me how Sentinel works?"
  assert.equal(Gate.isFollowUp(sentinel, tools), false)
  assert.equal(Gate.shouldFire({ text: sentinel, previous: tools, pauseMs: Gate.FIRE_PAUSE_MS }).fire, true)
  const escalate = "at what instant you will escalate"
  assert.equal(Gate.isFollowUp(escalate, "okay you said you will escalate"), false)
  assert.equal(Gate.shouldFire({ text: escalate, previous: "okay you said you will escalate", pauseMs: Gate.FIRE_PAUSE_MS }).fire, true)
  const plan = Gate.manualAnswerPlan([{ question: "Preparing…", answer: "" }], 0, escalate)
  assert.equal(plan.reuse, true)
  assert.match(plan.question, /escalate/i)
  assert.equal(Gate.attributeSpeaker({ text: "I tuned the Splunk notable at Citi Bank.", previousRole: "Interviewer", source: "system" }), "You")
  const summary = Gate.sessionSummary({
    cards: [
      { question: "How does Sentinel work?", answer: "" },
      { question: "Do you know about XSS?", answer: "XSS is a script." },
      { question: "When do you escalate?", answer: "I escalate at Citi Bank when the account is still moving and I assign the ticket." },
    ],
  })
  assert.equal(summary.questions.find((row) => /sentinel/i.test(row.question)).answered, false)
  assert.equal(summary.questions.find((row) => /xss/i.test(row.question)).answered, false)
  assert.equal(summary.questions.find((row) => /escalate/i.test(row.question)).answered, true)
})
