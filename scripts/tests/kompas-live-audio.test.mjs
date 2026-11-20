// Live-audio notes from the 19 Nov production session on 1c6c1622.
// The sanitizer, the auto-fire gate, the level box, Stop, and the right panel.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { autoMayAnswer, isRealAsk, levelAfterInterviewType } from "../../src/lib/kompasConsistency.ts"
import { presentSpokenAnswer, withoutInventedNumbers } from "../../src/lib/kompasAnswerPresentation.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const aside = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")

function pageFn(name, end) {
  const start = app.indexOf(`function ${name}(`)
  assert.ok(start >= 0, name)
  return app.slice(start, app.indexOf(end, start))
}

test("the digit sanitizer keeps L1/L2/L3 and layer-3", () => {
  const raw = "At L1 they pull logs, at L2 they hunt, and at L3 they decide. Routers and layer-3 switches forward packets."
  const kept = withoutInventedNumbers(raw, "Senior SOC Analyst")
  assert.match(kept, /\bL1\b/)
  assert.match(kept, /\bL2\b/)
  assert.match(kept, /\bL3\b/)
  assert.match(kept, /layer-3/)
  assert.doesNotMatch(kept, /\bAt L\b/)
  assert.doesNotMatch(kept, /layer- switches/)
  const shown = presentSpokenAnswer(
    "What are the SOC levels?",
    "I pull logs at L1, hunt at L2, and decide at L3. I also use layer-3 switches.",
    "Senior SOC Analyst",
  )
  assert.match(shown, /L1/)
  assert.match(shown, /L2/)
  assert.match(shown, /L3/)
  assert.match(shown, /layer-3/)
  assert.match(app, /charAt\(i - 1\)/)
})

test("auto does not answer filler, candidate speech, own words, or a duplicate", () => {
  const filler = "Okay are okay Yeah yeah."
  assert.equal(isRealAsk(filler), false)
  assert.equal(autoMayAnswer({ speaker: "Them", text: filler }).fire, false)
  const candidate = "It's been six years he's working as a SOC analyst and he escalates threats."
  assert.equal(isRealAsk(candidate), false)
  assert.equal(autoMayAnswer({ speaker: "Them", text: candidate }).reason, "not-a-question")
  const ask = "Can you tell me about yourself, please?"
  assert.equal(autoMayAnswer({ speaker: "Them", text: ask }).fire, true)
  assert.equal(autoMayAnswer({ speaker: "You", text: ask }).reason, "own-speech")
  const paraphrase = autoMayAnswer({
    speaker: "Them",
    text: "Can you explain your experience with routing tables where routers consult the path?",
    ownLines: ["I know routing tables where routers consult the path and move one route to another."],
  })
  assert.equal(paraphrase.reason, "paraphrase")
  const again = autoMayAnswer({
    speaker: "Them",
    text: "Can you tell me about yourself, please?",
    recentQuestions: ["Can you tell me about yourself, please?"],
  })
  assert.equal(again.reason, "duplicate")
  const ctx = { transcript: [{ who: "You", text: "routing tables where routers consult the path" }] }
  vm.createContext(ctx)
  const askBlock = app.slice(app.indexOf("const ASK_STOP"), app.indexOf("function bookMatch"))
  vm.runInContext(askBlock + pageFn("questionEnded", "function paraphrasesOwn") + pageFn("paraphrasesOwn", "function confirmAutoQuestion") + "\nthis.ended = questionEnded; this.own = paraphrasesOwn;", ctx)
  assert.equal(ctx.ended(filler), false)
  assert.equal(ctx.ended(candidate), false)
  assert.equal(ctx.ended(ask), true)
  assert.equal(ctx.own("Can you explain routing tables where routers consult the path?"), true)
  assert.match(app, /candidateSide\(t\)/)
  assert.match(app, /duplicateAsk\(t\.text\)/)
})

test("Architect + Developer stays on the live level when the interview type is Technical", () => {
  assert.equal(levelAfterInterviewType("technical", "architect"), "architect")
  assert.equal(levelAfterInterviewType("technical", "director"), "director")
  assert.equal(levelAfterInterviewType("coding", "engineer"), "architect")
  assert.match(app, /levelAfterInterviewType\(b\.dataset\.v/)
  assert.match(app, /liveInterviewer"\)\.value = keptLevel\(s\.interviewer/)
  assert.match(html, /option value="architect">Architect \+ Developer/)
})

test("Stop only stops listening; leaving the session is the exit control", () => {
  assert.match(app, /running \? stop\(true\) : start\(\)/)
  assert.match(app, /\$\("exitCopilot"\)\.onclick = leaveLive/)
  assert.doesNotMatch(app, /running \? wrapSession\(\) : start\(\)/)
})

test("an empty right panel does not draw Claim, Touch points, or a booster chip", async () => {
  assert.doesNotMatch(aside, /No booster for this line/)
  assert.doesNotMatch(aside, /Context shows up with the next answer/)
  assert.doesNotMatch(aside, /el\("h3", "", "Claim"\)|el\("h3", "", name\)/)
  const dom = new JSDOM(`<!doctype html><body><div class="a"><ul id="answer"></ul></div><span id="question">Waiting</span><div id="drawerBody"></div><div id="capText"></div></body>`, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  dom.window.eval(aside)
  const panel = dom.window.document.getElementById("answerAside")
  dom.window.KompasAnswerAside.accept({ question: "What is routing?", context: { leads: [], touchPoints: [] }, questions: [], boosters: [], breakdown: { claim: "", context: "", result: "" } })
  assert.doesNotMatch(panel.textContent, /Claim|Touch points|No booster|Context shows up/)
  dom.window.document.getElementById("question").textContent = "Why did you choose security?"
  await new Promise((r) => setTimeout(r, 0))
  assert.doesNotMatch(panel.textContent, /Claim|Touch points|No booster|next answer/)
})
