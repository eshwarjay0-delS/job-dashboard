// The context panel toggles, remembers, and stacks under the answer on a narrow screen.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/answer-aside.css", import.meta.url), "utf8")
const js = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")

function page(width, open) {
  const dom = new JSDOM(`<!doctype html><html class="kd"><body>
    <section id="view-copilot">
      <div class="bar bar-actions"><button id="startBtn">Start</button><button id="answerBtn">AI Answer</button></div>
      <div class="content"><div class="card" id="card">
        <div class="q"><span id="question">Waiting for the interview to start…</span></div>
        <div class="a"><div class="a-head">Answer <button id="copyBtn">Copy</button></div>
          <ul id="answer"><li>Press Start.</li></ul>
        </div>
      </div></div>
      <div id="drawerBody"></div><div id="capText"></div>
    </section>
  </body></html>`, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  const { window } = dom
  window.innerWidth = width
  window.localStorage.clear()
  if (open) window.localStorage.setItem("kompas-answer-aside-open", "1")
  window.eval(js)
  return { window, document: window.document }
}

const sample = {
  question: "How would you design the service catalog rollout?",
  context: {
    leads: ["I was on a team of five and owned the service catalog, so I was checking in with users constantly."],
    touchPoints: ["so the way we approached it", "the reason that mattered", "what I owned"],
  },
  questions: ["What constraint should I treat as fixed here?", "Want me to go one step deeper?"],
}

test("the page loads the panel stylesheet and script after the answer app", () => {
  const cssAt = html.indexOf("answer-aside.css")
  const stylesAt = html.indexOf("styles.css")
  const scriptAt = html.indexOf("answer-aside.js")
  const appAt = html.indexOf("app.js")
  assert.ok(cssAt > stylesAt)
  assert.ok(scriptAt > appAt)
})

test("the arrow toggles the panel and remembers it", () => {
  const { document, window } = page(1280)
  const btn = document.getElementById("asideToggle")
  const panel = document.getElementById("answerAside")
  const answer = document.getElementById("answer")
  assert.ok(btn)
  assert.equal(btn.getAttribute("aria-expanded"), "false")
  assert.equal(panel.hidden, true)
  assert.equal(btn.textContent, "›")
  assert.ok(answer && answer.closest(".answer-stage"))
  assert.equal(document.getElementById("startBtn").textContent, "Start")
  assert.equal(document.getElementById("copyBtn").textContent, "Copy")
  btn.click()
  assert.equal(btn.getAttribute("aria-expanded"), "true")
  assert.equal(panel.hidden, false)
  assert.equal(btn.textContent, "‹")
  assert.equal(window.localStorage.getItem("kompas-answer-aside-open"), "1")
  btn.click()
  assert.equal(panel.hidden, true)
  assert.equal(window.localStorage.getItem("kompas-answer-aside-open"), "0")
})

test("a remembered open state comes back, and a new question clears the old context", async () => {
  const { window, document } = page(1280, true)
  const panel = document.getElementById("answerAside")
  assert.equal(panel.hidden, false)
  document.getElementById("question").textContent = sample.question
  window.KompasAnswerAside.accept(sample)
  assert.equal(panel.querySelector("h3").textContent, "Context")
  assert.equal(panel.querySelectorAll(".aside-leads li").length, 1)
  assert.equal(panel.querySelectorAll(".aside-questions li").length, 2)
  assert.equal(panel.querySelectorAll("h3")[1].textContent, "Clarifying questions")
  document.getElementById("question").textContent = "Why did the flow stall?"
  await new Promise((r) => setTimeout(r, 0))
  assert.match(panel.textContent, /next answer/)
  assert.equal(panel.querySelector(".aside-leads"), null)
})

test("section 2 toggles by hand and follows a new transcript line without a fetch", async () => {
  const { window, document } = page(1280, true)
  const aside = {
    question: "How would you design the service catalog rollout?",
    mode: "questions",
    context: sample.context,
    questions: ["Why do you think that's happening?", "What constraint should I treat as fixed here?"],
    boosters: ["Yeah, that's true.", "I'd stay with what you just said."],
  }
  document.getElementById("question").textContent = aside.question
  window.KompasAnswerAside.accept(aside)
  const list = document.getElementById("asideModeList")
  assert.match(list.textContent, /Why do you think/)
  document.getElementById("asideModeBoosters").click()
  assert.match(list.textContent, /Yeah, that's true/)
  assert.doesNotMatch(list.textContent, /Why do you think/)
  document.getElementById("asideModeAuto").click()
  document.getElementById("drawerBody").textContent = "Them: So the owners are spread across the teams and the handoff is where it stalls."
  await new Promise((r) => setTimeout(r, 0))
  const afterStatement = document.getElementById("asideModeList")
  assert.match(afterStatement.textContent, /Yeah, that's true/)
  document.getElementById("capText").textContent = "Have you worked with the catalog before?"
  await new Promise((r) => setTimeout(r, 0))
  const afterAsk = document.getElementById("asideModeList")
  assert.match(afterAsk.textContent, /Why do you think/)
  let fetched = 0
  window.fetch = () => { fetched++; return Promise.resolve({ clone() { return this }, headers: { get: () => "" }, json: async () => ({}) }) }
  document.getElementById("drawerBody").textContent = "Them: Let me explain the handoff again."
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(fetched, 0)
})

test("mobile layout stacks the panel under the answer, and the desktop panel is half the answer width", () => {
  assert.match(css, /@media \(max-width:900px\)/)
  const narrow = css.slice(css.indexOf("@media (max-width:900px)"))
  assert.match(narrow, /flex-direction:\s*column/)
  assert.match(narrow, /width:\s*100%/)
  assert.match(css, /\.answer-stage > \.a\{[\s\S]*flex:\s*2 1 0/)
  assert.match(css, /\.answer-aside\{[\s\S]*flex:\s*1 1 0/)
  assert.match(css, /html\.kd #view-copilot \.answer-stage/)
  assert.match(css, /top:\s*50%/)
  assert.doesNotMatch(css, /#startBtn\{display:\s*none|#answerBtn\{display:\s*none|#copyBtn\{display:\s*none/)
  const { document } = page(390)
  const stage = document.getElementById("answerStage")
  const panel = document.getElementById("answerAside")
  assert.equal(stage.lastElementChild, panel)
  assert.ok(document.getElementById("answer").compareDocumentPosition(panel) & 4)
})
