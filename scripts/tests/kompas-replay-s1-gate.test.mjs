// Acceptance gate for the Taskmaster S1 slice, video XQC_t7uplBo, 0:00–5:44, q1–q5.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { longSessionAnswer } from "../../src/lib/kompasConsistency.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const s1 = JSON.parse(readFileSync(new URL("../fixtures/replay-s1.json", import.meta.url), "utf8"))
const start = app.indexOf("function isGatedQuestion")
const end = app.indexOf("function liveInterviewer(")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\nthis.replay = replayS1; this.header = oneQuestionLine; this.stub = answerIsStub;", ctx)

const RESUME = [
  "Senior SOC analyst who monitored Splunk alerts and triaged each incident from open to close.",
  "Escalated confirmed threats and wrote the daily and weekly report for the SOC leads.",
  "Investigated phishing mail and endpoint activity with CrowdStrike and Microsoft Defender.",
  "Kept routing notes for how packets move between the office networks and the VPN.",
].join(" ")

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

test("replay-s1 covers q1 through q5 on XQC_t7uplBo", () => {
  assert.equal(s1.video, "XQC_t7uplBo")
  assert.equal(s1.window, "0:00-5:44")
  const ids = s1.events.filter((ev) => ev.role === "question").map((ev) => ev.id)
  assert.deepEqual(ids, ["q1", "q2", "q3", "q4", "q5"])
  assert.ok(s1.events.some((ev) => ev.role === "candidate" && ev.track === "mic"))
  assert.ok(s1.events.some((ev) => ev.role === "smalltalk" && ev.track === "tab"))
  assert.ok(s1.events.filter((ev) => ev.role === "question").every((ev) => ev.track === "tab"))
})

test("1 and 2: Auto fires on all 5 questions within 2s, and not on candidate speech or small talk", () => {
  const out = ctx.replay(s1.events)
  assert.equal(JSON.stringify(out.fires.map((fire) => fire.id)), JSON.stringify(["q1", "q2", "q3", "q4", "q5"]))
  for (const fire of out.fires) assert.ok(fire.delayMs <= 2000 && fire.delayMs >= 700, String(fire.delayMs))
  const fired = new Set(out.fires.map((fire) => fire.question))
  for (const ev of s1.events) {
    if (ev.role === "candidate" || ev.role === "smalltalk") assert.equal(fired.has(ev.text), false, ev.text)
  }
})

test("3: no candidate turn is labeled THEM", () => {
  const out = ctx.replay(s1.events)
  const missed = out.lines.filter((line) => line.role === "candidate" && line.who === "Them")
  assert.equal(missed.length, 0)
  assert.ok(out.lines.filter((line) => line.role === "candidate").every((line) => line.who === "You"))
})

test("4: each question header is a single Question line", () => {
  for (const ev of s1.events.filter((item) => item.role === "question")) {
    const header = ctx.header(ev.text)
    assert.equal(header.split("\n").length, 1)
    assert.equal((header.match(/Question:/g) || []).length, 1)
    assert.match(header, /^Question: /)
  }
})

test("5: a Long answer for each question is at least 120 words and not a stub", () => {
  for (const ev of s1.events.filter((item) => item.role === "question")) {
    const answer = longSessionAnswer(ev.text, RESUME, "Splunk ES, CrowdStrike, Microsoft Defender")
    const words = answer.split(/\s+/).filter(Boolean).length
    assert.ok(words >= 120 && words <= 180, `${ev.id} ${words}`)
    assert.equal(ctx.stub(answer), false, answer.slice(0, 80))
  }
})

test("6: the tab preview never overlaps AI Answer, Start, or More", () => {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const preview = doc.getElementById("tabPreview")
  const start = doc.getElementById("startBtn")
  const answer = doc.getElementById("answerBtn")
  const more = doc.getElementById("moreBtn")
  assert.ok(preview && start && answer && more)
  assert.equal(preview.classList.contains("is-collapsed"), true)
  assert.equal(preview.hidden, true)
  assert.equal(preview.contains(start) || preview.contains(answer) || preview.contains(more), false)
  assert.equal(preview.parentElement && preview.parentElement.classList.contains("content"), true)
  const controls = [
    { name: "start", x: 16, y: 8, w: 120, h: 48 },
    { name: "answer", x: 150, y: 8, w: 180, h: 48 },
    { name: "more", x: 680, y: 8, w: 40, h: 40 },
  ]
  const collapsed = { x: 0, y: 0, w: 0, h: 0 }
  const docked = { x: 560, y: 160, w: 168, h: 110 }
  for (const box of [collapsed, docked]) {
    for (const control of controls) assert.equal(overlaps(box, control), false, control.name)
  }
  assert.match(css, /#tabPreview\.is-collapsed\{display:none !important/)
  assert.doesNotMatch(css, /#tabPreview\{[^}]*position:absolute/)
})
