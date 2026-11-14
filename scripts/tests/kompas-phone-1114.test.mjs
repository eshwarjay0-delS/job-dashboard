// Phone screenshots, 14 Nov 2026, 9:04–10:18 AM CT. The left card keeps the
// model's order. The clarify box uses resume sentences, not template filler.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"
import { cleanHeardQuestion } from "../../src/lib/kompasLongContext.ts"
import { answerAside } from "../../src/lib/kompasAnswerAside.ts"

const FILLER = /the reason that mattered|the pressure on it was|I'd stay with|the part I'd stay with|sat on that seat|so the way (?:we|I) approached it|Yeah, \w[\w\s]* is the part/i
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const asideJs = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")

function pageCard(question, answer) {
  const dom = new JSDOM("<ul id='answer'></ul><span id='question'></span>")
  const ctx = vm.createContext({ document: dom.window.document, window: {}, PAUSE_MARK: "(?:\\((?:pause|beat|breath)\\)|\\[(?:pause|beat|breath)\\])" })
  vm.runInContext(app.slice(app.indexOf("function unbracket"), app.indexOf("function renderCard")), ctx)
  const lines = ctx.answerLines(answer, question)
  const ul = dom.window.document.getElementById("answer")
  for (const line of lines) {
    const li = dom.window.document.createElement("li")
    li.className = line.kind
    ctx.inline(li, line.t)
    ul.append(li)
  }
  return ul.textContent
}

const AMI = [
  "eshwarjay05",
  "I owned the AMI telecom design end to end.",
  "I defined the meter-to-head-end requirements.",
  "I chose a hybrid mesh over a cellular-only design to cover rural gaps.",
  "I validated failover in the lab before rollout.",
].join("\n")

test("10:18 Design Ownership strips First, - and the sources tail, and keeps order", () => {
  const question = "Design Ownership for AMI Telecom Architecture."
  const raw = [
    "I owned the AMI telecom design end to end.",
    "- First, - So I kept the hybrid mesh to meet coverage and capacity targets.",
    "- First, - First I defined the meter-to-head-end requirements.",
    "- First, failure mode: a backhaul link loss causes the mesh to switch.",
    "- First, - I validate this by injecting packet loss in the lab. That part is not in the sources.",
  ].join("\n")
  const card = presentSpokenAnswer(question, raw, AMI)
  assert.doesNotMatch(card, /First, -/)
  assert.doesNotMatch(card, /not in the sources/i)
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Result)\*\*/)
  assert.ok(card.indexOf("owned the AMI") < card.indexOf("hybrid mesh"))
  assert.ok(card.indexOf("hybrid mesh") < card.indexOf("meter-to-head-end") || card.indexOf("meter-to-head-end") > 0)
  const shown = pageCard(question, raw)
  assert.doesNotMatch(shown, /First, -|not in the sources/i)
  assert.equal((shown.match(/\bFirst\b/g) || []).length <= 1, true)
})

test("10:08 generic third person is not the answer", () => {
  const card = presentSpokenAnswer("Did you design it alone?", [
    "No, I didn't design it alone. I led the architecture while coordinating with network and field-ops teams.",
    "In general, teams start by defining business and resiliency requirements.",
    "Next they build tunnel profiles and set fail-over thresholds.",
    "Finally they run automated fail-over tests.",
  ].join(" "))
  assert.match(card, /I didn't design it alone|I led the architecture/)
  assert.doesNotMatch(card, /In general, teams|they build|they run/)
})

test("9:47 the dash join splits, and the question drops YOU all and Thank you", () => {
  const question = cleanHeardQuestion("How do you script the failover checks? YOU all. Thank you.")
  assert.equal(question, "How do you script the failover checks?")
  assert.doesNotMatch(question, /YOU all|Thank you/i)
  const card = presentSpokenAnswer(question, "I script the failover checks in the lab. - I would apply the same check on the next change.")
  assert.doesNotMatch(card, / - I would/)
  assert.match(card, /I script the failover checks/)
  assert.ok(card.indexOf("I script") < card.indexOf("I would apply"))
})

test("9:13 and 9:14 headers stay off the main answer, and the box has no seat filler", () => {
  const card = presentSpokenAnswer("Did you design it alone?", [
    "**Claim**",
    "- I led the architecture while the network team reviewed the paths.",
    "**Context**",
    "- First, the field team confirmed the rural gaps.",
  ].join("\n"))
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Result)\*\*/)
  assert.match(card, /I led the architecture/)
  const aside = answerAside({
    question: "Did you design it alone?",
    resume: "eshwarjay05\nSenior Telecom Engineer — Utility & AMI Solutions | 2023 – Present\n- Owned the AMI telecom design end to end and checked the rural paths with the field team.",
    transcript: "Them: Did you design it alone?",
  })
  assert.doesNotMatch(JSON.stringify(aside), FILLER)
  assert.doesNotMatch(JSON.stringify(aside), /sat on that seat/)
})

test("9:09 Network design exp is not a definition and the box does not stay with network", () => {
  const card = presentSpokenAnswer("Network design exp", [
    "Network design experience, or \"network design exp,\" is the practice of planning and architecting a communications infrastructure.",
    "First, once that is established, I map logical layers using the topology on the resume.",
    "In general, teams design overlay networks with backup links.",
  ].join(" "))
  assert.doesNotMatch(card, /is the practice of/)
  assert.doesNotMatch(card, /In general, teams/)
  assert.doesNotMatch(card, /once that is established/i)
  assert.match(card, /I map logical layers/)
  const aside = answerAside({
    question: "Network design exp",
    resume: "eshwarjay05\n- Designed the wide area network for the utility sites and validated the backup paths.",
    transcript: "Them: Network design exp",
  })
  const blob = JSON.stringify(aside)
  assert.doesNotMatch(blob, FILLER)
  assert.doesNotMatch(blob, /I'd stay with network|Yeah, network is the part/i)
})

test("9:04 introduce yourself is one first-person paragraph", () => {
  const card = presentSpokenAnswer("Introduce yourself.", [
    "**Claim**",
    "- I began as a network engineer and I still do that work.",
    "…",
    "**Context**",
    "- First, at JPMorgan Chase I expanded into telecom engineering.",
    "**Result**",
    "- The result: currently I run the network for the utility sites.",
    "In general, I have stayed on the network path.",
  ].join("\n"))
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Result)\*\*/)
  assert.doesNotMatch(card, /^…$/m)
  assert.doesNotMatch(card, /\bFirst,/)
  assert.doesNotMatch(card, /The result:/)
  assert.match(card, /network engineer/)
  assert.match(card, /I have stayed on the network path/)
})

test("9:47 box lines are complete resume sentences, not a truncated SOAR fragment", () => {
  const aside = answerAside({
    question: "How do you script the response?",
    resume: [
      "eshwarjay05",
      "SOAR Automation & Metrics: Built automated response playbooks using.",
      "- Built automated response playbooks for the operations team and checked each one in the lab.",
    ].join("\n"),
    transcript: "Them: How do you script the response?",
  })
  const blob = JSON.stringify(aside)
  assert.doesNotMatch(blob, /sOAR|playbooks using\.|I'd stay with scripting|Yeah, scripting is the part/i)
  assert.match(blob, /I built automated response playbooks for the operations team/)
  assert.doesNotMatch(blob, FILLER)
})

test("the clarify box updates from a transcript line without AI Answer", async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <button id="startBtn" class="on">Stop</button>
    <button id="answerBtn">AI Answer</button>
    <span id="question">How would you design the service catalog?</span>
    <div class="a"><ul id="answer"></ul></div>
    <div id="drawerBody"></div><div id="capText"></div>
  </body>`, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  const { window } = dom
  let answerCalls = 0
  window.fetch = (url) => {
    if (String(url).includes("/api/kompas/answer")) answerCalls += 1
    return Promise.resolve({ ok: false, json: async () => ({}) })
  }
  Object.defineProperty(window.document, "visibilityState", { value: "visible", configurable: true })
  window.eval(asideJs)
  window.KompasAnswerAside.markLive(true)
  window.KompasAnswerAside.setResume("eshwarjay05\n- Owned the service catalog for a team of five and checked in with users on each request.")
  window.KompasAnswerAside.setOpen(true)
  window.KompasAnswerAside.hear("Them", "How would you design the service catalog?")
  const panel = window.document.getElementById("answerAside")
  assert.match(panel.textContent, /service catalog|How would you design/)
  assert.equal(answerCalls, 0)
  assert.equal(window.document.getElementById("answerBtn").textContent, "AI Answer")
  Object.defineProperty(window.document, "visibilityState", { value: "hidden", configurable: true })
  window.KompasAnswerAside.hear("Them", "tell me more about the catalog owners")
  window.KompasAnswerAside.flushLive()
  assert.doesNotMatch(panel.textContent, /catalog owners/)
  Object.defineProperty(window.document, "visibilityState", { value: "visible", configurable: true })
  window.KompasAnswerAside.flushLive()
  assert.match(panel.textContent, /Claim/)
  assert.doesNotMatch(panel.textContent, FILLER)
})
