// Left-card cleanup. Fixtures are the 9:04, 9:09, 9:14, 9:27, and 10:08 screenshots.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

function leftText(question, card) {
  const dom = new JSDOM("<ul id='answer'></ul>")
  const ctx = vm.createContext({ document: dom.window.document, window: {}, PAUSE_MARK: "(?:\\((?:pause|beat|breath)\\)|\\[(?:pause|beat|breath)\\])" })
  vm.runInContext(app.slice(app.indexOf("function unbracket"), app.indexOf("function renderCard")), ctx)
  const ul = dom.window.document.getElementById("answer")
  for (const line of ctx.answerLines(card, question)) {
    if (line.kind === "head" || line.kind === "pauseline") continue
    const li = dom.window.document.createElement("li")
    li.className = line.kind
    ctx.inline(li, line.t)
    ul.append(li)
  }
  return ul.textContent
}

test("no leading connector, dash, or em dash on a left bullet", () => {
  const question = "Network design exp"
  const card = presentSpokenAnswer(question, [
    "**Context**",
    "- First, once that is established, I map logical layers —core, aggregation, and edge—using topology diagrams.",
    "- Then, I size the backup links.",
    "- Next, I draft the routing policy.",
    "- Finally, I validate the fail-over.",
    "- In addition, I check the latency target.",
    "- — I keep the core path.",
  ].join("\n"))
  assert.doesNotMatch(card, /^(?:First|Then|Next|Finally|In addition|Once that is established),/im)
  assert.doesNotMatch(card, /^- (?:-|—|–)/m)
  assert.match(card, /I map logical layers —core, aggregation, and edge—using topology diagrams/)
  assert.match(card, /I size the backup links/)
  const shown = leftText(question, card)
  assert.doesNotMatch(shown, /(?:First|Then|Next|Finally),/)
  assert.doesNotMatch(shown, /Once that is established|In addition,/)
})

test("generic third person is dropped and first-person team work stays", () => {
  const question = "Did you design it alone?"
  const card = presentSpokenAnswer(question, [
    "No, I didn't design it alone I led the architecture while coordinating with network, security, vendor, and field-ops teams.",
    "We rejected a pure vendor-supplied blueprint because it would have locked us into a single carrier.",
    "In general, teams start by defining business and resiliency requirements.",
    "In general, teams design overlay networks with backup links.",
    "Next they build tunnel profiles and set fail-over thresholds.",
    "Finally they run automated fail-over tests.",
  ].join(" "))
  assert.match(card, /field-ops teams/)
  assert.match(card, /vendor-supplied blueprint/)
  assert.doesNotMatch(card, /In general, teams|teams start|they build|they run/)
})

test("a dictionary opener that defines the question term is dropped", () => {
  const question = "Network design exp"
  const card = presentSpokenAnswer(question, [
    "Network design experience, or “network design exp,” is the practice of planning and architecting a communications infrastructure.",
    "The primary tool I use for that mapping is Visio combined with route-simulation scripts in Python.",
  ].join(" "))
  assert.doesNotMatch(card, /is the practice of/)
  assert.match(card, /The primary tool I use for that mapping is Visio/)
})

test("section labels and ellipsis separators are not on the left card", () => {
  const question = "Introduce yourself."
  const source = [
    "**Claim**",
    "- I began as a Network Engineer at TCS, where I built core WAN circuits.",
    "…",
    "**Context**",
    "- First, at JPMorgan Chase I expanded into telecom engineering.",
    "**Result**",
    "- The result: currently at Utility and AMI Solutions I run the network.",
    "**What I did**",
    "- I built private APN and IPsec VPN links.",
  ].join("\n")
  const card = presentSpokenAnswer(question, source)
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*/)
  assert.doesNotMatch(card, /^…$/m)
  assert.match(card, /Network Engineer at TCS/)
  assert.match(card, /JPMorgan Chase/)
  assert.match(card, /Utility and AMI Solutions/)
  const shown = leftText(question, source)
  assert.doesNotMatch(shown, /\b(?:Claim|Context|Action|Result|Close)\b/)
  assert.equal(shown.includes("…"), false)
})

test("duplicate sentences, a lowercase start, and doubled punctuation are cleaned without reordering", () => {
  const question = "Did you design it alone?"
  const card = presentSpokenAnswer(question, [
    "we rejected a pure vendor-supplied blueprint.",
    "We rejected a pure vendor-supplied blueprint.",
    "I sized the backup links..",
    "I led the architecture for the SD-WAN design with the network team.",
    "I led the architecture for the SD-WAN design with the network team.",
  ].join(" "))
  assert.equal(card.match(/vendor-supplied blueprint/gi).length, 1)
  assert.equal(card.match(/SD-WAN design/gi).length, 1)
  assert.match(card, /^- We rejected/m)
  assert.match(card, /I sized the backup links\./)
  assert.doesNotMatch(card, /\.\./)
  assert.ok(card.indexOf("vendor-supplied") < card.indexOf("SD-WAN"))
})

test("a past question drops I would when a first-person past sentence is present", () => {
  const past = presentSpokenAnswer("Did you design it alone?", [
    "I started by drafting the network topology in Visio.",
    "I would start by drafting a different topology.",
  ].join(" "))
  assert.match(past, /I started by drafting the network topology/)
  assert.doesNotMatch(past, /I would/)
  const open = presentSpokenAnswer("How would you design the network?", "I would start by drafting the network topology in Visio.")
  assert.match(open, /I would start by drafting the network topology/)
})
