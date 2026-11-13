// The in-page brain: event-driven, memory only, private mode still hides the panel.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const js = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")

test("the page brain is event-driven, stays in memory, and private mode still hides the panel", async () => {
  const dom = new JSDOM(html, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  const { window } = dom
  window.localStorage.clear()
  window.eval(js)
  assert.doesNotMatch(js, /setInterval\(|setTimeout\(\s*perceive|new WebSocket|fetch\(/)
  const step = window.KompasAnswerAside.perceive("You", "I'm available in the Pittsburgh area, on site.")
  assert.equal(step.action, "hold")
  const next = window.KompasAnswerAside.perceive("Them", "So you would only work remote, right?")
  assert.equal(next.action, "flag-contradiction")
  assert.match(next.shown, /Pittsburgh/)
  const early = window.KompasAnswerAside.perceive("Them", "How would you design the")
  assert.equal(early.action, "prewarm")
  assert.match(window.KompasAnswerAside.brain().prewarm, /How would you design the\?/)
  assert.doesNotMatch(JSON.stringify(window.localStorage), /Pittsburgh|prewarm|flag-contradiction/)
  window.KompasAnswerAside.applyPrivate(true)
  const overlay = window.document.getElementById("overlay")
  const panel = window.document.getElementById("answerAside")
  assert.ok(overlay.contains(panel))
  window.KompasAnswerAside.setOpen(true)
  await new Promise((r) => setTimeout(r, 0))
  window.document.getElementById("question").textContent = "How would you design the catalog?"
  window.KompasAnswerAside.accept({
    question: "How would you design the catalog?",
    mode: "questions",
    context: { leads: ["I owned the service catalog."], touchPoints: ["what I owned", "the reason that mattered", "where I would start"] },
    questions: ["What constraint should I treat as fixed here?", "Want me to stay on the catalog?"],
    boosters: ["Yeah, that's true.", "I'd stay with what you just said."],
    trace: [{ line: "I owned the service catalog.", why: "Them: the catalog rollout" }],
  })
  assert.equal(panel.querySelector(".aside-leads li").title, "Them: the catalog rollout")
  const second = {
    question: "Why did the flow stall?",
    mode: "boosters",
    context: { leads: ["The reason that mattered was the stall."], touchPoints: ["the reason that mattered", "what I owned", "where I would start"] },
    questions: ["Where should I stop?"],
    boosters: ["Yeah, I'd stay with that point."],
  }
  window.document.getElementById("question").textContent = second.question
  window.KompasAnswerAside.accept(second)
  await new Promise((r) => setTimeout(r, 0))
  panel.querySelector("#asidePrev").click()
  assert.match(panel.textContent, /service catalog/)
  assert.match(panel.textContent, /Earlier/)
  panel.querySelector("#asideNext").click()
  assert.match(panel.textContent, /stall/)
  assert.match(panel.textContent, /Live/)
  assert.doesNotMatch(JSON.stringify(window.localStorage), /service catalog|stall/)
})
