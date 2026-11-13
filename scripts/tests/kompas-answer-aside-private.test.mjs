// The side panel uses the same private path as the answer: it lives in #overlay
// (hidden for a screen grab) and under the desktop window's content protection.
// Open/closed state is a local flag. The lines are not stored or shared.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const js = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/answer-aside.css", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const preload = readFileSync(new URL("../../legacy/perfact/desktop/preload.js", import.meta.url), "utf8")
const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")

function boot() {
  const dom = new JSDOM(html, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  const { window } = dom
  window.localStorage.clear()
  window.eval(js)
  return window
}

test("the panel is inside the overlay the screen grab hides, same as the answer", () => {
  const window = boot()
  const overlay = window.document.getElementById("overlay")
  const panel = window.document.getElementById("answerAside")
  const answer = window.document.getElementById("answer")
  const toggle = window.document.getElementById("asideToggle")
  assert.ok(overlay.contains(answer))
  assert.ok(overlay.contains(panel))
  assert.ok(overlay.contains(toggle))
  overlay.style.visibility = "hidden"
  assert.equal(overlay.style.visibility, "hidden")
  assert.ok(overlay.contains(panel))
  assert.match(app, /getElementById\("overlay"\)/)
  assert.match(app, /overlayEl\.style\.visibility = "hidden"/)
  assert.doesNotMatch(js, /window\.open|BrowserWindow|document\.body\.append/)
  assert.doesNotMatch(css, /position:\s*fixed/)
})

test("the desktop private flag covers the panel with the answer and does not store the lines", () => {
  const window = boot()
  window.document.documentElement.classList.add("kd")
  window.KompasAnswerAside.applyPrivate(true)
  assert.ok(window.document.documentElement.classList.contains("kd"))
  assert.ok(window.document.documentElement.classList.contains("kd-private"))
  const overlay = window.document.getElementById("overlay")
  const panel = window.document.getElementById("answerAside")
  assert.ok(overlay.contains(panel))
  window.KompasAnswerAside.setOpen(true)
  window.KompasAnswerAside.accept({
    question: "How would you design the service catalog rollout?",
    mode: "questions",
    context: { leads: ["I owned the service catalog."], touchPoints: ["what I owned"] },
    questions: ["Why do you think that's happening?"],
    boosters: ["Yeah, that's true."],
  })
  const stored = JSON.stringify(window.localStorage)
  assert.match(stored, /kompas-answer-aside-open/)
  assert.doesNotMatch(stored, /service catalog|Why do you think|Yeah, that's true/)
  assert.match(preload, /classList\.toggle\("kd-private", !!s\.isPrivate\)/)
  assert.match(main, /w\.setContentProtection\(hidden\)/)
  assert.match(app, /"aside"/)
  assert.doesNotMatch(main, /answerAside|BrowserWindow\(\{[^}]*aside/)
})
